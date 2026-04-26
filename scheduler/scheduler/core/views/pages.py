"""
views/pages.py
Full HTML page views (not API endpoints).
Renders the availability, supervisor, and scheduler pages.
"""

import json

from django.shortcuts import render, get_object_or_404
from django.http import HttpResponseForbidden
from django.contrib.auth.decorators import login_required
from django.views.decorators.cache import never_cache
from django.db.models import Prefetch

from ..models import (
    AvailabilityRange,
    PreferredTime,
    Role,
    Schedule,
    ScheduleTemplate,
    Team,
    TeamRoleAssignment,
    Room,
    FixedObstruction,
    UserRolePreference,
    Shift,
)
from .utils import time_to_minutes


@login_required
@never_cache
def availability_view(request, team_id):
    """
    Worker page for submitting busy blocks, preferred times, and role preferences.
    """
    team = get_object_or_404(Team, id=team_id)
    if request.user not in team.members.all() and request.user != team.owner:
        return HttpResponseForbidden("You are not a member of this team.")

    availabilities = AvailabilityRange.objects.filter(user=request.user, team=team)
    preferred_times = PreferredTime.objects.filter(user=request.user, team=team)
    role_prefs = (
        UserRolePreference.objects.filter(user=request.user, team=team)
        .select_related("role", "section")
        .order_by("rank")
    )

    busy_list = [
        {
            "day": a.day,
            "start": a.start_time.strftime("%H:%M"),
            "end": a.end_time.strftime("%H:%M"),
            "building": a.building,
            "name": a.eventName,
            "mode": "busy",
        }
        for a in availabilities
    ]

    preferred_list = [
        {
            "day": p.day,
            "start": p.start_time.strftime("%H:%M"),
            "end": p.end_time.strftime("%H:%M"),
            "mode": "preferred",
        }
        for p in preferred_times
    ]

    role_pref_list = [
        {
            "rank": rp.rank,
            "role_id": rp.role.id,
            "role_name": rp.role.name,
            "section_id": rp.section.id if rp.section else None,
            "section_name": rp.section.name if rp.section else None,
        }
        for rp in role_prefs
    ]

    all_roles = Role.objects.filter(team=team).prefetch_related("sections")

    return render(
        request,
        "core/availability2.html",
        {
            "team": team,
            "roles": all_roles,
            "existing_availabilities_json": json.dumps(busy_list),
            "existing_preferred_json": json.dumps(preferred_list),
            "existing_role_preferences_json": json.dumps(role_pref_list),
        },
    )


@login_required
def supervisor_view(request, team_id):
    """
    Supervisor setup page: assign roles, configure rooms, set obstructions.
    """
    team = get_object_or_404(Team, id=team_id)
    if team.owner != request.user:
        return HttpResponseForbidden("Supervisors only.")

    members = team.members.all().prefetch_related(
        Prefetch(
            "team_role_assignments",
            queryset=TeamRoleAssignment.objects.filter(team=team),
            to_attr="current_team_assignment",
        ),
        Prefetch(
            "availabilityrange_set",
            queryset=AvailabilityRange.objects.filter(team=team),
            to_attr="team_availabilities",
        ),
    )

    roles = Role.objects.filter(team=team).prefetch_related("sections")
    rooms = Room.objects.filter(team=team)
    obstructions = FixedObstruction.objects.filter(team=team)

    member_list = []
    for member in members:
        assignment = (
            member.current_team_assignment[0]
            if member.current_team_assignment
            else None
        )
        has_availability = len(member.team_availabilities) > 0
        status = "Submitted" if has_availability else "Pending"

        member_list.append(
            {
                "user": member,
                "status": status,
                "current_role_id": assignment.role_id if assignment else None,
                "current_section_id": assignment.section_id if assignment else None,
            }
        )

    return render(
        request,
        "core/supervisor.html",
        {
            "team": team,
            "member_list": member_list,
            "roles": roles,
            "rooms": rooms,
            "obstructions": obstructions,
        },
    )


