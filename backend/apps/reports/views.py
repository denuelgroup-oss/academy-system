from datetime import date
from django.db.models import Sum, Count, Avg, Q
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated


class DashboardKPIView(APIView):
    """Main dashboard KPIs."""

    @staticmethod
    def _next_birthday_and_days(dob, today):
        if not dob:
            return None, None

        try:
            next_birthday = dob.replace(year=today.year)
        except ValueError:
            # Handle Feb 29 on non-leap years.
            next_birthday = date(today.year, 2, 28)

        if next_birthday < today:
            try:
                next_birthday = dob.replace(year=today.year + 1)
            except ValueError:
                next_birthday = date(today.year + 1, 2, 28)

        return next_birthday, (next_birthday - today).days

    def get(self, request):
        from apps.clients.models import Client
        from apps.sales.models import Invoice, Payment
        from apps.expenses.models import Expense
        from apps.staff.models import Salary
        from apps.attendance.models import ClientAttendance

        today = timezone.now().date()
        month_start = today.replace(day=1)

        # Clients
        total_clients = Client.objects.filter(status='active').count()
        new_this_month = Client.objects.filter(enrollment_date__gte=month_start).count()
        expiring_soon = Client.objects.filter(
            subscription_end__lte=today + timezone.timedelta(days=30),
            subscription_end__gte=today,
            status='active',
        ).count()

        # Birthday reminders: clients whose next birthday is within 0..3 days.
        birthday_reminders = []
        clients_with_dob = Client.objects.filter(date_of_birth__isnull=False).only(
            'id', 'first_name', 'last_name', 'date_of_birth', 'phone'
        )
        for c in clients_with_dob:
            next_birthday, days_until = self._next_birthday_and_days(c.date_of_birth, today)
            if next_birthday is None or days_until is None:
                continue
            if 0 <= days_until <= 3:
                birthday_reminders.append({
                    'id': c.id,
                    'full_name': f"{c.first_name} {c.last_name}".strip(),
                    'phone': c.phone,
                    'birthday': str(next_birthday),
                    'days_until': days_until,
                })

        birthday_reminders.sort(key=lambda x: (x['days_until'], x['full_name'].lower()))

        # Revenue
        revenue_this_month = Payment.objects.filter(
            payment_date__gte=month_start
        ).aggregate(total=Sum('amount'))['total'] or 0

        total_revenue = Payment.objects.aggregate(total=Sum('amount'))['total'] or 0

        # Pending invoices
        pending_amount = Invoice.objects.exclude(
            status__in=['paid', 'cancelled']
        ).aggregate(total=Sum('total_amount'))['total'] or 0

        # Expenses this month
        expenses_this_month = Expense.objects.filter(
            expense_date__gte=month_start
        ).aggregate(total=Sum('amount_base'))['total'] or 0

        # Invoices
        invoices_pending = Invoice.objects.exclude(status__in=['paid', 'cancelled']).count()
        invoices_overdue = Invoice.objects.filter(
            status='overdue'
        ).count()

        # Attendance today
        attendance_today = ClientAttendance.objects.filter(
            date=today, status='present'
        ).count()

        return Response({
            'clients': {
                'total_active': total_clients,
                'new_this_month': new_this_month,
                'expiring_soon': expiring_soon,
            },
            'finance': {
                'revenue_this_month': float(revenue_this_month),
                'total_revenue': float(total_revenue),
                'pending_amount': float(pending_amount),
                'expenses_this_month': float(expenses_this_month),
                'profit_this_month': float(revenue_this_month) - float(expenses_this_month),
            },
            'invoices': {
                'pending_count': invoices_pending,
                'overdue_count': invoices_overdue,
            },
            'attendance': {
                'today': attendance_today,
            },
            'birthdays': {
                'count': len(birthday_reminders),
                'reminders': birthday_reminders,
            },
        })


