import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Square } from 'lucide-react';
import { flow } from '../api/flows.js';
import { payCopy } from '../components/payments/paymentsShared.js';
import { PaymentSettings } from '../components/payments/PaymentSettings.jsx';
import { NetPayCalculator } from '../components/payment/Payment.jsx';

// Payments page for both roles. Connected accounts read their DirectPay
// records from Django (they survive refresh and re-login). Demo mode lists
// the payments recorded in this browser's demo Workrooms.
const COPY = {
  en: {
    title: 'Payments',
    intro: 'Direct payments between employer and freelancer. Vouch coordinates and keeps the record. It never holds the money.',
    empty: 'No payments yet. Payments appear here after an employer starts one in a Workroom.',
    needAction: 'Needs your action', waiting: 'Waiting', confirmed: 'Confirmed received', disputed: 'Disputed', history: 'All payments',
    asEmployer: 'You pay', asFreelancer: 'You receive', demoNote: 'Demo mode: these records live in this browser only.',
  },
  ne: {
    title: 'भुक्तानीहरू',
    intro: 'रोजगारदाता र फ्रीलान्सरबीचका सिधा भुक्तानीहरू। Vouch ले समन्वय गर्छ र रेकर्ड राख्छ। पैसा कहिल्यै आफूसँग राख्दैन।',
    empty: 'अहिलेसम्म कुनै भुक्तानी छैन। रोजगारदाताले Workroom मा भुक्तानी सुरु गरेपछि यहाँ देखिन्छ।',
    needAction: 'तपाईंको कदम आवश्यक', waiting: 'प्रतीक्षामा', confirmed: 'प्राप्ति पुष्टि भएको', disputed: 'विवादमा', history: 'सबै भुक्तानीहरू',
    asEmployer: 'तपाईं तिर्नुहुन्छ', asFreelancer: 'तपाईं पाउनुहुन्छ', demoNote: 'डेमो मोड: यी रेकर्ड यो ब्राउजरमा मात्र छन्।',
  },
};

export function PaymentsPage({ lang, workrooms = {}, allJobs = [], t, payChecklist = [], setPayChecklist = () => {}, showToast, role = 'worker' }) {
  const s = COPY[lang] || COPY.en;
  const isEmployer = role === 'client';
  const togglePay = (index) => setPayChecklist(old => {
    const current = Array.isArray(old) && old.length === 4 ? [...old] : [false,false,false,false];
    current[index] = !current[index];
    return current;
  });
  const p = payCopy(lang);
  const [rows, setRows] = useState(null);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    let alive = true;
    flow('payments/')
      .then(data => { if (alive) setRows(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) setDemoMode(true); });
    return () => { alive = false; };
  }, []);

  const demoRows = useMemo(() => {
    if (!demoMode) return [];
    const jobTitle = (id) => (allJobs.find(j => j.id === id) || {}).title || '';
    const out = [];
    Object.entries(workrooms || {}).forEach(([jobId, room]) => {
      (room.milestones || []).forEach(m => {
        if (m.payment) out.push({
          id: `demo-${jobId}-${m.id}`, job_title: jobTitle(jobId), milestone_title: m.title,
          agreed_amount_usd: m.amountUSD, reported_amount_usd: m.payment.reported ?? null,
          transaction_ref: m.payment.ref || '', paid_date: m.payment.date || '',
          status: m.payment.status, viewer_role: 'freelancer', attempt: 1,
          created_at: m.payment.date || '',
        });
      });
    });
    return out;
  }, [demoMode, workrooms, allJobs]);

  const list = demoMode ? demoRows : (rows || []);
  const needsAction = list.filter(r =>
    (r.viewer_role === 'freelancer' && r.status === 'sent') ||
    (r.viewer_role === 'employer' && r.status === 'awaiting_payment'));
  const waiting = list.filter(r => !needsAction.includes(r) && ['awaiting_payment', 'sent'].includes(r.status));
  const confirmed = list.filter(r => r.status === 'confirmed');
  const disputed = list.filter(r => r.status === 'disputed');

  const Row = ({ r }) => (
    <div className="rounded-[12px] border border-[#E3E6E1] bg-[#FAFAF9] px-4 py-3 space-y-1">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-semibold">{r.job_title}</span>
        <span className="text-sm text-[#6B6561]">{r.milestone_title}</span>
        <span className="ml-auto font-semibold">${r.reported_amount_usd ?? r.agreed_amount_usd}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-[#6B6561]">
        <span className="font-semibold text-[#AE332A]">{p.status[r.status] || r.status}</span>
        <span>{r.viewer_role === 'employer' ? s.asEmployer : s.asFreelancer}</span>
        {r.transaction_ref && <span>{r.transaction_ref}</span>}
        {r.paid_date && <span>{r.paid_date}</span>}
        {r.attempt > 1 && <span>#{r.attempt}</span>}
      </div>
    </div>
  );

  const Section = ({ title, items }) => items.length ? (
    <section className="space-y-2">
      <h3 className="font-semibold">{title}</h3>
      {items.map(r => <Row key={r.id} r={r} />)}
    </section>
  ) : null;

  return (
    <div className="vouch-reference-payments space-y-7">
      <header className="vouch-payments-heading">
        <h1>{s.title}</h1>
        <p>{s.intro}</p>
        {demoMode && <p className="text-sm">{s.demoNote}</p>}
      </header>
      {!isEmployer && t && <div className="vouch-payments-grid">
        <div className="space-y-5">
          <PaymentSettings lang={lang} showToast={showToast}/>
          <section className="vouch-payments-checklist">
            <h2>{lang === 'ne' ? 'भुक्तानी लिनुअघि' : 'Before you get paid'}</h2>
            <p>{lang === 'ne' ? 'आफूसँग भएका कुरा चिन्ह लगाउनुहोस्।' : 'A quick checklist. Tick what you already have.'}</p>
            {[0,1,2,3].map(index => <button key={index} type="button" role="checkbox"
              aria-checked={!!payChecklist[index]} onClick={() => togglePay(index)} className="vouch-payments-check-row">
              {payChecklist[index] ? <CheckSquare size={20}/> : <Square size={20}/>}<span>{t('pp_pay_'+(index+1))}</span>
            </button>)}
            <p className="vouch-payments-caution">{lang === 'ne' ? 'यो सूची सुझाव मात्र हो। Vouch ले पैसा राख्दैन वा सार्दैन।' : 'This checklist is guidance only. Vouch does not transfer or hold money. Confirm terms with your employer.'}</p>
          </section>
        </div>
        <div className="vouch-payments-calculator">
          <NetPayCalculator t={t}/>
        </div>
      </div>}
      <section className="vouch-payments-history space-y-4">
        <h2>{lang === 'ne' ? 'भुक्तानीको इतिहास' : 'Payment history'}</h2>
      {!list.length && (
        <section className="rounded-[20px] border border-[#E3E6E1] bg-white p-5">
          <p className="text-base text-[#6B6561]">{s.empty}</p>
        </section>
      )}
      <Section title={s.needAction} items={needsAction} />
      <Section title={s.waiting} items={waiting} />
      <Section title={s.confirmed} items={confirmed} />
      <Section title={s.disputed} items={disputed} />
      {!!list.length && <Section title={s.history} items={list} />}
      </section>
    </div>
  );
}
