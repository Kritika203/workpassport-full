// Applicants shown in the client demo.

import { useState } from 'react';
import { BadgeCheck, CheckCircle2, ChevronLeft, MapPin } from 'lucide-react';
import { CL_CARD } from '../components/client/ClientControls.jsx';
import { NegotiationPanel } from '../components/community/NegotiationPanel.jsx';
import { DEMO_APPLICANTS } from '../data/demo.js';
import { fmt, fmtMoney, toDigits } from '../utils/format.js';



export function ClientApplicants({ t, lang, navTo, job, applicants = DEMO_APPLICANTS, isDemo = true }) {
  const digits = (n) => toDigits(n, lang);
  const ne = lang === 'ne';
  const [openPassport, setOpenPassport] = useState(null);
  const [offerOpen, setOfferOpen] = useState(null);
  const [shortlisted, setShortlisted] = useState([]);
  const [rejected, setRejected] = useState({});
  const [rejectingId, setRejectingId] = useState(null);
  const [reasonDraft, setReasonDraft] = useState('');
  const [compareIds, setCompareIds] = useState([]);
  const toggleCompare = (id) => setCompareIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : (prev.length >= 3 ? prev : [...prev, id]));
  const compared = applicants.filter(a => compareIds.includes(a.id));
  const back = (
    <button onClick={() => navTo('client', { scrollTo: 'mine' })} className="flex items-center gap-2 text-base text-[#4A4744] mb-6 hover:text-[#1C1B1A] min-h-[48px] px-2 -ml-2 font-medium">
      <ChevronLeft size={20} /> {t('back')}
    </button>
  );
  if (!job) return <div className="max-w-2xl mx-auto">{back}<p className="text-base text-[#4A4744]">{t('cl_none')}</p></div>;
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        {back}
        <h1 className="text-[28px] sm:text-[30px] font-semibold mb-1">{t('cl_applicants')}</h1>
        <div className="text-lg font-semibold text-[#1C1B1A] break-words">{job.title}</div>
        {isDemo && <p className="text-base text-[#4A4744] mt-1">{t('cl_demo_applicants')}</p>}
      </div>
      {job.accepted && (
        <div className="bg-[#FAF0EE] border border-[#F3E1DD] rounded-[20px] p-4 flex items-start gap-3">
          <CheckCircle2 size={22} className="shrink-0 mt-0.5 text-[#59684a]" />
          <p className="text-base font-semibold text-[#1C1B1A]">{fmt(t('ag_made'), { name: job.accepted.applicantName })}</p>
        </div>
      )}
      {applicants.length === 0 && <p className="text-[#6E6963] bg-white border border-[#e5e7dd] rounded-[16px] p-5">No applications yet. Your job must be approved before freelancers can apply.</p>}
      {compared.length >= 2 && (
        <div className="bg-white border border-[#e5e7dd] rounded-[20px] p-5 overflow-x-auto">
          <p className="font-semibold text-base mb-3">{ne ? 'आवेदक तुलना' : 'Compare applicants'}</p>
          <table className="w-full text-sm min-w-[480px]">
            <thead><tr className="text-left text-[#6E6963]">
              <th className="py-2 pr-3 font-medium"></th>
              {compared.map(a => <th key={a.id} className="py-2 pr-3 font-semibold text-[#1C1B1A]">{a.name}</th>)}
            </tr></thead>
            <tbody>
              {[
                [ne ? 'सीप र प्रमाण' : 'Skills and proof', a => a.skills.map(sk => `${sk.name} (${t('pp_lvl_' + sk.level)})`).join(', ')],
                [ne ? 'प्रमाणहरू' : 'Proofs', a => digits(a.proofs)],
                [t('cl_completed'), a => digits(a.completed)],
                [t('cl_asks'), a => `$${fmtMoney(a.asks)} (NPR ${fmtMoney(a.asks * 133)})`],
                [t('cl_availability'), a => a.availability],
                [ne ? 'स्थान' : 'Place', a => a.place],
              ].map(([label, get]) => (
                <tr key={label} className="border-t border-[#e5e7dd] align-top">
                  <td className="py-2 pr-3 text-[#6E6963] font-medium whitespace-nowrap">{label}</td>
                  {compared.map(a => <td key={a.id} className="py-2 pr-3">{get(a)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {applicants.map(a => (
        <div key={a.id} className={CL_CARD}>
          <div className="font-semibold text-xl break-words">{a.name}</div>
          <div className="text-base text-[#4A4744] flex items-center gap-1.5 mb-4"><MapPin size={18} className="text-[#8A8580]" /> {a.place}</div>
          <ul className="space-y-1 mb-3 text-base text-[#1C1B1A]">
            {a.skills.map(sk => (
              <li key={sk.name}><strong>{sk.name}</strong> — {t('pp_lvl_' + sk.level)}</li>
            ))}
          </ul>
          <div className="text-sm text-[#6E6963] mb-4">{fmt(t('pr_count'), { n: digits(a.proofs) })}</div>
          <dl className="space-y-3 mb-5">
            <div><dt className="text-sm text-[#6E6963]">{t('cl_asks')}</dt><dd className="text-base font-semibold text-[#1C1B1A]">${fmtMoney(a.asks)} (NPR {fmtMoney(a.asks * 133)})</dd></div>
            <div><dt className="text-sm text-[#6E6963]">{t('cl_availability')}</dt><dd className="text-base text-[#1C1B1A]">{a.availability}</dd></div>
            <div><dt className="text-sm text-[#6E6963]">{t('cl_completed')}</dt><dd className="text-base text-[#1C1B1A]">{digits(a.completed)}</dd></div>
          </dl>
          <div className="mb-4"><button type="button" className="vouch-link" onClick={() => setOfferOpen(offerOpen === a.id ? null : a.id)}>{offerOpen === a.id ? 'Close bargaining' : 'Negotiate with this applicant'}</button>
            {offerOpen === a.id && <NegotiationPanel id={`demo-${job.id}-${a.id}`} role="client" baseline={a.asks || job.budgetUSD} lang={lang} />}</div>
          {!job.accepted && !rejected[a.id] && (
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer mb-3">
              <input type="checkbox" className="w-4 h-4 accent-[#59684a]" checked={compareIds.includes(a.id)}
                disabled={!compareIds.includes(a.id) && compareIds.length >= 3} onChange={() => toggleCompare(a.id)} />
              {ne ? 'तुलनामा राख्नुहोस्' : 'Compare'}
            </label>
          )}
          {openPassport === a.id && (
            <div className="rounded-[14px] border border-[#e5e7dd] bg-[#fcfbf8] p-4 mb-4 space-y-2">
              <p className="font-semibold text-base flex items-center gap-2"><BadgeCheck size={18} className="text-[#59684a]" /> Vouch — {a.name}</p>
              <ul className="space-y-1.5 text-base">
                {a.skills.map(sk => (
                  <li key={sk.name} className="flex items-center justify-between gap-2">
                    <span>{sk.name}</span>
                    <span className="bg-white border border-[#e5e7dd] rounded-full px-3 py-0.5 text-[13px] font-semibold">{t('pp_lvl_' + sk.level)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-[#6E6963]">{fmt(t('pr_count'), { n: digits(a.proofs) })} · {ne ? 'पूरा गरेका काम' : 'Completed jobs'}: {digits(a.completed)}</p>
              <p className="text-sm text-[#6E6963]">{ne ? 'यो सारांश उनको Vouch बाट आएको हो। सम्पर्क विवरण आवेदनपछि मात्र देखिन्छ।' : 'This summary comes from her Vouch. Contact details appear only after you start a conversation.'}</p>
            </div>
          )}
          {rejected[a.id] ? (
            <div className="rounded-[14px] bg-[#FAF0EE] border border-[#F3E1DD] p-4">
              <p className="font-semibold text-base">{ne ? 'अस्वीकृत' : 'Declined'}</p>
              {rejected[a.id] && <p className="text-sm text-[#4A4744] mt-1">{ne ? 'फ्रीलान्सरले देख्ने कारण: ' : 'Reason the freelancer sees: '}{rejected[a.id]}</p>}
            </div>
          ) : !job.accepted && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={() => setOpenPassport(openPassport === a.id ? null : a.id)} className="flex-1 border border-[#E3E0D9] bg-white rounded-full px-4 font-semibold text-base hover:border-[#DDD8CE] min-h-[48px]">
                  {ne ? 'Vouch हेर्नुहोस्' : 'View Vouch'}
                </button>
                <button onClick={() => setShortlisted(prev => prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id])} aria-pressed={shortlisted.includes(a.id)}
                  className={`flex-1 rounded-full px-4 font-semibold text-base min-h-[48px] border ${shortlisted.includes(a.id) ? 'bg-[#FAF0EE] border-[#59684a] text-[#AE332A]' : 'border-[#E3E0D9] bg-white hover:border-[#DDD8CE]'}`}>
                  {shortlisted.includes(a.id) ? (ne ? 'छनोट सूचीमा छ' : 'Shortlisted') : (ne ? 'छनोट सूचीमा राख्नुहोस्' : 'Shortlist')}
                </button>
                <button onClick={() => { setRejectingId(rejectingId === a.id ? null : a.id); setReasonDraft(''); }} className="flex-1 border border-[#E3E0D9] bg-white rounded-full px-4 font-semibold text-base hover:border-[#DDD8CE] min-h-[48px]">
                  {ne ? 'अस्वीकार्नुहोस्' : 'Decline'}
                </button>
              </div>
              {rejectingId === a.id && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium">{ne ? 'कारण (फ्रीलान्सरले यो देख्नेछन्)' : 'Reason (the freelancer will see this)'}
                    <textarea value={reasonDraft} onChange={e => setReasonDraft(e.target.value)} rows={2} maxLength={500}
                      className="w-full rounded-xl border border-[#e5e7dd] px-4 py-3 mt-1"
                      placeholder={ne ? 'उदाहरण: यस पटक छपाइ अनुभव भएको डिजाइनर छान्यौं।' : 'e.g. We chose a designer with print experience this time.'} />
                  </label>
                  <button onClick={() => { setRejected(prev => ({ ...prev, [a.id]: reasonDraft.trim() })); setRejectingId(null); }} className="w-full bg-[#59684a] text-white py-3 rounded-full font-semibold text-base hover:bg-[#415947] min-h-[48px]">
                    {ne ? 'कारणसहित अस्वीकार्नुहोस्' : 'Decline with this reason'}
                  </button>
                </div>
              )}
              <button onClick={() => navTo('client-agreement', { id: job.id, applicantId: a.id })} className="w-full bg-[#59684a] text-white py-3 rounded-full font-semibold text-base hover:bg-[#415947] min-h-[48px]">
                {t('cl_accept')}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
