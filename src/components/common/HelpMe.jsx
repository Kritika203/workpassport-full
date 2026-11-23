import { useRef, useState, useEffect } from 'react';
import { api, readApiSession } from '../../api/client.js';

const SUGGESTIONS = {
  en: ['How do I apply for a job?', 'Where are my applications?', 'How do I upload a CV?', 'How do I report a scam?'],
  ne: ['काममा कसरी आवेदन दिने?', 'मेरो आवेदन कहाँ छ?', 'CV कसरी थप्ने?', 'ठगी कसरी रिपोर्ट गर्ने?'],
};
const WELCOME = {
  en: 'Hi! I’m Vouch Help Me. Ask me anything about using FirstWork, applications, CVs, safety, or client features.',
  ne: 'नमस्ते! म Vouch Help Me हुँ। FirstWork, आवेदन, CV, सुरक्षा वा रोजगारदाताका सुविधाबारे सोध्नुहोस्।',
};
const FALLBACK = {
  en: 'I could not reach Help Me right now. Try again, or find Applications & Workrooms from the main menu, and Passport for CV import.',
  ne: 'अहिले Help Me सँग सम्पर्क हुन सकेन। फेरि प्रयास गर्नुहोस्। आवेदनका लागि Applications & Workrooms र CV का लागि Passport खोल्नुहोस्।',
};

export function HelpMe({ lang = 'en' }) {
  const [currentLanguage, setCurrentLanguage] = useState(lang);
  const language = currentLanguage === 'ne' ? 'ne' : 'en';
  const toggle = () => {
    try { setCurrentLanguage(JSON.parse(localStorage.getItem('wp_language') || '"en"')); } catch { setCurrentLanguage('en'); }
    setOpen(previous => !previous);
  };
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ block: 'nearest' }); }, [messages, open]);
  async function send(ask = draft) {
    const message = ask.trim();
    if (!message || loading || message.length > 500) return;
    const next = [...messages, { role: 'user', content: message }];
    setMessages(next); setDraft(''); setLoading(true); setError('');
    try {
      const data = await api('/api/auth/help-chat/', { method: 'POST', body: {
        message, language, history: messages.slice(-4).map(({role, content}) => ({ role, content }))
      }}, readApiSession());
      if (!data?.answer) throw new Error('No answer received.');
      setMessages(previous => [...previous, { role: 'assistant', content: data.answer, mode: data.mode }]);
    } catch (e) {
      setError(e.message || 'Help Me unavailable');
      setMessages(previous => [...previous, { role: 'assistant', content: FALLBACK[language], mode: 'offline' }]);
    } finally { setLoading(false); }
  }
  return <div className="fixed bottom-5 right-4 sm:right-6 z-[75] flex flex-col items-end gap-2">
    {open && <section role="dialog" aria-label="Vouch Help Me chatbot" className="w-[min(94vw,390px)] max-h-[75vh] bg-white border border-[#E3E6E1] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      <header className="px-4 py-3 bg-[#F7F7F4] flex justify-between items-center">
        <div><h2 className="font-bold">{language === 'ne' ? 'Help Me च्याटबोट' : 'Help Me chatbot'}</h2><p className="text-xs text-gray-600">{language === 'ne' ? 'Vouch चलाउन मद्दत' : 'Guidance for using Vouch'}</p></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close chatbot" className="min-w-10 min-h-10">✕</button>
      </header>
      <div aria-live="polite" className="p-4 space-y-3 overflow-y-auto min-h-[160px] max-h-[48vh]">
        <p className="text-sm bg-[#F7F7F4] rounded-xl p-3">{WELCOME[language]}</p>
        {messages.map((item, index) => <div key={index} className={`max-w-[95%] text-sm p-3 rounded-xl whitespace-pre-wrap break-words ${item.role === 'user' ? 'ml-auto bg-[#FAF0EE]' : 'mr-auto bg-[#F7F7F4]'}`}>
          {item.content}
          {item.mode === 'local' && <p className="text-[11px] text-gray-500 mt-2">{language === 'ne' ? 'एप मार्गदर्शन' : 'Built-in app guidance'}</p>}
        </div>)}
        {loading && <p role="status" className="text-sm text-gray-600">{language === 'ne' ? 'जवाफ तयार हुँदैछ…' : 'Thinking…'}</p>}
        <div ref={endRef} />
      </div>
      {messages.length === 0 && <div className="px-4 pb-2 flex flex-wrap gap-2">{SUGGESTIONS[language].map(q => <button key={q} type="button" disabled={loading} onClick={() => send(q)} className="text-xs border rounded-full px-3 py-2 hover:bg-[#FAF0EE]">{q}</button>)}</div>}
      {error && <p role="alert" className="px-4 text-xs text-red-700">{language === 'ne' ? 'नेटवर्क समस्या। तलको जवाफ सामान्य मार्गदर्शन मात्र हो।' : 'Connection issue. The reply below is general guidance only.'}</p>}
      <form className="p-3 border-t flex items-end gap-2" onSubmit={e => {e.preventDefault(); send();}}>
        <label htmlFor="wp-help-input" className="sr-only">{language === 'ne' ? 'प्रश्न सोध्नुहोस्' : 'Ask a question'}</label>
        <textarea id="wp-help-input" rows={2} maxLength={500} value={draft} onChange={e => setDraft(e.target.value)} placeholder={language === 'ne' ? 'म के गरूँ? यहाँ लेख्नुहोस्…' : 'Ask about Vouch…'} className="flex-1 min-w-0 border border-[#E3E6E1] rounded-xl p-3 text-sm" onKeyDown={e => {if (e.key === 'Enter' && !e.shiftKey) {e.preventDefault(); send();}}}/>
        <button type="submit" disabled={!draft.trim() || loading} className="bg-[#003D14] text-white rounded-xl px-4 min-h-[44px] disabled:opacity-50">{language === 'ne' ? 'पठाऊ' : 'Send'}</button>
      </form>
      <p className="text-[11px] px-4 pb-3 text-gray-500">{language === 'ne' ? 'निजी जानकारी नलेख्नुहोस्। यो सहायकले खाता वा काममा परिवर्तन गर्दैन।' : 'Do not share passwords or private data. Help Me cannot change your account or submit applications.'}</p>
    </section>}
    <button type="button" onClick={toggle} aria-label={open ? 'Close Help Me' : 'Open Help Me chatbot'} aria-expanded={open} title={open ? 'Close Vouch help' : 'Ask Vouch for help'} className="vouch-help-trigger w-11 h-11 rounded-full bg-[#003D14] text-white font-semibold shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 flex justify-center items-center text-xl">{open ? '×' : '?'}</button>
  </div>;
}
