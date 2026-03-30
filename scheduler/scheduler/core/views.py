'''
views.py
'''

import json
from datetime import time
from django.db import models
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseForbidden
from django.db import transaction
from django.db.models import Prefetch, Q
from django.shortcuts import render, get_object_or_404, redirect
from django.views.decorators.http import require_http_methods, require_POST
from django.views.decorators.csrf import csrf_exempt, csrf_protect
from django.views.decorators.cache import never_cache
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from .models import (
    AvailabilityRange,
    Role,
    Shift,
    Schedule,
    Team,
    TeamRoleAssignment,
    TeamEvent,
    UserRolePreference,
    Room,
    RoomAvailability,
    FixedObstruction,
    ObstructionDay,
    RoleSection
)
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.forms import UserCreationForm
from django.contrib import messages

from .auto_scheduler import generate_role_schedule # Import our new engine
import json

@require_POST
@login_required
def auto_schedule_role(request, team_id):
    team = get_object_or_404(Team, id=team_id)
    data = json.loads(request.body)
    role_id = data.get("role_id")
    
    if not role_id:
        return JsonResponse({"error": "role_id is required"}, status=400)
        
    role = get_object_or_404(Role, id=role_id, team=team)
    
    # Run the OR-Tools engine!
    # (Wrapping in try/except is good practice in case the math solver hits an edge case)
    try:
        generated_shifts = generate_role_schedule(team, role)
        return JsonResponse({"shifts": generated_shifts}, status=200)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

