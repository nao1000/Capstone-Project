from django.contrib import admin
from .models import AvailabilityRange, Team, Role, Shift

admin.site.register(AvailabilityRange)
admin.site.register(Team)
admin.site.register(Role)
admin.site.register(Shift)
