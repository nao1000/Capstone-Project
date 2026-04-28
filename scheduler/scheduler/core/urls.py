from django.urls import path, include
from django.contrib.auth import views as auth_views
from . import views

urlpatterns = [
    # --- DASHBOARD & TEAM MANAGEMENT ---
    path('dashboard2/', views.dashboard, name='dashboard2'),
    path('team/create/', views.create_team, name='create_team'),
    path('team/join/', views.join_team, name='join_team'),
    path('api/team/<uuid:team_id>/delete/', views.delete_team, name="delete_team"),

    # --- WORKER ROUTES ---
    path('team/<uuid:team_id>/availability/', views.availability_view, name='availability'),
    path('api/team/<uuid:team_id>/save-availability/', views.save_availability, name='save_availability'),

    # --- SUPERVISOR ROUTES ---
    path("team/<uuid:team_id>/supervisor/", views.supervisor_view, name="supervisor"),
    path("team/<uuid:team_id>/scheduler/", views.scheduler_view, name="scheduler"),
    path('api/team/<uuid:team_id>/schedules/', views.get_schedules, name='get_schedules'),
    path('api/team/<uuid:team_id>/schedules/create/', views.create_schedule, name='create_schedule'),
    path('api/team/<uuid:team_id>/schedules/save-shifts/', views.save_role_shifts, name='save_role_shifts'),
    path('api/team/<uuid:team_id>/schedules/set-active/', views.set_active_schedule, name='set_active_schedule'),
    path('api/team/<uuid:team_id>/schedules/<int:schedule_id>/shifts/', views.get_schedule_shifts, name='get_schedule_shifts'),
    path('api/team/<uuid:team_id>/schedules/<int:schedule_id>/room-bookings/', views.get_room_bookings, name='get_room_bookings'),
    path('api/team/<uuid:team_id>/room-availability/', views.get_room_availability, name='get_room_availability'),
    path('api/team/<uuid:team_id>/members/remove/', views.remove_member_from_team, name='remove_member'),
    path('api/team/<uuid:team_id>/schedule/<int:schedule_id>/shifts/delete/', views.delete_shifts, name="delete_shifts"),

    # --- API ENDPOINTS ---
    path('api/team/<uuid:team_id>/get-availability/<int:worker_id>/', views.get_worker_availability, name='get_avail'),
    path("api/team/<uuid:team_id>/events/add/", views.add_event, name="add_event"),

    # ROOMS API
    path('api/team/<uuid:team_id>/rooms/create/', views.create_room, name='create_room'),
    path('api/team/<uuid:team_id>/rooms/save-availability/', views.save_room_availability, name='save_room_availability'),
    path("api/room/<uuid:room_id>/availability/", views.retrieve_room_availability, name="add_room_availability"),
    path("api/team/<uuid:team_id>/rooms/delete/", views.delete_room, name='delete_room'),

    # OBSTRUCTIONS API
    path('api/team/<uuid:team_id>/obstructions/create/', views.create_obstruction, name='create_obstruction'),
    path('api/team/<uuid:team_id>/obstructions/<int:obstruction_id>/delete/', views.delete_obstruction, name='delete_obstructin'),

    # ROLES API
    path("api/team/<uuid:team_id>/roles/", views.list_roles, name="list_roles"),
    path("api/team/<uuid:team_id>/roles/<int:role_id>", views.filter_view, name="filter_view"),
    path("api/team/<uuid:team_id>/roles/get", views.get_team_roles, name="get_team_roles"),
    path("api/team/<uuid:team_id>/roles/create/", views.create_role, name="create_role"),
    path("api/team/<uuid:team_id>/roles/assign/", views.assign_role, name="assign_role"),
    path("api/team/<uuid:team_id>/roles/unassign/", views.unassign_role, name="unassign_role"),
    path("api/team/<uuid:team_id>/roles/worker/<int:worker_id>/", views.worker_roles, name="worker_roles"),
    path("api/team/<uuid:team_id>/roles/<int:role_id>/delete/", views.delete_role, name="delete_role"),
    path('api/team/<uuid:team_id>/roles/<int:role_id>/sections/', views.get_role_sections),
    path('api/team/<uuid:team_id>/roles/<int:role_id>/sections/create/', views.create_role_section),
    path('api/team/<uuid:team_id>/roles/<int:role_id>/sections/<int:section_id>/delete/', views.delete_role_section),
    path('api/team/<uuid:team_id>/members/save-assignments/', views.save_member_assignments),

    # PASSWORD RESET
    # 1. Password Reset Form
    path('password_reset/', auth_views.PasswordResetView.as_view(
        template_name='core/registration/password_reset_form.html'
    ), name='password_reset'),

    # 2. Password Reset Done
    path('password_reset/done/', auth_views.PasswordResetDoneView.as_view(
        template_name='core/registration/password_reset_done.html'
    ), name='password_reset_done'),

    # 3. Password Reset Confirm
    path('reset/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(
        template_name='core/registration/password_reset_confirm.html'
    ), name='password_reset_confirm'),

    # 4. Password Reset Complete
    path('reset/done/', auth_views.PasswordResetCompleteView.as_view(
        template_name='core/registration/password_reset_complete.html'
    ), name='password_reset_complete'),

    # ACCOUNT DETAILS
    path('account/', views.account_details, name='account_details'),
    # Explicitly tell Django where your custom template is!
    path('password-change/', auth_views.PasswordChangeView.as_view(
        template_name='core/registration/password_change_form.html',
        success_url='/account/' # Redirects back to account details when done
    ), name='custom_password_change'),

    # AUTHENTICATION
    path('login/', auth_views.LoginView.as_view(template_name='core/auth2.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(next_page='login'), name='logout'),
    path('signup/', views.signup, name='signup'),
    path("api/auth-ping/", views.auth_ping, name="auth_ping"),

    # AUTOMATIC SCHEDULING
    path('api/team/<uuid:team_id>/auto-schedule/', views.auto_schedule_role, name='auto_schedule_role'),

    # EXPORT
    path('api/team/<uuid:team_id>/schedules/<int:schedule_id>/export/', views.export_schedule, name='export_schedule'),
    
    path('respond/<uuid:token>/', views.attendee_form, name='attendee_form'),
    path('respond/<uuid:token>/submit/', views.submit_attendee_preferences, name='submit_attendee_preferences'),
    path('api/team/<uuid:team_id>/response-link/', views.get_or_create_response_link, name='response_link'),
]