DAY_MAP = {0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat"}

def time_to_minutes(t):
    if t is None:
        return None
    return (t.hour * 60) + t.minute

def minutes_to_time(minutes):
    if minutes is None:
        return None
    return time(int(minutes) // 60, int(minutes) % 60)

def minutes_to_string(minutes):
    if minutes is None:
        return ""
    t = minutes_to_time(minutes)
    return f"{t.hour:02d}:{t.minute:02d}"

# =============================================================================
# AUTHENTICATION
# =============================================================================

def signup(request):
    '''
    Handles new registration of users
    '''
    
    # log out user if trying to sign up
    if request.user.is_authenticated:
        logout(request)

    # get all user sign up info
    if request.method == "POST":
        first_name = request.POST.get("first_name")
        last_name = request.POST.get("last_name")
        username = request.POST["username"]
        email = request.POST["email"]
        pass1 = request.POST["password"]
        pass2 = request.POST["confirm_password"]

        # verify passwords
        if pass1 != pass2:
            messages.error(request, "Passwords do not match!")
            return render(request, "core/auth2.html")

        # unique usernames
        if User.objects.filter(username=username).exists():
            messages.error(request, "Username already taken!")
            return render(request, "core/auth2.html")

        # create the user object and save it
        user = User.objects.create_user(
            username=username,
            email=email,
            password=pass1,
            first_name=first_name,
            last_name=last_name,
        )
        user.save()

        # direct user to the dashboard
        login(request, user)
        return redirect("dashboard2")

    # render the auth page again
    return render(request, "core/auth2.html")


def auth_ping(request):
    return JsonResponse({"authenticated": request.user.is_authenticated})


# =============================================================================
# DASHBOARD & TEAM MANAGEMENT
# =============================================================================

@never_cache
@login_required
def dashboard(request):
    '''
    All users have a dashboard page that shows them the teams there in,
    allows team creation, and team joining. Send user to the dashboard
    with any teams they may be a part of.
    '''

    # get all associated teams and render the page
    owned_teams = request.user.owned_teams.all()
    joined_teams = request.user.joined_teams.all()
    return render(
        request,
        "core/dashboard2.html",
        {"owned_teams": owned_teams, "joined_teams": joined_teams},
    )


@login_required
@require_http_methods(["POST"])
def create_team(request):
    '''
    Create a team owned by the user
    '''
    # get the name of the team and then create the object
    name = request.POST.get("team_name")
    if name:
        Team.objects.create(name=name, owner=request.user)
    return redirect("dashboard2")


@login_required
@require_http_methods(["POST"])
def join_team(request):
    '''
    Join a created team using the correct join code
    '''
    # check for a join code
    code = request.POST.get("join_code")
    try:
        # find the team with the associated join code if it exists and add them
        # if it does.
        team = Team.objects.get(join_code=code)
        if team.owner == request.user:
            pass
        else:
            team.members.add(request.user)
    except Team.DoesNotExist:
        pass
    return redirect("dashboard2")


# =============================================================================
# PAGES
# =============================================================================

@login_required
@never_cache
def availability_view(request, team_id):
    '''
    The page a user will create their current schedule that supervisors will
    use to when building the work schedule.
    '''
    
    # find the team object and make sure current user should be here
    team = get_object_or_404(Team, id=team_id)
    if request.user not in team.members.all() and request.user != team.owner:
        return HttpResponseForbidden("You are not a member of this team.")
    
    # find any events for a worker that they may have already saved
    availabilities = AvailabilityRange.objects.filter(user=request.user, team=team)

    # FIX: UNUSED FOR NOW
    role_prefs = UserRolePreference.objects.filter(user=request.user, team=team).first()
    selected_role_ids = (
        list(role_prefs.roles.values_list("id", flat=True)) if role_prefs else []
    )

    # FIX MAY WANT TO CHANGE COLOR
    # create a list for each time object in the database for this user
    avail_list = json.dumps([
        {
            "day": a.day,
            "start": a.start_time.strftime("%H:%M"),
            "end": a.end_time.strftime("%H:%M"),
            "building": a.building,
            "name": a.eventName,
            "color": "#4a90e2",
        }
        for a in availabilities
    ])

    # FIX UNUSED YET
    all_roles = Role.objects.filter(team=team)

    context = {
        "team": team,
        "roles": all_roles,
        "selected_role_ids": selected_role_ids,
        "existing_availabilities_json": avail_list,
    }
    return render(request, "core/availability2.html", context)


@login_required
def supervisor_view(request, team_id):
    '''
    A supervisor will have their own page that lets them
    assign roles, provide room availability, and other information
    prior to building a schedule.
    '''
    team = get_object_or_404(Team, id=team_id)
    if team.owner != request.user:
        return HttpResponseForbidden("Supervisors only.")
    
    # queries all members pluss their assignments and schedules
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

    # query all rooms, roles, and fixed events for the team
    roles = Role.objects.filter(team=team)
    rooms = Room.objects.filter(team=team)
    obstructions = FixedObstruction.objects.filter(team=team)

    # each member of the team has associated information to store with them
    member_list = []
    for member in members:
        assignment = (
            member.current_team_assignment[0]
            if member.current_team_assignment
            else None
        )

        has_availability = len(member.team_availabilities) > 0

        # FIX: ADD TO PREFETCH
        role_prefs = UserRolePreference.objects.filter(user=member, team=team).first()
        preferred_roles = list(role_prefs.roles.all()) if role_prefs else []

        status = "Submitted" if (has_availability or preferred_roles) else "Pending"

        member_list.append({
            "user": member,
            "status": status,
            "preferred_roles": preferred_roles,
            "current_role_id": assignment.role_id if assignment else None,
            "current_section_id": assignment.section_id if assignment else None,
        })

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
    '''
    Supervisor page that allows supervisors to actually make
    the schedule for their team
    '''
    team = get_object_or_404(Team, id=team_id)

    if team.owner != request.user:
        return HttpResponseForbidden("You are not the supervisor of this team.")

    workers = team.members.all().prefetch_related(
        Prefetch(
            "availabilityrange_set",
            queryset=AvailabilityRange.objects.filter(team=team),
            to_attr="team_availability",
        )
    )

    assignments = TeamRoleAssignment.objects.filter(team=team).select_related("role", "section")
    role_map = {ra.user_id: ra.role_id for ra in assignments}
    section_map = {str(a.user_id): a.section.name if a.section else None for a in assignments}

    workers_json = json.dumps([
        {
            "id": str(w.id),
            "name": w.get_full_name() or w.username,
            "role_id": role_map.get(w.id),
            "section": section_map.get(str(w.id)),
        }
        for w in workers
    ])

    roles = Role.objects.filter(team=team).prefetch_related('sections')
    roles_with_sections = []
    for r in roles:
        roles_with_sections.append({
            "id": r.id,
            "name": r.name,
            "sections": [{"id": s.id, "name": s.name} for s in r.sections.all()]
        })
    roles_json = json.dumps(roles_with_sections)

    rooms = Room.objects.filter(team=team)
    rooms_json = json.dumps(
        [{"id": str(r.id), "name": r.name, "capacity": r.capacity} for r in rooms]
    )

    obstructions = FixedObstruction.objects.filter(team=team).prefetch_related("days")
    obstructions_json = json.dumps([
        {
            "id": o.id,
            "name": o.name,
            "role_id": o.role_id,
            "section": o.section,
            "start_min": time_to_minutes(o.start_time),
            "end_min": time_to_minutes(o.end_time),
            "days": [d.day for d in o.days.all()],
        }
        for o in obstructions
    ])

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
        },
    )


