from django.contrib import admin
from .models import AvailabilityRange, Team, Role, Shift, Room, RoomAvailability, TeamRoleAssignment
from .models import ObstructionDay, FixedObstruction
from .models import UserRolePreference, PreferredTime

admin.site.register(AvailabilityRange)
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
