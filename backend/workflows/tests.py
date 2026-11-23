"""Tests for account isolation, moderation, real conversations and workflows."""
from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase
from accounts.models import Profile, Skill
from opportunities.models import Application, Job
from .models import EvidenceRecord, SubmittedOpportunity, Milestone, InboxNotification, ProofAsset

User = get_user_model()


class WorkflowsTests(APITestCase):
    def setUp(self):
        self.freelancer = User.objects.create_user(username='freelancer_a', password='SafeDemoPassword123!')
        self.other = User.objects.create_user(username='freelancer_b', password='SafeDemoPassword123!')
        self.client_user = User.objects.create_user(username='client_a', password='SafeDemoPassword123!')
        self.admin = User.objects.create_superuser(username='admin_a', password='SafeDemoPassword123!', email='admin@example.org')
        Profile.objects.create(user=self.freelancer, role='freelancer')
        Profile.objects.create(user=self.other, role='freelancer')
        Profile.objects.create(user=self.client_user, role='client')
        self.job = Job.objects.create(owner=self.client_user, title='Make a poster', description='Design a poster for a local business.',
            category='Design', client_name='Local client', required_skills=['Canva'],
            budget_usd=Decimal('30'), status='published')
        self.application = Application.objects.create(user=self.freelancer, job=self.job,
            message='I can make the poster.', proposed_rate_usd=Decimal('25'))

    def use(self, user):
        self.client.force_authenticate(user=user)

    def test_shield_checks_are_private_and_only_saved_on_request(self):
        self.use(self.freelancer)
        r = self.client.post('/api/flows/shield/check/', {'text': 'Pay a registration fee first.'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['verdict'], 'danger')
        self.assertIn('fee', r.data['findings']['red'])
        self.assertEqual(self.client.get('/api/flows/shield/history/').data['count'], 0)
        self.client.post('/api/flows/shield/check/', {'text': 'Pay a registration fee first.', 'save': True}, format='json')
        self.assertEqual(self.client.get('/api/flows/shield/history/').data['count'], 1)
        self.use(self.other)
        self.assertEqual(self.client.get('/api/flows/shield/history/').data['count'], 0)
        self.client.post('/api/flows/shield/check/', {'text': 'Send me a bank password.', 'save': True}, format='json')
        self.assertEqual(self.client.delete('/api/flows/shield/history/').status_code, 204)
        self.assertEqual(self.client.get('/api/flows/shield/history/').data['count'], 0)
        self.use(self.freelancer)
        self.assertEqual(self.client.get('/api/flows/shield/history/').data['count'], 1)

    def test_evidence_is_private_and_sync_is_validated(self):
        self.use(self.freelancer)
        r = self.client.post('/api/flows/evidence/', {'text': 'Please send me your photo.', 'categories': ['photo']}, format='json')
        self.assertEqual(r.status_code, 201)
        record = r.data['id']
        self.use(self.other)
        self.assertEqual(self.client.get(f'/api/flows/evidence/{record}/').status_code, 404)
        self.assertEqual(self.client.delete(f'/api/flows/evidence/{record}/').status_code, 404)
        self.use(self.freelancer)
        self.assertEqual(self.client.post('/api/flows/evidence/replace/', {'items': [{'text': 'A different message', 'categories': [], 'source': 'chat'}]}, format='json').status_code, 200)
        self.assertEqual(EvidenceRecord.objects.filter(owner=self.freelancer).count(), 1)
        self.assertEqual(EvidenceRecord.objects.get(owner=self.freelancer).text, 'A different message')

    def test_contributions_require_admin_review(self):
        self.use(self.freelancer)
        payload = {'title': 'Design flyer', 'description': 'Make a flyer', 'organisation': 'Local NGO', 'budgetMax': 50, 'skillsRequired': ['Canva'], 'sourceURL': 'https://example.org/jobs/design-flyer'}
        r = self.client.post('/api/flows/contributions/', {'kind': 'opportunity', 'payload': payload}, format='json')
        self.assertEqual(r.status_code, 201)
        submission_id = r.data['id']
        self.assertEqual(r.data['status'], 'pending')
        self.assertEqual(self.client.get('/api/flows/contributions/review/').status_code, 403)
        self.assertEqual(self.client.post(f'/api/flows/contributions/{submission_id}/review/', {'decision': 'approve'}, format='json').status_code, 403)
        self.use(self.admin)
        self.assertEqual(self.client.get('/api/flows/contributions/review/').data['count'], 1)
        r = self.client.post(f'/api/flows/contributions/{submission_id}/review/', {'decision': 'approve'}, format='json')
        self.assertEqual(r.status_code, 200)
        job = SubmittedOpportunity.objects.get(pk=submission_id).published_job
        self.assertEqual(job.status, 'published')
        self.assertFalse(job.payment_verified)
        self.assertEqual(job.external_url, 'https://example.org/jobs/design-flyer')
        self.assertEqual(self.client.post(f'/api/flows/contributions/{submission_id}/review/', {'decision': 'approve'}, format='json').status_code, 400)

    def test_external_job_reviewer_rejects_unsafe_link(self):
        self.use(self.freelancer)
        payload = {'title': 'Review content', 'description': 'Check copy', 'organisation': 'Example',
                   'budgetMax': 30, 'sourceURL': 'javascript:alert(1)'}
        posted = self.client.post('/api/flows/contributions/', {'kind': 'opportunity', 'payload': payload}, format='json')
        self.assertEqual(posted.status_code, 201)
        self.use(self.admin)
        reviewed = self.client.post(f"/api/flows/contributions/{posted.data['id']}/review/", {'decision': 'approve'}, format='json')
        self.assertEqual(reviewed.status_code, 400)
        self.assertFalse(Job.objects.filter(title='Review content').exists())

    def test_messages_respect_both_participants_and_block(self):
        url = f'/api/flows/conversations/{self.application.pk}/'
        self.use(self.other)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.assertEqual(self.client.post(url, {'text': 'Not my conversation'}, format='json').status_code, 403)
        self.use(self.freelancer)
        self.assertEqual(self.client.post(url, {'text': 'Hello!'}, format='json').status_code, 201)
        self.assertEqual(self.client.get(url).data['messages'][0]['text'], 'Hello!')
        self.assertEqual(self.client.patch(url + 'controls/', {'blocked': True}, format='json').status_code, 200)
        self.use(self.client_user)
        self.assertEqual(self.client.post(url, {'text': 'Reply'}, format='json').status_code, 403)
        self.assertEqual(self.client.patch(url + 'controls/', {'blocked': False}, format='json').status_code, 403)
        self.use(self.freelancer)
        self.assertEqual(self.client.patch(url + 'controls/', {'blocked': False, 'muted': True}, format='json').status_code, 200)
        self.use(self.client_user)
        self.assertEqual(self.client.post(url, {'text': 'Muted'}, format='json').status_code, 403)

    def test_workroom_permissions_and_simulated_milestone_transitions(self):
        url = f'/api/flows/workrooms/{self.application.pk}/'
        self.use(self.freelancer)
        self.assertEqual(self.client.get(url).status_code, 400)
        self.application.status = 'accepted'
        self.application.save()
        self.use(self.other)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.use(self.freelancer)
        self.assertEqual(self.client.get(url).status_code, 200)
        self.assertEqual(self.client.post(url + 'milestones/', {'title': 'Draft', 'amount_usd': '10.00'}, format='json').status_code, 403)
        self.use(self.client_user)
        r = self.client.post(url + 'milestones/', {'title': 'Draft', 'amount_usd': '10.00', 'position': 0}, format='json')
        self.assertEqual(r.status_code, 201)
        mid = r.data['id']
        state_url = f'{url}milestones/{mid}/state/'
        self.assertEqual(self.client.post(state_url, {'state': 'submitted'}, format='json').status_code, 403)
        self.assertEqual(self.client.post(state_url, {'state': 'funded_demo'}, format='json').status_code, 200)
        self.use(self.freelancer)
        self.assertEqual(self.client.post(state_url, {'state': 'released_demo'}, format='json').status_code, 403)
        # Milestones cannot be submitted without a recorded deliverable.
        self.assertEqual(self.client.post(state_url, {'state': 'submitted'}, format='json').status_code, 400)
        self.assertEqual(self.client.post(url + f'milestones/{mid}/delivery/',
            {'description': 'Completed poster draft, attached in project link.',
             'links': ['https://example.com/design-draft']}, format='json').status_code, 200)
        self.assertEqual(self.client.post(state_url, {'state': 'submitted'}, format='json').status_code, 200)
        self.use(self.client_user)
        self.assertEqual(self.client.post(state_url, {'state': 'released_demo'}, format='json').status_code, 200)
        self.assertEqual(Milestone.objects.get(pk=mid).state, 'released_demo')
        self.assertTrue(InboxNotification.objects.filter(owner=self.freelancer).exists())

    def test_single_partial_milestone_does_not_complete_whole_job(self):
        self.application.status = 'accepted'
        self.application.save()
        url = f'/api/flows/workrooms/{self.application.pk}/'
        self.use(self.client_user)
        self.client.get(url)
        milestone = self.client.post(url + 'milestones/',
            {'title': 'Draft', 'amount_usd': '4.00'}, format='json').data
        path = f"{url}milestones/{milestone['id']}/"
        self.client.post(path + 'state/', {'state': 'funded_demo'}, format='json')
        self.use(self.freelancer)
        self.client.post(path + 'delivery/', {'description': 'Draft delivered', 'links': []}, format='json')
        self.client.post(path + 'state/', {'state': 'submitted'}, format='json')
        self.use(self.client_user)
        self.client.post(path + 'state/', {'state': 'released_demo'}, format='json')
        self.assertFalse(self.client.get(url).data['is_complete'])
        self.use(self.freelancer)
        self.assertEqual(self.client.get('/api/flows/passport/completions/').data['count'], 0)
        self.use(self.client_user)
        remaining = self.client.post(url + 'milestones/',
            {'title': 'Final', 'amount_usd': '21.00'}, format='json')
        self.assertEqual(remaining.status_code, 201)
        second = f"{url}milestones/{remaining.data['id']}/"
        self.client.post(second + 'state/', {'state': 'funded_demo'}, format='json')
        self.use(self.freelancer)
        self.client.post(second + 'delivery/', {'description': 'Final graphics delivered', 'links': []}, format='json')
        self.client.post(second + 'state/', {'state': 'submitted'}, format='json')
        self.use(self.client_user)
        self.client.post(second + 'state/', {'state': 'released_demo'}, format='json')
        self.assertTrue(self.client.get(url).data['is_complete'])
        self.use(self.freelancer)
        self.assertEqual(self.client.get('/api/flows/passport/completions/').data['count'], 1)

    def test_revisions_must_be_requested_by_client_and_resubmitted_with_updates(self):
        self.application.status = 'accepted'
        self.application.save()
        url = f'/api/flows/workrooms/{self.application.pk}/'
        self.use(self.client_user)
        self.client.get(url)
        mid = self.client.post(url + 'milestones/', {'title': 'Design', 'amount_usd': '25.00'}, format='json').data['id']
        path = f'{url}milestones/{mid}/'
        self.client.post(path + 'state/', {'state': 'funded_demo'}, format='json')
        self.use(self.freelancer)
        self.client.post(path + 'delivery/', {'description': 'First version', 'links': []}, format='json')
        self.client.post(path + 'state/', {'state': 'submitted'}, format='json')
        self.assertEqual(self.client.post(path + 'state/', {'state': 'revision_requested', 'note': 'Change fonts'}, format='json').status_code, 403)
        self.use(self.client_user)
        self.assertEqual(self.client.post(path + 'state/', {'state': 'revision_requested', 'note': 'Use larger titles'}, format='json').status_code, 200)
        self.use(self.freelancer)
        self.assertEqual(self.client.post(path + 'state/', {'state': 'submitted'}, format='json').status_code, 400)
        self.assertEqual(self.client.post(path + 'delivery/', {'description': 'Updated title sizes', 'links': ['https://example.org/updated']}, format='json').status_code, 200)
        self.assertEqual(self.client.post(path + 'state/', {'state': 'submitted'}, format='json').status_code, 200)
        self.use(self.client_user)
        self.assertEqual(self.client.post(path + 'state/', {'state': 'released_demo'}, format='json').status_code, 200)

    def test_milestone_attachments_are_private(self):
        import base64
        from PIL import Image
        from io import BytesIO
        self.application.status = 'accepted'
        self.application.save()
        url = f'/api/flows/workrooms/{self.application.pk}/'
        self.use(self.client_user)
        self.client.get(url)
        mid = self.client.post(url + 'milestones/', {'title': 'Logo', 'amount_usd': '25.00'}, format='json').data['id']
        path = f'{url}milestones/{mid}/'
        self.client.post(path + 'state/', {'state': 'funded_demo'}, format='json')
        out = BytesIO()
        Image.new('RGB', (4, 4), 'white').save(out, 'JPEG')
        payload = 'data:image/jpeg;base64,' + base64.b64encode(out.getvalue()).decode()
        self.use(self.freelancer)
        attach = self.client.post(path + 'files/', {'name': 'sample.jpg', 'data': payload}, format='json')
        self.assertEqual(attach.status_code, 201)
        file_url = f"{path}files/{attach.data['id']}/"
        self.assertEqual(self.client.get(file_url).status_code, 200)
        self.use(self.other)
        self.assertEqual(self.client.get(file_url).status_code, 403)
        self.assertEqual(self.client.delete(file_url).status_code, 403)
        self.use(self.client_user)
        self.assertEqual(self.client.get(file_url).status_code, 200)
        self.assertEqual(self.client.delete(file_url).status_code, 403)
        self.use(self.freelancer)
        self.assertEqual(self.client.post(path + 'state/', {'state': 'submitted'}, format='json').status_code, 200)
        self.assertEqual(self.client.delete(file_url).status_code, 400)

    def test_skillbridge_and_institution_summary_use_published_jobs_only(self):
        Skill.objects.create(user=self.freelancer, name='Canva', level='beginner')
        Job.objects.create(owner=self.client_user, title='Secret job', description='Unapproved', category='Design',
            client_name='Client', required_skills=['SecretSkill'], budget_usd=Decimal('99'), status='pending_review')
        self.use(self.freelancer)
        skills = self.client.get('/api/flows/skillbridge/').data
        self.assertEqual(skills['job_matches'][0]['matched'], 1)
        report = self.client.get('/api/flows/institution-insight/').data
        self.assertEqual(report['published_jobs'], 1)
        self.assertNotIn('SecretSkill', [s['skill'] for s in report['skills']])

    def test_settings_checkins_notifications_are_private(self):
        self.use(self.freelancer)
        self.assertEqual(self.client.patch('/api/flows/safety/preferences/', {'quiet_hours': {'on': True}, 'trusted_contact': {'name': 'Friend', 'phone': '000000'}}, format='json').status_code, 200)
        due = timezone.now() + timedelta(hours=1)
        r = self.client.post('/api/flows/safety/checkins/', {'scheduled_for': due.isoformat()}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.client.post(f'/api/flows/safety/checkins/{r.data["id"]}/acknowledge/').status_code, 200)
        self.use(self.other)
        self.assertEqual(self.client.get('/api/flows/safety/preferences/').data['trusted_contact'], {})
        self.assertEqual(self.client.get('/api/flows/safety/checkins/').data['count'], 0)
        self.assertEqual(self.client.post(f'/api/flows/safety/checkins/{r.data["id"]}/acknowledge/').status_code, 404)

    def test_proof_links_are_private_and_image_payload_is_limited(self):
        self.use(self.freelancer)
        r = self.client.post('/api/flows/proof/', {'proofs': {'Canva': [{'type': 'link', 'src': 'https://example.org/work', 'note': 'Practice project'}]}}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['saved'], 1)
        self.assertEqual(ProofAsset.objects.filter(owner=self.freelancer).count(), 1)
        self.use(self.other)
        self.assertEqual(self.client.get('/api/flows/proof/').data['proofs'], {})
        self.use(self.freelancer)
        self.assertEqual(self.client.post('/api/flows/proof/', {'proofs': {'Canva': [{'type': 'photo', 'src': 'data:image/png;base64,abc'}]}}, format='json').status_code, 400)
        self.assertEqual(ProofAsset.objects.filter(owner=self.freelancer).count(), 1)

    def test_public_passport_has_no_private_evidence_or_contact_data(self):
        self.use(self.freelancer)
        self.client.patch('/api/flows/safety/preferences/', {'trusted_contact': {'name': 'Secret', 'phone': '1234567890'}}, format='json')
        self.client.post('/api/flows/evidence/', {'text': 'Sensitive incident evidence.'}, format='json')
        self.client.post('/api/flows/proof/', {'proofs': {'Canva': [{'type': 'link', 'src': 'https://example.org/sample'}]}}, format='json')
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get('/api/flows/public-passport/not-found/').status_code, 404)
        self.use(self.freelancer)
        r = self.client.post('/api/flows/passport/share/', {}, format='json')
        self.assertEqual(r.status_code, 200)
        token = r.data['token']
        self.client.force_authenticate(user=None)
        profile = self.client.get(f'/api/flows/public-passport/{token}/')
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(len(profile.data['samples']), 1)
        self.assertNotIn('trusted_contact', profile.data)
        self.assertNotIn('evidence', profile.data)
        self.assertNotIn('1234567890', str(profile.data))
        self.use(self.freelancer)
        self.assertEqual(self.client.delete('/api/flows/passport/share/').status_code, 204)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(f'/api/flows/public-passport/{token}/').status_code, 404)


    def test_deliverable_specs_checked_on_upload_and_review(self):
        import base64
        from PIL import Image
        from io import BytesIO
        self.job.deliverables = [{
            'name': 'Logo file', 'description': 'Final logo in PNG, transparent background.',
            'quantity': 1, 'formats': ['png'], 'max_mb': 10, 'link_allowed': False, 'milestone': 1,
        }]
        self.job.save()
        self.application.status = 'accepted'
        self.application.save()
        url = f'/api/flows/workrooms/{self.application.pk}/'
        self.use(self.client_user)
        room = self.client.get(url)
        self.assertEqual(room.status_code, 200)
        self.assertEqual(room.data['deliverable_specs'][0]['name'], 'Logo file')
        mid = self.client.post(url + 'milestones/', {'title': 'Logo', 'amount_usd': '25.00', 'position': 0}, format='json').data['id']
        path = f'{url}milestones/{mid}/'
        self.client.post(path + 'state/', {'state': 'funded_demo'}, format='json')

        def payload(fmt, mime):
            out = BytesIO()
            Image.new('RGB', (4, 4), 'white').save(out, fmt)
            return f'data:{mime};base64,' + base64.b64encode(out.getvalue()).decode()

        self.use(self.freelancer)
        # Wrong formats for this spec are refused by the server, PNG is accepted.
        self.assertEqual(self.client.post(path + 'files/', {'name': 'logo.jpg', 'data': payload('JPEG', 'image/jpeg')}, format='json').status_code, 400)
        pdf = 'data:application/pdf;base64,' + base64.b64encode(b'%PDF-1.4 test').decode()
        self.assertEqual(self.client.post(path + 'files/', {'name': 'logo.pdf', 'data': pdf}, format='json').status_code, 400)
        self.assertEqual(self.client.post(path + 'files/', {'name': 'logo.png', 'data': payload('PNG', 'image/png')}, format='json').status_code, 201)
        self.assertEqual(self.client.post(path + 'state/', {'state': 'submitted'}, format='json').status_code, 200)
        # Unticked spec items lead the revision note; the checklist is stored.
        self.use(self.client_user)
        r = self.client.post(path + 'state/', {'state': 'revision_requested', 'note': 'Please redo the colours.', 'checks': []}, format='json')
        self.assertEqual(r.status_code, 200)
        milestone = Milestone.objects.get(pk=mid)
        self.assertTrue(milestone.revision_note.startswith('Missing or incomplete: Logo file.'))
        self.assertIn('redo the colours', milestone.revision_note)
        self.assertEqual(milestone.review_checks, [])
        # Resubmit with fresh delivery, then release with the item ticked.
        self.use(self.freelancer)
        self.assertEqual(self.client.post(path + 'delivery/', {'description': 'Updated logo, colours redone.', 'links': []}, format='json').status_code, 200)
        self.assertEqual(self.client.post(path + 'state/', {'state': 'submitted'}, format='json').status_code, 200)
        self.use(self.client_user)
        r = self.client.post(path + 'state/', {'state': 'released_demo', 'checks': ['Logo file']}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Milestone.objects.get(pk=mid).review_checks, ['Logo file'])


    def test_shield_unknown_verdict_for_gibberish(self):
        from .services import analyze
        self.assertEqual(analyze('uihduoiwhodwehdc asdfgh qwerty zzz')['verdict'], 'unknown')
        self.assertEqual(analyze('Pay the registration fee first by eSewa to start today')['verdict'], 'danger')
        legit = analyze('Logo design for a new cafe. Pay NPR 6000 by bank transfer. Deadline Friday.')
        self.assertNotEqual(legit['verdict'], 'unknown')