# =============================================================================
# API: AVAILABILITY
# =============================================================================

@login_required
@require_http_methods(["POST"])
def save_availability(request, team_id):
    '''
    Save the events a team member creates for their personal schedule
    '''
    try:
        data = json.loads(request.body)
        team = get_object_or_404(Team, id=team_id)
        if request.user not in team.members.all() and request.user != team.owner:
            return HttpResponseForbidden("You are not a member of this team.")

        events_data = data.get("events", [])
        role_ids = data.get("role_ids", [])

        with transaction.atomic():
            AvailabilityRange.objects.filter(user=request.user, team=team).delete()

            for item in events_data:
                start_val = minutes_to_string(item.get("start_min"))
                end_val = minutes_to_string(item.get("end_min"))

                day_int = item.get("day")
                day_str = DAY_MAP.get(day_int, "mon")

                AvailabilityRange.objects.create(
                    user=request.user,
                    team=team,
                    day=day_str,
                    start_time=start_val,
                    end_time=end_val,
                    building=item.get("location", ""),
                    eventName=item.get("name", ""),
                )

            if role_ids:
                role_prefs, _ = UserRolePreference.objects.get_or_create(
                    user=request.user, team=team
                )
                role_prefs.roles.set(
                    Role.objects.filter(id__in=role_ids, team=team)
                )

        return JsonResponse({"status": "success", "count": len(events_data)})

    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

@login_required
def get_worker_availability(request, team_id, worker_id):
    '''
    Supervisor fetches a workers availability
    '''
    team = get_object_or_404(Team, id=team_id)
    if team.owner != request.user and request.user.id != int(worker_id):
        return HttpResponseForbidden("Unauthorized")

    target_user = get_object_or_404(User, id=worker_id)
    ranges = AvailabilityRange.objects.filter(user=target_user, team=team)

    availability_list = []
    for r in ranges:
        start_min = time_to_minutes(r.start_time)
        end_min = time_to_minutes(r.end_time)

        availability_list.append(
            {
                "day": r.day.lower(),
                "start_min": start_min,
                "end_min": end_min,
                "label": f"{r.start_time.strftime('%H:%M')} - {r.end_time.strftime('%H:%M')}",
            }
        )

    return JsonResponse({"availabilityData": availability_list})


# =============================================================================
# API: SCHEDULES & SHIFTS
# =============================================================================

@login_required
def get_schedules(request, team_id):
    '''
    Get all saved schedules for a team
    '''
    team = get_object_or_404(Team, id=team_id)
    
    # fetch the relevant fields
    schedules = Schedule.objects.filter(team=team).values("id", "name", "is_active")
    return JsonResponse({"schedules": list(schedules)})


