from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('accounts', '0002_workspacestate')]
    operations = [migrations.CreateModel(
        name='SafetyReport',
        fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('kind', models.CharField(choices=[('job', 'Job listing'), ('client', 'Client message')], max_length=12)),
            ('job_reference', models.CharField(max_length=100)),
            ('reason', models.CharField(max_length=100)),
            ('status', models.CharField(choices=[('new', 'New'), ('reviewing', 'Reviewing'), ('closed', 'Closed')], default='new', max_length=12)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='safety_reports', to=settings.AUTH_USER_MODEL)),
        ], options={'ordering': ['-created_at']},
    )]
