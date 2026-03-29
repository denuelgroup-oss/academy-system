from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Invoice, Payment
from .serializers import InvoiceSerializer, InvoiceListSerializer, PaymentSerializer


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related('client', 'plan').prefetch_related('payments').all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'client', 'currency', 'plan']
    search_fields = ['invoice_number', 'client__first_name', 'client__last_name']
    ordering_fields = ['issue_date', 'due_date', 'total_amount', 'created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return InvoiceListSerializer
        return InvoiceSerializer

    @action(detail=False, methods=['get'], url_path='pending')
    def pending(self, request):
        """Invoices that are still pending payment, excluding overdue ones."""
        invoices = self.get_queryset().filter(status__in=['draft', 'sent', 'partial'])
        serializer = InvoiceListSerializer(invoices, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='overdue')
    def overdue(self, request):
        today = timezone.now().date()
        invoices = self.get_queryset().filter(
            due_date__lt=today
        ).exclude(status__in=['paid', 'cancelled'])
        serializer = InvoiceListSerializer(invoices, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='mark-overdue')
    def mark_overdue(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status not in ('paid', 'cancelled'):
            invoice.status = 'overdue'
            invoice.save(update_fields=['status'])
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=False, methods=['get'], url_path='next-number')
    def next_number(self, request):
        """Return the next sequential number for a given invoice number prefix."""
        prefix = request.query_params.get('prefix', '').strip().upper()
        if prefix:
            seq = Invoice.objects.filter(invoice_number__istartswith=prefix).count() + 1
        else:
            seq = Invoice.objects.count() + 1
        return Response({'seq': seq})


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related('invoice', 'invoice__client').all()
    serializer_class = PaymentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['invoice', 'payment_method', 'currency']
    search_fields = ['invoice__invoice_number', 'reference']
    ordering_fields = ['payment_date', 'amount']
