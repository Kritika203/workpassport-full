# Vouch Prototype — November 23, 2026

## Base and compatibility

This deliverable is built from the **WorkPassport_FULL_WithDirectPay.zip** source available in this conversation. The later redesigned local ZIP was not attached in this turn. The original Chrome extension directory remains byte-identical to that base; its existing branding has **not** been changed. The backend framework, authentication, DirectPay, WorkShield and other original functionality remain in place. The zip includes both frontend and backend, with `/workpassport-full` as its root.

## Implemented

1. **Vouch branding and responsive minimal landing/auth**: soft sage **colored header**, cream/white surfaces, calm serif headings, no portraits or houseplants; `Continue Demo` stays below the main CTA. Signup retains real username/name/email/password/role logic.
2. **Women-first community preview** under Community for workers and employers. Includes useful safety topics, demo example posts clearly marked as examples, selectable anonymity, typed or dictated text. Posts save in browser localStorage only. They are not shared publicly or moderated online.
3. **Worker feedback for each job**: link from job detail and employer posted jobs; text, experience category, anonymous/name choice, and only enabled for workers whose job is marked completed by the existing Workroom flow. The feedback is **local demo data**, not a live public review service. Server-enforced eligibility, moderating reports, appeals, anonymity and storage would be necessary before public launch.
4. **Job skill-gap PDF download**: compares the job's required skills with self-reported user skills, includes missing skills and learning-resource starting points (YouTube search, freeCodeCamp, MDN, Canva Design School where relevant). Generated without external PDF APIs. URLs are printed in the file; learning content is not individually vetted.
5. **Negotiation UI**: the application captures a proposed amount and reason; this is included in the real application's message and proposed rate. Employer client inbox and demo-applicant screens have expandable local counter-offer controls. Counter-offer controls are local-only and **do not** change the signed agreement or sync across devices. Confirm binding terms in existing chat/agreement.
6. **Nepali/English voice field**: microphone dictation via the browser `SpeechRecognition`/`webkitSpeechRecognition` API. Users can edit the recognized text before posting. Browser support, permission and availability vary. **voicetypingnepali.com does not have a verified public API**: linked as an optional external alternative, *not* embedded as an API. Do not imply voice recordings are processed locally; browser services may use remote recognition.
7. **Low-data / bigger text** toggle across worker and client top navigation. Disables animations/shadows/backdrops and enlarges text and input targets. This is a visual accessibility mode; it is not a verified network-level bandwidth cap.
8. **Criteria-based job moderation reintroduced** on the DirectPay backend: basic completeness, scam phrase checks, duplicate review and staff hold paths. Automatic publication does **not** mean a job is independently verified. Admin may approve, suspend, reject, restore, with reason and event audit. `0005_vouch_job_moderation.py` migration included; this is not an ML moderation system.
9. **No WhatsApp bot** has been added. Existing optional external WhatsApp/Messenger links and warnings from the prior project remain. Chrome extension is unchanged.

## Not done / limitations

- Community and feedback are not live multiuser services. Anonymous posting is only a browser demo, not an enforceable public privacy guarantee.
- Negotiation counter-offers are not backed by API state or real marketplace escrow. The real application proposal amount and reason do reach the backend when connected.
- The website voicetypingnepali.com has not been integrated with an undocumented API. Speech recognition is browser-based.
- Local storage is unsuitable for confidential information. Avoid sharing sensitive details in demo posts.
- No real automated payments or guaranteed jobs; DirectPay remains external-transfers-plus-records.
- The newest standalone UI ZIP and a completed different extension were not available as a mounted archive in this turn, so this is based on the available DirectPay source. The Chrome extension is not renamed to Vouch.
- Full Django integration tests and Vite production build could not be run in this environment because dependencies are not installed/cannot be fetched. Verify before deploying.
- When upgrading a database that already applied a *different* migration numbered `0005` for opportunities, **do not simply overwrite files**. Reconcile migration history first. Fresh local SQLite testing is the safer route.

## Local run (Windows PowerShell)

1. Extract ZIP; open `workpassport-full` in VS Code.
2. Backend: `cd backend` → `py -m venv .venv` → `.\\.venv\\Scripts\\Activate.ps1` → `pip install -r requirements.txt` → `Copy-Item .env.example .env` → edit `.env` → `python manage.py migrate` → `python manage.py seed_demo_jobs` → `python manage.py seed_maya` → `python manage.py test` → `python manage.py runserver`.
3. Frontend (new terminal in `workpassport-full`): `Copy-Item .env.example .env` → configure `VITE_API_BASE_URL=http://127.0.0.1:8000` → `npm ci` → `npm run build` → `npm run dev`.
4. Browse `http://localhost:5173/` and test Maya Demo and employer demo separately. Example login is seeded from your `.env`; don't share credentials.
5. Manual smoke test: landing > signup/login > Maya > job detail > PDF roadmap > apply with counteroffer > employer applicants > Community > local anonymous feedback after completing a demo Workroom > Low data toggle > return to standard view.

If the build fails, send the **first** build error before applying other changes.
