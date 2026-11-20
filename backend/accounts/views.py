from django.conf import settings
from django.db import IntegrityError
from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from .models import Profile, Skill, WorkSample, TrainingEntry, SkillVerification
from .permissions import IsFreelancer
from .serializers import ProfileSerializer, RegisterSerializer, SkillSerializer, WorkSampleSerializer, TrainingEntrySerializer, SkillVerificationSerializer


class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = serializer.save()
        except IntegrityError:
            return Response({'detail': 'Username or email is already registered.'}, status=400)
        return Response({'id': user.pk, 'username': user.username, 'role': user.profile.role}, status=201)


class LogoutView(APIView):
    def post(self, request):
        refresh = request.data.get('refresh')
        if not isinstance(refresh, str) or not refresh:
            return Response({'refresh': ['Provide a refresh token.']}, status=400)
        try:
            token = RefreshToken(refresh)
            if str(token['user_id']) != str(request.user.pk):
                return Response({'detail': 'Token does not belong to this account.'}, status=403)
            token.blacklist()
        except (TokenError, KeyError):
            return Response({'detail': 'Invalid refresh token.'}, status=400)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_object(self):
        profile, _ = Profile.objects.get_or_create(user=self.request.user)
        return profile


class SkillViewSet(viewsets.ModelViewSet):
    serializer_class = SkillSerializer
    permission_classes = [IsFreelancer]

    def get_queryset(self):
        return Skill.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class WorkSampleViewSet(viewsets.ModelViewSet):
    serializer_class = WorkSampleSerializer
    permission_classes = [IsFreelancer]

    def get_queryset(self):
        return WorkSample.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class DemoSessionView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'demo'

    def get_throttles(self):
        from rest_framework.throttling import ScopedRateThrottle
        return [ScopedRateThrottle()]

    def post(self, request):
        if not settings.DEBUG and not getattr(settings, 'ALLOW_DEMO_SESSIONS', False):
            return Response({'detail': 'Demo sessions are disabled.'}, status=403)
        from .demo import create_private_demo
        user = create_private_demo()
        tokens = RefreshToken.for_user(user)
        return Response({'refresh': str(tokens), 'access': str(tokens.access_token)})


class TrainingEntryViewSet(viewsets.ModelViewSet):
    serializer_class = TrainingEntrySerializer
    permission_classes = [IsFreelancer]

    def get_queryset(self):
        return TrainingEntry.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SkillVerificationViewSet(viewsets.ModelViewSet):
    serializer_class = SkillVerificationSerializer
    permission_classes = [IsFreelancer]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        return SkillVerification.objects.filter(skill__user=self.request.user).select_related('skill', 'verified_by', 'proof_asset')

    def perform_create(self, serializer):
        import django.utils.timezone as tz
        level = serializer.validated_data.get('level', 'self')
        if self.get_queryset().filter(skill=serializer.validated_data['skill'], level=level).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'level': 'This skill already has proof at that level.'})
        serializer.save(verified_by=self.request.user if self.request.user.is_staff and level not in ('self', 'demonstrated') else None,
                        verified_at=tz.now() if self.request.user.is_staff and level not in ('self', 'demonstrated') else None)

    def perform_destroy(self, instance):
        from rest_framework.exceptions import PermissionDenied
        if instance.level not in ('self', 'demonstrated'):
            raise PermissionDenied('Ask a reviewer to revoke an independently verified skill.')
        instance.delete()


class PassportProgress(APIView):
    permission_classes = [IsFreelancer]

    def get(self, request):
        weights = {'self': 1, 'demonstrated': 2, 'institution': 3, 'client': 4, 'platform': 5}
        skills = Skill.objects.filter(user=request.user).prefetch_related('verifications')
        results = []
        for skill in skills:
            records = list(skill.verifications.all())
            allowed = [v.level for v in records if v.level in ('self', 'demonstrated') or v.verified_at]
            level = max(allowed, key=lambda v: weights[v], default='self')
            results.append({'skill': skill.name, 'level': level, 'weight': weights[level],
                            'independently_verified': any(v.verified_at is not None for v in records),
                            'evidence_count': len(records)})
        return Response({'skills': results, 'total_points': sum(row['weight'] for row in results),
                         'max_points': len(results) * 5})
