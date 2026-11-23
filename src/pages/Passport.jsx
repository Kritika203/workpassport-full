// Freelancer Passport screen.

import { ArrowRight, Check, CheckCircle2, CheckSquare, ChevronLeft, Download, Lock, MapPin, ShieldCheck, Square, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { CVImport } from '../components/passport/CVImport.jsx';
import { PaymentSettings } from '../components/payments/PaymentSettings.jsx';
import { Disclaimer } from '../components/common/Disclaimer.jsx';
import { LevelBadge, RuleToggle } from '../components/passport/Badges.jsx';
import { ProfileDetails, ProfileFieldsList } from '../components/passport/ProfileFields.jsx';
import { PROOF_BTN, PassportPrint, ProofArea, WorkSamples } from '../components/passport/Proof.jsx';
import { NetPayCalculator } from '../components/payment/Payment.jsx';
import { PrivacySection } from '../components/privacy/Privacy.jsx';
import { MASK } from '../constants/privacy.js';
import { DEFAULT_RULES, LEVEL_ORDER, LEVEL_WEIGHT, RULE_KEYS } from '../constants/skills.js';
import { ALL_SKILLS, DEMO_INSTITUTE } from '../data/demo.js';
import { DUMMY_JOBS } from '../data/jobs.js';
import { EVIDENCE_KEY, MAX_PROOF, evidenceGroups } from '../services/evidence.js';
import { printDocument } from '../services/print.js';
import { fmt, fmtMoney, initialsOf, slugify } from '../utils/format.js';
import { getLevel, isDemoUser, profileHasDetails } from '../utils/profile.js';



export function PassportPage({ allowDemoConfirm = true, allJobs = DUMMY_JOBS, t, lang, user, setUser, navTo, showToast, skillLevels, setSkillLevels, confirmedJobs, setConfirmedJobs, payChecklist, setPayChecklist, appliedJobs, skillEvidence = {}, setSkillEvidence = () => {}, hideMoney = false, settings, setSettings, onSharedEnabled = () => {}, evidence = [], onCreateShare = null, initialTab = 'overview' }) {
  const [view, setView] = useState('main'); // main | public
  const [activeTab, setActiveTab] = useState(initialTab);
  const [cvExpanded, setCvExpanded] = useState(false);
  const [editRequest, setEditRequest] = useState(0);
  const [skillDraft, setSkillDraft] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [remoteShare, setRemoteShare] = useState('');
  const openShare = async () => {
    if (onCreateShare) {
      try { setRemoteShare(await onCreateShare()); }
      catch (error) { showToast(error.message || 'Could not create your public link.'); return; }
    }
    setShareOpen(true);
  };

  const skills = user.skills || [];
  const levels = skills.map(sk => ({ skill: sk, level: getLevel(user, skillLevels, sk) }));
  const progress = levels.length ? Math.round(levels.reduce((a, l) => a + LEVEL_WEIGHT[l.level], 0) / levels.length) : 0;
  const provenCount = levels.filter(l => l.level !== 'self').length;
  const confirmedList = confirmedJobs.map(id => allJobs.find(j => j.id === id)).filter(Boolean);
  const totalProofItems = Object.values(skillEvidence || {}).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0)
    + (Array.isArray(evidence) ? evidence.length : 0);
  const earned = confirmedList.reduce((a, j) => a + j.budgetUSD * 133, 0);
  const waiting = [];
  appliedJobs.forEach(a => { if (!confirmedJobs.includes(a.jobId) && !waiting.some(w => w.jobId === a.jobId)) waiting.push(a); });
  const rules = user.safetyRules || DEFAULT_RULES;
  const enc = progress <= 25 ? t('pp_enc1') : progress <= 60 ? t('pp_enc2') : t('pp_enc3');
  const link = remoteShare || `workpassport.app/p/${slugify(user.name)}`;
  const digits = (n) => lang === 'ne' ? String(n).replace(/\d/g, d => '०१२३४५६७८९'[d]) : String(n);
  const evidenceMap = skillEvidence && typeof skillEvidence === 'object' ? skillEvidence : {};
  const groups = evidenceGroups(skills, evidenceMap);
  const addProof = (skill, item) => {
    const cur = Array.isArray(evidenceMap[skill]) ? evidenceMap[skill] : [];
    if (cur.length >= MAX_PROOF) return 'max';
    const next = { ...evidenceMap, [skill]: [...cur, { id: 'ev-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), date: new Date().toISOString(), ...item }] };
    // The React state handles storage for this account.
    if (JSON.stringify(next).length > 750000) return 'full';
    setSkillEvidence(next);
    showToast(t('sf_saved_toast'));
    return 'ok';
  };
  const removeProof = (skill, id) => {
    const next = { ...evidenceMap, [skill]: (evidenceMap[skill] || []).filter(x => x.id !== id) };
    setSkillEvidence(next);
    showToast(t('sf_deleted'));
  };
  const printDoc = <PassportPrint t={t} lang={lang} user={user} levels={levels} evidenceMap={evidenceMap} confirmedList={confirmedList} provenCount={provenCount} earned={earned} hideMoney={hideMoney} digits={digits} />;
  const instituteOf = (skill, level) => level === 'institution' ? (isDemoUser(user) ? DEMO_INSTITUTE : (user.institute || '')) : '';

  const confirmJob = (id) => {
    setConfirmedJobs(prev => prev.includes(id) ? prev : [...prev, id]);
    showToast(t('pp_confirm_toast'));
  };
  const togglePay = (i) => setPayChecklist(prev => { const a = [...(Array.isArray(prev) && prev.length === 4 ? prev : [false, false, false, false])]; a[i] = !a[i]; return a; });
  const toggleRule = (k) => setUser({ ...user, safetyRules: { ...rules, [k]: !rules[k] } });
  const addSkill = (event) => {
    event.preventDefault();
    const nextSkill = skillDraft.trim();
    if (!nextSkill || skills.includes(nextSkill)) return;
    setUser({ ...user, skills: [...skills, nextSkill] });
    setSkillDraft('');
    showToast?.(lang === 'ne' ? 'सीप थपियो।' : 'Skill added to your WorkPassport.');
  };
  const openHeadlineEditor = () => {
    setActiveTab('profile');
    setEditRequest(n => n + 1);
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(link); } catch (e) {
      try { const ta = document.createElement('textarea'); ta.value = link; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); } catch (e2) { /* ignore */ }
    }
    showToast(t('pp_link_copied'));
  };

  if (view === 'public') {
    return (
      <div className="max-w-[760px] mx-auto">
        {printDoc}
        <div className="flex flex-wrap items-center justify-between gap-x-4 mb-2">
          <button onClick={() => { setView('main'); window.scrollTo(0, 0); }} className="flex items-center gap-2 text-base font-semibold text-[#475249] hover:text-[#141614] min-h-[48px]"><ChevronLeft size={20} /> {t('pp_back_my')}</button>
          <button onClick={() => printDocument('passport')} className={PROOF_BTN}><Download size={20} /> {t('pdf_btn')}</button>
        </div>
        <p className="text-sm text-[#70776F] mb-4">{t('pp_preview_note')}</p>
        <WorkSamples groups={groups} t={t} />
        <div className="bg-[#FAF0EE] text-[#AE332A] rounded-[14px] px-5 py-4 flex items-start gap-3 font-semibold mb-8"><ShieldCheck size={22} className="shrink-0 mt-0.5" /> <span>{t('pp_public_strip')}</span></div>

        <h2 className="font-semibold text-[22px] mb-4">{t('pp_work_title')}</h2>
        {confirmedList.length === 0 ? (
          <div className="bg-white border border-[#E3E6E1] rounded-[20px] p-6 text-lg text-[#475249] mb-10">{t('pp_public_empty')}</div>
        ) : (
          <div className="space-y-4 mb-10">
            {confirmedList.map(j => (
              <div key={j.id} className="bg-white border border-[#E3E6E1] rounded-[20px] p-6">
                <div className="font-semibold text-xl mb-1">{j.title}</div>
                <div className="text-base text-[#475249] mb-3">{j.clientName}</div>
                <LevelBadge level="client" t={t} />
              </div>
            ))}
          </div>
        )}

        <h2 className="font-semibold text-[22px] mb-4">{t('pp_skills_title')}</h2>
        <div className="bg-white border border-[#E3E6E1] rounded-[20px] divide-y divide-[#E3E6E1] mb-10">
          {levels.map(({ skill, level }) => (
            <div key={skill} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-semibold text-lg">{skill}</span>
              <LevelBadge level={level} t={t} />
            </div>
          ))}
        </div>

        <div className="space-y-1 mb-10 text-base text-[#475249]">
          {RULE_KEYS.filter(k => rules[k]).map(k => <p key={k}><span className="font-semibold text-[#141614]">{t('pp_working_rules')}</span> {t('rule_' + k)}</p>)}
        </div>

        <h2 className="font-semibold text-[22px] mb-4">{t('pp_about')}</h2>
        <div className="bg-white border border-[#E3E6E1] rounded-[20px] p-6 flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-full bg-[#E7F0E9] border border-[#E3E6E1] flex items-center justify-center font-semibold text-xl text-[#141614] shrink-0">{initialsOf(user.name)}</div>
          <div>
            <div className="font-semibold text-xl">{user.name}</div>
            <div className="text-base text-[#475249]">{user.district}</div>
            {user.headline && <div className="text-base text-[#475249] mt-1">{user.headline}</div>}
          </div>
        </div>
        {profileHasDetails(user) && (
          <div className="bg-white border border-[#E3E6E1] rounded-[20px] p-6 mb-8">
            <ProfileFieldsList t={t} user={user} />
          </div>
        )}
        <p className="text-sm text-[#70776F] text-center">{t('pp_public_footer')}</p>
      </div>
    );
  }

  return (
    <div className="vouch-passport-layout max-w-[1020px] mx-auto" data-active-tab={activeTab}>
      {printDoc}
      <nav className="vouch-passport-tabs" aria-label={lang === 'ne' ? 'WorkPassport पृष्ठहरू' : 'WorkPassport sections'}>
        {[
          ['overview', lang === 'ne' ? 'परिचय' : 'Overview'],
          ['profile', lang === 'ne' ? 'प्रोफाइल' : 'Profile'],
          ['skills', lang === 'ne' ? 'सीप र प्रमाण' : 'Skills & proof'],
          ['work', lang === 'ne' ? 'गरिएका काम' : 'Completed work'],
          ['settings', lang === 'ne' ? 'सेटिङ र गोपनीयता' : 'Settings & privacy'],
        ].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </nav>

      <section id="passport-overview" data-passport-pane="overview" hidden={activeTab !== 'overview'} className="vouch-passport-pane space-y-5">
        <div className="vouch-passport-hero-card">
          <div className="vouch-passport-identity">
            <div className="vouch-passport-initials" aria-hidden="true">{initialsOf(user.name)}</div>
            <div className="min-w-0">
              <h1 className="vouch-passport-name">{user.name}</h1>
              {user.district && <p className="vouch-passport-location">{user.district}</p>}
              {user.headline && <p className="vouch-passport-location">{user.headline}</p>}
              {!isDemoUser(user) && user.institute && <p className="vouch-passport-location">{fmt(t('pp_institute_pending'), { name: user.institute })}</p>}
            </div>
          </div>
          <div className="vouch-passport-hero-actions">
            <button type="button" onClick={() => { setView('public'); window.scrollTo(0, 0); }} className="vouch-passport-outline">{lang === 'ne' ? 'पासपोर्ट पूर्वावलोकन' : 'Passport preview'} <span aria-hidden="true">→</span></button>
            <button type="button" onClick={openShare} className="vouch-passport-text-action">{lang === 'ne' ? 'सेयर गर्नुहोस्' : 'Share & export'} <span aria-hidden="true">→</span></button>
            <button type="button" onClick={() => printDocument('passport')} className="vouch-passport-text-action">{t('pdf_btn')} <span aria-hidden="true">→</span></button>
          </div>
        </div>
        <div className="vouch-passport-metrics">
          <div className="vouch-passport-metric"><span>{lang === 'ne' ? 'सीपहरू' : 'Skills'}</span><strong>{digits(skills.length)}</strong></div>
          <div className="vouch-passport-metric"><span>{lang === 'ne' ? 'प्रमाणहरू' : 'Proof items'}</span><strong>{digits(totalProofItems)}</strong></div>
          <div className="vouch-passport-metric"><span>{lang === 'ne' ? 'स्तर' : 'Level'}</span><strong>{user.badge || t('pp_beginner')}</strong></div>
        </div>
        <div className="vouch-passport-next-step">
          <div><h2>{lang === 'ne' ? 'तपाईंको अर्को कदम' : 'Your next step'}</h2>
            <p>{!user.headline ? (lang === 'ne' ? 'आफ्नो कामको छोटो परिचय थप्नुहोस्।' : 'Add a short headline that says what you do.')
              : skills.length === 0 ? (lang === 'ne' ? 'आफ्नो पहिलो सीप थप्नुहोस्।' : 'Add your first skill to start building proof.')
                : (lang === 'ne' ? 'कामको प्रमाण थपेर पासपोर्ट सुधार्नुहोस्।' : 'Keep building your profile with real proof of work.')}</p>
          </div>
          <button type="button" onClick={!user.headline ? openHeadlineEditor : () => setActiveTab('skills')} className="vouch-passport-primary">
            {!user.headline ? (lang === 'ne' ? 'हेडलाइन थप्नुहोस्' : 'Add a headline') : skills.length === 0 ? (lang === 'ne' ? 'सीप थप्नुहोस्' : 'Add a skill') : (lang === 'ne' ? 'प्रमाण हेर्नुहोस्' : 'Build proof')}
            <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="vouch-passport-progress-card">
          <div className="flex flex-wrap justify-between gap-3 items-baseline"><h2>{t('pp_progress')}</h2><span>{digits(progress)}%</span></div>
          <div className="vouch-passport-progress-bar"><span style={{width:`${progress}%`}} /></div>
          <p>{enc}</p>
          {confirmedList.length > 0 && <p>{t('pp_stat_jobs')}: {digits(confirmedList.length)} · {t('pp_stat_earned')}: {hideMoney ? MASK : `NPR ${fmtMoney(earned)}`}</p>}
        </div>
      </section>

      <section id="passport-profile" data-passport-pane="profile" hidden={activeTab !== 'profile'} className="vouch-passport-pane space-y-5">
        <ProfileDetails t={t} lang={lang} user={user} setUser={setUser} showToast={showToast} editRequest={editRequest} />
        <div className="vouch-passport-disclosure">
          <button type="button" aria-expanded={cvExpanded} onClick={() => setCvExpanded(old => !old)}>
            <span>{lang === 'ne' ? 'CV अपलोड गर्नुहोस्' : 'Import CV'}</span>
            <span aria-hidden="true">{cvExpanded ? '−' : '→'}</span>
          </button>
          {cvExpanded && <CVImport user={user} onSave={setUser} lang={lang} />}
        </div>
      </section>

      <section id="passport-skills" data-passport-pane="skills" hidden={activeTab !== 'skills'} className="vouch-passport-pane space-y-7">
        <div className="vouch-passport-section-title">
          <h2>{t('pp_skills_title')}</h2>
          <button type="button" className="vouch-passport-text-action" onClick={() => navTo('skillbridge')}>SkillBridge <span aria-hidden="true">→</span></button>
        </div>
        <form className="vouch-passport-add-skill" onSubmit={addSkill}>
          <label htmlFor="wp-add-skill">{lang === 'ne' ? 'सीप थप्नुहोस्' : 'Add a skill'}</label>
          <div className="flex flex-wrap gap-3">
            <select id="wp-add-skill" value={skillDraft} onChange={event => setSkillDraft(event.target.value)}>
              <option value="">{lang === 'ne' ? 'सीप छान्नुहोस्' : 'Choose a skill'}</option>
              {ALL_SKILLS.filter(skill => !skills.includes(skill)).map(skill => <option key={skill} value={skill}>{skill}</option>)}
            </select>
            <button type="submit" className="vouch-passport-primary" disabled={!skillDraft}>{lang === 'ne' ? 'थप्नुहोस्' : 'Add skill'} <span aria-hidden="true">→</span></button>
          </div>
        </form>
        {!skills.length && <div className="vouch-passport-empty">{lang === 'ne' ? 'अहिलेसम्म सीप थपिएको छैन।' : 'No skills listed yet.'}</div>}
        <div className="vouch-passport-skill-grid">
          {levels.map(({ skill, level }) => (
            <div key={skill} className="vouch-passport-skill-card p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-2"><span className="font-semibold text-lg">{skill}</span><LevelBadge level={level} t={t} /></div>
                  <p className="text-base text-[#475249]">{t('pp_desc_' + level)}</p>
                  {level === 'demonstrated' && <p className="text-sm text-[#70776F] mt-1">{t('pp_source')} {t('pp_src_demo')}</p>}
                  {level === 'institution' && instituteOf(skill, level) && <p className="text-sm text-[#70776F] mt-1">{t('pp_source')} {instituteOf(skill, level)}</p>}
                </div>
                <div className="sm:max-w-[220px] sm:text-right shrink-0">
                  {level === 'demonstrated' && <p className="text-sm text-[#70776F]">{t('pp_next_demo')}</p>}
                  {level === 'institution' && <p className="text-sm text-[#70776F]">{t('pp_next_inst')}</p>}
                  {(level === 'client' || level === 'platform') && <p className="text-sm text-[#70776F] flex items-center gap-2 sm:justify-end"><Check size={16} className="text-[#141614]" /> {t('pp_top')}</p>}
                </div>
              </div>
              <ProofArea skill={skill} items={Array.isArray(evidenceMap[skill]) ? evidenceMap[skill] : []} t={t} digits={digits} onAdd={addProof} onRemove={removeProof} />
            </div>
          ))}
        </div>
        <div className="vouch-passport-proof-explainer">
          <h3>{t('pp_how_title')}</h3>
          <p>{lang === 'ne' ? 'आफ्नो सीप प्रमाणित गर्दै पाँच तह पार गर्नुहोस्।' : 'Each skill grows through five steps as you prove it.'}</p>
          <ol className="vouch-passport-proof-steps">
            {LEVEL_ORDER.map((lv, index) => <li key={lv}>
              <span aria-hidden="true" className="vouch-proof-dot"/>
              <strong>{t('pp_lvl_' + lv)}</strong><p>{t('pp_desc_' + lv)}</p>
            </li>)}
          </ol>
        </div>
      </section>

      <section id="passport-work" data-passport-pane="work" hidden={activeTab !== 'work'} className="vouch-passport-pane space-y-5">
        <h2 className="vouch-passport-section-heading">{t('pp_work_title')}</h2>
        {confirmedList.length === 0 && waiting.length === 0 && <div className="vouch-passport-completed-empty">
          <CheckSquare size={36} aria-hidden="true" />
          <p>{t('pp_work_empty')}</p>
          <button type="button" onClick={() => navTo('firstwork')} className="vouch-passport-primary">{t('pp_find_job')} <span aria-hidden="true">→</span></button>
        </div>}
        {waiting.length > 0 && <div className="space-y-4">
          <h3 className="font-semibold text-lg">{t('pp_applied_head')}</h3>
          {waiting.map(a => { const j = allJobs.find(x => x.id === a.jobId); if (!j) return null; return (
            <div key={a.jobId} className="vouch-passport-work-card space-y-2">
              <strong>{j.title}</strong><p>{j.clientName}</p>
              <p>NPR {hideMoney ? MASK : fmtMoney(a.npr || a.price * 133)}</p>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-[#E7F0E9]"><CheckCircle2 size={16}/>{t('applied_status')}</span>
              {allowDemoConfirm && <button type="button" onClick={() => confirmJob(j.id)} className="vouch-passport-outline">{t('pp_demo_confirm')} <span aria-hidden="true">→</span></button>}
            </div>); })}
        </div>}
        {confirmedList.length > 0 && <div className="space-y-4">
          <h3 className="font-semibold text-lg">{t('pp_done_head')}</h3>
          {confirmedList.map(j => <div key={j.id} className="vouch-passport-work-card space-y-2">
            <strong>{j.title}</strong><p>{j.clientName}</p><LevelBadge level="client" t={t}/>
            <p className="font-semibold">{fmt(t('pp_earned_line'), {n:hideMoney ? MASK : fmtMoney(j.budgetUSD * 133)})}</p>
            <p className="text-sm">{t('pp_confirmed_demo')}</p>
          </div>)}
        </div>}
      </section>

      <section id="passport-settings" data-passport-pane="settings" hidden={activeTab !== 'settings'} className="vouch-passport-pane space-y-5">
        <h2 className="vouch-passport-section-heading">{lang === 'ne' ? 'सेटिङ र गोपनीयता' : 'Settings & privacy'}</h2>
        <button type="button" onClick={() => navTo('vault')} className="vouch-passport-link-card">
          <Lock size={22} aria-hidden="true"/><span><strong>{t('ev_title')}</strong><small>{fmt(t('ev_count'), {n:digits(Array.isArray(evidence) ? evidence.length : 0)})}</small></span><span aria-hidden="true">→</span>
        </button>
        <button type="button" onClick={() => navTo('skillbridge')} className="vouch-passport-link-card">
          <TrendingUp size={22} aria-hidden="true"/><span><strong>{t('sb_title')}</strong><small>{t('sb_card_line')}</small></span><span aria-hidden="true">→</span>
        </button>
        <PaymentSettings lang={lang} showToast={showToast}/>
        <div className="vouch-passport-settings-card space-y-4">
          <h3>{t('pp_pay_title')}</h3>
          <div className="space-y-3">{[0,1,2,3].map(i => {
            const on = !!(payChecklist && payChecklist[i]); return <button key={i} type="button" role="checkbox" aria-checked={on} onClick={() => togglePay(i)} className="vouch-passport-checkline">
              {on ? <CheckSquare size={20}/> : <Square size={20}/>}<span>{t('pp_pay_' + (i+1))}</span>
            </button>; })}</div>
          <Disclaimer t={t} k="disc_pay"/>
          <NetPayCalculator t={t}/>
          <h3>{t('pp_rules_title')}</h3>
          <div className="space-y-3">{RULE_KEYS.map(k => <RuleToggle key={k} label={t('rule_' + k)} on={!!rules[k]} onClick={() => toggleRule(k)} />)}</div>
        </div>
        <PrivacySection t={t} settings={settings} setSettings={setSettings} onSharedEnabled={onSharedEnabled}/>
      </section>

      {/* Share modal */}
      {shareOpen && (
        <div className="fixed inset-0 z-50 bg-[#141614]/40 flex items-center justify-center p-4" onClick={() => setShareOpen(false)}>
          <div className="bg-white rounded-[20px] border border-[#E3E6E1] p-6 sm:p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-2xl mb-3">{t('pp_share')}</h3>
            <p className="text-base text-[#475249] mb-5">{t('pp_share_desc')}</p>
            <div className="bg-[#F7F7F4] border border-[#E3E6E1] rounded-[14px] px-4 py-3 text-base font-semibold break-all mb-5">{link}</div>
            <div className="space-y-3">
              <button onClick={copyLink} className="w-full py-3.5 bg-[#003D14] text-white font-semibold text-base rounded-full hover:bg-[#0E5C2A] min-h-[52px]">{t('pp_copy_link')}</button>
              <a href={`https://wa.me/?text=${encodeURIComponent(remoteShare || 'https://' + link)}`} target="_blank" rel="noopener noreferrer" className="w-full py-3.5 border border-[#E3E6E1] bg-white text-[#141614] font-semibold text-base rounded-full hover:bg-[#F7F7F4] min-h-[52px] flex items-center justify-center">{t('pp_whatsapp')}</a>
              <button onClick={() => setShareOpen(false)} className="w-full py-3 text-[#475249] font-semibold text-base rounded-full hover:bg-[#F7F7F4] min-h-[48px]">{t('pp_close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
