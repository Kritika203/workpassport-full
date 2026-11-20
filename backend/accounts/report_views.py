"""Submit and read safety reports on the current account."""
from rest_framework import serializers, generics, permissions
from rest_framework.throttling import UserRateThrottle
from .models import SafetyReport


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = SafetyReport
        fields = ['id', 'kind', 'job_reference', 'reason', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']


class ReportRateThrottle(UserRateThrottle):
    scope = 'safety_report'


class MySafetyReports(generics.ListCreateAPIView):
    serializer_class = ReportSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ReportRateThrottle]

    def get_queryset(self):
        return SafetyReport.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
