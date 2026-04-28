'''
views/auto_scheduler.py
API endpoint that runs the automatic scheduling engine.
'''

import json

from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST

from ..models import Team, ScheduleTemplate
from ..auto_scheduler import generate_schedule


@require_POST
@login_required
def auto_schedule_role(request, team_id):
    '''
    Run the OR-Tools scheduling engine with the provided configuration.
    Optionally saves the config as a reusable template.
    '''
    team = get_object_or_404(Team, id=team_id)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)

    config_data   = data.get("config", {})
    save_template = data.get("saveTemplate", False)
    template_name = data.get("templateName", "")

    if save_template and template_name:
        ScheduleTemplate.objects.create(
            team=team,
            name=template_name,
            duration=config_data.get("duration", 50),
            interval=config_data.get("interval", 30),
            weekly_quota=config_data.get("weeklyQuota", 3),
            daily_max=config_data.get("dailyMax", 1),
            max_concurrent=config_data.get("maxConcurrent", 1),
        )

    role_id           = config_data.get("roleId")
    roles_to_schedule = [role_id] if role_id else None

    engine_config = {
        "duration":      config_data.get("duration", 50),
        "interval":      config_data.get("interval", 30),
        "weekly_quota":  config_data.get("weeklyQuota", 3),
        "daily_max":     config_data.get("dailyMax", 1),
        "max_concurrent": config_data.get("maxConcurrent", 1),
    }

    try:
        results, shortfalls = generate_schedule(team, roles=roles_to_schedule, config=engine_config)
        return JsonResponse({
            "success": True,
            "shifts": results,
            "partial": len(shortfalls) > 0,
            "shortfalls": shortfalls,
        })
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=500)