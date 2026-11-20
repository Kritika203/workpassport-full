# WorkPassport — web app and Django backend

This project contains the complete WorkPassport React prototype and its Django API. **Registered freelancers and clients use the same web application as the Maya demo.** The backend stores accounts, skills, proof levels, portfolio records, jobs, applications, conversations, workrooms, safety records, and supporting data. The Chrome extension is included but **has not been connected to Django yet**.

It is still an MVP/prototype: seeded jobs and practice conversations are fictional, milestone funding and payments are **simulated**, safety-rule results are advisory, and the device PIN/Quick Hide are interface features rather than secure authentication. Real verification, emergency dispatch, escrow, and payment transfer do not exist.

## Windows setup — clean installation

Extract the ZIP, open its inner `workpassport/` directory in VS Code, and open two PowerShell terminals.

### Terminal 1: Django API

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

If `.env` already exists, **do not overwrite it**. Edit `backend/.env` and set a strong `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=true` for local testing and your own `DEMO_MAYA_PASSWORD` of 12+ characters. Never commit or share `.env`.

```powershell
python manage.py migrate
python manage.py seed_demo_jobs
python manage.py seed_maya
python manage.py makemigrations --check --dry-run
python manage.py test
python manage.py runserver
```

Open http://127.0.0.1:8000/api/health/ to check the API and http://127.0.0.1:8000/api/docs/ for the API documentation. `seed_maya` creates a **normal demo freelancer**, not an administrator. To create a separate admin login, run `python manage.py createsuperuser` in another backend terminal.

### Terminal 2: React web app

At the project root (the folder containing `package.json`):

```powershell
npm install
npm run build
npm run dev
```

Open http://localhost:5173/. The web app expects Django at `http://127.0.0.1:8000` unless you create a root `.env.local` with `VITE_API_BASE_URL=https://your-api-host` (configure this **before** building React).

## Important: upgrading an existing WorkPassport database

**Back up your old `backend/db.sqlite3` and `backend/private_uploads/` first.** Keep your old project folder; extract this as a separate project. Copy the backed-up database and private files into the new backend folder if you need old accounts/data, with servers stopped.

Then run:

```powershell
python manage.py migrate
python manage.py seed_demo_jobs
python manage.py migrate_legacy_workspace
python manage.py migrate_legacy_workspace --apply
python manage.py makemigrations --check --dry-run
python manage.py test
```

The first `migrate_legacy_workspace` command is a preview. Only the command with `--apply` copies compatible old browser/workspace records into dedicated tables. The importer is designed to be repeatable and **does not delete the old JSON records**. It never upgrades an old self-declared skill badge to an independently verified credential. Some old data may need manual review, especially photos and incomplete project history.

Do **not** run the importer against valuable production data without a backup and a staging test. If you just want fresh demo accounts, skip it.

## What is implemented

- JWT registration/login, refresh, logout, password reset, email confirmation request, account data export/deletion, session revocation and role checks.
- Rich Passport profile, skills, training, work sample links, user-added proof and separate verification levels; staff issues third-party verification in Django admin.
- Published job listings, search/category/skill/budget/beginner filters, client job submission/review, saved jobs, applications and applicant access controls.
- Existing fictional FirstWork listings now use backend practice applications, sample conversations and simulated Workroom milestones; the practice steps are labelled as simulated.
- Real client-owned shared conversations, mute/block enforcement, accepted-application workrooms and role-controlled milestone transitions (money still simulated).
- WorkShield rule checks, private Evidence Vault, private work-sample images, safety reports, Bring an Opportunity moderation, SkillBridge insights and institution summaries.
- Safety preferences, quiet hours, trusted contact records, check-ins, locally stored reminders when scheduled, in-app notifications, staff moderation history and shareable professional-only Passport previews.
- Old workspace JSON retained only as a **legacy import source** and for limited drafts/device preferences in the current UI; do not use it as an authoritative record for jobs, earnings or verifications.

The existing Chrome extension in `extension/` is preserved from the input. The extension still uses its own local checks and has no Django pairing or sync yet.

## Testing and operational notes

The ZIP includes backend tests and a GitHub Actions workflow (`.github/workflows/checks.yml`) that runs the Django tests, migration consistency check and React production build on future commits. You should still manually test both a freelancer and client account, Maya mode, jobs, Passport, messaging, safety, permissions and 380px mobile layout before deployment. **Do not rehost the frontend alone: deploy the matching Django backend, run its migrations and set `VITE_API_BASE_URL` first.**

**Email:** in development Django prints reset/verification links to the backend terminal. Real outbound emails require SMTP settings (`EMAIL_BACKEND`, `EMAIL_HOST`, credentials, etc.). Do not imply delivery works before configuring it.

**Private image storage:** local proof uploads live under `backend/private_uploads/`, which is not a public static folder. For hosts with ephemeral storage, configure a private S3-compatible bucket using `PRIVATE_S3_BUCKET_NAME`, credentials and endpoint variables. Review bucket access and backups before using real images.

**Safety check-ins:** run `python manage.py process_checkins` on a schedule (for example cron every minute) for in-app overdue reminders. It does not call or message police, emergency services or trusted contacts.

**Deployment:** the optional `render.yaml` configures a Python web service, but it does not provision a database or email/storage services for you. Use PostgreSQL via `DATABASE_URL`, `DJANGO_DEBUG=false`, strong secret, correct allowed host/CORS settings, HTTPS, private uploads, scheduled check-in job and real email transport. Keep API URLs and secrets out of browser source and Git. A managed free service may sleep, so rehearse under the final venue's network conditions.

See `BACKEND_FEATURES.md`, `PROJECT_STRUCTURE.md` and `backend/README.md` for details.


## Email and free hosting

See [EMAIL_AND_FREE_DEPLOY.md](EMAIL_AND_FREE_DEPLOY.md) for Brevo HTTPS password-reset email configuration, the optional free hosting stack, and production security caveats. Password show/hide controls are included in this revision.


## Final integration handoff

Read [`FINAL_RELEASE_CHECKLIST.md`](FINAL_RELEASE_CHECKLIST.md) for new extension pairing, private external-job bookmarks, employer workflow, scam-model status, Chrome Load unpacked steps, and the exact Windows testing commands. The extension lives in its own `extension/` folder and is **not** prepublished. The bundled AI baseline is synthetic and unvalidated; see [`MODEL_DATASET.md`](MODEL_DATASET.md) for published-data training instructions and limitations.