class ExtensionPairingTests(APITestCase):
    """An extension is a separate, short-lived permission, never a password/JWT."""

    def setUp(self):
        self.owner = User.objects.create_user('pair_owner', password='SafeDemoPassword123!')
        self.stranger = User.objects.create_user('pair_stranger', password='SafeDemoPassword123!')
        Profile.objects.create(user=self.owner, role='freelancer', display_name='A Freelancer')
        Profile.objects.create(user=self.stranger, role='freelancer')

    def pair(self):
        self.client.force_authenticate(user=self.owner)
        started = self.client.post('/api/flows/extension/pair/', {'label': 'Chrome'}, format='json')
        self.assertEqual(started.status_code, 201, started.data)
        code = started.data['code']
        self.assertEqual(len(code), 12)
        self.client.force_authenticate(user=None)
        activated = self.client.post('/api/flows/extension/activate/', {'code': code}, format='json')
        self.assertEqual(activated.status_code, 201, activated.data)
        return code, activated.data['token']

    def test_pair_one_time_code_and_account_scoped_sync(self):
        code, token = self.pair()
        reused = self.client.post('/api/flows/extension/activate/', {'code': code}, format='json')
        self.assertEqual(reused.status_code, 400)
        self.client.credentials(HTTP_AUTHORIZATION=f'Extension {token}')
        self.assertEqual(self.client.get('/api/flows/extension/status/').data['name'], 'A Freelancer')
        result = self.client.post('/api/flows/extension/check/', {
            'text': 'Pay the registration fee first', 'save': True,
        }, format='json')
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data['verdict'], 'danger')
        saved = self.client.post('/api/flows/extension/evidence/', {
            'text': 'Send photos or lose the job', 'categories': ['photo'],
        }, format='json')
        self.assertEqual(saved.status_code, 201, saved.data)
        self.client.credentials()
        self.client.force_authenticate(user=self.stranger)
        self.assertEqual(self.client.get('/api/flows/evidence/').data['count'], 0)
        self.assertEqual(self.client.get('/api/flows/shield/history/').data['count'], 0)

    def test_browser_revocation_is_owner_only(self):
        _, token = self.pair()
        from .models import BrowserExtensionSession
        pk = BrowserExtensionSession.objects.get(owner=self.owner).pk
        self.client.force_authenticate(user=self.stranger)
        self.assertEqual(self.client.delete(f'/api/flows/extension/pair/{pk}/').status_code, 400)
        self.client.force_authenticate(user=self.owner)
        self.assertEqual(self.client.delete(f'/api/flows/extension/pair/{pk}/').status_code, 204)
        self.client.force_authenticate(user=None)
        self.client.credentials(HTTP_AUTHORIZATION=f'Extension {token}')
        self.assertEqual(self.client.get('/api/flows/extension/status/').status_code, 401)

    def test_expired_pairing_and_bad_extension_token_are_rejected(self):
        from .models import BrowserPairingCode
        self.client.force_authenticate(user=self.owner)
        started = self.client.post('/api/flows/extension/pair/', {}, format='json')
        self.assertEqual(started.status_code, 201)
        BrowserPairingCode.objects.filter(owner=self.owner).update(expires_at=timezone.now() - timedelta(minutes=1))
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.post('/api/flows/extension/activate/', {
            'code': started.data['code'],
        }, format='json').status_code, 400)
        self.client.credentials(HTTP_AUTHORIZATION='Extension ' + 'z' * 64)
        self.assertEqual(self.client.get('/api/flows/extension/passport/').status_code, 401)



