from rest_framework import serializers
from django.contrib.auth.models import User
from .models import AcademyClass, ClassSchedule
from apps.plans.models import Plan


class CoachSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'full_name']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class ClassScheduleSerializer(serializers.ModelSerializer):
    coach_name = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    class_center = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = ClassSchedule
        fields = '__all__'

    def get_coach_name(self, obj):
        if obj.coach:
            return obj.coach.get_full_name() or obj.coach.username
        return None

    def get_class_name(self, obj):
        return obj.academy_class.name

    def get_class_center(self, obj):
        return obj.academy_class.center or '-'

    def get_student_count(self, obj):
        return obj.academy_class.student_count

    def validate(self, attrs):
        start_time = attrs.get('start_time', getattr(self.instance, 'start_time', None))
        end_time = attrs.get('end_time', getattr(self.instance, 'end_time', None))
        start_date = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end_date = attrs.get('end_date', getattr(self.instance, 'end_date', None))

        if start_time and end_time and end_time <= start_time:
            raise serializers.ValidationError({'end_time': 'End time must be after start time.'})

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({'end_date': 'Up to date must be on or after from date.'})

        return attrs


class AcademyClassSerializer(serializers.ModelSerializer):
    coach_name = serializers.SerializerMethodField()
    plans = serializers.PrimaryKeyRelatedField(
        queryset=Plan.objects.filter(is_active=True),
        many=True,
        required=False
    )
    plan_names = serializers.SerializerMethodField()
    schedules = ClassScheduleSerializer(many=True, read_only=True)
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = AcademyClass
        fields = '__all__'

    def get_coach_name(self, obj):
        if obj.coach:
            return obj.coach.get_full_name() or obj.coach.username
        return None

    def get_plan_names(self, obj):
        return [p.name for p in obj.plans.all()]

    def get_student_count(self, obj):
        return obj.students.filter(status='active').count()


class AcademyClassListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for dropdowns/lists."""
    coach_name = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()
    plan_names = serializers.SerializerMethodField()

    class Meta:
        model = AcademyClass
        fields = ['id', 'name', 'center', 'plans', 'plan_names', 'max_students', 'student_count',
                  'coach', 'coach_name', 'is_active']

    def get_coach_name(self, obj):
        if obj.coach:
            return obj.coach.get_full_name() or obj.coach.username
        return None

    def get_student_count(self, obj):
        return obj.students.filter(status='active').count()

    def get_plan_names(self, obj):
        return [p.name for p in obj.plans.all()]
