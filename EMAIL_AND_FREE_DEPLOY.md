# WorkPassport: password email + free hosting (November 2026)

This revision keeps the same frontend and backend features. Changes: show/hide password controls, optional Brevo HTTPS transactional email delivery, one-hour password reset links, and migration 0006 included in source. Chrome extension is unchanged and unconnected.

## Local email test without an external provider

The backend defaults to `django.core.mail.backends.console.EmailBackend` when `DJANGO_DEBUG=true` and no `BREVO_API_KEY` is configured. In WorkPassport, select **Log in → Forgot password**, and enter the email for a registered account. Django prints the reset URL in the **backend terminal**. Open it to set a new password. This is *not* email delivery to the user's inbox.

## Deliver a real reset email (works on free Render hosting)

Render Free blocks outbound SMTP on ports 25, 465 and 587. This version therefore supports Brevo's **HTTPS transactional email API** without using those ports.

1. Create a Brevo account and complete any required account/sender verification. Use a verified sender address or domain in Brevo. Brevo Free currently advertises up to 300 emails/day, subject to provider limits and approval.
2. Obtain a Brevo API key. Never put the key into React, Vite, Git or any public repo.
3. Set these **backend-only** variables (`.env` locally; Environment in Render):

   ```dotenv
   BREVO_API_KEY=YOUR_PRIVATE_BREVO_API_KEY
   DEFAULT_FROM_EMAIL=WorkPassport <your-verified-sender@example.com>
   WEB_FRONTEND_URL=https://your-frontend-domain.example
   BACKEND_PUBLIC_URL=https://your-backend-domain.example
   ```

4. Remove any `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend` line from the backend `.env` when using Brevo; the backend automatically selects the Brevo API backend when `BREVO_API_KEY` exists. Or explicitly set:

   ```dotenv
   EMAIL_BACKEND=accounts.email_backend.BrevoAPIEmailBackend
   ```

5. Restart Django. Request a reset link from the login screen. It should arrive in the user's registered inbox, not appear as an actual link on the webpage. Links expire after one hour. Also test an unregistered email and an expired/reused token. Backend responses intentionally do not reveal whether an email exists.
6. Email verification also uses Django's `send_mail` and uses the same provider when requested via its API endpoint. Existing signup does **not** require email verification before login; enforcing that would require an additional product decision.

A real provider is necessary. This source ZIP does not include a Brevo account, sender approval, API key or live email delivery test.

## Free deployment proposal

- **Frontend:** keep the current Vercel deployment if usage qualifies as personal/non-commercial Hobby usage; otherwise consider Cloudflare Pages Free for the React static frontend.
- **Django backend:** Render Free web service. The included `render.yaml` uses `plan: free`. Free services spin down after approximately 15 minutes of inactivity and can take time to start. This is risky for a live judge demonstration.
- **Database:** Neon Free Postgres. Create a project and copy its PostgreSQL connection string into backend `DATABASE_URL`. **Never use SQLite** on Render's ephemeral disk for persistent public user data.
- **Email:** Brevo HTTPS API (`BREVO_API_KEY` and verified `DEFAULT_FROM_EMAIL`). Do not use SMTP on Render Free.
- **Evidence photos:** the default local private upload directory is lost on Render restarts/redeploys. Configure private S3-compatible object storage for production, or disable sensitive uploads until storage is ready. Keep bucket objects private; do not enable public read.

### Deployment checklist

1. Commit the `workpassport` code *without* `.env`, `db.sqlite3`, `.venv`, private files, or `node_modules`.
2. Create Neon Postgres, copy the database URL privately.
3. Create Render Python web service using root `backend` (if repository root is `workpassport`). Build: `pip install -r requirements.txt && python manage.py collectstatic --noinput`. Start: `python manage.py migrate && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`.
4. Render backend env vars: `DJANGO_DEBUG=false`, secure `DJANGO_SECRET_KEY`, `DJANGO_HTTPS_ONLY=true`, `DATABASE_URL`, `DJANGO_ALLOWED_HOSTS=<render-hostname>`, `CORS_ALLOWED_ORIGINS=<frontend https origin>`, `WEB_FRONTEND_URL`, `BACKEND_PUBLIC_URL`, `BREVO_API_KEY`, `DEFAULT_FROM_EMAIL`. Do not put trailing slashes in CORS origins.
5. Set frontend build variable `VITE_API_BASE_URL=https://<render-hostname>` and redeploy the frontend. Build command `npm run build`, output directory `dist`.
6. Run seed commands *once* against the live database if desired. Maya is **not** a superuser. Public demos should use isolated temporary demo sessions, not a shared private Maya password.
7. Test actual password reset email, signup/login, 2-user conversations, permissions, public Passport and private proof storage from two different devices before advertising the live URL.

## Security already in source vs. deployment work

**Implemented in code:** Django's hashed passwords and validation, short-lived JWT access tokens, rotated/blacklisted refresh tokens, authorization by role and object, job approval controls, per-account data isolation, rate limiting, private API endpoints, reset/verification tokens, file size/type checks, staff audit logging and private profile/share scope.

**Needs deployment verification:** email provider/sender, HTTPS and secret keys, database persistence/backups, robust rate limits across web workers (Django cache-backed throttling defaults may not be shared between instances), safe file storage, logging/monitoring, CORS configuration and abuse checks. JWTs are stored in `sessionStorage`, so frontend XSS prevention is still important. Payment status is simulated and check-ins do not automatically notify emergency services.

## Local verification after extracting this ZIP

Backend (with `.venv` active):

```powershell
python manage.py migrate
python manage.py makemigrations --check --dry-run
python manage.py test --verbosity 2
python manage.py runserver
```

Frontend (in another terminal, project root):

```powershell
npm install
npm run build
npm run dev
```

Then check the eye buttons on login password, signup password/confirmation and new/confirm password reset screens. Password characters must be masked initially; clicking the eye should reveal them and clicking again must hide them without erasing what was typed.
