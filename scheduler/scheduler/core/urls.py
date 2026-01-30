from django.urls import path
from .views import availability_view, save_availability
from . import views

urlpatterns = [
    path("availability/", availability_view, name="availability"),
    path("api/availability/", save_availability, name="save_availability"),
    path('supervisor/', views.supervisor_dashboard, name='supervisor'),
    #                           -- Supervisor API urls --
    path('api/get-availability/<int:worker_id>/', views.get_worker_availability, name='get_avail'),
    path('api/save-schedule/', views.save_schedule, name='save_schedule'),
]
