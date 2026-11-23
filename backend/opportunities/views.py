from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.permissions import IsClient, IsFreelancer
from . import proposal_ai
from .moderation_flow import screen_job
from .models import Application, ClientInvite, ClientShortlist, Job, SavedJob
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
        job = serializer.save(owner=self.request.user, status='pending_review', payment_verified=False)
        screen_job(job)


class ClientJobDetail(generics.RetrieveUpdateAPIView):
    permission_classes = [IsClient]
    serializer_class = JobSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        return Job.objects.filter(owner=self.request.user)

    def perform_update(self, serializer):
        previous = serializer.instance.status
        if previous == 'closed':
            raise ValidationError({'detail': 'Closed jobs cannot be reopened by editing.'})
        job = serializer.save(status='pending_review', payment_verified=False)
        screen_job(job, previous=previous)


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
        if not set(request.data.keys()) <= {'status', 'decision_reason'} or 'status' not in request.data:
            raise ValidationError({'detail': 'Only application status and an optional decision reason can be changed.'})
        if request.data.get('status') not in ('shortlisted', 'accepted', 'rejected'):
            raise ValidationError({'status': 'Choose shortlisted, accepted, or rejected.'})
        reason = request.data.get('decision_reason', '')
        if not isinstance(reason, str) or len(reason.strip()) > 500:
            raise ValidationError({'decision_reason': 'Give a reason of up to 500 characters.'})
        obj = self.get_object()
        if obj.status in ('accepted', 'rejected'):
            # Prevent repeated acceptance from sending duplicate notifications.
            raise ValidationError({'status': 'This decision is final.'})
        if obj.status == request.data['status']:
            raise ValidationError({'status': 'Application already has this status.'})
        obj.status = request.data['status']
        obj.decision_reason = reason.strip()
        obj.save(update_fields=['status', 'decision_reason'])
        from workflows.models import InboxNotification
        if obj.status == 'accepted':
            InboxNotification.objects.create(owner=obj.user, kind='application', message='A client accepted your application.')
        else:
            InboxNotification.objects.create(owner=obj.user, kind='application', message='A client updated your application. Open My Opportunities to see the decision and their note.')
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

class ClientDashboard(APIView):
    """One aggregate read for the client home: job pipeline, what is waiting
    on the client, and simulated spending. Only the client's own data."""
    permission_classes = [IsClient]

    def get(self, request):
        from decimal import Decimal
        from workflows.models import Workroom
        user = request.user
        jobs = Job.objects.filter(owner=user)
        jobs_by_status = {}
        for status, _label in Job.STATUS_CHOICES:
            jobs_by_status[status] = jobs.filter(status=status).count()
        apps = Application.objects.filter(job__owner=user)
        review_items = []
        total_released = Decimal('0')
        spent = {}
        rooms = (Workroom.objects.filter(application__job__owner=user)
                 .select_related('application', 'application__job', 'application__user')
                 .prefetch_related('milestones'))
        for room in rooms:
            app = room.application
            entry = spent.setdefault(app.job_id, {
                'job_id': app.job_id, 'job_title': app.job.title,
                'released_usd': Decimal('0'), 'agreed_usd': app.proposed_rate_usd,
            })
            for m in room.milestones.all():
                if m.state == 'submitted':
                    review_items.append({
                        'application_id': app.id, 'job_id': app.job_id,
                        'job_title': app.job.title, 'milestone_title': m.title,
                        'applicant_name': app.user.username,
                        'amount_usd': str(m.amount_usd),
                    })
                elif m.state == 'released_demo':
                    total_released += m.amount_usd
                    entry['released_usd'] += m.amount_usd
        return Response({
            'jobs_by_status': jobs_by_status,
            'total_jobs': jobs.count(),
            'applicants_waiting': apps.filter(status='submitted').count(),
            'shortlisted': apps.filter(status='shortlisted').count(),
            'review_items': review_items,
            'total_released_usd': str(total_released),
            'total_agreed_usd': str(sum((a.proposed_rate_usd for a in apps.filter(status='accepted')), start=Decimal('0'))),
            'spent_by_job': [
                {**e, 'released_usd': str(e['released_usd']), 'agreed_usd': str(e['agreed_usd'])}
                for e in spent.values()
            ],
        })

class ClientExplore(APIView):
    """Freelancer directory for clients: public Passport summaries only,
    searchable by skill and filterable by proof level, location and training."""
    permission_classes = [IsClient]

    def get(self, request):
        from accounts.models import Profile
        from .serializers import PROOF_ORDER, passport_summary
        skill_q = (request.query_params.get('skill') or '').strip().casefold()
        location_q = (request.query_params.get('location') or '').strip().casefold()
        proof_min = (request.query_params.get('proof') or '').strip()
        training_only = request.query_params.get('training') in ('1', 'true')
        if proof_min and proof_min not in PROOF_ORDER:
            raise ValidationError({'proof': 'Unknown proof level.'})
        profiles = (Profile.objects.filter(role='freelancer')
                    .select_related('user')
                    .prefetch_related('user__skills__verifications', 'user__training_entries'))
        rows = []
        for profile in profiles[:200]:
            user = profile.user
            if location_q and location_q not in (profile.district or '').casefold():
                continue
            summary = passport_summary(user)
            if skill_q and not any(skill_q in s['name'].casefold() for s in summary['skills']):
                continue
            if proof_min:
                need = PROOF_ORDER.index(proof_min)
                if not any(PROOF_ORDER.index(s['proof']) >= need for s in summary['skills']):
                    continue
            if training_only and not summary['training']:
                continue
            rows.append({
                'user_id': user.id,
                'name': profile.display_name or user.username,
                'district': profile.district,
                'availability': profile.availability,
                'headline': profile.headline,
                **summary,
            })
        return Response(rows)


def _freelancer_or_404(user_id):
    from accounts.models import Profile
    profile = get_object_or_404(Profile, user_id=user_id, role='freelancer')
    return profile.user


class ClientShortlistView(APIView):
    permission_classes = [IsClient]

    def get(self, request):
        ids = list(ClientShortlist.objects.filter(client=request.user).values_list('freelancer_id', flat=True))
        return Response({'freelancer_ids': ids})

    def post(self, request):
        freelancer = _freelancer_or_404(request.data.get('freelancer_id'))
        ClientShortlist.objects.get_or_create(client=request.user, freelancer=freelancer)
        return Response({'freelancer_ids': list(ClientShortlist.objects.filter(client=request.user).values_list('freelancer_id', flat=True))}, status=201)


class ClientShortlistRemove(APIView):
    permission_classes = [IsClient]

    def delete(self, request, freelancer_id):
        ClientShortlist.objects.filter(client=request.user, freelancer_id=freelancer_id).delete()
        return Response(status=204)


class ClientInviteView(APIView):
    permission_classes = [IsClient]

    def post(self, request):
        freelancer = _freelancer_or_404(request.data.get('freelancer_id'))
        job = get_object_or_404(Job, pk=request.data.get('job_id'), owner=request.user)
        if job.status != 'published':
            raise ValidationError({'job_id': 'You can only invite freelancers to a published job.'})
        invite, created = ClientInvite.objects.get_or_create(client=request.user, freelancer=freelancer, job=job)
        if created:
            from workflows.models import InboxNotification
            InboxNotification.objects.create(owner=freelancer, kind='invite',
                message=f"A client invited you to apply for '{job.title}'. Open FirstWork to see the job.")
        return Response({'invited': True, 'already_invited': not created}, status=201 if created else 200)
