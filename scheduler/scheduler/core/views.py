import json
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
    Team,
    TeamRoleAssignment,
    TeamEvent,
    UserRolePreference,
    Room,
    RoomAvailability,
)
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.forms import UserCreationForm
from django.contrib import messages


def signup(request):
    if request.user.is_authenticated:
        logout(request)

    if request.method == "POST":
        # 1. Grab the new fields from the POST data
        first_name = request.POST.get("first_name")
        last_name = request.POST.get("last_name")
        username = request.POST["username"]
        email = request.POST["email"]
        pass1 = request.POST["password"]
        pass2 = request.POST["confirm_password"]

        # Simple validation
        if pass1 != pass2:
            messages.error(request, "Passwords do not match!")
            return render(request, "core/auth2.html")

        if User.objects.filter(username=username).exists():
            messages.error(request, "Username already taken!")
            return render(request, "core/auth2.html")

        # 2. Pass first_name and last_name into create_user
        user = User.objects.create_user(
            username=username,
            email=email,
            password=pass1,
            first_name=first_name,  # Save first name
            last_name=last_name,  # Save last name
        )
        user.save()

        login(request, user)
        return redirect("dashboard2")

    return render(request, "core/auth2.html")


def auth_ping(request):
    return JsonResponse({"authenticated": request.user.is_authenticated})


@never_cache
@login_required
def dashboard(request):
    """
    The landing page. Shows teams you own and teams you joined.
    """
    # 1. Teams I supervise
    owned_teams = request.user.owned_teams.all()

    # 2. Teams I am a worker in
    joined_teams = request.user.joined_teams.all()

    # sends us to the dashboard with our current teams
    return render(
        request,
        "core/dashboard2.html",
        {"owned_teams": owned_teams, "joined_teams": joined_teams},
    )


@login_required
@require_http_methods(["POST"])
def create_team(request):
    name = request.POST.get("team_name")
    if name:
        Team.objects.create(name=name, owner=request.user)
    return redirect("dashboard2")


@login_required
@require_http_methods(["POST"])
def join_team(request):
    code = request.POST.get("join_code")
    try:
        team = Team.objects.get(join_code=code)
        if team.owner == request.user:
            # You can't join your own team as a worker
            pass
        else:
            team.members.add(request.user)
    except Team.DoesNotExist:
        # Handle error (maybe add a message in real app)
        pass
    return redirect("dashboard2")


# --- 1. WORKER SIDE (Updated for Teams) ---


@login_required
@never_cache
def availability_view(request, team_id):
    team = get_object_or_404(Team, id=team_id)

    # 1. Fetch time ranges (removed .prefetch_related('preferred_roles'))
    availabilities = AvailabilityRange.objects.filter(user=request.user, team=team)

    # 2. Fetch the user's global roles for this team (Path B)
    role_prefs = UserRolePreference.objects.filter(user=request.user, team=team).first()
    # Get a list of IDs so the JS knows which checkboxes to tick on load
    selected_role_ids = (
        list(role_prefs.roles.values_list("id", flat=True)) if role_prefs else []
    )

    # 3. Format ranges for the JS Grid
    avail_list = []
    for a in availabilities:
        avail_list.append(
            {
                "day": a.day,
                "start": a.start_time.strftime("%H:%M"),
                "end": a.end_time.strftime("%H:%M"),
                "building": a.building,
                "name": a.eventName,    
                # We no longer send roles per-block, just the block itself
                "color": "#4a90e2",
            }
        )

    # 4. Get all possible roles for the sidebar checkboxes
    all_roles = Role.objects.filter(team=team)

    context = {
        "team": team,
        "roles": all_roles,  # For the sidebar
        "selected_role_ids": selected_role_ids,  # To check the boxes on load
        "existing_availabilities_json": avail_list,
    }
    return render(request, "core/availability2.html", context)


def minutes_to_string(minutes):
    if minutes is None:
        return ""

    # Calculate hours and remaining minutes
    hours = int(minutes) // 60
    mins = int(minutes) % 60

    # Return formatted string (02d ensures 9 becomes 09)
    return f"{hours:02d}:{mins:02d}"


