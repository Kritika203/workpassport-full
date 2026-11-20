from decimal import Decimal
from rest_framework import serializers
from .models import Application, Job, SavedJob


class JobSerializer(serializers.ModelSerializer):
    owner_id = serializers.IntegerField(read_only=True)
    class Meta:
        model = Job
        fields = [
            'id', 'owner_id', 'title', 'description', 'category', 'client_name',
            'client_country', 'required_skills', 'budget_usd', 'budget_type',
            'beginner_friendly', 'payment_verified', 'status', 'created_at', 'is_demo', 'external_url',
            'deliverables', 'client_provides', 'deadline_days', 'meeting_pattern',
            'caution_note', 'needs_own_laptop', 'internet_need',
        ]
        read_only_fields = ['id', 'is_demo', 'payment_verified', 'status', 'created_at']

    def validate_required_skills(self, value):
        if not isinstance(value, list) or len(value) > 15 or any(
            not isinstance(s, str) or not s.strip() or len(s) > 100 for s in value
        ):
            raise serializers.ValidationError('Provide up to 15 skill names.')
        return [s.strip() for s in value]

    def validate_deliverables(self, value):
        if not isinstance(value, list) or len(value) > 15 or any(not isinstance(x, str) or len(x) > 250 for x in value):
            raise serializers.ValidationError('Provide up to fifteen deliverables.')
        return value

    def validate_client_provides(self, value):
        if not isinstance(value, list) or len(value) > 15 or any(not isinstance(x, str) or len(x) > 250 for x in value):
            raise serializers.ValidationError('Provide up to fifteen client resources.')
        return value

    def validate_deadline_days(self, value):
        if not 1 <= value <= 365:
            raise serializers.ValidationError('Choose 1 to 365 days.')
        return value

    def validate_budget_usd(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError('Budget must be positive.')
        return value


class ApplicationSerializer(serializers.ModelSerializer):
    job_title = serializers.CharField(source='job.title', read_only=True)
    applicant_name = serializers.CharField(source='user.username', read_only=True)
    # Application endpoints are private to the applicant or job-owning client.
    # Sharing a district and availability is appropriate only after applying;
    # never expose email, trusted contacts, or private evidence here.
    applicant_location = serializers.SerializerMethodField()
    applicant_availability = serializers.SerializerMethodField()

    def get_applicant_location(self, obj):
        profile = getattr(obj.user, 'profile', None)
        return (profile.district or '').strip() if profile else ''

    def get_applicant_availability(self, obj):
        profile = getattr(obj.user, 'profile', None)
        return (profile.availability or '').strip() if profile else ''

    class Meta:
        model = Application
        fields = [
            'id', 'job', 'job_title', 'applicant_name',
            'applicant_location', 'applicant_availability', 'message', 'proposed_rate_usd', 'status', 'applied_at',
        ]
        read_only_fields = ['id', 'job', 'job_title', 'applicant_name', 'status', 'applied_at']

    def validate_proposed_rate_usd(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError('Proposed rate must be positive.')
        return value


class SavedJobSerializer(serializers.ModelSerializer):
    job = JobSerializer(read_only=True)

    class Meta:
        model = SavedJob
        fields = ['id', 'job', 'saved_at']
