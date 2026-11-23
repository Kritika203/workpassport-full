// Lightweight source-level guardrails for the Vouch hackathon prototype.
// These do not replace browser testing, Django permission tests or security review.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const get=file=>fs.readFileSync(path.join(root,file),'utf8');
const app=get('src/App.jsx');
const head=get('src/components/layout/ShellHeader.jsx');
const first=get('src/pages/FirstWork.jsx');
const passport=get('src/pages/Passport.jsx');
const help=get('src/components/common/HelpMe.jsx');
const landing=get('src/components/landing/VouchLanding.jsx');
const auth=get('src/connected/ConnectedAuth.jsx');
const community=get('src/pages/VouchCommunity.jsx');
const voice=get('src/components/common/VoiceField.jsx');
const pol=get('src/VouchPolish.css');
const test=(name,okay)=>{assert.ok(okay,name); console.log('✓ '+name);};

test('Vouch remains the application brand',head.includes('aria-label="Vouch home"')&&head.includes('vouch-shell-dot'));
test('WorkPassport remains a distinct user feature',head.includes("passport: 'My WorkPassport'"));
test('Account menu contains secondary app tools',head.includes("onClick={() => navigate('payments')}")&&head.includes("onClick={() => navigate('ext')}")&&!head.includes('className="vouch-shell-more"'));
test('WorkShield remains a primary navigation item',head.includes("safety: 'WorkShield'"));
test('Landing exposes both real demo entry handlers',landing.includes('onDemo={onDemo}')&&landing.includes('onClient={onClient}'));
test('FirstWork keeps search, filters, saved jobs and applications',first.includes('fw-vouch-search')&&first.includes('fw-vouch-filter-panel')&&first.includes('onToggleSave')&&first.includes("navTo('opportunities')"));
test('FirstWork no longer promotes posting or contribution',!first.includes('className="fw-vouch-quiet-link"')&&!first.includes("navTo('bring')"));
test('Profile has readable overview and sectioned evidence',passport.includes('data-passport-pane="overview"')&&passport.includes('vouch-passport-skill-card')&&passport.includes('CVImport')&&passport.includes('ProofArea'));
test('Passport sections preserve direct editing and proof',passport.includes('editRequest={editRequest}')&&passport.includes('onAdd={addProof}')&&passport.includes('setView(\'public\')'));
test('Help is compact and remains functional',help.includes("'?'" )&&help.includes('/api/auth/help-chat/'));
test('Login and signup remain connected to auth endpoints',auth.includes("'/api/auth/register/'")&&auth.includes("'/api/auth/login/'")&&auth.includes('form.confirm'));
test('Community and reviews are clearly identified as local demos',community.includes('localStorage')&&community.includes('Posts are not yet shared')&&community.includes('local demo'));
test('Voice remains opt-in with typing fallback',voice.includes('SpeechRecognition')&&voice.includes('textarea'));
test('Connected job conversations and Workrooms remain routed',app.includes('<ConnectedConversation')&&app.includes('<ConnectedWorkroom')&&app.includes('<ClientInbox'));
test('Contrast palette and warning treatment remain distinct',pol.includes('#003D14')&&pol.includes('#E7F0E9')&&pol.includes('Preserve red as a semantic'));
const payments=get('src/pages/Payments.jsx');
const shield=get('src/pages/ShieldSafety.jsx');
const extension=get('src/pages/Extension.jsx');
const setup=get('src/pages/Onboarding.jsx');
test('Payments retains methods, checklist, calculator and history',payments.includes('PaymentSettings')&&payments.includes('NetPayCalculator')&&payments.includes('togglePay')&&payments.includes('flow(\'payments/\')'));
test('WorkShield tabs keep existing analyzer and evidence actions',shield.includes('data-shield-pane="check"')&&shield.includes('data-shield-pane="tools"')&&shield.includes('data-shield-pane="saved"')&&shield.includes('onAnalyze')&&shield.includes('setHistory'));
test('Extension pairing and simulation remain wired',extension.includes('ExtensionPairing')&&extension.includes('flow(\'extension/pair/\')')&&extension.includes('runCheck'));
test('Onboarding district select uses right-aligned caret',setup.includes('vouch-district-select'));
console.log('UI source contracts passed. Browser and cross-account testing remain required.');
