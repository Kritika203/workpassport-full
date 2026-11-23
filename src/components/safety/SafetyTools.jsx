// Safety check-ins and chat controls.

import { Check, CheckCircle2, ChevronLeft, EyeOff, HeartHandshake, Info, MessageCircle, MessageSquare, Moon, Phone, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNow } from '../../hooks/useNow.js';
import { isQuietActive } from '../../services/quietHours.js';
import { copyToClipboard } from '../../utils/clipboard.js';
import { fmt, spClock, spDigits, smsHref, telHref, waHref } from '../../utils/format.js';
import { Disclaimer } from '../common/Disclaimer.jsx';
import { ToggleKnob } from '../privacy/Privacy.jsx';



const SP_INPUT = "w-full border border-[#e5e7dd] bg-white rounded-[14px] px-4 text-base min-h-[48px] outline-none focus:border-[#59684a] focus:ring-2 focus:ring-[#59684a]/30 disabled:bg-[#F6F4EF]";

const SP_PRIMARY = "inline-flex items-center justify-center gap-2 bg-[#59684a] text-white rounded-full font-semibold text-base hover:bg-[#415947] min-h-[52px] px-6 disabled:opacity-50 disabled:hover:bg-[#59684a]";

const SP_SECONDARY = "inline-flex items-center justify-center gap-2 border border-[#E3E0D9] bg-white text-[#1C1B1A] rounded-full font-semibold text-base hover:bg-[#F6F4EF] min-h-[48px] px-6 disabled:opacity-50";

