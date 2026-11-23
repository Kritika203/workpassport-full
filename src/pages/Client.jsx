// Client demo job posting screen.

import { AlertTriangle, CheckCircle2, Info, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CL_CARD, CL_INPUT, CL_LABEL, ClientToggle } from '../components/client/ClientControls.jsx';
import { Disclaimer } from '../components/common/Disclaimer.jsx';
import { ALL_CATEGORIES, DEMO_APPLICANTS } from '../data/demo.js';
import { ClientDashboard } from '../components/client/ClientDashboard.jsx';
import { DUMMY_JOBS } from '../data/jobs.js';
import { fmt, fmtMoney, toDigits } from '../utils/format.js';
import { ALL_FORMATS, specSizeCap, validateSpec } from '../utils/deliverables.js';
import { JOB_TEMPLATES } from '../data/templates.js';

const emptySpec = () => ({ name: '', description: '', quantity: 1, formats: [], max_mb: 10, link_allowed: false, milestone: null });
const FORMAT_GROUPS = [
  { en: 'Images and design', ne: 'तस्बिर र डिजाइन', extensions: ['png','jpg','jpeg','svg','webp','gif','psd','ai','fig'] },
  { en: 'Documents and data', ne: 'कागजात र डाटा', extensions: ['pdf','docx','txt','xlsx','csv'] },
  { en: 'Video and audio', ne: 'भिडियो र अडियो', extensions: ['mp4','mov','mp3','wav'] },
  { en: 'Archives', ne: 'फाइल समूह', extensions: ['zip'] },
];

const SPEC_ERR_TEXT = {
  name: ['Give this deliverable a name (at least 3 letters).', 'यस डेलिभरेबललाई नाम दिनुहोस् (कम्तीमा ३ अक्षर)।'],
  description: ['Describe it exactly (at least 20 characters): size, content, and what “done” looks like.', 'ठीकसँग वर्णन गर्नुहोस् (कम्तीमा २० अक्षर): साइज, सामग्री, र “सकिएको” भनेको के हो।'],
  quantity: ['Quantity must be from 1 to 999.', 'सङ्ख्या १ देखि ९९९ सम्म हुनुपर्छ।'],
  formats: ['Choose at least one file format.', 'कम्तीमा एउटा फाइल ढाँचा छान्नुहोस्।'],
  size: ['The max size is too large for the chosen formats.', 'छानिएका ढाँचाका लागि अधिकतम साइज धेरै ठूलो भयो।'],
};



