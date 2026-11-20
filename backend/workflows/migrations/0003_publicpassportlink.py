from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('workflows', '0002_proofasset')]
    operations = [migrations.CreateModel(name='PublicPassportLink', fields=[
        ('id', models.BigAutoField(primary_key=True, serialize=False)),
        ('token', models.CharField(max_length=60, unique=True)),
        ('enabled', models.BooleanField(default=True)),
        ('created_at', models.DateTimeField(auto_now_add=True)),
        ('owner', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='public_passport_link', to=settings.AUTH_USER_MODEL)),
    ])]
