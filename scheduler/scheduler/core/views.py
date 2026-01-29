"""
request → response logic
"""
import json
from django.http import JsonResponse, HttpResponseBadRequest
from django.shortcuts import render
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from .models import AvailabilityRange

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
    if not isinstance(unavailable, dict):
        return HttpResponseBadRequest("Missing 'unavailable'")

    # TEMP: if you're not doing auth yet, pick a placeholder user strategy.
    # Best is to require login. For now this will fail if request.user isn't set up.
    user = request.user
    if not user.is_authenticated:
        return HttpResponseBadRequest("Not logged in")

    # Replace existing availability for this user
    AvailabilityRange.objects.filter(user=user).delete()

    created = 0
    for day, ranges in unavailable.items():
        if not isinstance(ranges, list):
            continue
        for pair in ranges:
            if not (isinstance(pair, list) and len(pair) == 2):
                continue
            start, end = pair
            AvailabilityRange.objects.create(
                user=user,
                day=day,
                start_time=start,
                end_time=end,
            )
            created += 1

    return JsonResponse({"ok": True, "created": created})

