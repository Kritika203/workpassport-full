from decimal import Decimal
from rest_framework import serializers
from .models import Application, Job, SavedJob


class JobSerializer(serializers.ModelSerializer):
    owner_id = serializers.IntegerField(read_only=True)
    moderation_label = serializers.SerializerMethodField()
    def get_moderation_label(self, job):
        if job.is_demo: return 'Sample job: not independently verified'
        if job.status == 'published' and job.moderation_source == 'automated': return 'Passed automated checks; not independently verified'
        if job.status == 'published' and job.moderation_source == 'staff': return 'Reviewed by staff; employer and payment not necessarily verified'
        return 'Not independently verified'

    class Meta:
        model = Job
        fields = [
            'id', 'owner_id', 'title', 'description', 'category', 'client_name',
            'client_country', 'required_skills', 'budget_usd', 'budget_type',
            'beginner_friendly', 'payment_verified', 'status', 'moderation_label', 'moderation_reasons', 'created_at', 'is_demo', 'external_url',
            'deliverables', 'client_provides', 'deadline_days', 'meeting_pattern',
            'caution_note', 'needs_own_laptop', 'internet_need',
        ]
        read_only_fields = ['id', 'is_demo', 'payment_verified', 'status', 'moderation_label', 'moderation_reasons', 'created_at']

    def validate_required_skills(self, value):
        if not isinstance(value, list) or len(value) > 15 or any(
            not isinstance(s, str) or not s.strip() or len(s) > 100 for s in value
        ):
            raise serializers.ValidationError('Provide up to 15 skill names.')
        return [s.strip() for s in value]

    # Mirror of src/utils/deliverables.js. A deliverable is either a legacy
    # plain line or a detailed spec object.
    FORMAT_MAX_MB = {
        'png': 10, 'jpg': 10, 'jpeg': 10, 'svg': 10, 'webp': 10, 'gif': 10,
        'pdf': 10, 'docx': 10, 'txt': 10, 'xlsx': 10, 'csv': 10,
        'mp4': 100, 'mov': 100, 'mp3': 25, 'wav': 25,
        'zip': 50, 'psd': 50, 'ai': 50, 'fig': 50,
    }
    SPEC_KEYS = {'name', 'description', 'quantity', 'formats', 'max_mb', 'link_allowed', 'milestone'}

    def validate_deliverables(self, value):
        if not isinstance(value, list) or len(value) > 15:
            raise serializers.ValidationError('Provide up to fifteen deliverables.')
        cleaned = []
        for item in value:
            if isinstance(item, str):
                if len(item) > 250:
                    raise serializers.ValidationError('Deliverable lines must be 250 characters or fewer.')
                cleaned.append(item)
                continue
            if not isinstance(item, dict) or not set(item) <= self.SPEC_KEYS:
                raise serializers.ValidationError('Each deliverable must be a short line or a detailed spec.')
            name = item.get('name')
            description = item.get('description')
            quantity = item.get('quantity')
            formats = item.get('formats')
            max_mb = item.get('max_mb')
            link_allowed = item.get('link_allowed', False)
            milestone = item.get('milestone')
            if not isinstance(name, str) or not 3 <= len(name.strip()) <= 120:
                raise serializers.ValidationError('Each spec needs a name of 3 to 120 characters.')
            if not isinstance(description, str) or not 20 <= len(description.strip()) <= 1000:
                raise serializers.ValidationError('Each spec needs an exact description of 20 to 1,000 characters.')
            if not isinstance(quantity, int) or isinstance(quantity, bool) or not 1 <= quantity <= 999:
                raise serializers.ValidationError('Spec quantity must be a whole number from 1 to 999.')
            if (not isinstance(formats, list) or not 1 <= len(formats) <= 12
                    or any(not isinstance(f, str) or f.lower() not in self.FORMAT_MAX_MB for f in formats)):
                raise serializers.ValidationError('Spec formats must be chosen from the supported format list.')
            formats = [f.lower() for f in formats]
            cap = min(self.FORMAT_MAX_MB[f] for f in formats)
            if isinstance(max_mb, bool) or not isinstance(max_mb, (int, float)) or not 1 <= max_mb <= cap:
                raise serializers.ValidationError(f'Spec max size must be between 1 and {cap} MB for the chosen formats.')
            if not isinstance(link_allowed, bool):
                raise serializers.ValidationError('Spec link_allowed must be true or false.')
            if milestone is not None and (not isinstance(milestone, int) or isinstance(milestone, bool) or not 0 <= milestone <= 20):
                raise serializers.ValidationError('Spec milestone must be a whole number from 1 to 20, or empty for the whole job.')
            cleaned.append({
                'name': name.strip(), 'description': description.strip(),
                'quantity': quantity, 'formats': formats, 'max_mb': max_mb,
                'link_allowed': link_allowed, 'milestone': milestone,
            })
        return cleaned

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


