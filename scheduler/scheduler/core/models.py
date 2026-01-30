from django.db import models
from django.contrib.auth.models import User
import uuid

# 1. ADD THIS NEW MODEL
class Team(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    # The supervisor
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="owned_teams")
    # The workers
    members = models.ManyToManyField(User, related_name="joined_teams", blank=True)
    join_code = models.CharField(max_length=20, unique=True, default=uuid.uuid4)

    def __str__(self):
        return self.name

# 2. UPDATE EXISTING MODELS (Add 'team' field)
class AvailabilityRange(models.Model):
    # Keep your existing ID
    id = models.BigAutoField(primary_key=True) 
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    
    # NEW: Link this range to a specific team
    team = models.ForeignKey(Team, on_delete=models.CASCADE, null=True, blank=True) 
    
    day = models.CharField(max_length=5) 
    start_time = models.TimeField()
    end_time = models.TimeField()

    def __str__(self):
        return f"{self.user.username} - {self.day}"

class Shift(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    
    # NEW: Link this shift to a specific team
    team = models.ForeignKey(Team, on_delete=models.CASCADE, null=True, blank=True)
    
    day = models.CharField(max_length=5)
    start_time = models.TimeField()
    end_time = models.TimeField()
    role = models.CharField(max_length=50)

    def __str__(self):
        return f"SHIFT: {self.user.username} ({self.role})"