"""
models.py

Table layouts for different key objects necesarry for
the Coorda web-app
"""

from django.db import models
from django.contrib.auth.models import User
import uuid

DAY_CHOICES = [
        ("sun", "Sunday"),
        ("mon", "Monday"),
        ("tue", "Tuesday"),
        ("wed", "Wednesday"),
        ("thu", "Thursday"),
        ("fri", "Friday"),
        ("sat", "Saturday"),
]

class Team(models.Model):
    '''
    Table for Team objects that are the backbone of the app. Each team
    has related workers, roles, shifts, etc.
    '''
    
    # unique id
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # name for team
    name = models.CharField(max_length=100)
    
    # the user who owns it -- needs to be extended to have multiple owners
    owner = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="owned_teams"
    )
    
    # users that are part of the team
    members = models.ManyToManyField(User, related_name="joined_teams", blank=True)
    
    # how a member can join a team
    join_code = models.CharField(max_length=36, unique=True, default=uuid.uuid4)
    
    def __str__(self):
        return self.name


class Room(models.Model):
    '''
    Table for Room objects where scheduled events my be placed
    '''
    
    # unique id
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # name of the room
    name = models.CharField(max_length=100)
    
    # the team it is associated with -- delete room if team is deleted
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="rooms")
    
    # how many people can be scheduled in this room at once
    capacity = models.PositiveIntegerField(default=1)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["team", "name"], name="uniq_room_per_team")
        ]

    def __str__(self):
        return self.name

class Role(models.Model):
    '''
    Roles a team may have to assign their workers to
    '''
    
    # identifier for a role
    id = models.BigAutoField(primary_key=True)
    
    # the name of the role
    name = models.CharField(max_length=50)
    
    # team it is associated with
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="roles")
    
    # can use when showing the schedules
    color = models.CharField(max_length=7, default="#007bff")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["team", "name"], name="uniq_role_name_per_team"
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.team.name})"

class UserRolePreference(models.Model):
    '''
    FIX: NOT YET IMPLEMETNED
    '''
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    roles = models.ManyToManyField(Role, blank=True)

    class Meta:
        unique_together = ("user", "team")

    def __str__(self):
        return f"{self.user.username} Roles for {self.team.name}"


class Schedule(models.Model):
    '''
    Overall schedule for the workers
    '''
    
    # team the schedule is associated with
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="schedules")
    
    # name of scedhule
    name = models.CharField(max_length=100, default="Default")
    
    # when it was created
    created_at = models.DateTimeField(auto_now_add=True)
    
    # allows to have draft schedules
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
    '''
    A shift object to be placed on a schedule
    '''
    
    # the schedule the shift is for -- can access team from here
    schedule = models.ForeignKey(
        Schedule, on_delete=models.CASCADE, related_name="shifts"
    )

    # who the shif tis for
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="shifts")
    
    # what role the shift is for
    role = models.ForeignKey(
        Role, on_delete=models.SET_NULL, null=True, blank=True, related_name="shifts"
    )
    
    # where the shift is held
    room = models.ForeignKey(
        Room, on_delete=models.SET_NULL, null=True, blank=True, related_name="shifts"
    )
    
    # the day the shift is FIX: maybe not char field
    day = models.CharField(max_length=3, choices=DAY_CHOICES)
    
    # length of shift
    start_time = models.TimeField()
    end_time = models.TimeField()

    def __str__(self):
        return f"{self.user.username} - {self.role} ({self.day})"


class RoleSection(models.Model):
    '''
    A role may have sections -- allows for same role in different sections
    '''
    
    # role it is associated with
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="sections")
    
    # name of section
    name = models.CharField(max_length=20)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["role", "name"], name="unique_role_section")
        ]


class TeamRoleAssignment(models.Model):
    '''
    Assignment of a person to a role -- its own object because one user may be
    on multiple teams with different roles.
    '''
    
    # team and user it is associated with
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="team_role_assignments"
    )

    # the role and sections of the assignment
    role = models.ForeignKey(Role, on_delete=models.CASCADE, null=True, blank=True)
    section = models.ForeignKey(
        RoleSection, on_delete=models.SET_NULL, null=True, blank=True
    )


class TeamEvent(models.Model):
    '''
    FIX: not yet implemented I don't think
    '''
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="events")

    name = models.CharField(max_length=100)
    room = models.ForeignKey(
        Room, on_delete=models.SET_NULL, null=True, blank=True, related_name="events"
    )
    day = models.CharField(max_length=3, choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()

    def __str__(self):
        room_name = self.room.name if self.room else "No Room"
        return f"{self.name} in {room_name} on {self.day}"


class FixedObstruction(models.Model):
    '''
    Certain events that may prevent workers from being scheduled during
    '''
    
    # the associated team and role/section
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    role = models.ForeignKey(Role, on_delete=models.CASCADE, null=True, blank=True)
    section = models.CharField(max_length=20, blank=True, null=True)
    
    # name of obstruction and length
    name = models.CharField(max_length=100)
    start_time = models.TimeField()
    end_time = models.TimeField()

    def __str__(self):
        return f"{self.name} ({self.role.name if self.role else 'No Role'})"


class ObstructionDay(models.Model):
    '''
    When an obstruction is
    '''
    # limited choice for days
    day = models.CharField(max_length=3, choices=DAY_CHOICES)
    
    # obstruction it is associated with
    obstruction = models.ForeignKey(
        FixedObstruction, on_delete=models.CASCADE, related_name="days"
    )

    def __str__(self):
        return f"{self.obstruction.name} - {self.day}"

class RoomAvailability(models.Model):
    '''
    Table for when rooms are actually available
    '''
    
    # the room it is associated with
    room = models.ForeignKey(
        Room, on_delete=models.CASCADE, related_name="availability_slots"
    )
    
    # the day it is free -- FIX: maybe not use CharField?
    day = models.CharField(max_length=3, choices=DAY_CHOICES)
    
    # when the room is available to use
    start_time = models.TimeField()
    end_time = models.TimeField()

    def __str__(self):
        return f"{self.room.name} ({self.day}): {self.start_time}-{self.end_time}"

class AvailabilityRange(models.Model):
    '''
    Similar to room availabilty just for when users are busy
    
    FIX: lets refactor this
    '''
    
    # who the time is associated with and for which team
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    
    # what day it is FIX: maybe not charfield
    day = models.CharField(max_length=3, choices=DAY_CHOICES)
    
    # how long it they're busy for
    start_time = models.TimeField()
    end_time = models.TimeField()
    
    # where and what they are doing at this time
    building = models.CharField(max_length=100, blank=True)
    eventName = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"{self.user.username}: {self.day} {self.start_time}-{self.end_time}"
