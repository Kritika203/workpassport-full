from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('workflows', '0003_publicpassportlink'), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(name='StaffAuditLog', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('action', models.CharField(max_length=60)),
            ('target_model', models.CharField(max_length=80)),
            ('target_id', models.PositiveIntegerField()),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('actor', models.ForeignKey(to=settings.AUTH_USER_MODEL, null=True, related_name='+', on_delete=django.db.models.deletion.SET_NULL)),
        ], options={'ordering': ['-created_at', '-id']}),
    ]
