from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('workflows', '0001_initial')]
    operations = [
        migrations.CreateModel(
            name='ProofAsset', fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('skill_name', models.CharField(max_length=100)),
                ('kind', models.CharField(choices=[('link', 'Link'), ('photo', 'Photo')], max_length=10)),
                ('note', models.CharField(blank=True, max_length=140)),
                ('external_url', models.URLField(blank=True, max_length=1000)),
                ('image_file', models.FileField(blank=True, upload_to='private_proofs/')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='proof_assets', to=settings.AUTH_USER_MODEL)),
            ], options={'ordering': ['created_at', 'id']},
        ),
    ]
