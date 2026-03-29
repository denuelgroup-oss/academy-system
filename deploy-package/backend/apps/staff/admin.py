from django.contrib import admin
from .models import StaffAttendance, Salary


@admin.register(StaffAttendance)
class StaffAttendanceAdmin(admin.ModelAdmin):
    list_display = ['staff', 'date', 'status', 'check_in', 'check_out']
    list_filter = ['status', 'date']
    search_fields = ['staff__first_name', 'staff__last_name', 'staff__username']
    date_hierarchy = 'date'


@admin.register(Salary)
class SalaryAdmin(admin.ModelAdmin):
    list_display = ['staff', 'month', 'year', 'base_amount', 'bonus', 'deductions',
                    'total_amount', 'currency', 'status']
    list_filter = ['status', 'year', 'month', 'currency']
    search_fields = ['staff__first_name', 'staff__last_name']
    readonly_fields = ['total_amount']
