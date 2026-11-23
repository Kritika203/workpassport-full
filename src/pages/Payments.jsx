import { useEffect, useMemo, useState } from 'react';
import { Wallet } from 'lucide-react';
import { flow } from '../api/flows.js';
import { payCopy } from '../components/payments/paymentsShared.js';

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

export function PaymentsPage({ lang, workrooms = {}, allJobs = [] }) {
  const s = COPY[lang] || COPY.en;
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
    <div className="rounded-[12px] border border-[#e5e7dd] bg-[#FAFAF9] px-4 py-3 space-y-1">
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
    <div className="space-y-5">
      <section className="rounded-[20px] border border-[#e5e7dd] bg-white p-5 space-y-2">
        <h2 className="text-xl font-semibold flex items-center gap-2"><Wallet size={22} className="text-[#59684a]" /> {s.title}</h2>
        <p className="text-base text-[#4A4744]">{s.intro}</p>
        {demoMode && <p className="text-sm text-[#6B6561]">{s.demoNote}</p>}
      </section>
      {!list.length && (
        <section className="rounded-[20px] border border-[#e5e7dd] bg-white p-5">
          <p className="text-base text-[#6B6561]">{s.empty}</p>
        </section>
      )}
      <Section title={s.needAction} items={needsAction} />
      <Section title={s.waiting} items={waiting} />
      <Section title={s.confirmed} items={confirmed} />
      <Section title={s.disputed} items={disputed} />
      {!!list.length && <Section title={s.history} items={list} />}
    </div>
  );
}
