"""Freelancer Passport saved as individual database records."""
from django.db import transaction
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Profile, Skill, SkillVerification, TrainingEntry
from .serializers import ProfileSerializer, TrainingEntrySerializer
from workflows.models import UserSafetyPreferences


def build_passport(user):
    profile, _ = Profile.objects.get_or_create(user=user)
    skills = Skill.objects.filter(user=user).prefetch_related('verifications')
    training = TrainingEntry.objects.filter(user=user)
    levels = {'self': 1, 'demonstrated': 2, 'institution': 3, 'client': 4, 'platform': 5}
    skill_levels = {}
    for skill in skills:
        items = list(skill.verifications.all())
        # An unverified claim never gives a verified badge.
        available = [row.level for row in items if row.level in ('self', 'demonstrated') or row.verified_at]
        skill_levels[skill.name] = max(available, key=lambda x: levels[x], default='self')
    return {
        'profile': {
            'name': profile.display_name or user.username,
            'district': profile.district,
            'headline': profile.headline,
            'about': profile.bio,
            'languages': profile.languages,
            'availability': profile.availability,
            'rateNote': profile.rate_note,
            'tools': profile.tools,
            'workWanted': profile.work_wanted,
            'skills': list(skills.values_list('name', flat=True)),
            'training': [{'title': row.title, 'where': row.institution, 'year': row.year} for row in training],
            'onboarded': profile.onboarded,
            'badge': 'Beginner',
        },
        'skill_levels': skill_levels,
    }


class MyPassportDetails(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if getattr(getattr(request.user, 'profile', None), 'role', None) != Profile.FREELANCER:
            raise PermissionDenied('Only freelancers have a WorkPassport.')
        return Response(build_passport(request.user))

    @transaction.atomic
    def put(self, request):
        if getattr(getattr(request.user, 'profile', None), 'role', None) != Profile.FREELANCER:
            raise PermissionDenied('Only freelancers can update their WorkPassport.')
        data = request.data
        if not isinstance(data, dict):
            raise ValidationError({'detail': 'Provide your profile details.'})
        profile = request.user.profile
        mapping = {'name': 'display_name', 'about': 'bio', 'headline': 'headline',
                   'district': 'district', 'languages': 'languages', 'availability': 'availability',
                   'rateNote': 'rate_note', 'tools': 'tools', 'workWanted': 'work_wanted',
                   'onboarded': 'onboarded'}
        changes = {target: data[key] for key, target in mapping.items() if key in data}
        serializer = ProfileSerializer(profile, data=changes, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        if 'skills' in data:
            skills = data['skills']
            if (not isinstance(skills, list) or len(skills) > 30 or
                any(not isinstance(name, str) or not name.strip() or len(name) > 100 for name in skills)):
                raise ValidationError({'skills': 'Choose up to 30 skill names.'})
            clean = {name.strip().casefold(): name.strip() for name in skills}
            if len(clean) != len(skills):
                raise ValidationError({'skills': 'Remove duplicate skills.'})
            current = list(Skill.objects.filter(user=request.user))
            names = {row.name.casefold(): row for row in current}
            for key, name in clean.items():
                if key not in names:
                    Skill.objects.create(user=request.user, name=name)
            for row in current:
                if row.name.casefold() not in clean:
                    row.delete()
        if 'training' in data:
            training = data['training']
            if not isinstance(training, list) or len(training) > 25:
                raise ValidationError({'training': 'Provide up to 25 training entries.'})
            valid = []
            for record in training:
                if not isinstance(record, dict):
                    raise ValidationError({'training': 'Training entries must be objects.'})
                item = TrainingEntrySerializer(data={
                    'title': record.get('title', ''), 'institution': record.get('where', ''),
                    'year': record.get('year') or None,
                })
                item.is_valid(raise_exception=True)
                valid.append(item.validated_data)
            TrainingEntry.objects.filter(user=request.user).delete()
            TrainingEntry.objects.bulk_create([TrainingEntry(user=request.user, **item) for item in valid])
        if 'safetyRules' in data:
            rules = data['safetyRules']
            if not isinstance(rules, dict) or len(rules) > 12 or any(not isinstance(k, str) or not isinstance(v, bool) for k, v in rules.items()):
                raise ValidationError({'safetyRules': 'Invalid privacy settings.'})
            settings, _ = UserSafetyPreferences.objects.get_or_create(owner=request.user)
            settings.boundaries = rules
            settings.save(update_fields=['boundaries', 'updated_at'])
        return Response(build_passport(request.user))
