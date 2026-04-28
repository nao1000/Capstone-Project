'''
views/schedules.py
API endpoints for schedules and shifts: create, fetch, save shifts,
set active, get room bookings, and export to Excel.
'''

import json
import io

from datetime import time
from django.shortcuts import get_object_or_404
from django.http import HttpResponseForbidden, JsonResponse, HttpResponse
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt

import pandas as pd

from ..models import Room, Role, Schedule, Shift, Team, RoomAvailability
from .utils import time_to_minutes, minutes_to_time


@login_required
def get_schedules(request, team_id):
    '''
    Get all saved schedules for a team.
    '''
    team = get_object_or_404(Team, id=team_id)
    schedules = Schedule.objects.filter(team=team).values("id", "name", "is_active")
    return JsonResponse({"schedules": list(schedules)})


@login_required
@csrf_exempt
@require_http_methods(["POST"])
def create_schedule(request, team_id):
    '''
    Create a new named schedule for a team.
    '''
    team = get_object_or_404(Team, id=team_id)
    data = json.loads(request.body)
    name = data.get("name", "Default")

    schedule, created = Schedule.objects.get_or_create(team=team, name=name)

    if not created:
        return JsonResponse(
            {"error": "A schedule with that name already exists."}, status=400
        )

    return JsonResponse(
        {"id": schedule.id, "name": schedule.name, "is_active": schedule.is_active}
    )


@login_required
@csrf_exempt
@require_http_methods(["POST"])
def save_role_shifts(request, team_id):
    '''
    Replace all shifts for a given role within a schedule, checking for conflicts first.
    '''
    team = get_object_or_404(Team, id=team_id)
    data = json.loads(request.body)

    schedule_id = data.get("schedule_id")
    role_id     = data.get("role_id")
    shifts      = data.get("shifts", [])

    schedule = get_object_or_404(Schedule, id=schedule_id, team=team)
    role     = get_object_or_404(Role, id=role_id, team=team) if role_id else None

    Shift.objects.filter(schedule=schedule, role=role).delete()

    user_ids = [s["user_id"] for s in shifts]
    room_ids = [s["room_id"] for s in shifts if s.get("room_id")]
    users    = {u.id: u for u in User.objects.filter(id__in=user_ids)}
    rooms    = {str(r.id): r for r in Room.objects.filter(id__in=room_ids)}

    conflicts = []
    created_shifts = []

    for s in shifts:
        start_time = minutes_to_time(s["start_min"])
        end_time   = minutes_to_time(s["end_min"])
        day        = s["day"]
        user       = users[int(s["user_id"])]
        room       = rooms.get(str(s["room_id"])) if s.get("room_id") else None

        # Check room capacity
        if room:
            overlapping_count = Shift.objects.filter(
                schedule=schedule,
                room=room,
                day=day,
                start_time__lt=end_time,
                end_time__gt=start_time,
            ).count()

            if overlapping_count >= room.capacity:
                conflicts.append({
                    "type": "room_capacity",
                    "message": f"{room.name} is at full capacity ({room.capacity}) on {day} from {start_time} to {end_time}",
                })

        # Check worker double-booking
        worker_conflict = (
            Shift.objects.filter(
                schedule=schedule,
                user=user,
                day=day,
                start_time__lt=end_time,
                end_time__gt=start_time,
            )
            .exclude(role=role)
            .first()
        )

        if worker_conflict:
            conflicts.append({
                "type": "worker",
                "message": f"{user.get_full_name() or user.username} is already scheduled on {day} from {worker_conflict.start_time} to {worker_conflict.end_time}",
            })

        shift = Shift.objects.create(
            schedule=schedule,
            user=user,
            role=role,
            room=room,
            day=day,
            start_time=start_time,
            end_time=end_time,
        )
        created_shifts.append(shift.id)

    return JsonResponse({
        "status": "ok",
        "saved": len(created_shifts),
        "conflicts": conflicts,
    })


