from django.db import models
from django.utils import timezone
from decimal import Decimal
from apps.clients.models import Client
from apps.plans.models import Plan


class Invoice(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('paid', 'Paid'),
        ('partial', 'Partial'),
        ('overdue', 'Overdue'),
        ('cancelled', 'Cancelled'),
    ]

    invoice_number = models.CharField(max_length=30, unique=True, blank=True)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='invoices')
    plan = models.ForeignKey(Plan, on_delete=models.SET_NULL, null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default='USD')
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    issue_date = models.DateField(default=timezone.now)
    due_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Invoice #{self.invoice_number} — {self.client}"

    @classmethod
    def generate_invoice_number(cls):
        year = timezone.now().year
        prefix = f'INV-{year}-'
        last = (
            cls.objects.filter(invoice_number__startswith=prefix)
            .order_by('-invoice_number')
            .first()
        )
        if last:
            try:
                seq = int(last.invoice_number.split('-')[-1]) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1
        return f'{prefix}{str(seq).zfill(4)}'

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            self.invoice_number = self.generate_invoice_number()
        amount = self.amount if isinstance(self.amount, Decimal) else Decimal(str(self.amount or 0))
        tax_rate = self.tax_rate if isinstance(self.tax_rate, Decimal) else Decimal(str(self.tax_rate or 0))
        self.tax_amount = amount * (tax_rate / Decimal('100'))
        self.total_amount = self.amount + self.tax_amount
        super().save(*args, **kwargs)

    @property
    def amount_paid(self):
        return sum(p.amount for p in self.payments.all())

    @property
    def amount_due(self):
        return self.total_amount - self.amount_paid


class Payment(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('bank_transfer', 'Bank Transfer'),
        ('mobile_money', 'Mobile Money'),
        ('check', 'Check'),
        ('card', 'Card'),
    ]

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default='USD')
    payment_date = models.DateField(default=timezone.now)
    payment_method = models.CharField(
        max_length=20, choices=PAYMENT_METHOD_CHOICES, default='cash'
    )
    reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    received_by = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-payment_date']

    def __str__(self):
        return f"Payment {self.amount} {self.currency} for #{self.invoice.invoice_number}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Auto-update invoice status
        inv = self.invoice
        paid = sum(p.amount for p in inv.payments.all())
        if paid >= inv.total_amount:
            inv.status = 'paid'
        elif paid > 0:
            inv.status = 'partial'
        inv.save(update_fields=['status'])
