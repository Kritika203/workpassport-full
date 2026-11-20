from django.conf import settings
from django.db import models


class Job(models.Model):
    # New client jobs need admin approval before appearing publicly.
    STATUS_CHOICES = [
        ('pending_review', 'Pending review'),
        ('published', 'Published'),
        ('rejected', 'Rejected'),
        ('closed', 'Closed'),
    ]
    BUDGET_TYPES = [('fixed', 'Fixed'), ('hourly', 'Hourly')]
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='posted_jobs')
    title = models.CharField(max_length=180)
    description = models.TextField()
    is_demo = models.BooleanField(default=False)
    external_url = models.URLField(max_length=1000, blank=True)
    deliverables = models.JSONField(default=list, blank=True)
    client_provides = models.JSONField(default=list, blank=True)
    deadline_days = models.PositiveSmallIntegerField(default=7)
    meeting_pattern = models.CharField(max_length=180, blank=True)
    caution_note = models.CharField(max_length=500, blank=True)
    needs_own_laptop = models.BooleanField(default=False)
    internet_need = models.CharField(max_length=80, blank=True)
    category = models.CharField(max_length=80)
    client_name = models.CharField(max_length=140)
    client_country = models.CharField(max_length=100, blank=True)
    required_skills = models.JSONField(default=list, blank=True)
    budget_usd = models.DecimalField(max_digits=10, decimal_places=2)
    budget_type = models.CharField(max_length=10, choices=BUDGET_TYPES, default='fixed')
    beginner_friendly = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending_review')
    # Payment verification should never be asserted by a self-registering client.
    payment_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class SavedJob(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='saved_jobs')
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='saves')
    saved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'job'], name='unique_saved_job')]


class Application(models.Model):
    STATUS_CHOICES = [
        ('submitted', 'Submitted'), ('shortlisted', 'Shortlisted'),
        ('accepted', 'Accepted'), ('rejected', 'Rejected'),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='job_applications')
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='applications')
    message = models.TextField()
    proposed_rate_usd = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='submitted')
    applied_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'job'], name='unique_job_application')]
        ordering = ['-applied_at']

    def __str__(self):
        return f'{self.user.username} -> {self.job.title}'
