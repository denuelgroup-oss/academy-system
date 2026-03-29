from django.db import models
from django.contrib.auth.models import User


class StaffAttendance(models.Model):
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('leave', 'On Leave'),
        ('half_day', 'Half Day'),
    ]

    staff = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='staff_attendances'
    )
    date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='present')
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['staff', 'date']
        ordering = ['-date']

    def __str__(self):
        return f"{self.staff.get_full_name()} — {self.date} — {self.status}"


class Salary(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('partial', 'Partial'),
    ]

    MONTH_CHOICES = [
        (1, 'January'), (2, 'February'), (3, 'March'), (4, 'April'),
        (5, 'May'), (6, 'June'), (7, 'July'), (8, 'August'),
        (9, 'September'), (10, 'October'), (11, 'November'), (12, 'December'),
    ]

    staff = models.ForeignKey(User, on_delete=models.CASCADE, related_name='salaries')
    month = models.IntegerField(choices=MONTH_CHOICES)
    year = models.IntegerField()
    base_amount = models.DecimalField(max_digits=10, decimal_places=2)
    bonus = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, default='USD')
    payment_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['staff', 'month', 'year']
        ordering = ['-year', '-month']

    def __str__(self):
        return f"{self.staff.get_full_name()} — {self.get_month_display()} {self.year}"

    def save(self, *args, **kwargs):
        self.total_amount = self.base_amount + self.bonus - self.deductions
        super().save(*args, **kwargs)
