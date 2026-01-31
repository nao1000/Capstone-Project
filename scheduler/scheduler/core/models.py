from django.db import models
from django.contrib.auth.models import User
import uuid

# Team Model
class Team(models.Model):

    # create universally unique id for each team (harder to guess a team's ID -- may make this custom)
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # sets name of the team
    name = models.CharField(max_length=100)

    # The supervisor -- will want to update to allow multiple supervisors in one team
    # currently, one team can have one owner -- if owner is deleted, so is team
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="owned_teams")

    # The workers -- many workers in one team is possible
    members = models.ManyToManyField(User, related_name="joined_teams", blank=True)
   
    join_code = models.CharField(max_length=36, unique=True, default=uuid.uuid4)

    def __str__(self):
        return self.name

# Availability Model
class AvailabilityRange(models.Model):
    # tied to a specific user in a specific team    
    id = models.BigAutoField(primary_key=True) 
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    
    # Link this range to a specific team
    team = models.ForeignKey(Team, on_delete=models.CASCADE, null=True, blank=True) 
    
    # saves the actual time
    day = models.CharField(max_length=5) 
    start_time = models.TimeField()
    end_time = models.TimeField()

    def __str__(self):
        return f"{self.user.username} - {self.day}"

class Role(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=50)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="roles")
    color = models.CharField(max_length=7, default="#007bff")

    def __str__(self):
        return f"{self.name} ({self.team.name})"

class Shift(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    
    # Link this shift to a specific team
    team = models.ForeignKey(Team, on_delete=models.CASCADE, null=True, blank=True)
    
    # similar to availability
    day = models.CharField(max_length=5)
    start_time = models.TimeField()
    end_time = models.TimeField()
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"SHIFT: {self.user.username} ({self.role})"

