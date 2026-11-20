from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0003_safetyreport'),
        ('workflows', '0003_publicpassportlink'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField('profile', 'headline', models.CharField(max_length=200, blank=True)),
        migrations.AddField('profile', 'district', models.CharField(max_length=120, blank=True)),
        migrations.AddField('profile', 'languages', models.JSONField(default=list, blank=True)),
        migrations.AddField('profile', 'availability', models.CharField(max_length=240, blank=True)),
        migrations.AddField('profile', 'rate_note', models.CharField(max_length=240, blank=True)),
        migrations.AddField('profile', 'tools', models.JSONField(default=list, blank=True)),
        migrations.AddField('profile', 'work_wanted', models.JSONField(default=list, blank=True)),
        migrations.AddField('profile', 'onboarded', models.BooleanField(default=False)),
        migrations.AddField('profile', 'email_verified', models.BooleanField(default=False)),
        migrations.AddField('profile', 'business_name', models.CharField(max_length=160, blank=True)),
        migrations.AddField('profile', 'town', models.CharField(max_length=120, blank=True)),
        migrations.CreateModel(
            name='TrainingEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=160)),
                ('institution', models.CharField(max_length=160, blank=True)),
                ('year', models.PositiveSmallIntegerField(null=True, blank=True)),
                ('user', models.ForeignKey(to=settings.AUTH_USER_MODEL, on_delete=django.db.models.deletion.CASCADE, related_name='training_entries')),
            ],
            options={'ordering': ['-year', 'id']},
        ),
        migrations.CreateModel(
            name='SkillVerification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('level', models.CharField(max_length=20, default='self', choices=[('self', 'Self-added'), ('demonstrated', 'Demonstrated'), ('institution', 'Institution-verified'), ('client', 'Client-confirmed'), ('platform', 'Platform-verified')])),
                ('evidence_url', models.URLField(max_length=1000, blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('verified_at', models.DateTimeField(null=True, blank=True)),
                ('proof_asset', models.ForeignKey(to='workflows.proofasset', null=True, blank=True, on_delete=django.db.models.deletion.SET_NULL)),
                ('skill', models.ForeignKey(to='accounts.skill', on_delete=django.db.models.deletion.CASCADE, related_name='verifications')),
                ('verified_by', models.ForeignKey(to=settings.AUTH_USER_MODEL, null=True, blank=True, related_name='+', on_delete=django.db.models.deletion.SET_NULL)),
            ],
            options={'ordering': ['level', 'id']},
        ),
        migrations.AddConstraint('skillverification', models.UniqueConstraint(fields=['skill', 'level'], name='unique_skill_proof_level')),
    ]
