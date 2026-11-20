"""WorkShield on WhatsApp (Meta WhatsApp Cloud API).

A user forwards a suspicious message to the WorkPassport WhatsApp number.
Meta calls this webhook; the SAME rule engine as the web app and the
browser extension (workflows.services.analyze) checks the text, and the
reply goes back on WhatsApp in simple Nepali first, then English.

Boundaries, same as everywhere in WorkPassport:
- The reply is a warning, never a promise that a message is safe.
- Nothing is stored: forwarded text is checked and forgotten.
- If the WhatsApp credentials are not configured, the webhook still
  verifies and answers 200 so Meta does not retry; it just cannot reply.

Setup (team, one time): create a Meta developer app, add the WhatsApp
product, use the free test number (or a verified business number), set
WHATSAPP_VERIFY_TOKEN / WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID
in the backend .env, and point the webhook at
https://<backend>/api/flows/whatsapp/webhook/ with the same verify token.
"""

import hashlib
import hmac
import json
import logging
import urllib.request

from django.conf import settings
from django.http import HttpResponse
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import analyze

logger = logging.getLogger(__name__)

GRAPH_VERSION = 'v21.0'

REASONS = {
    'fee': ('पहिले पैसा मागेको छ (दर्ता शुल्क, डिपोजिट जस्ता)।', 'It asks for money first, like a fee or deposit.'),
    'otp': ('OTP, पासवर्ड वा PIN मागेको छ।', 'It asks for an OTP, password or PIN.'),
    'crypto': ('गिफ्ट कार्ड वा crypto मा पैसा मागेको छ।', 'It asks for gift cards or crypto.'),
    'highpay': ('सजिलो कामका लागि असम्भव धेरै पैसा भनेको छ।', 'The pay sounds too high for easy work.'),
    'offplatform': ('एप बाहिर, व्यक्तिगत नम्बरमा कुरा गर्न भनेको छ।', 'It pushes you to a personal chat outside the platform.'),
    'photo': ('व्यक्तिगत फोटो मागेको छ।', 'It asks for personal photos.'),
    'urgency': ('तुरुन्तै, आजै मात्र जस्ता दबाब दिने शब्द छन्।', 'It pressures you to act fast.'),
    'nepali_payment': ('पहिले पैसा पठाउन भनेको छ।', 'It asks you to send money first (Nepali).'),
    'nepali_credentials': ('OTP वा पासवर्ड पठाउन भनेको छ।', 'It asks for OTP or password (Nepali).'),
    'freetrial': ('नि:शुल्क काम गराएर देखाउन भनेको छ।', 'It asks for free trial work.'),
    'vague': ('काम के हो भन्ने स्पष्ट छैन।', 'The work itself is not clearly described.'),
    'nopay': ('पैसा कति र कसरी पाइन्छ भनेको छैन।', 'It does not say how much or how you get paid.'),
    'lowpay': ('कामको तुलनामा पैसा धेरै कम देखिन्छ।', 'The pay looks very low for the work.'),
    'model_review': ('हाम्रो प्रयोगात्मक प्रणालीले पनि यो सन्देश शंकास्पद देख्यो।', 'Our experimental checker also found this message suspicious.'),
}

SAFETY_REASONS = {
    'photo': ('फोटो माग्ने कुरा छ।', 'It talks about photos of you.'),
    'meeting': ('एक्लै भेट्न बोलाएको छ।', 'It asks you to meet, possibly alone.'),
    'pressure': ('धम्की वा दबाब दिने शब्द छन्।', 'It contains pressure or threats.'),
    'call': ('कल वा भिडियो कलमा जोड दिएको छ।', 'It pushes for a call or video call.'),
    'personal': ('धेरै व्यक्तिगत प्रश्न सोधेको छ।', 'It asks very personal questions.'),
    'flirty': ('अनुचित, जिस्काउने खालका शब्द छन्।', 'It contains flirty or inappropriate words.'),
    'night': ('राति अबेर सम्पर्क गर्ने कुरा छ।', 'It talks about late-night contact.'),
}


