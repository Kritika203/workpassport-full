// App state and navigation live here.

import { Briefcase, CheckCircle2, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ChatMissing } from './components/chat/ChatMissing.jsx';
import { HelpMe } from './components/common/HelpMe.jsx';
import { Disclaimer } from './components/common/Disclaimer.jsx';
import { Toast } from './components/common/Feedback.jsx';
import { PassportShieldIcon } from './components/layout/Header.jsx';
import { ShellHeader } from './components/layout/ShellHeader.jsx';
import { LockScreen, QuickHideScreen } from './components/privacy/Privacy.jsx';
import { CLIENT_PROFILE, CLIENT_SEED_JOB, DEMO_APPLICANTS, MAYA_PROFILE } from './data/demo.js';
import { DUMMY_JOBS } from './data/jobs.js';
import { useLocalStorage, AccountStorageContext } from './hooks/useLocalStorage.js';
import { DICT } from './i18n/translations.js';
import { ApplyWizard } from './pages/Apply.jsx';
import { BringView } from './pages/Bring.jsx';
import { BringQueue } from './pages/BringQueue.jsx';
import { ChatView } from './pages/Chat.jsx';
import { ClientView } from './pages/Client.jsx';
import { ClientAgreement } from './pages/ClientAgreement.jsx';
import { ClientApplicants } from './pages/ClientApplicants.jsx';
import { ClientExplore } from './pages/ClientExplore.jsx';
import { EvidenceVaultPage } from './pages/EvidenceVault.jsx';
import { ExtensionPage } from './pages/Extension.jsx';
import { FirstWorkFeed } from './pages/FirstWork.jsx';
import { InstitutionInsight } from './pages/InstitutionInsight.jsx';
import { JobDetail } from './pages/JobDetail.jsx';
import { SetupFlow } from './pages/Onboarding.jsx';
import { MyOpportunities } from './pages/Opportunities.jsx';
import { PassportPage } from './pages/Passport.jsx';
import { PaymentsPage } from './pages/Payments.jsx';
import { ShieldSafetyPage } from './pages/ShieldSafety.jsx';
import { SkillBridgePage } from './pages/SkillBridge.jsx';
import { WorkroomView } from './pages/Workroom.jsx';
import { buildBringSeeds } from './services/bring.js';
import { makeEvidenceSeed } from './services/evidence.js';
import { QUIET_DEFAULT, normQuiet } from './services/quietHours.js';
import { isDemoUser } from './utils/profile.js';
import { readApiSession, storeApiSession, api, apiLogout } from './api/client.js';
import { ConnectedAuth } from './connected/ConnectedAuth.jsx';
import { AccountGate } from './connected/AccountGate.jsx';
import { toUiJob } from './api/jobs.js';
import { flow, flowList, toContribution } from './api/flows.js';
import { ConnectedConversation } from './connected/ConnectedConversation.jsx';
import { ConnectedWorkroom } from './connected/ConnectedWorkroom.jsx';
import { VouchLanding } from './components/landing/VouchLanding.jsx';
import { VouchCommunity, JobFeedback } from './pages/VouchCommunity.jsx';
import { ClientInbox } from './connected/ClientInbox.jsx';
import { ConnectedInstitutionInsight } from './connected/ConnectedInstitutionInsight.jsx';
import { PublicPassport } from './connected/PublicPassport.jsx';
import { PasswordReset } from './connected/PasswordReset.jsx';
import './EditorialRefinement.css';
import './VouchPolish.css';
import './VouchReferenceLayout.css';



export default function App() {
  const query = new URLSearchParams(window.location.search);
  if (query.has('reset_uid') && query.has('reset_token')) {
    return <PasswordReset uid={query.get('reset_uid')} token={query.get('reset_token')} />;
  }
  const publicToken = query.get('passport');
  if (publicToken) return <PublicPassport token={publicToken} />;
  return <><MainApp /><HelpMe /></>;
}

