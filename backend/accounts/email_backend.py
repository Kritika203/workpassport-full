"""Transactional email through Brevo's HTTPS API.

Free Render web services block common SMTP ports. This backend sends Django's
usual password-reset and verification emails without an SMTP connection.
"""
import json
import os
from email.utils import parseaddr
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail import EmailMessage


class BrevoAPIEmailBackend(BaseEmailBackend):
    endpoint = 'https://api.brevo.com/v3/smtp/email'

    def send_messages(self, email_messages):
        if not email_messages:
            return 0
        api_key = os.getenv('BREVO_API_KEY', '').strip()
        if not api_key:
            if self.fail_silently:
                return 0
            raise ValueError('BREVO_API_KEY is missing; outgoing email is not configured.')

        sent = 0
        for message in email_messages:
            try:
                if not isinstance(message, EmailMessage):
                    raise TypeError('Expected a Django EmailMessage.')
                name, sender_email = parseaddr(message.from_email or '')
                if not sender_email or '@' not in sender_email:
                    raise ValueError('Configure DEFAULT_FROM_EMAIL using a verified sender address.')
                recipients = list(message.recipients())
                if not recipients:
                    continue
                payload = {
                    'sender': {'name': name or 'WorkPassport', 'email': sender_email},
                    'to': [{'email': address} for address in recipients],
                    'subject': message.subject,
                    'textContent': message.body,
                }
                req = Request(
                    self.endpoint,
                    data=json.dumps(payload).encode('utf-8'),
                    method='POST',
                    headers={
                        'api-key': api_key,
                        'Content-Type': 'application/json',
                        'accept': 'application/json',
                    },
                )
                with urlopen(req, timeout=12) as response:
                    if not 200 <= response.status < 300:
                        raise OSError(f'Email provider returned HTTP {response.status}')
                sent += 1
            except (HTTPError, URLError, OSError, ValueError, TypeError):
                if not self.fail_silently:
                    raise
        return sent