@login_required
@never_cache
def scheduler_view(request, team_id):
    """
    Supervisor scheduling page for building and saving the weekly schedule.
    """

    team = get_object_or_404(Team, id=team_id)

    if team.owner != request.user:
        return HttpResponseForbidden("You are not the supervisor of this team.")

    workers = team.members.all().prefetch_related(
        Prefetch(
            "availabilityrange_set",
            queryset=AvailabilityRange.objects.filter(team=team),
            to_attr="team_availability",
        ),
        Prefetch(
            "preferred_times",
            queryset=PreferredTime.objects.filter(team=team),
            to_attr="preferred",
        ),
        Prefetch(
            "role_preferences",
            queryset=UserRolePreference.objects.filter(team=team)
            .select_related("role", "section")
            .order_by("rank"),
            to_attr="pref_roles",
        ),
        Prefetch(
            "shifts",
            queryset=Shift.objects.filter(schedule__team=team).select_related(
                "room", "role"
            ),
            to_attr="team_shifts",
        ),
    )

    assignments = TeamRoleAssignment.objects.filter(team=team).select_related(
        "role", "section"
    )
    role_map = {ra.user_id: ra.role_id for ra in assignments}
    section_map = {
        str(a.user_id): a.section.name if a.section else None for a in assignments
    }

    workers_json = json.dumps(
        [
            {
                "id": str(w.id),
                "name": w.get_full_name() or w.username,
                "role_id": role_map.get(w.id),
                "section": section_map.get(str(w.id)),
                "availabilityData": [
                    {
                        "day": a.day,
                        "start_min": time_to_minutes(a.start_time),
                        "end_min": time_to_minutes(a.end_time),
                        "eventName": getattr(a, "eventName", ""),
                        "building": getattr(a, "building", ""),
                    }
                    for a in w.team_availability
                ],
                "preferredData": [
                    {
                        "day": p.day,
                        "start_min": time_to_minutes(p.start_time),
                        "end_min": time_to_minutes(p.end_time),
                    }
                    for p in w.preferred
                ],
                "roleData": [{"id": role_map.get(w.id)}] if role_map.get(w.id) else [],
                "rolePreferences": [
                    {
                        "rank": rp.rank,
                        "role_id": rp.role.id,
                        "role_name": rp.role.name,
                        "section_id": rp.section.id if rp.section else None,
                        "section_name": rp.section.name if rp.section else None,
                    }
                    for rp in w.pref_roles
                ],
                "shifts": [
                    {
                        "id": s.id,
                        "day": s.day,
                        "start_min": time_to_minutes(s.start_time),
                        "end_min": time_to_minutes(s.end_time),
                        "role_id": s.role_id,
                        "role_name": s.role.name if s.role else None,
                        "room_id": str(s.room_id) if s.room_id else None,
                        "room_name": s.room.name if s.room else None,
                    }
                    for s in w.team_shifts
                ],
            }
            for w in workers
        ]
    )

    roles = Role.objects.filter(team=team).prefetch_related("sections")
    roles_json = json.dumps(
        [
            {
                "id": r.id,
                "name": r.name,
                "sections": [{"id": s.id, "name": s.name} for s in r.sections.all()],
            }
            for r in roles
        ]
    )

    rooms = Room.objects.filter(team=team)
    rooms_json = json.dumps(
        [{"id": str(r.id), "name": r.name, "capacity": r.capacity} for r in rooms]
    )

    obstructions = FixedObstruction.objects.filter(team=team).prefetch_related("days")
    obstructions_json = json.dumps(
        [
            {
                "id": o.id,
                "name": o.name,
                "role_id": o.role_id,
                "section": o.section,
                "location": o.location,
                "start_min": time_to_minutes(o.start_time),
                "end_min": time_to_minutes(o.end_time),
                "days": [d.day for d in o.days.all()],
            }
            for o in obstructions
        ]
    )

    templates = ScheduleTemplate.objects.filter(team=team)
    templates_dict = {
        str(t.id): {
            "name": t.name,
            "duration": t.duration,
            "interval": t.interval,
            "weeklyQuota": t.weekly_quota,
            "dailyMax": t.daily_max,
            "maxConcurrent": t.max_concurrent,
        }
        for t in templates
    }

    return render(
        request,
        "core/scheduler.html",
        {
            "team": team,
            "workers": workers,
            "workers_json": workers_json,
            "roles": roles_json,
            "rooms": rooms_json,
            "obstructions": obstructions_json,
            "templates_json": json.dumps(templates_dict),
        },
    )
