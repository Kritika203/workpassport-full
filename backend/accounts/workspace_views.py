"""Keep each user's WorkPassport data in their own account."""
import json
from django.db import transaction
from rest_framework import permissions
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import WorkspaceState

# Only WorkPassport settings are accepted, not arbitrary server fields.
ALLOWED_KEYS = {
    'wp_user_profile', 'wp_saved', 'wp_applied', 'wp_skill_levels',
    'wp_confirmed', 'wp_pay_checklist', 'wp_shield_history', 'wp_evidence',
    'wp_trusted_contact', 'wp_checkin', 'wp_quiet', 'wp_skill_evidence',
    'wp_chats', 'wp_client_actions', 'wp_chat_drafts', 'wp_apply_draft',
    'wp_workrooms', 'wp_client_mode', 'wp_client_profile', 'wp_client_jobs',
    'wp_curated_jobs', 'wp_bring_submissions', 'wp_language',
}
MAX_ITEM_BYTES = 800_000
MAX_TOTAL_BYTES = 3_000_000


class WorkspaceStateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        workspace, _ = WorkspaceState.objects.get_or_create(user=request.user)
        return Response({'state': workspace.data, 'updated_at': workspace.updated_at})

    def patch(self, request):
        if not isinstance(request.data, dict):
            raise ValidationError({'updates': 'Provide a JSON object.'})
        updates = request.data.get('updates')
        if not isinstance(updates, dict) or not updates:
            raise ValidationError({'updates': 'Provide a non-empty object.'})
        if set(updates) - ALLOWED_KEYS:
            raise ValidationError({'updates': 'Contains unsupported settings.'})
        for value in updates.values():
            if len(json.dumps(value, ensure_ascii=False).encode('utf-8')) > MAX_ITEM_BYTES:
                raise ValidationError({'updates': 'One item is too large. Reduce the saved file size.'})
        with transaction.atomic():
            workspace, _ = WorkspaceState.objects.get_or_create(user=request.user)
            workspace = WorkspaceState.objects.select_for_update().get(pk=workspace.pk)
            next_data = {**workspace.data, **updates}
            if len(json.dumps(next_data, ensure_ascii=False).encode('utf-8')) > MAX_TOTAL_BYTES:
                raise ValidationError({'updates': 'Your saved data is too large. Remove old attachments.'})
            workspace.data = next_data
            workspace.save(update_fields=['data', 'updated_at'])
        return Response({'saved': list(updates), 'updated_at': workspace.updated_at})
