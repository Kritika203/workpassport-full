import { connectedText } from '../i18n/connected.js';
// Messages for actual freelancer and client accounts.
import { useCallback, useEffect, useState } from 'react';
import { flow } from '../api/flows.js';
import { api, readApiSession } from '../api/client.js';

const input = 'w-full min-h-[48px] rounded-xl border border-[#EAE7E1] px-4 py-3 bg-white text-[#1C1B1A]';
const mainBtn = 'rounded-full bg-[#C73E33] hover:bg-[#AE332A] text-white font-semibold px-6 min-h-[48px] disabled:opacity-50';
const altBtn = 'rounded-full border border-[#EAE7E1] font-semibold px-5 min-h-[44px] bg-white';

export function ConnectedConversation({ applicationId, myId, onBack, lang = 'en' }) {
  const t = connectedText[lang] || connectedText.en;
  const [conversation, setConversation] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reportReason, setReportReason] = useState('');
  const load = useCallback(async () => {
    if (!applicationId) return;
    try { setConversation(await flow(`conversations/${applicationId}/`)); setError(''); }
    catch (e) { setError(e.message); }
  }, [applicationId]);
  useEffect(() => {
    load();
    const id = setInterval(load, 12000);
    return () => clearInterval(id);
  }, [load]);
  const send = async e => {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      await flow(`conversations/${applicationId}/`, { method: 'POST', body: { text: draft.trim() } });
      setDraft(''); await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const changeContact = async change => {
    try {
      await flow(`conversations/${applicationId}/controls/`, { method: 'PATCH', body: change });
      await load();
    } catch (e) { setError(e.message); }
  };
  const saveEvidence = async () => {
    const text = (conversation?.messages || []).map(m => `${m.sender_id === myId ? 'Me' : 'Other person'}: ${m.text}`).join('\n');
    if (!text) return;
    try {
      await flow('evidence/', { method: 'POST', body: { text: text.slice(0, 10000), categories: [], source: 'chat' } });
      setError(''); alert(t.savedEvidence);
    } catch (e) { setError(e.message); }
  };
  const report = async () => {
    if (!reportReason) return;
    try {
      await api('/api/auth/reports/', { method: 'POST', body: { kind: 'client', job_reference: String(applicationId), reason: reportReason } }, readApiSession());
      setReportReason(''); setError(''); alert(t.reportSaved);
    } catch (e) { setError(e.message); }
  };
  const freelancer = conversation?.freelancer_id === myId;
  return <div className="mx-auto max-w-[800px] space-y-4">
    <button onClick={onBack} className={altBtn}>{t.back}</button>
    <div className="rounded-[20px] border border-[#EAE7E1] bg-white p-5">
      <h1 className="text-2xl font-semibold">{t.messages}</h1>
      <p className="mt-2 text-[#4A4744]">{t.messagesIntro}</p>
    </div>
    {error && <div role="alert" className="rounded-xl bg-[#FAF0EE] p-4 text-[#AE332A]">{error}</div>}
    {conversation && <>
      {conversation.is_demo && <p className="rounded-xl bg-[#FAF0EE] p-4 text-sm">{t.practiceConversation}</p>}
      {freelancer && <div className="flex flex-wrap gap-2">
        <button className={altBtn} onClick={() => changeContact({ muted: !conversation.muted })}>{conversation.muted ? t.unmute : t.mute}</button>
        <button className={altBtn} onClick={() => changeContact({ blocked: !conversation.blocked })}>{conversation.blocked ? t.unblock : t.block}</button>
        <button className={altBtn} onClick={saveEvidence}>{t.saveEvidence}</button>
      </div>}
      {conversation.blocked && <div className="rounded-xl bg-[#FAF0EE] p-4">{t.blocked}</div>}
      {conversation.muted && <div className="rounded-xl bg-[#F0EEE9] p-4">{t.muted}</div>}
      <div className="rounded-[20px] border border-[#EAE7E1] bg-white p-5 space-y-3 max-h-[460px] overflow-y-auto">
        {(conversation.messages || []).length === 0 && <p className="text-[#6E6963]">{t.emptyMessages}</p>}
        {(conversation.messages || []).map(m => <div key={m.id} className={`max-w-[90%] rounded-xl p-3 ${m.sender_id === myId ? 'ml-auto bg-[#FAF0EE]' : 'mr-auto bg-[#F0EEE9]'}`}>
          <p className="whitespace-pre-wrap break-words">{m.text}</p>
          <p className="mt-1 text-xs text-[#6E6963]">{new Date(m.created_at).toLocaleString()}</p>
        </div>)}
      </div>
      <form onSubmit={send} className="flex gap-2">
        <input className={input} value={draft} onChange={e => setDraft(e.target.value)} maxLength={4000} placeholder={t.compose} disabled={conversation.blocked || (conversation.muted && !freelancer)} />
        <button type="submit" className={mainBtn} disabled={!draft.trim() || busy || conversation.blocked || (conversation.muted && !freelancer)}>{t.send}</button>
      </form>
      {freelancer && <div className="bg-white rounded-[20px] border border-[#EAE7E1] p-4 space-y-2">
        <label htmlFor="client-report-reason" className="font-semibold block">{t.reason}</label>
        <select id="client-report-reason" className={input} value={reportReason} onChange={e => setReportReason(e.target.value)}>
          <option value="">{t.pickReason}</option><option value="Scam">{t.scam}</option><option value="Harassment">{t.harassment}</option><option value="Asked for personal photos">{t.photos}</option><option value="Other">{t.other}</option>
        </select>
        <button onClick={report} disabled={!reportReason} className={mainBtn}>{t.report}</button>
      </div>}
    </>}
    {!conversation && !error && <p>{t.loading}</p>}
  </div>;
}
