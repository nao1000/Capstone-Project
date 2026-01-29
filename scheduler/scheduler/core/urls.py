from django.urls import path
from .views import availability_view, save_availability

urlpatterns = [
    path("availability/", availability_view, name="availability"),
    path("api/availability/", save_availability, name="save_availability"),
]
