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


    def test_job_deliverable_specs_are_validated(self):
        self.client.force_authenticate(user=self.client_user)
        base = {
            'title': 'Logo job', 'description': 'Design a logo', 'category': 'Design',
            'client_name': 'Example Inc', 'budget_usd': '30.00',
        }
        spec = {
            'name': 'Logo file', 'description': 'Final logo in PNG, transparent background, 2000px wide.',
            'quantity': 1, 'formats': ['png'], 'max_mb': 10, 'link_allowed': False, 'milestone': 1,
        }
        r = self.client.post('/api/client/jobs/', {**base, 'deliverables': [spec]}, format='json')
        self.assertEqual(r.status_code, 201)
        saved = Job.objects.get(pk=r.data['id']).deliverables
        self.assertEqual(saved[0]['name'], 'Logo file')
        self.assertEqual(saved[0]['formats'], ['png'])
        # Legacy plain lines still work.
        r = self.client.post('/api/client/jobs/', {**base, 'deliverables': ['One logo']}, format='json')
        self.assertEqual(r.status_code, 201)
        # Blocked format, oversize cap and vague description are all rejected.
        for bad in ({**spec, 'formats': ['exe']}, {**spec, 'max_mb': 50}, {**spec, 'description': 'a logo'}):
            r = self.client.post('/api/client/jobs/', {**base, 'deliverables': [bad]}, format='json')
            self.assertEqual(r.status_code, 400, bad)


    def test_client_sees_applicant_passport_summary(self):
        from accounts.models import Skill, SkillVerification, TrainingEntry
        skill = Skill.objects.create(user=self.freelancer, name='Canva', level='intermediate')
        SkillVerification.objects.create(skill=skill, level='demonstrated')
        SkillVerification.objects.create(skill=skill, level='self')
        TrainingEntry.objects.create(user=self.freelancer, title='Graphic Design Basics', institution='Local Institute', year=2025)
        self.client.force_authenticate(user=self.client_user)
        from .models import Application
        Application.objects.create(user=self.freelancer, job=self.job, message='I can do it.', proposed_rate_usd=35)
        data = self.client.get('/api/client/applications/').data
        rows = data['results'] if isinstance(data, dict) else data
        row = next(r for r in rows if r['applicant_name'] == self.freelancer.username)
        self.assertEqual(row['applicant_skills'], [{'name': 'Canva', 'level': 'intermediate', 'proof': 'demonstrated'}])
        self.assertEqual(row['applicant_proofs'], 1)
        self.assertEqual(row['applicant_completed_jobs'], 0)
        self.assertEqual(row['applicant_training'][0]['title'], 'Graphic Design Basics')

    def test_client_decision_reason_is_saved_and_visible_to_freelancer(self):
        from .models import Application
        app = Application.objects.create(user=self.freelancer, job=self.job, message='Hire me.', proposed_rate_usd=35)
        url = f'/api/client/applications/{app.pk}/'
        self.client.force_authenticate(user=self.client_user)
        r = self.client.patch(url, {'status': 'rejected', 'decision_reason': 'Budget went to another design this month.'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['decision_reason'], 'Budget went to another design this month.')
        # Unknown fields and over-long reasons are refused.
        app2 = Application.objects.create(user=self.other, job=self.job, message='Me too.', proposed_rate_usd=30)
        url2 = f'/api/client/applications/{app2.pk}/'
        self.assertEqual(self.client.patch(url2, {'status': 'rejected', 'hack': 1}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(url2, {'status': 'rejected', 'decision_reason': 'x' * 501}, format='json').status_code, 400)
        # The freelancer sees the decision and the reason on their own list.
        self.client.force_authenticate(user=self.freelancer)
        data = self.client.get('/api/me/applications/').data
        mine = data['results'] if isinstance(data, dict) else data
        mine = next(r for r in mine if r['id'] == app.pk)
        self.assertEqual(mine['status'], 'rejected')
        self.assertEqual(mine['decision_reason'], 'Budget went to another design this month.')
        # Decisions are final: a second change is refused.
        self.client.force_authenticate(user=self.client_user)
        self.assertEqual(self.client.patch(url, {'status': 'accepted'}, format='json').status_code, 400)


    def test_client_dashboard_aggregates_own_data_only(self):
        from decimal import Decimal as D
        from .models import Application
        from workflows.models import Workroom, Milestone
        app = Application.objects.create(user=self.freelancer, job=self.job, message='Hire me.', proposed_rate_usd=D('40'), status='accepted')
        Application.objects.create(user=self.other, job=self.job, message='Waiting.', proposed_rate_usd=D('30'), status='submitted')
        room = Workroom.objects.create(application=app)
        Milestone.objects.create(workroom=room, title='Draft', amount_usd=D('15'), state='submitted', position=0)
        Milestone.objects.create(workroom=room, title='Final', amount_usd=D('25'), state='released_demo', position=1, delivery_note='Done.')
        self.client.force_authenticate(user=self.client_user)
        r = self.client.get('/api/client/dashboard/')
        self.assertEqual(r.status_code, 200)
        d = r.data
        self.assertEqual(d['jobs_by_status']['published'], 1)
        self.assertEqual(d['applicants_waiting'], 1)
        self.assertEqual(len(d['review_items']), 1)
        self.assertEqual(d['review_items'][0]['milestone_title'], 'Draft')
        self.assertEqual(d['total_released_usd'], '25.00')
        self.assertEqual(d['total_agreed_usd'], '40.00')
        self.assertEqual(d['spent_by_job'][0]['released_usd'], '25.00')
        # Another client and a freelancer see none of this.
        self.client.force_authenticate(user=self.other_client)
        d2 = self.client.get('/api/client/dashboard/').data
        self.assertEqual(d2['total_jobs'], 0)
        self.assertEqual(d2['review_items'], [])
        self.client.force_authenticate(user=self.freelancer)
        self.assertEqual(self.client.get('/api/client/dashboard/').status_code, 403)


    def test_explore_shortlist_and_invite(self):
        from accounts.models import Skill, SkillVerification, TrainingEntry
        from .models import ClientInvite, ClientShortlist
        from workflows.models import InboxNotification
        skill = Skill.objects.create(user=self.freelancer, name='Canva', level='beginner')
        SkillVerification.objects.create(skill=skill, level='institution')
        TrainingEntry.objects.create(user=self.freelancer, title='Design Basics', institution='Institute', year=2025)
        prof = self.freelancer.profile
        prof.district = 'Pokhara'
        prof.display_name = 'Maya Freelancer'
        prof.save()
        self.client.force_authenticate(user=self.client_user)
        rows = self.client.get('/api/client/explore/').data
        self.assertEqual(len(rows), 2)  # both fixture freelancers are listed
        maya = next(r for r in rows if r['user_id'] == self.freelancer.pk)
        self.assertEqual(maya['name'], 'Maya Freelancer')
        self.assertEqual(maya['skills'][0]['proof'], 'institution')
        # Filters: skill + proof + location + training.
        self.assertEqual(len(self.client.get('/api/client/explore/?skill=canva').data), 1)
        self.assertEqual(len(self.client.get('/api/client/explore/?proof=platform').data), 0)
        self.assertEqual(len(self.client.get('/api/client/explore/?location=pokhara').data), 1)
        self.assertEqual(len(self.client.get('/api/client/explore/?training=1').data), 1)
        self.assertEqual(self.client.get('/api/client/explore/?proof=bogus').status_code, 400)
        # Shortlist add + remove, scoped to this client.
        r = self.client.post('/api/client/shortlist/', {'freelancer_id': self.freelancer.pk}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['freelancer_ids'], [self.freelancer.pk])
        self.assertEqual(ClientShortlist.objects.filter(client=self.other_client).count(), 0)
        self.assertEqual(self.client.delete(f'/api/client/shortlist/{self.freelancer.pk}/').status_code, 204)
        self.assertEqual(ClientShortlist.objects.count(), 0)
        # Invite: published own job only, deduped, freelancer notified once.
        r = self.client.post('/api/client/invite/', {'freelancer_id': self.freelancer.pk, 'job_id': self.job.pk}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertTrue(InboxNotification.objects.filter(owner=self.freelancer, kind='invite').exists())
        r = self.client.post('/api/client/invite/', {'freelancer_id': self.freelancer.pk, 'job_id': self.job.pk}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['already_invited'])
        self.assertEqual(ClientInvite.objects.count(), 1)
        self.assertEqual(InboxNotification.objects.filter(owner=self.freelancer, kind='invite').count(), 1)
        draft = Job.objects.create(owner=self.client_user, title='Draft job', description='x', category='Design',
            client_name='Example', required_skills=[], budget_usd=10, status='pending_review')
        self.assertEqual(self.client.post('/api/client/invite/', {'freelancer_id': self.freelancer.pk, 'job_id': draft.pk}, format='json').status_code, 400)
        # Freelancers cannot use the client directory.
        self.client.force_authenticate(user=self.freelancer)
        self.assertEqual(self.client.get('/api/client/explore/').status_code, 403)


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

