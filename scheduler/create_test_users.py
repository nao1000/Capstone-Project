import os
import sys
import django

# 1. Set up path first
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INNER_DIR = os.path.join(BASE_DIR, 'scheduler')
sys.path.insert(0, INNER_DIR)

# 2. Configure Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scheduler.settings')
django.setup()

from django.contrib.auth.models import User
from scheduler.core.models import Team, Role, AvailabilityRange, TeamRoleAssignment, Schedule
from datetime import time
import uuid
# --- USERS ---
users_data = [
    {"username": "employee1", "password": "test1234", "email": "employee1@test.com", "first_name": "John", "last_name": "Doe"},
    {"username": "employee2", "password": "test1234", "email": "employee2@test.com", "first_name": "Jane", "last_name": "Smith"},
    {"username": "employee3", "password": "test1234", "email": "employee3@test.com", "first_name": "Bob", "last_name": "Johnson"},
    {"username": "supervisor1", "password": "test1234", "email": "supervisor1@test.com", "first_name": "Alice", "last_name": "Williams"},
]

created_users = {}
for u in users_data:
    user, created = User.objects.get_or_create(username=u["username"], defaults={
        "email": u["email"],
        "first_name": u["first_name"],
        "last_name": u["last_name"]
    })
    if created:
        user.set_password(u["password"])
        user.save()
        print(f"Created user: {u['username']}")
    else:
        print(f"User already exists: {u['username']}")
    created_users[u["username"]] = user

supervisor = created_users["supervisor1"]
employees = [created_users["employee1"], created_users["employee2"], created_users["employee3"]]

# --- TEAM ---
team, created = Team.objects.get_or_create(
    name="Test Team",
    defaults={
        "owner": supervisor,
        "join_code": str(uuid.uuid4())
    }
)
if created:
    print(f"Created team: {team.name}")
else:
    print(f"Team already exists: {team.name}")

# Add employees to team
for emp in employees:
    team.members.add(emp)
print(f"Added employees to team")

# --- AVAILABILITY RANGES ---
# Each employee has availability Mon-Fri with slightly different hours
availability_data = [
    # John Doe - available most of the week
    {"user": employees[0], "ranges": [
        {"day": "mon", "start": "08:00", "end": "17:00"},
        {"day": "tue", "start": "08:00", "end": "17:00"},
        {"day": "wed", "start": "10:00", "end": "18:00"},
        {"day": "thu", "start": "08:00", "end": "17:00"},
        {"day": "fri", "start": "08:00", "end": "14:00"},
    ]},
    # Jane Smith - afternoon availability
    {"user": employees[1], "ranges": [
        {"day": "mon", "start": "12:00", "end": "20:00"},
        {"day": "tue", "start": "12:00", "end": "20:00"},
        {"day": "wed", "start": "12:00", "end": "20:00"},
        {"day": "thu", "start": "14:00", "end": "20:00"},
        {"day": "fri", "start": "12:00", "end": "18:00"},
        {"day": "sat", "start": "10:00", "end": "16:00"},
    ]},
    # Bob Johnson - flexible hours
    {"user": employees[2], "ranges": [
        {"day": "mon", "start": "09:00", "end": "18:00"},
        {"day": "wed", "start": "09:00", "end": "18:00"},
        {"day": "fri", "start": "09:00", "end": "18:00"},
        {"day": "sat", "start": "08:00", "end": "14:00"},
        {"day": "sun", "start": "10:00", "end": "16:00"},
    ]},
]

from datetime import time

for entry in availability_data:
    user = entry["user"]
    # Clear existing ranges for this user/team first
    AvailabilityRange.objects.filter(user=user, team=team).delete()
    for r in entry["ranges"]:
        start_parts = r["start"].split(":")
        end_parts = r["end"].split(":")
        AvailabilityRange.objects.create(
            user=user,
            team=team,
            day=r["day"],
            start_time=time(int(start_parts[0]), int(start_parts[1])),
            end_time=time(int(end_parts[0]), int(end_parts[1])),
        )
    print(f"Created availability for {user.username}")

# --- DEFAULT SCHEDULE ---
schedule, created = Schedule.objects.get_or_create(
    team=team,
    name="Default",
    defaults={"is_active": True}
)
print(f"{'Created' if created else 'Exists'} default schedule")

print("\nDone! Summary:")
print(f"  Team: {team.name} (join code: {team.join_code})")
print(f"  Supervisor: {supervisor.username}")
print(f"  Employees: {[e.username for e in employees]}")
print(f"  Schedule: {schedule.name} (active: {schedule.is_active})")