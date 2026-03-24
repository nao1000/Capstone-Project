import os
import sys
import django
import random
import uuid
from datetime import time

# --- Standard Django setup ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Adjust this path if your manage.py is in a different spot
sys.path.insert(0, os.path.join(BASE_DIR, 'scheduler')) 
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scheduler.settings')
django.setup()

from django.contrib.auth.models import User
from scheduler.core.models import Team, AvailabilityRange, Schedule

def seed_data():
    # 1. Setup Core Objects
    supervisor, _ = User.objects.get_or_create(
        username="supervisor_admin",
        defaults={"email": "admin@siteam.com", "first_name": "Lead", "last_name": "Admin"}
    )
    supervisor.set_password("siteam2026!")
    supervisor.save()

    team, _ = Team.objects.get_or_create(
        name="SI Leaders Spring 2026",
        defaults={"owner": supervisor, "join_code": str(uuid.uuid4())}
    )

    Schedule.objects.get_or_create(team=team, name="Spring 2026", defaults={"is_active": True})

    # 2. Diversified Name Pools
    first_names = [
        "Liam", "Noah", "Oliver", "James", "Elijah", "William", "Henry", "Lucas", "Benjamin", "Theodore",
        "Emma", "Olivia", "Charlotte", "Amelia", "Sophia", "Mia", "Isabella", "Ava", "Evelyn", "Luna",
        "Mateo", "Levi", "Sebastian", "Jack", "Ezra", "Aria", "Aurora", "Gianna", "Ellie", "Mila",
        "Zoe", "Leo", "Isaiah", "Charles", "Caleb", "Christopher", "Nathan", "Thomas", "Miles", "Josiah",
        "Ruby", "Sophie", "Alice", "Hailey", "Sadie", "Piper", "Autumn", "Nevaeh", "Quinn", "Peyton"
    ]
    last_names = [
        "Smith", "Jones", "Taylor", "Brown", "Wilson", "Johnson", "Davies", "Robinson", "Wright", "Thompson",
        "Evans", "Walker", "White", "Roberts", "Green", "Hall", "Wood", "Harris", "Clark", "Lewis",
        "Young", "King", "Baker", "Adams", "Campbell", "Anderson", "Allen", "Cook", "Bailey", "Parker",
        "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Perez", "Sanchez", "Ramirez",
        "Torres", "Flores", "Rivera", "Gomez", "Diaz", "Cruz", "Morales", "Ortiz", "Guttierez", "Reyes"
    ]

    days = ["mon", "tue", "wed", "thu", "fri", "sat"]

    print(f"Generating 50 unique users...")

    for i in range(50):
        # Using the index 'i' ensures the username is always unique
        fname = first_names[i]
        lname = last_names[i]
        uname = f"{fname.lower()}.{lname.lower()}.{i+100}" # e.g. liam.smith.100
        
        user, created = User.objects.get_or_create(
            username=uname,
            defaults={
                "first_name": fname,
                "last_name": lname,
                "email": f"{uname}@university.edu"
            }
        )
        if created:
            user.set_password("student2026!")
            user.save()
        
        team.members.add(user)

        # 3. Create "Busy" Ranges (Simulating Classes)
        AvailabilityRange.objects.filter(user=user, team=team).delete()

        for day in days:
            # We want to create "Busy" blocks (when they CANNOT work)
            # Most students have 3-5 hours of classes/obligations per day
            num_busy_blocks = random.randint(2, 4)
            
            # Start hours between 8 AM and 6 PM
            start_hours = random.sample(range(8, 19), num_busy_blocks)
            
            for start_h in start_hours:
                # Duration is either 1 hour or 1.5 hours
                duration = random.choice([1, 1.5])
                
                end_h = int(start_h + duration)
                end_m = 30 if (duration % 1 != 0) else 0

                # Ensure we don't exceed 10 PM
                if end_h >= 22:
                    end_h, end_m = 22, 0

                AvailabilityRange.objects.create(
                    user=user,
                    team=team,
                    day=day,
                    start_time=time(start_h, 0),
                    end_time=time(end_h, end_m)
                )

    print(f"Success! Created {User.objects.filter(username__contains='1').count()} unique SI Leaders.")

if __name__ == "__main__":
    seed_data()