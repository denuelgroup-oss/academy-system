from django.contrib import admin
from .models import Invoice, Payment


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    fields = ['amount', 'currency', 'payment_date', 'payment_method', 'reference']
    readonly_fields = ['created_at']


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_number', 'client', 'plan', 'total_amount', 'currency',
                    'issue_date', 'due_date', 'status']
    list_filter = ['status', 'currency']
    search_fields = ['invoice_number', 'client__first_name', 'client__last_name']
    readonly_fields = ['invoice_number', 'tax_amount', 'total_amount']
    inlines = [PaymentInline]
    date_hierarchy = 'issue_date'


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['invoice', 'amount', 'currency', 'payment_date', 'payment_method', 'received_by']
    list_filter = ['payment_method', 'currency']
    search_fields = ['invoice__invoice_number', 'reference']
    date_hierarchy = 'payment_date'
