from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('opportunities', '0002_job_details'),
    ]

    operations = [
        migrations.AddField(
            model_name='application',
            name='decision_reason',
            field=models.TextField(blank=True, default=''),
        ),
    ]
