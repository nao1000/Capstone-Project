'''
views/dashboard.py
Dashboard and team management views.
'''

from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_http_methods

from ..models import Team


@never_cache
@login_required
def dashboard(request):
    '''
    Shows all teams the user owns or has joined, and lets them create or join new ones.
    '''
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
    Create a team owned by the current user.
    '''
    name = request.POST.get("team_name")
    if name:
        Team.objects.create(name=name, owner=request.user)
    return redirect("dashboard2")


@login_required
@require_http_methods(["POST"])
def join_team(request):
    '''
    Join an existing team using its join code.
    '''
    code = request.POST.get("join_code")
    try:
        team = Team.objects.get(join_code=code)
        if team.owner != request.user:
            team.members.add(request.user)
    except Team.DoesNotExist:
        pass
    return redirect("dashboard2")