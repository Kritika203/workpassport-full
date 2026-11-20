# Normalize implicit model IDs to Django's default BigAutoField definition.
# This is the migration detected as 0006 by fresh Windows installations.
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('workflows', '0005_checkin_reminder')]
    operations = [
        migrations.AlterField(model_name='applicationmessage', name='id', field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
        migrations.AlterField(model_name='clientcontact', name='id', field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
        migrations.AlterField(model_name='evidencerecord', name='id', field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
        migrations.AlterField(model_name='inboxnotification', name='id', field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
        migrations.AlterField(model_name='milestone', name='id', field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
        migrations.AlterField(model_name='proofasset', name='id', field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
        migrations.AlterField(model_name='publicpassportlink', name='id', field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
        migrations.AlterField(model_name='safetycheck', name='id', field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
        migrations.AlterField(model_name='safetycheckin', name='id', field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
        migrations.AlterField(model_name='submittedopportunity', name='id', field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
        migrations.AlterField(model_name='usersafetypreferences', name='id', field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
        migrations.AlterField(model_name='workroom', name='id', field=models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
    ]
