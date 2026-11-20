from django.conf import settings
from django.db import models


class Profile(models.Model):
    FREELANCER = 'freelancer'
    CLIENT = 'client'
    ROLE_CHOICES = [(FREELANCER, 'Freelancer'), (CLIENT, 'Client')]
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default=FREELANCER)
    display_name = models.CharField(max_length=120, blank=True)
    bio = models.TextField(blank=True)
    headline = models.CharField(max_length=200, blank=True)
    district = models.CharField(max_length=120, blank=True)
    languages = models.JSONField(default=list, blank=True)
    availability = models.CharField(max_length=240, blank=True)
    rate_note = models.CharField(max_length=240, blank=True)
    tools = models.JSONField(default=list, blank=True)
    work_wanted = models.JSONField(default=list, blank=True)
    onboarded = models.BooleanField(default=False)
    email_verified = models.BooleanField(default=False)
    business_name = models.CharField(max_length=160, blank=True)
    town = models.CharField(max_length=120, blank=True)
    preferred_language = models.CharField(max_length=2, choices=[('en', 'English'), ('ne', 'Nepali')], default='en')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.user.username} ({self.role})'


class Skill(models.Model):
    LEVELS = [('beginner', 'Beginner'), ('intermediate', 'Intermediate'), ('advanced', 'Advanced')]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='skills')
    name = models.CharField(max_length=100)
    level = models.CharField(max_length=16, choices=LEVELS, default='beginner')

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'name'], name='unique_user_skill')]
        ordering = ['name']

    def __str__(self):
        return self.name


class TrainingEntry(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='training_entries')
    title = models.CharField(max_length=160)
    institution = models.CharField(max_length=160, blank=True)
    year = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        ordering = ['-year', 'id']


class SkillVerification(models.Model):
    # A freelancer can provide proof. Only trusted reviewers can verify it.
    LEVELS = [
        ('self', 'Self-added'), ('demonstrated', 'Demonstrated'),
        ('institution', 'Institution-verified'), ('client', 'Client-confirmed'),
        ('platform', 'Platform-verified'),
    ]
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE, related_name='verifications')
    level = models.CharField(max_length=20, choices=LEVELS, default='self')
    evidence_url = models.URLField(max_length=1000, blank=True)
    proof_asset = models.ForeignKey('workflows.ProofAsset', null=True, blank=True, on_delete=models.SET_NULL)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['skill', 'level'], name='unique_skill_proof_level')]
        ordering = ['level', 'id']


class WorkSample(models.Model):
    # Phase 1 stores links, not uploaded private documents.
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='work_samples')
    skill = models.ForeignKey(Skill, on_delete=models.SET_NULL, null=True, blank=True, related_name='samples')
    title = models.CharField(max_length=140)
    description = models.TextField(blank=True)
    url = models.URLField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class WorkspaceState(models.Model):
    # Stores the user's WorkPassport screen data separately from other accounts.
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='workspace_state')
    data = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Workspace for {self.user.username}'


class SafetyReport(models.Model):
    TYPES = [('job', 'Job listing'), ('client', 'Client message')]
    STATUSES = [('new', 'New'), ('reviewing', 'Reviewing'), ('closed', 'Closed')]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='safety_reports')
    kind = models.CharField(max_length=12, choices=TYPES)
    job_reference = models.CharField(max_length=100)
    reason = models.CharField(max_length=100)
    status = models.CharField(max_length=12, choices=STATUSES, default='new')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
