"""Tests for the WhatsApp Shield webhook (/api/flows/whatsapp/webhook/).
Sending is mocked: these tests never touch Meta's API."""

import hashlib
import hmac
import json
from unittest.mock import patch

from django.test import override_settings
from rest_framework.test import APITestCase

from workflows import whatsapp_api

PAYLOAD = {
    'entry': [{
        'changes': [{
            'value': {
                'messages': [{
                    'from': '9779812345678',
                    'type': 'text',
                    'text': {'body': 'Pay a registration fee of $50 first and send your OTP to confirm.'},
                }],
            },
        }],
    }],
}


@override_settings(WHATSAPP_VERIFY_TOKEN='test-verify', WHATSAPP_APP_SECRET='')
class WhatsAppWebhookTests(APITestCase):
    def test_verify_challenge_ok(self):
        resp = self.client.get('/api/flows/whatsapp/webhook/', {
            'hub.mode': 'subscribe', 'hub.verify_token': 'test-verify', 'hub.challenge': '42',
        })
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.content.decode(), '42')

    def test_verify_wrong_token_403(self):
        resp = self.client.get('/api/flows/whatsapp/webhook/', {
            'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '42',
        })
        self.assertEqual(resp.status_code, 403)

    def test_scam_message_gets_danger_reply(self):
        with patch.object(whatsapp_api, '_send_text', return_value=True) as send:
            resp = self.client.post('/api/flows/whatsapp/webhook/', PAYLOAD, format='json')
        self.assertEqual(resp.status_code, 200)
        send.assert_called_once()
        to, body = send.call_args[0]
        self.assertEqual(to, '9779812345678')
        self.assertIn('danger signs', body)
        self.assertIn('OTP', body)

    def test_clean_message_gets_careful_ok_reply(self):
        payload = {'entry': [{'changes': [{'value': {'messages': [{
            'from': '9779812345678', 'type': 'text',
            'text': {'body': 'Design a logo for our shop, pay NPR 3000 by bank transfer, deadline Friday.'},
        }]}}]}]}
        with patch.object(whatsapp_api, '_send_text', return_value=True) as send:
            resp = self.client.post('/api/flows/whatsapp/webhook/', payload, format='json')
        self.assertEqual(resp.status_code, 200)
        body = send.call_args[0][1]
        self.assertIn('not a guarantee', body)

    def test_non_text_and_empty_payloads_still_200(self):
        resp = self.client.post('/api/flows/whatsapp/webhook/', {'entry': []}, format='json')
        self.assertEqual(resp.status_code, 200)


@override_settings(WHATSAPP_APP_SECRET='app-secret')
class WhatsAppSignatureTests(APITestCase):
    def test_valid_signature_accepted(self):
        raw = json.dumps(PAYLOAD).encode()
        sig = 'sha256=' + hmac.new(b'app-secret', raw, hashlib.sha256).hexdigest()
        with patch.object(whatsapp_api, '_send_text', return_value=True):
            resp = self.client.post('/api/flows/whatsapp/webhook/', data=raw,
                                    content_type='application/json', HTTP_X_HUB_SIGNATURE_256=sig)
        self.assertEqual(resp.status_code, 200)

    def test_bad_signature_rejected(self):
        resp = self.client.post('/api/flows/whatsapp/webhook/', PAYLOAD, format='json',
                                HTTP_X_HUB_SIGNATURE_256='sha256=deadbeef')
        self.assertEqual(resp.status_code, 403)
