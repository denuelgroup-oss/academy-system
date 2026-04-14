from django.utils import timezone
from django.db.models import Q, Sum
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
    def _previous_period_from_current(current_start, duration, value):
        value = max(1, int(value or 1))
        previous_end = current_start - timedelta(days=1)

        if duration == 'month':
            current_month_start = current_start.replace(day=1)
            previous_end = current_month_start - timedelta(days=1)
            month_index = (current_month_start.month - 1) - value
            year = current_month_start.year + (month_index // 12)
            month = (month_index % 12) + 1
            previous_start = date(year, month, 1)
            return previous_start, previous_end

        if duration == 'day':
            previous_start = current_start - timedelta(days=value)
        elif duration == 'week':
            previous_start = current_start - timedelta(days=value * 7)
        elif duration == 'year':
            try:
                previous_start = current_start.replace(year=current_start.year - value)
            except ValueError:
                previous_start = current_start.replace(month=2, day=28, year=current_start.year - value)
        else:
            month_index = (current_start.month - 1) - value
            year = current_start.year + (month_index // 12)
            month = (month_index % 12) + 1
            day = min(current_start.day, monthrange(year, month)[1])
            previous_start = date(year, month, day)

        return previous_start, previous_end

    @classmethod
    def _build_synthetic_past_rows(cls, client, plan_fee):
        if not client.subscription_start:
            return []

        duration = getattr(client.plan, 'duration', 'month') if client.plan else 'month'
        duration_value = getattr(client.plan, 'duration_value', 1) if client.plan else 1
        enrollment_date = client.enrollment_date
        cursor_start = client.subscription_start
        rows = []

        for _ in range(36):
            previous_start, previous_end = cls._previous_period_from_current(cursor_start, duration, duration_value)
            if enrollment_date and previous_end < enrollment_date:
                break

            rows.append({
                'invoice_id': None,
                'abonnement': client.plan.name if client.plan else '-',
                'classe_vacation': client.academy_class.name if client.academy_class else '-',
                'invoice_no': '-',
                'due_date': str(previous_end),
                'attendance': '-',
                'fees': plan_fee,
                'status': 'Unpaid',
                'period_start': str(previous_start),
                'period_end': str(previous_end),
            })
            cursor_start = previous_start

        return rows

    @staticmethod
    def _monthly_period_from_end(end_date, months=1):
        """Return calendar-month period [start, end] ending at end_date month."""
        if not end_date:
            return None, None

        months = max(1, int(months or 1))
        end_month_start = date(end_date.year, end_date.month, 1)

        start_month_index = (end_month_start.month - 1) - (months - 1)
        start_year = end_month_start.year + (start_month_index // 12)
        start_month = (start_month_index % 12) + 1
        start = date(start_year, start_month, 1)

        end_day = monthrange(end_date.year, end_date.month)[1]
        end = date(end_date.year, end_date.month, end_day)
        return start, end

    @staticmethod
    def _create_auto_renew_invoice(client, plan, today):
        # De-duplicate by subscription period (due_date) so retries on different days
        # do not create multiple upcoming invoices for the same cycle.
        duplicate_exists = Invoice.objects.exclude(status='cancelled').filter(
            client=client,
            plan=plan,
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
            Q(auto_renew=True) | Q(plan__auto_renew_clients=True),
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

        def is_subscription_invoice(inv):
            # Keep legacy invoices without an explicit plan in subscription flow.
            if not inv.plan:
                return True
            return inv.plan.plan_type != 'one_time'

        subscription_invoices = [inv for inv in invoices if is_subscription_invoice(inv)]
        one_time_invoices = [inv for inv in invoices if inv.plan and inv.plan.plan_type == 'one_time']

        pending_total = sum(float(inv.amount_due) for inv in subscription_invoices if inv.status != 'paid')
        one_time_pending_total = sum(float(inv.amount_due) for inv in one_time_invoices if inv.status != 'paid')

        subscription_ids = [inv.id for inv in subscription_invoices]
        one_time_ids = [inv.id for inv in one_time_invoices]

        paid_total = Payment.objects.filter(invoice_id__in=subscription_ids).aggregate(total=Sum('amount')).get('total') or 0
        one_time_paid_total = Payment.objects.filter(invoice_id__in=one_time_ids).aggregate(total=Sum('amount')).get('total') or 0

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

        current_period_start = client.subscription_start
        current_period_end = client.subscription_end
        if client.plan and client.plan.duration == 'month' and client.subscription_end:
            current_period_start, current_period_end = self._monthly_period_from_end(
                client.subscription_end,
                client.plan.duration_value,
            )

        def normalized_invoice_period(inv):
            period_start = inv.issue_date
            period_end = inv.due_date
            monthly_plan = inv.plan or client.plan
            if monthly_plan and monthly_plan.duration == 'month' and inv.due_date:
                period_start, period_end = self._monthly_period_from_end(
                    inv.due_date,
                    monthly_plan.duration_value,
                )
            return period_start, period_end

        current_candidates = [
            inv for inv in subscription_invoices
            if normalized_invoice_period(inv) == (current_period_start, current_period_end)
            and (
                client.plan_id is None
                or inv.plan_id is None
                or inv.plan_id == client.plan_id
            )
        ]
        status_priority = {'paid': 5, 'partial': 4, 'sent': 3, 'draft': 2, 'overdue': 1, 'cancelled': 0}
        current_invoice = (
            sorted(current_candidates, key=lambda x: (status_priority.get(x.status, 0), x.issue_date or date.min, x.id), reverse=True)[0]
            if current_candidates else None
        )

        payment_status = 'Paid' if current_invoice and current_invoice.status == 'paid' else 'Unpaid'
        plan_fee = '-'
        if client.plan:
            plan_fee = f"{round(float(client.plan.price), 2)} {client.plan.currency}"

        absent_sessions = max(total_sessions - present_sessions, 0)
        abonnement_row = {
            'invoice_id': current_invoice.id if current_invoice else None,
            'abonnement': client.plan.name if client.plan else '-',
            'classe_vacation': client.academy_class.name if client.academy_class else '-',
            'invoice_no': current_invoice.invoice_number if current_invoice else '-',
            'due_date': str(client.subscription_end) if client.subscription_end else (str(current_invoice.due_date) if current_invoice else '-'),
            'attendance': f"{present_sessions}/{absent_sessions}",
            'fees': plan_fee,
            'status': payment_status,
            'period_start': str(current_period_start) if current_period_start else '-',
            'period_end': str(current_period_end) if current_period_end else '-',
        }

        status_label = {'paid': 'Paid', 'partial': 'Partial', 'overdue': 'Overdue', 'sent': 'Sent', 'draft': 'Draft'}

        def invoice_to_row(inv):
            period_start = inv.issue_date
            period_end = inv.due_date

            monthly_plan = inv.plan or client.plan
            if monthly_plan and monthly_plan.duration == 'month' and inv.due_date:
                period_start, period_end = self._monthly_period_from_end(
                    inv.due_date,
                    monthly_plan.duration_value,
                )

            return {
                'invoice_id': inv.id,
                'abonnement': (inv.plan.name if inv.plan else None) or (client.plan.name if client.plan else '-'),
                'classe_vacation': client.academy_class.name if client.academy_class else '-',
                'invoice_no': inv.invoice_number,
                'due_date': str(inv.due_date) if inv.due_date else '-',
                'attendance': '-',
                'fees': f"{round(float(inv.total_amount), 2)} {inv.currency}",
                'status': status_label.get(inv.status, 'Unpaid'),
                'period_start': str(period_start) if period_start else '-',
                'period_end': str(period_end) if period_end else '-',
            }

        past_rows = []
        upcoming_rows = []
        for inv in subscription_invoices:
            period_start, period_end = normalized_invoice_period(inv)
            if (period_start, period_end) == (current_period_start, current_period_end):
                continue
            if inv.due_date and inv.due_date >= today and inv.status not in ('paid', 'overdue', 'cancelled'):
                upcoming_rows.append(invoice_to_row(inv))
            else:
                past_rows.append(invoice_to_row(inv))

        if not past_rows:
            past_rows = self._build_synthetic_past_rows(client, plan_fee)

        return Response({
            'abonnement': abonnement,
            'abonnement_row': abonnement_row,
            'past_rows': past_rows,
            'upcoming_rows': upcoming_rows,
            'pending': round(float(pending_total), 2),
            'paid': round(float(paid_total), 2),
            'one_time_pending': round(float(one_time_pending_total), 2),
            'one_time_paid': round(float(one_time_paid_total), 2),
            'items_count': len(subscription_invoices),
            'one_time_items_count': len(one_time_invoices),
            'plan_name': client.plan.name if client.plan else '-',
            'attendance': {
                'present': present_sessions,
                'total': total_sessions,
                'rate': attendance_rate,
            },
            'performance': performance,
        })