@login_required
def save_availability(request, team_id):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            team = get_object_or_404(Team, id=team_id)

            # 1. FIX: The JS sends 'events', not 'ranges'
            events_data = data.get("events", [])

            # JS payload might not include role_ids in this specific call
            # Default to empty list to prevent errors
            role_ids = data.get("role_ids", [])

            with transaction.atomic():
                # 2. Wipe old data
                AvailabilityRange.objects.filter(user=request.user, team=team).delete()

                # 3. Map JS Day integers (0=Sun) to Model strings ('sun')
                # Adjust if your week starts on Monday (0=Mon)
                day_map = {
                    0: "sun",
                    1: "mon",
                    2: "tue",
                    3: "wed",
                    4: "thu",
                    5: "fri",
                    6: "sat",
                }

                for item in events_data:
                    # 4. Convert JS Minutes (Integers) to Python Time Objects

                    print(f"Processing item: {item}")  # Debugging line
                    start_val = minutes_to_string(item.get("start_min"))
                    end_val = minutes_to_string(item.get("end_min"))

                    # 5. Handle Day conversion
                    day_int = item.get("day")
                    # Default to 'mon' if day is missing or invalid
                    day_str = day_map.get(day_int, "mon")

                    AvailabilityRange.objects.create(
                        user=request.user,
                        team=team,
                        day=day_str,
                        start_time=start_val,
                        end_time=end_val,
                        # Map JS 'location' to Model 'building'
                        building=item.get("location", ""),
                        # Map JS 'name' to Model 'eventName' (if field exists)
                        eventName=item.get("name", ""),
                    )

                # 6. Save Role Preferences (only if sent)
                if role_ids:
                    role_prefs, _ = UserRolePreference.objects.get_or_create(
                        user=request.user, team=team
                    )
                    role_prefs.roles.set(
                        Role.objects.filter(id__in=role_ids, team=team)
                    )

            return JsonResponse({"status": "success", "count": len(events_data)})

        except Exception as e:
            # Print error to terminal for debugging
            print(f"CRITICAL SAVE ERROR: {str(e)}")
            return JsonResponse({"status": "error", "message": str(e)}, status=400)

    return JsonResponse(
        {"status": "error", "message": "Method not allowed"}, status=405
    )


# --- 2. SUPERVISOR SIDE (Updated for Teams) ---


@never_cache
@login_required
def scheduler_view(request, team_id):
    """
    Renders the Full Scheduler (the grid page).
    """
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

    # Fetch roles so the scheduler can assign them to shifts
    roles = Role.objects.filter(team=team)

    # FETCH ROOMS:
    rooms = Room.objects.filter(team=team)

    return render(
        request,
        "core/scheduler.html",
        {
            "team": team,
            "workers": workers,
            "roles": roles,
            "rooms": rooms,  # Now the frontend can see the rooms!
        },
    )


@login_required
@require_http_methods(["POST"])
def save_schedule(request, team_id):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"status": "error", "message": "Invalid JSON"}, status=400)

    team = get_object_or_404(Team, id=team_id)

    if team.owner != request.user:
        return HttpResponseForbidden("Only the supervisor can save schedules.")

    worker_id = data.get("worker_id")
    role_id = data.get("role")
    assigned_shifts = data.get("assigned_shifts")

    if not worker_id:
        return JsonResponse(
            {"status": "error", "message": "No worker ID provided"}, status=400
        )

    target_user = get_object_or_404(User, id=worker_id)

    # Validate Role
    role_obj = None
    if role_id:
        role_obj = get_object_or_404(Role, id=role_id, team=team)

    try:
        with transaction.atomic():
            # 1. Wipe existing shifts for this specific worker in this team
            # This prevents duplicates and handles "removing" shifts via the UI
            Shift.objects.filter(user=target_user, team=team).delete()

            # 2. Re-create the shifts from the payload
            count = 0
            if assigned_shifts:
                for day, shifts in assigned_shifts.items():
                    for time_range in shifts:
                        if len(time_range) == 2:
                            start, end = time_range
                            Shift.objects.create(
                                user=target_user,
                                team=team,
                                day=day.lower(),
                                start_time=start,
                                end_time=end,
                                role=role_obj,
                            )
                            count += 1

        return JsonResponse({"status": "success", "created": count})

    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


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


