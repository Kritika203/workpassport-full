"""WorkPassport DirectPay: payment coordination for direct transfers.

WorkPassport never collects, holds or moves money. The employer pays the
freelancer directly through their own eSewa, Khalti or bank account; these
endpoints only exchange the receiving details, record what the employer
reports, and let the freelancer confirm or dispute receipt.
"""
import base64
import binascii
from decimal import Decimal, InvalidOperation

from django.core.files.base import ContentFile
from django.db import transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (InboxNotification, Milestone, PaymentDispute, PaymentEvent,
                     PaymentMethod, PaymentReceipt, PaymentRecord)


def _event(payment, actor, action, note=''):
    PaymentEvent.objects.create(payment=payment, actor=actor, action=action, note=note)


def _notify(user, kind, message):
    InboxNotification.objects.create(owner=user, kind=kind, message=message[:240])


def _decode_upload(data, label):
    """Validate a base64 data-URL upload exactly like milestone files:
    JPEG, PNG or PDF only, 2 MB maximum, header must match the content."""
    if data is None:
        return None
    if not isinstance(data, dict):
        raise ValidationError({label: 'Invalid file.'})
    name = data.get('name')
    encoded = data.get('data')
    if not isinstance(name, str) or not isinstance(encoded, str) or ';base64,' not in encoded:
        raise ValidationError({label: 'Provide a file name and data.'})
    if len(encoded) > 3_100_000:
        raise ValidationError({label: 'Maximum file size is 2 MB.'})
    header, payload = encoded.split(',', 1)
    kind = {'data:image/jpeg;base64': 'jpg', 'data:image/png;base64': 'png',
            'data:application/pdf;base64': 'pdf'}.get(header.lower())
    if kind is None:
        raise ValidationError({label: 'Only JPEG, PNG, and PDF are supported.'})
    try:
        raw = base64.b64decode(payload, validate=True)
    except (ValueError, binascii.Error):
        raise ValidationError({label: 'Invalid file encoding.'})
    if not raw or len(raw) > 2_000_000:
        raise ValidationError({label: 'Maximum file size is 2 MB.'})
    signatures = {'jpg': b'\xff\xd8\xff', 'png': b'\x89PNG', 'pdf': b'%PDF-'}
    if not raw.startswith(signatures[kind]):
        raise ValidationError({label: 'File content does not match its type.'})
    return {'name': name[:120], 'kind': kind, 'raw': raw}


