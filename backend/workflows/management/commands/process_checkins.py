"""Create in-app reminders for missed safety check-ins. Run via cron every minute."""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from workflows.models import SafetyCheckIn, InboxNotification


class Command(BaseCommand):
    help = 'Record missed safety check-ins and create an in-app notification.'

    def handle(self, *args, **options):
        now = timezone.now()
        total = 0
        with transaction.atomic():
            rows = SafetyCheckIn.objects.select_for_update().filter(
                acknowledged_at__isnull=True, reminder_sent_at__isnull=True,
                scheduled_for__lte=now,
            )[:500]
            for checkin in rows:
                InboxNotification.objects.create(owner=checkin.owner, kind='checkin',
                    message='Your safety check-in time has passed. Please open WorkPassport and check in.')
                checkin.reminder_sent_at = now
                checkin.save(update_fields=['reminder_sent_at'])
                total += 1
        self.stdout.write(f'Created {total} local check-in reminders. No emergency messages were sent.')
