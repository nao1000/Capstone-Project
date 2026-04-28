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