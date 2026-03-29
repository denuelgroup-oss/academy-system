from django.utils import timezone
from django.db.models import Sum
from datetime import date, timedelta
from calendar import monthrange
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Client
from .serializers import ClientSerializer, ClientListSerializer
from apps.sales.models import Payment
from apps.sales.models import Invoice
from apps.attendance.models import ClientAttendance


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.select_related('plan', 'academy_class').prefetch_related('one_time_plans').all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'plan', 'one_time_plans', 'academy_class', 'gender']
    search_fields = ['first_name', 'last_name', 'phone', 'email']
    ordering_fields = ['last_name', 'first_name', 'enrollment_date', 'subscription_end']

    @staticmethod
    def _add_plan_duration(start_date, plan):
        """Calendar-accurate period extension based on plan duration settings."""
        value = max(1, int(plan.duration_value or 1))
        if plan.duration == 'day':
            return start_date + timedelta(days=value)
        if plan.duration == 'week':
            return start_date + timedelta(weeks=value)
        if plan.duration == 'year':
            try:
                return start_date.replace(year=start_date.year + value)
            except ValueError:
                # Leap-day fallback to Feb 28.
                return start_date.replace(month=2, day=28, year=start_date.year + value)

        # Month-based extension (default): preserve day when possible.
        month_index = (start_date.month - 1) + value
        year = start_date.year + (month_index // 12)
        month = (month_index % 12) + 1
        day = min(start_date.day, monthrange(year, month)[1])
        return date(year, month, day)

    @staticmethod
    def _next_monthly_period(anchor_date, months=1):
        """Return next calendar-month period [start, end] after anchor_date."""
        next_month = 1 if anchor_date.month == 12 else anchor_date.month + 1
        next_year = anchor_date.year + 1 if anchor_date.month == 12 else anchor_date.year
        start = date(next_year, next_month, 1)

        end_month_index = (start.month - 1) + max(1, int(months))
        end_year = start.year + (end_month_index // 12)
        end_month = (end_month_index % 12) + 1
        end_day = monthrange(end_year, end_month)[1]
        end = date(end_year, end_month, end_day)
        return start, end

    @staticmethod
    def _create_auto_renew_invoice(client, plan, today):
        duplicate_exists = Invoice.objects.exclude(status='cancelled').filter(
            client=client,
            plan=plan,
            issue_date=today,
            due_date=client.subscription_end,
            amount=plan.price,
            currency=plan.currency,
        ).exists()
        if duplicate_exists:
            return False

        Invoice.objects.create(
            client=client,
            plan=plan,
            amount=plan.price,
            currency=plan.currency,
            issue_date=today,
            due_date=client.subscription_end,
            status='sent',
            notes='Automatic renewal invoice',
        )
        return True

    def get_serializer_class(self):
        if self.action == 'list':
            return ClientListSerializer
        return ClientSerializer

    @action(detail=False, methods=['get'], url_path='expiring-soon')
    def expiring_soon(self, request):
        """Clients whose subscription expires in 30 days or less."""
        days = int(request.query_params.get('days', 30))
        today = timezone.now().date()
        threshold = today + timezone.timedelta(days=days)
        clients = self.get_queryset().filter(
            subscription_end__lte=threshold,
            subscription_end__gte=today,
            status='active',
        )
        serializer = ClientListSerializer(clients, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='expired')
    def expired(self, request):
        today = timezone.now().date()
        clients = self.get_queryset().filter(subscription_end__lt=today)
        serializer = ClientListSerializer(clients, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='refresh-statuses')
    def refresh_statuses(self, request):
        """Bulk refresh statuses and run date-based auto-renew for eligible clients."""
        today = timezone.now().date()

        auto_candidates = Client.objects.select_related('plan').filter(
            auto_renew=True,
            plan__isnull=False,
            plan__plan_type='subscription',
            subscription_end__lte=today,
        )

        auto_renewed = 0
        auto_invoices = 0
        for client in auto_candidates:
            anchor = client.subscription_end or today
            if client.plan.duration == 'month':
                start_date, new_end = self._next_monthly_period(anchor, client.plan.duration_value)
            else:
                start_date = anchor
                new_end = self._add_plan_duration(start_date, client.plan)
            client.subscription_start = start_date
            client.subscription_end = new_end
            client.status = 'active'
            client.save(update_fields=['subscription_start', 'subscription_end', 'status', 'updated_at'])
            auto_renewed += 1
            if self._create_auto_renew_invoice(client, client.plan, today):
                auto_invoices += 1

        expired_updated = Client.objects.filter(
            subscription_end__lt=today,
            status='active',
        ).update(status='expired')

        return Response({
            'updated': expired_updated,
            'auto_renewed': auto_renewed,
            'auto_invoices': auto_invoices,
        })

    @action(detail=True, methods=['get'], url_path='overview')
    def overview(self, request, pk=None):
        client = self.get_object()
        today = timezone.now().date()

        invoices = list(client.invoices.exclude(status='cancelled').select_related('plan').order_by('-issue_date', '-id'))
        pending_total = sum(float(inv.amount_due) for inv in invoices if inv.status != 'paid')
        paid_total = Payment.objects.filter(invoice__client=client).aggregate(total=Sum('amount')).get('total') or 0

        attendance_qs = ClientAttendance.objects.filter(client=client)
        total_sessions = attendance_qs.count()
        present_sessions = attendance_qs.filter(status='present').count()
        attendance_rate = round((present_sessions / total_sessions) * 100, 1) if total_sessions else 0.0

        if attendance_rate >= 90:
            performance = 'Excellent'
        elif attendance_rate >= 75:
            performance = 'Good'
        elif attendance_rate >= 60:
            performance = 'Average'
        else:
            performance = 'Needs Improvement'

        abonnement = {
            'plan': client.plan.name if client.plan else '-',
            'start': client.subscription_start,
            'end': client.subscription_end,
            'status': client.status,
        }

        latest_invoice = invoices[0] if invoices else None
        payment_status = 'Paid' if latest_invoice and latest_invoice.status == 'paid' else 'Unpaid'
        plan_fee = '-'
        if client.plan:
            plan_fee = f"{round(float(client.plan.price), 2)} {client.plan.currency}"

        absent_sessions = max(total_sessions - present_sessions, 0)
        abonnement_row = {
            'invoice_id': latest_invoice.id if latest_invoice else None,
            'abonnement': client.plan.name if client.plan else '-',
            'classe_vacation': client.academy_class.name if client.academy_class else '-',
            'invoice_no': latest_invoice.invoice_number if latest_invoice else '-',
            'due_date': str(client.subscription_end) if client.subscription_end else (str(latest_invoice.due_date) if latest_invoice else '-'),
            'attendance': f"{present_sessions}/{absent_sessions}",
            'fees': plan_fee,
            'status': payment_status,
            'period_start': str(client.subscription_start) if client.subscription_start else '-',
            'period_end': str(client.subscription_end) if client.subscription_end else '-',
        }

        status_label = {'paid': 'Paid', 'partial': 'Partial', 'overdue': 'Overdue', 'sent': 'Sent', 'draft': 'Draft'}

        def invoice_to_row(inv):
            return {
                'invoice_id': inv.id,
                'abonnement': (inv.plan.name if inv.plan else None) or (client.plan.name if client.plan else '-'),
                'classe_vacation': client.academy_class.name if client.academy_class else '-',
                'invoice_no': inv.invoice_number,
                'due_date': str(inv.due_date) if inv.due_date else '-',
                'attendance': '-',
                'fees': f"{round(float(inv.total_amount), 2)} {inv.currency}",
                'status': status_label.get(inv.status, 'Unpaid'),
                'period_start': str(inv.issue_date) if inv.issue_date else '-',
                'period_end': str(inv.due_date) if inv.due_date else '-',
            }

        past_rows = []
        upcoming_rows = []
        for inv in invoices:
            if latest_invoice and inv.id == latest_invoice.id:
                continue
            if inv.due_date and inv.due_date >= today and inv.status not in ('paid', 'overdue', 'cancelled'):
                upcoming_rows.append(invoice_to_row(inv))
            else:
                past_rows.append(invoice_to_row(inv))

        return Response({
            'abonnement': abonnement,
            'abonnement_row': abonnement_row,
            'past_rows': past_rows,
            'upcoming_rows': upcoming_rows,
            'pending': round(float(pending_total), 2),
            'paid': round(float(paid_total), 2),
            'items_count': len(invoices),
            'plan_name': client.plan.name if client.plan else '-',
            'attendance': {
                'present': present_sessions,
                'total': total_sessions,
                'rate': attendance_rate,
            },
            'performance': performance,
        })
