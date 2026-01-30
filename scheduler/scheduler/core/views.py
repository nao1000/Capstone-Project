import json
from django.http import JsonResponse, HttpResponseBadRequest
from django.shortcuts import render, get_object_or_404
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User  # <--- CHANGED: Import User, not Worker
from .models import AvailabilityRange, Shift # <--- CHANGED: Added Shift

# --- 1. WORKER SIDE ---
def availability_view(request):
    return render(request, "core/availability.html")

@csrf_exempt
@require_http_methods(["POST"])
def save_availability(request):
    try:
        data = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return HttpResponseBadRequest("Invalid JSON")

    unavailable = data.get("unavailable")
    user = request.user
    
    if not user.is_authenticated:
        return HttpResponseBadRequest("Not logged in")

    AvailabilityRange.objects.filter(user=user).delete()

    created_count = 0
    if isinstance(unavailable, dict):
        for day, ranges in unavailable.items():
            for r in ranges:
                if len(r) == 2:
                    AvailabilityRange.objects.create(
                        user=user, day=day, start_time=r[0], end_time=r[1]
                    )
                    created_count += 1

    return JsonResponse({"ok": True, "created": created_count})

# --- 2. SUPERVISOR SIDE ---
@login_required
def supervisor_dashboard(request):
    # CHANGED: Worker.objects.all() -> User.objects.all()
    workers = User.objects.all() 
    return render(request, "core/supervisor.html", {"workers": workers})

@login_required
def get_worker_availability(request, worker_id):
    # CHANGED: Worker -> User
    target_user = get_object_or_404(User, id=worker_id)
    
    ranges = AvailabilityRange.objects.filter(user=target_user)
    
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
def save_schedule(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)

    worker_id = data.get('worker_id')
    role = data.get('role')
    assigned_shifts = data.get('assigned_shifts') 

    if not worker_id:
        return JsonResponse({'status': 'error', 'message': 'No worker ID provided'}, status=400)

    # CHANGED: Worker -> User
    target_user = get_object_or_404(User, id=worker_id)

    count = 0
    if assigned_shifts:
        for day, shifts in assigned_shifts.items():
            for time_range in shifts:
                start, end = time_range
                Shift.objects.create(
                    user=target_user,
                    day=day,
                    start_time=start,
                    end_time=end,
                    role=role
                )
                count += 1

    return JsonResponse({'status': 'success', 'created': count})