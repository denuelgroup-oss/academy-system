from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import SystemSetting, Currency, ExchangeRate
from .serializers import SystemSettingSerializer, CurrencySerializer, ExchangeRateSerializer


class SystemSettingViewSet(viewsets.ModelViewSet):
    queryset = SystemSetting.objects.all()
    serializer_class = SystemSettingSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['key', 'value']


class CurrencyViewSet(viewsets.ModelViewSet):
    queryset = Currency.objects.all()
    serializer_class = CurrencySerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_active', 'is_base']
    search_fields = ['code', 'name']


class ExchangeRateViewSet(viewsets.ModelViewSet):
    queryset = ExchangeRate.objects.select_related('from_currency', 'to_currency').all()
    serializer_class = ExchangeRateSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['from_currency', 'to_currency', 'is_active']
    ordering_fields = ['effective_date']
