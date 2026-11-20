// Shared, account-backed Workroom. No payments are transferred by this interface.
import { useCallback, useEffect, useState } from 'react';
import { flow } from '../api/flows.js';
import { connectedText } from '../i18n/connected.js';

const field = 'w-full rounded-xl border border-[#EAE7E1] px-4 py-3 bg-white min-h-[48px]';
const redButton = 'rounded-full bg-[#C73E33] px-5 py-3 font-semibold text-white disabled:opacity-50';
const outlineButton = 'rounded-full border border-[#EAE7E1] px-5 py-3 bg-white disabled:opacity-50';
const copy = {
  en: {
    agreed: 'Agreed amount', allocated: 'Allocated to milestones', released: 'Released (simulation)',
    complete: 'All agreed milestones complete', incomplete: 'Workroom is not finished yet',
    coverage: 'All milestones must be released and their amounts must add up to the agreed rate before a job counts as completed.',
    description: 'Completed work / delivery notes', descriptionHint: 'Explain what you delivered, or paste written work here.',
    links: 'Project links (one per line)', linksHint: 'GitHub, deployment, Drive, Figma, or other http(s) links',
    files: 'Attach screenshots, photos, or a PDF', fileHint: 'Up to 3 files per milestone, 2 MB each. JPEG, PNG or PDF.',
    submit: 'Submit work for client review', revision: 'Request revision', reviseNote: 'What needs to be changed?',
    release: 'Approve work & simulate release', proof: 'Submitted work', download: 'Download private attachment',
    noProof: 'No deliverables were attached to this old milestone.',
    revisionRequested: 'Revision requested', revise: 'Revise and resubmit work',
    funded: 'Funding is simulated; no money has been transferred.',
    practice: 'Practice workroom. The client and all payment states are fictional.',
    clientOnly: 'Only the employer can review or release a real milestone.',
    loading: 'Saving...', missing: 'Add work notes, a project link, or a file before submitting.',
    saved: 'Submission saved', planned: 'Planned', funded_demo: 'Funding simulated',
    submitted: 'Submitted for review', revision_requested: 'Revision requested', released_demo: 'Released (demo)',
  },
  ne: {
    agreed: 'सहमत रकम', allocated: 'माइलस्टोनमा छुट्याइएको', released: 'जारी भएको (डेमो)',
    complete: 'सबै सहमत माइलस्टोन पूरा भए', incomplete: 'काम अझै पूरा भएको छैन',
    coverage: 'काम पूरा मान्न सबै माइलस्टोनको रकम सहमत रकम बराबर हुनुपर्छ र सबै स्वीकृत हुनुपर्छ।',
    description: 'पूरा गरेको काम / विवरण', descriptionHint: 'तपाईंले पूरा गरेको काम वर्णन गर्नुहोस् वा लेखिएको सामग्री राख्नुहोस्।',
    links: 'प्रोजेक्ट लिंकहरू (प्रत्येक लाइनमा एउटा)', linksHint: 'GitHub, वेबसाइट, Drive, Figma वा अन्य लिंक',
    files: 'स्क्रिनसट, फोटो वा PDF जोड्नुहोस्', fileHint: 'प्रत्येक माइलस्टोनमा बढीमा ३ फाइल, हरेक २ MB। JPEG, PNG वा PDF।',
    submit: 'समीक्षाको लागि काम पठाउनुहोस्', revision: 'सुधार माग्नुहोस्', reviseNote: 'के सुधार गर्नुपर्छ?',
    release: 'काम स्वीकृत र डेमो भुक्तानी', proof: 'पेस गरिएको काम', download: 'निजी फाइल डाउनलोड',
    noProof: 'यो पुरानो माइलस्टोनमा प्रमाण छैन।',
    revisionRequested: 'सुधार मागिएको छ', revise: 'काम सुधारेर फेरि पठाउनुहोस्',
    funded: 'भुक्तानी डेमो मात्र हो; पैसा सारिएको छैन।',
    practice: 'यो अभ्यास वर्करुम हो। ग्राहक र भुक्तानी दुवै काल्पनिक हुन्।',
    clientOnly: 'वास्तविक माइलस्टोनको समीक्षा र स्वीकृति रोजगारदाताले मात्र गर्न सक्छन्।',
    loading: 'सेभ हुँदैछ...', missing: 'पठाउनुअघि कामको विवरण, लिंक वा फाइल राख्नुहोस्।',
    saved: 'काम सेभ भयो', planned: 'योजनामा', funded_demo: 'डेमो फन्डिङ',
    submitted: 'समीक्षाको लागि पठाइएको', revision_requested: 'सुधार मागिएको', released_demo: 'जारी (डेमो)',
  },
};

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read selected file.'));
    reader.readAsDataURL(file);
  });
}