@login_required
@csrf_exempt
@require_http_methods(["POST"])
def create_schedule(request, team_id):
    '''
    Create a new schedule to use
    '''
    team = get_object_or_404(Team, id=team_id)
    data = json.loads(request.body)
    name = data.get("name", "Default")

    schedule, created = Schedule.objects.get_or_create(team=team, name=name)
    
    # make sure it is unique
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
    Save all of created shift events for a schedule to the database
    '''
    team = get_object_or_404(Team, id=team_id)
    data = json.loads(request.body)

    schedule_id = data.get("schedule_id")
    role_id = data.get("role_id")
    shifts = data.get("shifts", [])

    schedule = get_object_or_404(Schedule, id=schedule_id, team=team)
    role = get_object_or_404(Role, id=role_id, team=team) if role_id else None

    # delete any shifts that existed prior
    Shift.objects.filter(schedule=schedule, role=role).delete()
    
    # get all ids first (fewer queries)
    user_ids = [s["user_id"] for s in shifts]
    room_ids = [s["room_id"] for s in shifts if s.get("room_id")]
    users = {u.id: u for u in User.objects.filter(id__in=user_ids)}
    rooms = {str(r.id): r for r in Room.objects.filter(id__in=room_ids)}

    conflicts = []
    created_shifts = []

    for s in shifts:
        start_time = minutes_to_time(s["start_min"])
        end_time = minutes_to_time(s["end_min"])
        day = s["day"]
        user = users[int(s["user_id"])]                
        room = rooms.get(str(s["room_id"])) if s.get("room_id") else None
        
        # make sure room has availability
        if room:
            overlapping_count = Shift.objects.filter(
                schedule=schedule,
                room=room,
                day=day,
                start_time__lt=end_time,
                end_time__gt=start_time,
            ).count()

            if overlapping_count >= room.capacity:
                conflicts.append(
                    {
                        "type": "room_capacity",
                        "message": f"{room.name} is at full capacity ({room.capacity}) on {day} from {start_time} to {end_time}",
                    }
                )

        # make sure worker isn't already scheduled
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
            conflicts.append(
                {
                    "type": "worker",
                    "message": f"{user.get_full_name() or user.username} is already scheduled on {day} from {worker_conflict.start_time} to {worker_conflict.end_time}",
                }
            )

        # create the shift
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

    return JsonResponse(
        {
            "status": "ok",
            "saved": len(created_shifts),
            "conflicts": conflicts,
        }
    )


@login_required
@csrf_exempt
@require_http_methods(["POST"])
def set_active_schedule(request, team_id):
    '''
    Swap which schedule we should be looking at
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
    Get the shifts associated with a specific schedule
    '''
    team = get_object_or_404(Team, id=team_id)
    schedule = get_object_or_404(Schedule, id=schedule_id, team=team)
    role_id = request.GET.get("role_id")

    shifts = Shift.objects.filter(schedule=schedule).select_related(
        "user", "role", "room"
    )

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


# =============================================================================
# API: ROOMS
# =============================================================================

@login_required
@require_http_methods(["POST"])
def create_room(request, team_id):
    '''
    Create a new room that a team has access to
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
            team=team, name=data.get("name"), capacity=data.get("capacity", 1)
        )
        return JsonResponse({"ok": True, "room_id": room.id})
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def save_room_availability(request, team_id):
    '''
    Save the the time a team has access to a room
    '''
    try:
        data = json.loads(request.body)
        team = get_object_or_404(Team, id=team_id)
        if team.owner != request.user:
            return HttpResponseForbidden("Unauthorized")
        room_to_save = data.get("times", [])
        theRoom = Room.objects.get(id=data.get("room_id"))

        with transaction.atomic():
            RoomAvailability.objects.filter(room_id=data.get("room_id")).delete()

            for item in room_to_save:
                start_val = minutes_to_string(item.get("start_min"))
                end_val = minutes_to_string(item.get("end_min"))
                day_int = item.get("day")
                day_str = DAY_MAP.get(day_int, "mon")

                RoomAvailability.objects.create(
                    day=day_str,
                    start_time=start_val,
                    end_time=end_val,
                    room=theRoom,
                )
        return JsonResponse({"status": "success", "count": len(room_to_save)})

    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)



@login_required
def retrieve_room_availability(request, room_id):
    '''
    For created rooms, show what was already saved
    '''
    room = get_object_or_404(Room, id=room_id)
    if room.team.owner != request.user:
        return HttpResponseForbidden("Unauthorized")
    openTimes = RoomAvailability.objects.filter(room_id=room_id)
    slots = [
        {
            "day": o.day,
            "start": o.start_time.strftime("%H:%M"),
            "end": o.end_time.strftime("%H:%M"),
        }
        for o in openTimes
    ]
    return JsonResponse({"savedTimes": slots})