// Registered employers can explore published jobs without becoming freelancers.
// The public feed is intentionally read-only for a client account.
function ClientFirstWorkBrowse({ jobs, lang }) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const ne = lang === 'ne';
  const results = (Array.isArray(jobs) ? jobs : []).filter(job => {
    const text = [job.title, job.description, job.category, job.clientName,
      ...(Array.isArray(job.skillsRequired) ? job.skillsRequired : [])].join(' ').toLowerCase();
    return text.includes(search.trim().toLowerCase());
  });
  return (
    <section className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-[28px] sm:text-[30px] font-semibold">FirstWork</h1>
        <p className="mt-2 text-[#475249]">
          {ne ? 'प्रकाशित कामहरू हेर्नुहोस्। यस रोजगारदाता खाताबाट आवेदन दिन मिल्दैन।'
            : 'Browse published opportunities. This employer account cannot apply for jobs.'}
        </p>
      </header>
      <label className="block">
        <span className="sr-only">{ne ? 'काम खोज्नुहोस्' : 'Search jobs'}</span>
        <input type="search" value={search} onChange={event => setSearch(event.target.value)}
          placeholder={ne ? 'काम वा सीप खोज्नुहोस्' : 'Search jobs or skills'}
          className="w-full bg-white border border-[#E3E6E1] rounded-[14px] px-4 py-3 min-h-[48px] outline-none focus:border-[#003D14]" />
      </label>
      <p className="text-sm text-[#687169]">{results.length} {ne ? 'कामहरू' : 'published jobs'}</p>
      {results.length === 0 ? (
        <div className="rounded-[18px] border border-[#E3E6E1] bg-white p-6 text-[#687169]">
          {ne ? 'मिल्दो काम भेटिएन।' : 'No matching jobs found.'}
        </div>
      ) : results.map(job => (
        <article key={job.id} className="rounded-[20px] border border-[#E3E6E1] bg-white p-5 sm:p-6 space-y-3">
          <div className="flex flex-wrap justify-between gap-2">
            <h2 className="text-lg font-semibold">{job.title}</h2>
            {job.isDemo && <span className="rounded-full bg-[#E7F0E9] px-3 py-1 text-xs font-semibold">{ne ? 'अभ्यास काम' : 'Practice job'}</span>}
          </div>
          <p className="text-sm text-[#687169]">{job.clientName || (ne ? 'रोजगारदाता' : 'Employer')}
            {job.category ? ` · ${job.category}` : ''}</p>
          <p className="text-[#475249] whitespace-pre-wrap">{job.description || (ne ? 'विवरण उपलब्ध छैन।' : 'No description provided.')}</p>
          {Array.isArray(job.skillsRequired) && job.skillsRequired.length > 0 && (
            <div className="flex flex-wrap gap-2">{job.skillsRequired.map(skill => (
              <span key={skill} className="rounded-full bg-[#F7F7F4] px-3 py-1 text-sm">{skill}</span>
            ))}</div>
          )}
          <button type="button" onClick={() => setExpanded(old => old === job.id ? null : job.id)}
            className="text-[#AE332A] font-semibold underline underline-offset-4 min-h-[44px]">
            {expanded === job.id ? (ne ? 'कम देखाउनुहोस्' : 'Show less') : (ne ? 'कामको विवरण हेर्नुहोस्' : 'View job details')}
          </button>
          {expanded === job.id && (
            <div className="border-t border-[#E3E6E1] pt-3 space-y-2 text-sm text-[#475249]">
              {Number.isFinite(Number(job.budgetUSD)) && <p>{ne ? 'बजेट' : 'Budget'}: USD {Number(job.budgetUSD).toLocaleString()}</p>}
              {job.deadlineDays && <p>{ne ? 'समयसीमा' : 'Deadline'}: {job.deadlineDays} {ne ? 'दिन' : 'days'}</p>}
              {Array.isArray(job.deliverables) && job.deliverables.length > 0 &&
                <p>{ne ? 'अपेक्षित परिणाम' : 'Deliverables'}: {job.deliverables.map(d => (typeof d === 'string' ? d : d.name)).join(', ')}</p>}
              <p className="text-[#687169]">{ne ? 'आवेदन दिनको लागि छुट्टै फ्रीलान्सर खाता आवश्यक छ।'
                : 'Applying requires a separate freelancer account.'}</p>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

function MainApp() {
  const [apiSession, setApiSession] = useState(readApiSession);
  const [authMode, setAuthMode] = useState(null);
  const [entryError, setEntryError] = useState('');
  const onSessionChange = useCallback(next => {
    setApiSession(next);
    storeApiSession(next);
  }, []);
  const logout = async () => {
    const last = readApiSession();
    onSessionChange(null);
    if (last) await apiLogout(last);
  };
  const openDemo = async () => {
    setEntryError('');
    try {
      const tokens = await api('/api/auth/demo-session/', { method: 'POST' });
      onSessionChange(tokens);
    } catch (error) { setEntryError(error.message || 'Demo is unavailable.'); }
  };
  if (apiSession) {
    return <AccountGate session={apiSession} onSessionChange={onSessionChange} onExit={logout}>
      {(account, jobs) => <Experience account={account} backendJobs={jobs} onLogoutAccount={logout} />}
    </AccountGate>;
  }
  if (authMode) {
    return <ConnectedAuth lang={(() => { try { return JSON.parse(localStorage.getItem('wp_language') || '"en"'); } catch { return 'en'; } })()} initialMode={authMode} onBack={() => setAuthMode(null)}
      onAuthenticated={tokens => { setAuthMode(null); onSessionChange(tokens); }} />;
  }
  return <Experience account={null} backendJobs={[]} onOpenAccount={setAuthMode} onDemo={openDemo} entryError={entryError} />;
}

function Experience({ account, backendJobs = [], onOpenAccount, onDemo, onLogoutAccount, entryError = '' }) {
  const remoteStore = useContext(AccountStorageContext);
  const [lang, setLang] = useLocalStorage('wp_language', 'en');
  const [isLoggedIn, setIsLoggedIn] = useLocalStorage('wp_logged_in', !!account);
  const [userProfile, setUserProfileStored] = useLocalStorage('wp_user_profile', null);
  const profileSaveQueue = useRef(Promise.resolve());
  const setUserProfile = update => {
    const next = typeof update === 'function' ? update(userProfile) : update;
    setUserProfileStored(next);
    if (account && next) {
      profileSaveQueue.current = profileSaveQueue.current.catch(() => {}).then(() =>
        api('/api/auth/passport/', { method: 'PUT', body: next }, readApiSession())
      ).catch(error => reportApiError(error));
    }
  };
  const [savedJobs, setSavedJobsStored] = useLocalStorage('wp_saved', []);
  const [appliedJobs, setAppliedJobs] = useLocalStorage('wp_applied', []);
  const [skillLevels, setSkillLevels] = useLocalStorage('wp_skill_levels', {});
  const [confirmedJobs, setConfirmedJobs] = useLocalStorage('wp_confirmed', []);
  const [payChecklist, setPayChecklist] = useLocalStorage('wp_pay_checklist', [false, false, false, false]);
  const [shieldHistory, setShieldHistory] = useLocalStorage('wp_shield_history', []);
  const [evidence, setEvidenceStored] = useLocalStorage('wp_evidence', []);
  const evidenceRef = useRef(evidence);
  evidenceRef.current = evidence;
  const evidenceQueue = useRef(Promise.resolve());
  const setEvidence = change => {
    const next = typeof change === 'function' ? change(evidenceRef.current) : change;
    evidenceRef.current = next;
    setEvidenceStored(next);
    if (account) {
      const records = (Array.isArray(next) ? next : []).filter(row => typeof row.text === 'string' && row.text.trim()).slice(0, 20);
      evidenceQueue.current = evidenceQueue.current.catch(() => {}).then(() =>
        flow('evidence/replace/', { method: 'POST', body: { items: records } })
      ).catch(error => reportApiError(error));
    }
  };
  const [trustedRaw, setTrustedStored] = useLocalStorage('wp_trusted_contact', null);
  const setTrusted = next => {
    setTrustedStored(next);
    if (account) flow('safety/preferences/', { method: 'PATCH', body: { trusted_contact: next || {} } }).catch(reportApiError);
  };
  const trusted = trustedRaw && typeof trustedRaw === 'object' && typeof trustedRaw.name === 'string' && typeof trustedRaw.phone === 'string' && trustedRaw.name && trustedRaw.phone ? trustedRaw : null;
  const [checkinRaw, setCheckinStored] = useLocalStorage('wp_checkin', null);
  const checkinIdRef = useRef(null);
  const setCheckin = async next => {
    setCheckinStored(next);
    if (!account || !next) return;
    try {
      if (next.status === 'safe' && checkinIdRef.current) {
        await flow(`safety/checkins/${checkinIdRef.current}/acknowledge/`, { method: 'POST' });
      } else if (next.status === 'waiting' && next.byISO) {
        const record = await flow('safety/checkins/', { method: 'POST', body: { scheduled_for: next.byISO } });
        checkinIdRef.current = record.id;
      }
    } catch (error) { reportApiError(error); }
  };
  const checkin = checkinRaw && typeof checkinRaw === 'object' && !Array.isArray(checkinRaw) ? checkinRaw : null;
  const [quietRaw, setQuietStored] = useLocalStorage('wp_quiet', QUIET_DEFAULT);
  const setQuiet = next => {
    setQuietStored(next);
    if (account) flow('safety/preferences/', { method: 'PATCH', body: { quiet_hours: next } }).catch(reportApiError);
  };
  const quiet = normQuiet(quietRaw);
  const [skillEvidenceRaw, setSkillEvidenceStored] = useLocalStorage('wp_skill_evidence', {});
  const proofRef = useRef(skillEvidenceRaw);
  proofRef.current = skillEvidenceRaw;
  const proofQueue = useRef(Promise.resolve());
  const setSkillEvidence = change => {
    const next = typeof change === 'function' ? change(proofRef.current) : change;
    proofRef.current = next;
    setSkillEvidenceStored(next);
    if (account) {
      proofQueue.current = proofQueue.current.catch(() => {}).then(() =>
        flow('proof/', { method: 'POST', body: { proofs: next } })
      ).catch(reportApiError);
    }
  };
  const skillEvidence = skillEvidenceRaw && typeof skillEvidenceRaw === 'object' && !Array.isArray(skillEvidenceRaw) ? skillEvidenceRaw : {};
  const [chatsRaw, setChats] = useLocalStorage('wp_chats', {});
  const chats = chatsRaw && typeof chatsRaw === 'object' && !Array.isArray(chatsRaw) ? chatsRaw : {};
  const chatsRef = useRef(chats);
  chatsRef.current = chats;
  const updateChat = (jobId, fn) => {
    const cur = chatsRef.current || {};
    const next = { ...cur, [jobId]: fn(cur[jobId]) };
    chatsRef.current = next;
    setChats(next);
  };
  const [settingsRaw, setSettings] = useLocalStorage('wp_settings', { shared: false, pin: "", simple: false });
  const settings = { shared: !!(settingsRaw && settingsRaw.shared), pin: (settingsRaw && typeof settingsRaw.pin === 'string') ? settingsRaw.pin : "", simple: !!(settingsRaw && settingsRaw.simple), lowdata: !!(settingsRaw && settingsRaw.lowdata) };
  const [clientActionsRaw, setClientActionsRaw] = useLocalStorage('wp_client_actions', {});
  const clientActions = clientActionsRaw && typeof clientActionsRaw === 'object' && !Array.isArray(clientActionsRaw) ? clientActionsRaw : {};
  const actionsRef = useRef(clientActions);
  actionsRef.current = clientActions;
  const getClientAction = (jobId) => ({ muted: false, blocked: false, report: null, ...((actionsRef.current || {})[jobId] || {}) });
  const setClientAction = (jobId, patch) => {
    const next = { ...(actionsRef.current || {}), [jobId]: { ...getClientAction(jobId), ...patch } };
    actionsRef.current = next;
    setClientActionsRaw(next);
  };
  const [chatDraftsRaw, setChatDrafts] = useLocalStorage('wp_chat_drafts', {});
  const chatDrafts = chatDraftsRaw && typeof chatDraftsRaw === 'object' && !Array.isArray(chatDraftsRaw) ? chatDraftsRaw : {};
  const [applyDraft, setApplyDraft] = useLocalStorage('wp_apply_draft', null);
  const [workroomsRaw, setWorkrooms] = useLocalStorage('wp_workrooms', {});
  const workrooms = workroomsRaw && typeof workroomsRaw === 'object' && !Array.isArray(workroomsRaw) ? workroomsRaw : {};
  const [clientModeRaw, setClientMode] = useLocalStorage('wp_client_mode', account?.role === 'client' ? 'client' : null);
  // A registered client's server-side role must never change through UI navigation.
  const clientMode = account?.role === 'client' || (!account && clientModeRaw === 'client');
  const [clientProfileRaw, setClientProfileStored] = useLocalStorage('wp_client_profile', account?.role === 'client' ? { name: account.display_name || account.username, business: '', town: '' } : null);
  const setClientProfile = change => {
    const next = typeof change === 'function' ? change(clientProfileRaw) : change;
    setClientProfileStored(next);
    if (account?.role === 'client' && next) api('/api/auth/me/', { method: 'PATCH', body: {
      display_name: next.name || '', business_name: next.business || '', town: next.town || '',
    } }, readApiSession()).catch(reportApiError);
  };
  const clientProfile = clientProfileRaw && typeof clientProfileRaw === 'object' ? clientProfileRaw : null;
  const activeClientProfile = account?.role === 'client'
    ? (clientProfile || { name: account.display_name || account.username, business: account.business_name || '', town: account.town || '' })
    : (clientProfile || CLIENT_PROFILE);
  const clientInitials = (activeClientProfile.name || 'Client').trim().split(/\s+/).slice(0, 2)
    .map(part => part.charAt(0)).join('').toUpperCase() || 'CL';
  const [clientJobsRaw, setClientJobs] = useLocalStorage('wp_client_jobs', []);
  const clientJobs = Array.isArray(clientJobsRaw) ? clientJobsRaw : [];
  const [curatedJobsRaw, setCuratedJobs] = useLocalStorage('wp_curated_jobs', []);
  const curatedJobs = Array.isArray(curatedJobsRaw) ? curatedJobsRaw : [];
  const [bringRaw, setBringSubmissions] = useLocalStorage('wp_bring_submissions', null);
  const bringSubmissions = Array.isArray(bringRaw) ? bringRaw : [];
  const jobsForAccount = account ? backendJobs.map(row => {
    const original = DUMMY_JOBS.find(job => job.title === row.title);
    return { ...toUiJob(row), ...(original || {}), id: original?.id || `api-${row.id}`,
      apiId: row.id, ownerId: row.owner_id, paymentVerified: row.payment_verified, title: row.title, description: row.description, clientCountry: row.client_country || 'Not specified',
      budgetUSD: Number(row.budget_usd), budgetType: row.budget_type, skillsRequired: row.required_skills, isDemo: !!row.is_demo, externalOnly: !row.owner_id && !row.is_demo, externalUrl: row.external_url || '',
      beginnerFriendly: row.beginner_friendly };
  }) : DUMMY_JOBS;
  const allJobs = account ? [...curatedJobs, ...jobsForAccount] : [...clientJobs, ...curatedJobs, ...jobsForAccount];
  const reportApiError = error => showToast(error.message || 'Could not save to your account.');
  const setSavedJobs = change => {
    const next = typeof change === 'function' ? change(savedJobs) : change;
    setSavedJobsStored(next);
    if (account) {
      const before = new Set(savedJobs);
      const after = new Set(next);
      for (const id of new Set([...before, ...after])) {
        if (before.has(id) === after.has(id)) continue;
        const job = allJobs.find(j => j.id === id);
        if (job?.apiId) api(`/api/jobs/${job.apiId}/save/`, { method: after.has(id) ? 'POST' : 'DELETE' }, readApiSession()).catch(reportApiError);
      }
    }
  };
  const analyzeOnBackend = account ? (text, structural = true) =>
    flow('shield/check/', { method: 'POST', body: { text, structural } }) : null;
  const saveShieldCheck = account ? text =>
    flow('shield/check/', { method: 'POST', body: { text, save: true } }) : null;
  const clearShieldChecks = account ? () =>
    flow('shield/history/', { method: 'DELETE' }) : null;
  const createPublicShare = account ? async () => {
    const row = await flow('passport/share/', { method: 'POST' });
    return `${window.location.origin}/?passport=${encodeURIComponent(row.token)}`;
  } : null;
  const submitSafetyReport = async report => {
    if (!account) return;
    await api('/api/auth/reports/', { method: 'POST', body: report }, readApiSession());
  };
  const submitApplication = async ({ jobId, text, price, npr }) => {
    const job = allJobs.find(x => x.id === jobId);
    let application = null;
    if (account && job?.apiId) {
      application = await api(`/api/jobs/${job.apiId}/apply/`, { method: 'POST', body: { message: text, proposed_rate_usd: price } }, readApiSession());
    }
    setAppliedJobs(prev => [{ jobId, price, npr, apiApplicationId: application?.id,
      date: new Date().toISOString(), status: 'waiting' }, ...prev]);
  };
  const draftProposal = account ? async (text, jobTitle) => {
    return api('/api/jobs/proposal-draft/', { method: 'POST', body: { text, job_title: jobTitle } }, readApiSession());
  } : null;
  const submitClientJob = async job => {
    if (!account || account.role !== 'client') return;
    return api('/api/client/jobs/', { method: 'POST', body: {
      title: job.title, description: job.description, category: job.category,
      client_name: job.clientName, client_country: job.clientCountry,
      required_skills: job.skillsRequired, budget_usd: job.budgetUSD,
      budget_type: job.budgetType, beginner_friendly: job.beginnerFriendly,
      deliverables: job.deliverables || [], client_provides: job.clientProvides || [],
      deadline_days: job.deadlineDays || 7, meeting_pattern: job.meetingTimeNepal || '',
      needs_own_laptop: !!job.needsOwnLaptop, internet_need: job.internetNeed || '',
    } }, readApiSession());
  };
  const approvedInsights = bringSubmissions.filter(x => x.type === 'insight' && x.status === 'approved');
  const submitBring = async sub => {
    if (account) {
      const row = await flow('contributions/', { method: 'POST', body: { kind: sub.type, payload: sub } });
      setBringSubmissions([...bringSubmissions, toContribution(row)]);
    } else setBringSubmissions([...bringSubmissions, sub]);
  };
  const decideBring = async (id, action) => {
    if (account) {
      if (!account.is_staff) { showToast('Only a reviewer can approve submissions.'); return; }
      try {
        const sub = bringSubmissions.find(x => x.id === id);
        if (!sub?.backendId) return;
        const row = await flow(`contributions/${sub.backendId}/review/`, {
          method: 'POST', body: { decision: action },
        });
        setBringSubmissions(bringSubmissions.map(x => x.id === id ? toContribution(row) : x));
        showToast('Review saved. Refresh to update the public job list.');
      } catch (error) { reportApiError(error); }
      return;
    }
    const sub = bringSubmissions.find(x => x.id === id);
    if (!sub || sub.status !== 'pending') return;
    if (action === 'approve' && sub.type === 'opportunity') {
      if (!curatedJobs.some(j => j.id === 'bj-' + sub.id)) {
        const job = {
          id: 'bj-' + sub.id,
          title: sub.title,
          category: sub.category,
          clientName: sub.organisation,
          clientCountry: sub.country,
          clientType: 'Partner organisation',
          paymentVerified: false,
          beginnerFriendly: !!sub.beginnerFriendly,
          description: sub.description,
          skillsRequired: sub.skillsRequired,
          budgetUSD: sub.budgetMax,
          budgetType: 'fixed',
          postedHoursAgo: 0,
          applicants: 0,
          jobsPostedByClient: 0,
          hireRate: 0,
          memberSince: 2026,
          clientRating: null,
          aboutClient: 'Sample submission from ' + sub.organisation + '. Not independently verified.',
          needsOwnLaptop: !!sub.needsOwnLaptop,
          internetNeed: sub.internetNeed,
          meetingTimeNepal: 'Flexible — no meetings',
          deadlineDays: sub.deadlineDays,
          caution: 'This is a demo listing, not verified by an actual moderator.',
          deliverables: sub.deliverables,
          clientProvides: [],
        };
        setCuratedJobs([...curatedJobs, job]);
      }
      setBringSubmissions(bringSubmissions.map(x => x.id === id ? { ...x, status: 'listed' } : x));
    } else if (action === 'approve') {
      setBringSubmissions(bringSubmissions.map(x => x.id === id ? { ...x, status: 'approved' } : x));
    } else {
      setBringSubmissions(bringSubmissions.map(x => x.id === id ? { ...x, status: 'rejected' } : x));
    }
  };
  const confirmAgreement = async (jobId, applicant) => {
    if (account?.role === 'client') {
      // Registered clients decide once through ClientInbox; the legacy demo
      // agreement must never send a second acceptance PATCH.
      fetchClientApplications();
      navTo('client-inbox');
      return;
    }
    setClientJobs(clientJobs.map(j => j.id === jobId ? { ...j, accepted: { applicantName: applicant.name, price: applicant.asks } } : j));
    navTo('client', { scrollTo: 'mine' });
  };
  const sharedOn = settings.shared && settings.pin.length === 4;
  const simpleOn = settings.simple;
  const [unlocked, setUnlocked] = useState(false);
  const [quickHidden, setQuickHidden] = useState(false);
  const [currentView, setCurrentView] = useState(account?.role === 'client' ? 'client' : account && !['maya_demo'].includes(account.username) && !account.username.startsWith('demo_') && !userProfile?.onboarded ? 'account-setup' : account ? 'firstwork' : 'welcome');
  const [viewParams, setViewParams] = useState({});
  const [realClientApplications, setRealClientApplications] = useState([]);
  const [clientInboxError, setClientInboxError] = useState('');
  const fetchClientApplications = () => {
    if (account?.role !== 'client') return;
    api('/api/client/applications/', {}, readApiSession()).then(rows => {
      setRealClientApplications(Array.isArray(rows) ? rows : rows.results || []);
      setClientInboxError('');
    }).catch(error => { setClientInboxError(error.message || 'Could not load applications.'); reportApiError(error); });
  };
  useEffect(() => { if (account?.role === 'client') fetchClientApplications(); }, [account?.id]);
  const updateClientApplication = async (id, decision, reason = '') => {
    if (account?.role !== 'client') return;
    const updated = await api(`/api/client/applications/${id}/`, {
      method: 'PATCH', body: { status: decision, ...(reason && reason.trim() ? { decision_reason: reason.trim() } : {}) },
    }, readApiSession());
    setRealClientApplications(previous => previous.map(item => item.id === id ? updated : item));
  };
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const root = document.documentElement;
    if (simpleOn || settings.lowdata) { root.style.fontSize = '112.5%'; root.classList.add('wp-simple-on'); }
    else { root.style.fontSize = ''; root.classList.remove('wp-simple-on'); root.classList.remove('vouch-low-data'); }
    root.classList.toggle('vouch-low-data', Boolean(settings.lowdata));
    return () => { root.style.fontSize = ''; root.classList.remove('wp-simple-on'); root.classList.remove('vouch-low-data'); };
  }, [simpleOn, settings.lowdata]);

  useEffect(() => {
    if (clientMode && currentView === 'welcome') setCurrentView('client');
    else if (isLoggedIn && currentView === 'welcome') setCurrentView('firstwork');
  }, [isLoggedIn, clientMode, currentView]);

  const clientSeededRef = useRef(false);
  useEffect(() => {
    if (!clientMode || currentView !== 'client' || clientSeededRef.current) return;
    clientSeededRef.current = true;
    if (!account && clientJobs.length === 0) setClientJobs([CLIENT_SEED_JOB]);
  }, [clientMode, currentView, clientJobs]);

  useEffect(() => {
    if (!isLoggedIn || !isDemoUser(userProfile)) return;
    if (Object.keys(skillEvidence).length === 0) setSkillEvidence(makeEvidenceSeed());
  }, [isLoggedIn, userProfile, skillEvidenceRaw]);

  const t = (key) => {
    // A linked account stores voluntary checks and evidence privately in Django.
    // The unlinked demo uses device storage. Do not tell users the wrong thing.
    if (account && ['sf_private', 'sf_proof_private', 'sh_private'].includes(key)) {
      const accountCopy = {
        en: { sf_private: 'Checks run through your private Vouch account. Text is not saved unless you choose Save.',
          sf_proof_private: 'Saved evidence is private to your Vouch account.',
          sh_private: 'Your check is sent securely to Vouch. It is not saved unless you choose Save.' },
        ne: { sf_private: 'जाँच तपाईंको निजी Vouch खाताबाट हुन्छ। तपाईंले सेभ नगरेसम्म पाठ सेभ हुँदैन।',
          sf_proof_private: 'सेभ गरिएको प्रमाण तपाईंको Vouch खातामा निजी रहन्छ।',
          sh_private: 'जाँच गर्न पाठ Vouch मा सुरक्षित रूपमा पठाइन्छ। तपाईंले सेभ नगरेसम्म सुरक्षित गरिँदैन।' },
      };
      return (accountCopy[lang] || accountCopy.en)[key];
    }
    return (DICT[lang] || DICT.en)[key] || DICT.en[key] || key;
  };

  const toastTimer = useRef(null);
  const showToast = (msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const navTo = (view, params = {}) => {
    if (view === 'safety') { view = 'shield'; params = { ...params, scrollTo: 'safety', n: Date.now() }; }
    setCurrentView(view);
    if (view === 'client-applicants' && account?.role === 'client') fetchClientApplications();
    if (view === 'bring-queue' && account?.is_staff) flowList('contributions/review/')
      .then(rows => setBringSubmissions(rows.map(toContribution))).catch(reportApiError);
    setViewParams(params);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    if (account || (currentView !== 'bring' && currentView !== 'bring-queue')) return;
    try {
      if (window.localStorage.getItem('wp_bring_submissions') === null) setBringSubmissions(buildBringSeeds());
    } catch (e) { /* storage unavailable */ }
  }, [currentView]);

  const handleLogout = async () => {
    if (account) { await remoteStore?.flush?.(); onLogoutAccount?.(); return; }
    setUnlocked(false);
    setQuickHidden(false);
    setIsLoggedIn(false);
    navTo('welcome');
    showToast(t('nav_logout_toast'));
  };

  const enterClientMode = () => {
    if (!account) setClientProfile(CLIENT_PROFILE);
    setClientMode('client');
    navTo('client');
  };
  const exitClientToMaya = () => {
    if (account?.role === 'client') { navTo('client-firstwork'); return; }
    if (account) { navTo('firstwork'); return; }
    setClientMode(null);
    setClientProfile(null);
    setUserProfile(MAYA_PROFILE);
    setIsLoggedIn(true);
    navTo('firstwork');
  };
  const clientLogout = async () => {
    if (account) { await remoteStore?.flush?.(); onLogoutAccount?.(); return; }
    setClientMode(null);
    setClientProfile(null);
    setIsLoggedIn(false);
    navTo('welcome');
    showToast(t('nav_logout_toast'));
  };

  const successOverlay = currentView === 'setup_success' ? (
           <div className="fixed inset-0 bg-[#FFFFFF] z-50 flex flex-col items-center justify-center p-6 text-center">
              <CheckCircle2 size={64} strokeWidth={1.5} className="text-[#003D14] mx-auto mb-6" />
              <h1 className="text-[28px] sm:text-[30px] font-semibold mb-4">{t('setup_success_title')}, {userProfile?.name?.split(' ')[0]}!</h1>
              <p className="text-lg text-[#475249] mb-10 max-w-md">{t('setup_success_sub')}</p>
              
              <div className="w-full max-w-sm flex flex-col gap-4">
                <button onClick={() => navTo('firstwork')} className="w-full bg-[#003D14] text-white py-3.5 rounded-full font-semibold text-lg hover:bg-[#0E5C2A] transition-colors min-h-[52px]">
                  {t('btn_find_job')}
                </button>
                <button onClick={() => navTo('passport')} className="w-full bg-white text-[#141614] border border-[#E3E6E1] py-3.5 rounded-full font-semibold text-lg hover:bg-[#F7F7F4] transition-colors min-h-[52px]">
                  {t('btn_see_wp')}
                </button>
              </div>
           </div>
  ) : null;

  if (!isLoggedIn && !clientMode) {
    return <VouchLanding lang={lang} onLanguage={setLang} onLogin={() => onOpenAccount?.('login')}
      onSignup={() => onOpenAccount?.('register')} onDemo={onDemo} onClient={enterClientMode} entryError={entryError}/>;
  }

  if (quickHidden) {
    return <QuickHideScreen t={t} onReturn={() => { setUnlocked(false); setQuickHidden(false); }} />;
  }
  if (sharedOn && !unlocked) {
    return <LockScreen t={t} pin={settings.pin} onUnlock={() => setUnlocked(true)} />;
  }

  if (clientMode) {
    return (
      <div className={`wp-app min-h-screen flex flex-col bg-[#FFFFFF] font-sans text-base text-[#141614] ${lang === 'ne' ? 'leading-relaxed' : ''}`}>
        <ShellHeader mode="client" lang={lang} setLang={setLang} currentView={currentView}
          navTo={navTo} t={t} user={activeClientProfile} connected={!!account}
          lowData={settings.lowdata} onToggleLowData={() => setSettings({ ...settings, lowdata: !settings.lowdata })}
          onLogout={clientLogout} onSwitch={exitClientToMaya}
          onPost={() => navTo('client', { scrollTo: 'form', n: Date.now() })}
          onMessages={() => { fetchClientApplications(); navTo('client-inbox'); }} />

        <main className="flex-1 max-w-[1200px] mx-auto w-full p-4 sm:p-6 pb-28">
          {currentView === 'community' ? (<VouchCommunity lang={lang} viewer="client" name={activeClientProfile.name} onJobBoard={() => navTo('client-firstwork')} />) : currentView === 'job-feedback' ? (<JobFeedback lang={lang} job={clientJobs.find(j => j.id === viewParams.id) || allJobs.find(j => j.id === viewParams.id)} name={activeClientProfile.name} canReview={false} onBack={() => navTo('client')}/>) : currentView === 'client-firstwork' && account?.role === 'client' ? (
            <ClientFirstWorkBrowse jobs={jobsForAccount} lang={lang} />
          ) : currentView === 'client-inbox' ? (
            <ClientInbox lang={lang} error={clientInboxError} applications={realClientApplications} onUpdateStatus={updateClientApplication} onOpenChat={id => navTo('client-conversation', { appId: id })} onOpenWorkroom={id => navTo('client-workroom', { appId: id })} />
          ) : currentView === 'client-conversation' ? (
            <ConnectedConversation lang={lang} applicationId={viewParams.appId} myId={account.id} onBack={() => navTo('client-inbox')} />
          ) : currentView === 'client-workroom' ? (
            <ConnectedWorkroom lang={lang} applicationId={viewParams.appId} myId={account.id} onBack={() => navTo('client-inbox')} />
          ) : ['client-applicants', 'client-agreement'].includes(currentView) && account?.role === 'client' ? (
            // Real employers manage one application record through the same Django
            // status, messaging and Workroom screens. The old demo agreement
            // would attempt a second (invalid) acceptance request.
            <ClientInbox lang={lang} error={clientInboxError}
              jobTitle={clientJobs.find(j => j.id === viewParams.id)?.title}
              applications={realClientApplications.filter(row => row.job === clientJobs.find(j => j.id === viewParams.id)?.apiId)}
              onUpdateStatus={updateClientApplication}
              onOpenChat={id => navTo('client-conversation', { appId: id })}
              onOpenWorkroom={id => navTo('client-workroom', { appId: id })} />
          ) : currentView === 'client-explore' ? (
            <ClientExplore t={t} lang={lang} navTo={navTo} showToast={showToast} connected={!!account} clientJobs={clientJobs} />
          ) : currentView === 'payments' ? (
            <PaymentsPage lang={lang} workrooms={workrooms} allJobs={allJobs} t={t} payChecklist={payChecklist} setPayChecklist={setPayChecklist} showToast={showToast} role="client" />
          ) : currentView === 'client-applicants' ? (
            <ClientApplicants t={t} lang={lang} navTo={navTo} job={clientJobs.find(j => j.id === viewParams.id)} isDemo={!account} applicants={DEMO_APPLICANTS} />
          ) : currentView === 'client-agreement' ? (
            <ClientAgreement t={t} lang={lang} navTo={navTo} job={clientJobs.find(j => j.id === viewParams.id)} applicant={DEMO_APPLICANTS.find(x => x.id === viewParams.applicantId)} onConfirm={confirmAgreement} />
          ) : (
            <ClientView onPost={account?.role === 'client' ? submitClientJob : null} applications={realClientApplications} t={t} lang={lang} navTo={navTo} showToast={showToast} clientJobs={clientJobs} setClientJobs={setClientJobs} scrollTo={viewParams.scrollTo} clientMode clientProfile={activeClientProfile} workrooms={workrooms} />
          )}
        </main>

        <footer className="border-t border-[#E3E6E1] py-10 px-4">
          <div className="max-w-[1200px] mx-auto flex flex-col items-center gap-3 text-center">
            <div className="max-w-2xl text-left"><Disclaimer t={t} k="disc_footer" /></div>
            <div className="text-[13px] text-[#70776F]">{t('footer_text')}</div>
          </div>
        </footer>

        {toast && <Toast msg={toast} />}
      </div>
    );
  }

  return (
    <div className={`wp-app ${simpleOn ? 'wp-simple' : ''} min-h-screen flex flex-col bg-[#FFFFFF] font-sans text-base text-[#141614] ${lang === 'ne' ? 'leading-relaxed' : ''}`}>
      {/* Navbar */}
      <ShellHeader lang={lang} setLang={setLang} currentView={currentView} navTo={navTo} t={t}
        user={userProfile} connected={!!account} sharedOn={sharedOn}
        lowData={settings.lowdata} onToggleLowData={() => setSettings({ ...settings, lowdata: !settings.lowdata })}
        onQuickHide={() => setQuickHidden(true)} onLock={() => setUnlocked(false)} onLogout={handleLogout} />

      {/* Info Strip */}
      {(currentView === 'firstwork' || currentView === 'opportunities') && (
        <div className="vouch-moderation-note"><span>{t('fw_banner')}</span></div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1200px] mx-auto w-full p-4 sm:p-6 pb-28">
        {currentView === 'account-setup' && <div className="max-w-[560px] mx-auto bg-white border border-[#E3E6E1] rounded-[20px] p-6"><SetupFlow t={t} lang={lang} initialName={userProfile?.name || ''} onBack={() => { setUserProfile({ ...userProfile, onboarded: true }); navTo('firstwork'); }} onComplete={profile => { setUserProfile({ ...userProfile, ...profile, onboarded: true }); navTo('setup_success'); }} /></div>}
        {currentView === 'firstwork' && <FirstWorkFeed allJobs={allJobs} t={t} navTo={navTo} user={userProfile} savedJobs={savedJobs} setSavedJobs={setSavedJobs} lang={lang} lowdata={settings.lowdata} onSwitchClient={() => { if (account?.role === 'client') enterClientMode(); else if (account) showToast('To post a job, please use a client account.'); else { setUnlocked(false); setIsLoggedIn(false); navTo('welcome'); } }} />}
        {currentView === 'community' && <VouchCommunity lang={lang} name={userProfile?.name || 'Vouch member'} viewer="worker" onJobBoard={() => navTo('firstwork')} />}
        {currentView === 'job-feedback' && <JobFeedback job={allJobs.find(j => j.id === viewParams.id) || clientJobs.find(j => j.id === viewParams.id)} lang={lang} name={userProfile?.name || 'Vouch member'} canReview={confirmedJobs.includes(viewParams.id)} onBack={() => navTo('job-detail', { id: viewParams.id })} />}
        {currentView === 'job-detail' && <JobDetail onReport={account ? submitSafetyReport : null} t={t} navTo={navTo} job={allJobs.find(j => j.id === viewParams.id)} user={userProfile} skillLevels={skillLevels} savedJobs={savedJobs} setSavedJobs={setSavedJobs} lang={lang} showToast={showToast} hasDraft={simpleOn && !!applyDraft && applyDraft.jobId === viewParams.id} onSeeFeedback={() => navTo('job-feedback', { id: viewParams.id })} />}
        {currentView === 'apply' && <ApplyWizard key={viewParams.id} onSubmit={submitApplication} onDraftProposal={draftProposal} t={t} navTo={navTo} job={allJobs.find(j => j.id === viewParams.id)} user={userProfile} setAppliedJobs={setAppliedJobs} lang={lang} simple={simpleOn} applyDraft={applyDraft} setApplyDraft={setApplyDraft} />}
        {currentView === 'opportunities' && <MyOpportunities allJobs={allJobs} key={viewParams.tab || 'saved'} initialTab={viewParams.tab} t={t} navTo={navTo} savedJobs={savedJobs} setSavedJobs={setSavedJobs} appliedJobs={appliedJobs} confirmedJobs={confirmedJobs} hideMoney={sharedOn} draftJobId={simpleOn && applyDraft ? applyDraft.jobId : null} connected={!!account} lang={lang} />}
        {currentView === 'passport' && <PassportPage allowDemoConfirm={!account} allJobs={allJobs} t={t} lang={lang} user={userProfile} setUser={setUserProfile} navTo={navTo} showToast={showToast} skillLevels={skillLevels} setSkillLevels={setSkillLevels} confirmedJobs={confirmedJobs} setConfirmedJobs={setConfirmedJobs} payChecklist={payChecklist} setPayChecklist={setPayChecklist} appliedJobs={appliedJobs} skillEvidence={skillEvidence} setSkillEvidence={setSkillEvidence} hideMoney={sharedOn} settings={settings} setSettings={setSettings} onSharedEnabled={() => setUnlocked(true)} evidence={evidence} onCreateShare={createPublicShare} initialTab={viewParams.tab || 'overview'} />}
        {currentView === 'payments' && <PaymentsPage lang={lang} workrooms={workrooms} allJobs={allJobs} t={t} payChecklist={payChecklist} setPayChecklist={setPayChecklist} showToast={showToast} role="worker" />}
        {currentView === 'shield' && <ShieldSafetyPage onAnalyze={analyzeOnBackend} onSaveShield={saveShieldCheck} onClearShield={clearShieldChecks} t={t} lang={lang} user={userProfile} navTo={navTo} showToast={showToast} history={shieldHistory} setHistory={setShieldHistory} evidence={evidence} setEvidence={setEvidence} scrollKey={viewParams.n} scrollTo={viewParams.scrollTo} allJobs={allJobs} appliedJobs={appliedJobs} trusted={trusted} setTrusted={setTrusted} checkin={checkin} setCheckin={setCheckin} quiet={quiet} setQuiet={setQuiet} onQuickHide={() => setQuickHidden(true)} />}
        {currentView === 'ext' && <ExtensionPage t={t} lang={lang} navTo={navTo} connected={!!account} />}
        {currentView === 'skillbridge' && <SkillBridgePage allJobs={allJobs} t={t} lang={lang} user={userProfile} navTo={navTo} insights={approvedInsights} connected={!!account} />}
        {currentView === 'bring' && <BringView canReview={!account || account.is_staff} t={t} lang={lang} navTo={navTo} onSubmit={submitBring} />}
        {currentView === 'institution-insight' && (account ? <ConnectedInstitutionInsight lang={lang} onBack={() => navTo('bring')} /> : <InstitutionInsight allJobs={allJobs} t={t} lang={lang} navTo={navTo} />)}
        {currentView === 'bring-queue' && (!account || account.is_staff ? <BringQueue t={t} lang={lang} navTo={navTo} submissions={bringSubmissions} onDecide={decideBring} /> : <p>Only authorized reviewers can see pending submissions.</p>)}
        {currentView === 'vault' && <EvidenceVaultPage t={t} lang={lang} user={userProfile} navTo={navTo} showToast={showToast} evidence={evidence} setEvidence={setEvidence} masked={sharedOn} />}
        {currentView === 'chat' && (appliedJobs.some(a => a.jobId === viewParams.id) && allJobs.find(j => j.id === viewParams.id)
          ? (account && allJobs.find(j => j.id === viewParams.id)?.apiId && appliedJobs.find(a => a.jobId === viewParams.id)?.apiApplicationId && allJobs.find(j => j.id === viewParams.id)?.ownerId
            ? <ConnectedConversation lang={lang} key={viewParams.id} applicationId={appliedJobs.find(a => a.jobId === viewParams.id).apiApplicationId} myId={account.id} onBack={() => navTo('opportunities', { tab: 'applied' })} />
            : <ChatView demoOnly={!!account} key={viewParams.id} onReport={account ? submitSafetyReport : null} t={t} lang={lang} job={allJobs.find(j => j.id === viewParams.id)} user={userProfile} navTo={navTo} showToast={showToast} chats={chats} updateChat={updateChat} setEvidence={setEvidence} workrooms={workrooms} setWorkrooms={setWorkrooms} simple={simpleOn} chatDrafts={chatDrafts} setChatDrafts={setChatDrafts} getClientAction={getClientAction} clientAction={getClientAction(viewParams.id)} setClientAction={setClientAction} quiet={quiet} />)
          : <ChatMissing t={t} navTo={navTo} />)}
        {currentView === 'workroom' && (appliedJobs.some(a => a.jobId === viewParams.id) && allJobs.find(j => j.id === viewParams.id)
          ? (account && allJobs.find(j => j.id === viewParams.id)?.ownerId
            ? <ConnectedWorkroom lang={lang} key={viewParams.id} applicationId={appliedJobs.find(a => a.jobId === viewParams.id)?.apiApplicationId} onReview={() => { setConfirmedJobs(prev => prev.includes(viewParams.id) ? prev : [...prev, viewParams.id]); navTo('job-feedback', { id: viewParams.id }); }} myId={account.id} onBack={() => navTo('opportunities', { tab: 'applied' })} />
            : <WorkroomView key={viewParams.id} onReview={() => navTo('job-feedback', { id: viewParams.id })} t={t} lang={lang} job={allJobs.find(j => j.id === viewParams.id)} navTo={navTo} showToast={showToast} workrooms={workrooms} setWorkrooms={setWorkrooms} confirmedJobs={confirmedJobs} setConfirmedJobs={setConfirmedJobs} hideMoney={sharedOn} />)
          : <ChatMissing t={t} navTo={navTo} />)}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E3E6E1] py-10 px-4">
        <div className="max-w-[1200px] mx-auto flex flex-col items-center gap-3 text-center">
          <div className="max-w-2xl text-left"><Disclaimer t={t} k="disc_footer" /></div>
          <div className="text-[13px] text-[#70776F]">{t('footer_text')}</div>
        </div>
      </footer>

      {successOverlay}
      {toast && <Toast msg={toast} />}
      <InstallBanner t={t} />
    </div>
  );
}

// "Add to home screen" offer for the installable web app. Appears only when
// the browser itself offers installation (beforeinstallprompt); dismissing
// it hides it for this session. On iPhones the browser never fires that
// event, so nothing shows there - the Share -> Add to Home Screen path in
// Safari still works.
function InstallBanner({ t }) {
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  if (!deferred || dismissed) return null;
  const install = async () => {
    try { deferred.prompt(); await deferred.userChoice; } catch { /* user closed it */ }
    setDeferred(null);
  };
  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 bg-white border border-[#E3E6E1] rounded-[20px] shadow-lg p-5">
      <div className="font-semibold text-lg mb-1">{t('pwa_title')}</div>
      <p className="text-base text-[#475249] mb-4">{t('pwa_desc')}</p>
      <div className="flex gap-3">
        <button onClick={install} className="flex-1 py-3 bg-[#003D14] text-white font-semibold text-base rounded-full hover:bg-[#0E5C2A] min-h-[48px]">{t('pwa_btn')}</button>
        <button onClick={() => setDismissed(true)} className="flex-1 py-3 border border-[#E3E6E1] font-semibold text-base rounded-full hover:bg-[#F7F7F4] min-h-[48px] bg-white">{t('pwa_later')}</button>
      </div>
    </div>
  );
}
