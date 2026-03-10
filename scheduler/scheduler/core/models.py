from django.db import models
from django.contrib.auth.models import User
from django.db.models import UniqueConstraint
import uuid


# Team Model
class Team(models.Model):

    # create universally unique id for each team (harder to guess a team's ID -- may make this custom)
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # sets name of the team
    name = models.CharField(max_length=100)

    # The supervisor -- will want to update to allow multiple supervisors in one team
    # currently, one team can have one owner -- if owner is deleted, so is team
    owner = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="owned_teams"
    )

    # The workers -- many workers in one team is possible
    members = models.ManyToManyField(User, related_name="joined_teams", blank=True)

    join_code = models.CharField(max_length=36, unique=True, default=uuid.uuid4)

    def __str__(self):
        return self.name


class Room(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="rooms")
    capacity = models.PositiveIntegerField(default=1)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["team", "name"], name="uniq_room_per_team")
        ]

    def __str__(self):
        return self.name


class RoomAvailability(models.Model):
    room = models.ForeignKey(
        Room, on_delete=models.CASCADE, related_name="availability_slots"
    )
    day = models.CharField(max_length=10)  # 'mon', 'tue', etc.
    start_time = models.TimeField()
    end_time = models.TimeField()

    def __str__(self):
        return f"{self.room.name} ({self.day}): {self.start_time}-{self.end_time}"


# worker's role defined by supervisor
class Role(models.Model):
    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=50)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="roles")
    color = models.CharField(max_length=7, default="#007bff")

    # requires role to be unique within the team (no duplicate roles)
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["team", "name"], name="uniq_role_name_per_team"
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.team.name})"


class AvailabilityRange(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    day = models.CharField(max_length=10)  # 'mon', 'tue', 'wed', etc.
    start_time = models.TimeField()
    end_time = models.TimeField()
    building = models.CharField(max_length=100, blank=True)
    eventName = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"{self.user.username}: {self.day} {self.start_time}-{self.end_time}"


class UserRolePreference(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    # This stores the "Global" roles the user is willing to do for this team
    roles = models.ManyToManyField(Role, blank=True)

    class Meta:
        unique_together = ("user", "team")  # One set of preferences per user/team

    def __str__(self):
        return f"{self.user.username} Roles for {self.team.name}"


class Schedule(models.Model):
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="schedules")
    name = models.CharField(max_length=100, default="Default")
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["team", "name"], name="uniq_schedule_per_team"
            )
        ]

    def __str__(self):
        return f"{self.team.name} - {self.name}"


class Shift(models.Model):
    schedule = models.ForeignKey(
        Schedule, on_delete=models.CASCADE, related_name="shifts"
    )
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="shifts")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="shifts")
    role = models.ForeignKey(
        Role, on_delete=models.SET_NULL, null=True, blank=True, related_name="shifts"
    )
    room = models.ForeignKey(
        Room, on_delete=models.SET_NULL, null=True, blank=True, related_name="shifts"
    )
    day = models.CharField(max_length=3)
    start_time = models.TimeField()
    end_time = models.TimeField()

    def __str__(self):
        return f"{self.user.username} - {self.role} ({self.day})"


class RoleSection(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="sections")
    name = models.CharField(max_length=20)  # e.g. "001", "002"

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["role", "name"], name="unique_role_section")
        ]


class TeamRoleAssignment(models.Model):
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="team_role_assignments"
    )
    role = models.ForeignKey(Role, on_delete=models.CASCADE, null=True, blank=True)
    section = models.ForeignKey(
        RoleSection, on_delete=models.SET_NULL, null=True, blank=True
    )


class TeamEvent(models.Model):
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="events")
    # Change 'name' or keep it for the event title, but add 'room'
    name = models.CharField(max_length=100)  # e.g., "Weekly Sync" or "Chem 101 Lab"
    room = models.ForeignKey(
        Room, on_delete=models.SET_NULL, null=True, blank=True, related_name="events"
    )
    day = models.CharField(max_length=10)
    start_time = models.TimeField()
    end_time = models.TimeField()

    def __str__(self):
        room_name = self.room.name if self.room else "No Room"
        return f"{self.name} in {room_name} on {self.day}"


class FixedObstruction(models.Model):
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    role = models.ForeignKey(Role, on_delete=models.CASCADE, null=True, blank=True)
    section = models.CharField(
        max_length=20, blank=True, null=True
    )  # None = applies to ALL sections
    name = models.CharField(max_length=100)
    start_time = models.TimeField()
    end_time = models.TimeField()

    def __str__(self):
        return f"{self.name} ({self.role.name if self.role else 'No Role'})"


class ObstructionDay(models.Model):
    DAY_CHOICES = [
        ("sun", "Sunday"),
        ("mon", "Monday"),
        ("tue", "Tuesday"),
        ("wed", "Wednesday"),
        ("thu", "Thursday"),
        ("fri", "Friday"),
        ("sat", "Saturday"),
    ]
    obstruction = models.ForeignKey(
        FixedObstruction, on_delete=models.CASCADE, related_name="days"
    )
    day = models.CharField(max_length=3, choices=DAY_CHOICES)

    def __str__(self):
        return f"{self.obstruction.name} - {self.day}"