def format_reply(result):
    findings = result.get('findings', {})
    keys = list(findings.get('red', [])) + list(findings.get('yellow', []))
    safety = result.get('safety_categories', [])
    lines = []
    if result.get('verdict') == 'danger':
        lines.append('⚠️ यो सन्देशमा खतराका संकेत छन्।')
        lines.append('This message has danger signs:')
    elif result.get('verdict') == 'warning' or safety:
        lines.append('🟡 सावधान हुनुहोस्। केही कुरा ठिक देखिँदैन।')
        lines.append('Be careful. Some things do not look right:')
    else:
        lines.append('🟢 हामीले कुनै खतरा संकेत भेट्टाएनौं।')
        lines.append('We found no danger signs in this message.')
    seen = set()
    for key in keys:
        if key in REASONS and key not in seen:
            seen.add(key)
            ne, en = REASONS[key]
            lines.append(f'• {ne} ({en})')
    for key in safety:
        if key in SAFETY_REASONS and key not in seen:
            seen.add(key)
            ne, en = SAFETY_REASONS[key]
            lines.append(f'• {ne} ({en})')
    if result.get('verdict') == 'danger':
        lines.append('पैसा, OTP वा पासवर्ड कहिल्यै नपठाउनुहोस्।')
        lines.append('Never send money, an OTP, or a password.')
    lines.append('यो स्वचालित जाँच मात्र हो, सुरक्षित छ भन्ने ग्यारेन्टी होइन। आफैं पनि जाँच गर्नुहोस्।')
    lines.append('This is an automated check, not a guarantee of safety. Always check yourself.')
    lines.append('- WorkPassport WorkShield')
    return '\n'.join(lines)


def _send_text(to, body):
    token = getattr(settings, 'WHATSAPP_ACCESS_TOKEN', '') or ''
    phone_id = getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', '') or ''
    if not token.strip() or not phone_id.strip():
        logger.info('WhatsApp reply skipped: credentials not configured.')
        return False
    url = f'https://graph.facebook.com/{GRAPH_VERSION}/{phone_id.strip()}/messages'
    payload = {'messaging_product': 'whatsapp', 'to': to, 'type': 'text', 'text': {'body': body[:4096]}}
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token.strip()}'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return 200 <= resp.status < 300
    except Exception:  # sending must never break the webhook response
        logger.exception('WhatsApp send failed.')
        return False


def _signature_ok(request):
    secret = getattr(settings, 'WHATSAPP_APP_SECRET', '') or ''
    if not secret.strip():
        return True  # dev/test mode: no app secret configured
    header = request.headers.get('X-Hub-Signature-256', '')
    if not header.startswith('sha256='):
        return False
    expected = hmac.new(secret.strip().encode(), request.body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header[7:])


class WhatsAppWebhookView(APIView):
    """GET verifies the webhook with Meta. POST receives messages.
    Meta is not a WorkPassport user, so there is no JWT here; the verify
    token (GET) and the app-secret signature (POST, when configured) are
    the authentication."""
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        mode = request.query_params.get('hub.mode')
        token = request.query_params.get('hub.verify_token', '')
        challenge = request.query_params.get('hub.challenge', '')
        expected = getattr(settings, 'WHATSAPP_VERIFY_TOKEN', '') or ''
        if mode == 'subscribe' and expected.strip() and hmac.compare_digest(token, expected.strip()):
            return HttpResponse(challenge, content_type='text/plain', status=200)
        return HttpResponse('Verification failed', status=403)

    def post(self, request):
        if not _signature_ok(request):
            return HttpResponse('Bad signature', status=403)
        try:
            entries = request.data.get('entry', []) if isinstance(request.data, dict) else []
            for entry in entries:
                for change in entry.get('changes', []):
                    value = change.get('value', {}) or {}
                    for message in value.get('messages', []) or []:
                        if message.get('type') != 'text':
                            continue
                        sender = message.get('from', '')
                        body = (message.get('text', {}) or {}).get('body', '').strip()
                        if not sender or not body:
                            continue
                        result = analyze(body[:4000], structural=True)
                        _send_text(sender, format_reply(result))
        except Exception:  # a malformed payload must not trigger Meta retries
            logger.exception('WhatsApp webhook payload error.')
        return Response({'status': 'ok'}, status=200)
