"""Opt-in text translation using a configured LibreTranslate-compatible service.
No public third-party provider is silently selected; messages remain private by default.
"""
import json
import os
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError
from django.core.cache import cache
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

class TranslateText(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        text = request.data.get('text', '')
        source = request.data.get('source', '')
        target = request.data.get('target', '')
        if not isinstance(text, str) or not text.strip() or len(text) > 1800:
            return Response({'detail': 'Text must be 1–1800 characters.'}, status=400)
        if source not in ('en', 'ne') or target not in ('en', 'ne') or source == target:
            return Response({'detail': 'Choose different English and Nepali languages.'}, status=400)
        configured = os.getenv('WP_TRANSLATE_ENDPOINT', '').strip()
        if not configured.startswith('https://'):
            return Response({'detail': 'Translation is not configured. Original messages still work.'}, status=503)
        key = f'wp_translate:{request.user.id}'
        try:
            if cache.add(key, 1, timeout=60):
                pass
            else:
                current = cache.incr(key)
                if current > 12:
                    return Response({'detail': 'Translation limit reached. Try again shortly.'}, status=429)
        except (ValueError, TypeError):
            return Response({'detail': 'Translation temporarily unavailable.'}, status=503)
        payload = {'q': text, 'source': source, 'target': target, 'format': 'text'}
        secret = os.getenv('WP_TRANSLATE_API_KEY', '')
        if secret: payload['api_key'] = secret
        try:
            req = urlrequest.Request(configured, json.dumps(payload).encode('utf-8'),
                                     {'Content-Type': 'application/json'}, method='POST')
            with urlrequest.urlopen(req, timeout=8) as response:
                result = json.load(response)
            translated = result.get('translatedText')
            if not isinstance(translated, str) or not translated.strip():
                raise ValueError('Empty translation')
            return Response({'translated': translated, 'source': source, 'target': target,
                             'notice': 'Machine translation may be inaccurate. Review before sending.'})
        except (HTTPError, URLError, ValueError, KeyError, TimeoutError):
            return Response({'detail': 'Translation service unavailable. Use the original message.'}, status=503)
