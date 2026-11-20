"""User-consented browser extension pairing with narrowly scoped revocable credentials.

No account passwords or web JWTs are stored in the extension. A pairing code can be
redeemed once; only the resulting opaque token is kept in chrome.storage.local.
"""
import hashlib
import secrets
from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.authentication import BaseAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication
from urllib.parse import urlsplit
from rest_framework.exceptions import AuthenticationFailed, ValidationError, Throttled
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.views import APIView
from .models import BrowserPairingCode, BrowserExtensionSession, SafetyCheck, EvidenceRecord, ExternalSavedJob
from .services import analyze

ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # Avoid O, I, 0, 1 confusion.


def digest(value):
    return hashlib.sha256(value.encode('ascii')).hexdigest()


class ExtensionActivationRate(AnonRateThrottle):
    scope = 'extension_activation'


class ExtensionUserRate(UserRateThrottle):
    scope = 'extension_user'


class ExtensionTokenAuthentication(BaseAuthentication):
    def authenticate_header(self, request):
        # A revoked extension credential must produce an actual HTTP 401.
        return 'Extension'

    def authenticate(self, request):
        header = request.META.get('HTTP_AUTHORIZATION', '')
        if not header.startswith('Extension '):
            return None
        token = header[len('Extension '):]
        if len(token) != 64 or any(char not in '0123456789abcdef' for char in token.lower()):
            raise AuthenticationFailed('Invalid extension token.')
        session = BrowserExtensionSession.objects.select_related('owner').filter(
            token_digest=digest(token), revoked_at__isnull=True,
            expires_at__gt=timezone.now(), owner__is_active=True,
        ).first()
        if session is None:
            raise AuthenticationFailed('Extension pairing expired or revoked. Pair again.')
        return (session.owner, session)


class ExtensionOnly(APIView):
    authentication_classes = [ExtensionTokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ExtensionUserRate]


