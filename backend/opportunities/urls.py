from django.urls import path
from . import views

urlpatterns = [
    path('jobs/', views.PublicJobs.as_view(), name='jobs'),
    path('jobs/proposal-draft/', views.ProposalDraftView.as_view(), name='proposal-draft'),
    path('jobs/<int:pk>/', views.PublicJobDetail.as_view(), name='job-detail'),
    path('jobs/<int:pk>/save/', views.SaveJob.as_view(), name='save-job'),
    path('jobs/<int:pk>/apply/', views.ApplyToJob.as_view(), name='apply-job'),
    path('me/saved-jobs/', views.SavedJobs.as_view(), name='saved-jobs'),
    path('me/applications/', views.MyApplications.as_view(), name='my-applications'),
    path('client/jobs/', views.ClientJobs.as_view(), name='client-jobs'),
    path('client/jobs/<int:pk>/', views.ClientJobDetail.as_view(), name='client-job-detail'),
    path('client/applications/', views.ClientApplications.as_view(), name='client-applications'),
    path('client/applications/<int:pk>/', views.ClientApplicationUpdate.as_view(), name='client-application-update'),
]
