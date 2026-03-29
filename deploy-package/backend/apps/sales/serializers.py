from rest_framework import serializers
from .models import Invoice, Payment


class PaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    invoice_status = serializers.CharField(source='invoice.status', read_only=True)
    client_name = serializers.SerializerMethodField()
    client_id = serializers.IntegerField(source='invoice.client_id', read_only=True)
    reference_number = serializers.CharField(source='reference', required=False, allow_blank=True)

    class Meta:
        model = Payment
        fields = '__all__'

    def get_client_name(self, obj):
        return str(obj.invoice.client)


class InvoiceSerializer(serializers.ModelSerializer):
    payments = PaymentSerializer(many=True, read_only=True)
    client_name = serializers.SerializerMethodField()
    plan_name = serializers.SerializerMethodField()
    amount_paid = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    amount_due = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Invoice
        fields = '__all__'
        read_only_fields = ['tax_amount', 'total_amount']

    def get_client_name(self, obj):
        return str(obj.client)

    def get_plan_name(self, obj):
        return obj.plan.name if obj.plan else None


class InvoiceListSerializer(serializers.ModelSerializer):
    """Lightweight for tables."""
    client_name = serializers.SerializerMethodField()
    plan_name = serializers.SerializerMethodField()
    amount_paid = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    amount_due = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Invoice
        fields = ['id', 'invoice_number', 'client', 'client_name', 'plan', 'plan_name',
                  'amount', 'tax_amount', 'total_amount', 'currency',
                  'issue_date', 'due_date', 'status', 'amount_paid', 'amount_due']

    def get_client_name(self, obj):
        return str(obj.client)

    def get_plan_name(self, obj):
        return obj.plan.name if obj.plan else None
