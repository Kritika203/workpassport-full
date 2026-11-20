from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.permissions import IsClient, IsFreelancer
from . import proposal_ai
from .models import Application, Job, SavedJob
from .serializers import ApplicationSerializer, JobSerializer, SavedJobSerializer


class PublicJobs(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = JobSerializer

    def get_queryset(self):
        qs = Job.objects.filter(status='published')
        q = self.request.query_params.get('search', '').strip()[:100]
        category = self.request.query_params.get('category', '').strip()[:80]
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(description__icontains=q))
        if category:
            qs = qs.filter(category__iexact=category)
        skills = self.request.query_params.get('skill', '').strip()[:80].casefold()
        budget_min = self.request.query_params.get('min_budget')
        budget_max = self.request.query_params.get('max_budget')
        beginner = self.request.query_params.get('beginner')
        for value, lookup in ((budget_min, 'budget_usd__gte'), (budget_max, 'budget_usd__lte')):
            if value is not None:
                from decimal import Decimal, InvalidOperation
                try:
                    n = Decimal(value)
                    if n < 0: raise InvalidOperation
                except (InvalidOperation, TypeError):
                    raise ValidationError({lookup: 'Budget must be a positive number.'})
                qs = qs.filter(**{lookup: n})
        if beginner in ('true', '1'):
            qs = qs.filter(beginner_friendly=True)
        if skills:
            # JSON containment varies across database engines. Filter a bounded list instead.
            qs = [job for job in qs[:500] if any(isinstance(skill, str) and skill.casefold() == skills for skill in job.required_skills)]
        return qs


class PublicJobDetail(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = JobSerializer
    queryset = Job.objects.filter(status='published')


class ClientJobs(generics.ListCreateAPIView):
    permission_classes = [IsClient]
    serializer_class = JobSerializer

    def get_queryset(self):
        return Job.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user, status='pending_review', payment_verified=False)


class ClientJobDetail(generics.RetrieveUpdateAPIView):
    permission_classes = [IsClient]
    serializer_class = JobSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        return Job.objects.filter(owner=self.request.user)

    def perform_update(self, serializer):
        # Edited listings return to review; only admins publish/verify.
        serializer.save(status='pending_review', payment_verified=False)


class SavedJobs(generics.ListAPIView):
    permission_classes = [IsFreelancer]
    serializer_class = SavedJobSerializer

    def get_queryset(self):
        return SavedJob.objects.filter(user=self.request.user, job__status='published').select_related('job').order_by('-saved_at', '-id')


class SaveJob(APIView):
    permission_classes = [IsFreelancer]

    def post(self, request, pk):
        job = get_object_or_404(Job, pk=pk, status='published')
        obj, created = SavedJob.objects.get_or_create(user=request.user, job=job)
        return Response({'saved': True, 'job_id': job.pk}, status=201 if created else 200)

    def delete(self, request, pk):
        SavedJob.objects.filter(user=request.user, job_id=pk).delete()
        return Response(status=204)


class ApplyToJob(APIView):
    permission_classes = [IsFreelancer]

    def post(self, request, pk):
        job = get_object_or_404(Job, pk=pk, status='published')
        if job.owner_id is None:
            raise ValidationError({'detail': 'This is an external opportunity, not a WorkPassport application. Contact the organisation through its original listing.'})
        data = ApplicationSerializer(data=request.data, context={'request': request})
        data.is_valid(raise_exception=True)
        if Application.objects.filter(job=job, user=request.user).exists():
            raise ValidationError({'detail': 'You already applied to this job.'})
        try:
            with transaction.atomic():
                obj = data.save(job=job, user=request.user)
                if job.is_demo:
                    # Practice jobs use the same application records, but no real hiring takes place.
                    obj.status = 'accepted'
                    obj.save(update_fields=['status'])
        except IntegrityError:
            raise ValidationError({'detail': 'You already applied to this job.'})
        return Response(ApplicationSerializer(obj).data, status=201)


class MyApplications(generics.ListAPIView):
    permission_classes = [IsFreelancer]
    serializer_class = ApplicationSerializer

    def get_queryset(self):
        return Application.objects.filter(user=self.request.user).select_related('job', 'user')


class ClientApplications(generics.ListAPIView):
    permission_classes = [IsClient]
    serializer_class = ApplicationSerializer

    def get_queryset(self):
        return Application.objects.filter(job__owner=self.request.user).select_related('job', 'user', 'user__profile')


class ClientApplicationUpdate(generics.RetrieveUpdateAPIView):
    permission_classes = [IsClient]
    serializer_class = ApplicationSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        return Application.objects.filter(job__owner=self.request.user)

    def partial_update(self, request, *args, **kwargs):
        if set(request.data.keys()) != {'status'}:
            raise ValidationError({'detail': 'Only application status can be changed.'})
        if request.data.get('status') not in ('shortlisted', 'accepted', 'rejected'):
            raise ValidationError({'status': 'Choose shortlisted, accepted, or rejected.'})
        obj = self.get_object()
        if obj.status in ('accepted', 'rejected'):
            # Prevent repeated acceptance from sending duplicate notifications.
            raise ValidationError({'status': 'This decision is final.'})
        if obj.status == request.data['status']:
            raise ValidationError({'status': 'Application already has this status.'})
        obj.status = request.data['status']
        obj.save(update_fields=['status'])
        if obj.status == 'accepted':
            from workflows.models import InboxNotification
            InboxNotification.objects.create(owner=obj.user, kind='application', message='A client accepted your application.')
        return Response(ApplicationSerializer(obj).data)


class ProposalDraftView(APIView):
    """POST /api/jobs/proposal-draft/ — turn the freelancer's own Nepali
    (Devanagari, Roman, or mixed) words into an English proposal plus a
    simple Nepali back-translation for her approval. Nothing is sent to any
    client by this endpoint; it only returns a draft."""
    permission_classes = [permissions.IsAuthenticated, IsFreelancer]

    def post(self, request):
        text = str(request.data.get('text', '')).strip()
        job_title = str(request.data.get('job_title', '')).strip()[:200]
        if len(text) < 10:
            return Response(
                {'detail': 'Please write a little more about yourself and the work first.'},
                status=status.HTTP_400_BAD_REQUEST)
        if len(text) > 2000:
            return Response(
                {'detail': 'That is too long for one proposal. Please shorten it a little.'},
                status=status.HTTP_400_BAD_REQUEST)
        try:
            result = proposal_ai.draft_proposal(text, job_title)
        except proposal_ai.ProposalUnavailable:
            return Response(
                {'detail': 'The writing helper is not available right now. Your words are still here - please try again later.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(result)
