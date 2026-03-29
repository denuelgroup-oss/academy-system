from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AcademyClassViewSet, ClassScheduleViewSet

router = DefaultRouter()
router.register(r'schedules', ClassScheduleViewSet, basename='schedule')
router.register(r'', AcademyClassViewSet, basename='class')

urlpatterns = [path('', include(router.urls))]