class PairExtension(APIView):
    throttle_classes = [ExtensionUserRate]

    def get(self, request):
        return Response({'sessions': [
            {'id': row.pk, 'label': row.label, 'created_at': row.created_at,
             'expires_at': row.expires_at}
            for row in BrowserExtensionSession.objects.filter(
                owner=request.user, revoked_at__isnull=True, expires_at__gt=timezone.now()
            ).order_by('-created_at')[:10]
        ]})

    def post(self, request):
        label = request.data.get('label', 'My browser')
        if not isinstance(label, str) or len(label) > 80:
            raise ValidationError({'label': 'Name your browser (up to 80 characters).'})
        # A code remains valid for five minutes and a user has only one active code.
        BrowserPairingCode.objects.filter(owner=request.user).delete()
        code = ''.join(secrets.choice(ALPHABET) for _ in range(12))
        BrowserPairingCode.objects.create(
            owner=request.user, code_digest=digest(code),
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        return Response({'code': code, 'expires_in_seconds': 300}, status=201)


class RevokeExtension(APIView):
    def delete(self, request, pk):
        count = BrowserExtensionSession.objects.filter(
            pk=pk, owner=request.user, revoked_at__isnull=True,
        ).update(revoked_at=timezone.now())
        if not count:
            raise ValidationError({'detail': 'Device not found or already disconnected.'})
        return Response(status=204)


class ActivateExtension(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ExtensionActivationRate]

    @transaction.atomic
    def post(self, request):
        code = request.data.get('code', '')
        if not isinstance(code, str) or len(code.replace(' ', '')) != 12:
            raise ValidationError({'code': 'Enter the twelve-character pairing code.'})
        clean = code.replace(' ', '').upper()
        pairing = BrowserPairingCode.objects.select_for_update().select_related('owner').filter(
            code_digest=digest(clean), expires_at__gt=timezone.now(), owner__is_active=True,
        ).first()
        if pairing is None:
            # No existence disclosure; rate limit prevents repeated guessing.
            raise ValidationError({'code': 'Invalid or expired pairing code.'})
        label = request.data.get('label', 'Chrome extension')
        if not isinstance(label, str) or len(label) > 80:
            raise ValidationError({'label': 'Browser label must be 80 characters or fewer.'})
        token = secrets.token_hex(32)
        BrowserExtensionSession.objects.create(
            owner=pairing.owner, label=label.strip() or 'Chrome extension',
            token_digest=digest(token), expires_at=timezone.now() + timedelta(days=30),
        )
        pairing.delete()
        return Response({'token': token, 'expires_in_days': 30}, status=201)


class ExtensionStatus(ExtensionOnly):
    def get(self, request):
        p = request.user.profile
        return Response({'connected': True, 'name': p.display_name or request.user.username,
                         'role': p.role, 'web_url': settings.WEB_FRONTEND_URL, 'expires_at': request.auth.expires_at})


class ExtensionCheck(ExtensionOnly):
    def post(self, request):
        content = request.data.get('text', '')
        if not isinstance(content, str) or not content.strip() or len(content) > 10000:
            raise ValidationError({'text': 'Enter 1 to 10,000 characters.'})
        result = analyze(content, structural=bool(request.data.get('structural', True)))
        if request.data.get('save') is True:
            SafetyCheck.objects.create(
                owner=request.user, text_excerpt=content.strip()[:240],
                risk=result['verdict'], flags=result['findings'],
            )
        return Response(result)


class ExtensionEvidence(ExtensionOnly):
    def post(self, request):
        content = request.data.get('text', '')
        if not isinstance(content, str) or not content.strip() or len(content) > 10000:
            raise ValidationError({'text': 'Enter 1 to 10,000 characters.'})
        categories = request.data.get('categories', [])
        if not isinstance(categories, list) or len(categories) > 12 or any(
            not isinstance(x, str) or len(x) > 30 for x in categories
        ):
            raise ValidationError({'categories': 'Choose up to 12 valid categories.'})
        row = EvidenceRecord.objects.create(
            owner=request.user, text=content.strip(), categories=categories, source='extension',
        )
        return Response({'id': row.pk, 'saved': True}, status=201)


class ExtensionPassport(ExtensionOnly):
    def get(self, request):
        from accounts.models import Skill
        from opportunities.models import Application
        from .models import Milestone
        skill_names = list(Skill.objects.filter(user=request.user).values_list('name', flat=True)[:15])
        return Response({
            'name': request.user.profile.display_name or request.user.username,
            'skills': skill_names,
            'accepted_jobs': Application.objects.filter(user=request.user, status='accepted').count(),
            'completed_milestones': Milestone.objects.filter(
                workroom__application__user=request.user, state='released_demo',
            ).count(),
            'note': 'Milestone payment states are simulations, not real transactions.',
        })


class ExtensionSavedJobs(APIView):
    """One private bookmark list, accessed by either the website or paired extension."""
    authentication_classes = [ExtensionTokenAuthentication, JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ExtensionUserRate]

    def get(self, request):
        return Response({'results': [
            {'id': row.id, 'title': row.title, 'external_url': row.external_url,
             'created_at': row.created_at}
            for row in ExternalSavedJob.objects.filter(owner=request.user)[:100]
        ]})

    def post(self, request):
        title = request.data.get('title', '')
        url = request.data.get('external_url', '')
        excerpt = request.data.get('text_excerpt', '')
        if not isinstance(title, str) or not title.strip() or len(title) > 180:
            raise ValidationError({'title': 'Enter a title of at most 180 characters.'})
        if not isinstance(url, str) or len(url) > 1200:
            raise ValidationError({'external_url': 'Invalid URL length.'})
        if not isinstance(excerpt, str) or len(excerpt) > 500:
            raise ValidationError({'text_excerpt': 'Too long.'})
        if url:
            try:
                parts = urlsplit(url)
                if parts.scheme not in ('https', 'http') or not parts.hostname or parts.username or parts.password:
                    raise ValueError()
            except ValueError:
                raise ValidationError({'external_url': 'Use a valid HTTP or HTTPS job link.'})
        item = ExternalSavedJob.objects.create(
            owner=request.user, title=title.strip(), external_url=url, text_excerpt=excerpt.strip()
        )
        return Response({'id': item.pk, 'saved': True}, status=201)


class ExtensionSavedJobDelete(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        count, _ = ExternalSavedJob.objects.filter(owner=request.user, pk=pk).delete()
        if not count:
            raise ValidationError({'detail': 'Saved link was not found.'})
        return Response(status=204)
