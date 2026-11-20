"""Pairing, token revocation and private extension bookmark tests.

These are deterministic API tests; no browser or external network is needed.
"""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from accounts.models import Profile
from .models import BrowserExtensionSession, ExternalSavedJob, SafetyCheck, EvidenceRecord


class BrowserExtensionTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(username='extension_owner', password='UniqueStrongPassword456!')
        self.other = User.objects.create_user(username='extension_other', password='UniqueStrongPassword456!')
        Profile.objects.create(user=self.owner, role='freelancer')
        Profile.objects.create(user=self.other, role='freelancer')

    def pair(self):
        self.client.force_authenticate(user=self.owner)
        issued = self.client.post('/api/flows/extension/pair/', {}, format='json')
        self.assertEqual(issued.status_code, 201)
        code = issued.data['code']
        self.assertEqual(len(code), 12)
        self.client.force_authenticate(user=None)
        activated = self.client.post('/api/flows/extension/activate/', {'code': code}, format='json')
        self.assertEqual(activated.status_code, 201)
        return code, activated.data['token']

    def test_code_is_one_time_and_session_is_scoped(self):
        code, token = self.pair()
        self.assertEqual(self.client.post('/api/flows/extension/activate/', {'code': code}, format='json').status_code, 400)
        self.client.credentials(HTTP_AUTHORIZATION=f'Extension {token}')
        status = self.client.get('/api/flows/extension/status/')
        self.assertEqual(status.status_code, 200)
        self.assertEqual(status.data['name'], self.owner.username)
        self.assertIn('web_url', status.data)
        self.assertEqual(self.client.post('/api/flows/extension/check/', {'text': 'Pay a registration fee', 'save': True}, format='json').status_code, 200)
        self.assertEqual(SafetyCheck.objects.filter(owner=self.owner).count(), 1)
        self.assertEqual(SafetyCheck.objects.filter(owner=self.other).count(), 0)
        saved = self.client.post('/api/flows/extension/evidence/', {'text': 'Requested ID photo', 'categories': ['photo']}, format='json')
        self.assertEqual(saved.status_code, 201)
        self.assertEqual(EvidenceRecord.objects.filter(owner=self.owner).count(), 1)
        self.assertEqual(EvidenceRecord.objects.filter(owner=self.other).count(), 0)
        session = BrowserExtensionSession.objects.get(owner=self.owner)
        self.client.credentials()
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.delete(f'/api/flows/extension/pair/{session.id}/').status_code, 400)
        self.client.force_authenticate(user=self.owner)
        self.assertEqual(self.client.delete(f'/api/flows/extension/pair/{session.id}/').status_code, 204)
        self.client.force_authenticate(user=None)
        self.client.credentials(HTTP_AUTHORIZATION=f'Extension {token}')
        self.assertEqual(self.client.get('/api/flows/extension/status/').status_code, 401)

    def test_bookmark_sync_and_owner_only_delete(self):
        _, token = self.pair()
        self.client.credentials(HTTP_AUTHORIZATION=f'Extension {token}')
        saved = self.client.post('/api/flows/extension/saved-jobs/', {
            'title': 'Remote poster work', 'external_url': 'https://example.org/jobs/123',
            'text_excerpt': 'Work details copied by the user',
        }, format='json')
        self.assertEqual(saved.status_code, 201)
        self.assertEqual(ExternalSavedJob.objects.filter(owner=self.owner).count(), 1)
        self.assertEqual(self.client.post('/api/flows/extension/saved-jobs/', {'title': 'Bad', 'external_url': 'javascript:alert(1)'}, format='json').status_code, 400)
        self.client.credentials()
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.get('/api/flows/extension/saved-jobs/').data['results'], [])
        self.assertEqual(self.client.delete(f'/api/flows/extension/saved-jobs/{saved.data["id"]}/').status_code, 400)
        self.client.force_authenticate(user=self.owner)
        self.assertEqual(len(self.client.get('/api/flows/extension/saved-jobs/').data['results']), 1)
        self.assertEqual(self.client.delete(f'/api/flows/extension/saved-jobs/{saved.data["id"]}/').status_code, 204)
        self.assertFalse(ExternalSavedJob.objects.filter(owner=self.owner).exists())

    def test_unpaired_requests_are_rejected(self):
        self.client.credentials()
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get('/api/flows/extension/passport/').status_code, (401, 403))
        self.assertIn(self.client.get('/api/flows/extension/saved-jobs/').status_code, (401, 403))
