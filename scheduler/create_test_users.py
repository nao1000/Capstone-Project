import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'scheduler.settings')
django.setup()

from django.contrib.auth.models import User

users = [
    {"username": "employee1", "password": "test1234", "email": "employee1@test.com", "first_name": "John", "last_name": "Doe"},
    {"username": "employee2", "password": "test1234", "email": "employee2@test.com", "first_name": "Jane", "last_name": "Smith"},
    {"username": "employee3", "password": "test1234", "email": "employee3@test.com", "first_name": "Bob", "last_name": "Johnson"},
    {"username": "supervisor1", "password": "test1234", "email": "supervisor1@test.com", "first_name": "Alice", "last_name": "Williams"},
]

for u in users:
    if not User.objects.filter(username=u["username"]).exists():
        User.objects.create_user(
            username=u["username"],
            password=u["password"],
            email=u["email"],
            first_name=u["first_name"],
            last_name=u["last_name"]
        )
        print(f"Created user: {u['username']}")
    else:
        print(f"User already exists: {u['username']}")

print("Done!")