from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import workflows.models


class Migration(migrations.Migration):

    dependencies = [
        ('workflows', '0010_milestone_review_checks'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PaymentMethod',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kind', models.CharField(choices=[('esewa', 'eSewa'), ('khalti', 'Khalti'), ('bank', 'Bank transfer')], max_length=10)),
                ('holder_name', models.CharField(max_length=120)),
                ('mobile', models.CharField(blank=True, max_length=20)),
                ('bank_name', models.CharField(blank=True, max_length=120)),
                ('account_number', models.CharField(blank=True, max_length=40)),
                ('branch', models.CharField(blank=True, max_length=120)),
                ('is_preferred', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payment_methods', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-is_preferred', 'id']},
        ),
        migrations.CreateModel(
            name='PaymentRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('method_snapshot', models.JSONField(default=dict)),
                ('attempt', models.PositiveSmallIntegerField(default=1)),
                ('agreed_amount_usd', models.DecimalField(decimal_places=2, max_digits=10)),
                ('reported_amount_usd', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('currency', models.CharField(default='USD', max_length=3)),
                ('status', models.CharField(choices=[('awaiting_payment', 'Awaiting Payment'), ('sent', 'Employer Marked as Sent'), ('confirmed', 'Receipt Confirmed by Freelancer'), ('disputed', 'Disputed'), ('cancelled', 'Cancelled')], default='awaiting_payment', max_length=20)),
                ('transaction_ref', models.CharField(blank=True, max_length=120)),
                ('paid_date', models.DateField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('employer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payments_made', to=settings.AUTH_USER_MODEL)),
                ('freelancer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payments_received', to=settings.AUTH_USER_MODEL)),
                ('method', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='payments', to='workflows.paymentmethod')),
                ('milestone', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payments', to='workflows.milestone')),
                ('workroom', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payments', to='workflows.workroom')),
            ],
            options={'ordering': ['-created_at', '-id']},
        ),
        migrations.CreateModel(
            name='PaymentReceipt',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('original_name', models.CharField(max_length=120)),
                ('kind', models.CharField(choices=[('jpg', 'JPEG'), ('png', 'PNG'), ('pdf', 'PDF')], max_length=4)),
                ('file', models.FileField(upload_to=workflows.models.private_receipt_upload_path)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('payment', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='receipt', to='workflows.paymentrecord')),
            ],
        ),
        migrations.CreateModel(
            name='PaymentDispute',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('reason', models.CharField(choices=[('not_received', 'Payment not received'), ('wrong_amount', 'Incorrect amount'), ('invalid_reference', 'Invalid transaction reference'), ('suspicious_receipt', 'Suspicious receipt'), ('other', 'Other payment problem')], max_length=20)),
                ('note', models.TextField()),
                ('evidence_name', models.CharField(blank=True, max_length=120)),
                ('evidence_kind', models.CharField(blank=True, max_length=4)),
                ('evidence_file', models.FileField(blank=True, upload_to=workflows.models.private_dispute_upload_path)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('payment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='disputes', to='workflows.paymentrecord')),
                ('reporter', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payment_disputes', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at', '-id']},
        ),
        migrations.CreateModel(
            name='PaymentEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(max_length=20)),
                ('note', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payment_events', to=settings.AUTH_USER_MODEL)),
                ('payment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='events', to='workflows.paymentrecord')),
            ],
            options={'ordering': ['created_at', 'id']},
        ),
    ]
