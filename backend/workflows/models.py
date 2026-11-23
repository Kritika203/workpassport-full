# Records shared by the freelancer and client workflows.
from django.conf import settings
from django.db import models
import uuid


class SafetyCheck(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='safety_checks')
    text_excerpt = models.CharField(max_length=240)
    risk = models.CharField(max_length=12)
    flags = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']


class EvidenceRecord(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='evidence_records')
    text = models.TextField()
    categories = models.JSONField(default=list)
    source = models.CharField(max_length=30, default='page')
    job_title = models.CharField(max_length=180, blank=True)
    client_name = models.CharField(max_length=140, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']


class SubmittedOpportunity(models.Model):
    OPPORTUNITY = 'opportunity'
    INSIGHT = 'insight'
    STATUS = [('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')]
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='contributed_opportunities')
    kind = models.CharField(max_length=16, choices=[(OPPORTUNITY, 'Opportunity'), (INSIGHT, 'Insight')])
    payload = models.JSONField(default=dict)
    status = models.CharField(max_length=10, choices=STATUS, default='pending')
    published_job = models.ForeignKey('opportunities.Job', null=True, blank=True, on_delete=models.SET_NULL)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at', '-id']


class ClientContact(models.Model):
    application = models.OneToOneField('opportunities.Application', on_delete=models.CASCADE, related_name='contact_settings')
    muted = models.BooleanField(default=False)
    blocked = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)


class ApplicationMessage(models.Model):
    application = models.ForeignKey('opportunities.Application', on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']


class Workroom(models.Model):
    # A real agreement exists only for an accepted application.
    application = models.OneToOneField('opportunities.Application', on_delete=models.CASCADE, related_name='workroom')
    scope = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Milestone(models.Model):
    STATES = [('planned', 'Planned'), ('funded_demo', 'Funding simulated'),
              ('submitted', 'Submitted'), ('revision_requested', 'Revision requested'),
              ('released_demo', 'Payment simulated')]
    workroom = models.ForeignKey(Workroom, on_delete=models.CASCADE, related_name='milestones')
    title = models.CharField(max_length=160)
    amount_usd = models.DecimalField(max_digits=10, decimal_places=2)
    state = models.CharField(max_length=20, choices=STATES, default='planned')
    position = models.PositiveSmallIntegerField(default=0)
    # A milestone's work must be recorded before its status can become Submitted.
    delivery_note = models.TextField(blank=True)
    delivery_links = models.JSONField(default=list)
    delivery_updated_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    revision_note = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    # Names of deliverable specs the client ticked at review time.
    review_checks = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def has_delivery(self):
        return bool(self.delivery_note.strip() or self.delivery_links or self.files.exists())

    class Meta:
        ordering = ['position', 'id']


def private_milestone_upload_path(instance, _filename):
    # No user-selected path or extension is trusted for the storage key.
    return f'private_milestones/{instance.milestone_id}/{uuid.uuid4().hex}.{instance.kind}'


class MilestoneFile(models.Model):
    milestone = models.ForeignKey(Milestone, on_delete=models.CASCADE, related_name='files')
    original_name = models.CharField(max_length=120)
    kind = models.CharField(max_length=4, choices=[('jpg', 'JPEG'), ('png', 'PNG'), ('pdf', 'PDF')])
    file = models.FileField(upload_to=private_milestone_upload_path)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']


class UserSafetyPreferences(models.Model):
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='work_safety_preferences')
    quiet_hours = models.JSONField(default=dict)
    # This field is personal data and must not be included in shared profiles.
    trusted_contact = models.JSONField(default=dict)
    boundaries = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)


class SafetyCheckIn(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='checkins')
    scheduled_for = models.DateTimeField()
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    reminder_sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-scheduled_for', '-id']


class InboxNotification(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='inbox')
    kind = models.CharField(max_length=40)
    message = models.CharField(max_length=240)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']


class ProofAsset(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='proof_assets')
    skill_name = models.CharField(max_length=100)
    kind = models.CharField(max_length=10, choices=[('link', 'Link'), ('photo', 'Photo')])
    note = models.CharField(max_length=140, blank=True)
    external_url = models.URLField(max_length=1000, blank=True)
    image_file = models.FileField(upload_to='private_proofs/', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']


class PublicPassportLink(models.Model):
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='public_passport_link')
    token = models.CharField(max_length=60, unique=True)
    enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


class StaffAuditLog(models.Model):
    # Keep who approved or closed a case, without storing private report text.
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    action = models.CharField(max_length=60)
    target_model = models.CharField(max_length=80)
    target_id = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']


class BrowserPairingCode(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='browser_pairings')
    code_digest = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)


