# Verification notes for this handoff

This handoff is a **code-level completion**, not an independently proven production deployment. The user will run the complete test suite and browser workflows on their Windows machine.

## Checks completed here

- All Django Python source and migrations compiled without Python syntax errors (`python -m compileall`).
- All 68 JavaScript/JSX files parsed with a local Babel parser; no missing relative imports reported.
- Seven `extension/` files matched their SHA-256 hashes against the original full-backend ZIP, with no changes.
- Complete project was archived, extracted and ZIP integrity checked.

## Checks not completed here

- Django tests, `manage.py makemigrations --check`, database migrations and `npm run build` could not be run in this offline environment because required Django/Node packages were not installed. These **must** be run locally before rehosting.
- No full real browser interaction tests or live penetration tests were performed.

## Required checks after extracting

1. Back up any previous SQLite database and private uploads. Copy `backend/.env.example` to `.env`, set private settings and install packages.
2. Run `python manage.py migrate`, `python manage.py makemigrations --check --dry-run`, `python manage.py seed_demo_jobs`, `python manage.py seed_maya`, `python manage.py test`.
3. For upgrading real existing records, preview `python manage.py migrate_legacy_workspace`, then run with `--apply` only on backed-up data and review imported records.
4. Run `npm install`, `npm run build`, `npm run dev`.
5. Test the complete freelancer, client and Maya journeys, account isolation, real/simulated status labels and mobile layouts.
6. Configure production PostgreSQL, allowed hosts, CORS, HTTPS, storage, SMTP and scheduled reminder execution before considering public deployment.

## Not implemented by design

Chrome extension Django integration, real payment transfer/escrow, real third-party client verification, automatic emergency communications, external moderation responses, and WebSocket chat. Demo money and check-ins must remain clearly labelled.
