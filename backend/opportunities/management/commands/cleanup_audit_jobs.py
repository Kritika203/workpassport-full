"""Safely close exact audit test listings. Dry-run by default.

Usage: python manage.py cleanup_audit_jobs
       python manage.py cleanup_audit_jobs --apply
Do not delete application/workroom history.
"""
from django.core.management.base import BaseCommand
from opportunities.models import Job


class Command(BaseCommand):
    help = 'Find audit test and unsafe seed listings; optionally close them (no hard deletion).'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Close exact matching listings')

    def handle(self, *args, **options):
        target_titles = {'uihduoiwhodwehdc', 'TEST DELETE',
                         'Promote our app on Telegram, earn $200 per week'}
        targets = Job.objects.filter(title__in=target_titles).exclude(status='closed')
        matches = list(targets.values_list('id', 'title', 'status'))
        if not matches:
            self.stdout.write('No matching open audit listings found.')
            return
        for identifier, title, state in matches:
            self.stdout.write(f'{identifier}: {title} [{state}]')
        if options['apply']:
            updated = targets.update(status='closed')
            self.stdout.write(self.style.SUCCESS(f'Closed {updated} listing(s), preserving records.'))
        else:
            self.stdout.write('Dry-run only. Run with --apply after verifying the titles above.')
