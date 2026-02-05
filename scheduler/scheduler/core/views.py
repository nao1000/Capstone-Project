import json
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseForbidden
from django.db import transaction
from django.db.models import Prefetch
from django.shortcuts import render, get_object_or_404, redirect
from django.views.decorators.http import require_http_methods, require_POST
from django.views.decorators.csrf import csrf_exempt, csrf_protect
from django.views.decorators.cache import never_cache
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from .models import AvailabilityRange, Role, Shift, Team, TeamRoleAssignment, TeamEvent
from django.contrib.auth import login, authenticate
from django.contrib.auth.forms import UserCreationForm
from django.contrib import messages

def signup(request):
    if request.user.is_authenticated:
        return redirect("dashboard")
    # hand in completed sign up form
    if request.method == 'POST':
        username = request.POST['username']
        email = request.POST['email']
        pass1 = request.POST['password']
        pass2 = request.POST['confirm_password']

        # Simple validation
        if pass1 != pass2:
            messages.error(request, "Passwords do not match!")
            return render(request, 'core/auth.html')
        
        # check if username is already in use
        if User.objects.filter(username=username).exists():
            messages.error(request, "Username already taken!")
            return render(request, 'core/auth.html')

        # Create the user
        user = User.objects.create_user(username=username, email=email, password=pass1)
        user.save()
        
        # Log them in immediately
        login(request, user)
        return redirect('dashboard')

    # get a blank sign up
    return render(request, 'core/auth.html')

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
    return render(request, "core/dashboard.html", {
        "owned_teams": owned_teams,
        "joined_teams": joined_teams
    })

@login_required
@require_http_methods(["POST"])
def create_team(request):
    name = request.POST.get("team_name")
    if name:
        Team.objects.create(name=name, owner=request.user)
    return redirect("dashboard")

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
    return redirect("dashboard")


# --- 1. WORKER SIDE (Updated for Teams) ---

@never_cache
@login_required
def availability_view(request, team_id):
    """
    Renders the availability grid for a SPECIFIC team.
    """
    team = get_object_or_404(Team, id=team_id)
    
    # Security: Ensure user is actually in this team
    if request.user not in team.members.all():
        return HttpResponseForbidden("You are not a member of this team.")

    return render(request, "core/availability.html", {"team": team})

@login_required
@require_http_methods(["POST"])
def save_availability(request, team_id):
    try:
        data = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return HttpResponseBadRequest("Invalid JSON")

    team = get_object_or_404(Team, id=team_id)
    
    # Security Check
    if request.user not in team.members.all():
        return HttpResponseForbidden("Not a member")

    unavailable = data.get("unavailable")
    
    # DELETE existing ranges ONLY for this team
    AvailabilityRange.objects.filter(user=request.user, team=team).delete()

    created_count = 0
    if isinstance(unavailable, dict):
        for day, ranges in unavailable.items():
            for r in ranges:
                if len(r) == 2:
                    AvailabilityRange.objects.create(
                        user=request.user, 
                        team=team,
                        day=day, 
                        start_time=r[0], 
                        end_time=r[1]
                    )
                    created_count += 1

    return JsonResponse({"ok": True, "created": created_count})


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
            'availabilityrange_set', 
            queryset=AvailabilityRange.objects.filter(team=team),
            to_attr='team_availability'
        )
    )

    # Fetch roles so the scheduler can assign them to shifts
    roles = Role.objects.filter(team=team)

    # THIS IS THE MISSING PIECE:
    return render(request, "core/scheduler.html", {
        "team": team,
        "workers": workers,
        "roles": roles
    })