@login_required
def supervisor_view(request, team_id):
    team = get_object_or_404(Team, id=team_id)

    # PREFETCH MAGIC: Get members, their role assignments, and availability in 1-2 queries total
    members = team.members.all().prefetch_related(
        Prefetch(
            'team_role_assignments',
            queryset=TeamRoleAssignment.objects.filter(team=team),
            to_attr='current_team_assignment'
        ),
        Prefetch(
            'availabilityrange_set',
            queryset=AvailabilityRange.objects.filter(team=team),
            to_attr='team_availabilities'
        )
    )

    roles = Role.objects.filter(team=team)
    rooms = Room.objects.filter(team=team)

    member_list = []
    for member in members:
        # Instead of a DB query, we check the list we already fetched ('to_attr')
        assignment = member.current_team_assignment[0] if member.current_team_assignment else None

        # Check if they have availability ranges in the prefetched list
        has_availability = len(member.team_availabilities) > 0

        # Note: You can also prefetch UserRolePreference similarly to remove those queries!
        role_prefs = UserRolePreference.objects.filter(user=member, team=team).first()
        preferred_roles = list(role_prefs.roles.all()) if role_prefs else []

        status = "Submitted" if (has_availability or preferred_roles) else "Pending"

        member_list.append({
            "user": member,
            "status": status,
            "preferred_roles": preferred_roles,
            "current_role_id": assignment.role_id if assignment else None,
        })

    return render(request, "core/supervisor.html", {
        "team": team,
        "member_list": member_list,
        "roles": roles,
        "rooms": rooms,
    })


@login_required
def get_worker_availability(request, team_id, worker_id):
    team = get_object_or_404(Team, id=team_id)
    # allow supervisor only
    if team.owner != request.user:
        return HttpResponseForbidden("Supervisor only")

    target_user = get_object_or_404(User, id=worker_id)

    # Must be relevant to this team
    if target_user != team.owner and target_user not in team.members.all():
        return HttpResponseBadRequest("Worker is not on this team.")

    # Who is allowed to view?
    is_supervisor = team.owner == request.user
    is_self = request.user.id == worker_id

    if not (is_supervisor or is_self):
        return HttpResponseForbidden("Unauthorized")

    ranges = AvailabilityRange.objects.filter(user=target_user, team=team)
    print(len(ranges))
    data = {}
    for r in ranges:
        day_key = r.day.lower()
        data.setdefault(day_key, []).append(
            [
                r.start_time.strftime("%H:%M"),
                r.end_time.strftime("%H:%M"),
            ]
        )

    print(len(data))
    return JsonResponse({"unavailable": data})


# @login_required
# @require_http_methods(["POST"])
# def save_schedule(request, team_id):
#     try:
#         data = json.loads(request.body)
#     except json.JSONDecodeError:
#         return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)

#     team = get_object_or_404(Team, id=team_id)

#     if team.owner != request.user:
#         return HttpResponseForbidden("Only the supervisor can save schedules.")

#     worker_id = data.get('worker_id')
#     role_id = data.get('role') # This comes from the dropdown in scheduler
#     assigned_shifts = data.get('assigned_shifts')

#     if not worker_id:
#         return JsonResponse({'status': 'error', 'message': 'No worker ID provided'}, status=400)

#     target_user = get_object_or_404(User, id=worker_id)

#     # Correctly lookup the Role object for the Shift
#     role_obj = None
#     if role_id:
#         role_obj = Role.objects.filter(id=role_id, team=team).first()

#     try:
#         with transaction.atomic():
#             # Clear existing shifts for this specific worker/team combo
#             Shift.objects.filter(user=target_user, team=team).delete()

#             count = 0
#             if assigned_shifts:
#                 for day, shifts in assigned_shifts.items():
#                     for time_range in shifts:
#                         if len(time_range) == 2:
#                             start, end = time_range
#                             Shift.objects.create(
#                                 user=target_user,
#                                 team=team,
#                                 day=day.lower(),
#                                 start_time=start,
#                                 end_time=end,
#                                 role=role_obj
#                             )
#                             count += 1

#         return JsonResponse({'status': 'success', 'created': count})
#     except Exception as e:
#         return JsonResponse({'status': 'error', 'message': str(e)}, status=500)


@login_required
@require_http_methods(["POST"])
def create_role(request, team_id):
    team = get_object_or_404(Team, id=team_id)
    print(
        f"Attempting to create role for team {team_id} by user {request.user.username}"
    )
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
        # Check if role already exists for THIS team
        role = Role.objects.get(team=team, name=name)
        return JsonResponse(
            {"ok": True, "role_id": role.id, "created": False, "name": role.name}
        )
    except Role.DoesNotExist:
        # Create new role (no capacity field needed)
        role = Role.objects.create(team=team, name=name)
        return JsonResponse(
            {"ok": True, "role_id": role.id, "created": True, "name": role.name}
        )
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=500)

