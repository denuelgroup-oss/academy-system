from django.db import models
from django.contrib.auth.models import User
from apps.plans.models import Plan


class AcademyClass(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    skills = models.TextField(blank=True)
    center = models.CharField(max_length=150, blank=True)
    level = models.CharField(max_length=100, blank=True)
    plans = models.ManyToManyField(
        Plan,
        related_name='academy_classes',
        blank=True,
        help_text='Plans allowed for clients taking this class'
    )
    max_students = models.IntegerField(default=20)
    coach = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='coached_classes',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Class'
        verbose_name_plural = 'Classes'
        ordering = ['name']

    def __str__(self):
        return self.name

    @property
    def student_count(self):
        return self.students.filter(status='active').count()


class ClassSchedule(models.Model):
    DAY_CHOICES = [
        ('monday', 'Monday'),
        ('tuesday', 'Tuesday'),
        ('wednesday', 'Wednesday'),
        ('thursday', 'Thursday'),
        ('friday', 'Friday'),
        ('saturday', 'Saturday'),
        ('sunday', 'Sunday'),
    ]

    academy_class = models.ForeignKey(
        AcademyClass,
        on_delete=models.CASCADE,
        related_name='schedules',
    )
    coach = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='schedule_sessions',
    )
    day_of_week = models.CharField(max_length=10, choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    start_date = models.DateField(
        null=True,
        blank=True,
        help_text='Date when this schedule starts (from date)',
    )
    end_date = models.DateField(
        null=True,
        blank=True,
        help_text='Date when this schedule ends (up to date)',
    )
    location = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['day_of_week', 'start_time']

    def __str__(self):
        return f"{self.academy_class.name} — {self.get_day_of_week_display()} {self.start_time:%H:%M}"
