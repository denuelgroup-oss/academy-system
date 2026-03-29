from django.db import migrations, models


def migrate_plan_durations(apps, schema_editor):
    Plan = apps.get_model('plans', 'Plan')

    old_to_new = {
        'one_time': ('day', 1),
        'monthly': ('month', 1),
        'quarterly': ('month', 3),
        'semi_annual': ('month', 6),
        'annual': ('year', 1),
    }
    multipliers = {'day': 1, 'week': 7, 'month': 30, 'year': 365}

    for plan in Plan.objects.all():
        if plan.duration in old_to_new:
            unit, value = old_to_new[plan.duration]
        elif plan.duration in multipliers:
            unit = plan.duration
            value = max(1, int(getattr(plan, 'duration_value', 1) or 1))
        else:
            unit = 'day'
            value = max(1, int(plan.duration_days or 1))

        plan.duration = unit
        plan.duration_value = value
        plan.duration_days = value * multipliers[unit]
        plan.save(update_fields=['duration', 'duration_value', 'duration_days'])


class Migration(migrations.Migration):

    dependencies = [
        ('plans', '0003_plan_auto_renew_clients'),
    ]

    operations = [
        migrations.AddField(
            model_name='plan',
            name='duration_value',
            field=models.PositiveIntegerField(
                default=1,
                help_text='Numeric duration amount linked to unit (e.g. 3 + months)'
            ),
        ),
        migrations.AlterField(
            model_name='plan',
            name='duration',
            field=models.CharField(
                choices=[
                    ('day', 'Days'),
                    ('week', 'Weeks'),
                    ('month', 'Months'),
                    ('year', 'Years'),
                ],
                default='month',
                max_length=20,
            ),
        ),
        migrations.RunPython(migrate_plan_durations, migrations.RunPython.noop),
    ]
