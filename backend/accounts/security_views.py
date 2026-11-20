"""Account recovery and personal-data controls."""
import logging

logger = logging.getLogger(__name__)
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import signing
from django.core.mail import send_mail
from django.db import transaction
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes
from rest_framework import permissions
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

User = get_user_model()


class RecoveryRate(AnonRateThrottle):
    scope = 'account_recovery'


class ProfileRecoveryRate(UserRateThrottle):
    scope = 'account_recovery'


class RequestPasswordReset(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RecoveryRate]

    def post(self, request):
        email = request.data.get('email', '')
        if not isinstance(email, str) or len(email) > 254:
            raise ValidationError({'email': 'Enter a valid email address.'})
        user = User.objects.filter(email__iexact=email.strip(), is_active=True).first()
        if user and user.has_usable_password():
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            url = f"{settings.WEB_FRONTEND_URL}/?reset_uid={uid}&reset_token={token}"
            try:
                send_mail('Reset your WorkPassport password',
                          f'Use this link to reset your password: {url}\nIf you did not ask for this, ignore the email.',
                          settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
            except Exception:
                # Do not reveal whether the account exists when delivery fails.
                # The server logs delivery failure without printing the reset token.
                logger.warning('Password reset email delivery failed; check provider configuration.')
        # Identical reply whether or not this account exists.
        return Response({'detail': 'If an account uses that email, a password reset link will be sent.'})


class ConfirmPasswordReset(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RecoveryRate]

    def post(self, request):
        uid = request.data.get('uid', '')
        token = request.data.get('token', '')
        password = request.data.get('password', '')
        if not all(isinstance(v, str) for v in (uid, token, password)):
            raise ValidationError({'detail': 'Invalid reset request.'})
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid)))
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            raise ValidationError({'detail': 'Reset link is invalid or expired.'})
        if not default_token_generator.check_token(user, token):
            raise ValidationError({'detail': 'Reset link is invalid or expired.'})
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            validate_password(password, user=user)
        except DjangoValidationError as e:
            raise ValidationError({'password': list(e.messages)})
        user.set_password(password)
        user.save(update_fields=['password'])
        _blacklist_refresh(user)
        return Response({'detail': 'Password updated. Please sign in again.'})


def _blacklist_refresh(user):
    # Access tokens still expire on their normal short lifetime.
    for token in OutstandingToken.objects.filter(user=user).iterator():
        BlacklistedToken.objects.get_or_create(token=token)


class SignOutEverywhere(APIView):
    def post(self, request):
        _blacklist_refresh(request.user)
        return Response({'detail': 'All refresh sessions have been revoked. Current access tokens expire shortly.'})


class RequestEmailVerification(APIView):
    throttle_classes = [ProfileRecoveryRate]

    def post(self, request):
        if request.user.profile.email_verified:
            return Response({'detail': 'Email already verified.'})
        token = signing.dumps({'user': request.user.pk, 'email': request.user.email}, salt='wp-verify-email')
        url = f'{settings.BACKEND_PUBLIC_URL}/api/auth/email-verification/confirm/?token={token}'
        send_mail('Verify your WorkPassport email', f'Open this link to verify your email: {url}',
                  settings.DEFAULT_FROM_EMAIL, [request.user.email], fail_silently=False)
        return Response({'detail': 'Verification link sent.'})


class ConfirmEmailVerification(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [RecoveryRate]

    def get(self, request):
        try:
            details = signing.loads(request.query_params.get('token', ''), salt='wp-verify-email', max_age=86400)
            user = User.objects.get(pk=details['user'], email=details['email'], is_active=True)
        except (signing.BadSignature, signing.SignatureExpired, User.DoesNotExist, TypeError, KeyError):
            raise ValidationError({'detail': 'Verification link is invalid or expired.'})
        user.profile.email_verified = True
        user.profile.save(update_fields=['email_verified'])
        return Response({'detail': 'Email verified. You may return to WorkPassport.'})


class MyData(APIView):
    def get(self, request):
        # Export readable records, not password hashes, tokens, or other people's information.
        from opportunities.models import SavedJob, Application, Job
        from workflows.models import (EvidenceRecord, SafetyCheck, SubmittedOpportunity,
                                      SafetyCheckIn, UserSafetyPreferences, ApplicationMessage, Milestone)
        from accounts.models import Skill, TrainingEntry, WorkSample
        user = request.user
        profile = user.profile
        prefs = UserSafetyPreferences.objects.filter(owner=user).first()
        return Response({
            'account': {'username': user.username, 'email': user.email, 'role': profile.role,
                        'display_name': profile.display_name, 'bio': profile.bio},
            'skills': list(Skill.objects.filter(user=user).values('name', 'level')),
            'training': list(TrainingEntry.objects.filter(user=user).values('title', 'institution', 'year')),
            'work_samples': list(WorkSample.objects.filter(user=user).values('title', 'description', 'url')),
            'saved_job_ids': list(SavedJob.objects.filter(user=user).values_list('job_id', flat=True)),
            'applications': list(Application.objects.filter(user=user).values('job_id', 'message', 'status', 'proposed_rate_usd')),
            'owned_jobs': list(Job.objects.filter(owner=user).values('title', 'status', 'description')),
            'evidence': list(EvidenceRecord.objects.filter(owner=user).values('text', 'categories', 'source')),
            'safety_checks': list(SafetyCheck.objects.filter(owner=user).values('text_excerpt', 'risk')),
            'contributions': list(SubmittedOpportunity.objects.filter(owner=user).values('kind', 'payload', 'status')),
            'messages': list(ApplicationMessage.objects.filter(sender=user).values('application_id', 'text', 'created_at')),
            'checkins': list(SafetyCheckIn.objects.filter(owner=user).values('scheduled_for', 'acknowledged_at')),
            'safety_preferences': {'quiet_hours': prefs.quiet_hours, 'trusted_contact': prefs.trusted_contact,
                                   'boundaries': prefs.boundaries} if prefs else {},
            'notice': 'Files must be downloaded separately before deleting your account.',
        })

    @transaction.atomic
    def delete(self, request):
        password = request.data.get('password')
        if not isinstance(password, str) or not request.user.check_password(password):
            raise ValidationError({'password': 'Enter your current password to delete this account.'})
        user = request.user
        if user.is_staff:
            raise ValidationError({'detail': 'Staff accounts must be removed by an administrator.'})
        from workflows.models import ProofAsset
        assets = list(ProofAsset.objects.filter(owner=user).exclude(image_file=''))
        user.delete()
        def cleanup():
            for asset in assets:
                if asset.image_file:
                    asset.image_file.delete(save=False)
        transaction.on_commit(cleanup)
        return Response(status=204)