export function TrustedContactCard({ t, lang, user, allJobs, appliedJobs, trusted, setTrusted, checkin, setCheckin, showToast }) {
  const [editing, setEditing] = useState(false);
  const [nm, setNm] = useState("");
  const [ph, setPh] = useState("");
  const [jobId, setJobId] = useState("");
  const [mins, setMins] = useState(30);
  const [clientTyped, setClientTyped] = useState("");
  const planRef = useRef(null);
  const now = useNow(20000); // re-checked when the page opens and every 20 seconds

  const seen = new Set();
  const options = [];
  (Array.isArray(appliedJobs) ? appliedJobs : []).forEach(a => {
    if (!a || seen.has(a.jobId)) return;
    seen.add(a.jobId);
    const j = (allJobs || []).find(x => x.id === a.jobId);
    const title = (j && j.title) || a.title || '';
    const client = (j && j.clientName) || a.clientName || '';
    if (title || client) options.push({ id: a.jobId, title, client });
  });
  const hasJobs = options.length > 0;
  const selected = options.find(o => o.id === jobId) || options[0] || null;
  const clientName = hasJobs ? selected.client : clientTyped.trim();
  const jobTitle = hasJobs ? selected.title : "";
  const userName = (user && user.name) || '';

  const showForm = !trusted || editing;
  const saveContact = (e) => {
    e.preventDefault();
    if (!nm.trim() || !smsHref(ph, 'test')) return;
    setTrusted({ name: nm.trim(), phone: ph.trim() });
    setEditing(false);
  };
  const startEdit = () => { setNm(trusted.name); setPh(trusted.phone); setEditing(true); };

  const ck = checkin && typeof checkin === 'object' && checkin.byISO ? checkin : null;
  const waiting = !!ck && ck.status === 'waiting';
  const overdue = waiting && now > Date.parse(ck.byISO);
  const safe = !!ck && ck.status === 'safe';

  const controlsOff = !trusted || (!hasJobs && !clientName);
  const sig = `${selected ? selected.id : ''}|${clientName}|${mins}`;
  const planIso = () => {
    const c = planRef.current;
    if (c && c.sig === sig && Date.parse(c.iso) > Date.now()) return c.iso;
    const iso = new Date(Date.now() + mins * 60000).toISOString();
    planRef.current = { sig, iso };
    return iso;
  };
  const buildMsg = (iso) => fmt(t(jobTitle ? 'sp_ci_msg_job' : 'sp_ci_msg_nojob'), { contactName: trusted.name, clientName, jobTitle, time: spClock(iso, lang), userName });
  const buildOverdueMessage = () => fmt(t(ck.jobTitle ? 'sp_ci_sos_job' : 'sp_ci_sos_nojob'), {
    contactName: trusted?.name || ck.contactName || '',
    clientName: ck.clientName || '', jobTitle: ck.jobTitle || '',
    time: spClock(ck.byISO, lang), userName,
  });
  const buildSafeMessage = () => fmt(t('sp_ci_sms_safe_msg'), {
    contactName: trusted?.name || ck?.contactName || '', userName,
  });
  const buildWaitingPlan = () => fmt(t(ck.jobTitle ? 'sp_ci_msg_job' : 'sp_ci_msg_nojob'), {
    contactName: trusted?.name || ck.contactName || '',
    clientName: ck.clientName || '', jobTitle: ck.jobTitle || '',
    time: spClock(ck.byISO, lang), userName,
  });
  const buildEmergencyMessage = () => fmt(t('sp_em_sos_msg'), { userName });
  const copyPlan = async () => {
    if (controlsOff) return;
    const copied = await copyToClipboard(buildMsg(planIso()));
    showToast(t(copied ? 'sp_ci_sms_copied' : 'sp_ci_sms_copy_fail'));
  };
  const startCheckin = () => {
    if (controlsOff) return;
    const iso = planIso();
    planRef.current = null;
    setCheckin({ clientName, jobTitle, contactName: trusted.name, byISO: iso, status: 'waiting' });
  };
  const imSafe = () => setCheckin({ ...ck, status: 'safe' });

  const DURS = [[2, 'sp_ci_d2'], [30, 'sp_ci_d30'], [60, 'sp_ci_d60'], [120, 'sp_ci_d120']];
  const lbl = "block text-base font-semibold mb-2";
  return (
    <div>
      <div className={`rounded-[20px] p-6 border ${overdue ? 'bg-[#FAF0EE] border-[#59684a]' : 'bg-white border-[#e5e7dd]'}`} role={overdue ? 'alert' : undefined}>
        <h2 className="font-semibold text-[22px] mb-2 flex items-center gap-3"><HeartHandshake size={24} className="text-[#59684a] shrink-0" /> {t('sp_tc_title')}</h2>
        <p className="text-base text-[#4A4744] mb-5">{t('sp_tc_intro')}</p>

        {showForm ? (
          <form onSubmit={saveContact} className="space-y-4">
            <div>
              <label htmlFor="sp-tc-name" className={lbl}>{t('sp_tc_name')}</label>
              <input id="sp-tc-name" type="text" autoComplete="off" value={nm} onChange={e => setNm(e.target.value)} className={SP_INPUT} />
            </div>
            <div>
              <label htmlFor="sp-tc-phone" className={lbl}>{t('sp_tc_phone')}</label>
              <input id="sp-tc-phone" type="tel" inputMode="tel" autoComplete="off" value={ph} onChange={e => setPh(e.target.value)} aria-describedby="sp-tc-hint" className={SP_INPUT} />
              <p id="sp-tc-hint" className="mt-2 text-sm text-[#6E6963]">{t('sp_ci_phone_help')}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button type="submit" disabled={!nm.trim() || !smsHref(ph, 'test')} className={SP_PRIMARY}>{t('save')}</button>
              {trusted && <button type="button" onClick={() => setEditing(false)} className={SP_SECONDARY}>{t('cancel')}</button>}
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3 border border-[#e5e7dd] bg-white rounded-[14px] p-4">
            <p className="min-w-0 text-base font-medium text-[#1C1B1A] break-words">{trusted.name} — {trusted.phone}</p>
            <button type="button" onClick={startEdit} className="shrink-0 text-base font-semibold text-[#4A4744] underline underline-offset-4 min-h-[44px] px-2">{t('sp_tc_edit')}</button>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-[#e5e7dd]">
          <h3 className="font-semibold text-xl mb-4">{t('sp_ci_sub')}</h3>
          {!trusted && <p className="text-base text-[#4A4744] mb-4">{t('sp_ci_add_first')}</p>}

          {overdue ? (
            <div className="space-y-4">
              <h4 className="font-semibold text-xl text-[#1C1B1A]">{t('sp_ci_over_title')}</h4>
              <p className="text-base text-[#1C1B1A]">{fmt(t(ck.jobTitle ? 'sp_ci_over_line' : 'sp_ci_over_line_nojob'), { clientName: ck.clientName, jobTitle: ck.jobTitle, time: spClock(ck.byISO, lang) })}</p>
              {trusted && smsHref(trusted.phone, buildOverdueMessage()) && (
                <a href={smsHref(trusted.phone, buildOverdueMessage())} className={SP_PRIMARY + ' w-full'}>
                  <MessageSquare size={21} /> {fmt(t('sp_ci_sms_over'), { contactName: trusted.name })}
                </a>
              )}
              <a href={telHref(trusted ? trusted.phone : '')} className="w-full flex items-center justify-center gap-3 border border-[#E3E0D9] bg-white text-[#1C1B1A] rounded-full font-semibold text-lg hover:bg-[#F6F4EF] min-h-[64px] px-6 text-center"><Phone size={22} className="shrink-0" /> <span>{fmt(t('sp_ci_call'), { contactName: ck.contactName })}</span></a>
              <button type="button" onClick={async () => { const copied = await copyToClipboard(buildOverdueMessage()); showToast(t(copied ? 'sp_ci_sms_copied' : 'sp_ci_sms_copy_fail')); }} className={SP_SECONDARY + ' w-full'}>{t('sp_ci_copy_help')}</button>
              <p className="text-sm text-[#6E6963]">{t('sp_ci_no_auto')}</p>
              <button type="button" onClick={imSafe} className="w-full border border-[#E3E0D9] bg-white text-[#1C1B1A] rounded-full font-semibold text-base hover:bg-[#F6F4EF] min-h-[52px] px-6">{t('sp_ci_safe_now')}</button>
            </div>
          ) : waiting ? (
            <div className="space-y-4">
              <p className="text-base text-[#1C1B1A]">{fmt(t('sp_ci_wait'), { time: spClock(ck.byISO, lang) })}</p>
              {trusted && smsHref(trusted.phone, buildWaitingPlan()) && (
                <a href={smsHref(trusted.phone, buildWaitingPlan())} className={SP_SECONDARY + ' w-full sm:w-auto'}><MessageSquare size={19} /> {t('sp_ci_sms_plan')}</a>
              )}
              <button type="button" onClick={async () => { const copied = await copyToClipboard(buildWaitingPlan()); showToast(t(copied ? 'sp_ci_sms_copied' : 'sp_ci_sms_copy_fail')); }} className={SP_SECONDARY + ' w-full sm:w-auto'}>{t('sp_ci_copy')}</button>
              {trusted && smsHref(trusted.phone, buildEmergencyMessage()) && (
                <a href={smsHref(trusted.phone, buildEmergencyMessage())} className={SP_PRIMARY + ' w-full sm:w-auto'}><MessageSquare size={19} /> {t('sp_ci_sos_now')}</a>
              )}
              <button type="button" onClick={imSafe} className={SP_SECONDARY + " w-full sm:w-auto"}><Check size={20} /> {t('sp_ci_safe_btn')}</button>
              <p className="text-sm text-[#6E6963]">{t('sp_ci_no_auto')}</p>
            </div>
          ) : (
            <>
              {safe && (
                <div className="space-y-3 mb-5">
                  <p className="flex items-start gap-2 text-base font-medium text-[#1C1B1A] bg-[#FAF0EE] border border-[#F3E1DD] rounded-[14px] p-4"><CheckCircle2 size={20} className="shrink-0 mt-0.5 text-[#59684a]" /> <span>{t('sp_ci_safe_done')}</span></p>
                  {trusted && smsHref(trusted.phone, buildSafeMessage()) && (
                    <a href={smsHref(trusted.phone, buildSafeMessage())} className={SP_SECONDARY + ' w-full sm:w-auto'}><MessageSquare size={19} /> {t('sp_ci_sms_safe')}</a>
                  )}
                </div>
              )}
              <fieldset disabled={!trusted} className={`space-y-5 min-w-0 ${!trusted ? 'opacity-60' : ''}`}>
                {hasJobs ? (
                  <div>
                    <label htmlFor="sp-ci-job" className={lbl}>{t('sp_ci_job')}</label>
                    <select id="sp-ci-job" value={selected.id} onChange={e => setJobId(e.target.value)} className={SP_INPUT}>
                      {options.map(o => <option key={o.id} value={o.id}>{[o.title, o.client].filter(Boolean).join(' — ')}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="sp-ci-client" className={lbl}>{t('sp_ci_client')}</label>
                    <input id="sp-ci-client" type="text" autoComplete="off" value={clientTyped} onChange={e => setClientTyped(e.target.value)} className={SP_INPUT} />
                  </div>
                )}
                <div role="group" aria-labelledby="sp-ci-in">
                  <div id="sp-ci-in" className={lbl}>{t('sp_ci_in')}</div>
                  <div className="flex flex-wrap gap-2">
                    {DURS.map(([m, k]) => (
                      <button key={m} type="button" aria-pressed={mins === m} onClick={() => setMins(m)} className={`rounded-full border px-4 min-h-[44px] text-base font-medium ${mins === m ? 'border-[#59684a] bg-[#FAF0EE] text-[#1C1B1A]' : 'border-[#E3E0D9] bg-white text-[#1C1B1A] hover:bg-[#F6F4EF]'}`}>{t(k)}</button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button type="button" onClick={copyPlan} disabled={controlsOff} className={SP_SECONDARY}>{t('sp_ci_copy')}</button>
                  <a href={controlsOff ? undefined : smsHref(trusted.phone, buildMsg(planIso()))} aria-disabled={controlsOff} className={`${SP_SECONDARY} ${controlsOff ? 'opacity-50 pointer-events-none' : ''}`}><MessageSquare size={19} />{t('sp_ci_sms_plan')}</a>
                  <a href={controlsOff ? undefined : waHref(trusted.phone, buildMsg(planIso()))} target="_blank" rel="noopener noreferrer" aria-disabled={controlsOff} className={`${SP_SECONDARY} ${controlsOff ? 'opacity-50 pointer-events-none' : ''}`}>{t('wa_send')}</a>
                  <button type="button" onClick={startCheckin} disabled={controlsOff} className={SP_PRIMARY}>{t('sp_ci_start')}</button>
                </div>
                <p className="text-sm text-[#6E6963]">{t('sp_ci_no_auto')}</p>
              </fieldset>
            </>
          )}
        </div>
      </div>
      <Disclaimer t={t} k="sp_disc_plan" className="mt-3 px-2" />
    </div>
  );
}

export function QuietHoursCard({ t, lang, quiet, setQuiet }) {
  const now = useNow(20000);
  const active = isQuietActive(quiet, now);
  const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
  const opts = (cur) => {
    const list = hours.includes(cur) ? hours : [...hours, cur].sort();
    return list.map(h => <option key={h} value={h}>{spDigits(lang, h)}</option>);
  };
  const lbl = "block text-base font-semibold mb-2";
  return (
    <div className="bg-white border border-[#e5e7dd] rounded-[20px] p-6">
      <h2 className="font-semibold text-[22px] mb-4 flex items-center gap-3"><Moon size={24} className="text-[#59684a] shrink-0" /> {t('sp_qh_title')}</h2>
      <button type="button" onClick={() => setQuiet({ ...quiet, on: !quiet.on })} role="switch" aria-checked={quiet.on} aria-describedby="sp-qh-desc" className="w-full flex items-center justify-between gap-4 p-4 min-h-[56px] text-left border border-[#e5e7dd] rounded-[14px] hover:border-[#DDD8CE]">
        <span id="sp-qh-desc" className="text-base text-[#4A4744]">{t('sp_qh_line')}</span>
        <ToggleKnob on={quiet.on} />
      </button>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <label htmlFor="sp-qh-from" className={lbl}>{t('sp_qh_from')}</label>
          <select id="sp-qh-from" value={quiet.from} onChange={e => setQuiet({ ...quiet, from: e.target.value })} className={SP_INPUT}>{opts(quiet.from)}</select>
        </div>
        <div>
          <label htmlFor="sp-qh-to" className={lbl}>{t('sp_qh_to')}</label>
          <select id="sp-qh-to" value={quiet.to} onChange={e => setQuiet({ ...quiet, to: e.target.value })} className={SP_INPUT}>{opts(quiet.to)}</select>
        </div>
      </div>
      {quiet.on && (
        <p id="sp-qh-status" role="status" className="mt-4 flex items-start gap-2 text-base font-medium text-[#1C1B1A]">
          {active ? <Moon size={18} className="shrink-0 mt-1 text-[#59684a]" /> : <Info size={18} className="shrink-0 mt-1 text-[#6E6963]" />}
          <span>{active ? t('sp_qh_on_now') : fmt(t('sp_qh_starts'), { from: spDigits(lang, quiet.from) })}</span>
        </p>
      )}
    </div>
  );
}

export function EmergencyView({ t, trusted, userName = '', showToast = () => {}, onBack, onHide }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const big = "w-full flex items-center justify-center gap-3 rounded-full font-semibold text-xl min-h-[72px] px-6 text-center";
  const helpMessage = fmt(t('sp_em_sos_msg'), { userName });
  const copyHelp = async () => { const copied = await copyToClipboard(helpMessage); showToast(t(copied ? 'sp_ci_sms_copied' : 'sp_ci_sms_copy_fail')); };
  return (
    <div className="max-w-[800px] mx-auto space-y-5">
      <div className="bg-white border border-[#e5e7dd] rounded-[20px] p-6">
        <h1 className="text-[28px] sm:text-[30px] font-semibold mb-3">{t('sp_em_title')}</h1>
        <p className="text-lg text-[#4A4744]">{t('sp_em_line')}</p>
      </div>
      <div className="space-y-4">
        <a href="tel:100" className={`${big} bg-[#59684a] text-white hover:bg-[#415947]`}><Phone size={26} className="shrink-0" /> <span>{t('sp_em_police')}</span></a>
        <a href="tel:1145" className={`${big} border border-[#E3E0D9] bg-white text-[#1C1B1A] hover:bg-[#F6F4EF]`}><Phone size={26} className="shrink-0 text-[#59684a]" /> <span>{t('sp_em_women')}</span></a>
        {trusted ? (
          <>
          <a href={telHref(trusted.phone)} className={`${big} border border-[#E3E0D9] bg-white text-[#1C1B1A] hover:bg-[#F6F4EF]`}><Phone size={26} className="shrink-0 text-[#59684a]" /> <span className="min-w-0 break-words">{fmt(t('sp_em_call'), { contactName: trusted.name, phone: trusted.phone })}</span></a>
          {smsHref(trusted.phone, helpMessage) && (
            <a href={smsHref(trusted.phone, helpMessage)} className={`${big} border border-[#59684a] bg-[#FAF0EE] text-[#9A2C25] hover:bg-[#F4DFDA]`}><MessageSquare size={26} className="shrink-0" /> <span className="min-w-0 break-words">{fmt(t('sp_em_sms_btn'), { contactName: trusted.name })}</span></a>
          )}
          <a href={waHref(trusted.phone, helpMessage)} target="_blank" rel="noopener noreferrer" className={`${big} border border-[#E3E0D9] bg-white text-[#1C1B1A] hover:bg-[#F6F4EF]`}><MessageCircle size={26} className="shrink-0 text-[#59684a]" /> <span className="min-w-0 break-words">{fmt(t('wa_em_btn'), { contactName: trusted.name })}</span></a>
          <button type="button" onClick={copyHelp} className={`${big} border border-[#E3E0D9] bg-white text-[#1C1B1A] hover:bg-[#F6F4EF]`}><span className="min-w-0 break-words">{t('sp_ci_copy_help')}</span></button>
          <p className="text-sm text-[#6E6963]">{t('sp_ci_no_auto')}</p>
          </>
        ) : (
          <p className="text-base text-[#4A4744] bg-white border border-[#e5e7dd] rounded-[20px] p-5">{t('sp_em_none')}</p>
        )}
      </div>
      <div className="space-y-3 pt-2">
        <button type="button" onClick={onHide} className="w-full flex items-center justify-center gap-2 border border-[#E3E0D9] bg-white text-[#1C1B1A] rounded-full font-semibold text-base hover:bg-[#F6F4EF] min-h-[52px] px-6"><EyeOff size={20} /> {t('sp_em_hide')}</button>
        <button type="button" onClick={onBack} className="w-full flex items-center justify-center gap-2 text-[#4A4744] rounded-full font-semibold text-base hover:bg-[#F0EEE9] min-h-[52px] px-6"><ChevronLeft size={20} /> {t('back')}</button>
      </div>
    </div>
  );
}

export function SafeTalkCard({ t, job }) {
  if (String(job.meetingTimeNepal || '').toLowerCase().includes('no meetings')) return null;
  return (
    <div className="bg-white border border-[#e5e7dd] rounded-[20px] p-6 mb-10">
      <h3 className="font-semibold text-xl mb-4 flex items-center gap-3"><ShieldCheck size={24} className="text-[#59684a] shrink-0" /> {t('sp_tm_title')}</h3>
      <ul className="space-y-3">
        {['sp_tm_1', 'sp_tm_2', 'sp_tm_3', 'sp_tm_4'].map(k => (
          <li key={k} className="flex items-start gap-3 text-base text-[#1C1B1A]"><Check size={20} className="mt-0.5 shrink-0 text-[#59684a]" /> <span>{t(k)}</span></li>
        ))}
      </ul>
    </div>
  );
}

export function EndChatModal({ t, onConfirm, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="fixed inset-0 z-[60] bg-[#1C1B1A]/40 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="sp-es-title" className="bg-white rounded-[20px] border border-[#e5e7dd] p-6 w-full max-w-[420px] max-h-[90vh] overflow-y-auto">
        <h2 id="sp-es-title" className="font-semibold text-2xl mb-3">{t('sp_es_title')}</h2>
        <p className="text-base text-[#4A4744] mb-6">{t('sp_es_expl')}</p>
        <div className="space-y-3">
          <button type="button" onClick={onConfirm} className="w-full bg-[#59684a] text-white rounded-full font-semibold text-base hover:bg-[#415947] min-h-[52px] px-6">{t('sp_es_confirm')}</button>
          <button type="button" onClick={onClose} className="w-full border border-[#E3E0D9] bg-white text-[#1C1B1A] rounded-full font-semibold text-base hover:bg-[#F6F4EF] min-h-[48px] px-6">{t('cancel')}</button>
        </div>
      </div>
    </div>
  );
}
