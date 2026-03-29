from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('plans', '0005_plan_plan_type'),
        ('clients', '0002_client_auto_renew'),
    ]

    operations = [
        migrations.AddField(
            model_name='client',
            name='one_time_plans',
            field=models.ManyToManyField(
                blank=True,
                limit_choices_to={'plan_type': 'one_time'},
                related_name='clients_one_time',
                to='plans.plan',
            ),
        ),
    ]
