"""APIs for WorkPassport features beyond jobs and profiles."""
from collections import Counter
from django.db import transaction
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import UserRateThrottle
from accounts.models import Profile, Skill
from opportunities.models import Application, Job
from .models import (ApplicationMessage, ClientContact, EvidenceRecord, InboxNotification, Milestone, MilestoneFile,
                     SafetyCheck, SafetyCheckIn, SubmittedOpportunity, UserSafetyPreferences, Workroom)
from .serializers import (CheckInSerializer, CheckSerializer, ContributionSerializer, EvidenceSerializer,
                          MessageSerializer, MilestoneSerializer, NotificationSerializer,
                          PreferencesSerializer, WorkroomSerializer)
from .services import analyze


class ShieldRate(UserRateThrottle):
    scope = 'shield_checks'


class CheckText(APIView):
    throttle_classes = [ShieldRate]
    def post(self, request):
        text = request.data.get('text', '')
        if not isinstance(text, str) or not text.strip() or len(text) > 10000:
            raise ValidationError({'text': 'Provide 1 to 10,000 characters.'})
        result = analyze(text, bool(request.data.get('structural', True)))
        # Checking is private. Save the text excerpt only when the user chooses Save.
        if request.data.get('save') is True:
            SafetyCheck.objects.create(owner=request.user, text_excerpt=text.strip()[:240],
                                       risk=result['verdict'], flags=result['findings'])
        return Response(result)


class MyChecks(generics.ListAPIView):
    serializer_class = CheckSerializer

    def get_queryset(self):
        return SafetyCheck.objects.filter(owner=self.request.user)

    def delete(self, request):
        # Clear only this account's saved WorkShield checks.
        self.get_queryset().delete()
        return Response(status=204)


class EvidenceList(generics.ListCreateAPIView):
    serializer_class = EvidenceSerializer
    def get_queryset(self):
        return EvidenceRecord.objects.filter(owner=self.request.user)
    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class EvidenceItem(generics.RetrieveDestroyAPIView):
    serializer_class = EvidenceSerializer
    def get_queryset(self):
        return EvidenceRecord.objects.filter(owner=self.request.user)


