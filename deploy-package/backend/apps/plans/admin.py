from django.contrib import admin
from .models import Plan


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'plan_type', 'price', 'currency', 'duration_value',
        'duration', 'duration_days', 'auto_renew_clients', 'is_active',
    ]
    list_filter = [
        'plan_type', 'is_active', 'duration', 'currency', 'auto_renew_clients',
    ]
    search_fields = ['name', 'description']
