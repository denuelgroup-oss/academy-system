from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Plan
from .serializers import PlanSerializer


class PlanViewSet(viewsets.ModelViewSet):
    queryset = Plan.objects.all()
    serializer_class = PlanSerializer
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ['is_active', 'duration', 'currency', 'plan_type']
    search_fields = ['name', 'description']
    ordering_fields = ['price', 'name', 'created_at']

    @action(detail=False, methods=['get'], url_path='active')
    def active_plans(self, request):
        plans = Plan.objects.filter(is_active=True)
        serializer = self.get_serializer(plans, many=True)
        return Response(serializer.data)
