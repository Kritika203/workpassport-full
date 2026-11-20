import { useState } from 'react';
import { connectedText } from '../i18n/connected.js';

// Only applications to the signed-in employer's own jobs are returned by Django.
export function ClientInbox({ applications, onOpenChat, onOpenWorkroom, onUpdateStatus, error = '', lang = 'en', jobTitle = '' }) {
  const t = connectedText[lang] || connectedText.en;
  const [saving, setSaving] = useState(null);
  const [problem, setProblem] = useState('');
  const update = async (app, status) => {
    if (saving) return;
    if ((status === 'accepted' || status === 'rejected') && !window.confirm(t.confirmApplicantAction)) return;
    setSaving(app.id); setProblem('');
    try { await onUpdateStatus(app.id, status); }
    catch (e) { setProblem(e.message || t.updateFailed); }
    finally { setSaving(null); }
  };
  const statusName = status => ({ submitted: t.submitted, shortlisted: t.shortlisted,
    accepted: t.accepted, rejected: t.rejected })[status] || status;
  return <div className="mx-auto max-w-[860px] space-y-4">
    <h1 className="text-2xl font-semibold">{t.inboxTitle}</h1>
    {jobTitle && <p className="text-[#4A4744] font-semibold">{jobTitle}</p>}
    <p className="text-[#4A4744]">{t.inboxIntro}</p>
    {(error || problem) && <p role="alert" className="p-4 rounded-xl bg-[#FAF0EE] text-[#AE332A]">{error || problem}</p>}
    {!applications.length && <p className="bg-white p-5 border border-[#EAE7E1] rounded-xl">{t.noApplications}</p>}
    {applications.map(app => <article key={app.id} className="rounded-[20px] border border-[#EAE7E1] bg-white p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-xl">{app.job_title}</h2>
        <span className="bg-[#F0EEE9] rounded-full px-3 py-1 text-sm">{statusName(app.status)}</span>
      </div>
      <p className="text-[#4A4744]">{t.applicant}: <strong className="text-[#1C1B1A]">{app.applicant_name}</strong></p>
      {app.applicant_location && <p className="text-sm text-[#6E6963]">{lang === 'ne' ? 'स्थान' : 'Location'}: {app.applicant_location}</p>}
      {app.applicant_availability && <p className="text-sm text-[#6E6963]">{lang === 'ne' ? 'उपलब्धता' : 'Availability'}: {app.applicant_availability}</p>}
      <p className="whitespace-pre-wrap rounded-xl bg-[#FBFAF8] p-3 text-sm">{app.message}</p>
      <p className="text-[#6E6963] text-sm">{t.proposedRate}: ${Number(app.proposed_rate_usd).toFixed(2)}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-full bg-[#C73E33] text-white font-semibold px-5 min-h-[44px]" onClick={() => onOpenChat(app.id)}>{t.messages}</button>
        {app.status === 'accepted' && <button type="button" className="rounded-full border border-[#EAE7E1] px-5 min-h-[44px]" onClick={() => onOpenWorkroom(app.id)}>{t.workroom}</button>}
        {['submitted', 'shortlisted'].includes(app.status) && <>
          {app.status === 'submitted' && <button type="button" disabled={saving === app.id} className="rounded-full border border-[#EAE7E1] px-4 min-h-[44px] disabled:opacity-50" onClick={() => update(app, 'shortlisted')}>{t.shortlist}</button>}
          <button type="button" disabled={saving === app.id} className="rounded-full border border-[#EAE7E1] px-4 min-h-[44px] disabled:opacity-50" onClick={() => update(app, 'accepted')}>{t.acceptApplicant}</button>
          <button type="button" disabled={saving === app.id} className="rounded-full border border-[#EAE7E1] px-4 min-h-[44px] disabled:opacity-50" onClick={() => update(app, 'rejected')}>{t.rejectApplicant}</button>
        </>}
      </div>
    </article>)}
  </div>;
}
