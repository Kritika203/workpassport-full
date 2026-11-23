"""Load sample jobs to demo the API. Never automatically run in production."""
import json
from pathlib import Path
from django.core.management.base import BaseCommand
from opportunities.models import Job
from django.contrib.auth import get_user_model
from accounts.models import Profile


class Command(BaseCommand):
    help = 'Add the original sample FirstWork jobs to the database (demo data only).'

    def handle(self, *args, **options):
        source = Path(__file__).with_name('sample_jobs.json')
        jobs = json.loads(source.read_text(encoding='utf-8'))
        # A demo client owns the fictional jobs. It cannot sign in or access real users.
        User = get_user_model()
        demo_client, _ = User.objects.get_or_create(username='workpassport_sample_client', defaults={
            'email': 'workpassport-sample-client@example.invalid', 'is_active': False,
        })
        demo_client.set_unusable_password()
        demo_client.is_active = False
        demo_client.is_staff = False
        demo_client.is_superuser = False
        demo_client.save()
        Profile.objects.update_or_create(user=demo_client, defaults={
            'role': 'client', 'display_name': 'Vouch Practice Client',
        })
        created = 0
        updated = 0
        for row in jobs:
            job = Job.objects.filter(is_demo=True, title=row['title']).first()
            if not job:
                # This also upgrades existing v22 seeded jobs without deleting applications.
                job = Job.objects.filter(owner__isnull=True, title=row['title']).first()
            if not job:
                job = Job(title=row['title'])
                created += 1
            else:
                updated += 1
            job.owner = demo_client
            job.is_demo = True
            job.title = row['title']
            job.description = row['description']
            job.category = row['category']
            job.client_name = row['clientName']
            job.client_country = row.get('clientCountry', '')
            job.required_skills = row.get('skillsRequired', [])
            job.budget_usd = row['budgetUSD']
            job.budget_type = row.get('budgetType', 'fixed')
            job.beginner_friendly = row.get('beginnerFriendly', True)
            job.deliverables = row.get('deliverables', [])
            job.client_provides = row.get('clientProvides', [])
            job.deadline_days = row.get('deadlineDays', 7)
            job.meeting_pattern = row.get('meetingTimeNepal', '')
            job.caution_note = 'Practice listing. No client or payment has been verified.'
            job.needs_own_laptop = row.get('needsOwnLaptop', False)
            job.internet_need = row.get('internetNeed', '')
            job.status = 'published'
            job.payment_verified = False
            job.moderation_source = 'practice'
            job.moderation_reasons = ['sample_job_not_verified']
            job.save()
        self.stdout.write(self.style.SUCCESS(f'Created {created} and updated {updated} practice jobs.'))