@login_required
@require_http_methods(["POST"])
def save_schedule(request, team_id):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)

    team = get_object_or_404(Team, id=team_id)

    if team.owner != request.user:
        return HttpResponseForbidden("Only the supervisor can save schedules.")

    worker_id = data.get('worker_id')
    role_id = data.get('role') 
    assigned_shifts = data.get('assigned_shifts') 

    if not worker_id:
        return JsonResponse({'status': 'error', 'message': 'No worker ID provided'}, status=400)

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
                                role=role_obj
                            )
                            count += 1
                            
        return JsonResponse({'status': 'success', 'created': count})
        
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

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
            name=data.get('name'),
            day=data.get('day'),
            start_time=data.get('start'),
            end_time=data.get('end')
        )
        return JsonResponse({
            "ok": True, 
            "event": {
                "id": event.id, 
                "name": event.name, 
                "day": event.day
            }
        })
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=400)

@login_required
def supervisor_view(request, team_id):
    team = get_object_or_404(Team, id=team_id)
    if team.owner != request.user:
        return HttpResponseForbidden()

    # Optimized Query for 80+ Workers:
    # 1. Fetch all members
    # 2. Prefetch availability ONLY for this team
    # 3. Prefetch role assignments ONLY for this team
    workers = team.members.all().prefetch_related(
        Prefetch(
            'availabilityrange_set', 
            queryset=AvailabilityRange.objects.filter(team=team),
            to_attr='team_availability'
        ),
        Prefetch(
            'team_role_assignments',
            queryset=TeamRoleAssignment.objects.filter(team=team).select_related('role'),
            to_attr='current_team_assignments'
        )
    )
    
    roles = Role.objects.filter(team=team)
    
    return render(request, "core/supervisor.html", {
        "team": team,
        "workers": workers,
        "roles": roles
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
    is_supervisor = (team.owner == request.user)
    is_self = (request.user.id == worker_id)

    if not (is_supervisor or is_self):
        return HttpResponseForbidden("Unauthorized")

    ranges = AvailabilityRange.objects.filter(user=target_user, team=team)

    data = {}
    for r in ranges:
        day_key = r.day.lower()
        data.setdefault(day_key, []).append([
            r.start_time.strftime("%H:%M"),
            r.end_time.strftime("%H:%M"),
        ])

    return JsonResponse({"unavailable": data})

@login_required
@require_http_methods(["POST"])
def save_schedule(request, team_id):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)

    team = get_object_or_404(Team, id=team_id)

    if team.owner != request.user:
        return HttpResponseForbidden("Only the supervisor can save schedules.")

    worker_id = data.get('worker_id')
    role_id = data.get('role') # This comes from the dropdown in scheduler
    assigned_shifts = data.get('assigned_shifts') 

    if not worker_id:
        return JsonResponse({'status': 'error', 'message': 'No worker ID provided'}, status=400)

    target_user = get_object_or_404(User, id=worker_id)
    
    # Correctly lookup the Role object for the Shift
    role_obj = None
    if role_id:
        role_obj = Role.objects.filter(id=role_id, team=team).first()

    try:
        with transaction.atomic():
            # Clear existing shifts for this specific worker/team combo
            Shift.objects.filter(user=target_user, team=team).delete()

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
                                role=role_obj
                            )
                            count += 1

        return JsonResponse({'status': 'success', 'created': count})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
    
@login_required
@require_http_methods(["POST"])
def create_role(request, team_id):
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

    role, created = Role.objects.get_or_create(team=team, name=name)
    return JsonResponse({"ok": True, "role_id": role.id, "created": created, "name": role.name})

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
            team=team,
            user_id=worker_id,
            defaults={'role': role}
        )

        return JsonResponse({
            "ok": True, 
            "role_name": role.name, 
            "worker_id": worker_id
        })

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

    TeamRoleAssignment.objects.filter(team=team, user_id=worker_id, role_id=role_id).delete()
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

    assigned = (TeamRoleAssignment.objects
                .filter(team=team, user_id=worker_id)
                .select_related("role")
                .order_by("role__name"))

    return JsonResponse({
        "roles": [{"id": a.role.id, "name": a.role.name} for a in assigned]
    })

