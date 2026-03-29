from django.db import models
from apps.clients.models import Client
from apps.classes.models import AcademyClass, ClassSchedule


class ClientAttendance(models.Model):
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('excused', 'Excused'),
    ]

    client = models.ForeignKey(
        Client, on_delete=models.CASCADE, related_name='attendances'
    )
    academy_class = models.ForeignKey(
        AcademyClass, on_delete=models.SET_NULL, null=True, blank=True, related_name='attendances'
    )
    class_schedule = models.ForeignKey(
        ClassSchedule,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='attendances',
    )
    date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='present')
    notes = models.TextField(blank=True)
    marked_by = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['client', 'date']
        ordering = ['-date', 'client__last_name']

    def __str__(self):
        return f"{self.client} — {self.date} — {self.status}"
