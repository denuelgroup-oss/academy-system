from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import AcademyClass, ClassSchedule
from .serializers import AcademyClassSerializer, AcademyClassListSerializer, ClassScheduleSerializer


class AcademyClassViewSet(viewsets.ModelViewSet):
    queryset = AcademyClass.objects.select_related('coach').prefetch_related('schedules', 'plans').all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'coach', 'plans']
    search_fields = ['name', 'description', 'plans__name']
    ordering_fields = ['name', 'created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return AcademyClassListSerializer
        return AcademyClassSerializer

    @action(detail=False, methods=['get'], url_path='active')
    def active_classes(self, request):
        classes = AcademyClass.objects.filter(is_active=True)
        plan_id = request.query_params.get('plan')
        if plan_id:
            classes = classes.filter(plans__id=plan_id)
        serializer = AcademyClassListSerializer(classes, many=True)
        return Response(serializer.data)


class ClassScheduleViewSet(viewsets.ModelViewSet):
    queryset = ClassSchedule.objects.select_related('academy_class', 'coach').all()
    serializer_class = ClassScheduleSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = [
        'academy_class', 'coach', 'day_of_week', 'is_active',
        'start_date', 'end_date', 'academy_class__center',
    ]
    search_fields = ['academy_class__name', 'location']
    ordering_fields = ['day_of_week', 'start_time', 'start_date', 'end_date']
