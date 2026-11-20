# Initial database tables for the WorkPassport workflows.
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL), ('opportunities', '0001_initial')]
    operations = [
        migrations.CreateModel(name='SafetyCheck', fields=[
            ('id', models.BigAutoField(primary_key=True, serialize=False)),
            ('text_excerpt', models.CharField(max_length=240)),
            ('risk', models.CharField(max_length=12)),
            ('flags', models.JSONField(default=dict)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='safety_checks', to=settings.AUTH_USER_MODEL)),
        ], options={'ordering': ['-created_at', '-id']}),
        migrations.CreateModel(name='EvidenceRecord', fields=[
            ('id', models.BigAutoField(primary_key=True, serialize=False)),
            ('text', models.TextField()), ('categories', models.JSONField(default=list)),
            ('source', models.CharField(default='page', max_length=30)),
            ('job_title', models.CharField(blank=True, max_length=180)),
            ('client_name', models.CharField(blank=True, max_length=140)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='evidence_records', to=settings.AUTH_USER_MODEL)),
        ], options={'ordering': ['-created_at', '-id']}),
        migrations.CreateModel(name='SubmittedOpportunity', fields=[
            ('id', models.BigAutoField(primary_key=True, serialize=False)),
            ('kind', models.CharField(choices=[('opportunity', 'Opportunity'), ('insight', 'Insight')], max_length=16)),
            ('payload', models.JSONField(default=dict)),
            ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending', max_length=10)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('reviewed_at', models.DateTimeField(blank=True, null=True)),
            ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='contributed_opportunities', to=settings.AUTH_USER_MODEL)),
            ('published_job', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='opportunities.job')),
            ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
        ], options={'ordering': ['-created_at', '-id']}),
        migrations.CreateModel(name='ClientContact', fields=[
            ('id', models.BigAutoField(primary_key=True, serialize=False)),
            ('muted', models.BooleanField(default=False)), ('blocked', models.BooleanField(default=False)),
            ('updated_at', models.DateTimeField(auto_now=True)),
            ('application', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='contact_settings', to='opportunities.application')),
        ]),
        migrations.CreateModel(name='ApplicationMessage', fields=[
            ('id', models.BigAutoField(primary_key=True, serialize=False)),
            ('text', models.TextField()), ('created_at', models.DateTimeField(auto_now_add=True)),
            ('application', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='messages', to='opportunities.application')),
            ('sender', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
        ], options={'ordering': ['created_at', 'id']}),
        migrations.CreateModel(name='Workroom', fields=[
            ('id', models.BigAutoField(primary_key=True, serialize=False)),
            ('scope', models.TextField(blank=True)), ('created_at', models.DateTimeField(auto_now_add=True)),
            ('application', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='workroom', to='opportunities.application')),
        ]),
        migrations.CreateModel(name='Milestone', fields=[
            ('id', models.BigAutoField(primary_key=True, serialize=False)),
            ('title', models.CharField(max_length=160)),
            ('amount_usd', models.DecimalField(decimal_places=2, max_digits=10)),
            ('state', models.CharField(choices=[('planned', 'Planned'), ('funded_demo', 'Funding simulated'), ('submitted', 'Submitted'), ('released_demo', 'Payment simulated')], default='planned', max_length=20)),
            ('position', models.PositiveSmallIntegerField(default=0)), ('created_at', models.DateTimeField(auto_now_add=True)),
            ('workroom', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='milestones', to='workflows.workroom')),
        ], options={'ordering': ['position', 'id']}),
        migrations.CreateModel(name='UserSafetyPreferences', fields=[
            ('id', models.BigAutoField(primary_key=True, serialize=False)),
            ('quiet_hours', models.JSONField(default=dict)), ('trusted_contact', models.JSONField(default=dict)),
            ('boundaries', models.JSONField(default=dict)), ('updated_at', models.DateTimeField(auto_now=True)),
            ('owner', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='work_safety_preferences', to=settings.AUTH_USER_MODEL)),
        ]),
        migrations.CreateModel(name='SafetyCheckIn', fields=[
            ('id', models.BigAutoField(primary_key=True, serialize=False)),
            ('scheduled_for', models.DateTimeField()), ('acknowledged_at', models.DateTimeField(blank=True, null=True)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='checkins', to=settings.AUTH_USER_MODEL)),
        ], options={'ordering': ['-scheduled_for', '-id']}),
        migrations.CreateModel(name='InboxNotification', fields=[
            ('id', models.BigAutoField(primary_key=True, serialize=False)),
            ('kind', models.CharField(max_length=40)), ('message', models.CharField(max_length=240)),
            ('is_read', models.BooleanField(default=False)), ('created_at', models.DateTimeField(auto_now_add=True)),
            ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='inbox', to=settings.AUTH_USER_MODEL)),
        ], options={'ordering': ['-created_at', '-id']}),
    ]
