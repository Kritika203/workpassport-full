from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import LogoutView, MeView, RegisterView, SkillViewSet, WorkSampleViewSet, DemoSessionView, TrainingEntryViewSet, SkillVerificationViewSet, PassportProgress
from .workspace_views import WorkspaceStateView
from .cv_views import ImportCV
from .help_views import HelpChat
from .translation_views import TranslateText
from .passport_views import MyPassportDetails
from .security_views import (RequestPasswordReset, ConfirmPasswordReset, SignOutEverywhere,
                             RequestEmailVerification, ConfirmEmailVerification, MyData)
from .report_views import MySafetyReports

router = DefaultRouter()
router.register('skills', SkillViewSet, basename='skill')
router.register('work-samples', WorkSampleViewSet, basename='work-sample')
router.register('training', TrainingEntryViewSet, basename='training')
router.register('skill-verifications', SkillVerificationViewSet, basename='skill-verification')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('password-reset/request/', RequestPasswordReset.as_view()),
    path('password-reset/confirm/', ConfirmPasswordReset.as_view()),
    path('email-verification/request/', RequestEmailVerification.as_view()),
    path('email-verification/confirm/', ConfirmEmailVerification.as_view()),
    path('sign-out-everywhere/', SignOutEverywhere.as_view()),
    path('my-data/', MyData.as_view()),
    path('login/', TokenObtainPairView.as_view(), name='login'),
    path('refresh/', TokenRefreshView.as_view(), name='refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', MeView.as_view(), name='me'),
    path('passport/progress/', PassportProgress.as_view(), name='passport-progress'),
    path('passport/', MyPassportDetails.as_view(), name='passport-details'),
    path('passport/import-cv/', ImportCV.as_view(), name='passport-import-cv'),
    path('translate/', TranslateText.as_view(), name='text-translate'),
    path('help-chat/', HelpChat.as_view(), name='help-chat'),
    path('demo-session/', DemoSessionView.as_view(), name='demo-session'),
    path('workspace/', WorkspaceStateView.as_view(), name='workspace'),
    path('reports/', MySafetyReports.as_view(), name='reports'),
    path('me/', include(router.urls)),
]
