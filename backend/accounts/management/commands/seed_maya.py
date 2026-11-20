import os
from django.core.management.base import BaseCommand, CommandError
from accounts.demo import seed_maya


class Command(BaseCommand):
    help = 'Seed Maya as a normal demo freelancer, never a Django superuser.'

    def handle(self, *args, **kwargs):
        password = os.environ.get('DEMO_MAYA_PASSWORD', '')
        if not password:
            raise CommandError('Set DEMO_MAYA_PASSWORD in backend/.env before seeding.')
        try:
            seed_maya(password)
        except ValueError as error:
            raise CommandError(str(error)) from error
        self.stdout.write(self.style.SUCCESS('Maya demo identity created/updated (no admin privileges).'))
