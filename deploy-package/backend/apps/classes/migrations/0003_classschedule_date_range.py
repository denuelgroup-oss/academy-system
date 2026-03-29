from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('classes', '0002_replace_age_group_with_plans'),
    ]

    operations = [
        migrations.AddField(
            model_name='classschedule',
            name='end_date',
            field=models.DateField(
                blank=True,
                help_text='Date when this schedule ends (up to date)',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='classschedule',
            name='start_date',
            field=models.DateField(
                blank=True,
                help_text='Date when this schedule starts (from date)',
                null=True,
            ),
        ),
    ]