@login_required
@require_http_methods(["POST"])
def update_member_role(request, team_id):
    try:
        data = json.loads(request.body)
        worker_id = data.get("member_id") # The template sends entry.id, ensure this matches
        role_id = data.get("role_id")

        team = get_object_or_404(Team, id=team_id)

        # Ensure only the owner can change roles
        if team.owner != request.user:
            return HttpResponseForbidden("Unauthorized")

        if not role_id:
            # Handle "No Role" selection by removing the assignment
            TeamRoleAssignment.objects.filter(team=team, user_id=worker_id).delete()
            return JsonResponse({"status": "success", "message": "Role cleared"})

        # Update the assignment or create a new one if it doesn't exist
        role = get_object_or_404(Role, id=role_id, team=team)
        assignment, created = TeamRoleAssignment.objects.update_or_create(
            team=team,
            user_id=worker_id,
            defaults={"role": role}
        )

        return JsonResponse({
            "status": "success",
            "role_name": role.name,
            "created": created
        })

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@login_required
@require_http_methods(["DELETE"])
def delete_role(request, team_id, role_id):
    team = get_object_or_404(Team, id=team_id)
    if team.owner != request.user:
        return HttpResponseForbidden()

    role = get_object_or_404(Role, id=role_id, team=team)
    role.delete()
    return JsonResponse({"ok": True})


@login_required
def list_roles(request, team_id):
    team = get_object_or_404(Team, id=team_id)

    # allow owner + members to view roles (adjust if you want)
    if request.user != team.owner and request.user not in team.members.all():
        return HttpResponseForbidden("Not allowed")

    roles = Role.objects.filter(team=team).order_by("name")
    return JsonResponse({"roles": [{"id": r.id, "name": r.name} for r in roles]})


@login_required
@require_http_methods(["POST"])
def assign_role(request, team_id):
    team = get_object_or_404(Team, id=team_id)

    # Permission check
    if team.owner != request.user:
        return JsonResponse({"error": "Unauthorized"}, status=403)

    try:
        data = json.loads(request.body)
        worker_id = data.get("worker_id")
        role_id = data.get("role_id")

        if not role_id:
            # If "Choose Role..." (empty) is selected, remove existing assignments
            TeamRoleAssignment.objects.filter(team=team, user_id=worker_id).delete()
            return JsonResponse({"ok": True, "message": "Role cleared"})

        role = get_object_or_404(Role, id=role_id, team=team)

        # Update or Create: Ensures a worker has ONE specific role in this team
        # If your business logic allows multiple roles, use .get_or_create() instead
        assignment, created = TeamRoleAssignment.objects.update_or_create(
            team=team, user_id=worker_id, defaults={"role": role}
        )

        return JsonResponse(
            {"ok": True, "role_name": role.name, "worker_id": worker_id}
        )

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@login_required
@require_http_methods(["POST"])
def unassign_role(request, team_id):
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
def worker_roles(request, team_id, worker_id):
    team = get_object_or_404(Team, id=team_id)

    # supervisor can only view worker roles if they are assigned to that team
    worker = get_object_or_404(User, id=worker_id)
    if worker != team.owner and worker not in team.members.all():
        return HttpResponseBadRequest("Worker is not on this team")

    # allow owner OR the worker themselves
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


@login_required
@require_POST
def create_room(request, team_id):
    team = get_object_or_404(Team, id=team_id)
    if team.owner != request.user:
        return HttpResponseForbidden("Unauthorized")

    try:
        data = json.loads(request.body)
        room = Room.objects.create(
            team=team, name=data.get("name"), capacity=data.get("capacity", 1)
        )
        return JsonResponse({"ok": True, "room_id": room.id})
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=400)


@login_required
def retrieve_room_availability(request, room_id):
    room = get_object_or_404(Room, id=room_id)
    if room.team.owner != request.user:
        return HttpResponseForbidden("Unauthorized")
    openTimes = RoomAvailability.objects.filter(room_id=room_id)
    open_lst = []
    for o in openTimes:
        open_lst.append(
            {
                "day": o.day,
                "start": o.start_time.strftime("%H:%M"),
                "end": o.end_time.strftime("%H:%M"),
            }
        )
    context = {"savedTimes": open_lst}
    print(context)
    return JsonResponse(context)


