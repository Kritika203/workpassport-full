from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('workflows', '0004_staffauditlog')]
    operations = [migrations.AddField('safetycheckin', 'reminder_sent_at', models.DateTimeField(null=True, blank=True))]
