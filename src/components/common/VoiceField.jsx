import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';

// Browser speech recognition is an enhancement, never a prerequisite for typing.
// A third-party website is a link, not an API integration or a promise of privacy.
export function VoiceField({ value, onChange, lang = 'en', label = 'Message', rows = 3, placeholder = '', maxLength = 2000 }) {
  const [speechLang, setSpeechLang] = useState(lang === 'ne' ? 'ne-NP' : 'en-US');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognizer = useRef(null);
  const latest = useRef(value);
  latest.current = value;
  useEffect(() => () => { try { recognizer.current?.abort(); } catch { /* stop on unmount */ } }, []);
  const supported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const toggle = () => {
    if (listening) { recognizer.current?.stop(); return; }
    if (!supported) { setError('Voice typing is not available in this browser. You can type normally.'); return; }
    setError('');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    try {
      const rec = new SpeechRecognition();
      rec.lang = speechLang;
      rec.continuous = false;
      rec.interimResults = true;
      recognizer.current = rec;
      let finalTranscript = '';
      rec.onresult = event => {
        let next = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) next += event.results[i][0]?.transcript || '';
        }
        if (next && next !== finalTranscript) {
          finalTranscript = next;
          onChange((latest.current ? latest.current + ' ' : '') + next);
        }
      };
      rec.onerror = event => { setError(`Microphone: ${event.error || 'unavailable'}. You can still type.`); setListening(false); };
      rec.onend = () => setListening(false);
      rec.start(); setListening(true);
    } catch { setListening(false); setError('Microphone unavailable. Check browser permissions or type instead.'); }
  };
  return <div className="vouch-voice-field">
    <label className="vouch-field-label">{label}<textarea rows={rows} maxLength={maxLength} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} /></label>
    <div className="vouch-voice-actions"><label className="vouch-voice-lang">Speak in <select value={speechLang} onChange={event => setSpeechLang(event.target.value)}><option value="ne-NP">नेपाली</option><option value="en-US">English</option></select></label>
      <button type="button" className="vouch-text-action" onClick={toggle} aria-pressed={listening}>{listening ? <Square size={15} /> : <Mic size={15}/>} {listening ? 'Stop listening' : 'Dictate'}</button>
      <span className="vouch-muted">Review the text before sending. <a href="https://voicetypingnepali.com/" target="_blank" rel="noopener noreferrer">Alternative Nepali typing (external site)</a></span></div>
    {error && <p role="status" className="vouch-form-error">{error} <a href="https://voicetypingnepali.com/" target="_blank" rel="noopener noreferrer">External Nepali voice typing</a></p>}
  </div>;
}
