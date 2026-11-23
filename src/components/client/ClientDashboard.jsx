// Client dashboard: pipeline, needs-attention strip and simulated spending.
// Real accounts read GET /api/client/dashboard/; the demo builds the same
// shape locally (see Client.jsx). All money is simulated, as everywhere else.
import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, readApiSession } from '../../api/client.js';
import { fmtMoney, toDigits } from '../../utils/format.js';

const STATUS_LABELS = {
  published: ['Published', 'प्रकाशित'],
  pending_review: ['Pending review', 'समीक्षामा'],
  rejected: ['Rejected', 'अस्वीकृत'],
  closed: ['Closed', 'बन्द'],
};

export function ClientDashboard({ lang = 'en', connected = false, demoData = null, onOpenApplicants, onOpenReview }) {
  const ne = lang === 'ne';
  const digits = (n) => toDigits(n, lang);
  const [data, setData] = useState(connected ? null : demoData);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!connected) { setData(demoData); return; }
    let live = true;
    api('/api/client/dashboard/', {}, readApiSession())
      .then(d => { if (live) setData(d); })
      .catch(e => { if (live) setError(e.message || 'Could not load the dashboard.'); });
    return () => { live = false; };
  }, [connected, demoData]);

  if (error) return <p role="alert" className="bg-[#FAF0EE] border border-[#F3E1DD] rounded-[14px] p-4 text-base text-[#AE332A]">{error}</p>;
  if (!data) return <p className="text-base text-[#6E6963]">{ne ? 'लोड हुँदैछ...' : 'Loading your dashboard...'}</p>;

  const review = data.review_items || [];
  const waiting = data.applicants_waiting || 0;
  const statusRows = Object.entries(data.jobs_by_status || {}).filter(([, n]) => n > 0);
  const maxStatus = Math.max(1, ...statusRows.map(([, n]) => n));
  const spent = data.spent_by_job || [];
  const released = Number(data.total_released_usd || 0);
  const agreed = Number(data.total_agreed_usd || 0);
  const money = (usd) => `$${fmtMoney(Math.round(usd))} (NPR ${fmtMoney(Math.round(usd * 133))})`;
  const attention = [
    { key: 'applicants', count: waiting, label: ne ? 'आवेदकहरू पर्खिरहेका छन्' : 'applicants waiting', onClick: () => onOpenApplicants && onOpenApplicants(null) },
    { key: 'review', count: review.length, label: ne ? 'डेलिभरेबल समीक्षा गर्न बाँकी' : 'deliverables to review', onClick: () => review[0] && onOpenReview && onOpenReview(review[0]) },
    { key: 'release', count: review.length, label: ne ? 'माइलस्टोन जारी गर्न तयार' : 'milestones ready to release', onClick: () => review[0] && onOpenReview && onOpenReview(review[0]) },
  ].filter(x => x.count > 0);

  return (
    <div className="space-y-4 mb-6" aria-label={ne ? 'ग्राहक ड्यासबोर्ड' : 'Client dashboard'}>
      {attention.length ? (
        <div className="bg-[#FFF8EC] border border-[#F0DFC0] rounded-[20px] p-4 space-y-2">
          <p className="font-semibold text-base flex items-center gap-2"><AlertCircle size={19} className="text-[#9A6B12]" /> {ne ? 'तपाईंको ध्यान चाहिन्छ' : 'Needs your attention'}</p>
          {attention.map(x => (
            <button key={x.key} onClick={x.onClick} className="w-full text-left bg-white border border-[#F0DFC0] rounded-[12px] px-4 py-2.5 text-base hover:border-[#E3C98F] min-h-[44px]">
              <strong>{digits(x.count)}</strong> {x.label} →
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-[#F2F7EE] border border-[#DCE8D2] rounded-[20px] p-4 flex items-center gap-2">
          <CheckCircle2 size={19} className="text-[#4A7A2E]" />
          <p className="text-base font-medium">{ne ? 'सबै सकियो। केही पनि पर्खिरहेको छैन।' : 'You are all caught up. Nothing is waiting on you.'}</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: ne ? 'जम्मा कामहरू' : 'Jobs posted', value: digits(data.total_jobs || 0) },
          { label: ne ? 'पर्खिरहेका आवेदक' : 'Applicants waiting', value: digits(waiting) },
          { label: ne ? 'छनोट सूचीमा' : 'Shortlisted', value: digits(data.shortlisted || 0) },
          { label: ne ? 'जारी भएको (डेमो)' : 'Released (demo)', value: money(released) },
        ].map(item => (
          <div key={item.label} className="rounded-[18px] bg-white border border-[#e5e7dd] px-4 py-4">
            <p className="text-[#6E6963] text-sm">{item.label}</p>
            <p className="text-xl font-semibold mt-1 break-words">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-[18px] bg-white border border-[#e5e7dd] p-4">
          <p className="font-semibold text-base mb-3">{ne ? 'स्थितिअनुसार कामहरू' : 'Jobs by status'}</p>
          {statusRows.length === 0 && <p className="text-sm text-[#6E6963]">{ne ? 'अहिलेसम्म कुनै काम छैन।' : 'No jobs yet.'}</p>}
          <div className="space-y-2.5">
            {statusRows.map(([key, n]) => (
              <div key={key}>
                <div className="flex justify-between text-sm mb-1"><span>{(STATUS_LABELS[key] || [key, key])[ne ? 1 : 0]}</span><strong>{digits(n)}</strong></div>
                <div className="h-2.5 rounded-full bg-[#F0EEE9] overflow-hidden"><div className="h-full rounded-full bg-[#59684a]" style={{ width: `${Math.round((n / maxStatus) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[18px] bg-white border border-[#e5e7dd] p-4">
          <p className="font-semibold text-base mb-3">{ne ? 'कामअनुसार खर्च (डेमो)' : 'Spending by job (demo)'}</p>
          {spent.length === 0 && <p className="text-sm text-[#6E6963]">{ne ? 'सहमत काम सुरु भएपछि यहाँ देखिन्छ।' : 'Appears once agreed work starts.'}</p>}
          <div className="space-y-3">
            {spent.map((row, i) => {
              const rel = Number(row.released_usd || 0);
              const agr = Number(row.agreed_usd || 0);
              const pct = agr > 0 ? Math.min(100, Math.round((rel / agr) * 100)) : 0;
              return (
                <div key={i}>
                  <div className="flex justify-between gap-2 text-sm mb-1"><span className="truncate">{row.job_title}</span><strong>{money(rel)} / {money(agr)}</strong></div>
                  <div className="h-2.5 rounded-full bg-[#F0EEE9] overflow-hidden"><div className="h-full rounded-full bg-[#4A7A2E]" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
          {agreed > 0 && <p className="text-sm text-[#6E6963] mt-3">{ne ? 'जम्मा सहमत' : 'Total agreed'}: {money(agreed)} · {ne ? 'जारी' : 'Released'}: {money(released)}</p>}
        </div>
      </div>

      {review.length > 0 && (
        <div className="rounded-[18px] bg-white border border-[#e5e7dd] p-4">
          <p className="font-semibold text-base mb-3">{ne ? 'समीक्षा गर्न बाँकी डेलिभरेबल' : 'Deliverables to review'}</p>
          <div className="space-y-2">
            {review.map((item, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 border border-[#e5e7dd] rounded-[12px] px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-base truncate">{item.milestone_title} — {item.job_title}</p>
                  <p className="text-sm text-[#6E6963]">{item.applicant_name} · ${fmtMoney(Math.round(Number(item.amount_usd || 0)))}</p>
                </div>
                <button onClick={() => onOpenReview && onOpenReview(item)} className="bg-[#59684a] text-white px-5 rounded-full font-semibold text-sm hover:bg-[#415947] min-h-[40px]">
                  {ne ? 'समीक्षा गर्नुहोस्' : 'Review'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