@login_required
@require_http_methods(["DELETE"])
def delete_room(request, team_id):
    '''
    Delete a room a team doesn't need anymore
    '''
    try:
        data = json.loads(request.body)
        room_id = data.get("room_id")

        if not room_id:
            return JsonResponse(
                {"status": "error", "message": "No room_id provided"}, status=400
            )

        with transaction.atomic():
            deleted_count, _ = Room.objects.filter(id=room_id, team_id=team_id).delete()

            if deleted_count == 0:
                return JsonResponse(
                    {"status": "error", "message": "Room not found or already deleted"},
                    status=404,
                )

        return JsonResponse({"status": "success"})

    except json.JSONDecodeError:
        return JsonResponse({"status": "error", "message": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse(
            {"status": "error", "message": "Internal server error"}, status=500
        )

@login_required
def get_room_bookings(request, team_id, schedule_id):
    '''
    Get the room booking to see what is available when scheduling
    '''
    team = get_object_or_404(Team, id=team_id)
    schedule = get_object_or_404(Schedule, id=schedule_id, team=team)
    day = request.GET.get("day")

    shifts = Shift.objects.filter(schedule=schedule, room__isnull=False).select_related(
        "room", "user"
    )

    if day:
        shifts = shifts.filter(day=day)

    bookings = {}
    for s in shifts:
        room_id = str(s.room.id)
        if room_id not in bookings:
            bookings[room_id] = {"capacity": s.room.capacity, "shifts": []}
        bookings[room_id]["shifts"].append(
            {
                "user_name": s.user.get_full_name() or s.user.username,
                "start_min": time_to_minutes(s.start_time),
                "end_min": time_to_minutes(s.end_time),
                "day": s.day,
            }
        )

    return JsonResponse({"bookings": bookings})

@login_required
def get_room_availability(request, team_id):
    '''
    Get the information of when each room is open.
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
        availability[room_id].append(
            {
                "start_min": time_to_minutes(slot.start_time),
                "end_min": time_to_minutes(slot.end_time)
            }
        )

    return JsonResponse({"availability": availability})


# =============================================================================
# API: ROLES
# =============================================================================

@login_required
@require_http_methods(["POST"])
def create_role(request, team_id):
    '''
    Create a role for a team
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
        return JsonResponse(
            {"ok": True, "role_id": role.id, "created": False, "name": role.name}
        )
    except Role.DoesNotExist:
        role = Role.objects.create(team=team, name=name)
        return JsonResponse(
            {"ok": True, "role_id": role.id, "created": True, "name": role.name}
        )
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=500)


@login_required
def list_roles(request, team_id):
    '''
    Return all roles a team has
    '''
    team = get_object_or_404(Team, id=team_id)

    if request.user != team.owner and request.user not in team.members.all():
        return HttpResponseForbidden("Not allowed")

    roles = Role.objects.filter(team=team).order_by("name")
    return JsonResponse({"roles": [{"id": r.id, "name": r.name} for r in roles]})


@login_required
def get_team_roles(request, team_id):
    '''
    FIX? may need to delete
    '''
    team = get_object_or_404(Team, id=team_id)
    roles = Role.objects.filter(team=team).values()
    return JsonResponse({"roles": list(roles)})


@login_required
@require_http_methods(["DELETE"])
def delete_role(request, team_id, role_id):
    '''
    Remove a role that is no longer necessary
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
    Return the workers and their schedules based on a certain role
    '''
    assignments = TeamRoleAssignment.objects.filter(
        team_id=team_id, role_id=role_id
    ).select_related('section')

    user_ids = [a.user_id for a in assignments]
    section_map = {a.user_id: a.section.name if a.section else None for a in assignments}

    relevant_users = User.objects.filter(id__in=user_ids).prefetch_related(
        models.Prefetch(
            "availabilityrange_set",
            queryset=AvailabilityRange.objects.filter(team_id=team_id),
            to_attr="team_avail",
        )
    )

    workers_data = []

    for user in relevant_users:
        prefetched_ranges = user.team_avail

        avail_list = []
        for r in prefetched_ranges:
            avail_list.append(
                {
                    "day": r.day.lower(),
                    "start_min": time_to_minutes(r.start_time),
                    "end_min": time_to_minutes(r.end_time),
                    "label": f"{r.start_time.strftime('%H:%M')} - {r.end_time.strftime('%H:%M')}",
                }
            )

        workers_data.append(
            {
                "id": str(user.id),
                "name": user.get_full_name() or user.username,
                "availability": avail_list,
                "section": section_map.get(user.id),
            }
        )

    return JsonResponse({"workers": workers_data})


@login_required
@require_http_methods(["POST"])
def assign_role(request, team_id):
    '''
    Creates an assignment for a worker to some role (may include a section)
    '''
    team = get_object_or_404(Team, id=team_id)
    data = json.loads(request.body)
    user_id = data.get('worker_id') or data.get('user_id')
    role_id = data.get('role_id')
    section = data.get('section', None)

    user = get_object_or_404(User, id=user_id)
    assignment, _ = TeamRoleAssignment.objects.update_or_create(
        team=team,
        user=user,
        defaults={
            'role_id': role_id if role_id else None,
            'section': section or None
        }
    )
    return JsonResponse({'status': 'ok'})


@login_required
@require_http_methods(["POST"])
def unassign_role(request, team_id):
    '''
    Deletes the assignment
    '''
    team = get_object_or_404(Team, id=team_id)
    if team.owner != request.user:
        return HttpResponseForbidden("Only supervisors can unassign roles.")

    try:
        data = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return HttpResponseBadRequest("Invalid JSON")

    worker_id = data.get("worker_id")
    role_id = data.get("role_id")
    if not worker_id or not role_id:
        return HttpResponseBadRequest("worker_id and role_id required")

    TeamRoleAssignment.objects.filter(
        team=team, user_id=worker_id, role_id=role_id
    ).delete()
    return JsonResponse({"ok": True})


@login_required
@require_http_methods(["POST"])
def update_member_role(request, team_id):
    '''
    Deletes previous assignment and updates it to the new one for the worker
    '''
    try:
        data = json.loads(request.body)
        worker_id = data.get("member_id")
        role_id = data.get("role_id")

        team = get_object_or_404(Team, id=team_id)

        if team.owner != request.user:
            return HttpResponseForbidden("Unauthorized")

        if not role_id:
            TeamRoleAssignment.objects.filter(team=team, user_id=worker_id).delete()
            return JsonResponse({"status": "success", "message": "Role cleared"})

        role = get_object_or_404(Role, id=role_id, team=team)
        assignment, created = TeamRoleAssignment.objects.update_or_create(
            team=team, user_id=worker_id, defaults={"role": role}
        )

        return JsonResponse(
            {"status": "success", "role_name": role.name, "created": created}
        )

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@login_required
def worker_roles(request, team_id, worker_id):
    '''
    Returns all roles applicable to a team
    '''
    team = get_object_or_404(Team, id=team_id)

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

    return JsonResponse(
        {"roles": [{"id": a.role.id, "name": a.role.name} for a in assigned]}
    )


def get_role_sections(request, team_id, role_id):
    '''
    Gets all sections for a given role FIX: probably combine with above?
    '''
    role = get_object_or_404(Role, id=role_id, team_id=team_id)
    sections = list(role.sections.values('id', 'name'))
    return JsonResponse({'sections': sections})


def create_role_section(request, team_id, role_id):
    '''
    Create sections for roles
    '''
    role = get_object_or_404(Role, id=role_id, team_id=team_id)
    data = json.loads(request.body)
    name = data.get('name', '').strip()
    if not name:
        return JsonResponse({'error': 'Section name required'}, status=400)
    section, created = RoleSection.objects.get_or_create(role=role, name=name)
    return JsonResponse({'id': section.id, 'name': section.name})


def delete_role_section(request, team_id, role_id, section_id):
    '''
    Remove a section
    '''
    section = get_object_or_404(RoleSection, id=section_id, role_id=role_id)
    section.delete()
    return JsonResponse({'status': 'ok'})


def save_member_assignments(request, team_id):
    '''
    Save all members role assignments
    '''
    team = get_object_or_404(Team, id=team_id)
    data = json.loads(request.body)
    assignments = data.get('assignments', [])

    for a in assignments:
        user_id = a.get('user_id')
        role_id = a.get('role_id') or None
        section_id = a.get('section_id') or None

        user = get_object_or_404(User, id=user_id)
        TeamRoleAssignment.objects.update_or_create(
            team=team,
            user=user,
            defaults={
                'role_id': role_id,
                'section_id': section_id
            }
        )

    return JsonResponse({'status': 'ok', 'saved': len(assignments)})


# =============================================================================
# API: EVENTS & OBSTRUCTIONS
# =============================================================================

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
        return JsonResponse(
            {
                "ok": True,
                "event": {"id": event.id, "name": event.name, "day": event.day},
            }
        )
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=400)


