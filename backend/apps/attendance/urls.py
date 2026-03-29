from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClientAttendanceViewSet

router = DefaultRouter()
router.register(r'', ClientAttendanceViewSet, basename='attendance')

urlpatterns = [path('', include(router.urls))]
