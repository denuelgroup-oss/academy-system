from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('classes', '0003_classschedule_date_range'),
    ]

    operations = [
        migrations.AddField(
            model_name='academyclass',
            name='center',
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name='academyclass',
            name='level',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='academyclass',
            name='skills',
            field=models.TextField(blank=True),
        ),
    ]
