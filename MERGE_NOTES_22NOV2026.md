# WorkPassport combined release — 22 November 2026

## Source of truth

- Base: `WorkPassport_FULL_AllFeatures.zip`, folder `workpassport-full/`.
- Preserve all newer employer-side workflows, invitations, explore, shortlist, client dashboard, migrations 0003/0004, and their data models.
- **Extension:** unchanged from this source ZIP, including offline OCR libraries, trained data, and `CHANGELOG_v2.2.md`. Do not replace it with the older extension.
- Earlier `she-equal-main.zip` was only a conceptual reference for the Apply flow. Its original app and extension were **not** copied into this release.

## Added and merged

- Floating conversational Help Me assistant, including a bounded server-side optional AI endpoint and grounded fallback guidance; `src/components/common/HelpMe.jsx`, `backend/accounts/help_views.py`.
- Shorter freelancer profile setup; `src/pages/Onboarding.jsx`.
- PDF/DOCX CV extraction and review-before-save in Passport, with backend upload validation; `src/components/passport/CVImport.jsx`, `backend/accounts/cv_views.py`.
- Employer and employee connected messages with browser voice-to-text, optional external translation, original-message display, and explicit WhatsApp/Messenger exit warning; `src/connected/ConnectedConversation.jsx`, `backend/accounts/translation_views.py`.
- Existing account URLs preserved with 3 routes added (`passport/import-cv/`, `translate/`, `help-chat/`); `backend/accounts/urls.py`.
- Dependencies `pypdf`, `python-docx` appended to `backend/requirements.txt`.
- Optional environment variable examples appended to `backend/.env.example`.
- Translation adjustment: preserve original sent messages; machine translation is an optional preview; the viewer can select the original language when translating an incoming message.
- Original database migrations kept unchanged to avoid migration-number conflicts. No additional migrations necessary for these features.

## Limits and required configuration

- Help Me has a built-in guide fallback. Generative AI works only after setting `WP_HELP_AI_ENDPOINT`, `WP_HELP_AI_KEY`, and `WP_HELP_AI_MODEL` on the server. Never include keys in Vite variables.
- Translation requires a private or approved HTTPS LibreTranslate-compatible endpoint (`WP_TRANSLATE_ENDPOINT`, optional `WP_TRANSLATE_API_KEY`). It is not enabled by default. Do not send sensitive messages to random public APIs.
- Voice transcription depends on browser support, permissions, HTTPS, and supported speech recognition. Voice transcription may be processed by the browser vendor; check privacy expectations.
- External WhatsApp/Messenger buttons open another platform **after a warning**, without syncing messages, phone numbers, or evidence. WorkPassport cannot guarantee external conversations.
- CV importer supports selectable text in PDF/DOCX, not scanned PDF OCR; extracted information is unverified and requires user review. Uploaded file is processed in memory.
- The actual hosted database must be migrated and checked separately. Existing problematic job records require database-specific cleanup; this package does not silently delete live records.

## Validation performed here

- Python source compilation (syntax) passed.
- Existing archive integrity and extension-file hashes verified.
- Full `npm run build` **NOT VERIFIED**: npm dependency installation was incomplete in this runtime. Django test suite **NOT VERIFIED**: Django was not installed. These cannot be described as passing.

## Required local / hosting checks

1. From project root: `npm ci && npm run build`.
2. Backend: create an environment, `pip install -r backend/requirements.txt`, `python backend/manage.py check`, `python backend/manage.py migrate`, `python backend/manage.py test`.
3. Configure **backend** secrets in Render and Vite API URL in frontend host; deploy frontend and backend separately per README/render.yaml.
4. Test real account login, Maya, job list, Apply → submit → Applications, employer posting → invite → shortlist → acceptance, Chat/Workroom, translated and original text, voice permission, CV import, Help Me, language switching, WhatsApp/Messenger warning, and extension pairing/OCR.
5. Verify real production DB does not show old test/gibberish/scam records before public demo.
6. Never commit real `.env` files or credentials.

This is a merged source release, **not** a certified end-to-end tested deployment.
