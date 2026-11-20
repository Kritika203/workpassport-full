"""Seeded Maya identity and isolated temporary demos."""
import os
import secrets
from django.contrib.auth import get_user_model
from django.db import transaction
from .models import Profile, WorkspaceState, Skill, TrainingEntry, SkillVerification

MAYA = {
    'name': 'Maya Shrestha', 'district': 'Morang',
    'workWanted': ['Design', 'Social Media', 'Data Entry'],
    'skills': ['Canva', 'Photoshop', 'Logo Design', 'Social Media Posts', 'English Writing', 'Typing / Data Entry'],
    'safetyRules': {'chat': True, 'calls': True, 'time': True, 'photo': True, 'hours': True},
    'badge': 'Beginner',
    'headline': 'Design graduate — logos, social media posts and Canva designs',
    'about': 'I am a design graduate from Biratnagar. I make logos, invitation cards and social media posts.',
    'languages': ['Nepali', 'English', 'Hindi'],
    'availability': 'Weekdays and Saturday, about 15 hours a week',
    'rateNote': 'Most small design jobs: NPR 3,000 – 8,000',
    'tools': ['Laptop', 'Smartphone', 'Canva (free)', 'Photoshop'],
    'training': [{'title': 'Graphic Design course', 'where': 'ABC Training Institute, Biratnagar', 'year': '2026'}],
}


def sample_state():
    return {'wp_user_profile': MAYA.copy(), 'wp_skill_levels': {'Canva': 'demonstrated', 'Photoshop': 'institution'}, 'wp_saved': [], 'wp_applied': []}


def populate_maya(user):
    # All practice users get the same fictional profile, with their own records.
    profile, _ = Profile.objects.get_or_create(user=user)
    profile.display_name = MAYA['name']
    profile.headline = MAYA['headline']
    profile.bio = MAYA['about']
    profile.district = MAYA['district']
    profile.languages = MAYA['languages']
    profile.availability = MAYA['availability']
    profile.rate_note = MAYA['rateNote']
    profile.tools = MAYA['tools']
    profile.work_wanted = MAYA['workWanted']
    profile.onboarded = True
    profile.save()
    for name in MAYA['skills']:
        skill, _ = Skill.objects.get_or_create(user=user, name=name)
        if name == 'Canva':
            SkillVerification.objects.get_or_create(skill=skill, level='demonstrated', defaults={
                'evidence_url': 'https://example.invalid/fictional-canva-sample',
            })
    for record in MAYA['training']:
        TrainingEntry.objects.get_or_create(user=user, title=record['title'],
                                            institution=record['where'], defaults={'year': record['year']})


def seed_maya(password):
    if len(password) < 12:
        raise ValueError('DEMO_MAYA_PASSWORD must contain at least 12 characters.')
    User = get_user_model()
    with transaction.atomic():
        user, _ = User.objects.get_or_create(username='maya_demo', defaults={'email': 'maya-demo@example.invalid'})
        user.set_password(password)
        user.is_staff = False
        user.is_superuser = False
        user.is_active = True
        user.save()
        Profile.objects.update_or_create(user=user, defaults={'role': 'freelancer', 'display_name': MAYA['name']})
        WorkspaceState.objects.get_or_create(user=user, defaults={'data': sample_state()})
        populate_maya(user)
        return user


def create_private_demo():
    User = get_user_model()
    # Each visitor gets their own fictional Maya account, not the shared seeded identity.
    with transaction.atomic():
        username = 'demo_' + secrets.token_hex(10)
        user = User.objects.create_user(username=username, password=secrets.token_urlsafe(32), email=f'{username}@example.invalid')
        user.set_unusable_password()
        user.save(update_fields=['password'])
        Profile.objects.create(user=user, role='freelancer', display_name=MAYA['name'])
        WorkspaceState.objects.create(user=user, data=sample_state())
        populate_maya(user)
    return user