class FinancialReportView(APIView):
    """Revenue, expenses and profit over time."""

    def get(self, request):
        from apps.sales.models import Payment
        from apps.expenses.models import Expense

        year = int(request.query_params.get('year', timezone.now().year))

        # Monthly revenue
        revenue_by_month = (
            Payment.objects.filter(payment_date__year=year)
            .annotate(month=TruncMonth('payment_date'))
            .values('month')
            .annotate(total=Sum('amount'))
            .order_by('month')
        )

        # Monthly expenses
        expenses_by_month = (
            Expense.objects.filter(expense_date__year=year)
            .annotate(month=TruncMonth('expense_date'))
            .values('month')
            .annotate(total=Sum('amount_base'))
            .order_by('month')
        )

        # Build month map
        months = {i: {'month': i, 'revenue': 0, 'expenses': 0} for i in range(1, 13)}
        for row in revenue_by_month:
            months[row['month'].month]['revenue'] = float(row['total'])
        for row in expenses_by_month:
            months[row['month'].month]['expenses'] = float(row['total'])

        chart_data = []
        for m, data in months.items():
            month_name = date(year, m, 1).strftime('%b')
            chart_data.append({
                'month': month_name,
                'revenue': data['revenue'],
                'expenses': data['expenses'],
                'profit': data['revenue'] - data['expenses'],
            })

        # Totals
        total_revenue = sum(d['revenue'] for d in chart_data)
        total_expenses = sum(d['expenses'] for d in chart_data)

        # Expenses by category
        by_category = (
            Expense.objects.filter(expense_date__year=year)
            .values('category')
            .annotate(total=Sum('amount_base'))
            .order_by('-total')
        )

        return Response({
            'year': year,
            'chart_data': chart_data,
            'totals': {
                'revenue': total_revenue,
                'expenses': total_expenses,
                'profit': total_revenue - total_expenses,
            },
            'expenses_by_category': list(by_category),
        })


class ClientReportView(APIView):
    def get(self, request):
        from apps.clients.models import Client

        today = timezone.now().date()

        by_status = list(
            Client.objects.values('status').annotate(count=Count('id')).order_by('status')
        )
        by_plan = list(
            Client.objects.filter(plan__isnull=False)
            .values('plan__name')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        by_class = list(
            Client.objects.filter(academy_class__isnull=False)
            .values('academy_class__name')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        by_gender = list(
            Client.objects.values('gender').annotate(count=Count('id'))
        )

        # Enrollment trend (last 12 months)
        trend = (
            Client.objects.annotate(month=TruncMonth('enrollment_date'))
            .values('month')
            .annotate(count=Count('id'))
            .order_by('month')
        )
        trend_data = [
            {'month': r['month'].strftime('%b %Y'), 'count': r['count']}
            for r in trend if r['month']
        ]

        return Response({
            'by_status': by_status,
            'by_plan': by_plan,
            'by_class': by_class,
            'by_gender': by_gender,
            'enrollment_trend': trend_data,
        })


class AttendanceReportView(APIView):
    def get(self, request):
        from apps.attendance.models import ClientAttendance
        from apps.staff.models import StaffAttendance

        month = int(request.query_params.get('month', timezone.now().month))
        year = int(request.query_params.get('year', timezone.now().year))

        # Client attendance summary
        client_summary = (
            ClientAttendance.objects.filter(date__month=month, date__year=year)
            .values('status')
            .annotate(count=Count('id'))
        )

        # Client attendance by class
        by_class = (
            ClientAttendance.objects.filter(date__month=month, date__year=year)
            .values('academy_class__name')
            .annotate(
                present=Count('id', filter=Q(status='present')),
                absent=Count('id', filter=Q(status='absent')),
                total=Count('id'),
            )
            .order_by('academy_class__name')
        )

        # Staff attendance summary
        staff_summary = (
            StaffAttendance.objects.filter(date__month=month, date__year=year)
            .values('status')
            .annotate(count=Count('id'))
        )

        return Response({
            'month': month,
            'year': year,
            'client_attendance': {
                'summary': list(client_summary),
                'by_class': list(by_class),
            },
            'staff_attendance': {
                'summary': list(staff_summary),
            },
        })
