"""Tests for POST /api/jobs/proposal-draft/ (Guided Apply writing helper).
The Gemini call is mocked: these tests never touch the network."""

import json
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import Profile
from opportunities import proposal_ai

FAKE_REPLY = json.dumps({
    'english': 'Hello, I can design your logo. I use Canva and I have made posters for two local shops. Thank you for your time.',
    'nepali': 'नमस्ते, म तपाईंको लोगो डिजाइन गर्न सक्छु।',
})


def make_user(username, role):
    user = User.objects.create_user(username=username, password='Str0ng!Pass9')
    Profile.objects.create(user=user, role=role, display_name=username.title())
    return user


@override_settings(GEMINI_API_KEY='test-key')
class ProposalDraftTests(APITestCase):
    def setUp(self):
        self.freelancer = make_user('maya', Profile.FREELANCER)
        self.client_user = make_user('biz', Profile.CLIENT)

    def test_freelancer_gets_english_and_back_translation(self):
        self.client.force_authenticate(self.freelancer)
        with patch.object(proposal_ai, '_generate', return_value=FAKE_REPLY) as gen:
            resp = self.client.post('/api/jobs/proposal-draft/', {
                'text': 'ma logo design garna sakchhu, canva chalauna aauchha',
                'job_title': 'Logo design',
            }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('design your logo', resp.data['english'])
        self.assertTrue(resp.data['nepali'])
        # The job title must reach the model prompt.
        self.assertIn('Logo design', gen.call_args[0][0])

    def test_too_short_text_rejected(self):
        self.client.force_authenticate(self.freelancer)
        resp = self.client.post('/api/jobs/proposal-draft/', {'text': 'hi'}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_client_role_forbidden(self):
        self.client.force_authenticate(self.client_user)
        resp = self.client.post('/api/jobs/proposal-draft/', {
            'text': 'ma logo design garna sakchhu, canva chalauna aauchha',
        }, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_login_required(self):
        resp = self.client.post('/api/jobs/proposal-draft/', {
            'text': 'ma logo design garna sakchhu, canva chalauna aauchha',
        }, format='json')
        self.assertEqual(resp.status_code, 401)

    def test_unreadable_model_reply_is_503_not_500(self):
        self.client.force_authenticate(self.freelancer)
        with patch.object(proposal_ai, '_generate', return_value='not json at all'):
            resp = self.client.post('/api/jobs/proposal-draft/', {
                'text': 'ma logo design garna sakchhu, canva chalauna aauchha',
            }, format='json')
        self.assertEqual(resp.status_code, 503)


@override_settings(GEMINI_API_KEY='')
class ProposalDraftNoKeyTests(APITestCase):
    def test_missing_key_is_503_with_helpful_message(self):
        freelancer = make_user('sita', Profile.FREELANCER)
        self.client.force_authenticate(freelancer)
        resp = self.client.post('/api/jobs/proposal-draft/', {
            'text': 'ma logo design garna sakchhu, canva chalauna aauchha',
        }, format='json')
        self.assertEqual(resp.status_code, 503)
        self.assertIn('still here', resp.data['detail'])
