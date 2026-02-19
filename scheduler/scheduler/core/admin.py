from django.contrib import admin
from .models import AvailabilityRange, Team, Role, Shift, Room, RoomAvailability

admin.site.register(AvailabilityRange)
admin.site.register(Team)
admin.site.register(Role)
admin.site.register(Shift)
admin.site.register(Room)
admin.site.register(RoomAvailability)