from django.db import models


class Plan(models.Model):
    PLAN_TYPE_CHOICES = [
        ('subscription', 'Subscription Plan'),
        ('one_time', 'One Time Plan'),
    ]

    DURATION_CHOICES = [
        ('day', 'Days'),
        ('week', 'Weeks'),
        ('month', 'Months'),
        ('year', 'Years'),
    ]

    name = models.CharField(max_length=100)
    plan_type = models.CharField(
        max_length=20,
        choices=PLAN_TYPE_CHOICES,
        default='subscription',
    )
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default='USD')
    duration = models.CharField(max_length=20, choices=DURATION_CHOICES, default='month')
    duration_value = models.PositiveIntegerField(
        default=1,
        help_text='Numeric duration amount linked to unit (e.g. 3 + months)'
    )
    duration_days = models.IntegerField(
        default=30,
        help_text='Number of days this plan is valid for'
    )
    features = models.TextField(
        blank=True,
        help_text='Comma-separated list of features, e.g. "3 sessions/week, Kit included"'
    )
    auto_renew_clients = models.BooleanField(
        default=False,
        help_text='Default auto-renew value for clients assigned to this plan'
    )
    max_sessions_per_week = models.IntegerField(default=0, help_text='0 = unlimited')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['price']

    def save(self, *args, **kwargs):
        multipliers = {
            'day': 1,
            'week': 7,
            'month': 30,
            'year': 365,
        }

        if self.plan_type == 'one_time':
            self.duration = 'day'
            self.duration_value = 1
            self.auto_renew_clients = False

        safe_value = max(1, int(self.duration_value or 1))
        self.duration_value = safe_value
        self.duration_days = safe_value * multipliers.get(self.duration, 30)
        super().save(*args, **kwargs)

    def __str__(self):
        unit = self.duration if self.duration_value == 1 else f"{self.duration}s"
        return f"{self.name} — {self.price} {self.currency}/{self.duration_value} {unit}"

    def get_features_list(self):
        return [f.strip() for f in self.features.split(',') if f.strip()]
