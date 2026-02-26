from django.urls import path
from django.contrib.auth import views as auth_views
from . import views

# urlpatterns = [
#     # --- 1. DASHBOARD & TEAM MANAGEMENT ---
#     # The landing page where you choose a team
#     path('dashboard/', views.dashboard, name='dashboard'),
#     path('team/create/', views.create_team, name='create_team'),
#     path('team/join/', views.join_team, name='join_team'),

#     # --- 2. WORKER ROUTES (Specific to a Team) ---
#     # View the grid for a specific team
#     path('team/<uuid:team_id>/availability/', views.availability_view, name='availability'),
#     # API to save availability for that team
#     path('api/team/<uuid:team_id>/availability/', views.save_availability, name='save_availability'),

#     # --- 3. SUPERVISOR ROUTES (Specific to a Team) ---
#     # The main scheduler dashboard

#     path("team/<uuid:team_id>/supervisor/", views.supervisor_view, name="supervisor"),
#     path("team/<uuid:team_id>/scheduler/", views.scheduler_view, name="scheduler"),

#     # API: Get a specific worker's availability within this team
#     path('api/team/<uuid:team_id>/get-availability/<int:worker_id>/', views.get_worker_availability, name='get_avail'),

#     # API: Save the final schedule for this team
#     path('api/team/<uuid:team_id>/save-schedule/', views.save_schedule, name='save_schedule'),

#     # AUTHENTICATION
#     # 1. Login (Uses Django's built-in view, but points to our html)
#     path('login/', auth_views.LoginView.as_view(template_name='core/auth.html'), name='login'),

#     # 2. Logout (Redirects to login page after)
#     path('logout/', auth_views.LogoutView.as_view(next_page='login'), name='logout'),

#     # 3. Signup (Uses our custom view above)
#     path('signup/', views.signup, name='signup'),

#     # auth required for users
#     path("api/auth-ping/", views.auth_ping, name="auth_ping"),
#     path("api/team/<uuid:team_id>/roles/", views.list_roles, name="list_roles"),
#     path("api/team/<uuid:team_id>/roles/create/", views.create_role, name="create_role"),
#     path("api/team/<uuid:team_id>/roles/assign/", views.assign_role, name="assign_role"),
#     path("api/team/<uuid:team_id>/roles/unassign/", views.unassign_role, name="unassign_role"),
#     path("api/team/<uuid:team_id>/roles/worker/<int:worker_id>/", views.worker_roles, name="worker_roles"),

# ]
urlpatterns = [
    # --- DASHBOARD & TEAM MANAGEMENT ---
    path('dashboard2/', views.dashboard, name='dashboard2'),
    path('team/create/', views.create_team, name='create_team'),
    path('team/join/', views.join_team, name='join_team'),

    # --- WORKER ROUTES ---
    path('team/<uuid:team_id>/availability/', views.availability_view, name='availability'),
    path('api/team/<uuid:team_id>/save-availability/', views.save_availability, name='save_availability'),

    # --- SUPERVISOR ROUTES ---
    path("team/<uuid:team_id>/supervisor/", views.supervisor_view, name="supervisor"),
    path("team/<uuid:team_id>/scheduler/", views.scheduler_view, name="scheduler"),

    # --- API ENDPOINTS ---
    path('api/team/<uuid:team_id>/get-availability/<int:worker_id>/', views.get_worker_availability, name='get_avail'),
    path('api/team/<uuid:team_id>/save-schedule/', views.save_schedule, name='save_schedule'),
    path("api/team/<uuid:team_id>/events/add/", views.add_event, name="add_event"),

    # ROOMS API
    path('api/team/<uuid:team_id>/rooms/create/', views.create_room, name='create_room'),
    path('api/team/<uuid:team_id>/rooms/save-availability/', views.save_room_availability, name='save_room_availability'),
    path("api/room/<uuid:room_id>/availability/", views.retrieve_room_availability, name="add_room_availability"),
    path("api/room/<uuid:team_id>/rooms/delete-room/", views.delete_room, name='delete_room'),

    # ROLES API
    path("api/team/<uuid:team_id>/roles/", views.list_roles, name="list_roles"),
    path("api/team/<uuid:team_id>/roles/create/", views.create_role, name="create_role"),
    path("api/team/<uuid:team_id>/roles/assign/", views.assign_role, name="assign_role"),
    path("api/team/<uuid:team_id>/roles/unassign/", views.unassign_role, name="unassign_role"),
    path("api/team/<uuid:team_id>/roles/worker/<int:worker_id>/", views.worker_roles, name="worker_roles"),
    path("api/team/<uuid:team_id>/roles/<int:role_id>/delete/", views.delete_role, name="delete_role"),

    # AUTHENTICATION
    path('login/', auth_views.LoginView.as_view(template_name='core/auth2.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(next_page='login'), name='logout'),
    path('signup/', views.signup, name='signup'),
    path("api/auth-ping/", views.auth_ping, name="auth_ping"),
]