class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ['id', 'kind', 'holder_name', 'mobile', 'bank_name',
                  'account_number', 'branch', 'is_preferred', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate(self, attrs):
        kind = attrs.get('kind', getattr(self.instance, 'kind', None))
        holder = (attrs.get('holder_name') or getattr(self.instance, 'holder_name', '') or '').strip()
        if not holder:
            raise ValidationError({'holder_name': 'Account holder name is required.'})
        if kind in ('esewa', 'khalti'):
            mobile = (attrs.get('mobile') or getattr(self.instance, 'mobile', '') or '').strip()
            digits = mobile.replace(' ', '').replace('-', '')
            if not (digits.isdigit() and 10 <= len(digits) <= 15):
                raise ValidationError({'mobile': 'Enter the registered mobile number (digits only).'})
        elif kind == 'bank':
            if not (attrs.get('bank_name') or getattr(self.instance, 'bank_name', '') or '').strip():
                raise ValidationError({'bank_name': 'Bank name is required.'})
            if not (attrs.get('account_number') or getattr(self.instance, 'account_number', '') or '').strip():
                raise ValidationError({'account_number': 'Account number is required.'})
        return attrs


class PaymentEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.username', read_only=True)

    class Meta:
        model = PaymentEvent
        fields = ['id', 'action', 'note', 'actor_name', 'created_at']


class PaymentDisputeSerializer(serializers.ModelSerializer):
    has_evidence = serializers.SerializerMethodField()

    class Meta:
        model = PaymentDispute
        fields = ['id', 'reason', 'note', 'has_evidence', 'created_at']

    def get_has_evidence(self, obj):
        return bool(obj.evidence_file)


class PaymentRecordSerializer(serializers.ModelSerializer):
    job_title = serializers.CharField(source='workroom.application.job.title', read_only=True)
    milestone_title = serializers.CharField(source='milestone.title', read_only=True)
    milestone_id = serializers.IntegerField(read_only=True)
    workroom_id = serializers.IntegerField(read_only=True)
    employer_name = serializers.CharField(source='employer.username', read_only=True)
    freelancer_name = serializers.CharField(source='freelancer.username', read_only=True)
    has_receipt = serializers.SerializerMethodField()
    viewer_role = serializers.SerializerMethodField()
    events = PaymentEventSerializer(many=True, read_only=True)
    disputes = PaymentDisputeSerializer(many=True, read_only=True)

    class Meta:
        model = PaymentRecord
        fields = ['id', 'milestone_id', 'workroom_id', 'job_title', 'milestone_title',
                  'employer_name', 'freelancer_name', 'method_snapshot', 'attempt',
                  'agreed_amount_usd', 'reported_amount_usd', 'currency', 'status',
                  'transaction_ref', 'paid_date', 'has_receipt', 'viewer_role', 'events', 'disputes',
                  'created_at', 'updated_at']

    def get_has_receipt(self, obj):
        return hasattr(obj, 'receipt')

    def get_viewer_role(self, obj):
        request = self.context.get('request')
        if request is None or not request.user.is_authenticated:
            return None
        if obj.employer_id == request.user.id:
            return 'employer'
        if obj.freelancer_id == request.user.id:
            return 'freelancer'
        return None


class PaymentMethodsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = PaymentMethod.objects.filter(owner=request.user)
        return Response(PaymentMethodSerializer(rows, many=True).data)

    @transaction.atomic
    def post(self, request):
        serializer = PaymentMethodSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        method = serializer.save(owner=request.user)
        if method.is_preferred:
            PaymentMethod.objects.filter(owner=request.user).exclude(pk=method.pk).update(is_preferred=False)
        return Response(PaymentMethodSerializer(method).data, status=201)


class PaymentMethodDetail(APIView):
    permission_classes = [IsAuthenticated]

    def _own(self, request, pk):
        return get_object_or_404(PaymentMethod, pk=pk, owner=request.user)

    @transaction.atomic
    def patch(self, request, pk):
        method = self._own(request, pk)
        serializer = PaymentMethodSerializer(method, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        method = serializer.save()
        if method.is_preferred:
            PaymentMethod.objects.filter(owner=request.user).exclude(pk=method.pk).update(is_preferred=False)
        return Response(PaymentMethodSerializer(method).data)

    def delete(self, request, pk):
        method = self._own(request, pk)
        method.delete()
        return Response(status=204)


class PaymentStart(APIView):
    """Employer starts a payment for an approved (released) milestone."""
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        milestone = get_object_or_404(
            Milestone.objects.select_related('workroom__application__job', 'workroom__application__user'),
            pk=request.data.get('milestone_id'))
        application = milestone.workroom.application
        if application.job.owner_id != request.user.id:
            raise ValidationError({'milestone_id': 'Only the employer for this job can start a payment.'})
        if milestone.state != 'released_demo':
            raise ValidationError({'milestone_id': 'Approve the deliverable first. Payment starts after approval.'})
        freelancer = application.user
        method = (PaymentMethod.objects.filter(owner=freelancer, is_preferred=True).first()
                  or PaymentMethod.objects.filter(owner=freelancer).first())
        if method is None:
            raise ValidationError({'milestone_id': 'The freelancer has not added a payment method yet.'})
        active = (PaymentRecord.objects.select_for_update()
                  .filter(milestone=milestone, status__in=PaymentRecord.ACTIVE))
        if active.exists():
            raise ValidationError({'milestone_id': 'An active payment already exists for this milestone.'})
        attempt = milestone.payments.count() + 1
        record = PaymentRecord.objects.create(
            milestone=milestone, workroom=milestone.workroom, employer=request.user,
            freelancer=freelancer, method=method, method_snapshot=method.snapshot(),
            attempt=attempt, agreed_amount_usd=milestone.amount_usd)
        _event(record, request.user, 'created')
        return Response(PaymentRecordSerializer(record).data, status=201)


def _participant_record(request, pk):
    record = get_object_or_404(
        PaymentRecord.objects.select_related('workroom__application__job', 'milestone'),
        pk=pk)
    if request.user.id not in (record.employer_id, record.freelancer_id):
        raise ValidationError({'detail': 'You are not part of this payment.'})
    return record


class PaymentSent(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        record = _participant_record(request, pk)
        if record.employer_id != request.user.id:
            raise ValidationError({'detail': 'Only the employer can record a payment.'})
        if record.status != 'awaiting_payment':
            raise ValidationError({'detail': 'This payment is not waiting to be recorded.'})
        try:
            amount = Decimal(str(request.data.get('amount')))
        except (InvalidOperation, TypeError):
            raise ValidationError({'amount': 'Enter the amount you paid.'})
        if amount <= 0:
            raise ValidationError({'amount': 'Enter the amount you paid.'})
        ref = str(request.data.get('transaction_ref') or '').strip()
        if len(ref) < 4:
            raise ValidationError({'transaction_ref': 'Enter the transaction reference from your provider.'})
        paid_date_raw = str(request.data.get('paid_date') or '')
        try:
            paid_date = timezone.datetime.fromisoformat(paid_date_raw).date()
        except ValueError:
            raise ValidationError({'paid_date': 'Enter the payment date.'})
        if paid_date > timezone.localdate():
            raise ValidationError({'paid_date': 'The payment date cannot be in the future.'})
        receipt = _decode_upload(request.data.get('receipt'), 'receipt')
        record.reported_amount_usd = amount
        record.transaction_ref = ref[:120]
        record.paid_date = paid_date
        record.status = 'sent'
        record.save()
        if receipt:
            PaymentReceipt.objects.create(
                payment=record, original_name=receipt['name'], kind=receipt['kind'],
                file=ContentFile(receipt['raw'], name=receipt['name']))
        _event(record, request.user, 'sent', note=f"Reference {record.transaction_ref}")
        _notify(record.freelancer, 'payment_sent',
                f"{request.user.username} recorded a payment of ${amount} for "
                f"'{record.workroom.application.job.title}'. Confirm only after checking your own account.")
        return Response(PaymentRecordSerializer(record).data)


class PaymentConfirm(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        record = _participant_record(request, pk)
        if record.freelancer_id != request.user.id:
            raise ValidationError({'detail': 'Only the freelancer can confirm receipt.'})
        if record.status != 'sent':
            raise ValidationError({'detail': 'There is no recorded payment to confirm.'})
        record.status = 'confirmed'
        record.save()
        _event(record, request.user, 'confirmed')
        _notify(record.employer, 'payment_confirmed',
                f"{request.user.username} confirmed receiving your payment for "
                f"'{record.workroom.application.job.title}'.")
        return Response(PaymentRecordSerializer(record).data)


class PaymentDisputeView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        record = _participant_record(request, pk)
        if record.freelancer_id != request.user.id:
            raise ValidationError({'detail': 'Only the freelancer can report a payment problem.'})
        if record.status != 'sent':
            raise ValidationError({'detail': 'Only a recorded payment can be disputed.'})
        reason = str(request.data.get('reason') or '')
        if reason not in dict(PaymentDispute.REASONS):
            raise ValidationError({'reason': 'Choose the type of problem.'})
        note = str(request.data.get('note') or '').strip()
        if len(note) < 5:
            raise ValidationError({'note': 'Explain the problem in a few words.'})
        evidence = _decode_upload(request.data.get('evidence'), 'evidence')
        dispute = PaymentDispute(payment=record, reporter=request.user, reason=reason, note=note[:2000])
        if evidence:
            dispute.evidence_name = evidence['name']
            dispute.evidence_kind = evidence['kind']
            dispute.evidence_file = ContentFile(evidence['raw'], name=evidence['name'])
        dispute.save()
        record.status = 'disputed'
        record.save()
        _event(record, request.user, 'disputed', note=note[:200])
        _notify(record.employer, 'payment_disputed',
                f"{request.user.username} reported a problem with your payment for "
                f"'{record.workroom.application.job.title}'. Open the Workroom to respond.")
        return Response(PaymentRecordSerializer(record).data)


class PaymentCancel(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        record = _participant_record(request, pk)
        if record.employer_id != request.user.id:
            raise ValidationError({'detail': 'Only the employer can cancel this payment.'})
        if record.status != 'awaiting_payment':
            raise ValidationError({'detail': 'Only a payment that has not been recorded can be cancelled.'})
        record.status = 'cancelled'
        record.save()
        _event(record, request.user, 'cancelled')
        return Response(PaymentRecordSerializer(record).data)


class PaymentList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Q
        rows = (PaymentRecord.objects
                .filter(Q(employer=request.user) | Q(freelancer=request.user))
                .select_related('milestone', 'workroom__application__job', 'employer', 'freelancer')
                .prefetch_related('events', 'disputes'))
        role = request.query_params.get('role')
        if role == 'employer':
            rows = rows.filter(employer=request.user)
        elif role == 'freelancer':
            rows = rows.filter(freelancer=request.user)
        return Response(PaymentRecordSerializer(rows, many=True, context={'request': request}).data)


class PaymentReceiptDownload(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        record = _participant_record(request, pk)
        receipt = getattr(record, 'receipt', None)
        if receipt is None:
            raise ValidationError({'detail': 'No receipt was uploaded for this payment.'})
        return FileResponse(receipt.file.open('rb'), as_attachment=True,
                            filename=receipt.original_name)


class PaymentEvidenceDownload(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        record = _participant_record(request, pk)
        dispute = record.disputes.filter(evidence_file__gt='').first()
        if dispute is None:
            raise ValidationError({'detail': 'No evidence was uploaded for this dispute.'})
        return FileResponse(dispute.evidence_file.open('rb'), as_attachment=True,
                            filename=dispute.evidence_name or 'evidence')
