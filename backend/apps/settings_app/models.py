from django.db import models


class SystemSetting(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField()
    description = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'System Setting'
        verbose_name_plural = 'System Settings'

    def __str__(self):
        return f"{self.key}: {self.value}"


class Currency(models.Model):
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100)
    symbol = models.CharField(max_length=10)
    is_base = models.BooleanField(default=False, help_text='Primary/base currency for the system')
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'Currencies'
        ordering = ['code']

    def __str__(self):
        return f"{self.code} — {self.name}"

    def save(self, *args, **kwargs):
        # Only one base currency allowed
        if self.is_base:
            Currency.objects.exclude(pk=self.pk).update(is_base=False)
        super().save(*args, **kwargs)


class ExchangeRate(models.Model):
    from_currency = models.ForeignKey(
        Currency, on_delete=models.CASCADE, related_name='exchange_from'
    )
    to_currency = models.ForeignKey(
        Currency, on_delete=models.CASCADE, related_name='exchange_to'
    )
    rate = models.DecimalField(max_digits=15, decimal_places=6)
    effective_date = models.DateField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-effective_date']

    def __str__(self):
        return f"{self.from_currency.code} → {self.to_currency.code}: {self.rate} ({self.effective_date})"
