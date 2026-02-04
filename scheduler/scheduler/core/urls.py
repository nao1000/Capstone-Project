from django.urls import path
from django.contrib.auth import views as auth_views
from . import views

urlpatterns = [
    # --- 1. DASHBOARD & TEAM MANAGEMENT ---
    # The landing page where you choose a team
    path('', views.dashboard, name='dashboard'),
    path('team/create/', views.create_team, name='create_team'),
    path('team/join/', views.join_team, name='join_team'),

    # --- 2. WORKER ROUTES (Specific to a Team) ---
    # View the grid for a specific team
    path('team/<uuid:team_id>/availability/', views.availability_view, name='availability'),
    # API to save availability for that team
    path('api/team/<uuid:team_id>/availability/', views.save_availability, name='save_availability'),

    # --- 3. SUPERVISOR ROUTES (Specific to a Team) ---
    # The main scheduler dashboard
    path('team/<uuid:team_id>/supervisor/', views.supervisor_dashboard, name='supervisor'),
    
    # API: Get a specific worker's availability within this team
    path('api/team/<uuid:team_id>/get-availability/<int:worker_id>/', views.get_worker_availability, name='get_avail'),
    
    # API: Save the final schedule for this team
    path('api/team/<uuid:team_id>/save-schedule/', views.save_schedule, name='save_schedule'),
    
    # AUTHENTICATION
    # 1. Login (Uses Django's built-in view, but points to our html)
    path('login/', auth_views.LoginView.as_view(template_name='core/auth.html'), name='login'),
    
    # 2. Logout (Redirects to login page after)
    path('logout/', auth_views.LogoutView.as_view(next_page='login'), name='logout'),

    # 3. Signup (Uses our custom view above)
    path('signup/', views.signup, name='signup'),
    
    # auth required for users
    path("api/auth-ping/", views.auth_ping, name="auth_ping"),
]