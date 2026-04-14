from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
from .models import Client
from apps.plans.serializers import PlanSerializer
from apps.classes.serializers import AcademyClassListSerializer
from apps.sales.models import Invoice


class ClientSerializer(serializers.ModelSerializer):
    ONE_TIME_RECHARGE_COOLDOWN_DAYS = 180

    plan_detail = PlanSerializer(source='plan', read_only=True)
    class_detail = AcademyClassListSerializer(source='academy_class', read_only=True)
    full_name = serializers.CharField(read_only=True)
    is_subscription_expired = serializers.BooleanField(read_only=True)
    days_until_expiry = serializers.IntegerField(read_only=True)

    class Meta:
        model = Client
        fields = '__all__'

    def validate(self, attrs):
        attrs = super().validate(attrs)

        plan = attrs.get('plan', getattr(self.instance, 'plan', None))
        one_time_plans = attrs.get('one_time_plans', None)

        if plan and plan.plan_type == 'one_time':
            raise serializers.ValidationError({'plan': 'Only subscription plans are allowed in Plan.'})

        if one_time_plans is not None:
            invalid_one_time = [p.name for p in one_time_plans if p.plan_type != 'one_time']
            if invalid_one_time:
                raise serializers.ValidationError({
                    'one_time_plans': f"These plans are not one-time plans: {', '.join(invalid_one_time)}"
                })

        return attrs

    def _create_subscription_invoice(self, client):
        """Create an invoice when a subscription is assigned/changed."""
        plan = client.plan
        if not plan or plan.plan_type == 'one_time':
            return

        issue_date = timezone.now().date()
        due_date = client.subscription_end or issue_date

        # Safety net: avoid duplicate invoices for the same subscription cycle.
        duplicate_exists = Invoice.objects.exclude(status='cancelled').filter(
            client=client,
            plan=plan,
            issue_date=issue_date,
            due_date=due_date,
            amount=plan.price,
            currency=plan.currency,
        ).exists()
        if duplicate_exists:
            return

        Invoice.objects.create(
            client=client,
            plan=plan,
            amount=plan.price,
            currency=plan.currency,
            issue_date=issue_date,
            due_date=due_date,
            status='sent',
        )

    def _create_one_time_invoice(self, client, plan):
        """Create a dedicated invoice for a one-time plan assignment when eligible."""
        if not plan or plan.plan_type != 'one_time':
            return

        existing = Invoice.objects.exclude(status='cancelled').filter(client=client, plan=plan)
        if existing.filter(status__in=['draft', 'sent', 'partial', 'overdue']).exists():
            return

        last_paid = existing.filter(status='paid').order_by('-due_date', '-issue_date', '-id').first()
        if last_paid:
            paid_ref_date = last_paid.due_date or last_paid.issue_date
            if paid_ref_date:
                cutoff = timezone.now().date() - timedelta(days=self.ONE_TIME_RECHARGE_COOLDOWN_DAYS)
                if paid_ref_date > cutoff:
                    return

        issue_date = timezone.now().date()
        due_date = issue_date + timedelta(days=7)
        Invoice.objects.create(
            client=client,
            plan=plan,
            amount=plan.price,
            currency=plan.currency,
            issue_date=issue_date,
            due_date=due_date,
            status='sent',
            notes=f'One-time plan invoice - {plan.name}',
        )

    def create(self, validated_data):
        client = super().create(validated_data)
        if client.plan:
            self._create_subscription_invoice(client)
        for plan in client.one_time_plans.all():
            self._create_one_time_invoice(client, plan)
        return client

    def update(self, instance, validated_data):
        old_plan_id = instance.plan_id
        old_start = instance.subscription_start
        old_end = instance.subscription_end
        old_one_time_ids = set(instance.one_time_plans.values_list('id', flat=True))

        client = super().update(instance, validated_data)

        new_one_time_plans = list(client.one_time_plans.all())
        new_one_time_ids = {p.id for p in new_one_time_plans}
        added_one_time_ids = new_one_time_ids - old_one_time_ids
        for plan in new_one_time_plans:
            if plan.id in added_one_time_ids:
                self._create_one_time_invoice(client, plan)

        if not client.plan:
            return client

        subscription_changed = (
            old_plan_id != client.plan_id
            or old_start != client.subscription_start
            or old_end != client.subscription_end
        )

        has_subscription_invoice = client.invoices.exclude(status='cancelled').filter(
            plan__isnull=False,
            plan__plan_type='subscription',
        ).exists()
        if subscription_changed or not has_subscription_invoice:
            self._create_subscription_invoice(client)

        return client


class ClientListSerializer(serializers.ModelSerializer):
    """Lightweight for tables."""
    plan_name = serializers.SerializerMethodField()
    one_time_plan_names = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    full_name = serializers.CharField(read_only=True)
    days_until_expiry = serializers.IntegerField(read_only=True)

    class Meta:
        model = Client
        fields = ['id', 'full_name', 'first_name', 'last_name', 'phone', 'email',
                  'plan', 'plan_name', 'one_time_plans', 'one_time_plan_names',
                  'academy_class', 'class_name',
                  'subscription_start', 'subscription_end', 'auto_renew', 'status',
                  'enrollment_date', 'days_until_expiry']

    def get_plan_name(self, obj):
        return obj.plan.name if obj.plan else None

    def get_class_name(self, obj):
        return obj.academy_class.name if obj.academy_class else None

    def get_one_time_plan_names(self, obj):
        return [p.name for p in obj.one_time_plans.all()]