export function ClientView({ t, lang, navTo, showToast, clientJobs, setClientJobs, scrollTo, clientMode = false, clientProfile = null, onPost = null, applications = [], workrooms = {} }) {
  const demoData = useMemo(() => {
    if (onPost) return null;
    const byStatus = { published: 0, pending_review: 0, rejected: 0, closed: 0 };
    clientJobs.forEach(j => { const s = j.status || 'published'; byStatus[s] = (byStatus[s] || 0) + 1; });
    const reviewItems = [];
    const spentByJob = [];
    let releasedTotal = 0;
    let agreedTotal = 0;
    Object.entries(workrooms || {}).forEach(([jobId, wr]) => {
      const job = clientJobs.find(j => j.id === jobId);
      if (!job) return;
      const ms = (wr && wr.milestones) || [];
      if (!ms.length) return;
      const agreed = ms.reduce((a, m) => a + (m.amountUSD || 0), 0);
      const released = ms.filter(m => m.state === 'released').reduce((a, m) => a + (m.amountUSD || 0), 0);
      agreedTotal += agreed; releasedTotal += released;
      spentByJob.push({ job_id: null, job_title: job.title, released_usd: String(released), agreed_usd: String(agreed) });
      ms.filter(m => m.state === 'submitted').forEach(m => reviewItems.push({
        job_key: jobId, job_title: job.title, milestone_title: m.title,
        applicant_name: (job.accepted && job.accepted.applicantName) || 'Freelancer', amount_usd: String(m.amountUSD || 0),
      }));
    });
    return {
      jobs_by_status: byStatus, total_jobs: clientJobs.length,
      applicants_waiting: clientJobs.filter(j => !j.accepted).length * DEMO_APPLICANTS.length,
      shortlisted: 0, review_items: reviewItems,
      total_released_usd: String(releasedTotal), total_agreed_usd: String(agreedTotal),
      spent_by_job: spentByJob,
    };
  }, [clientJobs, workrooms, onPost]);
  const digits = (n) => toDigits(n, lang);
  const skillOptions = useMemo(() => [...new Set(DUMMY_JOBS.flatMap(j => j.skillsRequired))], []);
  const [name, setName] = useState(clientMode && clientProfile
    ? (clientProfile.business ? `${clientProfile.name} (${clientProfile.business})` : clientProfile.name) : '');
  const [jobLocation, setJobLocation] = useState(onPost ? '' : 'Nepal');
  const firstName = (clientProfile?.name || '').trim().split(/\s+/)[0] || (lang === 'ne' ? 'रोजगारदाता' : 'Employer');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORIES[0]);
  const [desc, setDesc] = useState('');
  const [specs, setSpecs] = useState([emptySpec()]);
  const [specErrors, setSpecErrors] = useState([]);
  const [budgetHint, setBudgetHint] = useState(null);
  const applyTemplate = (categoryName) => {
    const tpl = JOB_TEMPLATES.find(x => x.category === categoryName);
    if (!tpl) { setBudgetHint(null); return; }
    setCategory(tpl.category);
    setSkills(tpl.skills.filter(s => skillOptions.includes(s)));
    setSpecs(tpl.specs.map(s => ({ ...s, formats: [...s.formats] })));
    setSpecErrors([]);
    setBudgetHint([tpl.budgetLow, tpl.budgetHigh]);
  };
  const [skills, setSkills] = useState([]);
  const [budget, setBudget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [revisions, setRevisions] = useState('1');
  const [laptop, setLaptop] = useState(false);
  const [internet, setInternet] = useState('Basic');
  const [meeting, setMeeting] = useState('Flexible — no meetings');
  const [beginners, setBeginners] = useState(true);
  const [error, setError] = useState(false);
  const mineRef = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    if (scrollTo === 'mine' && mineRef.current) mineRef.current.scrollIntoView({ block: 'start' });
    if (scrollTo === 'form' && formRef.current) formRef.current.scrollIntoView({ block: 'start' });
  }, [scrollTo]);

  const submit = async () => {
    const dl = specs.map(s => ({ ...s, name: s.name.trim(), description: s.description.trim(), quantity: Number(s.quantity), max_mb: Number(s.max_mb) }));
    const errs = dl.map(validateSpec);
    setSpecErrors(errs);
    const b = Number(budget);
    const d = Number(deadline);
    if (!title.trim() || (onPost && !jobLocation.trim()) || dl.length < 1 || errs.some(e => e.length) || skills.length < 1 || !(Math.round(b) >= 1) || !(d >= 1)) { setError(true); return; }
    const r = Number(revisions);
    const job = {
      id: 'c' + Date.now(),
      title: title.trim(),
      category,
      clientName: name.trim() || 'Client (demo)',
      clientCountry: jobLocation.trim() || 'Not specified',
      clientType: onPost ? 'Client listing' : 'Client (demo)',
      paymentVerified: false,
      beginnerFriendly: beginners,
      description: desc.trim(),
      skillsRequired: skillOptions.filter(x => skills.includes(x)),
      budgetUSD: Math.round(b),
      budgetType: 'fixed',
      postedHoursAgo: 0,
      applicants: onPost ? 0 : 3,
      jobsPostedByClient: 1,
      hireRate: 0,
      memberSince: 2026,
      clientRating: 0,
      aboutClient: onPost ? 'Pending review; not yet published.' : 'Posted from the client demo.',
      needsOwnLaptop: laptop,
      internetNeed: internet,
      meetingTimeNepal: meeting.trim() || 'Flexible — no meetings',
      deadlineDays: Math.round(d),
      caution: null,
      deliverables: dl,
      clientProvides: [],
      revisionsIncluded: revisions !== '' && r >= 0 ? Math.floor(r) : 1,
      accepted: null,
    };
    if (onPost) {
      try { const created = await onPost(job); job.apiId = created.id; job.id = `api-${created.id}`; job.status = created.status || 'pending_review'; job.aboutClient = 'Pending review. This job is not publicly listed yet.'; }
      catch (err) { showToast(err.message || 'Could not submit the job.'); return; }
    }
    setClientJobs([job, ...clientJobs]);
    setError(false);
    setName(''); setTitle(''); setCategory(ALL_CATEGORIES[0]); setDesc(''); setSpecs([emptySpec()]); setSpecErrors([]); setSkills([]);
    setBudget(''); setDeadline(''); setRevisions('1'); setLaptop(false); setInternet('Basic'); setMeeting('Flexible — no meetings'); setBeginners(true);
    showToast(t('cl_toast_posted'));
    setTimeout(() => { if (mineRef.current) mineRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {clientMode ? (
        <div>
          <h1 className="text-[28px] sm:text-[30px] font-semibold mb-2">{t('cm_home')}</h1>
          <p className="text-lg font-semibold mb-1">
            {onPost ? (lang === 'ne' ? `स्वागत छ, ${firstName}` : `Welcome, ${firstName}`) : t('cm_greeting')}
          </p>
          <p className="text-base text-[#475249] mb-4 leading-[1.6]">
            {onPost
              ? (clientProfile?.business
                ? (lang === 'ne'
                  ? `${clientProfile.business}${clientProfile.town ? ` (${clientProfile.town})` : ''} का काम, आवेदन र वर्करुम यहाँ व्यवस्थापन गर्नुहोस्।`
                  : `Manage jobs, applicants and workrooms for ${clientProfile.business}${clientProfile.town ? ` in ${clientProfile.town}` : ''}.`)
                : (lang === 'ne'
                  ? 'यहाँबाट आफ्ना कामका अवसर, आवेदन र वर्करुम व्यवस्थापन गर्नुहोस्।'
                  : 'Manage your job posts, applications and workrooms here.'))
              : t('cm_profile_line')}
          </p>
          <ClientDashboard lang={lang} connected={!!onPost} demoData={demoData}
            onOpenApplicants={(jobKey) => {
              if (onPost) { if (jobKey) navTo('client-applicants', { id: jobKey }); else navTo('client-inbox'); }
              else navTo('client-applicants', { id: jobKey || (clientJobs.find(j => !j.accepted) || clientJobs[0] || {}).id });
            }}
            onOpenReview={(item) => {
              if (onPost) navTo('client-workroom', { appId: item.application_id });
              else navTo('workroom', { id: item.job_key });
            }} />
          <button onClick={() => { if (formRef.current) formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="bg-[#003D14] text-white px-6 rounded-full font-semibold text-base hover:bg-[#0E5C2A] min-h-[52px] mb-4">
            {t('cm_post_new')}
          </button>
          <Disclaimer t={t} k="disc_client" />
        </div>
      ) : (
        <div className="bg-[#FAF0EE] border border-[#F3E1DD] rounded-[20px] p-4 flex items-start gap-3">
          <Info size={20} className="shrink-0 mt-0.5 text-[#AE332A]" />
          <p className="text-base text-[#141614]">{t('cl_demo_note')}</p>
        </div>
      )}

      <div ref={formRef} className={`${CL_CARD} space-y-5 scroll-mt-32`}>
        <div>
          <label htmlFor="cl-template" className={CL_LABEL}>{lang === 'ne' ? 'टेम्प्लेटबाट सुरु गर्नुहोस् (ऐच्छिक)' : 'Start from a template (optional)'}</label>
          <select id="cl-template" defaultValue="" onChange={e => applyTemplate(e.target.value)} className={CL_INPUT}>
            <option value="">{lang === 'ne' ? 'टेम्प्लेट छैन' : 'No template'}</option>
            {JOB_TEMPLATES.map(x => <option key={x.category} value={x.category}>{x.category}</option>)}
          </select>
          <p className="text-sm text-[#687169] mt-1">{lang === 'ne'
            ? 'टेम्प्लेटले सीप, डेलिभरेबल विवरण र उचित बजेट दायरा भरिदिन्छ। सबै पछि सच्याउन सकिन्छ।'
            : 'A template pre-fills the skills, deliverable specs and a fair budget range. You can edit everything after.'}</p>
        </div>
        <div>
          <label htmlFor="cl-name" className={CL_LABEL}>{t('cl_f_name')}</label>
          <input id="cl-name" type="text" value={name} onChange={e => setName(e.target.value)} className={CL_INPUT} />
        </div>
        <div>
          <label htmlFor="cl-location" className={CL_LABEL}>
            {lang === 'ne' ? 'कामको स्थान (देश वा सहर)' : 'Job location (country or city)'}
          </label>
          <input id="cl-location" type="text" value={jobLocation} maxLength={100}
            onChange={e => setJobLocation(e.target.value)} className={CL_INPUT}
            placeholder={lang === 'ne' ? 'उदाहरण: काठमाडौं, नेपाल वा Remote' : 'e.g. Kathmandu, Nepal or Remote'}
            aria-required={!!onPost} />
          {onPost && <p className="text-sm text-[#687169] mt-1">
            {lang === 'ne' ? 'यो स्थान काम खोज्ने व्यक्तिहरूलाई देखिन्छ।' : 'This location will appear on the public job listing.'}
          </p>}
        </div>
        <div>
          <label htmlFor="cl-title" className={CL_LABEL}>{t('cl_f_title')}</label>
          <input id="cl-title" type="text" value={title} onChange={e => setTitle(e.target.value)} className={CL_INPUT} />
        </div>
        <div>
          <label htmlFor="cl-cat" className={CL_LABEL}>{t('cl_f_category')}</label>
          <select id="cl-cat" value={category} onChange={e => setCategory(e.target.value)} className={CL_INPUT}>
            {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cl-desc" className={CL_LABEL}>{t('cl_f_desc')}</label>
          <textarea id="cl-desc" rows={4} value={desc} onChange={e => setDesc(e.target.value)} className={CL_INPUT} />
        </div>
      </div>

      <div className={`${CL_CARD} space-y-4`}>
        <div>
          <div className={CL_LABEL}>{t('cl_f_deliv')}</div>
          <p className="text-sm text-[#687169] mt-1">{lang === 'ne'
            ? 'फ्रीलान्सरले ठीक के बुझाउनुपर्छ, स्पष्ट लेख्नुहोस्। अस्पष्ट डेलिभरेबल नै विवादको मुख्य कारण हो। हरेक डेलिभरेबलको नाम, ठीक वर्णन, सङ्ख्या, ढाँचा र अधिकतम साइज दिनुहोस्।'
            : 'Say exactly what the freelancer must hand over. Vague deliverables are the top cause of disputes. Give every deliverable a name, an exact description, a quantity, formats and a max file size.'}</p>
        </div>
        {specs.map((s, i) => {
          const cap = specSizeCap(s);
          const sizeOptions = [1, 5, 10, 25, 50, 100].filter(v => v <= cap);
          const errs = specErrors[i] || [];
          const set = (patch) => setSpecs(prev => prev.map((x, k) => k === i ? { ...x, ...patch } : x));
          const toggleFormat = (f) => {
            const formats = s.formats.includes(f) ? s.formats.filter(x => x !== f) : [...s.formats, f];
            const next = { formats };
            const newCap = specSizeCap({ ...s, formats });
            if (Number(s.max_mb) > newCap) next.max_mb = newCap;
            set(next);
          };
          return (
            <div key={i} className="border border-[#E3E6E1] rounded-[14px] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-base">{lang === 'ne' ? `डेलिभरेबल ${digits(i + 1)}` : `Deliverable ${digits(i + 1)}`}</span>
                {specs.length > 1 && (
                  <button type="button" onClick={() => setSpecs(prev => prev.filter((_, k) => k !== i))} className="text-sm font-semibold text-[#AE332A] underline min-h-[36px] px-2">
                    {lang === 'ne' ? 'हटाउनुहोस्' : 'Remove'}
                  </button>
                )}
              </div>
              <div>
                <label htmlFor={`spec-name-${i}`} className={CL_LABEL}>{lang === 'ne' ? 'नाम' : 'Name'}</label>
                <input id={`spec-name-${i}`} type="text" maxLength={120} value={s.name} onChange={e => set({ name: e.target.value })} className={CL_INPUT}
                  placeholder={lang === 'ne' ? 'उदाहरण: लोगो फाइल' : 'e.g. Logo file'} />
              </div>
              <div>
                <label htmlFor={`spec-desc-${i}`} className={CL_LABEL}>{lang === 'ne' ? 'ठीक वर्णन' : 'Exact description'}</label>
                <textarea id={`spec-desc-${i}`} rows={2} maxLength={1000} value={s.description} onChange={e => set({ description: e.target.value })} className={CL_INPUT}
                  placeholder={lang === 'ne' ? 'उदाहरण: पारदर्शी पृष्ठभूमि भएको PNG लोगो, २००० पिक्सेल चौडा, छाप्न मिल्ने।' : 'e.g. PNG logo with a transparent background, 2000px wide, print-ready.'} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`spec-qty-${i}`} className={CL_LABEL}>{lang === 'ne' ? 'सङ्ख्या' : 'Quantity'}</label>
                  <input id={`spec-qty-${i}`} type="number" min="1" max="999" value={s.quantity} onChange={e => set({ quantity: e.target.value })} className={CL_INPUT} />
                </div>
                <div>
                  <label htmlFor={`spec-ms-${i}`} className={CL_LABEL}>{lang === 'ne' ? 'कुन माइलस्टोनका लागि' : 'For which milestone'}</label>
                  <select id={`spec-ms-${i}`} value={s.milestone ?? ''} onChange={e => set({ milestone: e.target.value === '' ? null : Number(e.target.value) })} className={CL_INPUT}>
                    <option value="">{lang === 'ne' ? 'पूरै काम' : 'Whole job'}</option>
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{lang === 'ne' ? `माइलस्टोन ${digits(n)}` : `Milestone ${n}`}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div className={CL_LABEL}>{lang === 'ne' ? 'मिल्ने फाइल ढाँचा' : 'Allowed file formats'}</div>
                <details className="vouch-formats-picker">
                  <summary>
                    <span>{lang === 'ne' ? 'फाइल प्रकार छान्नुहोस्' : 'Choose file formats'}</span>
                    <small>{s.formats.length
                      ? `${s.formats.length} selected · ${s.formats.slice(0, 3).map(f => f.toUpperCase()).join(', ')}${s.formats.length > 3 ? ` +${s.formats.length - 3}` : ''}`
                      : (lang === 'ne' ? 'अहिलेसम्म छानिएको छैन' : 'None selected')}</small>
                  </summary>
                  <div className="vouch-formats-groups">
                    {FORMAT_GROUPS.map(group => {
                      const available = ALL_FORMATS.filter(f => group.extensions.includes(f));
                      return available.length ? <fieldset key={group.en}>
                        <legend>{lang === 'ne' ? group.ne : group.en}</legend>
                        <div className="vouch-formats-options">
                          {available.map(f => <button
                            key={f} type="button" aria-pressed={s.formats.includes(f)}
                            onClick={() => toggleFormat(f)}
                            className={s.formats.includes(f) ? 'is-selected' : ''}
                          >{f.toUpperCase()}</button>)}
                        </div>
                      </fieldset> : null;
                    })}
                    {ALL_FORMATS.some(f => !FORMAT_GROUPS.some(g => g.extensions.includes(f))) &&
                      <fieldset><legend>{lang === 'ne' ? 'अन्य' : 'Other'}</legend><div className="vouch-formats-options">
                        {ALL_FORMATS.filter(f => !FORMAT_GROUPS.some(g => g.extensions.includes(f))).map(f =>
                          <button key={f} type="button" aria-pressed={s.formats.includes(f)}
                            onClick={() => toggleFormat(f)} className={s.formats.includes(f) ? 'is-selected' : ''}>{f.toUpperCase()}</button>)}
                      </div></fieldset>}
                  </div>
                </details>
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label htmlFor={`spec-size-${i}`} className={CL_LABEL}>{lang === 'ne' ? 'अधिकतम फाइल साइज' : 'Max file size'}</label>
                  <select id={`spec-size-${i}`} value={s.max_mb} disabled={!s.formats.length} onChange={e => set({ max_mb: Number(e.target.value) })} className={CL_INPUT}>
                    {sizeOptions.map(v => <option key={v} value={v}>{v} MB</option>)}
                  </select>
                </div>
                <ClientToggle label={lang === 'ne' ? 'लिङ्क पनि पठाउन मिल्ने' : 'Link allowed too'} on={s.link_allowed} onChange={v => set({ link_allowed: v })} />
              </div>
              {errs.length > 0 && (
                <div role="alert" className="bg-[#FAF0EE] border border-[#F3E1DD] rounded-[10px] p-3 space-y-1">
                  {errs.map(code => <p key={code} className="text-sm text-[#AE332A]">{lang === 'ne' ? SPEC_ERR_TEXT[code][1] : SPEC_ERR_TEXT[code][0]}</p>)}
                </div>
              )}
            </div>
          );
        })}
        {specs.length < 5 && (
          <button type="button" onClick={() => setSpecs(prev => [...prev, emptySpec()])} className="min-h-[48px] px-5 rounded-full bg-white border border-[#E3E6E1] text-[#141614] font-semibold text-base hover:bg-[#F7F7F4] flex items-center gap-2">
            <Plus size={20} /> {t('cl_add_one')}
          </button>
        )}
      </div>

      <div className={CL_CARD}>
        <div className={CL_LABEL}>{t('cl_f_skills')}</div>
        <div className="flex flex-wrap gap-2">
          {skillOptions.map(sk => {
            const on = skills.includes(sk);
            return (
              <button key={sk} type="button" aria-pressed={on} onClick={() => setSkills(prev => prev.includes(sk) ? prev.filter(x => x !== sk) : [...prev, sk])}
                className={`min-h-[44px] px-4 rounded-full border text-base font-medium ${on ? 'bg-[#FAF0EE] border-[#003D14] text-[#AE332A]' : 'bg-white border-[#E3E6E1] text-[#475249] hover:bg-[#F7F7F4]'}`}>
                {sk}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`${CL_CARD} space-y-5`}>
        <div>
          <label htmlFor="cl-budget" className={CL_LABEL}>{t('cl_f_budget')}</label>
          <input id="cl-budget" type="number" inputMode="numeric" min="1" value={budget} onChange={e => setBudget(e.target.value)} className={CL_INPUT} />
          {budgetHint && <p className="text-sm text-[#687169] mt-1">{lang === 'ne'
            ? `यस किसिमको कामको उचित दायरा: $${budgetHint[0]}–$${budgetHint[1]} (NPR ${fmtMoney(budgetHint[0] * 133)}–${fmtMoney(budgetHint[1] * 133)})`
            : `Fair range for this kind of work: $${budgetHint[0]}–$${budgetHint[1]} (NPR ${fmtMoney(budgetHint[0] * 133)}–${fmtMoney(budgetHint[1] * 133)})`}</p>}
        </div>
        <div>
          <label htmlFor="cl-deadline" className={CL_LABEL}>{t('cl_f_deadline')}</label>
          <input id="cl-deadline" type="number" inputMode="numeric" min="1" value={deadline} onChange={e => setDeadline(e.target.value)} className={CL_INPUT} />
        </div>
        <div>
          <label htmlFor="cl-rev" className={CL_LABEL}>{t('cl_f_revisions')}</label>
          <input id="cl-rev" type="number" inputMode="numeric" min="0" value={revisions} onChange={e => setRevisions(e.target.value)} className={CL_INPUT} />
        </div>
      </div>

      <div className={`${CL_CARD} space-y-4`}>
        <h2 className="text-xl font-semibold">{t('cl_req_head')}</h2>
        <ClientToggle label={t('cl_f_laptop')} on={laptop} onChange={setLaptop} />
        <div>
          <label htmlFor="cl-net" className={CL_LABEL}>{t('cl_f_internet')}</label>
          <select id="cl-net" value={internet} onChange={e => setInternet(e.target.value)} className={CL_INPUT}>
            <option value="Basic">Basic</option>
            <option value="Good">Good</option>
          </select>
        </div>
        <div>
          <label htmlFor="cl-meet" className={CL_LABEL}>{t('cl_f_meeting')}</label>
          <input id="cl-meet" type="text" value={meeting} onChange={e => setMeeting(e.target.value)} className={CL_INPUT} />
        </div>
        <ClientToggle label={t('cl_f_beginners')} on={beginners} onChange={setBeginners} />
      </div>

      {error && (
        <div role="alert" className="bg-[#FAF0EE] border border-[#F3E1DD] rounded-[14px] p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="shrink-0 mt-0.5 text-[#AE332A]" />
          <p className="text-base text-[#141614]">{t('cl_error')}</p>
        </div>
      )}
      <button type="button" onClick={submit} className="w-full bg-[#003D14] text-white py-3.5 rounded-full font-semibold text-lg hover:bg-[#0E5C2A] min-h-[52px]">
        {t('cl_submit')}
      </button>

      <div ref={mineRef} className="pt-4 scroll-mt-24">
        <h2 className="text-[22px] font-semibold mb-4">{t('cl_my_jobs')}</h2>
        {clientJobs.length === 0 ? (
          <p className="text-base text-[#475249]">{t('cl_none')}</p>
        ) : (
          <div className="space-y-4">
            {clientJobs.map(j => (
              <div key={j.id} className={CL_CARD}>
                <div className="font-semibold text-xl mb-1 break-words">{j.title}</div>
                {onPost && j.status && <span className="inline-block bg-[#E7F0E9] text-[#475249] px-3 py-1 rounded-full text-[13px] mb-2 mr-2">{j.status === 'pending_review' ? (lang === 'ne' ? 'समीक्षामा' : 'Pending review') : j.status === 'published' ? (lang === 'ne' ? 'प्रकाशित' : 'Published') : j.status === 'rejected' ? (lang === 'ne' ? 'अस्वीकृत' : 'Rejected') : (lang === 'ne' ? 'बन्द' : 'Closed')}</span>}
                {j.seededDemo && (
                  <span className="inline-block bg-[#E7F0E9] text-[#141614] px-3 py-1 rounded-full text-[13px] font-semibold mb-2">{t('cm_seed_chip')}</span>
                )}
                <div className="text-base text-[#475249] mb-4">{j.clientName} · ${fmtMoney(j.budgetUSD)} (NPR {fmtMoney(j.budgetUSD * 133)}) · {fmt(t('wr_days'), { days: digits(j.deadlineDays) })}</div>
                {j.accepted && (
                  <div className="bg-[#FAF0EE] border border-[#F3E1DD] rounded-[14px] p-4 mb-4 space-y-2">
                    <div className="flex items-start gap-2 text-base font-semibold text-[#141614]"><CheckCircle2 size={20} className="shrink-0 mt-0.5 text-[#003D14]" /> <span>{fmt(t('ag_made'), { name: j.accepted.applicantName })}</span></div>
                    <p className="text-base text-[#475249]">{t('ag_full_product')}</p>
                  </div>
                )}
                <button onClick={() => navTo('client-applicants', { id: j.id })} className="w-full sm:w-auto bg-[#003D14] text-white px-6 rounded-full font-semibold text-base hover:bg-[#0E5C2A] min-h-[48px]">
                  {t('cl_view_applicants')}
                </button>
                <button type="button" onClick={() => navTo('job-feedback', { id: j.id })} className="ml-0 sm:ml-3 mt-2 sm:mt-0 rounded-full border border-[#d6ded2] px-5 min-h-[44px] font-semibold text-sm text-[#003D14]">Read worker feedback</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