class PaymentTests(APITestCase):
    """DirectPay: methods, the start-record-confirm/dispute flow, and isolation."""

    PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII='

    def setUp(self):
        self.freelancer = User.objects.create_user(username='pay_free', password='x')
        self.other = User.objects.create_user(username='pay_other', password='x')
        self.client_user = User.objects.create_user(username='pay_client', password='x')
        Profile.objects.create(user=self.freelancer, role='freelancer')
        Profile.objects.create(user=self.other, role='freelancer')
        Profile.objects.create(user=self.client_user, role='client')
        self.job = Job.objects.create(owner=self.client_user, title='Logo job', description='Design a logo.',
            category='Design', client_name='Client', required_skills=['Canva'],
            budget_usd=Decimal('30'), status='published')
        self.application = Application.objects.create(user=self.freelancer, job=self.job,
            message='I can do it.', proposed_rate_usd=Decimal('25'), status='accepted')
        from .models import Workroom
        self.room = Workroom.objects.create(application=self.application)
        self.milestone = Milestone.objects.create(workroom=self.room, title='Logo files',
            amount_usd=Decimal('25'), state='released_demo', position=0)

    def use(self, user):
        self.client.force_authenticate(user=user)

    def add_method(self):
        self.use(self.freelancer)
        r = self.client.post('/api/flows/payments/methods/',
            {'kind': 'esewa', 'holder_name': 'Maya Rai', 'mobile': '9841234567', 'is_preferred': True}, format='json')
        assert r.status_code == 201, r.data
        return r.data['id']

    def start(self):
        self.use(self.client_user)
        return self.client.post('/api/flows/payments/start/', {'milestone_id': self.milestone.pk}, format='json')

    def test_methods_crud_validation_and_isolation(self):
        self.use(self.freelancer)
        bad = self.client.post('/api/flows/payments/methods/',
            {'kind': 'esewa', 'holder_name': 'Maya', 'mobile': '123'}, format='json')
        self.assertEqual(bad.status_code, 400)
        bad = self.client.post('/api/flows/payments/methods/',
            {'kind': 'bank', 'holder_name': 'Maya', 'bank_name': 'Nabil'}, format='json')
        self.assertEqual(bad.status_code, 400)
        mid = self.add_method()
        rows = self.client.get('/api/flows/payments/methods/').data
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['mobile'], '9841234567')
        # Another user sees none of them and cannot touch them.
        self.use(self.other)
        self.assertEqual(self.client.get('/api/flows/payments/methods/').data, [])
        self.assertEqual(self.client.patch(f'/api/flows/payments/methods/{mid}/',
            {'holder_name': 'Hacked'}, format='json').status_code, 404)
        self.assertEqual(self.client.delete(f'/api/flows/payments/methods/{mid}/').status_code, 404)
        # Owner can edit and delete.
        self.use(self.freelancer)
        r = self.client.patch(f'/api/flows/payments/methods/{mid}/', {'mobile': '9851098765'}, format='json')
        self.assertEqual(r.data['mobile'], '9851098765')
        self.assertEqual(self.client.delete(f'/api/flows/payments/methods/{mid}/').status_code, 204)

    def test_full_flow_record_confirm(self):
        from .models import PaymentRecord
        self.add_method()
        r = self.start()
        self.assertEqual(r.status_code, 201, r.data)
        pid = r.data['id']
        self.assertEqual(r.data['status'], 'awaiting_payment')
        self.assertEqual(r.data['method_snapshot']['mobile'], '9841234567')
        self.assertEqual(self.start().status_code, 400)  # duplicate active payment
        # Freelancer cannot record the employer's payment.
        self.use(self.freelancer)
        self.assertEqual(self.client.post(f'/api/flows/payments/{pid}/sent/',
            {'amount': '25', 'transaction_ref': 'REF12345', 'paid_date': '2026-11-22'}, format='json').status_code, 400)
        # Employer records it, with a receipt.
        self.use(self.client_user)
        r = self.client.post(f'/api/flows/payments/{pid}/sent/',
            {'amount': '25', 'transaction_ref': 'REF12345', 'paid_date': '2026-11-22',
             'receipt': {'name': 'receipt.png', 'data': self.PNG}}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['status'], 'sent')
        self.assertTrue(r.data['has_receipt'])
        self.assertTrue(InboxNotification.objects.filter(owner=self.freelancer, kind='payment_sent').exists())
        # Employer cannot confirm receipt on the freelancer's behalf.
        self.assertEqual(self.client.post(f'/api/flows/payments/{pid}/confirm/', {}, format='json').status_code, 400)
        # Freelancer confirms; employer is notified; a second confirm is refused.
        self.use(self.freelancer)
        r = self.client.post(f'/api/flows/payments/{pid}/confirm/', {}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['status'], 'confirmed')
        self.assertTrue(InboxNotification.objects.filter(owner=self.client_user, kind='payment_confirmed').exists())
        self.assertEqual(self.client.post(f'/api/flows/payments/{pid}/confirm/', {}, format='json').status_code, 400)
        self.assertEqual([e['action'] for e in r.data['events']], ['created', 'sent', 'confirmed'])
        # Confirmed is final: no new attempt for this milestone.
        self.assertEqual(self.start().status_code, 400)
        self.assertEqual(PaymentRecord.objects.filter(milestone=self.milestone).count(), 1)

    def test_dispute_and_retry(self):
        self.add_method()
        pid = self.start().data['id']
        self.use(self.client_user)
        self.client.post(f'/api/flows/payments/{pid}/sent/',
            {'amount': '20', 'transaction_ref': 'REF99999', 'paid_date': '2026-11-22'}, format='json')
        # Employer cannot dispute; freelancer must explain.
        self.assertEqual(self.client.post(f'/api/flows/payments/{pid}/dispute/',
            {'reason': 'wrong_amount', 'note': 'Only 20 arrived'}, format='json').status_code, 400)
        self.use(self.freelancer)
        self.assertEqual(self.client.post(f'/api/flows/payments/{pid}/dispute/',
            {'reason': 'wrong_amount', 'note': ''}, format='json').status_code, 400)
        r = self.client.post(f'/api/flows/payments/{pid}/dispute/',
            {'reason': 'wrong_amount', 'note': 'Only 20 of 25 arrived in my eSewa.'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['status'], 'disputed')
        self.assertEqual(r.data['disputes'][0]['reason'], 'wrong_amount')
        self.assertTrue(InboxNotification.objects.filter(owner=self.client_user, kind='payment_disputed').exists())
        # Retry keeps the disputed record and creates attempt 2; employer can cancel it.
        r = self.start()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['attempt'], 2)
        self.assertEqual(self.client.post(f'/api/flows/payments/{r.data["id"]}/cancel/', {}, format='json').data['status'], 'cancelled')
        self.assertEqual(self.start().status_code, 201)  # a third attempt may start

    def test_start_requires_approval_and_method(self):
        # No payment method yet.
        self.assertEqual(self.start().status_code, 400)
        self.add_method()
        # Milestone not yet approved.
        self.milestone.state = 'submitted'
        self.milestone.save()
        self.assertEqual(self.start().status_code, 400)
        self.milestone.state = 'released_demo'
        self.milestone.save()
        # The freelancer cannot start a payment on their own milestone.
        self.use(self.freelancer)
        self.assertEqual(self.client.post('/api/flows/payments/start/',
            {'milestone_id': self.milestone.pk}, format='json').status_code, 400)

    def test_receipt_validation_and_record_isolation(self):
        self.add_method()
        pid = self.start().data['id']
        self.use(self.client_user)
        bad = self.client.post(f'/api/flows/payments/{pid}/sent/',
            {'amount': '25', 'transaction_ref': 'REF12345', 'paid_date': '2026-11-22',
             'receipt': {'name': 'evil.png', 'data': 'data:image/png;base64,TVqQAAMAAAAEAAAA//8AALgAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'}}, format='json')
        self.assertEqual(bad.status_code, 400)  # PNG header claimed, EXE content
        ok = self.client.post(f'/api/flows/payments/{pid}/sent/',
            {'amount': '25', 'transaction_ref': 'REF12345', 'paid_date': '2026-11-22',
             'receipt': {'name': 'receipt.png', 'data': self.PNG}}, format='json')
        self.assertEqual(ok.status_code, 200)
        # A third user sees no records and cannot act or download.
        self.use(self.other)
        self.assertEqual(self.client.get('/api/flows/payments/').data, [])
        self.assertEqual(self.client.post(f'/api/flows/payments/{pid}/confirm/', {}, format='json').status_code, 400)
        self.assertEqual(self.client.get(f'/api/flows/payments/{pid}/receipt/').status_code, 400)
        # A participant can download the receipt.
        self.use(self.freelancer)
        self.assertEqual(self.client.get(f'/api/flows/payments/{pid}/receipt/').status_code, 200)

    def test_multiple_milestones_are_independent(self):
        second = Milestone.objects.create(workroom=self.room, title='Source files',
            amount_usd=Decimal('10'), state='released_demo', position=1)
        self.add_method()
        first = self.start()
        self.assertEqual(first.status_code, 201)
        self.use(self.client_user)
        r2 = self.client.post('/api/flows/payments/start/', {'milestone_id': second.pk}, format='json')
        self.assertEqual(r2.status_code, 201)
        self.assertNotEqual(first.data['id'], r2.data['id'])
        rows = self.client.get('/api/flows/payments/').data
        self.assertEqual(len(rows), 2)
