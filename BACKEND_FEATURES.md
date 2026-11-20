# Backend features and API endpoints

**Status:** code prepared; perform a local Django migration/test run and real browser integration tests before deployment. The Chrome extension is included unchanged and is not connected to the API.

| Area | Endpoint(s) | Data and limits |
| --- | --- | --- |
| User accounts | `/api/auth/register/`, `login/`, `refresh/`, `logout/`, `me/` | Normal freelancer/client roles; account-isolated records |
| Recovery and privacy | `/api/auth/password-reset/request/`, `password-reset/confirm/`, `email-verification/request/`, `email-verification/confirm/`, `sign-out-everywhere/`, `my-data/` | SMTP required for email delivery; logout-all blacklists refresh tokens; access tokens expire naturally |
| Passport | `/api/auth/passport/`, `/api/auth/passport/progress/` | Full professional profile, skills and training. Self-declared skills cannot claim third-party verification |
| Skills and evidence | `/api/auth/me/skills/`, `training/`, `skill-verifications/`, `work-samples/`, `/api/flows/proof/` | Real tables, uploader ownership and private JPEG re-encoding. Staff adds independently verified levels in admin |
| Jobs and applications | `/api/jobs/`, `/api/client/jobs/`, `/api/jobs/<id>/save/`, `/api/jobs/<id>/apply/`, `/api/me/applications/`, `/api/client/applications/` | Review before publishing; filters: search, category, skill, min_budget, max_budget, beginner |
| Practice jobs | `seed_demo_jobs`, jobs and applications APIs | Same normalized job/app models as real users; fictional owner disabled and simulated messages/payment |
| WorkShield and evidence | `/api/flows/shield/check/`, `/api/flows/shield/history/`, `/api/flows/evidence/` | Rule-based warning explanations and account-private saved records |
| Client safety | `/api/auth/reports/`, `/api/flows/conversations/<id>/controls/` | Reports for admin review; block/mute enforced in Django chat |
| Conversations | `/api/flows/conversations/<id>/` | Same participant-owned application thread for freelancer and real client; demo replies clearly labelled |
| Workroom | `/api/flows/workrooms/<id>/` and milestones routes | Real client/freelancer state changes enforced by role; **funding/release always simulated** |
| Completed work | `/api/flows/passport/completions/` | Derived from finished backend milestones, with simulated marker |
| Opportunity contributions | `/api/flows/contributions/`, `/api/flows/contributions/review/`, `/api/flows/contributions/<id>/review/` | Staff review; approved external listings require safe HTTP/HTTPS source URL |
| SkillBridge and institutions | `/api/flows/skillbridge/`, `/api/flows/institution-insight/`, `/api/flows/insights/approved/` | Published-job aggregates; not a validated market-wide survey |
| Safety preferences/check-ins | `/api/flows/safety/preferences/`, `/api/flows/safety/checkins/`, `process_checkins` | In-app overdue notices only, not emergency calls/messages |
| Notifications | `/api/flows/notifications/` and mark-read | Private in-app inbox |
| Shareable Passport | `/api/flows/passport/share/`, `/api/flows/public-passport/<token>/` | Revocable token; selected professional fields only, no private reports/evidence photos |
| API schema | `/api/schema/`, `/api/docs/` | OpenAPI (drf-spectacular) |

## Remaining real-world dependencies, deliberately not fabricated

- **Payments:** no money transfer, escrow or actual funded milestones. Add a licensed payments provider before handling funds.
- **Real client verification:** review status alone does not prove a client identity. Independent verification would need an operational workflow.
- **Emergency alerts:** an in-app check-in is not a guaranteed SMS, email or police alert. Keep wording honest.
- **Email delivery:** requires a configured provider. Development console emails do not reach inboxes.
- **File storage:** local private uploads do not survive ephemeral-host deletion; configure storage and backups.
- **Chrome extension:** no pairing, auth or backend synchronization yet, per the requested extension-last scope.
- **Workroom chat:** uses HTTP polling; no WebSocket service.

## Test sequence (after installation)

1. `python manage.py migrate`, `python manage.py makemigrations --check --dry-run`, `python manage.py test`; `npm install`, `npm run build`.
2. Seed demo jobs and Maya, then create separate freelancer/client/admin accounts.
3. Freelancer: complete Passport, add proof, save/apply to sample job, open simulated conversation and milestones, refresh, sign back in.
4. Client: submit a job; admin approves it; freelancer applies; client receives application; parties exchange real messages and update workroom with role checks.
5. Verify that a second unrelated freelancer/client cannot see, modify or delete another account's private data.
6. WorkShield, evidence, reports, external opportunity review, skill gaps, training, notifications, public profile and account deletion.
7. Verify emails only after SMTP setup, and missed check-in notices only after the scheduled command runs.
8. Test on separate devices/browsers before claiming cross-device persistence or production readiness.
