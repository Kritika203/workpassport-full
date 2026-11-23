from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workflows', '0009_milestone_delivery'),
    ]

    operations = [
        migrations.AddField(
            model_name='milestone',
            name='review_checks',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
