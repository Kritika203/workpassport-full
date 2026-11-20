from django.db import migrations, models
import django.db.models.deletion
import workflows.models


class Migration(migrations.Migration):
    dependencies = [('workflows', '0008_external_saved_job')]

    operations = [
        migrations.AddField(model_name='milestone', name='delivery_note', field=models.TextField(blank=True)),
        migrations.AddField(model_name='milestone', name='delivery_links', field=models.JSONField(default=list)),
        migrations.AddField(model_name='milestone', name='delivery_updated_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='milestone', name='submitted_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name='milestone', name='revision_note', field=models.TextField(blank=True)),
        migrations.AddField(model_name='milestone', name='reviewed_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.AlterField(model_name='milestone', name='state', field=models.CharField(
            choices=[('planned', 'Planned'), ('funded_demo', 'Funding simulated'),
                     ('submitted', 'Submitted'), ('revision_requested', 'Revision requested'),
                     ('released_demo', 'Payment simulated')], default='planned', max_length=20)),
        migrations.CreateModel(
            name='MilestoneFile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('original_name', models.CharField(max_length=120)),
                ('kind', models.CharField(choices=[('jpg', 'JPEG'), ('png', 'PNG'), ('pdf', 'PDF')], max_length=4)),
                ('file', models.FileField(upload_to=workflows.models.private_milestone_upload_path)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('milestone', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='files', to='workflows.milestone')),
            ],
            options={'ordering': ['created_at', 'id']},
        ),
    ]
