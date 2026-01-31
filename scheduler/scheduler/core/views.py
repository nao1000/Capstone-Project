import json
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseForbidden
from django.shortcuts import render, get_object_or_404, redirect
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from .models import AvailabilityRange, Shift, Team 
from django.contrib.auth import login, authenticate
from django.contrib.auth.forms import UserCreationForm
from django.contrib import messages

def signup(request):

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

@csrf_exempt
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

@login_required
def supervisor_dashboard(request, team_id):
    """
    The Scheduler Interface for a specific team.
    """
    team = get_object_or_404(Team, id=team_id)
    
    # Security: Only the owner can see the supervisor dashboard
    if team.owner != request.user:
        return HttpResponseForbidden("You are not the supervisor of this team.")

    # Get only workers in THIS team
    workers = team.members.all() 
    return render(request, "core/supervisor.html", {"team": team, "workers": workers})

@login_required
def get_worker_availability(request, team_id, worker_id):
    """
    Get availability for a worker specific to this team context.
    """
    team = get_object_or_404(Team, id=team_id)
    
    # Security check (Owner or the user themselves)
    if team.owner != request.user and request.user.id != worker_id:
        return HttpResponseForbidden("Unauthorized")

    target_user = get_object_or_404(User, id=worker_id)
    
    # Filter by Team!
    ranges = AvailabilityRange.objects.filter(user=target_user, team=team)
    
    data = {}
    for r in ranges:
        day_key = r.day.lower() 
        if day_key not in data:
            data[day_key] = []
        
        s_str = r.start_time.strftime("%H:%M")
        e_str = r.end_time.strftime("%H:%M")
        data[day_key].append([s_str, e_str])

    return JsonResponse({"unavailable": data})

@login_required
@require_http_methods(["POST"])
def save_schedule(request, team_id):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)

    team = get_object_or_404(Team, id=team_id)

    # Only Supervisor can save schedule
    if team.owner != request.user:
        return HttpResponseForbidden("Only the supervisor can save schedules.")

    worker_id = data.get('worker_id')
    role = data.get('role')
    assigned_shifts = data.get('assigned_shifts') 

    if not worker_id:
        return JsonResponse({'status': 'error', 'message': 'No worker ID provided'}, status=400)

    target_user = get_object_or_404(User, id=worker_id)

    # Optional: Clear existing shifts for this user/team to prevent duplicates?
    # Shift.objects.filter(user=target_user, team=team).delete()

    count = 0
    if assigned_shifts:
        for day, shifts in assigned_shifts.items():
            for time_range in shifts:
                start, end = time_range
                Shift.objects.create(
                    user=target_user,
                    team=team,    # <--- Link to Team
                    day=day,
                    start_time=start,
                    end_time=end,
                    role=role
                )
                count += 1

    return JsonResponse({'status': 'success', 'created': count})

def add_team_role(request, team_id):
    if request.method == "POST":
        data = json.loads(request.body)
        role_name = data.get("name")
        team = Team.objects.get(id=team_id)
        
        # Create the role in the DB
        new_role = Role.objects.create(name=role_name, team=team)
        
        return JsonResponse({
            "status": "success", 
            "role_id": new_role.id, 
            "role_name": new_role.name
        })