function saveDownloadedFile(data) {
  const raw = atob(data.base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  const objectUrl = URL.createObjectURL(new Blob([bytes], { type: data.mime_type }));
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = data.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function MilestoneCard({ milestone: m, applicationId, isClient, practice, busy, setBusy, refresh, showError, lang }) {
  const s = copy[lang] || copy.en;
  const [description, setDescription] = useState(m.delivery_note || '');
  const [links, setLinks] = useState((m.delivery_links || []).join('\n'));
  const [attachments, setAttachments] = useState([]);
  const [revision, setRevision] = useState('');
  const [message, setMessage] = useState('');
  const editable = (!isClient || practice) && ['funded_demo', 'revision_requested'].includes(m.state);
  const stateUrl = `workrooms/${applicationId}/milestones/${m.id}/${practice ? 'practice-step' : 'state'}/`;
  const changeState = async (nextState, extra = {}) => {
    setBusy(true); showError('');
    try {
      await flow(stateUrl, { method: 'POST', body: { state: nextState, ...extra } });
      setRevision(''); setMessage(''); await refresh();
    } catch (e) { showError(e.message); }
    finally { setBusy(false); }
  };
  const submit = async e => {
    e.preventDefault();
    const urls = links.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    if (!description.trim() && !urls.length && !attachments.length && !(m.files || []).length) {
      showError(s.missing); return;
    }
    if (urls.length > 5 || attachments.length + (m.files || []).length > 3) {
      showError('Up to five links and three files are allowed.'); return;
    }
    if (attachments.some(file => file.size > 2_000_000 || !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type))) {
      showError(s.fileHint); return;
    }
    setBusy(true); showError(''); setMessage('');
    try {
      const root = `workrooms/${applicationId}/milestones/${m.id}/`;
      await flow(root + 'delivery/', { method: 'POST', body: { description, links: urls } });
      for (const file of attachments) {
        await flow(root + 'files/', { method: 'POST', body: { name: file.name, data: await readFile(file) } });
      }
      await flow(stateUrl, { method: 'POST', body: { state: 'submitted' } });
      setAttachments([]); setMessage(s.saved); await refresh();
    } catch (e) { showError(e.message); await refresh(); }
    finally { setBusy(false); }
  };
  const deleteFile = async fileId => {
    setBusy(true); showError('');
    try { await flow(`workrooms/${applicationId}/milestones/${m.id}/files/${fileId}/`, { method: 'DELETE' }); await refresh(); }
    catch (e) { showError(e.message); } finally { setBusy(false); }
  };
  const download = async fileId => {
    setBusy(true); showError('');
    try {
      const data = await flow(`workrooms/${applicationId}/milestones/${m.id}/files/${fileId}/`);
      saveDownloadedFile(data);
    } catch (e) { showError(e.message); } finally { setBusy(false); }
  };
  return <div className="rounded-xl border border-[#EAE7E1] p-4 space-y-3">
    <div className="flex flex-wrap justify-between gap-2"><strong>{m.title}</strong><span>${Number(m.amount_usd).toFixed(2)}</span></div>
    <p className="text-sm text-[#4A4744]">{s[m.state] || m.state.replaceAll('_', ' ')}</p>
    {!!m.revision_note && <p className="rounded-xl bg-[#FAF0EE] p-3 text-[#AE332A]" role="status">{s.revisionRequested}: {m.revision_note}</p>}
    {(m.has_delivery || m.state === 'submitted' || m.state === 'released_demo') && <section className="space-y-2 rounded-xl bg-[#FAFAF9] p-3">
      <h3 className="font-semibold">{s.proof}</h3>
      {m.delivery_note ? <p className="whitespace-pre-wrap break-words">{m.delivery_note}</p> : null}
      {(m.delivery_links || []).map((url, i) => <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block break-all text-[#A82D25] underline">{url}</a>)}
      {(m.files || []).map(file => <div key={file.id} className="flex flex-wrap items-center gap-2">
        <button type="button" className="text-[#A82D25] underline text-left" disabled={busy} onClick={() => download(file.id)}>{s.download}: {file.original_name}</button>
        {editable && <button type="button" disabled={busy} className="text-sm underline" onClick={() => deleteFile(file.id)}>Remove</button>}
      </div>)}
      {!m.has_delivery && <p className="text-sm text-[#A82D25]">{s.noProof}</p>}
    </section>}
    {(isClient || practice) && m.state === 'planned' && <button type="button" className={redButton} disabled={busy} onClick={() => changeState('funded_demo')}>Simulate funding</button>}
    {editable && <form onSubmit={submit} className="space-y-3 rounded-xl border border-[#EAE7E1] p-3">
      <label className="block font-medium">{s.description}
        <textarea className={field} rows={4} maxLength={5000} value={description} placeholder={s.descriptionHint} onChange={e => setDescription(e.target.value)}/>
      </label>
      <label className="block font-medium">{s.links}
        <textarea className={field} rows={2} value={links} placeholder={s.linksHint} onChange={e => setLinks(e.target.value)}/>
      </label>
      <label className="block font-medium">{s.files}
        <input type="file" multiple accept="image/jpeg,image/png,application/pdf" className="block w-full mt-2" onChange={e => setAttachments(Array.from(e.target.files || []))}/>
        <small className="block text-[#6B6561]">{s.fileHint}</small>
      </label>
      <button type="submit" className={redButton} disabled={busy}>{busy ? s.loading : m.state === 'revision_requested' ? s.revise : s.submit}</button>
      {message && <p role="status" className="text-sm">{message}</p>}
    </form>}
    {(isClient || practice) && m.state === 'submitted' && <div className="space-y-3">
      <p className="text-sm text-[#4A4744]">Review the submitted work and attachments before approval. No real payment is made.</p>
      <button type="button" className={redButton} disabled={busy || !m.has_delivery} onClick={() => changeState('released_demo')}>{s.release}</button>
      {!practice && <div className="space-y-2">
        <label className="block font-medium">{s.reviseNote}
          <textarea className={field} maxLength={1000} rows={2} value={revision} onChange={e => setRevision(e.target.value)} />
        </label>
        <button type="button" className={outlineButton} disabled={busy || revision.trim().length < 5} onClick={() => changeState('revision_requested', { note: revision })}>{s.revision}</button>
      </div>}
    </div>}
  </div>;
}

export function ConnectedWorkroom({ applicationId, myId, onBack, lang = 'en' }) {
  const t = connectedText[lang] || connectedText.en;
  const s = copy[lang] || copy.en;
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const refresh = useCallback(async () => {
    if (!applicationId) return;
    try {
      const [work, conversation] = await Promise.all([
        flow(`workrooms/${applicationId}/`), flow(`conversations/${applicationId}/`),
      ]);
      setRoom(work); setIsClient(conversation.client_id === myId); setError('');
    } catch (e) { setError(e.message); }
  }, [applicationId, myId]);
  useEffect(() => { refresh(); }, [refresh]);
  const add = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await flow(`workrooms/${applicationId}/milestones/`, { method: 'POST', body: { title, amount_usd: amount, position: room.milestones.length } });
      setTitle(''); setAmount(''); await refresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const dollars = n => `$${Number(n || 0).toFixed(2)}`;
  const remaining = Math.max(0, Number(room?.agreed_amount_usd || 0) - Number(room?.total_allocated_usd || 0));
  return <div className="mx-auto max-w-[800px] space-y-4">
    <button onClick={onBack} className={outlineButton}>{t.back}</button>
    <div className="rounded-[20px] border border-[#EAE7E1] p-5 bg-white space-y-2">
      <h1 className="text-2xl font-semibold">{t.workroom}</h1>
      <p className="text-[#4A4744]">{t.workroomIntro}</p>
      <p className="text-sm text-[#AE332A]">{t.paymentNote}</p>
    </div>
    {error && <p role="alert" className="bg-[#FAF0EE] p-4 rounded-xl text-[#AE332A]">{error}</p>}
    {room && <>
      {room.is_demo && <p className="rounded-xl border border-[#EAE7E1] bg-[#FAF0EE] p-4 text-sm">{s.practice}</p>}
      <section className="rounded-[20px] border border-[#EAE7E1] bg-white p-5 space-y-2">
        <h2 className="text-xl font-semibold">{room.is_complete ? s.complete : s.incomplete}</h2>
        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          <p>{s.agreed}: <strong>{dollars(room.agreed_amount_usd)}</strong></p>
          <p>{s.allocated}: <strong>{dollars(room.total_allocated_usd)}</strong></p>
          <p>{s.released}: <strong>{dollars(room.total_released_usd)}</strong></p>
        </div>
        {!room.is_complete && <p className="text-sm text-[#6B6561]">{s.coverage} {remaining > 0 ? `Amount not yet allocated: ${dollars(remaining)}.` : ''}</p>}
      </section>
      <div className="rounded-[20px] border border-[#EAE7E1] bg-white p-5">
        <h2 className="text-xl font-semibold mb-2">{t.scope}</h2>
        <p className="whitespace-pre-wrap">{room.scope || t.noScope}</p>
      </div>
      <div className="rounded-[20px] border border-[#EAE7E1] bg-white p-5 space-y-4">
        <h2 className="text-xl font-semibold">{t.milestones}</h2>
        {!room.milestones?.length && <p>{t.noMilestones}</p>}
        {(room.milestones || []).map(m => <MilestoneCard key={m.id} milestone={m} applicationId={applicationId}
          isClient={isClient} practice={room.is_demo} busy={busy} setBusy={setBusy}
          refresh={refresh} showError={setError} lang={lang}/>)}
      </div>
      {isClient && !room.is_complete && <form onSubmit={add} className="rounded-[20px] border border-[#EAE7E1] bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold">{t.addMilestone}</h2>
        <label className="block">{t.milestoneTitle}<input required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} className={field}/></label>
        <label className="block">{t.amount}<input required type="number" min="0.01" step="0.01" max={remaining.toFixed(2)} value={amount} onChange={e => setAmount(e.target.value)} className={field}/></label>
        <button type="submit" disabled={busy || !title.trim() || Number(amount) <= 0 || Number(amount) > remaining} className={redButton}>{t.saveMilestone}</button>
      </form>}
    </>}
  </div>;
}
