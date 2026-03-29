from django.contrib import admin
from .models import ClientAttendance


@admin.register(ClientAttendance)
class ClientAttendanceAdmin(admin.ModelAdmin):
    list_display = ['client', 'academy_class', 'date', 'status', 'marked_by']
    list_filter = ['status', 'date', 'academy_class']
    search_fields = ['client__first_name', 'client__last_name']
    date_hierarchy = 'date'
