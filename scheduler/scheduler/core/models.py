# core/models.py
from django.db import models
from django.contrib.auth.models import User

class AvailabilityRange(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    day = models.CharField(max_length=5)  # mon, tues, wed...
    start_time = models.TimeField()
    end_time = models.TimeField()

    def __str__(self):
        return f"{self.user.username} {self.day} {self.start_time}-{self.end_time}"
