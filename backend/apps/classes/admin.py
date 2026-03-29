from django.contrib import admin
from .models import AcademyClass, ClassSchedule


class ClassScheduleInline(admin.TabularInline):
    model = ClassSchedule
    extra = 1
    fields = ['day_of_week', 'start_time', 'end_time', 'coach', 'location', 'is_active']


@admin.register(AcademyClass)
class AcademyClassAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'center', 'level', 'plans_display', 'coach',
        'max_students', 'student_count', 'is_active',
    ]
    list_filter = ['is_active', 'coach', 'plans']
    search_fields = ['name', 'center', 'level', 'skills', 'plans__name']
    filter_horizontal = ['plans']
    inlines = [ClassScheduleInline]

    def student_count(self, obj):
        return obj.student_count
    student_count.short_description = 'Students'

    def plans_display(self, obj):
        return ', '.join(obj.plans.values_list('name', flat=True)) or '-'
    plans_display.short_description = 'Plans'


@admin.register(ClassSchedule)
class ClassScheduleAdmin(admin.ModelAdmin):
    list_display = ['academy_class', 'day_of_week', 'start_time', 'end_time', 'coach', 'is_active']
    list_filter = ['day_of_week', 'is_active', 'academy_class']