class BrowserExtensionSession(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='extension_sessions')
    label = models.CharField(max_length=80, default='Chrome extension')
    token_digest = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at', '-id']


class ExternalSavedJob(models.Model):
    """Job link the freelancer intentionally saved from the browser extension.

    It is a private bookmark, *not* a vetted listing on FirstWork.
    """
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='external_saved_jobs')
    title = models.CharField(max_length=180)
    external_url = models.URLField(max_length=1200, blank=True)
    text_excerpt = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']

def private_receipt_upload_path(instance, _filename):
    # No user-selected path or extension is trusted for the storage key.
    return f'private_receipts/{instance.payment_id}/{uuid.uuid4().hex}.{instance.kind}'


def private_dispute_upload_path(instance, _filename):
    return f'private_disputes/{instance.payment_id}/{uuid.uuid4().hex}.{instance.evidence_kind}'


class PaymentMethod(models.Model):
    """A freelancer's own receiving details. Never shown publicly; the
    necessary fields are revealed only to the employer inside a payment."""
    KINDS = [('esewa', 'eSewa'), ('khalti', 'Khalti'), ('bank', 'Bank transfer')]
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payment_methods')
    kind = models.CharField(max_length=10, choices=KINDS)
    holder_name = models.CharField(max_length=120)
    mobile = models.CharField(max_length=20, blank=True)
    bank_name = models.CharField(max_length=120, blank=True)
    account_number = models.CharField(max_length=40, blank=True)
    branch = models.CharField(max_length=120, blank=True)
    is_preferred = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_preferred', 'id']

    def snapshot(self):
        """Only the fields the employer needs to pay, frozen onto the record."""
        snap = {'kind': self.kind, 'holder_name': self.holder_name}
        if self.kind in ('esewa', 'khalti'):
            snap['mobile'] = self.mobile
        else:
            snap.update({'bank_name': self.bank_name, 'account_number': self.account_number,
                         'branch': self.branch})
        return snap


class PaymentRecord(models.Model):
    """One payment attempt for one milestone. WorkPassport never holds money:
    this record coordinates a direct transfer made outside the platform."""
    STATUSES = [('awaiting_payment', 'Awaiting Payment'),
                ('sent', 'Employer Marked as Sent'),
                ('confirmed', 'Receipt Confirmed by Freelancer'),
                ('disputed', 'Disputed'),
                ('cancelled', 'Cancelled')]
    ACTIVE = ('awaiting_payment', 'sent', 'confirmed')
    milestone = models.ForeignKey(Milestone, on_delete=models.CASCADE, related_name='payments')
    workroom = models.ForeignKey(Workroom, on_delete=models.CASCADE, related_name='payments')
    employer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payments_made')
    freelancer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payments_received')
    method = models.ForeignKey(PaymentMethod, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    method_snapshot = models.JSONField(default=dict)
    attempt = models.PositiveSmallIntegerField(default=1)
    agreed_amount_usd = models.DecimalField(max_digits=10, decimal_places=2)
    reported_amount_usd = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default='USD')
    status = models.CharField(max_length=20, choices=STATUSES, default='awaiting_payment')
    transaction_ref = models.CharField(max_length=120, blank=True)
    paid_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']


class PaymentReceipt(models.Model):
    payment = models.OneToOneField(PaymentRecord, on_delete=models.CASCADE, related_name='receipt')
    original_name = models.CharField(max_length=120)
    kind = models.CharField(max_length=4, choices=[('jpg', 'JPEG'), ('png', 'PNG'), ('pdf', 'PDF')])
    file = models.FileField(upload_to=private_receipt_upload_path)
    created_at = models.DateTimeField(auto_now_add=True)


class PaymentDispute(models.Model):
    REASONS = [('not_received', 'Payment not received'),
               ('wrong_amount', 'Incorrect amount'),
               ('invalid_reference', 'Invalid transaction reference'),
               ('suspicious_receipt', 'Suspicious receipt'),
               ('other', 'Other payment problem')]
    payment = models.ForeignKey(PaymentRecord, on_delete=models.CASCADE, related_name='disputes')
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payment_disputes')
    reason = models.CharField(max_length=20, choices=REASONS)
    note = models.TextField()
    evidence_name = models.CharField(max_length=120, blank=True)
    evidence_kind = models.CharField(max_length=4, blank=True)
    evidence_file = models.FileField(upload_to=private_dispute_upload_path, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']


class PaymentEvent(models.Model):
    """Auditable history: who did what to this payment, and when."""
    payment = models.ForeignKey(PaymentRecord, on_delete=models.CASCADE, related_name='events')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payment_events')
    action = models.CharField(max_length=20)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']
