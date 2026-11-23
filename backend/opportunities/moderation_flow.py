from django.db import transaction
from django.utils import timezone
from .models import Job, JobModerationEvent
from .moderation import evaluate


def screen_job(job, previous=''):
    outcome, score, reasons, _ = evaluate(job)
    duplicate = Job.objects.filter(owner=job.owner, title__iexact=job.title).exclude(pk=job.pk).exclude(status='closed').exists()
    restricted = previous in ('suspended', 'rejected') or 'prior_staff_restriction' in (job.moderation_reasons or [])
    if duplicate: reasons.append('potential_duplicate')
    if restricted: reasons.append('prior_staff_restriction')
    new_status = 'published' if outcome == 'publish' and not (duplicate or restricted) else 'pending_review'
    if not reasons: reasons = ['passed_automated_checks_not_verified']
    with transaction.atomic():
        job.status = new_status
        job.payment_verified = False
        job.moderation_source = 'automated'
        job.moderation_score = score
        job.moderation_reasons = reasons
        job.moderated_at = timezone.now()
        job.save(update_fields=['status', 'payment_verified', 'moderation_source', 'moderation_score', 'moderation_reasons', 'moderated_at'])
        JobModerationEvent.objects.create(job=job, source='automated', old_status=previous, new_status=new_status, reason=', '.join(reasons), score=score)
    return job
