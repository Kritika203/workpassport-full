from django import forms
from django.contrib import admin
from django.db import transaction
from django.utils import timezone
from .models import Application, Job, SavedJob, JobModerationEvent


class StaffJobForm(forms.ModelForm):
    moderation_reason = forms.CharField(required=False, widget=forms.Textarea(attrs={'rows':2}), help_text='Required when changing publication status or payment verification. Recorded in audit history.')
    class Meta:
        model = Job
        fields = '__all__'
    def clean(self):
        c = super().clean()
        if self.instance.pk:
            old = Job.objects.get(pk=self.instance.pk)
            if (c.get('status',old.status)!=old.status or c.get('payment_verified',old.payment_verified)!=old.payment_verified) and not (c.get('moderation_reason') or '').strip():
                self.add_error('moderation_reason','Please explain the moderation change.')
        return c


class DecisionHistory(admin.TabularInline):
    model = JobModerationEvent
    extra = 0
    can_delete = False
    readonly_fields = ['actor','source','old_status','new_status','reason','score','created_at']
    def has_add_permission(self, request, obj=None): return False


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    form = StaffJobForm
    list_display = ('title','client_name','owner','status','moderation_source','payment_verified')
    list_filter = ('status','moderation_source','payment_verified')
    readonly_fields = ['moderation_source','moderation_score','moderation_reasons','moderated_at']
    search_fields = ('title','client_name')
    inlines = [DecisionHistory]
    actions = None
    def save_model(self, request, obj, form, change):
        prior = Job.objects.filter(pk=obj.pk).values('status','payment_verified').first() if change else None
        previous = prior['status'] if prior else ''
        changed = not prior or previous!=obj.status or prior['payment_verified']!=obj.payment_verified
        with transaction.atomic():
            if changed:
                obj.moderation_source='staff'
                obj.moderation_reasons=['staff_decision']
                obj.moderated_at=timezone.now()
            super().save_model(request,obj,form,change)
            if changed:
                reason=(form.cleaned_data.get('moderation_reason') or 'Staff created listing').strip()
                JobModerationEvent.objects.create(job=obj,actor=request.user,source='staff',old_status=previous,new_status=obj.status,reason=reason,score=obj.moderation_score)
                from workflows.models import StaffAuditLog
                StaffAuditLog.objects.create(actor=request.user,action=f'job_status:{obj.status}',target_model='Job',target_id=obj.pk)


@admin.register(JobModerationEvent)
class ModerationHistory(admin.ModelAdmin):
    list_display = ('job','source','actor','old_status','new_status','created_at')
    readonly_fields = ['job','source','actor','old_status','new_status','reason','score','created_at']
    def has_add_permission(self,request):return False
    def has_change_permission(self,request,obj=None):return False
    def has_delete_permission(self,request,obj=None):return False

admin.site.register(Application)
admin.site.register(SavedJob)
