# WorkPassport Django API

Run the commands in the project-root README first. **Use an environment-only password** for Maya. Her seeded identity is a normal account; Django admin access is a separate `python manage.py createsuperuser` operation.

## Key routes

| Route | Purpose |
| --- | --- |
| `POST /api/auth/register/` | Create freelancer or client |
| `POST /api/auth/login/` | JWT login |
| `POST /api/auth/refresh/` | Refresh access token |
| `POST /api/auth/logout/` | Blacklist refresh token |
| `GET/PATCH /api/auth/me/` | User profile |
| `POST /api/auth/demo-session/` | New isolated Maya demo account (opt-in; rate limited) |
| `GET/PATCH /api/auth/workspace/` | Read/update per-account UI state (allowlisted keys) |
| `GET/POST /api/auth/reports/` | Current user's safety reports |
| `/api/auth/me/skills/` | Normalized skills CRUD |
| `/api/auth/me/work-samples/` | Work sample links CRUD |
| `GET /api/jobs/` | Only published jobs |
| `POST/DELETE /api/jobs/<id>/save/` | Freelancer saved jobs |
| `POST /api/jobs/<id>/apply/` | Freelancer application |
| `GET /api/me/saved-jobs/` | Freelancer's saved jobs |
| `GET /api/me/applications/` | Freelancer's applications |
| `GET/POST /api/client/jobs/` | Client-owned jobs, new jobs pending review |
| `GET/PATCH /api/client/applications/` | Client-owned applications and status updates |
| `GET /api/health/` | Server readiness |

API requires `Authorization: Bearer <access_token>` except registration, login, demo session and public jobs. There is per-user authorization and throttling. Workspace JSON updates are size-limited and filtered to known keys. A client cannot approve or verify their own job.

### Database and migrations

```powershell
python manage.py migrate
python manage.py seed_demo_jobs
python manage.py seed_maya
python manage.py test
python manage.py makemigrations --check --dry-run
```

`seed_maya` uses `DEMO_MAYA_PASSWORD` from `backend/.env` and does **not** grant staff or superuser status. Use `createsuperuser` separately for an administrator. Sample jobs are fictional and are not payment-verified. `demo-session` clones Maya's profile into an isolated user for each demo visit; it never hands out Maya's seeded credentials.

### Prototype limits

The React UI retains the feature-rich demo. The `workflows` app adds separate models for real client-owned application conversations, milestone states (always simulated), checks, evidence, proof, safety preferences and notifications. Some drafts and UI settings still use per-user `WorkspaceState` JSON. Reports are saved to Django but need an administrator to review them; no third party receives them automatically. Browser PIN and Quick Hide are interface demonstrations, **not** secure access control. Do not put real private evidence in the prototype.

## Workflows API

The `workflows` app adds models for WorkShield checks, Evidence Vault, Bring an Opportunity review, client messaging, Workroom milestones, private proof, account notifications, check-ins, and safe public Passport sharing. Apply all `workflows` migrations with `python manage.py migrate`, then run `python manage.py test`. See `../BACKEND_FEATURES.md` for endpoints and limitations.
