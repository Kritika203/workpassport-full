# Vouch — UI polish and feature readiness audit

Date: 23 Nov 2026. Scope: shared React frontend styling and navigation; **no backend, database-migration or Chrome-extension logic changed** in this update.

## Requested UI changes

- `vouch.` is the top-left application brand on employee and employer pages; the separate **My WorkPassport** feature retains its name.
- Secondary links previously in **More** (Payments, SkillBridge, Extension; employer job posting) are now in the account dropdown. Primary header remains compact. Employers retain the dashboard's job-posting flow.
- Headers throughout the app blend with the reference's white / sage gradient and have no horizontal dividing rule. Active navigation uses a quiet tint instead of an underline.
- FirstWork no longer displays **Posting a job?** or **Share an opportunity** links. Job search, sorting, filtering, applications and saving remain accessible.
- Help Me is a compact floating `?`; the same chatbot remains available when clicked.
- Shared palette: dark green `#003D14`, accent `#0E5C2A`, light green `#E7F0E9`, pale surface `#F7F7F4`, white `#FFFFFF`, muted grey `#687169` and borders `#E3E6E1`. Red remains red for fraud, danger, errors and disputes.
- Dropdowns receive matching base styling. On browsers that support customizable `select` controls, option menus also use the theme; other browsers retain native accessible menus. Keyboard focus remains visible.
- My WorkPassport overview and skill-evidence containers now use roomy rounded cards and calm tinting, without removing CV upload, evidence management or export controls.

## Feature readiness (source review, not a security certification)

| Capability | Current implementation | Production caveat / next gate |
| --- | --- | --- |
| Signup, login, account roles, sessions, reset | Django endpoints exist, covered by backend tests | Verify live email delivery and session security before general launch |
| Maya freelancer demo and Bikash employer demo | Landing demo handlers are connected | Check both interactions manually, and rate-limit public demo identities |
| FirstWork search, filters, applications, saved jobs | Connected to server endpoints and tested core permissions | Populate with properly moderated legitimate jobs; test realistic job submission |
| Moderation and staff override | Criteria screening and staff review/audit supported | Automated approval **does not certify** that an employer is legitimate |
| My WorkPassport, CV import, proof levels, public view, PDF | Features and server routes exist | Check private file storage, proof verification and cross-account access |
| WorkShield + browser extension | Advisory checks; extension pairing/revocation supported | Models are not independently validated; verify the **latest extension build** |
| Workroom milestones, document upload, discussions | Connected permissions and milestone backend tests | Payments/funding are not escrow; upload sizes and formats are restricted |
| DirectPay payment records | Provider methods and payment record/receipt/dispute workflows | No verified end-to-end live money movement; do not claim a gateway integration |
| Community and anonymous job feedback | **Local browser demo only** | Server storage, per-user eligibility, abuse moderation, anonymity protections and appeals not implemented |
| Negotiation | Worker proposed amount can enter application | Employer counter-offer controls are **local demo only**; no signed counter-offer lifecycle |
| Voice typing | Browser SpeechRecognition opt-in | Browser/device/service dependent; not the voicetypingnepali.com API |
| Text translation | Django opt-in LibreTranslate-compatible endpoint | Requires configured HTTPS provider; without it translation returns 503 |
| WhatsApp / Messenger | Optional external link + exit warning | No WhatsApp bot; external conversations cannot be monitored/recovered |
| Help Me | Grounded application guidance API with optional hosted AI | Hosted AI requires an endpoint/key; default local guide is deterministic |
| Low-data / larger text | UI simplification and accessibility preferences | Not a verified network bandwidth limiter |
| Brevo transactional email | Backend integration code | Requires configured API key, verified sender and receipt tests |

## Verification requirements

- `node scripts/verify-ui-contracts.mjs` checks the critical UI/navigation source wiring. This is **not** a browser test.
- GitHub Actions runs the React production build and Django tests for the staging branch; confirm passing checks before releasing to `main`.
- After Render deploys, verify frontend and backend both point to the same new commit. Open both demos, apply and review using two different accounts, confirm uploaded file permissions, and exercise WorkShield/extension on desktop. Test mobile layouts and native-select fallbacks.
- Before a public-user launch: implement server-backed community/feedback and counter-offers; confirm real email and payment status; persistent private object storage, security/rate limits and moderation escalation.