@csrf_exempt
@require_http_methods(["POST"])
def create_obstruction(request, team_id):
    '''
    FIX: necessary?
    '''
    if request.method == "POST":
        data = json.loads(request.body)

        team = get_object_or_404(Team, id=team_id)
        role = (
            get_object_or_404(Role, id=data["role_id"]) if data.get("role_id") else None
        )

        start_min = data["start_min"]
        end_min = data["end_min"]
        start_time = time(start_min // 60, start_min % 60)
        end_time = time(end_min // 60, end_min % 60)
        section_id = data.get('section', None)
        section_obj = get_object_or_404(RoleSection, id=section_id) if section_id else None
        section_name = section_obj.name if section_obj else None

        obstruction = FixedObstruction.objects.create(
            team=team,
            role=role,
            name=data["name"],
            start_time=start_time,
            end_time=end_time,
            section=section_name,
        )

        day_names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
        for day_index in data["days"]:
            ObstructionDay.objects.create(
                obstruction=obstruction, day=day_names[day_index]
            )

        return JsonResponse({"status": "ok", "obstruction_id": obstruction.id})


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_obstruction(request, team_id, obstruction_id):
    '''
    Removed the fixed event
    '''
    obstruction = get_object_or_404(FixedObstruction, team=team_id, id=obstruction_id)
    obstruction.delete()
    return JsonResponse({"status": "ok"})