from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from accounts.models import Profile
from .models import Application, Job

User = get_user_model()


class JobTests(APITestCase):
    def setUp(self):
        self.freelancer = User.objects.create_user(username='freelancer', password='pass123')
        self.other = User.objects.create_user(username='other', password='pass123')
        self.client_user = User.objects.create_user(username='client_user', password='pass123')
        self.other_client = User.objects.create_user(username='other_client', password='pass123')
        for user in (self.freelancer, self.other):
            Profile.objects.create(user=user, role='freelancer')
        for user in (self.client_user, self.other_client):
            Profile.objects.create(user=user, role='client')
        self.job = Job.objects.create(
            owner=self.client_user, title='Canva design', description='Design a logo',
            client_name='Example Client', category='Design', required_skills=['Canva'],
            budget_usd=40, status='published'
        )

    def test_client_jobs_need_moderation(self):
        self.client.force_authenticate(user=self.client_user)
        r = self.client.post('/api/client/jobs/', {
            'title': 'New job', 'description': 'Some work', 'category': 'Writing',
            'client_name': 'Example Inc', 'budget_usd': '30.00',
            'status': 'published', 'payment_verified': True,
        }, format='json')
        self.assertEqual(r.status_code, 201)
        new_job = Job.objects.get(pk=r.data['id'])
        self.assertEqual(new_job.status, 'pending_review')
        self.assertFalse(new_job.payment_verified)
        self.client.force_authenticate(user=self.other_client)
        self.assertEqual(self.client.get(f'/api/client/jobs/{new_job.pk}/').status_code, 404)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(f'/api/jobs/{new_job.pk}/').status_code, 404)

    def test_applicant_location_and_availability_are_read_from_profile(self):
        from accounts.models import Skill
        profile = self.freelancer.profile
        profile.district = 'Biratnagar, Nepal'
        profile.availability = 'Part-time evenings'
        profile.save(update_fields=['district', 'availability'])
        Skill.objects.create(user=self.freelancer, name='Canva')
        self.client.force_authenticate(user=self.freelancer)
        response = self.client.post(f'/api/jobs/{self.job.pk}/apply/', {
            'message': 'I can design this.', 'proposed_rate_usd': '35.00'
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.client.force_authenticate(user=self.client_user)
        rows = self.client.get('/api/client/applications/').data['results']
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['applicant_location'], 'Biratnagar, Nepal')
        self.assertEqual(rows[0]['applicant_availability'], 'Part-time evenings')
        self.assertNotIn('email', rows[0])
        self.assertNotIn('trusted_contact', rows[0])
        self.client.force_authenticate(user=self.other_client)
        self.assertEqual(self.client.get('/api/client/applications/').data['count'], 0)

    def test_client_job_location_is_saved_without_hardcoded_country(self):
        self.client.force_authenticate(user=self.client_user)
        response = self.client.post('/api/client/jobs/', {
            'title': 'Remote design', 'description': 'Design a banner',
            'category': 'Design', 'client_name': 'Example Client',
            'client_country': 'Remote, worldwide', 'budget_usd': '25',
            'required_skills': ['Canva'],
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['client_country'], 'Remote, worldwide')
        self.assertEqual(Job.objects.get(id=response.data['id']).client_country, 'Remote, worldwide')

    def test_private_applications_duplicate_and_client_scope(self):
        self.client.force_authenticate(user=self.freelancer)
        self.assertEqual(self.client.post(f'/api/jobs/{self.job.pk}/save/').status_code, 201)
        self.assertEqual(self.client.get('/api/me/saved-jobs/').data['count'], 1)
        submitted = self.client.post(f'/api/jobs/{self.job.pk}/apply/', {
            'message': 'I can help.', 'proposed_rate_usd': '35.00'
        }, format='json')
        self.assertEqual(submitted.status_code, 201)
        self.assertEqual(self.client.post(f'/api/jobs/{self.job.pk}/apply/', {
            'message': 'Again.', 'proposed_rate_usd': '30.00'
        }, format='json').status_code, 400)
        app_id = submitted.data['id']
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.get('/api/me/applications/').data['count'], 0)
        self.client.force_authenticate(user=self.other_client)
        self.assertEqual(self.client.get('/api/client/applications/').data['count'], 0)
        self.assertEqual(self.client.patch(f'/api/client/applications/{app_id}/', {'status': 'accepted'}).status_code, 404)
        self.client.force_authenticate(user=self.client_user)
        self.assertEqual(self.client.get('/api/client/applications/').data['count'], 1)
        self.assertEqual(self.client.patch(f'/api/client/applications/{app_id}/', {'message': 'edited'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(f'/api/client/applications/{app_id}/', {'status': 'shortlisted'}, format='json').status_code, 200)
        self.assertEqual(Application.objects.get(pk=app_id).status, 'shortlisted')

    def test_acceptance_is_final_and_does_not_resend_notifications(self):
        from workflows.models import InboxNotification
        app = Application.objects.create(user=self.freelancer, job=self.job,
                                         message='Ready to work.', proposed_rate_usd=35)
        self.client.force_authenticate(user=self.client_user)
        target = f'/api/client/applications/{app.pk}/'
        self.assertEqual(self.client.patch(target, {'status': 'accepted'}, format='json').status_code, 200)
        self.assertEqual(InboxNotification.objects.filter(owner=self.freelancer, kind='application').count(), 1)
        self.assertEqual(self.client.patch(target, {'status': 'accepted'}, format='json').status_code, 400)
        self.assertEqual(InboxNotification.objects.filter(owner=self.freelancer, kind='application').count(), 1)

    def test_freelancer_cannot_post_and_client_cannot_apply(self):
        self.client.force_authenticate(user=self.freelancer)
        self.assertEqual(self.client.post('/api/client/jobs/', {'title': 'nope'}).status_code, 403)
        self.client.force_authenticate(user=self.client_user)
        self.assertEqual(self.client.post(f'/api/jobs/{self.job.pk}/apply/', {
            'message': 'Wrong role', 'proposed_rate_usd': 20
        }).status_code, 403)

    def test_cannot_apply_to_unpublished_job(self):
        self.job.status = 'pending_review'
        self.job.save(update_fields=['status'])
        self.client.force_authenticate(user=self.freelancer)
        self.assertEqual(self.client.post(f'/api/jobs/{self.job.pk}/apply/', {
            'message': 'Can help', 'proposed_rate_usd': 20
        }, format='json').status_code, 404)


class PracticeJobTests(APITestCase):
    def test_seeded_practice_jobs_use_real_conversations_and_milestones(self):
        from django.core.management import call_command
        from decimal import Decimal
        from accounts.models import Profile
        from .models import Job, Application
        call_command('seed_demo_jobs', verbosity=0)
        call_command('seed_demo_jobs', verbosity=0)
        job = Job.objects.filter(is_demo=True).first()
        self.assertIsNotNone(job)
        self.assertTrue(job.owner_id)
        self.assertFalse(job.owner.is_active)
        self.assertFalse(job.payment_verified)
        freelancer = User.objects.create_user(username='practice_tester', password='SafePassword!2026')
        Profile.objects.create(user=freelancer, role='freelancer')
        self.client.force_authenticate(user=freelancer)
        result = self.client.post(f'/api/jobs/{job.pk}/apply/', {
            'message': 'I would like to practice this design job.', 'proposed_rate_usd': '20.00'
        }, format='json')
        self.assertEqual(result.status_code, 201, result.data)
        app = Application.objects.get(pk=result.data['id'])
        self.assertEqual(app.status, 'accepted')
        chat = f'/api/flows/conversations/{app.pk}/'
        self.assertEqual(self.client.post(chat, {'text': 'Hello, practice client'}, format='json').status_code, 201)
        messages = self.client.get(chat).data
        self.assertTrue(messages['is_demo'])
        self.assertEqual(len(messages['messages']), 2)
        room_url = f'/api/flows/workrooms/{app.pk}/'
        room = self.client.get(room_url)
        self.assertEqual(room.status_code, 200, room.data)
        self.assertTrue(room.data['is_demo'])
        mid = room.data['milestones'][0]['id']
        endpoint = f'{room_url}milestones/{mid}/practice-step/'
        self.assertEqual(self.client.post(endpoint, {'state': 'funded_demo'}, format='json').status_code, 200)
        self.assertEqual(self.client.post(endpoint, {'state': 'submitted'}, format='json').status_code, 400)
        self.assertEqual(self.client.post(f'{room_url}milestones/{mid}/delivery/',
            {'description': 'Practice completed work', 'links': []}, format='json').status_code, 200)
        for state in ['submitted', 'released_demo']:
            self.assertEqual(self.client.post(endpoint, {'state': state}, format='json').status_code, 200)
        self.assertEqual(self.client.get('/api/flows/passport/completions/').data['count'], 1)
