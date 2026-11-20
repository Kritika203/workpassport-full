"""No-network tests for the optional HTTPS transactional mail provider."""
import json
import os
from unittest.mock import patch, MagicMock

from django.core.mail import EmailMessage
from django.test import SimpleTestCase

from .email_backend import BrevoAPIEmailBackend


class BrevoEmailTests(SimpleTestCase):
    @patch.dict(os.environ, {'BREVO_API_KEY': 'dummy-test-key'})
    @patch('accounts.email_backend.urlopen')
    def test_sends_password_reset_message_with_https_api(self, mock_urlopen):
        response = MagicMock()
        response.status = 201
        mock_urlopen.return_value.__enter__.return_value = response
        email = EmailMessage(
            'Reset your password', 'Reset link here',
            'WorkPassport <verified@example.org>', ['user@example.org'],
        )
        self.assertEqual(BrevoAPIEmailBackend().send_messages([email]), 1)
        request = mock_urlopen.call_args.args[0]
        self.assertEqual(request.full_url, 'https://api.brevo.com/v3/smtp/email')
        self.assertEqual(request.get_header('Api-key'), 'dummy-test-key')
        payload = json.loads(request.data)
        self.assertEqual(payload['to'], [{'email': 'user@example.org'}])
        self.assertEqual(payload['sender']['email'], 'verified@example.org')
        self.assertEqual(payload['textContent'], 'Reset link here')

    @patch.dict(os.environ, {'BREVO_API_KEY': ''})
    def test_missing_api_key_does_not_claim_success(self):
        email = EmailMessage('Subject', 'Body', 'verified@example.org', ['user@example.org'])
        with self.assertRaises(ValueError):
            BrevoAPIEmailBackend().send_messages([email])

    @patch.dict(os.environ, {'BREVO_API_KEY': ''})
    def test_silent_mode_does_not_send(self):
        email = EmailMessage('Subject', 'Body', 'verified@example.org', ['user@example.org'])
        self.assertEqual(BrevoAPIEmailBackend(fail_silently=True).send_messages([email]), 0)
