'''
views/availability.py
API endpoints for worker availability: saving busy/preferred blocks and role preferences,
and fetching a specific worker's availability for the supervisor scheduler.
'''

from django.shortcuts import get_object_or_404
from django.http import JsonResponse, HttpResponseForbidden
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.views.decorators.http import require_http_methods
from django.db import transaction
from django.db.models import Prefetch
import json

from ..models import (
    UnavailabilityRange,
    PreferredTime,
    Role,
    RoleSection,
    Team,
    UserRolePreference,
    FixedObstruction,
)
from .utils import DAY_MAP, minutes_to_string, time_to_minutes


@login_required
@require_http_methods(["POST"])
def save_availability(request, team_id):
    '''
    Save a worker's busy blocks, preferred time blocks, and ranked role preferences.

    Expected payload:
    {
        "busy":             [{ "day": 1, "start_min": 480, "end_min": 960, "name": "...", "location": "..." }],
        "preferred":        [{ "day": 3, "start_min": 600, "end_min": 720 }],
        "role_preferences": [{ "rank": 1, "role_id": 12, "section_id": 34 }]
    }
    '''
    try:
        data = json.loads(request.body)
        team = get_object_or_404(Team, id=team_id)

        if request.user not in team.members.all() and request.user != team.owner:
            return HttpResponseForbidden("You are not a member of this team.")

        busy_data      = data.get("busy", [])
        preferred_data = data.get("preferred", [])
        role_pref_data = data.get("role_preferences", [])

        with transaction.atomic():
            # --- Busy blocks ---
            UnavailabilityRange.objects.filter(user=request.user, team=team).delete()
            for item in busy_data:
                day_str = DAY_MAP.get(item.get("day"), "mon")
                UnavailabilityRange.objects.create(
                    user=request.user,
                    team=team,
                    day=day_str,
                    start_time=minutes_to_string(item.get("start_min")),
                    end_time=minutes_to_string(item.get("end_min")),
                    building=item.get("location", ""),
                    eventName=item.get("name", ""),
                )

            # --- Preferred time blocks ---
            PreferredTime.objects.filter(user=request.user, team=team).delete()
            for item in preferred_data:
                day_str = DAY_MAP.get(item.get("day"), "mon")
                PreferredTime.objects.create(
                    user=request.user,
                    team=team,
                    day=day_str,
                    start_time=minutes_to_string(item.get("start_min")),
                    end_time=minutes_to_string(item.get("end_min")),
                )

            # --- Ranked role+section preferences ---
            UserRolePreference.objects.filter(user=request.user, team=team).delete()
            for item in role_pref_data:
                role_id    = item.get("role_id")
                section_id = item.get("section_id")
                rank       = item.get("rank")

                role = get_object_or_404(Role, id=role_id, team=team)
                section = None
                if section_id:
                    section = get_object_or_404(RoleSection, id=section_id, role=role)

                UserRolePreference.objects.create(
                    user=request.user,
                    team=team,
                    role=role,
                    section=section,
                    rank=rank,
                )

        return JsonResponse({
            "status": "success",
            "busy_count": len(busy_data),
            "preferred_count": len(preferred_data),
            "role_pref_count": len(role_pref_data),
        })

    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)


@login_required
def get_worker_availability(request, team_id, worker_id):
    '''
    Returns a specific worker's availability. Accessible by the supervisor or the worker themselves.
    '''
    team = get_object_or_404(Team, id=team_id)
    if team.owner != request.user and request.user.id != int(worker_id):
        return HttpResponseForbidden("Unauthorized")

    target_user = get_object_or_404(User, id=worker_id)
    ranges = UnavailabilityRange.objects.filter(user=target_user, team=team)

    availability_list = [
        {
            "day": r.day.lower(),
            "start_min": time_to_minutes(r.start_time),
            "end_min": time_to_minutes(r.end_time),
            "building": r.building,
            "eventName": r.eventName,
            "label": f"{r.start_time.strftime('%H:%M')} - {r.end_time.strftime('%H:%M')}",
        }
        for r in ranges
    ]

    preferred = PreferredTime.objects.filter(user=target_user, team=team)
    preferred_list = [
        {
            "day": p.day.lower(),
            "start_min": time_to_minutes(p.start_time),
            "end_min": time_to_minutes(p.end_time),
            "label": f"{p.start_time.strftime('%H:%M')} - {p.end_time.strftime('%H:%M')}",
        }
        for p in preferred
    ]

    preferred_roles = UserRolePreference.objects.filter(
        user=target_user, team=team
    ).select_related('role', 'section').prefetch_related(
        Prefetch(
            'role__fixedobstruction_set',
            queryset=FixedObstruction.objects.filter(team=team).prefetch_related('days'),
        )
    ).order_by('rank')

    pRole_list = [
        {
            "rank": pRole.rank,
            "role_id": pRole.role.id,
            "role_name": pRole.role.name,
            "section_id": pRole.section.id if pRole.section else None,
            "section_name": pRole.section.name if pRole.section else None,
            "obstructions": [
                {
                    "name": o.name,
                    "section": o.section,
                    "start_min": time_to_minutes(o.start_time),
                    "end_min": time_to_minutes(o.end_time),
                    "days": [d.day for d in o.days.all()],
                }
                for o in pRole.role.fixedobstruction_set.all()
                if o.section is None or o.section == (pRole.section.name if pRole.section else None)
            ]
        }
        for pRole in preferred_roles
    ]

    return JsonResponse({
        "availabilityData": availability_list,
        "preferredData": preferred_list,
        "roleData": pRole_list,
    })