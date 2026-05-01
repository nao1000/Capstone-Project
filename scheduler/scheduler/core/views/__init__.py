'''
views/__init__.py

This file turns the `views/` directory into a Python package and re-exports
every view function so that urls.py can continue using `from . import views`
and `views.function_name` without any changes.
'''

# --- Shared helpers (not views, but used across modules) ---
from .utils import DAY_MAP, time_to_minutes, minutes_to_time, minutes_to_string

# --- Auth ---
from .auth import signup, auth_ping, account_details

# --- Dashboard & Team ---
from .dashboard import dashboard, create_team, join_team, delete_team

# --- Full page renders ---
from .pages import availability_view, supervisor_view, scheduler_view

# --- API: Availability ---
from .availability import save_availability, get_worker_availability

# --- API: Schedules & Shifts ---
from .schedules import (
    get_schedules,
    create_schedule,
    save_role_shifts,
    set_active_schedule,
    get_schedule_shifts,
    get_room_bookings,
    export_schedule,
    delete_shifts,
    delete_shift
)

# --- API: Rooms ---
from .rooms import (
    create_room,
    save_room_availability,
    retrieve_room_availability,
    delete_room,
    get_room_availability,
)

# --- API: Roles & Sections ---
from .roles import (
    create_role,
    list_roles,
    get_team_roles,
    delete_role,
    filter_view,
    assign_role,
    unassign_role,
    worker_roles,
    get_role_sections,
    create_role_section,
    delete_role_section,
    save_member_assignments,
)

# --- API: Events, Obstructions & Members ---
from .events import (
    add_event,
    create_obstruction,
    delete_obstruction,
    remove_member_from_team,
)

# --- API: Auto Scheduler ---
from .auto_scheduler import auto_schedule_role

from .attendee import attendee_form, submit_attendee_preferences, get_or_create_response_link, get_preference_density