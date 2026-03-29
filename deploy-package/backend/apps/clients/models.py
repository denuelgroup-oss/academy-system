from django.db import models
from django.utils import timezone
from apps.plans.models import Plan
from apps.classes.models import AcademyClass


class Client(models.Model):
    GENDER_CHOICES = [('M', 'Male'), ('F', 'Female'), ('O', 'Other')]
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('expired', 'Expired'),
        ('pending', 'Pending'),
        ('suspended', 'Suspended'),
    ]

    # Personal info
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    emergency_contact = models.CharField(max_length=100, blank=True)
    emergency_phone = models.CharField(max_length=20, blank=True)
    photo = models.ImageField(upload_to='clients/', null=True, blank=True)

    # Academy linkage
    plan = models.ForeignKey(
        Plan, on_delete=models.SET_NULL, null=True, blank=True, related_name='clients'
    )
    one_time_plans = models.ManyToManyField(
        Plan,
        blank=True,
        related_name='clients_one_time',
        limit_choices_to={'plan_type': 'one_time'},
    )
    academy_class = models.ForeignKey(
        AcademyClass, on_delete=models.SET_NULL, null=True, blank=True, related_name='students'
    )
    enrollment_date = models.DateField(default=timezone.now)
    subscription_start = models.DateField(null=True, blank=True)
    subscription_end = models.DateField(null=True, blank=True)
    auto_renew = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['last_name', 'first_name']

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def is_subscription_expired(self):
        if self.subscription_end:
            return self.subscription_end < timezone.now().date()
        return False

    @property
    def days_until_expiry(self):
        if self.subscription_end:
            delta = self.subscription_end - timezone.now().date()
            return delta.days
        return None

    def refresh_status(self):
        """Auto-update status based on subscription dates."""
        if self.is_subscription_expired and self.status == 'active':
            self.status = 'expired'
            self.save(update_fields=['status'])
