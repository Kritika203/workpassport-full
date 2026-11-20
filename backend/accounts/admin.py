from django.contrib import admin
from .models import Profile, Skill, WorkSample, SafetyReport, WorkspaceState, TrainingEntry, SkillVerification

admin.site.register(Profile)
admin.site.register(Skill)
admin.site.register(WorkSample)


@admin.register(SafetyReport)
class SafetyReportAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'kind', 'reason', 'status', 'created_at']
    list_filter = ['kind', 'status']
    readonly_fields = ['user', 'kind', 'job_reference', 'reason', 'created_at']

    def save_model(self, request, obj, form, change):
        before = SafetyReport.objects.filter(pk=obj.pk).values_list('status', flat=True).first() if change else None
        super().save_model(request, obj, form, change)
        if before != obj.status:
            from workflows.models import StaffAuditLog
            StaffAuditLog.objects.create(actor=request.user, action=f'report_status:{obj.status}',
                                         target_model='SafetyReport', target_id=obj.pk)

admin.site.register(WorkspaceState)


admin.site.register(TrainingEntry)

@admin.register(SkillVerification)
class SkillVerificationAdmin(admin.ModelAdmin):
    list_display = ['skill', 'level', 'verified_by', 'verified_at', 'created_at']
    list_filter = ['level']
    # Staff issues independent verifications. Freelancers cannot do that themselves.
    def save_model(self, request, obj, form, change):
        from django.utils import timezone
        if obj.level in ('institution', 'client', 'platform'):
            obj.verified_by = request.user
            obj.verified_at = obj.verified_at or timezone.now()
        super().save_model(request, obj, form, change)