class MyContributions(generics.ListCreateAPIView):
    serializer_class = ContributionSerializer
    def get_queryset(self):
        return SubmittedOpportunity.objects.filter(owner=self.request.user)
    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class ReviewQueue(generics.ListAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = ContributionSerializer
    def get_queryset(self):
        return SubmittedOpportunity.objects.filter(status='pending')


class ReviewSubmission(APIView):
    permission_classes = [permissions.IsAdminUser]

    @transaction.atomic
    def post(self, request, pk):
        submission = get_object_or_404(SubmittedOpportunity.objects.select_for_update(), pk=pk)
        if submission.status != 'pending':
            raise ValidationError({'detail': 'Already reviewed.'})
        decision = request.data.get('decision')
        if decision not in ('approve', 'reject'):
            raise ValidationError({'decision': 'Choose approve or reject.'})
        submission.status = 'approved' if decision == 'approve' else 'rejected'
        submission.reviewed_by = request.user
        submission.reviewed_at = timezone.now()
        if decision == 'approve' and submission.kind == 'opportunity':
            p = submission.payload
            title = str(p.get('title', '')).strip()[:180]
            description = str(p.get('description', '')).strip()
            if not title or not description:
                raise ValidationError({'detail': 'Missing title/description.'})
            try:
                budget = float(p.get('budgetMax') or p.get('budget_usd') or 0)
            except (TypeError, ValueError):
                raise ValidationError({'payload': 'Invalid budget.'})
            if not 0 < budget <= 10000000:
                raise ValidationError({'payload': 'Budget must be positive.'})
            skills = p.get('skillsRequired') or []
            if not isinstance(skills, list) or len(skills) > 15 or any(not isinstance(s, str) or len(s) > 100 for s in skills):
                raise ValidationError({'payload': 'Invalid skills.'})
            # An external job must point to a real http(s) listing, not an executable link.
            from urllib.parse import urlsplit
            from django.core.validators import URLValidator
            from django.core.exceptions import ValidationError as DjangoValidationError
            source_url = str(p.get('sourceURL') or p.get('url') or '').strip()
            parsed = urlsplit(source_url)
            if (len(source_url) > 1000 or parsed.scheme not in ('http', 'https') or
                    not parsed.hostname or parsed.username or parsed.password):
                raise ValidationError({'payload': 'Include the original http or https job link.'})
            try:
                URLValidator(schemes=['http', 'https'])(source_url)
            except DjangoValidationError:
                raise ValidationError({'payload': 'Include a valid job listing URL.'})
            submission.published_job = Job.objects.create(
                owner=None, title=title, description=description[:10000],
                category=str(p.get('category', 'Other'))[:80],
                client_name=str(p.get('organisation', 'Organisation'))[:140],
                client_country=str(p.get('country', ''))[:100], required_skills=skills,
                budget_usd=budget, budget_type='fixed',
                beginner_friendly=bool(p.get('beginnerFriendly', False)),
                external_url=source_url,
                status='published', payment_verified=False,
            )
        submission.save()
        from .models import StaffAuditLog
        StaffAuditLog.objects.create(actor=request.user, action=f'contribution:{submission.status}',
                                     target_model='SubmittedOpportunity', target_id=submission.pk)
        return Response(ContributionSerializer(submission).data)


class ApprovedInsights(generics.ListAPIView):
    serializer_class = ContributionSerializer
    def get_queryset(self):
        return SubmittedOpportunity.objects.filter(kind='insight', status='approved')


def application_for_user(request, pk):
    app = get_object_or_404(Application.objects.select_related('job'), pk=pk)
    if request.user.id not in (app.user_id, app.job.owner_id) and not request.user.is_staff:
        raise PermissionDenied('You are not part of this application.')
    return app


class Conversation(APIView):
    def get(self, request, pk):
        app = application_for_user(request, pk)
        contact, _ = ClientContact.objects.get_or_create(application=app)
        messages = app.messages.select_related('sender')
        return Response({'application_id': app.id, 'freelancer_id': app.user_id,
                         'client_id': app.job.owner_id, 'is_demo': app.job.is_demo, 'muted': contact.muted, 'blocked': contact.blocked,
                         'messages': MessageSerializer(messages, many=True).data})

    @transaction.atomic
    def post(self, request, pk):
        app = application_for_user(request, pk)
        contact, _ = ClientContact.objects.select_for_update().get_or_create(application=app)
        if contact.blocked:
            raise PermissionDenied('This conversation is blocked.')
        if contact.muted and request.user.id == app.job.owner_id:
            raise PermissionDenied('The freelancer has muted this client.')
        serializer = MessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = serializer.save(application=app, sender=request.user)
        other = app.job.owner if request.user.id == app.user_id else app.user
        if app.job.is_demo and request.user.id == app.user_id and not contact.muted:
            if not app.messages.exclude(sender=request.user).exists():
                ApplicationMessage.objects.create(
                    application=app, sender=app.job.owner,
                    text='Practice reply: Thank you for applying. Please review the sample agreement and milestones. No real client is involved.',
                )
        elif not app.job.is_demo:
            InboxNotification.objects.create(owner=other, kind='message', message='You have a new WorkPassport message.')
        return Response(MessageSerializer(message).data, status=201)


class ConversationControls(APIView):
    def patch(self, request, pk):
        app = application_for_user(request, pk)
        if request.user.id != app.user_id:
            raise PermissionDenied('Only the freelancer can change client contact settings.')
        if set(request.data.keys()) - {'muted', 'blocked'}:
            raise ValidationError({'detail': 'Only mute and block settings may be changed.'})
        settings, _ = ClientContact.objects.get_or_create(application=app)
        for name in ('muted', 'blocked'):
            if name in request.data:
                if not isinstance(request.data[name], bool):
                    raise ValidationError({name: 'Must be true or false.'})
                setattr(settings, name, request.data[name])
        settings.save()
        return Response({'muted': settings.muted, 'blocked': settings.blocked})


class WorkroomDetail(APIView):
    def get(self, request, pk):
        app = application_for_user(request, pk)
        if app.status != 'accepted':
            raise ValidationError({'detail': 'A workroom is available after a client accepts an application.'})
        room, _ = Workroom.objects.get_or_create(application=app, defaults={'scope': app.job.description[:2000]})
        if app.job.is_demo and not room.milestones.exists():
            Milestone.objects.create(workroom=room, title='Practice delivery',
                                     amount_usd=app.proposed_rate_usd, position=0)
        return Response(WorkroomSerializer(room).data)

    def patch(self, request, pk):
        app = application_for_user(request, pk)
        if app.status != 'accepted' or request.user.id != app.job.owner_id:
            raise PermissionDenied('Only the client can update an accepted agreement.')
        if set(request.data.keys()) != {'scope'} or not isinstance(request.data['scope'], str) or len(request.data['scope']) > 5000:
            raise ValidationError({'scope': 'Provide an agreement of up to 5,000 characters.'})
        room, _ = Workroom.objects.get_or_create(application=app, defaults={'scope': app.job.description[:2000]})
        room.scope = request.data['scope'].strip()
        room.save(update_fields=['scope'])
        return Response(WorkroomSerializer(room).data)


class Milestones(APIView):
    def post(self, request, pk):
        app = application_for_user(request, pk)
        if app.status != 'accepted' or request.user.id != app.job.owner_id:
            raise PermissionDenied('Only the owning client can add milestones after acceptance.')
        room, _ = Workroom.objects.get_or_create(application=app, defaults={'scope': app.job.description[:2000]})
        serializer = MilestoneSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if room.milestones.count() >= 15:
            raise ValidationError({'detail': 'Maximum 15 milestones per workroom.'})
        milestones = list(room.milestones.all())
        if milestones and all(m.state == 'released_demo' and m.has_delivery for m in milestones) and sum(
            (m.amount_usd for m in milestones), start=0) == app.proposed_rate_usd:
            raise ValidationError({'detail': 'This workroom is already complete.'})
        total = sum((m.amount_usd for m in room.milestones.all()), start=0)
        if total + serializer.validated_data['amount_usd'] > app.proposed_rate_usd:
            raise ValidationError({'amount_usd': 'Total milestones cannot exceed the agreed proposed rate.'})
        milestone = serializer.save(workroom=room)
        return Response(MilestoneSerializer(milestone).data, status=201)


def milestone_for_application(app, milestone_id, lock=False):
    qs = Milestone.objects.select_for_update() if lock else Milestone.objects.all()
    return get_object_or_404(qs, pk=milestone_id, workroom__application=app)


def assert_delivery_editable(request, app, milestone):
    if request.user.id != app.user_id or app.status != 'accepted':
        raise PermissionDenied('Only the accepted freelancer can submit work.')
    if milestone.state not in ('funded_demo', 'revision_requested'):
        raise ValidationError({'detail': 'Work can only be edited before submission or during requested revisions.'})


class MilestoneDelivery(APIView):
    # Save editable work content before submitting. Do not embed file data in this API.
    @transaction.atomic
    def post(self, request, pk, milestone_id):
        app = application_for_user(request, pk)
        milestone = milestone_for_application(app, milestone_id, lock=True)
        assert_delivery_editable(request, app, milestone)
        if set(request.data) != {'description', 'links'}:
            raise ValidationError({'detail': 'Provide description and links only.'})
        note = request.data['description']
        links = request.data['links']
        if not isinstance(note, str) or len(note.strip()) > 5000:
            raise ValidationError({'description': 'Description must be 5,000 characters or fewer.'})
        if not isinstance(links, list) or len(links) > 5 or any(not isinstance(x, str) or len(x) > 1000 for x in links):
            raise ValidationError({'links': 'Provide up to 5 valid project URLs.'})
        validated = []
        for item in links:
            url = item.strip()
            if not url or not url.lower().startswith(('https://', 'http://')):
                raise ValidationError({'links': 'Use http:// or https:// project links.'})
            try:
                URLValidator(schemes=['http', 'https'])(url)
            except DjangoValidationError:
                raise ValidationError({'links': 'Invalid project link.'})
            validated.append(url)
        milestone.delivery_note = note.strip()
        milestone.delivery_links = validated
        milestone.delivery_updated_at = timezone.now()
        milestone.save(update_fields=['delivery_note', 'delivery_links', 'delivery_updated_at'])
        return Response(MilestoneSerializer(milestone).data)


class MilestoneFiles(APIView):
    # JSON base64 upload keeps compatibility with the existing authenticated fetch client.
    # Re-encode images to strip embedded metadata. PDFs are always served as downloads.
    @transaction.atomic
    def post(self, request, pk, milestone_id):
        import base64
        import binascii
        import io
        import uuid
        from PIL import Image, ImageOps, UnidentifiedImageError
        from django.core.files.base import ContentFile
        app = application_for_user(request, pk)
        milestone = milestone_for_application(app, milestone_id, lock=True)
        assert_delivery_editable(request, app, milestone)
        if milestone.files.count() >= 3:
            raise ValidationError({'file': 'Maximum 3 attachments per milestone.'})
        name = request.data.get('name')
        encoded = request.data.get('data')
        if not isinstance(name, str) or not isinstance(encoded, str):
            raise ValidationError({'file': 'Provide an attachment name and data.'})
        if len(encoded) > 3_100_000 or ';base64,' not in encoded:
            raise ValidationError({'file': 'Maximum attachment size is 2 MB.'})
        header, payload = encoded.split(',', 1)
        header = header.lower()
        formats = {'data:image/jpeg;base64': 'jpg', 'data:image/png;base64': 'png',
                   'data:application/pdf;base64': 'pdf'}
        kind = formats.get(header)
        if kind is None:
            raise ValidationError({'file': 'Only JPEG, PNG, and PDF are supported.'})
        try:
            raw = base64.b64decode(payload, validate=True)
        except (ValueError, binascii.Error):
            raise ValidationError({'file': 'Invalid attachment encoding.'})
        if not raw or len(raw) > 2_000_000:
            raise ValidationError({'file': 'Maximum attachment size is 2 MB.'})
        # Spec layer: when the job defines deliverable specs for this
        # milestone, the upload must match one of them (format and size).
        # The 2 MB transport cap above still applies on top.
        specs = [d for d in (app.job.deliverables or [])
                 if isinstance(d, dict) and isinstance(d.get('name'), str)
                 and (d.get('milestone') in (None, 0) or d.get('milestone') == milestone.position + 1)]
        if specs:
            uploadable = {'jpg': 'jpg', 'png': 'png', 'pdf': 'pdf'}
            matching = [d for d in specs if uploadable.get(kind) in (d.get('formats') or [])]
            if not matching:
                allowed = sorted({f.upper() for d in specs for f in (d.get('formats') or [])})
                raise ValidationError({'file': 'This milestone asks for: ' + ', '.join(allowed) +
                                               '. Other formats can be shared as project links if the spec allows links.'})
            cap_bytes = int(max(float(d.get("max_mb") or 0) for d in matching) * 1_000_000)
            if len(raw) > cap_bytes:
                raise ValidationError({'file': 'This file is larger than the size the client specified for this deliverable.'})
        if kind == 'pdf':
            if not raw.startswith(b'%PDF-'):
                raise ValidationError({'file': 'Invalid PDF content.'})
            final = raw
        else:
            try:
                with Image.open(io.BytesIO(raw)) as image:
                    if image.width * image.height > 12_000_000:
                        raise ValidationError({'file': 'Image resolution is too large.'})
                    expected = 'JPEG' if kind == 'jpg' else 'PNG'
                    if image.format != expected:
                        raise ValidationError({'file': 'File content does not match its image type.'})
                    image = ImageOps.exif_transpose(image)
                    if kind == 'jpg': image = image.convert('RGB')
                    out = io.BytesIO()
                    image.save(out, format=expected, optimize=True)
                    final = out.getvalue()
            except (OSError, ValueError, UnidentifiedImageError):
                raise ValidationError({'file': 'Cannot read the image.'})
            if len(final) > 2_000_000:
                raise ValidationError({'file': 'Processed image exceeds 2 MB.'})
        safe_name = name.replace('\\', '/').split('/')[-1].strip()[:120]
        if not safe_name or any(ord(c) < 32 for c in safe_name):
            raise ValidationError({'name': 'Invalid file name.'})
        record = MilestoneFile(milestone=milestone, original_name=safe_name, kind=kind)
        record.file.save(f'{uuid.uuid4().hex}.{kind}', ContentFile(final), save=False)
        record.save()
        milestone.delivery_updated_at = timezone.now()
        milestone.save(update_fields=['delivery_updated_at'])
        from .serializers import MilestoneFileSerializer
        return Response(MilestoneFileSerializer(record).data, status=201)


class MilestoneFileDetail(APIView):
    def get(self, request, pk, milestone_id, file_id):
        import base64
        app = application_for_user(request, pk)
        record = get_object_or_404(MilestoneFile, pk=file_id, milestone_id=milestone_id,
                                   milestone__workroom__application=app)
        mime = {'jpg': 'image/jpeg', 'png': 'image/png', 'pdf': 'application/pdf'}[record.kind]
        with record.file.open('rb') as stored:
            data = base64.b64encode(stored.read(2_000_001)).decode('ascii')
        if len(data) > 2_800_000:
            raise ValidationError({'file': 'File is too large.'})
        response = Response({'name': record.original_name, 'mime_type': mime, 'base64': data})
        response['Cache-Control'] = 'no-store'
        return response

    @transaction.atomic
    def delete(self, request, pk, milestone_id, file_id):
        app = application_for_user(request, pk)
        milestone = milestone_for_application(app, milestone_id, lock=True)
        assert_delivery_editable(request, app, milestone)
        record = get_object_or_404(MilestoneFile, pk=file_id, milestone=milestone)
        stored_name = record.file.name
        storage = record.file.storage
        record.delete()
        # Remove file bytes only after the database transaction commits.
        transaction.on_commit(lambda: storage.delete(stored_name))
        milestone.delivery_updated_at = timezone.now()
        milestone.save(update_fields=['delivery_updated_at'])
        return Response(status=204)


class MilestoneState(APIView):
    @transaction.atomic
    def post(self, request, pk, milestone_id):
        app = application_for_user(request, pk)
        milestone = get_object_or_404(Milestone.objects.select_for_update(), pk=milestone_id, workroom__application=app)
        state = request.data.get('state')
        allowed = {'planned': {'funded_demo': app.job.owner_id},
                   'funded_demo': {'submitted': app.user_id},
                   'revision_requested': {'submitted': app.user_id},
                   'submitted': {'released_demo': app.job.owner_id,
                                 'revision_requested': app.job.owner_id}}
        owner_id = allowed.get(milestone.state, {}).get(state)
        if owner_id is None or request.user.id != owner_id:
            raise PermissionDenied('This milestone transition is not allowed for your account.')
        if state == 'submitted':
            if not milestone.has_delivery:
                raise ValidationError({'delivery': 'Add a work description, project link, or attachment before submitting.'})
            if milestone.state == 'revision_requested' and (not milestone.delivery_updated_at or
                milestone.reviewed_at and milestone.delivery_updated_at <= milestone.reviewed_at):
                raise ValidationError({'delivery': 'Update your submission before resubmitting.'})
            milestone.submitted_at = timezone.now()
            milestone.revision_note = ''
        if state in ('revision_requested', 'released_demo'):
            checks = request.data.get('checks')
            if checks is not None:
                if (not isinstance(checks, list) or len(checks) > 15
                        or any(not isinstance(c, str) or len(c) > 120 for c in checks)):
                    raise ValidationError({'checks': 'Provide the ticked spec names (up to 15).'})
                milestone.review_checks = checks
        if state == 'revision_requested':
            note = request.data.get('note', '')
            if not isinstance(note, str) or len(note.strip()) > 1000:
                raise ValidationError({'note': 'Tell the freelancer what to revise (up to 1,000 characters).'})
            note = note.strip()
            # Unticked spec items become the revision request, ahead of the
            # client's own words, so the freelancer sees exactly what to fix.
            checks = request.data.get('checks')
            if isinstance(checks, list):
                specs = [d for d in (app.job.deliverables or [])
                         if isinstance(d, dict) and isinstance(d.get('name'), str)
                         and (d.get('milestone') in (None, 0) or d.get('milestone') == milestone.position + 1)]
                unticked = [d['name'] for d in specs if d['name'] not in checks]
                if unticked:
                    prefix = 'Missing or incomplete: ' + ', '.join(unticked) + '. '
                    note = (prefix + note)[:1000].strip()
            if len(note) < 5:
                raise ValidationError({'note': 'Tell the freelancer what to revise (5 to 1,000 characters), or untick a spec item.'})
            milestone.revision_note = note
            milestone.reviewed_at = timezone.now()
        if state == 'released_demo':
            if not milestone.has_delivery:
                raise ValidationError({'delivery': 'Cannot approve a milestone without submitted work.'})
            milestone.reviewed_at = timezone.now()
        milestone.state = state
        milestone.save(update_fields=['state', 'submitted_at', 'revision_note', 'reviewed_at', 'review_checks'])
        other = app.job.owner if request.user.id == app.user_id else app.user
        InboxNotification.objects.create(owner=other, kind='milestone', message='A WorkPassport milestone was updated.')
        return Response(MilestoneSerializer(milestone).data)


class SkillGap(APIView):
    def get(self, request):
        owned = {s.name.casefold() for s in Skill.objects.filter(user=request.user)}
        jobs = Job.objects.filter(status='published').only('id', 'title', 'required_skills')[:300]
        data = []
        demand = Counter()
        for job in jobs:
            names = [s for s in job.required_skills if isinstance(s, str)][:15]
            for skill in names:
                demand[skill.casefold()] += 1
            missing = [name for name in names if name.casefold() not in owned]
            data.append({'job_id': job.id, 'job_title': job.title, 'matched': len(names) - len(missing),
                         'total': len(names), 'missing': missing})
        data.sort(key=lambda x: (-x['matched'], len(x['missing']), x['job_title']))
        return Response({'current_skills': sorted(owned), 'job_matches': data[:25],
                         'in_demand_skills': [{'skill': name, 'job_count': count} for name, count in demand.most_common(15)],
                         'source': 'Published WorkPassport jobs only, not the wider labour market.'})


class InstitutionSummary(APIView):
    def get(self, request):
        # Only job-level counts. No freelancer private data is exposed.
        jobs = Job.objects.filter(status='published')[:1000]
        skills = Counter(skill for job in jobs for skill in (job.required_skills or []) if isinstance(skill, str))
        return Response({'published_jobs': len(jobs), 'skills': [
            {'skill': name, 'jobs': count} for name, count in skills.most_common(20)],
            'note': 'Aggregated published listings only. This is not a verified national labour-market report.'})


class MyPreferences(generics.RetrieveUpdateAPIView):
    serializer_class = PreferencesSerializer
    def get_object(self):
        obj, _ = UserSafetyPreferences.objects.get_or_create(owner=self.request.user)
        return obj


class MyCheckIns(generics.ListCreateAPIView):
    serializer_class = CheckInSerializer
    def get_queryset(self):
        return SafetyCheckIn.objects.filter(owner=self.request.user)
    def perform_create(self, serializer):
        if serializer.validated_data['scheduled_for'] <= timezone.now():
            raise ValidationError({'scheduled_for': 'Choose a future check-in time.'})
        serializer.save(owner=self.request.user)


class AcknowledgeCheckIn(APIView):
    def post(self, request, pk):
        obj = get_object_or_404(SafetyCheckIn, pk=pk, owner=request.user)
        if not obj.acknowledged_at:
            obj.acknowledged_at = timezone.now()
            obj.save(update_fields=['acknowledged_at'])
        return Response(CheckInSerializer(obj).data)


class Inbox(generics.ListAPIView):
    serializer_class = NotificationSerializer
    def get_queryset(self):
        return InboxNotification.objects.filter(owner=self.request.user)


class MarkRead(APIView):
    def post(self, request, pk):
        obj = get_object_or_404(InboxNotification, pk=pk, owner=request.user)
        obj.is_read = True
        obj.save(update_fields=['is_read'])
        return Response(NotificationSerializer(obj).data)


class ReplaceEvidence(APIView):
    # The existing Evidence Vault edits a whole list; store each item as a private record.
    @transaction.atomic
    def post(self, request):
        items = request.data.get('items')
        if not isinstance(items, list) or len(items) > 20:
            raise ValidationError({'items': 'Provide at most 20 evidence records.'})
        records = []
        for item in reversed(items):
            if not isinstance(item, dict):
                raise ValidationError({'items': 'Each entry must be an object.'})
            data = {
                'text': item.get('text'),
                'categories': item.get('categories', []),
                'source': item.get('source', 'page'),
                'job_title': item.get('jobTitle', ''),
                'client_name': item.get('clientName', ''),
            }
            serializer = EvidenceSerializer(data=data)
            serializer.is_valid(raise_exception=True)
            records.append(EvidenceRecord(owner=request.user, **serializer.validated_data))
        EvidenceRecord.objects.filter(owner=request.user).delete()
        EvidenceRecord.objects.bulk_create(records)
        return Response({'count': len(records)})


class MyProofs(APIView):
    # Photo files are not available through public URLs.
    def get(self, request):
        import base64
        from .models import ProofAsset
        data = {}
        for asset in ProofAsset.objects.filter(owner=request.user):
            if asset.kind == 'photo' and asset.image_file:
                with asset.image_file.open('rb') as source:
                    photo = 'data:image/jpeg;base64,' + base64.b64encode(source.read()).decode('ascii')
            else:
                photo = asset.external_url
            data.setdefault(asset.skill_name, []).append({
                'id': asset.id, 'type': asset.kind, 'src': photo, 'note': asset.note,
            })
        return Response({'proofs': data})

    @transaction.atomic
    def post(self, request):
        import base64
        import binascii
        import uuid
        import io
        from PIL import Image, ImageOps, UnidentifiedImageError
        from django.core.files.base import ContentFile
        from .models import ProofAsset
        if getattr(getattr(request.user, 'profile', None), 'role', None) != 'freelancer':
            raise PermissionDenied('Only freelancers can upload work samples.')
        payload = request.data.get('proofs', {})
        if not isinstance(payload, dict) or len(payload) > 35:
            raise ValidationError({'proofs': 'Invalid skill evidence.'})
        records = []
        image_contents = []
        for name, items in payload.items():
            if not isinstance(name, str) or len(name) > 100 or not isinstance(items, list) or len(items) > 5:
                raise ValidationError({'proofs': 'Invalid skill or evidence list.'})
            for item in items:
                if not isinstance(item, dict) or item.get('type') not in ('photo', 'link'):
                    raise ValidationError({'proofs': 'Invalid evidence item.'})
                note = str(item.get('note', ''))[:140]
                src = item.get('src', '')
                if not isinstance(src, str):
                    raise ValidationError({'proofs': 'Invalid attachment.'})
                asset = ProofAsset(owner=request.user, skill_name=name, kind=item['type'], note=note)
                if item['type'] == 'link':
                    if not src.startswith(('https://', 'http://')) or len(src) > 1000:
                        raise ValidationError({'proofs': 'Only http/https portfolio links are allowed.'})
                    asset.external_url = src
                else:
                    if not src.startswith('data:image/jpeg;base64,') or len(src) > 1500000:
                        raise ValidationError({'proofs': 'Upload a JPEG image smaller than 1 MB.'})
                    try:
                        contents = base64.b64decode(src.split(',', 1)[1], validate=True)
                    except (ValueError, binascii.Error):
                        raise ValidationError({'proofs': 'Invalid image data.'})
                    if len(contents) > 1000000 or not contents.startswith(b'\xff\xd8\xff'):
                        raise ValidationError({'proofs': 'The file must be a JPEG smaller than 1 MB.'})
                    try:
                        Image.MAX_IMAGE_PIXELS = 12_000_000
                        with Image.open(io.BytesIO(contents)) as original:
                            if original.format != 'JPEG' or original.width * original.height > 12_000_000:
                                raise ValidationError({'proofs': 'Use a smaller JPEG image.'})
                            # Re-encoding strips location metadata and extra embedded content.
                            clean = ImageOps.exif_transpose(original).convert('RGB')
                            clean.thumbnail((1600, 1600))
                            output = io.BytesIO()
                            clean.save(output, format='JPEG', quality=82, optimize=True)
                            contents = output.getvalue()
                    except (OSError, ValueError, UnidentifiedImageError):
                        raise ValidationError({'proofs': 'The image could not be opened.'})
                    if len(contents) > 1000000:
                        raise ValidationError({'proofs': 'The image is still too large after processing.'})
                    image_contents.append((asset, f'{request.user.pk}-{uuid.uuid4().hex}.jpg', contents))
                records.append(asset)
        if len(records) > 50:
            raise ValidationError({'proofs': 'Too many attachments.'})
        existing = list(ProofAsset.objects.filter(owner=request.user))
        for asset, name, contents in image_contents:
            asset.image_file.save(name, ContentFile(contents), save=False)
        ProofAsset.objects.bulk_create(records)
        from accounts.models import SkillVerification
        # Work samples support a demonstrated badge, not an independent verification.
        changed_skills = set(name for name in payload)
        changed_skills.update(asset.skill_name for asset in existing)
        for name in changed_skills:
            skill = Skill.objects.filter(user=request.user, name__iexact=name).first()
            items = [asset for asset in records if asset.skill_name.casefold() == name.casefold()]
            if not skill and items:
                skill = Skill.objects.create(user=request.user, name=name)
            if not skill:
                continue
            existing_proof = SkillVerification.objects.filter(skill=skill, level='demonstrated').first()
            if items:
                if not existing_proof:
                    first = items[0]
                    SkillVerification.objects.create(skill=skill, level='demonstrated',
                        proof_asset=first, evidence_url=first.external_url)
                elif existing_proof.proof_asset_id in {asset.pk for asset in existing}:
                    first = items[0]
                    existing_proof.proof_asset = first
                    existing_proof.evidence_url = first.external_url
                    existing_proof.save(update_fields=['proof_asset', 'evidence_url'])
            elif existing_proof and existing_proof.proof_asset_id in {asset.pk for asset in existing}:
                existing_proof.delete()
        if existing:
            ProofAsset.objects.filter(pk__in=[x.pk for x in existing]).delete()
            def remove_old_files():
                for old in existing:
                    if old.image_file:
                        old.image_file.delete(save=False)
            transaction.on_commit(remove_old_files)
        return Response({'saved': len(records)})


class MyPassportShare(APIView):
    # A public passport shares only selected professional information.
    def post(self, request):
        import secrets
        from .models import PublicPassportLink
        if getattr(getattr(request.user, 'profile', None), 'role', None) != 'freelancer':
            raise PermissionDenied('Only freelancer accounts have shareable Passports.')
        link, _ = PublicPassportLink.objects.get_or_create(
            owner=request.user, defaults={'token': secrets.token_urlsafe(32), 'enabled': True})
        if not link.enabled:
            link.enabled = True
            link.save(update_fields=['enabled'])
        return Response({'token': link.token, 'enabled': True})

    def delete(self, request):
        from .models import PublicPassportLink
        PublicPassportLink.objects.filter(owner=request.user).update(enabled=False)
        return Response(status=204)


class PublicPassport(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ShieldRate]

    def get(self, request, token):
        from .models import PublicPassportLink, ProofAsset
        record = get_object_or_404(PublicPassportLink.objects.select_related('owner__profile'), token=token, enabled=True)
        owner = record.owner
        links = ProofAsset.objects.filter(owner=owner, kind='link')
        return Response({
            'display_name': owner.profile.display_name or owner.username,
            'bio': owner.profile.bio[:1000],
            'skills': list(Skill.objects.filter(user=owner).values_list('name', flat=True)),
            'samples': [{'skill': x.skill_name, 'url': x.external_url, 'note': x.note} for x in links[:30]],
            'notice': 'Work samples are self-submitted unless an institution independently verifies them.',
        })


class PracticeMilestoneStep(APIView):
    # This endpoint is only for fictional practice listings. No money is moved.
    @transaction.atomic
    def post(self, request, pk, milestone_id):
        app = application_for_user(request, pk)
        if not app.job.is_demo or request.user.id != app.user_id or app.status != 'accepted':
            raise PermissionDenied('Practice steps are only available for your own demo job.')
        milestone = get_object_or_404(Milestone.objects.select_for_update(),
                                      pk=milestone_id, workroom__application=app)
        next_states = {'planned': 'funded_demo', 'funded_demo': 'submitted', 'submitted': 'released_demo'}
        expected = next_states.get(milestone.state)
        if not expected or request.data.get('state') != expected:
            raise ValidationError({'state': 'That step is not available.'})
        if expected in ('submitted', 'released_demo') and not milestone.has_delivery:
            raise ValidationError({'delivery': 'Submit a description, project link, or attachment first.'})
        if expected == 'submitted':
            milestone.submitted_at = timezone.now()
        if expected == 'released_demo':
            milestone.reviewed_at = timezone.now()
        milestone.state = expected
        milestone.save(update_fields=['state', 'submitted_at', 'reviewed_at'])
        return Response(MilestoneSerializer(milestone).data)


class PassportCompletions(APIView):
    # Only finished workroom milestones count as completed work.
    def get(self, request):
        if getattr(getattr(request.user, 'profile', None), 'role', None) != 'freelancer':
            raise PermissionDenied('Only freelancers have completed-work records.')
        apps = Application.objects.filter(user=request.user, status='accepted').select_related('job').prefetch_related('workroom__milestones')
        results = []
        for app in apps:
            room = getattr(app, 'workroom', None)
            if not room:
                continue
            milestones = list(room.milestones.all())
            if (not milestones or any(m.state != 'released_demo' or not m.has_delivery for m in milestones)
                    or sum((m.amount_usd for m in milestones), start=0) != app.proposed_rate_usd):
                continue
            results.append({
                'job_id': app.job_id, 'application_id': app.id,
                'job_title': app.job.title, 'is_demo': app.job.is_demo,
                'amount_usd': str(sum((m.amount_usd for m in milestones), start=0)),
                'payment_status': 'simulated',
            })
        return Response({'results': results, 'count': len(results)})
