from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StaffAttendanceViewSet, SalaryViewSet

router = DefaultRouter()
router.register(r'attendance', StaffAttendanceViewSet, basename='staff-attendance')
router.register(r'salary', SalaryViewSet, basename='salary')

urlpatterns = [path('', include(router.urls))]
