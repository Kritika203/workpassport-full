from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.db import transaction
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from .models import Profile, Skill, WorkSample, TrainingEntry, SkillVerification

User = get_user_model()


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    display_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=Profile.ROLE_CHOICES, default=Profile.FREELANCER)

    def validate_username(self, value):
        value = value.strip()
        try:
            UnicodeUsernameValidator()(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(list(error.messages))
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('Username is already taken.')
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Email is already registered.')
        return value

    def validate_password(self, value):
        try:
            validate_password(value, user=User(username=self.initial_data.get('username', ''), email=self.initial_data.get('email', '')))
        except DjangoValidationError as error:
            raise serializers.ValidationError(list(error.messages))
        return value

    @transaction.atomic
    def create(self, validated_data):
        role = validated_data.pop('role')
        display_name = validated_data.pop('display_name', '')
        user = User.objects.create_user(**validated_data)
        Profile.objects.create(user=user, role=role, display_name=display_name)
        return user


class ProfileSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='user.pk', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    is_staff = serializers.BooleanField(source='user.is_staff', read_only=True)

    class Meta:
        model = Profile
        fields = [
            'id', 'username', 'email', 'role', 'display_name', 'bio', 'preferred_language',
            'headline', 'district', 'languages', 'availability', 'rate_note', 'tools', 'work_wanted', 'onboarded', 'email_verified', 'business_name', 'town', 'is_staff',
        ]
        read_only_fields = ['id', 'username', 'email', 'role', 'is_staff', 'email_verified']

    def validate_languages(self, value):
        if not isinstance(value, list) or len(value) > 8 or any(not isinstance(x, str) or len(x) > 40 for x in value):
            raise serializers.ValidationError('Choose up to eight languages.')
        return value

    def validate_tools(self, value):
        if not isinstance(value, list) or len(value) > 20 or any(not isinstance(x, str) or len(x) > 60 for x in value):
            raise serializers.ValidationError('Choose up to twenty tools.')
        return value

    def validate_work_wanted(self, value):
        if not isinstance(value, list) or len(value) > 12 or any(not isinstance(x, str) or len(x) > 80 for x in value):
            raise serializers.ValidationError('Choose up to twelve work categories.')
        return value


class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ['id', 'name', 'level']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Skill name cannot be empty.')
        request = self.context['request']
        other = Skill.objects.filter(user=request.user, name__iexact=value)
        if self.instance:
            other = other.exclude(pk=self.instance.pk)
        if other.exists():
            raise serializers.ValidationError('You already added this skill.')
        return value


class WorkSampleSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkSample
        fields = ['id', 'skill', 'title', 'description', 'url', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_skill(self, skill):
        if skill and skill.user_id != self.context['request'].user.id:
            raise serializers.ValidationError('This skill does not belong to your account.')
        return skill

    def validate_url(self, value):
        if not value.startswith(('https://', 'http://')):
            raise serializers.ValidationError('Use an http or https link.')
        return value


class TrainingEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingEntry
        fields = ['id', 'title', 'institution', 'year']
        read_only_fields = ['id']

    def validate_year(self, year):
        from datetime import date
        if year and (year < 1950 or year > date.today().year + 1):
            raise serializers.ValidationError('Enter a valid training year.')
        return year


class SkillVerificationSerializer(serializers.ModelSerializer):
    skill_name = serializers.CharField(source='skill.name', read_only=True)
    verified_by_name = serializers.CharField(source='verified_by.username', read_only=True, default=None)

    class Meta:
        model = SkillVerification
        fields = ['id', 'skill', 'skill_name', 'level', 'evidence_url', 'proof_asset',
                  'verified_by_name', 'verified_at', 'created_at']
        read_only_fields = ['id', 'skill_name', 'verified_by_name', 'verified_at', 'created_at']

    def validate_skill(self, skill):
        if skill.user_id != self.context['request'].user.pk:
            raise serializers.ValidationError('Choose one of your own skills.')
        return skill

    def validate_proof_asset(self, asset):
        if asset and asset.owner_id != self.context['request'].user.pk:
            raise serializers.ValidationError('The proof must belong to your account.')
        return asset

    def validate(self, attrs):
        level = attrs.get('level', self.instance.level if self.instance else 'self')
        request = self.context['request']
        if level in ('institution', 'client', 'platform') and not request.user.is_staff:
            raise serializers.ValidationError({'level': 'Independent verification is assigned by an authorized reviewer.'})
        if level == 'demonstrated' and not (attrs.get('proof_asset') or attrs.get('evidence_url') or (self.instance and (self.instance.proof_asset or self.instance.evidence_url))):
            raise serializers.ValidationError({'evidence_url': 'Include a work sample for demonstrated skills.'})
        return attrs