PROOF_ORDER = ['self', 'demonstrated', 'institution', 'client', 'platform']


def passport_summary(user):
    """The public WorkPassport summary for one freelancer: skills with their
    highest proof level, verified proof count, completed jobs (fully released
    Workrooms only) and training. No contact details or private evidence."""
    from accounts.models import SkillVerification
    skills = []
    for skill in user.skills.all():
        levels = [v.level for v in skill.verifications.all()]
        proof = max(levels, key=PROOF_ORDER.index) if levels else 'self'
        skills.append({'name': skill.name, 'level': skill.level, 'proof': proof})
    proofs = SkillVerification.objects.filter(skill__user=user).exclude(level='self').count()
    completed = 0
    accepted = (Application.objects.filter(user=user, status='accepted')
                .prefetch_related('workroom__milestones'))
    for app in accepted:
        room = getattr(app, 'workroom', None)
        if room is None:
            continue
        milestones = list(room.milestones.all())
        if (milestones
                and sum((x.amount_usd for x in milestones), start=0) == app.proposed_rate_usd
                and all(x.state == 'released_demo' and x.has_delivery for x in milestones)):
            completed += 1
    training = [{'title': e.title, 'institution': e.institution, 'year': e.year}
                for e in user.training_entries.all()]
    return {'skills': skills, 'proofs': proofs, 'completed_jobs': completed, 'training': training}


class ApplicationSerializer(serializers.ModelSerializer):
    job_title = serializers.CharField(source='job.title', read_only=True)
    applicant_name = serializers.CharField(source='user.username', read_only=True)
    # Application endpoints are private to the applicant or job-owning client.
    # Sharing a district and availability is appropriate only after applying;
    # never expose email, trusted contacts, or private evidence here.
    applicant_location = serializers.SerializerMethodField()
    applicant_availability = serializers.SerializerMethodField()
    # WorkPassport summary: what the client is entitled to see about an
    # applicant to their own job. No contact details, no private evidence.
    applicant_skills = serializers.SerializerMethodField()
    applicant_proofs = serializers.SerializerMethodField()
    applicant_completed_jobs = serializers.SerializerMethodField()
    applicant_training = serializers.SerializerMethodField()

    def get_applicant_skills(self, obj):
        return passport_summary(obj.user)['skills']

    def get_applicant_proofs(self, obj):
        return passport_summary(obj.user)['proofs']

    def get_applicant_completed_jobs(self, obj):
        return passport_summary(obj.user)['completed_jobs']

    def get_applicant_training(self, obj):
        return passport_summary(obj.user)['training']

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
            'decision_reason', 'applicant_skills', 'applicant_proofs',
            'applicant_completed_jobs', 'applicant_training',
        ]
        read_only_fields = ['id', 'job', 'job_title', 'applicant_name', 'status', 'applied_at',
                            'decision_reason', 'applicant_skills', 'applicant_proofs',
                            'applicant_completed_jobs', 'applicant_training']

    def validate_proposed_rate_usd(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError('Proposed rate must be positive.')
        return value


class SavedJobSerializer(serializers.ModelSerializer):
    job = JobSerializer(read_only=True)

    class Meta:
        model = SavedJob
        fields = ['id', 'job', 'saved_at']
