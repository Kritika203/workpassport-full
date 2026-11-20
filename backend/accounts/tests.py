from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from .models import Profile

User = get_user_model()


class AccountsTests(APITestCase):
    def test_register_login_profile_and_role_protection(self):
        response = self.client.post('/api/auth/register/', {
            'username': 'maya', 'email': 'MAYA@example.com',
            'password': 'StrongExamplePass!9', 'role': 'freelancer',
            'display_name': 'Maya',
        })
        self.assertEqual(response.status_code, 201)
        self.assertEqual(User.objects.get(username='maya').email, 'maya@example.com')
        token_response = self.client.post('/api/auth/login/', {
            'username': 'maya', 'password': 'StrongExamplePass!9',
        })
        self.assertEqual(token_response.status_code, 200)
        self.assertIn('access', token_response.data)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token_response.data['access'])
        me = self.client.get('/api/auth/me/')
        self.assertEqual(me.data['role'], 'freelancer')
        update = self.client.patch('/api/auth/me/', {'role': 'client', 'bio': 'Freelancer'}, format='json')
        self.assertEqual(update.status_code, 200)
        self.assertEqual(Profile.objects.get(user__username='maya').role, 'freelancer')
        logout = self.client.post('/api/auth/logout/', {'refresh': token_response.data['refresh']})
        self.assertEqual(logout.status_code, 204)
        self.assertNotEqual(self.client.post('/api/auth/refresh/', {'refresh': token_response.data['refresh']}).status_code, 200)

    def test_admin_signup_is_rejected(self):
        r = self.client.post('/api/auth/register/', {
            'username': 'intruder', 'email': 'intruder@example.com',
            'password': 'StrongExamplePass!9', 'role': 'admin'
        })
        self.assertEqual(r.status_code, 400)

    def test_skills_and_samples_are_private(self):
        maya = User.objects.create_user(username='maya', password='whatever')
        jane = User.objects.create_user(username='jane', password='whatever')
        Profile.objects.create(user=maya, role='freelancer')
        Profile.objects.create(user=jane, role='freelancer')
        self.client.force_authenticate(user=maya)
        r = self.client.post('/api/auth/me/skills/', {'name': 'Canva', 'level': 'beginner'})
        self.assertEqual(r.status_code, 201)
        skill_id = r.data['id']
        self.client.force_authenticate(user=jane)
        self.assertEqual(self.client.get(f'/api/auth/me/skills/{skill_id}/').status_code, 404)
        r = self.client.post('/api/auth/me/work-samples/', {
            'title': 'Stolen sample', 'url': 'https://example.com/sample', 'skill': skill_id
        })
        self.assertEqual(r.status_code, 400)
        self.client.force_authenticate(user=maya)
        r = self.client.post('/api/auth/me/work-samples/', {
            'title': 'A logo', 'url': 'https://example.com/logo', 'skill': skill_id
        })
        self.assertEqual(r.status_code, 201)
        self.client.force_authenticate(user=jane)
        self.assertEqual(self.client.get('/api/auth/me/work-samples/').data['count'], 0)

    def test_unauthenticated_me_is_denied(self):
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)


class WorkspaceAndDemoTests(APITestCase):
    def test_workspace_requires_login_and_is_private(self):
        from .models import WorkspaceState
        self.assertEqual(self.client.get('/api/auth/workspace/').status_code, 401)
        a = User.objects.create_user(username='worker_one', password='SomeStrongPassword!9')
        b = User.objects.create_user(username='worker_two', password='SomeStrongPassword!9')
        Profile.objects.create(user=a, role='freelancer')
        Profile.objects.create(user=b, role='freelancer')
        self.client.force_authenticate(user=a)
        self.assertEqual(self.client.patch('/api/auth/workspace/', {
            'updates': {'wp_evidence': [{'text': 'only mine'}]}
        }, format='json').status_code, 200)
        self.client.force_authenticate(user=b)
        self.assertEqual(self.client.get('/api/auth/workspace/').data['state'], {})
        self.client.patch('/api/auth/workspace/', {'updates': {'wp_evidence': []}}, format='json')
        self.assertEqual(WorkspaceState.objects.get(user=a).data['wp_evidence'], [{'text': 'only mine'}])

    def test_workspace_rejects_unknown_fields_and_large_input(self):
        user = User.objects.create_user(username='worker_three', password='SomeStrongPassword!9')
        Profile.objects.create(user=user, role='freelancer')
        self.client.force_authenticate(user=user)
        self.assertEqual(self.client.patch('/api/auth/workspace/', {
            'updates': {'is_superuser': True}
        }, format='json').status_code, 400)
        self.assertEqual(self.client.patch('/api/auth/workspace/', {
            'updates': {'wp_evidence': 'x' * 850_000}
        }, format='json').status_code, 400)

    def test_maya_seed_is_not_admin(self):
        from .demo import seed_maya
        maya = seed_maya('LongDemoPassword!123')
        self.assertFalse(maya.is_staff)
        self.assertFalse(maya.is_superuser)
        self.assertEqual(maya.profile.display_name, 'Maya Shrestha')

    def test_demo_sessions_are_isolated(self):
        from django.test import override_settings
        with override_settings(DEBUG=True):
            first = self.client.post('/api/auth/demo-session/', {}, format='json')
            second = self.client.post('/api/auth/demo-session/', {}, format='json')
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + first.data['access'])
        self.client.patch('/api/auth/workspace/', {'updates': {'wp_saved': ['j2']}}, format='json')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + second.data['access'])
        state = self.client.get('/api/auth/workspace/').data['state']
        self.assertEqual(state['wp_saved'], [])

    def test_reports_are_private_and_created_for_review(self):
        from .models import SafetyReport
        a = User.objects.create_user(username='report_a', password='SomeStrongPassword!9')
        b = User.objects.create_user(username='report_b', password='SomeStrongPassword!9')
        Profile.objects.create(user=a, role='freelancer')
        Profile.objects.create(user=b, role='freelancer')
        self.client.force_authenticate(user=a)
        posted = self.client.post('/api/auth/reports/', {
            'kind': 'client', 'job_reference': 'j2', 'reason': 'Scam'
        }, format='json')
        self.assertEqual(posted.status_code, 201)
        self.assertEqual(SafetyReport.objects.get(user=a).status, 'new')
        self.client.force_authenticate(user=b)
        self.assertEqual(self.client.get('/api/auth/reports/').data['count'], 0)
        self.assertEqual(self.client.post('/api/auth/reports/', {
            'kind': 'client', 'job_reference': 'j2', 'reason': 'x', 'status': 'closed'
        }, format='json').status_code, 201)
        self.assertEqual(SafetyReport.objects.get(user=b).status, 'new')


