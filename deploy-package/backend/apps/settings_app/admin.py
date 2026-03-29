from django.contrib import admin
from .models import SystemSetting, Currency, ExchangeRate


@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    list_display = ['key', 'value', 'updated_at']
    search_fields = ['key']


@admin.register(Currency)
class CurrencyAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'symbol', 'is_base', 'is_active']
    list_filter = ['is_base', 'is_active']


@admin.register(ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    list_display = ['from_currency', 'to_currency', 'rate', 'effective_date', 'is_active']
    list_filter = ['is_active', 'from_currency', 'to_currency']
    date_hierarchy = 'effective_date'
