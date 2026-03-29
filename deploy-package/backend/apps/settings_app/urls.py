from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SystemSettingViewSet, CurrencyViewSet, ExchangeRateViewSet

router = DefaultRouter()
router.register(r'system', SystemSettingViewSet, basename='system-setting')
router.register(r'currencies', CurrencyViewSet, basename='currency')
router.register(r'exchange-rates', ExchangeRateViewSet, basename='exchange-rate')

urlpatterns = [path('', include(router.urls))]
