from django.db import models


class Expense(models.Model):
    CATEGORY_CHOICES = [
        ('equipment', 'Equipment'),
        ('facilities', 'Facilities'),
        ('salaries', 'Salaries'),
        ('transport', 'Transport'),
        ('utilities', 'Utilities'),
        ('marketing', 'Marketing'),
        ('medical', 'Medical'),
        ('training', 'Training Materials'),
        ('other', 'Other'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='USD')
    exchange_rate = models.DecimalField(
        max_digits=12, decimal_places=6, default=1,
        help_text='Rate used to convert to base currency'
    )
    amount_base = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text='Amount in base currency (auto-calculated)'
    )
    base_currency = models.CharField(max_length=10, default='USD')
    expense_date = models.DateField()
    receipt = models.FileField(upload_to='receipts/', null=True, blank=True)
    paid_by = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-expense_date']

    def __str__(self):
        return f"{self.title} — {self.amount} {self.currency}"

    def save(self, *args, **kwargs):
        self.amount_base = float(self.amount) * float(self.exchange_rate)
        super().save(*args, **kwargs)
