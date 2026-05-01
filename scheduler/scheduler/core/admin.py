from django.contrib import admin
from .models import UnavailabilityRange, Team, Role, Shift, Room, RoomAvailability, TeamRoleAssignment
from .models import ObstructionDay, FixedObstruction
from .models import UserRolePreference, PreferredTime
from .models import AttendeePreference, AttendeeResponseLink

admin.site.register(UnavailabilityRange)
admin.site.register(Team)
admin.site.register(Role)
admin.site.register(Shift)
admin.site.register(Room)
admin.site.register(RoomAvailability)
admin.site.register(TeamRoleAssignment)
admin.site.register(ObstructionDay)
admin.site.register(FixedObstruction)
admin.site.register(UserRolePreference)
admin.site.register(PreferredTime)
admin.site.register(AttendeePreference)
admin.site.register(AttendeeResponseLink)
