"""
request → response logic
"""
import json
from django.http import JsonResponse, HttpResponseBadRequest
from django.shortcuts import render
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt

def availability_view(request):
    return render(request, "core/availability.html")


@csrf_exempt  # ok for now; later do proper CSRF with fetch + token
@require_http_methods(["POST"])
def save_availability(request):
    try:
        data = json.loads(request.body.decode("utf-8"))
    except Exception:
        return HttpResponseBadRequest("Invalid JSON")

    # Minimal validation
    if "unavailable" not in data or not isinstance(data["unavailable"], dict):
        return HttpResponseBadRequest("Missing 'unavailable'")

    # TODO: store in DB (models) — for now just echo back
    return JsonResponse({"ok": True, "received_name": data.get("name", "")})
