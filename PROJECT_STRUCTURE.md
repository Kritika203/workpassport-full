# WorkPassport project structure

- `src/` — React/Vite web app, separated into pages, components, data, hooks, APIs, i18n and connected account screens.
- `backend/accounts/` — account roles, rich profiles, skills, training, skill verification, personal data and account recovery.
- `backend/opportunities/` — published/seeded jobs, client moderation, saved jobs, applications and filtering.
- `backend/workflows/` — rule-based safety checks, evidence, images, messaging, workrooms, milestone status, SkillBridge, reviews, check-ins, notifications and public Passport previews.
- `backend/accounts/management/commands/migrate_legacy_workspace.py` — optional idempotent data-copy tool for older per-user JSON workspaces (preview first).
- `backend/workflows/management/commands/process_checkins.py` — in-app overdue check-in reminders, run by a scheduler.
- `backend/opportunities/management/commands/seed_demo_jobs.py` — explicitly fictional jobs owned by a disabled sample client account.
- `backend/accounts/management/commands/seed_maya.py` — ordinary Maya demo credentials from private `.env`, not admin access.
- `backend/config/` — settings, Django URL routes, WSGI/ASGI entry points.
- `.github/workflows/checks.yml` — tests, migration consistency and frontend build on push.
- `render.yaml` — optional backend deployment blueprint; requires external secrets and PostgreSQL.
- `extension/` — preserved Manifest V3 extension; backend integration deferred.

The current account screens use normalized Django data for business records. Old workspace JSON is retained for legacy migration and limited drafts/UI settings; it should not be relied upon to assert independent skill verification or genuine payments. The same screens are used by seeded Maya and registered freelancers. All job and practice workflows carry real/simulated distinctions.
