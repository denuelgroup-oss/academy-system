from rest_framework import serializers
from .models import Invoice, Payment
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone


class PaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    invoice_status = serializers.CharField(source='invoice.status', read_only=True)
    client_name = serializers.SerializerMethodField()
    client_id = serializers.IntegerField(source='invoice.client_id', read_only=True)
    reference_number = serializers.CharField(source='reference', required=False, allow_blank=True)

    class Meta:
        model = Payment
        fields = '__all__'

    def validate(self, attrs):
        invoice = attrs.get('invoice') or getattr(self.instance, 'invoice', None)
        amount = attrs.get('amount', getattr(self.instance, 'amount', None))

        if not invoice:
            return attrs

        if invoice.status in ('paid', 'cancelled'):
            raise serializers.ValidationError({'invoice': 'This invoice cannot receive additional payments.'})

        if amount is not None:
            paid_already = invoice.amount_paid
            if self.instance:
                paid_already = paid_already - self.instance.amount
            amount_due = invoice.total_amount - paid_already
            if Decimal(str(amount)) > amount_due:
                raise serializers.ValidationError({
                    'amount': f'Payment amount cannot exceed remaining balance ({amount_due}).'
                })

        return attrs

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

    ONE_TIME_RECHARGE_COOLDOWN_DAYS = 180

    def validate(self, attrs):
        client = attrs.get('client') or getattr(self.instance, 'client', None)
        plan = attrs.get('plan') or getattr(self.instance, 'plan', None)

        if client and plan and getattr(plan, 'plan_type', '') == 'one_time':
            existing = Invoice.objects.filter(client=client, plan=plan).exclude(status='cancelled')
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)

            open_invoice_exists = existing.filter(status__in=['draft', 'sent', 'partial', 'overdue']).exists()
            if open_invoice_exists:
                raise serializers.ValidationError({
                    'plan': 'This one-time plan already has an open invoice for this client.'
                })

            last_paid = existing.filter(status='paid').order_by('-due_date', '-issue_date', '-id').first()
            if last_paid:
                paid_ref_date = last_paid.due_date or last_paid.issue_date
                if paid_ref_date:
                    cutoff = timezone.now().date() - timedelta(days=self.ONE_TIME_RECHARGE_COOLDOWN_DAYS)
                    if paid_ref_date > cutoff:
                        next_allowed = paid_ref_date + timedelta(days=self.ONE_TIME_RECHARGE_COOLDOWN_DAYS)
                        raise serializers.ValidationError({
                            'plan': f'This one-time plan was already paid recently. It can be charged again after {next_allowed}.'
                        })

        return attrs

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
