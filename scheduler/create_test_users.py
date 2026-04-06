import os
import sys
import django
import uuid
from datetime import time

# --- Standard Django setup ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE_DIR, 'scheduler')) 
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scheduler.settings')
django.setup()

from django.contrib.auth.models import User
from scheduler.core.models import Team, AvailabilityRange, Schedule, Role, RoleSection, FixedObstruction, ObstructionDay, TeamRoleAssignment, Room, RoomAvailability

# Import the data you typed out manually (or paste it above this line)
from real_data import WORKERS, COURSES, ROOMS

def parse_time_block(block):
    """
    Takes a tuple like (900, 950) or (1400, 1515, "Class", "Bldg A")
    Returns (start_time, end_time, event_name, building)
    """
    # 1. Extract the integers
    start_int = block[0]
    end_int = block[1]
    
    # 2. Safely grab name and building if they exist in the tuple, otherwise use blank strings
    event_name = block[2] if len(block) > 2 else ""
    building = block[3] if len(block) > 3 else ""
    
    # 3. Convert military integers (like 1430) to hours (14) and minutes (30)
    start_time = time(start_int // 100, start_int % 100)
    end_time = time(end_int // 100, end_int % 100)
    
    return start_time, end_time, event_name, building

def seed_real_data():
    # 1. Setup Core Objects (Same as before)
    supervisor, _ = User.objects.get_or_create(
        username="supervisor",
        defaults={"email": "admin@siteam.com", "first_name": "Lead", "last_name": "Admin"}
    )
    supervisor.set_password("siteam2026!")
    supervisor.save()

    team, _ = Team.objects.get_or_create(
        name="SI Leaders Spring 2026",
        defaults={"owner": supervisor, "join_code": str(uuid.uuid4())}
    )

    Schedule.objects.get_or_create(team=team, name="Spring 2026", defaults={"is_active": True})
    
    for course in COURSES.keys():
        role = Role.objects.create(team=team, name=course)
        for section, info in COURSES[course].items():
            RoleSection.objects.create(role=role, name=section)
            obstruction = FixedObstruction.objects.create(
                team=team,
                role=role,
                name=f"{course} {section}",
                start_time=parse_time_block(info["time"])[0],
                end_time=parse_time_block(info["time"])[1],
                section=section,
            )
            for day in info["days"]:
                ObstructionDay.objects.create(obstruction=obstruction, day=day)
        
    for room in ROOMS.keys():
        roomObj =Room.objects.create(team=team, name=room, capacity=ROOMS[room]["cap"])
        for day in ROOMS[room]:
            if (day == "cap"):
                continue   
            for time_block in ROOMS[room][day]:
                start_time, end_time, event_name, building = parse_time_block(time_block)
                RoomAvailability.objects.create(
                    room=roomObj,
                    day=day,
                    start_time=start_time,
                    end_time=end_time,
                )

    print(f"Importing {len(WORKERS)} real workers...")

    # 2. Iterate through your manually typed data
    for worker_data in WORKERS:
        username = worker_data["username"]
        
        # Create or grab the user
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "first_name": worker_data["first_name"],
                "last_name": worker_data["last_name"],
                "email": f"{username}@university.edu"
            }
        )
        if created:
            user.set_password("student2026!")
            user.save()
        
        team.members.add(user)

        # --- NEW: Create the Team Role Assignment ---
        role_name = worker_data.get("role")
        section_name = worker_data.get("section")
        
        if role_name:
            # Safely query the database for the Role and Section we generated earlier
            role_obj = Role.objects.filter(team=team, name=role_name).first()
            
            section_obj = None
            if role_obj and section_name:
                section_obj = RoleSection.objects.filter(role=role_obj, name=section_name).first()
            
            # Create or update the worker's assignment!
            if role_obj:
                TeamRoleAssignment.objects.update_or_create(
                    team=team,
                    user=user,
                    defaults={
                        "role": role_obj,
                        "section": section_obj
                    }
                )
        # --------------------------------------------

    
        # Clear old availability just in case you are re-running the script
        AvailabilityRange.objects.filter(user=user, team=team).delete()

        # 3. Parse and create the schedules
        schedule_dict = worker_data.get("schedule", {})
        
        for day, time_blocks in schedule_dict.items():
            for block in time_blocks:
                start_time, end_time, event_name, building = parse_time_block(block)
                
                AvailabilityRange.objects.create(
                    user=user,
                    team=team,
                    day=day,
                    start_time=start_time,
                    end_time=end_time,
                    eventName=event_name,  # Saves the optional name
                    building=building      # Saves the optional building
                )
                
        print(f" -> Created schedule for {worker_data['first_name']} {worker_data['last_name']}")

    print("Success! Real data imported.")

if __name__ == "__main__":
    seed_real_data()