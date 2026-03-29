from django.contrib.auth.models import User
from rest_framework import serializers
from .models import StaffAttendance, Salary
from apps.authentication.serializers import UserSerializer


class StaffAttendanceSerializer(serializers.ModelSerializer):
    staff_name = serializers.SerializerMethodField()

    class Meta:
        model = StaffAttendance
        fields = '__all__'

    def get_staff_name(self, obj):
        return obj.staff.get_full_name() or obj.staff.username


class SalarySerializer(serializers.ModelSerializer):
    staff_name = serializers.SerializerMethodField()
    month_display = serializers.SerializerMethodField()

    class Meta:
        model = Salary
        fields = '__all__'
        read_only_fields = ['total_amount']

    def get_staff_name(self, obj):
        return obj.staff.get_full_name() or obj.staff.username

    def get_month_display(self, obj):
        return obj.get_month_display()
