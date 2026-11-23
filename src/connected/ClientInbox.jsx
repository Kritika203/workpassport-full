import { useState } from 'react';
import { connectedText } from '../i18n/connected.js';
import { NegotiationPanel } from '../components/community/NegotiationPanel.jsx';

// Only applications to the signed-in employer's own jobs are returned by Django.
export function ClientInbox({ applications, onOpenChat, onOpenWorkroom, onUpdateStatus, error = '', lang = 'en', jobTitle = '' }) {
  const t = connectedText[lang] || connectedText.en;
  const [saving, setSaving] = useState(null);
  const [problem, setProblem] = useState('');
  const [offerOpen, setOfferOpen] = useState(null);
  const [reasons, setReasons] = useState({});
  const [compareIds, setCompareIds] = useState([]);
  const toggleCompare = (id) => setCompareIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : (prev.length >= 3 ? prev : [...prev, id]));
  const compared = applications.filter(a => compareIds.includes(a.id));
  const PROOF_RANK = { self: 0, demonstrated: 1, institution: 2, client: 3, platform: 4 };
  const bestProof = (app) => (app.applicant_skills || []).reduce(
    (best, s) => (PROOF_RANK[s.proof] > PROOF_RANK[best] ? s.proof : best), 'self');
  const update = async (app, status) => {
    if (saving) return;
    if ((status === 'accepted' || status === 'rejected') && !window.confirm(t.confirmApplicantAction)) return;
    setSaving(app.id); setProblem('');
    try { await onUpdateStatus(app.id, status, reasons[app.id] || ''); }
    catch (e) { setProblem(e.message || t.updateFailed); }
    finally { setSaving(null); }
  };
  const proofName = level => t['lvl_' + level] || level;
  const statusName = status => ({ submitted: t.submitted, shortlisted: t.shortlisted,
    accepted: t.accepted, rejected: t.rejected })[status] || status;
  return <div className="mx-auto max-w-[860px] space-y-4">
    <h1 className="text-2xl font-semibold">{t.inboxTitle}</h1>
    {jobTitle && <p className="text-[#4A4744] font-semibold">{jobTitle}</p>}
    <p className="text-[#4A4744]">{t.inboxIntro}</p>
    {(error || problem) && <p role="alert" className="p-4 rounded-xl bg-[#FAF0EE] text-[#AE332A]">{error || problem}</p>}
    {!applications.length && <p className="bg-white p-5 border border-[#e5e7dd] rounded-xl">{t.noApplications}</p>}
    {compared.length >= 2 && (
      <div className="rounded-[20px] border border-[#e5e7dd] bg-white p-5 overflow-x-auto">
        <p className="font-semibold text-base mb-3">{lang === 'ne' ? 'आवेदक तुलना' : 'Compare applicants'}</p>
        <table className="w-full text-sm min-w-[520px]">
          <thead><tr className="text-left text-[#6E6963]">
            <th className="py-2 pr-3 font-medium"></th>
            {compared.map(a => <th key={a.id} className="py-2 pr-3 font-semibold text-[#1C1B1A]">{a.applicant_name}</th>)}
          </tr></thead>
          <tbody>
            {[
              [lang === 'ne' ? 'उच्चतम प्रमाण' : 'Best proof', a => proofName(bestProof(a))],
              [lang === 'ne' ? 'सीपहरू' : 'Skills', a => (a.applicant_skills || []).map(s => `${s.name} (${proofName(s.proof)})`).join(', ') || '—'],
              [t.completedJobs || 'Completed jobs', a => String(a.applicant_completed_jobs ?? 0)],
              [t.proofsLabel || 'Verified proofs', a => String(a.applicant_proofs ?? 0)],
              [t.proposedRate, a => `$${Number(a.proposed_rate_usd).toFixed(2)}`],
              [lang === 'ne' ? 'स्थान' : 'Location', a => a.applicant_location || '—'],
              [lang === 'ne' ? 'प्रस्ताव' : 'Proposal', a => (a.message || '').length > 140 ? a.message.slice(0, 140) + '…' : (a.message || '—')],
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
    {applications.map(app => <article key={app.id} className="rounded-[20px] border border-[#e5e7dd] bg-white p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-xl">{app.job_title}</h2>
        <span className="bg-[#F0EEE9] rounded-full px-3 py-1 text-sm">{statusName(app.status)}</span>
      </div>
      <p className="text-[#4A4744]">{t.applicant}: <strong className="text-[#1C1B1A]">{app.applicant_name}</strong></p>
      {app.applicant_location && <p className="text-sm text-[#6E6963]">{lang === 'ne' ? 'स्थान' : 'Location'}: {app.applicant_location}</p>}
      {app.applicant_availability && <p className="text-sm text-[#6E6963]">{lang === 'ne' ? 'उपलब्धता' : 'Availability'}: {app.applicant_availability}</p>}
      <p className="whitespace-pre-wrap rounded-xl bg-[#fcfbf8] p-3 text-sm">{app.message}</p>
      <p className="text-[#6E6963] text-sm">{t.proposedRate}: ${Number(app.proposed_rate_usd).toFixed(2)}</p>
      {(app.applicant_skills?.length > 0 || app.applicant_completed_jobs > 0 || app.applicant_training?.length > 0) && (
        <div className="rounded-xl border border-[#e5e7dd] p-3 space-y-2">
          <p className="font-semibold text-sm">{t.passportSummary}</p>
          {app.applicant_skills?.length > 0 && <ul className="space-y-1 text-sm">
            {app.applicant_skills.map(sk => <li key={sk.name}><strong>{sk.name}</strong> — {proofName(sk.proof)}</li>)}
          </ul>}
          <p className="text-sm text-[#6E6963]">{t.completedJobs}: <strong className="text-[#1C1B1A]">{app.applicant_completed_jobs ?? 0}</strong> · {t.proofsLabel}: <strong className="text-[#1C1B1A]">{app.applicant_proofs ?? 0}</strong></p>
          {app.applicant_training?.length > 0 && <p className="text-sm text-[#6E6963]">{t.trainingLabel}: {app.applicant_training.map(e => `${e.title}${e.institution ? ` (${e.institution})` : ''}`).join(', ')}</p>}
        </div>
      )}
      <div className="mt-2"><button type="button" className="vouch-link" onClick={() => setOfferOpen(offerOpen === app.id ? null : app.id)}>{offerOpen === app.id ? 'Hide negotiation' : 'Discuss rate and terms'}</button>{offerOpen === app.id && <NegotiationPanel id={app.id} role="client" baseline={app.proposed_rate_usd} lang={lang} />}</div>
      {app.decision_reason && <p className="text-sm rounded-xl bg-[#fcfbf8] p-3"><strong>{t.yourReason}:</strong> {app.decision_reason}</p>}
      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
        <input type="checkbox" className="w-4 h-4 accent-[#59684a]" checked={compareIds.includes(app.id)}
          disabled={!compareIds.includes(app.id) && compareIds.length >= 3} onChange={() => toggleCompare(app.id)} />
        {lang === 'ne' ? 'तुलनामा राख्नुहोस्' : 'Compare'}
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-full bg-[#59684a] text-white font-semibold px-5 min-h-[44px]" onClick={() => onOpenChat(app.id)}>{t.messages}</button>
        {app.status === 'accepted' && <button type="button" className="rounded-full border border-[#e5e7dd] px-5 min-h-[44px]" onClick={() => onOpenWorkroom(app.id)}>{t.workroom}</button>}
        {['submitted', 'shortlisted'].includes(app.status) && <>
          {app.status === 'submitted' && <button type="button" disabled={saving === app.id} className="rounded-full border border-[#e5e7dd] px-4 min-h-[44px] disabled:opacity-50" onClick={() => update(app, 'shortlisted')}>{t.shortlist}</button>}
          <button type="button" disabled={saving === app.id} className="rounded-full border border-[#e5e7dd] px-4 min-h-[44px] disabled:opacity-50" onClick={() => update(app, 'accepted')}>{t.acceptApplicant}</button>
          <button type="button" disabled={saving === app.id} className="rounded-full border border-[#e5e7dd] px-4 min-h-[44px] disabled:opacity-50" onClick={() => update(app, 'rejected')}>{t.rejectApplicant}</button>
        </>}
      </div>
      {['submitted', 'shortlisted'].includes(app.status) && (
        <label className="block text-sm font-medium">{t.reasonLabel}
          <textarea className="w-full rounded-xl border border-[#e5e7dd] px-4 py-3 mt-1 min-h-[44px]" rows={2} maxLength={500}
            placeholder={t.reasonPlaceholder} value={reasons[app.id] || ''}
            onChange={e => setReasons(prev => ({ ...prev, [app.id]: e.target.value }))} />
        </label>
      )}
    </article>)}
  </div>;
}
