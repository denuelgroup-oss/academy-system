from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('plans', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='plan',
            name='duration',
            field=models.CharField(
                choices=[
                    ('one_time', 'One Time'),
                    ('monthly', 'Monthly'),
                    ('quarterly', 'Quarterly'),
                    ('semi_annual', 'Semi-Annual'),
                    ('annual', 'Annual'),
                    ('custom', 'Custom'),
                ],
                default='monthly',
                max_length=20,
            ),
        ),
    ]
