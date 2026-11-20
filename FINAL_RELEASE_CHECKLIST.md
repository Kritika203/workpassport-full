# WorkPassport — final integration candidate (19 November 2026)

This is a **source-code handoff for local and deployment verification**, not a certification of a secure production system. Keep the last working ZIP and SQLite database until you have verified this build. Do not publish passwords, API keys or personal evidence in Git.

## What's included

- Existing warm, responsive React WorkPassport screens with both English and Nepali translations, including updated signup, login, forgot-password and show/hide password controls.
- Django REST API: user/client accounts, JWT sessions, profiles, skills and skill verification, training, proof, external bookmarks, moderated jobs, applications, private chat, Workrooms with *simulated* payment milestones, SkillBridge, safety tools, check-ins, staff reports, public Passport links, and staff-only reviews.
- **Employer-side:** owned pending/published jobs, application shortlist/accept/reject, shared application chat and role-controlled workrooms. New employer jobs do not show imaginary applicants or appear public before approval.
- Standalone `extension/` for Chrome/Edge Manifest V3. It reads selected text only when requested. The optional one-time pairing code gives the extension a 30-day revocable credential (not a user password or web JWT). A paired extension syncs opted-in checks, evidence and external job bookmarks to its owner's private account. The web app displays the synced external bookmarks separately from vetted FirstWork listings. The extension learns the correct deployed **website** URL from the paired backend instead of always opening localhost.
- Experimental WorkShield text model + explainable rules. The bundled baseline is synthetic and unvalidated. The **reproducible** training pipeline for a published labeled smishing dataset is provided separately; running it requires real data access and scikit-learn.

## Local setup (Windows / PowerShell)

From the project root, open two terminals.

**Terminal 1**:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env`. Set `DJANGO_DEBUG=true`, a unique `DJANGO_SECRET_KEY`, and `DEMO_MAYA_PASSWORD` with at least 12 characters. If preserving the previous SQLite database, copy its `db.sqlite3` into this new `backend/` **while Django is stopped**, after taking a backup. Then:

```powershell
python manage.py migrate
python manage.py makemigrations --check --dry-run
python manage.py test --verbosity 2
python manage.py seed_demo_jobs
python manage.py seed_maya
python manage.py runserver
```

**Terminal 2**, from the project root:

```powershell
npm ci
npm run build
npm run dev
```

Open `http://localhost:5173/`, and check `http://127.0.0.1:8000/api/health/`.

## Extension pairing and manual smoke test

1. Sign into a *real freelancer account* on WorkPassport. Visit **Extension** and generate a one-time pairing code. Copy the displayed **API address** (local is `http://127.0.0.1:8000`).
2. Go to `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose the standalone `extension` folder. This does not upload the extension to the Chrome Web Store.
3. In the WorkShield popup, expand **Connect WorkPassport account**, paste the API address and code, and approve Chrome's permission request for that API origin.
4. On a webpage, select text manually, click the extension's **Use selected text** / **Check**, and confirm the result appears in your website's private WorkShield history. An unpaired/offline extension uses local rules.
5. Check a suspicious message; choose **Save as proof**. Confirm the record appears in the website's private Evidence Vault. The extension maintains an additional local copy; removing that copy does **not** delete server evidence.
6. On the Job tools tab, choose **Save this job** and then open **My Opportunities → Links saved from the extension** in the web app. Those external bookmarks are private and **not verified job listings**.
7. Disconnect the browser **on the website** to revoke access. Confirm further extension sync gets an authorization error. The popup's local Disconnect removes its stored token but cannot retroactively revoke an already issued server token; revoke on the website to finish.
8. Try the same steps with a second user and confirm they cannot see each other's evidence, bookmarks or paired devices.

The website's Extension page also contains an **onsite practice simulation** for a hackathon demo. It is a separate demonstration of what the extension does, and should never be represented as live browser scanning.

## User + employer test flow

Create Freelancer A and Client B. Client B posts a job (it must be pending). A separate **staff** account approves it in Django admin. Freelancer A applies; Client B sees the application, sends a real message, shortlists or accepts it, and creates a milestone. Marking funding/release shows **simulated** states only. Test that an unrelated account cannot see or edit these objects. Verify records survive sign-out, refresh and logging in on a different browser.

## Password reset and real email

Development defaults to **printing reset emails in the Django terminal**. For public email delivery, verify a sender with an email provider, set `BREVO_API_KEY`, `DEFAULT_FROM_EMAIL`, `WEB_FRONTEND_URL` and `BACKEND_PUBLIC_URL`, and make sure `EMAIL_BACKEND` is not set to the console backend. Brevo's HTTPS API can work where SMTP is blocked. Test actual receipt, expiration, reused tokens, non-existent email responses, and reset link opening the correct frontend host. Email verification support is in the backend, but confirm its enforcement in your intended signup flow before claiming verified users.

## Model and bilingual limitations

`MODEL_DATASET.md` documents the pinned published SMS dataset, its licences, train/validation/test splits, domain limitations and optional older recruitment scam dataset. **The public-data-trained model is not bundled here** because its raw dataset could not be fetched in the build environment. The shipped synthetic fallback must remain labelled experimental. Training it on a real dataset (and inspecting held-out precision/recall/F1) is an **additional step**, not just a browser test. Do not claim a validated Nepali or code-mixed scam detector. WorkShield checks warn; they do not certify safety. The English and Nepali translation dictionaries have matching keys, but a native speaker should review wording and all dynamic messages.

## Deployment and security checks

- Use Django + PostgreSQL (set `DATABASE_URL`) and a separate React hosting service. Configure `VITE_API_BASE_URL` at **frontend build time**, and configure backend `WEB_FRONTEND_URL`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `DJANGO_DEBUG=false`, `DJANGO_HTTPS_ONLY=true`, and a strong new `DJANGO_SECRET_KEY`.
- Store sensitive photos/evidence in *private persistent object storage* (`PRIVATE_S3_BUCKET_NAME` and provider credentials). Free hosts with ephemeral disks will lose local private uploads on restart. Check access control and deletion behaviour with another user account.
- Turn on staff protections, rotate test passwords, disable or limit public Maya demo sessions, and review storage-retention and moderation procedures before real-user collection.
- Review `npm audit` and `npm audit --omit=dev` output. Don't blindly force major dependency upgrades. Confirm SSL, backups, fail-safe error handling, website CSP and rate limiting under realistic traffic.
- Payments are only simulated. Check-ins do not alert police or trusted contacts automatically. There is no independently validated scam-detection guarantee.

## Automated checks and remaining uncertainty

The build system in the current code-generation environment has no Django packages or Linux Rollup native dependencies installed and network package installation is blocked. The Python AST and JavaScript/JSX Babel parsing/import checks passed, as did extension element-ID matching and a disposable training-pipeline smoke check. **Django's full test suite, migration check, npm production build and full browser flows for this new revision remain for the recipient's local environment.** The earlier 26 passing Django tests and successful Vite build were for the pre-extension revision and must not be reported as a fresh pass for this ZIP.
