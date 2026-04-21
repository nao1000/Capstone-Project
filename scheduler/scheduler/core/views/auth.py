'''
views/auth.py
User authentication and account management views.
'''

from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.contrib.auth import login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.contrib import messages


def signup(request):
    '''
    Handles new user registration. Logs out any existing session first.
    '''
    if request.user.is_authenticated:
        logout(request)

    if request.method == "POST":
        first_name = request.POST.get("first_name")
        last_name = request.POST.get("last_name")
        username = request.POST["username"]
        email = request.POST["email"]
        pass1 = request.POST["password"]
        pass2 = request.POST["confirm_password"]

        if pass1 != pass2:
            messages.error(request, "Passwords do not match!")
            return render(request, "core/auth2.html")

        if User.objects.filter(username=username).exists():
            messages.error(request, "Username already taken!")
            return render(request, "core/auth2.html")

        user = User.objects.create_user(
            username=username,
            email=email,
            password=pass1,
            first_name=first_name,
            last_name=last_name,
        )
        user.save()
        login(request, user)
        return redirect("dashboard2")

    return render(request, "core/auth2.html")


def auth_ping(request):
    return JsonResponse({"authenticated": request.user.is_authenticated})


@login_required
def account_details(request):
    if request.method == 'POST':
        first_name = request.POST.get('first_name', '').strip()
        last_name = request.POST.get('last_name', '').strip()
        email = request.POST.get('email', '').strip()

        user = request.user
        user.first_name = first_name
        user.last_name = last_name
        user.email = email
        user.save()

        messages.success(request, 'Your account details have been updated.')
        return redirect('account_details')

    return render(request, 'core/account_details.html')