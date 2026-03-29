from django.db import migrations, models


def migrate_existing_age_groups_to_plans(apps, schema_editor):
    AcademyClass = apps.get_model('classes', 'AcademyClass')
    Plan = apps.get_model('plans', 'Plan')

    age_values = (
        AcademyClass.objects.exclude(age_group='')
        .values_list('age_group', flat=True)
        .distinct()
    )

    age_to_plan_id = {}
    for age in age_values:
        plan, _ = Plan.objects.get_or_create(
            name=f"{age} Plan",
            defaults={
                'description': f'Auto-created from class age group {age}',
                'price': 0,
                'currency': 'USD',
                'duration': 'month',
                'duration_value': 1,
                'duration_days': 30,
                'is_active': True,
            },
        )
        age_to_plan_id[age] = plan.id

    through = AcademyClass.plans.through
    for c in AcademyClass.objects.all():
        if c.age_group and c.age_group in age_to_plan_id:
            through.objects.get_or_create(academyclass_id=c.id, plan_id=age_to_plan_id[c.age_group])


class Migration(migrations.Migration):

    dependencies = [
        ('plans', '0004_plan_duration_unit_value'),
        ('classes', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='academyclass',
            name='plans',
            field=models.ManyToManyField(
                blank=True,
                help_text='Plans allowed for clients taking this class',
                related_name='academy_classes',
                to='plans.plan',
            ),
        ),
        migrations.RunPython(migrate_existing_age_groups_to_plans, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='academyclass',
            name='age_group',
        ),
    ]
