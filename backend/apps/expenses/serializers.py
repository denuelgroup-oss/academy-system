from rest_framework import serializers
from .models import Expense


class ExpenseSerializer(serializers.ModelSerializer):
    category_display = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = '__all__'
        read_only_fields = ['amount_base']

    def get_category_display(self, obj):
        return obj.get_category_display()
