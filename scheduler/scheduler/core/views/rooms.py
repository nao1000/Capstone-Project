'''
views/rooms.py
API endpoints for room management: create, delete, save/retrieve availability,
and query room booking status during scheduling.
'''

import json

from django.shortcuts import get_object_or_404
from django.http import JsonResponse, HttpResponseForbidden
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from django.db import transaction

from ..models import Room, RoomAvailability, Team
from .utils import DAY_MAP, minutes_to_string, time_to_minutes


@login_required
@require_http_methods(["POST"])
def create_room(request, team_id):
    '''
    Create a new room for the team.
    '''
    team = get_object_or_404(Team, id=team_id)
    if team.owner != request.user:
        return HttpResponseForbidden("Unauthorized")

    try:
        data = json.loads(request.body)
        name = data.get("name", "").strip()
        if not name:
            return JsonResponse({"ok": False, "error": "Room name required"}, status=400)

        room = Room.objects.create(
            team=team, name=name, capacity=data.get("capacity", 1)
        )
        return JsonResponse({"ok": True, "room_id": room.id})
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def save_room_availability(request, team_id):
    '''
    Replace the availability slots for a given room.
    '''
    try:
        data = json.loads(request.body)
        team = get_object_or_404(Team, id=team_id)
        if team.owner != request.user:
            return HttpResponseForbidden("Unauthorized")

        room_to_save = data.get("times", [])
        the_room = Room.objects.get(id=data.get("room_id"))

        with transaction.atomic():
            RoomAvailability.objects.filter(room_id=data.get("room_id")).delete()

            for item in room_to_save:
                start_val = minutes_to_string(item.get("start_min"))
                end_val   = minutes_to_string(item.get("end_min"))
                day_int   = item.get("day")
                day_str   = DAY_MAP.get(day_int, "mon")

                RoomAvailability.objects.create(
                    day=day_str,
                    start_time=start_val,
                    end_time=end_val,
                    room=the_room,
                )

        return JsonResponse({"status": "success", "count": len(room_to_save)})

    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)


@login_required
def retrieve_room_availability(request, room_id):
    '''
    Return all saved availability slots for a room.
    '''
    room = get_object_or_404(Room, id=room_id)
    if room.team.owner != request.user:
        return HttpResponseForbidden("Unauthorized")

    open_times = RoomAvailability.objects.filter(room_id=room_id)
    slots = [
        {
            "day": o.day,
            "start": o.start_time.strftime("%H:%M"),
            "end": o.end_time.strftime("%H:%M"),
        }
        for o in open_times
    ]
    return JsonResponse({"savedTimes": slots})


@login_required
@require_http_methods(["DELETE"])
def delete_room(request, team_id):
    '''
    Delete a room and all its availability slots.
    '''
    try:
        data = json.loads(request.body)
        room_id = data.get("room_id")

        if not room_id:
            return JsonResponse({"status": "error", "message": "No room_id provided"}, status=400)

        with transaction.atomic():
            deleted_count, _ = Room.objects.filter(id=room_id, team_id=team_id).delete()

            if deleted_count == 0:
                return JsonResponse(
                    {"status": "error", "message": "Room not found or already deleted"}, status=404
                )

        return JsonResponse({"status": "success"})

    except json.JSONDecodeError:
        return JsonResponse({"status": "error", "message": "Invalid JSON"}, status=400)
    except Exception:
        return JsonResponse({"status": "error", "message": "Internal server error"}, status=500)


@login_required
def get_room_availability(request, team_id):
    '''
    Return all room availability slots for the team, optionally filtered by day.
    '''
    team = get_object_or_404(Team, id=team_id)
    day = request.GET.get("day")

    slots = RoomAvailability.objects.filter(room__team=team)
    if day:
        slots = slots.filter(day=day)

    availability = {}
    for slot in slots:
        room_id = str(slot.room.id)
        if room_id not in availability:
            availability[room_id] = []
        availability[room_id].append({
            "start_min": time_to_minutes(slot.start_time),
            "end_min": time_to_minutes(slot.end_time),
        })

    return JsonResponse({"availability": availability})