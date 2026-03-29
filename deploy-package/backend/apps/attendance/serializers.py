from rest_framework import serializers
from .models import ClientAttendance
from apps.clients.serializers import ClientListSerializer


class ClientAttendanceSerializer(serializers.ModelSerializer):
    client_name = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()

    class Meta:
        model = ClientAttendance
        fields = '__all__'

    def get_client_name(self, obj):
        return str(obj.client)

    def get_class_name(self, obj):
        return obj.academy_class.name if obj.academy_class else None


class BulkAttendanceSerializer(serializers.Serializer):
    """For bulk attendance marking."""
    date = serializers.DateField()
    academy_class = serializers.IntegerField(required=False, allow_null=True)
    class_schedule = serializers.IntegerField(required=False, allow_null=True)
    records = serializers.ListField(
        child=serializers.DictField(),
        help_text='[{"client_id": 1, "status": "present", "notes": ""}]'
    )
