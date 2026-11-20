from django.contrib import admin
from .models import (SafetyCheck, EvidenceRecord, SubmittedOpportunity, ClientContact,
                     ApplicationMessage, Workroom, Milestone, UserSafetyPreferences,
                     SafetyCheckIn, InboxNotification, ProofAsset, PublicPassportLink, StaffAuditLog)

for model in (SafetyCheck, EvidenceRecord, SubmittedOpportunity, ClientContact,
              ApplicationMessage, Workroom, Milestone, UserSafetyPreferences,
              SafetyCheckIn, InboxNotification, ProofAsset, PublicPassportLink):
    admin.site.register(model)


@admin.register(StaffAuditLog)
class StaffAuditLogAdmin(admin.ModelAdmin):
    list_display = ['actor', 'action', 'target_model', 'target_id', 'created_at']
    list_filter = ['action', 'target_model']
    readonly_fields = ['actor', 'action', 'target_model', 'target_id', 'created_at']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