class PassportBackendTests(APITestCase):
    def setUp(self):
        self.person = User.objects.create_user(username='passport_test', email='passport@example.org', password='SafePassword!2026')
        Profile.objects.create(user=self.person, role='freelancer')
        self.client.force_authenticate(user=self.person)

    def test_full_passport_and_independent_verification(self):
        profile = {
            'name': 'New Freelancer', 'headline': 'Design and writing', 'district': 'Morang',
            'languages': ['Nepali', 'English'], 'availability': 'Weekends', 'rateNote': 'NPR 2500',
            'tools': ['Canva'], 'workWanted': ['Design'], 'skills': ['Canva'],
            'training': [{'title': 'Design course', 'where': 'Local college', 'year': 2026}], 'onboarded': True,
        }
        res = self.client.put('/api/auth/passport/', profile, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['profile']['training'][0]['title'], 'Design course')
        skill = self.person.skills.get(name='Canva')
        res = self.client.post('/api/auth/me/skill-verifications/', {'skill': skill.id, 'level': 'institution'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self.client.get('/api/auth/passport/').data['skill_levels']['Canva'], 'self')
        res = self.client.post('/api/auth/me/skill-verifications/', {'skill': skill.id, 'level': 'demonstrated', 'evidence_url': 'https://example.org/my-logo'}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(self.client.get('/api/auth/passport/').data['skill_levels']['Canva'], 'demonstrated')
        other = User.objects.create_user(username='not-owner', password='SafePassword!2026')
        Profile.objects.create(user=other, role='freelancer')
        self.client.force_authenticate(user=other)
        self.assertEqual(self.client.get('/api/auth/passport/').data['profile']['skills'], [])
        self.assertEqual(self.client.post('/api/auth/me/skill-verifications/', {'skill': skill.id, 'level': 'self'}, format='json').status_code, 400)

    def test_password_reset_export_and_deletion(self):
        from django.core import mail
        from django.test import override_settings
        from urllib.parse import urlparse, parse_qs
        self.client.force_authenticate(user=None)
        with override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend'):
            res = self.client.post('/api/auth/password-reset/request/', {'email': 'passport@example.org'})
            self.assertEqual(res.status_code, 200, res.data)
            self.assertEqual(len(mail.outbox), 1)
            url = [word for word in mail.outbox[0].body.split() if 'reset_uid=' in word][0]
            query = parse_qs(urlparse(url).query)
            res = self.client.post('/api/auth/password-reset/confirm/', {
                'uid': query['reset_uid'][0], 'token': query['reset_token'][0],
                'password': 'NewSafePassword!2026'
            })
            self.assertEqual(res.status_code, 200, res.data)
        self.person.refresh_from_db()
        self.assertTrue(self.person.check_password('NewSafePassword!2026'))
        self.client.force_authenticate(user=self.person)
        self.assertEqual(self.client.get('/api/auth/my-data/').status_code, 200)
        self.assertEqual(self.client.delete('/api/auth/my-data/', {'password': 'wrong'}, format='json').status_code, 400)
        self.assertEqual(self.client.delete('/api/auth/my-data/', {'password': 'NewSafePassword!2026'}, format='json').status_code, 204)
        self.assertFalse(User.objects.filter(pk=self.person.pk).exists())
