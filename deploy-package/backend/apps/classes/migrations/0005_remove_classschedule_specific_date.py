from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('classes', '0004_academyclass_skills_center_level'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='classschedule',
            name='specific_date',
        ),
    ]
