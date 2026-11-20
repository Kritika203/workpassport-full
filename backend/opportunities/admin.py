from django.contrib import admin
from .models import Application, Job, SavedJob


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ('title', 'client_name', 'owner', 'status', 'payment_verified')
    list_filter = ('status', 'payment_verified')
    search_fields = ('title', 'client_name')

    def save_model(self, request, obj, form, change):
        before = None
        if change:
            before = Job.objects.filter(pk=obj.pk).values('status', 'payment_verified').first()
        super().save_model(request, obj, form, change)
        if not before or before['status'] != obj.status or before['payment_verified'] != obj.payment_verified:
            from workflows.models import StaffAuditLog
            StaffAuditLog.objects.create(actor=request.user, action=f'job_status:{obj.status}',
                                         target_model='Job', target_id=obj.pk)


admin.site.register(Application)
admin.site.register(SavedJob)
