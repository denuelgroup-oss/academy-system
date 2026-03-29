from django.db import migrations, models


def set_plan_type_from_duration(apps, schema_editor):
    Plan = apps.get_model('plans', 'Plan')
    for plan in Plan.objects.all():
        is_one_time = plan.duration == 'day' and int(plan.duration_value or 1) == 1
        plan.plan_type = 'one_time' if is_one_time else 'subscription'
        plan.save(update_fields=['plan_type'])


class Migration(migrations.Migration):

    dependencies = [
        ('plans', '0004_plan_duration_unit_value'),
    ]

    operations = [
        migrations.AddField(
            model_name='plan',
            name='plan_type',
            field=models.CharField(
                choices=[
                    ('subscription', 'Subscription Plan'),
                    ('one_time', 'One Time Plan'),
                ],
                default='subscription',
                max_length=20,
            ),
        ),
        migrations.RunPython(set_plan_type_from_duration, migrations.RunPython.noop),
    ]
