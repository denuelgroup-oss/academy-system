from django.contrib import admin
from .models import Client


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'phone', 'email', 'plan', 'academy_class',
                    'subscription_end', 'auto_renew', 'status']
    list_filter = ['status', 'plan', 'one_time_plans', 'academy_class', 'gender', 'auto_renew']
    search_fields = ['first_name', 'last_name', 'phone', 'email']
    date_hierarchy = 'enrollment_date'
    fieldsets = (
        ('Personal Information', {
            'fields': ('first_name', 'last_name', 'date_of_birth', 'gender',
                       'phone', 'email', 'address', 'photo')
        }),
        ('Emergency Contact', {
            'fields': ('emergency_contact', 'emergency_phone')
        }),
        ('Academy Information', {
            'fields': ('plan', 'one_time_plans', 'academy_class', 'enrollment_date',
                       'subscription_start', 'subscription_end', 'auto_renew', 'status', 'notes')
        }),
    )
