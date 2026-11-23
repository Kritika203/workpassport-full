import { connectedText } from '../i18n/connected.js';
// Messages for actual freelancer and client accounts.
import { useCallback, useEffect, useState } from 'react';
import { flow } from '../api/flows.js';
import { api, readApiSession } from '../api/client.js';

const input = 'w-full min-h-[48px] rounded-xl border border-[#E3E6E1] px-4 py-3 bg-white text-[#141614]';
const mainBtn = 'rounded-full bg-[#003D14] hover:bg-[#0E5C2A] text-white font-semibold px-6 min-h-[48px] disabled:opacity-50';
const altBtn = 'rounded-full border border-[#E3E6E1] font-semibold px-5 min-h-[44px] bg-white';

export function ConnectedConversation({ applicationId, myId, onBack, lang = 'en' }) {
  const t = connectedText[lang] || connectedText.en;
  const [conversation, setConversation] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [draftLanguage, setDraftLanguage] = useState(lang === 'ne' ? 'ne' : 'en');
  const [translation, setTranslation] = useState(null);
  const [translationBusy, setTranslationBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [external, setExternal] = useState(null);
  const [outboundText, setOutboundText] = useState('');
  const [viewTranslations, setViewTranslations] = useState({});
  const [translatedMessages, setTranslatedMessages] = useState({});
  const [receivedSource, setReceivedSource] = useState('auto');
  const [languageError, setLanguageError] = useState('');
  const ne = lang === 'ne';
  const speak = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setLanguageError(ne ? 'यो ब्राउजरमा आवाजबाट लेख्ने सुविधा उपलब्ध छैन।' : 'Voice typing is unavailable in this browser.'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = draftLanguage === 'ne' ? 'ne-NP' : 'en-US';
    recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onresult = event => { const words = event.results?.[0]?.[0]?.transcript || ''; setDraft(old => (old ? old + ' ' : '') + words); setTranslation(null); };
    recognition.onerror = event => { setLanguageError(`Microphone: ${event.error}`); setListening(false); };
    recognition.onend = () => setListening(false);
    try { recognition.start(); setListening(true); setLanguageError(''); }
    catch { setListening(false); setLanguageError('Could not start microphone.'); }
  };
  const translate = async (text, source, target) => {
    const response = await api('/api/auth/translate/', { method: 'POST', body: { text, source, target } }, readApiSession());
    return response.translated;
  };
  const translateDraft = async () => {
    if (!draft.trim()) return;
    setTranslationBusy(true); setLanguageError('');
    try { const translated = await translate(draft, draftLanguage, draftLanguage === 'ne' ? 'en' : 'ne'); setTranslation({ translated, original: draft, source: draftLanguage }); }
    catch (e) { setLanguageError(e.message); }
    finally { setTranslationBusy(false); }
  };
  const translateMessage = async m => {
    setLanguageError('');
    // Prefer Unicode detection for Devanagari; otherwise allow explicit source choice.
    // Romanized Nepali is ambiguous and must be chosen manually.
    const source = receivedSource === 'auto' ? (/[\u0900-\u097F]/.test(m.text) ? 'ne' : 'en') : receivedSource;
    const target = source === 'ne' ? 'en' : 'ne';
    try { const translated = await translate(m.text, source, target);
      setTranslatedMessages(old => ({ ...old, [m.id]: translated })); setViewTranslations(old => ({ ...old, [m.id]: true })); }
    catch (e) { setLanguageError(e.message); }
  };
  const openExternal = channel => { setExternal(channel); setOutboundText(''); };
  const proceedExternal = () => {
    const base = external === 'whatsapp' ? 'https://api.whatsapp.com/send?text=' : 'https://www.messenger.com/';
    const url = external === 'whatsapp' ? base + encodeURIComponent(outboundText || 'Hello, I would like to discuss our Vouch opportunity.') : base;
    window.open(url, '_blank', 'noopener,noreferrer'); setExternal(null);
  };
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
      setDraft(''); setTranslation(null); await load();
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
    <div className="rounded-[20px] border border-[#E3E6E1] bg-white p-5">
      <h1 className="text-2xl font-semibold">{t.messages}</h1>
      <p className="mt-2 text-[#475249]">{t.messagesIntro}</p>
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
      {conversation.muted && <div className="rounded-xl bg-[#E7F0E9] p-4">{t.muted}</div>}
      <div className="rounded-[20px] border border-[#E3E6E1] bg-white p-5 space-y-3 max-h-[460px] overflow-y-auto">
        <label className="text-xs text-gray-600 block">{ne ? 'प्राप्त सन्देशको मूल भाषा' : 'Incoming message original language'} <select className={altBtn} value={receivedSource} onChange={e=>{setReceivedSource(e.target.value);setTranslatedMessages({});setViewTranslations({});}}><option value="auto">Auto: Devanagari / English</option><option value="ne">नेपाली / Nepanglish</option><option value="en">English</option></select></label>
        {(conversation.messages || []).length === 0 && <p className="text-[#687169]">{t.emptyMessages}</p>}
        {(conversation.messages || []).map(m => <div key={m.id} className={`max-w-[90%] rounded-xl p-3 ${m.sender_id === myId ? 'ml-auto bg-[#FAF0EE]' : 'mr-auto bg-[#E7F0E9]'}`}>
          <p className="whitespace-pre-wrap break-words">{viewTranslations[m.id] && translatedMessages[m.id] ? translatedMessages[m.id] : m.text}</p>
          {translatedMessages[m.id] && <button type="button" className="text-xs underline mt-1" onClick={()=>setViewTranslations(old=>({...old,[m.id]:!old[m.id]}))}>{viewTranslations[m.id] ? (ne?'मूल सन्देश':'View original') : (ne?'अनुवाद':'View translation')}</button>}
          {!translatedMessages[m.id] && <button type="button" className="text-xs underline mt-1" onClick={()=>translateMessage(m)}>{ne?'अनुवाद गर्ने प्रयास':'Translate (optional)'}</button>}
          <p className="mt-1 text-xs text-[#687169]">{new Date(m.created_at).toLocaleString()}</p>
        </div>)}
      </div>
      <section className="rounded-2xl bg-white border border-[#E3E6E1] p-4 space-y-3">
        <p className="font-semibold">{ne?'सन्देशको भाषा र आवाज':'Message language and voice input'}</p>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-sm">{ne?'बोल्ने/लेख्ने भाषा':'Speaking / typing in'} <select className={altBtn} value={draftLanguage} onChange={e=>{setDraftLanguage(e.target.value);setTranslation(null);}}><option value="ne">नेपाली</option><option value="en">English</option></select></label>
          <button type="button" className={altBtn} onClick={speak} disabled={listening||conversation.blocked}>{listening ? (ne?'सुन्दैछ…':'Listening…') : (ne?'🎤 आवाजबाट लेख्नुहोस्':'🎤 Voice to text')}</button>
          <button type="button" className={altBtn} onClick={translateDraft} disabled={translationBusy || !draft.trim()}>{translationBusy?'…':(ne?'अनुवाद पूर्वावलोकन':'Preview translation')}</button>
        </div>
        {translation && <div className="rounded-xl bg-[#F7F7F4] p-3 text-sm"><strong>{ne?'मेसिन अनुवाद (जाँच्नुहोस्)':'Machine translation (review carefully)'}</strong><p className="whitespace-pre-wrap mt-1">{translation.translated}</p><p className="text-xs mt-2 text-gray-600">{ne?'मूल सन्देश नै पठाइन्छ। अनुवाद केवल पूर्वावलोकन हो।':'Your original message will be sent; this translation is a preview only.'}</p></div>}
        {languageError && <p role="alert" className="text-red-700 text-sm">{languageError}</p>}
        <p className="text-xs text-gray-600">{ne?'आवाजको पहिचान ब्राउजरमा निर्भर छ। अनुवाद गर्दा पाठ कन्फिगर गरिएको सेवामा पठाइन्छ।':'Speech recognition depends on your browser. Optional translation sends the selected text to the configured translation provider. For alternative typing you can use voicetypingnepali.com in a separate tab.'}</p>
      </section>
      <form onSubmit={send} className="flex gap-2">
        <input className={input} value={draft} onChange={e => setDraft(e.target.value)} maxLength={4000} placeholder={t.compose} disabled={conversation.blocked || (conversation.muted && !freelancer)} />
        <button type="submit" className={mainBtn} disabled={!draft.trim() || busy || conversation.blocked || (conversation.muted && !freelancer)}>{t.send}</button>
      </form>
      <div className="rounded-2xl border bg-white p-4 space-y-3">
        <h2 className="font-semibold">{ne?'बाहिरी च्याटमा जानुहोस् (वैकल्पिक)':'External messaging (optional)'}</h2>
        <p className="text-sm text-gray-700">{ne?'WhatsApp वा Messenger मा जाँदा Vouch ले त्यो कुराकानी हेर्न, प्रमाणित गर्न वा सुरक्षित राख्न सक्दैन। सम्झौता र भुक्तानी सम्बन्धी निर्णय यहाँ नै पुष्टि गर्नुहोस्।':'WhatsApp and Messenger chats happen outside Vouch. We cannot monitor, verify, or preserve those messages. Keep agreements, payments, and milestones confirmed here.'}</p>
        <div className="flex gap-2 flex-wrap"><button type="button" className={altBtn} onClick={()=>openExternal('whatsapp')}>WhatsApp</button><button type="button" className={altBtn} onClick={()=>openExternal('messenger')}>Messenger</button></div>
      </div>
      {external && <div role="dialog" aria-modal="true" aria-label="External chat warning" className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md p-6 space-y-4 shadow-xl">
          <h2 className="font-bold text-xl">{ne?'Vouch बाहिर जाँदै हुनुहुन्छ':'You are leaving Vouch'}</h2>
          <p className="text-sm">{ne?'बाहिरी प्लेटफर्ममा साझा गरिएको फोन नम्बर वा जानकारी Vouch ले नियन्त्रण गर्न सक्दैन। ठगी, उत्पीडन, भुक्तानी र निजी गोपनीयताको जोखिम हुन सक्छ। आधिकारिक सम्झौता यहीँ राख्नुहोस्।':'External chats may expose your personal contact information and are outside Vouch moderation and evidence tracking. We cannot guarantee their safety or recover deleted external messages. Do not send advance fees or sensitive documents; confirm important agreements inside Vouch.'}</p>
          {external==='whatsapp'&&<label className="block text-sm">{ne?'साझा गर्ने सन्देश (ऐच्छिक)':'Message to share (optional)'}<textarea maxLength={500} className={input} rows={2} value={outboundText} onChange={e=>setOutboundText(e.target.value)}/></label>}
          <p className="text-xs text-gray-600">{external==='messenger'?'Messenger opens separately. We cannot automatically select or sync your private conversation.':'WhatsApp opens its own recipient picker. No phone number is automatically shared by Vouch.'}</p>
          <div className="flex gap-3 justify-end"><button type="button" className={altBtn} onClick={()=>setExternal(null)}>{ne?'रद्द':'Cancel'}</button><button type="button" className={mainBtn} onClick={proceedExternal}>{ne?'जोखिम बुझेँ, जारी राख्नुहोस्':'I understand, continue'}</button></div>
        </div>
      </div>}
      {freelancer && <div className="bg-white rounded-[20px] border border-[#E3E6E1] p-4 space-y-2">
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
