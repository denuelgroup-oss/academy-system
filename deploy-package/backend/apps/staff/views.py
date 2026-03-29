from django.contrib.auth.models import User
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import StaffAttendance, Salary
from .serializers import StaffAttendanceSerializer, SalarySerializer
from apps.authentication.serializers import UserSerializer


class StaffAttendanceViewSet(viewsets.ModelViewSet):
    queryset = StaffAttendance.objects.select_related('staff').all()
    serializer_class = StaffAttendanceSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['date', 'status', 'staff']
    search_fields = ['staff__first_name', 'staff__last_name', 'staff__username']
    ordering_fields = ['date', 'status']

    @action(detail=False, methods=['get'], url_path='by-date')
    def by_date(self, request):
        date = request.query_params.get('date')
        if not date:
            from django.utils import timezone
            date = timezone.now().date().isoformat()
        records = self.get_queryset().filter(date=date)
        serializer = self.get_serializer(records, many=True)
        return Response(serializer.data)


class SalaryViewSet(viewsets.ModelViewSet):
    queryset = Salary.objects.select_related('staff').all()
    serializer_class = SalarySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['month', 'year', 'status', 'staff']
    search_fields = ['staff__first_name', 'staff__last_name']
    ordering_fields = ['year', 'month', 'total_amount']

    @action(detail=False, methods=['get'], url_path='pending')
    def pending(self, request):
        pending = self.get_queryset().filter(status='pending')
        serializer = self.get_serializer(pending, many=True)
        return Response(serializer.data)
