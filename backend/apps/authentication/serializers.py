from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['role', 'phone', 'address', 'hire_date', 'salary_base', 'currency',
                  'is_active', 'photo']


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'full_name',
                  'is_staff', 'is_active', 'date_joined', 'profile']
        read_only_fields = ['date_joined']

    def get_full_name(self, obj):
        return obj.get_full_name()


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.CharField(write_only=True, default='staff')
    phone = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password', 'role', 'phone']

    def create(self, validated_data):
        role = validated_data.pop('role', 'staff')
        phone = validated_data.pop('phone', '')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        user.profile.role = role
        user.profile.phone = phone
        user.profile.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    role = serializers.CharField(write_only=True, required=False)
    phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    salary_base = serializers.DecimalField(
        max_digits=10, decimal_places=2, write_only=True, required=False
    )
    hire_date = serializers.DateField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = User
        fields = ['email', 'first_name', 'last_name', 'is_active', 'role', 'phone',
                  'salary_base', 'hire_date']

    def update(self, instance, validated_data):
        role = validated_data.pop('role', None)
        phone = validated_data.pop('phone', None)
        salary_base = validated_data.pop('salary_base', None)
        hire_date = validated_data.pop('hire_date', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        profile = instance.profile
        if role is not None:
            profile.role = role
        if phone is not None:
            profile.phone = phone
        if salary_base is not None:
            profile.salary_base = salary_base
        if hire_date is not None:
            profile.hire_date = hire_date
        profile.save()
        return instance


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        profile = getattr(user, 'profile', None)
        data['user'] = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'full_name': user.get_full_name(),
            'role': profile.role if profile else 'staff',
            'is_staff': user.is_staff,
        }
        return data
