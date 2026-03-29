from rest_framework import serializers
from .models import Plan


class PlanSerializer(serializers.ModelSerializer):
    features_list = serializers.SerializerMethodField()
    client_count = serializers.SerializerMethodField()

    class Meta:
        model = Plan
        fields = '__all__'

    def get_features_list(self, obj):
        return obj.get_features_list()

    def get_client_count(self, obj):
        return obj.clients.filter(status='active').count()