@login_required
@csrf_exempt
@require_http_methods(["POST"])
def set_active_schedule(request, team_id):
    '''
    Mark one schedule as active, deactivating all others for the team.
    '''
    team = get_object_or_404(Team, id=team_id)
    data = json.loads(request.body)
    schedule_id = data.get("schedule_id")

    Schedule.objects.filter(team=team).update(is_active=False)
    schedule = get_object_or_404(Schedule, id=schedule_id, team=team)
    schedule.is_active = True
    schedule.save()

    return JsonResponse({"status": "ok", "active_schedule": schedule.name})


def get_schedule_shifts(request, team_id, schedule_id):
    '''
    Return all shifts for a schedule, optionally filtered by role.
    '''
    team = get_object_or_404(Team, id=team_id)
    schedule = get_object_or_404(Schedule, id=schedule_id, team=team)
    role_id = request.GET.get("role_id")

    shifts = Shift.objects.filter(schedule=schedule).select_related("user", "role", "room")
    if role_id:
        shifts = shifts.filter(role_id=role_id)

    data = [
        {
            "id": s.id,
            "user_id": str(s.user.id),
            "user_name": s.user.get_full_name() or s.user.username,
            "role_id": s.role_id,
            "role_name": s.role.name if s.role else None,
            "room_id": str(s.room.id) if s.room else None,
            "room_name": s.room.name if s.room else None,
            "day": s.day,
            "start_min": s.start_time.hour * 60 + s.start_time.minute,
            "end_min": s.end_time.hour * 60 + s.end_time.minute,
        }
        for s in shifts
    ]

    return JsonResponse({"shifts": data})


@login_required
def get_room_bookings(request, team_id, schedule_id):
    '''
    Return room booking data for a schedule, optionally filtered by day.
    '''
    team = get_object_or_404(Team, id=team_id)
    schedule = get_object_or_404(Schedule, id=schedule_id, team=team)
    day = request.GET.get("day")

    shifts = Shift.objects.filter(
        schedule=schedule, room__isnull=False
    ).select_related("room", "user")

    if day:
        shifts = shifts.filter(day=day)

    bookings = {}
    for s in shifts:
        room_id = str(s.room.id)
        if room_id not in bookings:
            bookings[room_id] = {"capacity": s.room.capacity, "shifts": []}
        bookings[room_id]["shifts"].append({
            "user_name": s.user.get_full_name() or s.user.username,
            "start_min": time_to_minutes(s.start_time),
            "end_min": time_to_minutes(s.end_time),
            "day": s.day,
        })

    return JsonResponse({"bookings": bookings})


def export_schedule(request, team_id, schedule_id):
    '''
    Export a schedule as an Excel (.xlsx) file download.
    '''
    schedule = get_object_or_404(Schedule, team=team_id, id=schedule_id)
    shifts = Shift.objects.filter(schedule=schedule).select_related("user", "role", "room")

    data = [
        {
            "Worker": shift.user.get_full_name() or shift.user.username,
            "Role": shift.role.name if shift.role else "Unknown",
            "Room": shift.room.name if shift.room else "Unknown",
            "Day": shift.day.capitalize() if hasattr(shift, 'day') else "",
            "Start Time": shift.start_time.strftime("%H:%M"),
            "End Time": shift.end_time.strftime("%H:%M"),
        }
        for shift in shifts
    ]

    df = pd.DataFrame(data)
    buffer = io.BytesIO()

    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Schedule')

    buffer.seek(0)

    response = HttpResponse(
        buffer.getvalue(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    safe_name = schedule.name.replace(" ", "_") if hasattr(schedule, 'name') else "export"
    response['Content-Disposition'] = f'attachment; filename="{safe_name}_schedule.xlsx"'

    return response

@login_required
@require_http_methods(["POST"])
def delete_shifts(request, team_id, schedule_id):
    schedule = get_object_or_404(Schedule, id=schedule_id, team_id=team_id)
    schedule.shifts.all().delete()
    return JsonResponse({"status": "ok"})