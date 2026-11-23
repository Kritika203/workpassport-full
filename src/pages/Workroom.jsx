// Agreement and milestone demo.

import { Check, CheckCircle2, ChevronLeft, Copy, Info, MessageSquare, User, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { methodRows, payCopy } from '../components/payments/paymentsShared.js';
import { readLocalMethods } from '../components/payments/PaymentSettings.jsx';
import { copyToClipboard } from '../utils/clipboard.js';
import { MASK } from '../constants/privacy.js';
import { buildWorkroomMilestones } from '../services/workroom.js';
import { deliverableDetail, isSpec, specsForMilestone } from '../utils/deliverables.js';
import { fmt, fmtMoney } from '../utils/format.js';



// Demo DirectPay: same flow as the real one, stored in the demo workrooms
// store in this browser. The demo user plays both sides, like the rest of
// this demo Workroom. Real accounts use the Django-backed PaymentPanel.
function DemoPay({ m, lang, setPayment }) {
  const s = payCopy(lang);
  const [ref, setRef] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tick, setTick] = useState(false);
  const [reason, setReason] = useState('not_received');
  const [note, setNote] = useState('');
  const [showDispute, setShowDispute] = useState(false);
  const pay = m.payment || null;
  const inp = "w-full mt-1 px-3 border border-[#E3E6E1] rounded-[10px] text-base min-h-[42px] bg-white focus:outline-none focus:border-[#003D14]";
  const red = "px-5 rounded-full bg-[#003D14] text-white font-semibold min-h-[44px] hover:bg-[#0E5C2A] disabled:opacity-50";
  const ghost = "px-4 rounded-full border border-[#E3E6E1] bg-white font-semibold min-h-[40px] hover:border-[#DDD8CE] disabled:opacity-50";
  const start = () => {
    const local = readLocalMethods();
    const method = local.find(x => x.is_preferred) || local[0];
    const snapshot = method
      ? { kind: method.kind, holder_name: method.holder_name, mobile: method.mobile, bank_name: method.bank_name, account_number: method.account_number, branch: method.branch }
      : { kind: 'esewa', holder_name: 'Maya (demo)', mobile: '9841000000' };
    setPayment(m.id, { status: 'awaiting_payment', method: snapshot });
  };
  if (!pay) return (
    <div className="mt-3 rounded-[12px] border border-[#E3E6E1] p-3 space-y-2">
      <div className="flex items-center gap-2 font-semibold text-base"><Wallet size={17} className="text-[#003D14]" /> {s.title}</div>
      <p className="text-sm text-[#475249]">{s.startNote}</p>
      <button onClick={start} className={red}>{s.payBtn}</button>
    </div>
  );
  const rows = methodRows(pay.method, lang);
  return (
    <div className="mt-3 rounded-[12px] border border-[#E3E6E1] p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 font-semibold text-base"><Wallet size={17} className="text-[#003D14]" /> {s.title}</span>
        <span className="text-sm font-semibold text-[#AE332A]">{s.status[pay.status] || pay.status}</span>
      </div>
      <div className="rounded-[10px] bg-[#FAFAF9] border border-[#E3E6E1] p-3 space-y-1">
        <div className="text-sm font-semibold">{s.methodFor}: {s.kinds[pay.method?.kind] || pay.method?.kind}</div>
        {rows.map(r => (
          <div key={r.label} className="flex items-center gap-2 text-sm">
            <span className="text-[#6B6561]">{r.label}:</span><span className="font-semibold break-all">{r.value}</span>
            <button type="button" className="inline-flex items-center gap-1 text-[#AE332A] font-semibold" onClick={() => copyToClipboard(r.value)}><Copy size={13} /> {s.copy}</button>
          </div>
        ))}
      </div>
      <p className="text-sm text-[#475249]">{s.safety}</p>
      {pay.status === 'awaiting_payment' && (
        <div className="space-y-2">
          <p className="text-sm text-[#475249]">{s.completeOutside}</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="block text-sm font-semibold">{s.refLabel}<input value={ref} onChange={e => setRef(e.target.value)} className={inp} /></label>
            <label className="block text-sm font-semibold">{s.dateLabel}<input type="date" value={date} onChange={e => setDate(e.target.value)} className={inp} /></label>
          </div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={tick} onChange={e => setTick(e.target.checked)} className="w-5 h-5 mt-0.5 accent-[#003D14]" /> {s.confirmTick}</label>
          <button disabled={!tick || ref.trim().length < 4} className={red}
            onClick={() => setPayment(m.id, { ...pay, status: 'sent', ref: ref.trim(), date, reported: m.amountUSD })}>{s.sentBtn}</button>
        </div>
      )}
      {pay.status === 'sent' && !showDispute && (
        <div className="space-y-2">
          <p className="text-sm text-[#6B6561]">{s.waitingConfirm} · {pay.ref} · {pay.date}</p>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={tick} onChange={e => setTick(e.target.checked)} className="w-5 h-5 mt-0.5 accent-[#003D14]" /> {s.confirmTickFree}</label>
          <div className="flex flex-wrap gap-2">
            <button disabled={!tick} className={red} onClick={() => setPayment(m.id, { ...pay, status: 'confirmed' })}>{s.confirmBtn}</button>
            <button className={ghost} onClick={() => setShowDispute(true)}>{s.problemBtn}</button>
          </div>
        </div>
      )}
      {pay.status === 'sent' && showDispute && (
        <div className="space-y-2">
          <label className="block text-sm font-semibold">{s.reasonLabel}
            <select value={reason} onChange={e => setReason(e.target.value)} className={inp}>
              {Object.entries(s.reasons).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">{s.noteLabel}<input value={note} onChange={e => setNote(e.target.value)} className={inp} /></label>
          <button disabled={note.trim().length < 5} className={red}
            onClick={() => setPayment(m.id, { ...pay, status: 'disputed', dispute: { reason, note: note.trim() } })}>{s.sendReport}</button>
        </div>
      )}
      {pay.status === 'disputed' && pay.dispute && (
        <p className="text-sm text-[#AE332A] font-semibold">{s.reasons[pay.dispute.reason] || pay.dispute.reason}: <span className="font-normal text-[#475249]">{pay.dispute.note}</span></p>
      )}
    </div>
  );
}

export function WorkroomView({ t, lang, job, navTo, showToast, workrooms, setWorkrooms, confirmedJobs, setConfirmedJobs, hideMoney = false, onReview = null }) {
  const stored = workrooms[job.id];
  const hasEntry = !!(stored && Array.isArray(stored.milestones) && stored.milestones.length);
  const milestones = hasEntry ? stored.milestones : buildWorkroomMilestones(job);

  useEffect(() => {
    if (!hasEntry) setWorkrooms({ ...workrooms, [job.id]: { milestones } });
  }, []);

  const money = (usd) => hideMoney ? MASK : `$${fmtMoney(usd)}`;
  const nprOf = (usd) => hideMoney ? MASK : fmtMoney(usd * 133);
  const total = milestones.length;
  const done = milestones.filter(m => m.state === 'released').length;
  const totalUSD = milestones.reduce((a, m) => a + m.amountUSD, 0);
  const releasedUSD = milestones.filter(m => m.state === 'released').reduce((a, m) => a + m.amountUSD, 0);
  const pct = totalUSD > 0 ? Math.round((releasedUSD / totalUSD) * 100) : 0;
  const complete = total > 0 && done === total;

  const setState = (id, state) => {
    const next = milestones.map(m => m.id === id ? { ...m, state } : m);
    setWorkrooms({ ...workrooms, [job.id]: { milestones: next } });
    if (state === 'released' && next.every(m => m.state === 'released')) {
      if (!confirmedJobs.includes(job.id)) {
        setConfirmedJobs(prev => (Array.isArray(prev) ? (prev.includes(job.id) ? prev : [...prev, job.id]) : [job.id]));
        showToast(t('pp_confirm_toast'));
      }
    }
  };

  const pill = (state) => (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${state === 'released' ? 'bg-[#FAF0EE] border-[#F3E1DD] text-[#AE332A]' : 'bg-[#E7F0E9] border-[#E3E6E1] text-[#141614]'}`}>{state === 'released' && <Check size={14} />}{t('wr_s_' + state)}</span>
  );
  const bullets = (arr) => (
    <ul className="space-y-1.5">
      {(arr || []).map((x, i) => <li key={i} className="flex items-start gap-2 text-base text-[#475249]"><span className="mt-[9px] w-1.5 h-1.5 rounded-full bg-[#70776F] shrink-0" /><span>{deliverableDetail(x)}{isSpec(x) && x.description ? <span className="block text-sm text-[#687169] mt-0.5">{x.description}</span> : null}</span></li>)}
    </ul>
  );
  const specsOf = (idx) => {
    const linked = specsForMilestone(job.deliverables, idx + 1);
    if (linked.length) return linked;
    const own = (job.deliverables || [])[idx];
    return isSpec(own) ? [own] : [];
  };
  const setChecks = (id, checks) => {
    const next = milestones.map(m => m.id === id ? { ...m, checks } : m);
    setWorkrooms({ ...workrooms, [job.id]: { milestones: next } });
  };
  const setPayment = (id, payment) => {
    const next = milestones.map(m => m.id === id ? { ...m, payment } : m);
    setWorkrooms({ ...workrooms, [job.id]: { milestones: next } });
  };
  const label = "text-sm font-semibold text-[#687169] mb-1";
  const demoBtn = "w-full sm:w-auto border-2 border-dashed border-[#D6E2D8] text-[#475249] rounded-full px-5 font-semibold text-base hover:border-[#70776F] min-h-[48px] bg-white";

  return (
    <div className="max-w-[800px] mx-auto space-y-5">
      <div className="bg-white border border-[#E3E6E1] rounded-[20px] p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navTo('opportunities', { tab: 'applied' })} aria-label={t('back')} className="shrink-0 flex items-center gap-1 text-base font-semibold text-[#475249] hover:text-[#141614] min-h-[48px] -ml-1 pr-1"><ChevronLeft size={20} /><span>{t('back')}</span></button>
        </div>
        <h1 className="text-[28px] sm:text-[30px] font-semibold leading-tight mb-2">{t('wr_title')}</h1>
        <div className="text-lg font-semibold text-[#141614]">{job.title}</div>
        <div className="text-base text-[#475249] flex items-center gap-2 mb-4"><User size={18} /> {job.clientName}</div>
        <button onClick={() => navTo('chat', { id: job.id })} className="w-full sm:w-auto border border-[#E3E6E1] bg-white text-[#141614] rounded-full px-6 font-semibold text-base hover:border-[#DDD8CE] min-h-[48px] flex items-center justify-center gap-2"><MessageSquare size={18} /> {t('chat_msg_client')}</button>
      </div>

      <div className="bg-[#FAF0EE] border border-[#F3E1DD] rounded-[20px] p-4 flex items-start gap-3">
        <Info size={20} className="shrink-0 mt-0.5 text-[#AE332A]" />
        <p className="text-base text-[#141614]">{t('wr_sim_note')}</p>
      </div>

      <div className="bg-white border border-[#E3E6E1] rounded-[20px] p-5 sm:p-6">
        <h2 className="text-xl font-semibold mb-4">{t('wr_agreement')}</h2>
        <div className="space-y-4">
          <div><div className={label}>{job.clientName}</div><div className="text-base font-semibold text-[#141614]">{job.title}</div></div>
          <div><div className={label}>{t('wr_price')}</div><div className="text-base text-[#141614]">{hideMoney ? `${MASK} (NPR ${MASK})` : `$${fmtMoney(job.budgetUSD)} (NPR ${fmtMoney(job.budgetUSD * 133)})`}</div></div>
          <div><div className={label}>{t('wr_deadline')}</div><div className="text-base text-[#141614]">{fmt(t('wr_days'), { days: job.deadlineDays })}</div></div>
          <div><div className={label}>{t('wr_deliver')}</div>{bullets(job.deliverables)}</div>
          <div><div className={label}>{t('wr_provides')}</div>{bullets(job.clientProvides)}</div>
        </div>
      </div>

      <div className="bg-white border border-[#E3E6E1] rounded-[20px] p-5 sm:p-6">
        {complete && onReview && <button type="button" className="vouch-button mb-5" onClick={onReview}>Leave feedback about this job</button>}
        {complete && (
          <div className="bg-[#FAF0EE] border border-[#F3E1DD] rounded-[14px] p-4 flex items-start gap-3 mb-5">
            <CheckCircle2 size={22} className="shrink-0 mt-0.5 text-[#003D14]" />
            <p className="text-base font-semibold text-[#141614]">{t('wr_complete')}</p>
          </div>
        )}
        <h2 className="text-xl font-semibold mb-4">{t('wr_milestones')}</h2>
        <div className="text-base font-semibold text-[#141614] mb-2">{fmt(t('wr_progress'), { done, total })}</div>
        <div className="h-2.5 rounded-full bg-[#E7F0E9] overflow-hidden mb-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="h-full rounded-full bg-[#003D14] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-sm text-[#687169] mb-5">{fmt(t('wr_released_so_far'), { x: nprOf(releasedUSD), y: nprOf(totalUSD) })}</div>

        <div className="space-y-3">
          {milestones.map((m, mi) => (
            <div key={m.id} className="border border-[#E3E6E1] rounded-[14px] p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className="text-base font-semibold text-[#141614]">{m.title}</div>
                  <div className="text-sm text-[#687169]">{money(m.amountUSD)} · NPR {nprOf(m.amountUSD)}</div>
                </div>
                <div className="shrink-0">{pill(m.state)}</div>
              </div>
              {m.state === 'not_funded' && <button onClick={() => setState(m.id, 'funded')} className={demoBtn}>{t('wr_demo_fund')}</button>}
              {m.state === 'funded' && <button onClick={() => setState(m.id, 'submitted')} className="w-full sm:w-auto bg-[#003D14] text-white rounded-full px-6 font-semibold text-base hover:bg-[#0E5C2A] min-h-[48px]">{t('wr_submit')}</button>}
              {m.state === 'submitted' && (
                <div className="space-y-3">
                  <p className="text-base text-[#475249]">{t('wr_waiting')}</p>
                  {specsOf(mi).length > 0 && (
                    <div className="border border-[#E3E6E1] rounded-[12px] p-3 space-y-2">
                      <p className="text-sm font-semibold text-[#141614]">{lang === 'ne' ? 'ग्राहकको समीक्षा सूची' : 'Client review checklist'}</p>
                      {specsOf(mi).map(sp => {
                        const on = (m.checks || []).includes(sp.name);
                        return (
                          <label key={sp.name} className="flex items-start gap-2 text-base text-[#141614] cursor-pointer">
                            <input type="checkbox" className="mt-1.5 w-4 h-4 accent-[#003D14]" checked={on}
                              onChange={e => setChecks(m.id, e.target.checked ? [...(m.checks || []), sp.name] : (m.checks || []).filter(x => x !== sp.name))} />
                            <span>{sp.name}<span className="block text-sm text-[#687169]">{deliverableDetail(sp)}</span></span>
                          </label>
                        );
                      })}
                      {specsOf(mi).some(sp => !(m.checks || []).includes(sp.name)) && (
                        <p className="text-sm text-[#AE332A]">{lang === 'ne' ? 'टिक नभएको: ' : 'Not yet received: '}{specsOf(mi).filter(sp => !(m.checks || []).includes(sp.name)).map(sp => sp.name).join(', ')}</p>
                      )}
                    </div>
                  )}
                  <button onClick={() => setState(m.id, 'released')} className={demoBtn}>{t('wr_demo_release')}</button>
                </div>
              )}
              {m.state === 'released' && <div className="flex items-center gap-2 text-base font-semibold text-[#AE332A]"><Check size={18} /> {t('wr_s_released')}</div>}
              {m.state === 'released' && <DemoPay m={m} lang={lang} setPayment={setPayment} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
