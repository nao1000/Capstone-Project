'''
views/roles.py
API endpoints for role and section management, and member role/section assignments.
'''

import json
from django.db import models
from django.shortcuts import get_object_or_404
from django.http import JsonResponse, HttpResponseForbidden, HttpResponseBadRequest
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.views.decorators.http import require_http_methods

from ..models import (
    AvailabilityRange,
    Role,
    RoleSection,
    Team,
    TeamRoleAssignment,
)
from .utils import time_to_minutes


@login_required
@require_http_methods(["POST"])
def create_role(request, team_id):
    '''
    Create a new role for the team (supervisor only). Returns existing role if name matches.
    '''
    team = get_object_or_404(Team, id=team_id)
    if team.owner != request.user:
        return HttpResponseForbidden("Only supervisors can create roles.")

    try:
        data = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return HttpResponseBadRequest("Invalid JSON")

    name = (data.get("name") or "").strip()
    if not name:
        return HttpResponseBadRequest("Missing role name")

    try:
        role = Role.objects.get(team=team, name=name)
        return JsonResponse({"ok": True, "role_id": role.id, "created": False, "name": role.name})
    except Role.DoesNotExist:
        role = Role.objects.create(team=team, name=name)
        return JsonResponse({"ok": True, "role_id": role.id, "created": True, "name": role.name})


@login_required
def list_roles(request, team_id):
    '''
    Return all roles for a team.
    '''
    team = get_object_or_404(Team, id=team_id)

    if request.user != team.owner and request.user not in team.members.all():
        return HttpResponseForbidden("Not allowed")

    roles = Role.objects.filter(team=team).order_by("name")
    return JsonResponse({"roles": [{"id": r.id, "name": r.name} for r in roles]})


@login_required
def get_team_roles(request, team_id):
    team = get_object_or_404(Team, id=team_id)
    roles = Role.objects.filter(team=team).values()
    return JsonResponse({"roles": list(roles)})


@login_required
@require_http_methods(["DELETE"])
def delete_role(request, team_id, role_id):
    '''
    Delete a role and unassign all members from it.
    '''
    team = get_object_or_404(Team, id=team_id)
    if team.owner != request.user:
        return HttpResponseForbidden()

    role = get_object_or_404(Role, id=role_id, team=team)
    role.delete()
    return JsonResponse({"ok": True})


@login_required
def filter_view(request, team_id, role_id):
    '''
    Return workers and their availability filtered by a specific role.
    '''
    assignments = TeamRoleAssignment.objects.filter(
        team_id=team_id, role_id=role_id
    ).select_related('section')

    user_ids    = [a.user_id for a in assignments]
    section_map = {a.user_id: a.section.name if a.section else None for a in assignments}

    relevant_users = User.objects.filter(id__in=user_ids).prefetch_related(
        models.Prefetch(
            "availabilityrange_set",
            queryset=AvailabilityRange.objects.filter(team_id=team_id),
            to_attr="team_avail",
        )
    )

    workers_data = [
        {
            "id": str(user.id),
            "name": user.get_full_name() or user.username,
            "availability": [
                {
                    "day": r.day.lower(),
                    "start_min": time_to_minutes(r.start_time),
                    "end_min": time_to_minutes(r.end_time),
                    "label": f"{r.start_time.strftime('%H:%M')} - {r.end_time.strftime('%H:%M')}",
                }
                for r in user.team_avail
            ],
            "section": section_map.get(user.id),
        }
        for user in relevant_users
    ]

    return JsonResponse({"workers": workers_data})


@login_required
@require_http_methods(["POST"])
def assign_role(request, team_id):
    '''
    Assign (or update) a role and optional section for a worker.
    '''
    team = get_object_or_404(Team, id=team_id)
    data = json.loads(request.body)
    user_id = data.get('worker_id') or data.get('user_id')
    role_id = data.get('role_id')
    section = data.get('section', None)

    user = get_object_or_404(User, id=user_id)
    TeamRoleAssignment.objects.update_or_create(
        team=team,
        user=user,
        defaults={
            'role_id': role_id if role_id else None,
            'section': section or None,
        }
    )
    return JsonResponse({'status': 'ok'})


@login_required
@require_http_methods(["POST"])
def unassign_role(request, team_id):
    '''
    Remove a specific role assignment from a worker.
    '''
    team = get_object_or_404(Team, id=team_id)
    if team.owner != request.user:
        return HttpResponseForbidden("Only supervisors can unassign roles.")

    try:
        data = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return HttpResponseBadRequest("Invalid JSON")

    worker_id = data.get("worker_id")
    role_id   = data.get("role_id")
    if not worker_id or not role_id:
        return HttpResponseBadRequest("worker_id and role_id required")

    TeamRoleAssignment.objects.filter(team=team, user_id=worker_id, role_id=role_id).delete()
    return JsonResponse({"ok": True})


@login_required
def worker_roles(request, team_id, worker_id):
    '''
    Return all role assignments for a specific worker on the team.
    '''
    team   = get_object_or_404(Team, id=team_id)
    worker = get_object_or_404(User, id=worker_id)

    if worker != team.owner and worker not in team.members.all():
        return HttpResponseBadRequest("Worker is not on this team")
    if request.user != team.owner and request.user.id != worker_id:
        return HttpResponseForbidden("Unauthorized")

    assigned = (
        TeamRoleAssignment.objects.filter(team=team, user_id=worker_id)
        .select_related("role")
        .order_by("role__name")
    )

    return JsonResponse({"roles": [{"id": a.role.id, "name": a.role.name} for a in assigned]})


def get_role_sections(request, team_id, role_id):
    role = get_object_or_404(Role, id=role_id, team_id=team_id)
    sections = list(role.sections.values('id', 'name'))
    return JsonResponse({'sections': sections})


def create_role_section(request, team_id, role_id):
    role = get_object_or_404(Role, id=role_id, team_id=team_id)
    data = json.loads(request.body)
    name = data.get('name', '').strip()
    if not name:
        return JsonResponse({'error': 'Section name required'}, status=400)
    section, created = RoleSection.objects.get_or_create(role=role, name=name)
    return JsonResponse({'id': section.id, 'name': section.name})


def delete_role_section(request, team_id, role_id, section_id):
    section = get_object_or_404(RoleSection, id=section_id, role_id=role_id)
    section.delete()
    return JsonResponse({'status': 'ok'})


def save_member_assignments(request, team_id):
    '''
    Bulk-save role and section assignments for all members.
    '''
    team = get_object_or_404(Team, id=team_id)
    data = json.loads(request.body)
    assignments = data.get('assignments', [])

    for a in assignments:
        user_id    = a.get('user_id')
        role_id    = a.get('role_id') or None
        section_id = a.get('section_id') or None

        user = get_object_or_404(User, id=user_id)
        TeamRoleAssignment.objects.update_or_create(
            team=team,
            user=user,
            defaults={'role_id': role_id, 'section_id': section_id}
        )

    return JsonResponse({'status': 'ok', 'saved': len(assignments)})