@login_required
def save_room_availability(request, team_id):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            team = get_object_or_404(Team, id=team_id)
            room_to_save = data.get("times", [])
            print(data)
            theRoom = Room.objects.get(id=data.get("room_id"))
            print(data.get("room_id"))
            print(theRoom)
            print(room_to_save)
            with transaction.atomic():
                RoomAvailability.objects.filter(room_id=data.get("room_id")).delete()
                day_map = {
                    0: "sun",
                    1: "mon",
                    2: "tue",
                    3: "wed",
                    4: "thu",
                    5: "fri",
                    6: "sat",
                }

                for item in room_to_save:
                    print(item)
                    start_val = minutes_to_string(item.get("start_min"))
                    end_val = minutes_to_string(item.get("end_min"))
                    day_int = item.get("day")
                    day_str = day_map.get(day_int, "mon")

                    RoomAvailability.objects.create(
                        day=day_str,
                        start_time=start_val,
                        end_time=end_val,
                        room=theRoom,
                    )
            return JsonResponse({"status": "success", "count": len(room_to_save)})

        except Exception as e:
            # Print error to terminal for debugging
            print(f"CRITICAL SAVE ERROR: {str(e)}")
            return JsonResponse({"status": "error", "message": str(e)}, status=400)

    return JsonResponse(
        {"status": "error", "message": "Method not allowed"}, status=405
    )


@login_required
@require_http_methods(["POST"])
def delete_room(request, team_id):
    try:
        data = json.loads(request.body)
        room_id = data.get("room_id")

        if not room_id:
            return JsonResponse({"status": "error", "message": "No room_id provided"}, status=400)

        with transaction.atomic():
            # filter().delete() is "idempotent" (won't crash if already deleted)
            RoomAvailability.objects.filter(room_id=room_id).delete()

            # Use filter instead of get to avoid DoesNotExist exceptions
            deleted_count, _ = Room.objects.filter(id=room_id, team_id=team_id).delete()

            if deleted_count == 0:
                return JsonResponse({"status": "error", "message": "Room not found or already deleted"}, status=404)

        return JsonResponse({"status": "success"})

    except json.JSONDecodeError:
        return JsonResponse({"status": "error", "message": "Invalid JSON"}, status=400)
    except Exception as e:
        print(f"CRITICAL DELETE ERROR: {str(e)}")
        return JsonResponse({"status": "error", "message": "Internal server error"}, status=500)


@login_required
@require_http_methods(["POST"])
def save_schedule(request, team_id):
    try:
        # 1. Initialize 'data' from the request body
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"status": "error", "message": "Invalid JSON"}, status=400)

    # 2. Define 'team' and check permissions
    team = get_object_or_404(Team, id=team_id)
    if team.owner != request.user:
        return HttpResponseForbidden("Only the supervisor can save schedules.")

    # 3. Define 'worker_id', 'target_user', and 'assigned_shifts'
    worker_id = data.get("worker_id")
    assigned_shifts = data.get("assigned_shifts")

    if not worker_id:
        return JsonResponse(
            {"status": "error", "message": "No worker ID provided"}, status=400
        )

    target_user = get_object_or_404(User, id=worker_id)

    # 4. Handle Role and Room lookups
    role_id = data.get("role")
    role_obj = Role.objects.filter(id=role_id, team=team).first() if role_id else None

    room_id = data.get("room_id")  # Ensure your JS sends this!
    room_obj = Room.objects.filter(id=room_id, team=team).first() if room_id else None

    try:
        with transaction.atomic():
            # 5. Clear existing shifts for this specific worker/team combo
            Shift.objects.filter(user=target_user, team=team).delete()

            count = 0
            if assigned_shifts:
                for day, shifts in assigned_shifts.items():
                    for time_range in shifts:
                        if len(time_range) == 2:
                            start, end = time_range

                            # 6. CAPACITY CHECK LOGIC
                            if room_obj:
                                # Count shifts in this room that overlap with the new one
                                overlapping_count = (
                                    Shift.objects.filter(
                                        room=room_obj,
                                        day=day.lower(),
                                    )
                                    .filter(
                                        Q(start_time__lt=end) & Q(end_time__gt=start)
                                    )
                                    .count()
                                )

                                if overlapping_count >= room_obj.capacity:
                                    # This error will trigger the 'except' block and rollback the delete
                                    raise Exception(
                                        f"Room {room_obj.name} is full on {day} at {start}!"
                                    )

                            # 7. Create the new shift
                            Shift.objects.create(
                                user=target_user,
                                team=team,
                                room=room_obj,
                                day=day.lower(),
                                start_time=start,
                                end_time=end,
                                role=role_obj,
                            )
                            count += 1

        return JsonResponse({"status": "success", "created": count})

    except Exception as e:
        # This catches the capacity Exception or any DB errors
        return JsonResponse({"status": "error", "message": str(e)}, status=500)
