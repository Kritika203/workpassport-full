from rest_framework.permissions import BasePermission
from .models import Profile


def user_role(user):
    if not user or not user.is_authenticated:
        return None
    profile = Profile.objects.filter(user_id=user.pk).only('role').first()
    return profile.role if profile else None


class IsFreelancer(BasePermission):
    def has_permission(self, request, view):
        return user_role(request.user) == Profile.FREELANCER


class IsClient(BasePermission):
    def has_permission(self, request, view):
        return user_role(request.user) == Profile.CLIENT
