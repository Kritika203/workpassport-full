from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('opportunities', '0001_initial')]
    operations = [
        migrations.AddField('job', 'is_demo', models.BooleanField(default=False)),
        migrations.AddField('job', 'external_url', models.URLField(max_length=1000, blank=True)),
        migrations.AddField('job', 'deliverables', models.JSONField(default=list, blank=True)),
        migrations.AddField('job', 'client_provides', models.JSONField(default=list, blank=True)),
        migrations.AddField('job', 'deadline_days', models.PositiveSmallIntegerField(default=7)),
        migrations.AddField('job', 'meeting_pattern', models.CharField(max_length=180, blank=True)),
        migrations.AddField('job', 'caution_note', models.CharField(max_length=500, blank=True)),
        migrations.AddField('job', 'needs_own_laptop', models.BooleanField(default=False)),
        migrations.AddField('job', 'internet_need', models.CharField(max_length=80, blank=True)),
    ]
