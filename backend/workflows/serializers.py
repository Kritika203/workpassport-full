from rest_framework import serializers
from .models import (EvidenceRecord, SubmittedOpportunity, ApplicationMessage, Workroom,
                     Milestone, MilestoneFile, UserSafetyPreferences, SafetyCheckIn, InboxNotification, SafetyCheck)


class EvidenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvidenceRecord
        fields = ['id', 'text', 'categories', 'source', 'job_title', 'client_name', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_text(self, value):
        if not value.strip() or len(value) > 10000:
            raise serializers.ValidationError('Evidence must be 1 to 10,000 characters.')
        return value.strip()

    def validate_categories(self, value):
        if not isinstance(value, list) or len(value) > 12 or any(not isinstance(x, str) or len(x) > 30 for x in value):
            raise serializers.ValidationError('Invalid categories.')
        return value


class ContributionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmittedOpportunity
        fields = ['id', 'kind', 'payload', 'status', 'created_at', 'published_job']
        read_only_fields = ['id', 'status', 'created_at', 'published_job']

    def validate_payload(self, value):
        if not isinstance(value, dict) or len(value) > 30:
            raise serializers.ValidationError('Expected a submission object.')
        if len(str(value)) > 12000:
            raise serializers.ValidationError('Submission is too large.')
        return value

    def validate(self, attrs):
        body = attrs.get('payload', {})
        if attrs.get('kind') == 'opportunity' and not all(isinstance(body.get(k), str) and body[k].strip() for k in ('title', 'description', 'organisation')):
            raise serializers.ValidationError({'payload': 'An opportunity requires a title, description and organisation.'})
        if attrs.get('kind') == 'insight' and not isinstance(body.get('text'), str):
            raise serializers.ValidationError({'payload': 'A skills insight requires text.'})
        return attrs


class MessageSerializer(serializers.ModelSerializer):
    sender_id = serializers.IntegerField(read_only=True)
    class Meta:
        model = ApplicationMessage
        fields = ['id', 'sender_id', 'text', 'created_at']
        read_only_fields = ['id', 'sender_id', 'created_at']

    def validate_text(self, value):
        if not value.strip() or len(value) > 4000:
            raise serializers.ValidationError('Message must be 1 to 4,000 characters.')
        return value.strip()


class MilestoneFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = MilestoneFile
        fields = ['id', 'original_name', 'kind', 'created_at']
        read_only_fields = fields


class MilestoneSerializer(serializers.ModelSerializer):
    files = MilestoneFileSerializer(many=True, read_only=True)
    has_delivery = serializers.BooleanField(read_only=True)

    class Meta:
        model = Milestone
        fields = ['id', 'title', 'amount_usd', 'state', 'position', 'created_at',
                  'delivery_note', 'delivery_links', 'delivery_updated_at',
                  'submitted_at', 'revision_note', 'reviewed_at', 'has_delivery', 'files',
                  'review_checks']
        read_only_fields = ['id', 'state', 'created_at', 'delivery_note', 'delivery_links',
                            'delivery_updated_at', 'submitted_at', 'revision_note',
                            'reviewed_at', 'has_delivery', 'files', 'review_checks']

    def validate_amount_usd(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be positive.')
        return value


class WorkroomSerializer(serializers.ModelSerializer):
    milestones = MilestoneSerializer(many=True, read_only=True)
    deliverable_specs = serializers.SerializerMethodField()
    payments = serializers.SerializerMethodField()

    def get_payments(self, obj):
        # Latest DirectPay record per milestone, keyed by milestone id.
        from .payment_views import PaymentRecordSerializer
        latest = {}
        for record in obj.payments.all().order_by('created_at', 'id'):
            latest[record.milestone_id] = record
        return {str(mid): PaymentRecordSerializer(record, context=self.context).data for mid, record in latest.items()}

    def get_deliverable_specs(self, obj):
        items = obj.application.job.deliverables or []
        return [d for d in items if isinstance(d, dict) and isinstance(d.get('name'), str)]
    application_id = serializers.IntegerField(read_only=True)
    is_demo = serializers.BooleanField(source='application.job.is_demo', read_only=True)
    agreed_amount_usd = serializers.DecimalField(source='application.proposed_rate_usd', max_digits=10, decimal_places=2, read_only=True)
    total_allocated_usd = serializers.SerializerMethodField()
    total_released_usd = serializers.SerializerMethodField()
    is_complete = serializers.SerializerMethodField()

    def get_total_allocated_usd(self, obj):
        return str(sum((m.amount_usd for m in obj.milestones.all()), start=0))

    def get_total_released_usd(self, obj):
        return str(sum((m.amount_usd for m in obj.milestones.all() if m.state == 'released_demo'), start=0))

    def get_is_complete(self, obj):
        milestones = list(obj.milestones.all())
        return bool(milestones and
                    sum((m.amount_usd for m in milestones), start=0) == obj.application.proposed_rate_usd and
                    all(m.state == 'released_demo' and m.has_delivery for m in milestones))

    class Meta:
        model = Workroom
        fields = ['id', 'application_id', 'scope', 'created_at', 'milestones', 'is_demo',
                  'agreed_amount_usd', 'total_allocated_usd', 'total_released_usd', 'is_complete',
                  'deliverable_specs', 'payments']
        read_only_fields = ['id', 'created_at', 'milestones', 'application_id']


class PreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSafetyPreferences
        fields = ['quiet_hours', 'trusted_contact', 'boundaries', 'updated_at']
        read_only_fields = ['updated_at']

    def validate(self, value):
        for k in ('quiet_hours', 'trusted_contact', 'boundaries'):
            if k in value and (not isinstance(value[k], dict) or len(str(value[k])) > 1500):
                raise serializers.ValidationError({k: 'Invalid settings.'})
        return value


class CheckInSerializer(serializers.ModelSerializer):
    class Meta:
        model = SafetyCheckIn
        fields = ['id', 'scheduled_for', 'acknowledged_at', 'reminder_sent_at', 'created_at']
        read_only_fields = ['id', 'acknowledged_at', 'reminder_sent_at', 'created_at']


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = InboxNotification
        fields = ['id', 'kind', 'message', 'is_read', 'created_at']
        read_only_fields = ['id', 'kind', 'message', 'created_at']


class CheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = SafetyCheck
        fields = ['id', 'text_excerpt', 'risk', 'flags', 'created_at']
