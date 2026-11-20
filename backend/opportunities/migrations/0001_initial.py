from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(
            name='Job',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=180)),
                ('description', models.TextField()),
                ('category', models.CharField(max_length=80)),
                ('client_name', models.CharField(max_length=140)),
                ('client_country', models.CharField(blank=True, max_length=100)),
                ('required_skills', models.JSONField(blank=True, default=list)),
                ('budget_usd', models.DecimalField(decimal_places=2, max_digits=10)),
                ('budget_type', models.CharField(choices=[('fixed', 'Fixed'), ('hourly', 'Hourly')], default='fixed', max_length=10)),
                ('beginner_friendly', models.BooleanField(default=True)),
                ('status', models.CharField(choices=[('pending_review', 'Pending review'), ('published', 'Published'), ('rejected', 'Rejected'), ('closed', 'Closed')], default='pending_review', max_length=20)),
                ('payment_verified', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('owner', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='posted_jobs', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='SavedJob',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('saved_at', models.DateTimeField(auto_now_add=True)),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='saves', to='opportunities.job')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='saved_jobs', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='Application',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('message', models.TextField()),
                ('proposed_rate_usd', models.DecimalField(decimal_places=2, max_digits=10)),
                ('status', models.CharField(choices=[('submitted', 'Submitted'), ('shortlisted', 'Shortlisted'), ('accepted', 'Accepted'), ('rejected', 'Rejected')], default='submitted', max_length=15)),
                ('applied_at', models.DateTimeField(auto_now_add=True)),
                ('job', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='applications', to='opportunities.job')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='job_applications', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-applied_at']},
        ),
        migrations.AddConstraint('SavedJob', models.UniqueConstraint(fields=('user', 'job'), name='unique_saved_job')),
        migrations.AddConstraint('Application', models.UniqueConstraint(fields=('user', 'job'), name='unique_job_application')),
    ]
