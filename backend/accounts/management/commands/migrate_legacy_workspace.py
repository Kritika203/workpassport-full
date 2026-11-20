"""Copy older prototype records to the real tables without removing the originals."""
import json
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from accounts.models import Profile, Skill, SkillVerification, TrainingEntry, WorkspaceState
from opportunities.models import Application, Job, SavedJob
from workflows.models import (ApplicationMessage, ClientContact, EvidenceRecord, Milestone, SafetyCheck,
                              SubmittedOpportunity, UserSafetyPreferences, Workroom)


class Command(BaseCommand):
    help = 'Preview or copy old WorkPassport JSON data into dedicated Django records.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Perform the import. Run without this flag to preview.')

    def handle(self, *args, **options):
        source = Path(__file__).resolve().parents[3] / 'opportunities' / 'management' / 'commands' / 'sample_jobs.json'
        samples = {item['id']: item['title'] for item in json.loads(source.read_text(encoding='utf-8'))}
        counts = {'accounts': 0, 'saved': 0, 'applications': 0, 'evidence': 0, 'messages': 0, 'milestones': 0, 'contributions': 0}
        for workspace in WorkspaceState.objects.select_related('user', 'user__profile').all():
            data = workspace.data or {}
            user = workspace.user
            if not isinstance(data, dict):
                continue
            if not options['apply']:
                self.stdout.write(f'{user.username}: {len(data)} stored keys; use --apply to import')
                counts['accounts'] += 1
                continue
            with transaction.atomic():
                profile, _ = Profile.objects.get_or_create(user=user)
                old = data.get('wp_user_profile') or {}
                if isinstance(old, dict) and profile.role == 'freelancer':
                    fields = {'name': 'display_name', 'about': 'bio', 'headline': 'headline',
                              'district': 'district', 'availability': 'availability',
                              'rateNote': 'rate_note'}
                    for old_name, new_name in fields.items():
                        value = old.get(old_name)
                        if isinstance(value, str) and not getattr(profile, new_name):
                            setattr(profile, new_name, value[:getattr(Profile._meta.get_field(new_name), 'max_length', None) or 2000])
                    for old_name, new_name in [('languages', 'languages'), ('tools', 'tools'), ('workWanted', 'work_wanted')]:
                        value = old.get(old_name)
                        if isinstance(value, list) and not getattr(profile, new_name):
                            setattr(profile, new_name, [x for x in value if isinstance(x, str)][:25])
                    if old.get('onboarded') is True:
                        profile.onboarded = True
                    profile.save()
                    old_levels = data.get('wp_skill_levels') or {}
                    for name in (old.get('skills') or [])[:30]:
                        if not isinstance(name, str) or not name.strip() or len(name) > 100:
                            continue
                        skill = Skill.objects.filter(user=user, name__iexact=name.strip()).first()
                        if not skill:
                            skill = Skill.objects.create(user=user, name=name.strip())
                        level = old_levels.get(name, 'self') if isinstance(old_levels, dict) else 'self'
                        # Old client/institution labels are not independent verification.
                        # Don't import unverifiable institutional/client claims as real badges.
                        level = 'self'
                    for training in (old.get('training') or [])[:25]:
                        if isinstance(training, dict) and isinstance(training.get('title'), str) and training['title']:
                            TrainingEntry.objects.get_or_create(
                                user=user, title=training['title'][:160],
                                institution=str(training.get('where') or '')[:160],
                                defaults={'year': training.get('year') if isinstance(training.get('year'), int) and 1950 <= training['year'] <= 2100 else None},
                            )
                if profile.role == 'client':
                    client_info = data.get('wp_client_profile') or {}
                    if isinstance(client_info, dict):
                        profile.business_name = str(client_info.get('business') or '')[:160]
                        profile.town = str(client_info.get('town') or '')[:120]
                        profile.save(update_fields=['business_name', 'town'])

                def lookup(reference):
                    if isinstance(reference, str) and reference.startswith('api-') and reference[4:].isdigit():
                        return Job.objects.filter(pk=int(reference[4:])).first()
                    title = samples.get(reference)
                    if title:
                        return Job.objects.filter(is_demo=True, title=title).first()
                    return None

                if profile.role == 'freelancer':
                    for key in (data.get('wp_saved') or [])[:300]:
                        job = lookup(key)
                        if job and job.status == 'published':
                            _, created = SavedJob.objects.get_or_create(user=user, job=job)
                            counts['saved'] += bool(created)
                    for old_app in (data.get('wp_applied') or [])[:300]:
                        if not isinstance(old_app, dict):
                            continue
                        job = lookup(old_app.get('jobId'))
                        if not job or not job.is_demo:
                            continue
                        try:
                            rate = Decimal(str(old_app.get('price') or job.budget_usd))
                        except (InvalidOperation, TypeError):
                            rate = job.budget_usd
                        if rate <= 0 or rate > Decimal('9999999'):
                            rate = job.budget_usd
                        app, created = Application.objects.get_or_create(user=user, job=job, defaults={
                            'message': 'Imported practice application.', 'proposed_rate_usd': rate,
                            'status': 'accepted',
                        })
                        counts['applications'] += bool(created)
                    for old_job_id in (data.get('wp_confirmed') or [])[:300]:
                        job = lookup(old_job_id)
                        if not job or not job.is_demo:
                            continue
                        app, _ = Application.objects.get_or_create(user=user, job=job, defaults={
                            'message': 'Imported practice completion.', 'proposed_rate_usd': job.budget_usd,
                            'status': 'accepted',
                        })
                        if app.status != 'accepted':
                            app.status = 'accepted'
                            app.save(update_fields=['status'])
                        room, _ = Workroom.objects.get_or_create(application=app, defaults={'scope': job.description[:2000]})
                        if not room.milestones.exists():
                            Milestone.objects.create(workroom=room, title='Imported practice completion',
                                                     amount_usd=app.proposed_rate_usd, state='released_demo')
                            counts['milestones'] += 1
                    for reference, messages in (data.get('wp_chats') or {}).items():
                        job = lookup(reference)
                        if not job or not job.is_demo or not isinstance(messages, list):
                            continue
                        app = Application.objects.filter(user=user, job=job).first()
                        if not app or app.messages.exists():
                            continue
                        for message in messages[:80]:
                            if not isinstance(message, dict) or not isinstance(message.get('text'), str):
                                continue
                            sender = job.owner if message.get('from') == 'client' else user
                            if sender and message['text'].strip():
                                ApplicationMessage.objects.create(application=app, sender=sender, text=message['text'][:4000])
                                counts['messages'] += 1
                # Restore practice milestone progress for unfinished old workrooms.
                if profile.role == 'freelancer' and isinstance(data.get('wp_workrooms'), dict):
                    for reference, payload in data['wp_workrooms'].items():
                        job = lookup(reference)
                        if not job or not job.is_demo or not isinstance(payload, dict):
                            continue
                        app = Application.objects.filter(user=user, job=job).first()
                        if not app or not isinstance(payload.get('milestones'), list):
                            continue
                        room, _ = Workroom.objects.get_or_create(application=app, defaults={'scope': job.description[:2000]})
                        if room.milestones.exists():
                            continue
                        states = {'not_funded': 'planned', 'funded': 'funded_demo',
                                  'submitted': 'submitted', 'released': 'released_demo'}
                        for position, item in enumerate(payload['milestones'][:15]):
                            if not isinstance(item, dict):
                                continue
                            try:
                                amount = Decimal(str(item.get('amountUSD') or 1))
                            except (InvalidOperation, TypeError):
                                amount = Decimal('1')
                            if amount <= 0 or amount > Decimal('9999999'):
                                amount = Decimal('1')
                            Milestone.objects.create(workroom=room, title=str(item.get('title') or 'Practice task')[:160],
                                amount_usd=amount, state=states.get(item.get('state'), 'planned'), position=position)
                            counts['milestones'] += 1
                if profile.role == 'freelancer' and isinstance(data.get('wp_client_actions'), dict):
                    for reference, flags in data['wp_client_actions'].items():
                        job = lookup(reference)
                        app = Application.objects.filter(user=user, job=job).first() if job else None
                        if not app or not isinstance(flags, dict):
                            continue
                        contact, created = ClientContact.objects.get_or_create(application=app)
                        if created:
                            contact.muted = flags.get('muted') is True
                            contact.blocked = flags.get('blocked') is True
                            contact.save()
                if profile.role == 'client':
                    for record in (data.get('wp_client_jobs') or [])[:100]:
                        if not isinstance(record, dict) or not isinstance(record.get('title'), str):
                            continue
                        if Job.objects.filter(owner=user, title=record['title']).exists():
                            continue
                        try:
                            budget = Decimal(str(record.get('budgetUSD') or 0))
                        except (InvalidOperation, ValueError, TypeError):
                            budget = Decimal('0')
                        if budget <= 0 or budget > Decimal('9999999'):
                            continue
                        Job.objects.create(owner=user, title=record['title'][:180],
                            description=str(record.get('description') or 'Imported client draft')[:10000],
                            category=str(record.get('category') or 'Other')[:80],
                            client_name=str(record.get('clientName') or profile.display_name or user.username)[:140],
                            required_skills=[x for x in record.get('skillsRequired', []) if isinstance(x, str)][:15],
                            budget_usd=budget, status='pending_review', payment_verified=False)
                for row in (data.get('wp_shield_history') or [])[:100]:
                    if not isinstance(row, dict):
                        continue
                    excerpt = str(row.get('snippet') or row.get('text') or '')[:240]
                    if excerpt and not SafetyCheck.objects.filter(owner=user, text_excerpt=excerpt).exists():
                        SafetyCheck.objects.create(owner=user, text_excerpt=excerpt,
                            risk=str(row.get('verdict') or 'unknown')[:12], flags={})
                for row in (data.get('wp_evidence') or [])[:20]:
                    if not isinstance(row, dict) or not isinstance(row.get('text'), str):
                        continue
                    content = row['text'].strip()[:10000]
                    if content and not EvidenceRecord.objects.filter(owner=user, text=content).exists():
                        EvidenceRecord.objects.create(owner=user, text=content,
                            categories=[x for x in row.get('categories', []) if isinstance(x, str)][:12],
                            source=str(row.get('source') or 'page')[:30],
                            job_title=str(row.get('jobTitle') or '')[:180],
                            client_name=str(row.get('clientName') or '')[:140])
                        counts['evidence'] += 1
                for row in (data.get('wp_bring_submissions') or [])[:40]:
                    if not isinstance(row, dict) or row.get('type') not in ('insight', 'opportunity'):
                        continue
                    payload = {k: v for k, v in row.items() if k not in ('id', 'status')}
                    if not SubmittedOpportunity.objects.filter(owner=user, kind=row['type'], payload=payload).exists():
                        SubmittedOpportunity.objects.create(owner=user, kind=row['type'], payload=payload, status='pending')
                        counts['contributions'] += 1
                prefs, _ = UserSafetyPreferences.objects.get_or_create(owner=user)
                if isinstance(data.get('wp_quiet'), dict) and not prefs.quiet_hours:
                    prefs.quiet_hours = data['wp_quiet']
                if isinstance(data.get('wp_trusted_contact'), dict) and not prefs.trusted_contact:
                    prefs.trusted_contact = data['wp_trusted_contact']
                if isinstance(old, dict) and isinstance(old.get('safetyRules'), dict) and not prefs.boundaries:
                    prefs.boundaries = old['safetyRules']
                prefs.save()
                counts['accounts'] += 1
        self.stdout.write(self.style.SUCCESS(str(counts)))
        if options['apply']:
            self.stdout.write('Older workspace records were preserved as a backup. Check the migrated accounts before clearing them.')
