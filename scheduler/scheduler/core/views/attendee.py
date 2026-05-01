from ..models import AttendeeResponseLink, AttendeePreference, Role
from django.views.decorators.csrf import csrf_exempt
import json
from django.shortcuts import get_object_or_404, render
from django.http import HttpResponseForbidden, JsonResponse
from ..models import Team

def attendee_form(request, token):
    link = get_object_or_404(AttendeeResponseLink, token=token, is_active=True)
    team = link.team
    roles = Role.objects.filter(team=team)

    roles_json = json.dumps([{"id": r.id, "name": r.name} for r in roles])

    return render(request, 'core/attendee_form.html', {
        "team": team,
        "token": token,
        "roles_json": roles_json,
    })


@csrf_exempt
def submit_attendee_preferences(request, token):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST only'}, status=405)

    link = get_object_or_404(AttendeeResponseLink, token=token, is_active=True)
    team = link.team

    try:
        data = json.loads(request.body)
        preferences = data.get('preferences', [])

        created = []
        for pref in preferences:
            role = get_object_or_404(Role, id=pref['role_id'], team=team)
            AttendeePreference.objects.create(
                team=team,
                role=role,
                day=pref['day'],
                start_min=pref['start_min'],
                end_min=pref['end_min'],
            )
            created.append(pref)

        return JsonResponse({'saved': len(created)})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


# Supervisor utility to generate the link
def get_or_create_response_link(request, team_id):
    team = get_object_or_404(Team, id=team_id)
    if team.owner != request.user:
        return HttpResponseForbidden()
    link, _ = AttendeeResponseLink.objects.get_or_create(team=team)
    full_url = request.build_absolute_uri(f'/respond/{link.token}/')
    return JsonResponse({'url': full_url})

def get_preference_density(request, team_id):
    """
    Returns aggregated preference data for a team.
    Data is grouped by role, day, and 15-minute time slots.
    """
    # Note: Ensure you have appropriate authentication/authorization checks here
    
    preferences = AttendeePreference.objects.filter(team_id=team_id)
    
    # We will build a dictionary: { role_id: { day: { slot_index: count } } }
    density_data = {}
    
    START_HOUR = 8
    
    for pref in preferences:
        role_id = str(pref.role_id)
        day = pref.day
        
        if role_id not in density_data:
            density_data[role_id] = {}
        if day not in density_data[role_id]:
            density_data[role_id][day] = {}
            
        # Convert start/end minutes back into 15-minute slot indices
        start_slot = (pref.start_min - (START_HOUR * 60)) // 15
        end_slot = (pref.end_min - (START_HOUR * 60)) // 15
        
        for slot in range(start_slot, end_slot):
            if slot not in density_data[role_id][day]:
                density_data[role_id][day][slot] = 0
            density_data[role_id][day][slot] += 1
            
    # Optional: Find the maximum density per role to help the frontend calculate color intensity
    max_density_per_role = {}
    for role_id, days in density_data.items():
        max_val = 0
        for day_slots in days.values():
            if day_slots:
                max_val = max(max_val, max(day_slots.values()))
        max_density_per_role[role_id] = max_val

    return JsonResponse({
        'density_data': density_data,
        'max_density': max_density_per_role
    })