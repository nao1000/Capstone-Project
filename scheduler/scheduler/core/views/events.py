'''
views/events.py
API endpoints for fixed events (obstructions) and team member removal.
'''

import json
from datetime import time

from django.shortcuts import get_object_or_404
from django.http import JsonResponse, HttpResponseForbidden
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt

from ..models import (
    FixedObstruction,
    ObstructionDay,
    Role,
    RoleSection,
    Team,
    TeamEvent,
    TeamRoleAssignment,
)


@login_required
@require_http_methods(["POST"])
def add_event(request, team_id):
    team = get_object_or_404(Team, id=team_id)
    if team.owner != request.user:
        return HttpResponseForbidden("Unauthorized")

    try:
        data = json.loads(request.body)
        event = TeamEvent.objects.create(
            team=team,
            name=data.get("name"),
            day=data.get("day"),
            start_time=data.get("start"),
            end_time=data.get("end"),
        )
        return JsonResponse({"ok": True, "event": {"id": event.id, "name": event.name, "day": event.day}})
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=400)


@csrf_exempt
@require_http_methods(["POST"])
def create_obstruction(request, team_id):
    '''
    Create a fixed obstruction (e.g. a class or commitment) that blocks scheduling for a role.
    '''
    data = json.loads(request.body)
    team = get_object_or_404(Team, id=team_id)
    role = get_object_or_404(Role, id=data["role_id"]) if data.get("role_id") else None

    start_min  = data["start_min"]
    end_min    = data["end_min"]
    start_time = time(start_min // 60, start_min % 60)
    end_time   = time(end_min // 60, end_min % 60)

    section_id  = data.get('section', None)
    section_obj = get_object_or_404(RoleSection, id=section_id) if section_id else None
    section_name = section_obj.name if section_obj else None

    obstruction = FixedObstruction.objects.create(
        team=team,
        location=data["location"],
        role=role,
        name=data["name"],
        start_time=start_time,
        end_time=end_time,
        section=section_name,
    )

    day_names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
    for day_index in data["days"]:
        ObstructionDay.objects.create(obstruction=obstruction, day=day_names[day_index])

    return JsonResponse({"status": "ok", "obstruction_id": obstruction.id})


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_obstruction(request, team_id, obstruction_id):
    obstruction = get_object_or_404(FixedObstruction, team=team_id, id=obstruction_id)
    obstruction.delete()
    return JsonResponse({"status": "ok"})


@require_http_methods(["POST"])
def remove_member_from_team(request, team_id):
    '''
    Remove a member from the team and delete their role assignment.
    '''
    try:
        data    = json.loads(request.body)
        user_id = data.get('user_id')

        team = Team.objects.get(id=team_id)
        team.members.remove(user_id)
        TeamRoleAssignment.objects.filter(team=team, user_id=user_id).delete()

        return JsonResponse({'status': 'success'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)