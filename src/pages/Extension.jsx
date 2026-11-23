// Chrome extension guide.

import { Check, Lock, Shield, Link2, Copy, PlugZap, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { flow } from '../api/flows.js';
import { Disclaimer } from '../components/common/Disclaimer.jsx';
import { SAFETY_DATA, SAFETY_EXAMPLES, SHIELD_EXAMPLES, analyzeMessage, analyzeText, verdictOf } from '../services/safety.js';



const PAIR_TEXT = {
  en: {
    title: 'Connect your WorkShield extension', description: 'Pair this browser in under a minute. Only text you choose to check or save is sent to your account.',
    signIn: 'Log in to Vouch to connect the Chrome extension and keep checks in your private history.',
    create: 'Generate pairing code', generating: 'Generating…', code: 'Your one-time code',
    expires: 'This code expires in 5 minutes and works once. Enter it in the extension under “Connect Vouch account”.',
    endpoint: 'App connection address', addressHelp: 'Use this address in the extension’s connection settings. The extension must use the same backend as this website.',
    copy: 'Copy', copied: 'Copied', existing: 'Paired browsers', none: 'No browsers connected yet.',
    revoke: 'Remove access', revokeConfirm: 'Disconnect this browser from your Vouch?',
    disconnected: 'Browser access revoked.', failed: 'Could not connect. Please check the backend and retry.',
    privacy: 'Never share a pairing code publicly. Disconnect browsers you no longer use. No passwords are stored in the extension.',
  },
  ne: {
    title: 'WorkShield एक्सटेन्सन आफ्नो खातामा जोड्नुहोस्', description: 'तपाईंले जाँच्न वा सेभ गर्न छानेको पाठ मात्र खातामा पठाइन्छ।',
    signIn: 'एक्सटेन्सन जोड्न र जाँचको इतिहास सुरक्षित राख्न Vouch मा लग इन गर्नुहोस्।',
    create: 'जोड्ने कोड बनाउनुहोस्', generating: 'बनाउँदैछ…', code: 'एकपटक प्रयोग हुने कोड',
    expires: 'यो कोड ५ मिनेटमा सकिन्छ र एकपटक मात्र चल्छ। एक्सटेन्सनको “Connect Vouch account” मा लेख्नुहोस्।',
    endpoint: 'एप जडान गर्ने ठेगाना', addressHelp: 'एक्सटेन्सनमा यही ठेगाना प्रयोग गर्नुहोस्। वेबसाइट र एक्सटेन्सनले एउटै सर्भरसँग जोडिनुपर्छ।',
    copy: 'कपि', copied: 'कपि भयो', existing: 'जोडिएका ब्राउजरहरू', none: 'अहिलेसम्म कुनै ब्राउजर जोडिएको छैन।',
    revoke: 'पहुँच हटाउनुहोस्', revokeConfirm: 'यो ब्राउजरको Vouch पहुँच हटाउने?',
    disconnected: 'ब्राउजरको पहुँच हटाइयो।', failed: 'जोड्न सकिएन। सर्भर जाँचेर फेरि प्रयास गर्नुहोस्।',
    privacy: 'जोड्ने कोड अरूलाई नदिनुहोस्। प्रयोग नगर्ने ब्राउजर हटाउनुहोस्। एक्सटेन्सनमा पासवर्ड राखिँदैन।',
  },
};

function ExtensionPairing({ connected, lang }) {
  const t = PAIR_TEXT[lang] || PAIR_TEXT.en;
  const [code, setCode] = useState('');
  const [expires, setExpires] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const apiAddress = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  const load = async () => {
    const response = await flow('extension/pair/');
    setSessions(response.sessions || []);
  };
  useEffect(() => {
    if (!connected) return;
    load().catch(e => setError(e.message || t.failed));
  }, [connected]);
  const generate = async () => {
    setBusy(true); setError('');
    try {
      const result = await flow('extension/pair/', { method: 'POST', body: { label: 'My browser' } });
      setCode(result.code); setExpires(Date.now() + result.expires_in_seconds * 1000);
      await load();
    } catch (e) { setError(e.message || t.failed); }
    finally { setBusy(false); }
  };
  const revoke = async id => {
    if (!window.confirm(t.revokeConfirm)) return;
    try {
      await flow(`extension/pair/${id}/`, { method: 'DELETE' });
      await load();
      setError('');
    } catch (e) { setError(e.message || t.failed); }
  };
  const copy = async (text, kind) => {
    try { await navigator.clipboard.writeText(text); setCopied(kind); }
    catch { setError(t.failed); }
  };
  return <section className="bg-white border border-[#e5e7dd] rounded-[20px] p-5 sm:p-6 space-y-4">
    <div className="flex items-start gap-3"><Link2 className="shrink-0 text-[#59684a] mt-1" size={24} />
      <div><h2 className="font-semibold text-[21px]">{t.title}</h2><p className="mt-2 text-[#4A4744]">{t.description}</p></div>
    </div>
    {!connected ? <p className="bg-[#F6F4EF] rounded-xl p-4">{t.signIn}</p> : <>
      <button type="button" onClick={generate} disabled={busy}
        className="inline-flex items-center gap-2 min-h-[48px] rounded-full px-5 font-semibold text-white bg-[#59684a] hover:bg-[#415947] disabled:opacity-50">
        <PlugZap size={19}/>{busy ? t.generating : t.create}
      </button>
      {code && Date.now() < expires && <div className="rounded-[14px] bg-[#FAF0EE] border border-[#F3E1DD] p-4 space-y-2" role="status">
        <p className="font-medium">{t.code}</p>
        <div className="flex flex-wrap items-center gap-3"><code className="font-mono text-xl font-bold tracking-[0.12em] select-all break-all">{code}</code>
          <button type="button" onClick={() => copy(code, 'code')} className="rounded-full px-4 min-h-[42px] bg-white border border-[#E3E0D9] inline-flex items-center gap-2"><Copy size={16}/>{copied === 'code' ? t.copied : t.copy}</button>
        </div>
        <p className="text-sm text-[#4A4744]">{t.expires}</p>
      </div>}
      <div className="rounded-[14px] bg-[#F6F4EF] p-4 space-y-2">
        <p className="font-medium">{t.endpoint}</p>
        <div className="flex flex-wrap items-center gap-2"><code className="min-w-0 break-all text-sm">{apiAddress}</code>
          <button type="button" onClick={() => copy(apiAddress, 'url')} className="rounded-full px-4 min-h-[42px] bg-white border border-[#E3E0D9] inline-flex items-center gap-2"><Copy size={16}/>{copied === 'url' ? t.copied : t.copy}</button>
        </div>
        <p className="text-sm text-[#6E6963]">{t.addressHelp}</p>
      </div>
      <h3 className="font-semibold">{t.existing}</h3>
      {!sessions.length && <p className="text-[#6E6963]">{t.none}</p>}
      {sessions.map(item => <div key={item.id} className="flex gap-3 items-center justify-between border-t border-[#e5e7dd] pt-3">
        <span className="text-sm">{item.label} · {new Date(item.created_at).toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-US')}</span>
        <button type="button" onClick={() => revoke(item.id)} className="inline-flex gap-1 items-center rounded-full px-3 min-h-[42px] border border-[#E3E0D9] hover:bg-[#FAF0EE] text-sm"><Trash2 size={15}/>{t.revoke}</button>
      </div>)}
    </>}
    {error && <p role="alert" className="rounded-xl bg-[#FAF0EE] p-3 text-[#AE332A]">{error}</p>}
    <p className="flex gap-2 text-sm text-[#6E6963]"><Lock size={16} className="shrink-0 mt-1"/>{t.privacy}</p>
  </section>;
}

export function ExtensionPage({ t, lang, navTo, connected = false }) {
  const [tab, setTab] = useState('job'); // 'job' | 'chat'
  const [result, setResult] = useState(null); // { kind, findings?, verdict?, cats? }
  const num = (n) => (lang === 'ne' ? String(n).replace(/\d/g, d => '०१२३४५६७८९'[d]) : n);
  const isJob = tab === 'job';
  const mockText = isJob ? SHIELD_EXAMPLES[0].text : SAFETY_EXAMPLES[0].text;

  const switchTab = (k) => { setTab(k); setResult(null); };
  const runCheck = () => {
    if (isJob) {
      const f = analyzeText(mockText);
      setResult({ kind: 'job', findings: f, verdict: verdictOf(f) });
    } else {
      setResult({ kind: 'chat', cats: analyzeMessage(mockText) });
    }
  };

  const Bang = () => <span className="shrink-0 w-6 h-6 rounded-full bg-[#FAF0EE] text-[#59684a] text-sm font-bold flex items-center justify-center mt-0.5" aria-hidden="true">!</span>;
  const Card = ({ title, children, className = "" }) => (
    <div className={`bg-white border border-[#e5e7dd] rounded-[20px] p-6 sm:p-6 ${className}`}>
      <h2 className="font-semibold text-[22px] mb-5">{title}</h2>
      {children}
    </div>
  );

  return (
    <div className="max-w-[800px] mx-auto space-y-8">
      {/* A1 header */}
      <div>
        <h1 className="text-[28px] sm:text-[30px] font-semibold mb-3">{t('ex_title')}</h1>
        <p className="text-lg text-[#4A4744]">{t('ex_intro')}</p>
      </div>

      {/* A2 how it works */}
      <div>
        <h2 className="font-semibold text-[22px] mb-4">{t('ex_how_title')}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map(n => (
            <div key={n} className="bg-white border border-[#e5e7dd] rounded-[20px] p-5 sm:p-6">
              <span className="w-9 h-9 rounded-full bg-[#FAF0EE] text-[#AE332A] flex items-center justify-center font-semibold mb-3">{num(n)}</span>
              <p className="text-base text-[#1C1B1A] font-medium">{t('ex_s' + n)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* A3 practice simulation */}
      <div>
        <h2 className="font-semibold text-[22px] mb-2">{t('ex_try_title')}</h2>
        <p className="text-base text-[#4A4744] mb-4">{t('ex_try_line')}</p>

        <div className="inline-flex bg-[#F0EEE9] rounded-full p-1 mb-4" role="group">
          {[['job', 'ex_tab_job'], ['chat', 'ex_tab_chat']].map(([k, label]) => (
            <button key={k} onClick={() => switchTab(k)} aria-pressed={tab === k}
              className={`rounded-full px-5 py-2 text-[15px] font-medium min-h-[44px] transition-all ${tab === k ? 'bg-white text-[#1C1B1A] shadow-[0_1px_2px_rgba(28,27,26,0.08)]' : 'text-[#8A8580] hover:text-[#4A4744]'}`}>
              {t(label)}
            </button>
          ))}
        </div>

        {/* fake browser window */}
        <div className={`relative bg-white border border-[#e5e7dd] rounded-[20px] overflow-hidden `}>
          <div className="flex items-center gap-3 px-4 py-3 bg-[#F0EEE9] border-b border-[#e5e7dd]">
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D8D4CC]" /><span className="w-2.5 h-2.5 rounded-full bg-[#D8D4CC]" /><span className="w-2.5 h-2.5 rounded-full bg-[#D8D4CC]" />
            </div>
            <div className="flex-1 min-w-0 bg-white rounded-full px-4 py-1.5 text-sm text-[#8A8580] truncate">{t(isJob ? 'ex_addr_job' : 'ex_addr_chat')}</div>
          </div>
          <div className="sm:flex sm:items-start sm:gap-4 sm:p-6">
          <div className="p-5 sm:p-0 sm:flex-1 sm:min-w-0">
            <div className="text-sm text-[#8A8580] mb-3">{t(isJob ? 'ex_label_job' : 'ex_label_chat')}</div>
            {isJob ? (
              <div className="border border-[#e5e7dd] rounded-[14px] p-4 ">
                <p className="text-base text-[#1C1B1A] leading-relaxed"><span className={result ? 'bg-[#FAF0EE] underline decoration-[#C73E33]/40' : ''}>{mockText}</span></p>
              </div>
            ) : (
              <div className="bg-[#F0EEE9] rounded-[20px] rounded-tl-md px-4 py-3 ">
                <p className="text-base text-[#1C1B1A] leading-relaxed"><span className={result ? 'bg-[#FAF0EE] underline decoration-[#C73E33]/40' : ''}>{mockText}</span></p>
              </div>
            )}
          </div>

          {/* extension-style popup overlay (sits beside the post on wide screens, below it on phones) */}
          {result && (
            <div className="m-3 sm:m-0 sm:w-[360px] sm:shrink-0 bg-white border border-[#e5e7dd] rounded-[14px] p-4 shadow-[0_2px_10px_rgba(28,27,26,0.08)]" role="dialog" aria-label="WorkShield">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={22} className="text-[#59684a]" />
                <span className="font-semibold">WorkShield</span>
                <span className="text-sm text-[#8A8580]">{t('ex_pop_by')}</span>
              </div>
              {result.kind === 'job' ? (
                <>
                  <h3 className="text-lg font-semibold leading-snug mb-3">{t('sh_v_' + result.verdict)}</h3>
                  <div className="space-y-3 mb-4">
                    {result.findings.red.map(id => <div key={id} className="flex items-start gap-3 text-base"><Bang /><span>{t('sh_f_' + id)}</span></div>)}
                    {result.findings.yellow.map(id => <div key={id} className="flex items-start gap-3 text-base"><Bang /><span>{t('sh_f_' + id)}</span></div>)}
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold leading-snug mb-3">{t(result.cats.length ? 'sf_cross_title' : 'sf_ok_title')}</h3>
                  <div className="space-y-3 mb-4">
                    {result.cats.map(id => (
                      <div key={id} className="flex items-start gap-3 text-base"><Bang />
                        <span><span className="block font-semibold text-[#1C1B1A]">{SAFETY_DATA[id].name[lang]}</span>{SAFETY_DATA[id].expl[lang]}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <p className="text-sm text-[#8A8580] mb-4 flex items-center gap-1.5"><Lock size={14} className="shrink-0" /> {t('sh_private')}</p>
              <div className="flex gap-2">
                <button onClick={() => navTo(result.kind === 'job' ? 'shield' : 'safety')} className="flex-1 bg-[#59684a] text-white rounded-full font-semibold text-base hover:bg-[#415947] min-h-[44px] px-3">{t(result.kind === 'job' ? 'ex_open_full' : 'ex_open_safety')}</button>
                <button onClick={() => setResult(null)} className="bg-white border border-[#E3E0D9] text-[#1C1B1A] rounded-full font-semibold text-base hover:bg-[#F6F4EF] min-h-[44px] px-5">{t('ex_close')}</button>
              </div>
            </div>
          )}
          </div>
        </div>

        <button onClick={runCheck} className="mt-4 w-full sm:w-auto sm:px-10 bg-[#59684a] text-white py-3.5 rounded-full font-semibold text-base hover:bg-[#415947] min-h-[52px] px-5">{t(isJob ? 'ex_btn_job' : 'ex_btn_chat')}</button>
      </div>

      {/* Account pairing is optional and cannot access a user's password. */}
      <ExtensionPairing connected={connected} lang={lang} />

      {/* A4 install steps */}
      <Card title={t('ex_inst_title')}>
        <ol className="space-y-4 text-base text-[#1C1B1A]">
          {[1, 2, 3, 4].map(n => (
            <li key={n} className="flex items-start gap-3">
              <span className="shrink-0 w-7 h-7 rounded-full bg-[#F0EEE9] flex items-center justify-center text-sm font-semibold">{num(n)}</span>
              <span className="flex-1">{t('ex_i' + n)}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-base font-semibold text-[#1C1B1A] flex items-center gap-2"><Check size={20} className="text-[#59684a] shrink-0" /> {t('ex_i_note')}</p>
      </Card>

      {/* A5 privacy */}
      <div>
        <Card title={t('ex_priv_title')}>
          <div className="space-y-4 text-base text-[#1C1B1A]">
            {[1, 2, 3].map(n => (
              <div key={n} className="flex items-start gap-3"><Lock size={20} className="shrink-0 mt-0.5 text-[#59684a]" /> <span>{t('ex_p' + n)}</span></div>
            ))}
          </div>
        </Card>
        <Disclaimer t={t} k="disc_ext" className="mt-4" />
      </div>
    </div>
  );
}
