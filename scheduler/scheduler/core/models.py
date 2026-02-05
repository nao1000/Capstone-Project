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

class TeamEvent(models.Model):
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='events')
    name = models.CharField(max_length=100) # e.g., "Main Lab" or "Conference Room"
    day = models.CharField(max_length=10)   # mon, tues, wed...
    start_time = models.TimeField()
    end_time = models.TimeField()

    def __str__(self):
        return f"{self.name} on {self.day}"

# worker's role defined by supervisor
class Role(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=50)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="roles")
    color = models.CharField(max_length=7, default="#007bff")

    # requires role to be unique within the team (no duplicate roles)
    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["team", "name"], name="uniq_role_name_per_team")
        ]

    def __str__(self):
        return f"{self.name} ({self.team.name})"


class AvailabilityRange(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    day = models.CharField(max_length=10) # 'mon', 'tue', 'wed', etc.
    start_time = models.TimeField()
    end_time = models.TimeField()
    building = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"{self.user.username}: {self.day} {self.start_time}-{self.end_time}"

class UserRolePreference(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    # This stores the "Global" roles the user is willing to do for this team
    roles = models.ManyToManyField(Role, blank=True)

    class Meta:
        unique_together = ('user', 'team') # One set of preferences per user/team

    def __str__(self):
        return f"{self.user.username} Roles for {self.team.name}"

# defined event by a supervisor
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

# assign roles to workers
class TeamRoleAssignment(models.Model):
    team = models.ForeignKey("Team", on_delete=models.CASCADE, related_name="role_assignments")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="team_role_assignments")
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="assignments")
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["team", "user", "role"], name="uniq_role_assignment")
        ]

    def __str__(self):
        return f"{self.team.name}: {self.user.username} -> {self.role.name}"