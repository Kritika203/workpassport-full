// Login and account setup screens.

import { ChevronLeft, Shield, ShieldAlert, ShieldCheck, User } from 'lucide-react';
import { useRef, useState } from 'react';
import { ALL_CATEGORIES, ALL_SKILLS, DISTRICTS } from '../data/demo.js';



function PlaceholderSection({ t, title }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="w-20 h-20 bg-[#EAE7E1] rounded-[20px] flex items-center justify-center mb-6">
        <User size={40} className="text-[#8A8580]" />
      </div>
      <h1 className="text-[28px] sm:text-[30px] font-semibold mb-3">{title}</h1>
      <p className="text-lg text-[#8A8580]">{t('proto_section')}</p>
    </div>
  );
}

export function LoginFlow({ t, onBack, onLogin }) {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [code, setCode] = useState(["", "", "", ""]);
  const codeRefs = [useRef(), useRef(), useRef(), useRef()];

  const handlePhoneSubmit = () => {
    if (phone.length === 10 && phone.startsWith("9")) {
      setErr("");
      setStep(2);
    } else {
      setErr(t('phone_err'));
    }
  };

  const handleCodeChange = (idx, val) => {
    if (!/^\d*$/.test(val)) return;
    const newCode = [...code];
    newCode[idx] = val;
    setCode(newCode);
    if (val && idx < 3) codeRefs[idx + 1].current.focus();
  };

  return (
    <div className="pb-4">
      <button onClick={step === 1 ? onBack : () => setStep(1)} className="flex items-center gap-2 text-base text-[#4A4744] mb-8 hover:text-[#1C1B1A] min-h-[48px] px-2 -ml-2 font-medium">
        <ChevronLeft size={20} /> {t('back')}
      </button>
      <h2 className="text-[28px] sm:text-[30px] font-semibold mb-8">{step === 1 ? t('login_step1_title') : t('login_step2_title')}</h2>
      
      {step === 1 ? (
        <>
          <div className="mb-8">
            <label className="block text-base font-semibold mb-3">{t('phone_label')}</label>
            <div className="flex">
              <div className="bg-[#F6F4EF] border border-[#e5e7dd] border-r-0 px-4 py-4 rounded-l-[14px] text-[#4A4744] font-medium">+977</div>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="98XXXXXXXX" className="flex-1 border border-[#e5e7dd] px-4 py-4 rounded-r-[14px] outline-none focus:border-[#59684a] focus:ring-2 focus:ring-[#59684a]/30 text-lg font-medium" />
            </div>
            {err && (
              <div className="text-[#AE332A] text-sm mt-3 flex items-start gap-2 bg-[#FAF0EE] p-3 rounded-[12px] border border-[#FAF0EE]">
                <ShieldAlert size={20} className="shrink-0 mt-0.5" /> <span>{err}</span>
              </div>
            )}
          </div>
          <button onClick={handlePhoneSubmit} disabled={!phone} className="w-full bg-[#59684a] text-white py-3.5 rounded-full font-semibold text-lg hover:bg-[#415947] disabled:opacity-50 min-h-[52px]">
            {t('btn_send_code')}
          </button>
        </>
      ) : (
        <>
          <div className="mb-4 text-[#4A4744] text-base font-medium">Sending to: +977 {phone}</div>
          <div className="flex gap-4 mb-4 justify-between">
            {[0, 1, 2, 3].map(i => (
              <input key={i} ref={codeRefs[i]} type="tel" inputMode="numeric" aria-label={`${t('btn_verify')} ${i + 1}`} maxLength={1} value={code[i]} onChange={e => handleCodeChange(i, e.target.value)} className="w-16 h-16 sm:w-20 sm:h-20 text-center text-3xl font-semibold border border-[#e5e7dd] rounded-[14px] outline-none focus:border-[#59684a] focus:ring-2 focus:ring-[#59684a]/30" />
            ))}
          </div>
          <div className="text-sm text-[#8A8580] mb-10 bg-[#F6F4EF] p-3 rounded-[12px] text-center border border-[#e5e7dd]">{t('code_hint')}</div>
          <button onClick={onLogin} disabled={code.join('').length < 4} className="w-full bg-[#59684a] text-white py-3.5 rounded-full font-semibold text-lg hover:bg-[#415947] disabled:opacity-50 min-h-[52px]">
            {t('btn_verify')}
          </button>
        </>
      )}
    </div>
  );
}

export function SetupFlow({ t, lang = 'en', onBack, onComplete, initialName = '' }) {
  const [name, setName] = useState(initialName);
  const [district, setDistrict] = useState('');
  const [workWanted, setWorkWanted] = useState([]);
  const finish = () => onComplete({ name: name.trim(), district, workWanted, skills: [],
    institute: '', safetyRules: { chat: true, calls: true, time: true, photo: true, hours: true }, badge: 'Beginner' });
  return <section className="space-y-5">
    <button type="button" onClick={onBack} className="underline min-h-[44px]">{t('back')}</button>
    <h2 className="text-2xl font-semibold">{lang === 'ne' ? 'सुरु गरौँ' : 'Set up your WorkPassport'}</h2>
    <p className="text-[#6E6963]">{lang === 'ne' ? 'नाम मात्र अनिवार्य छ। बाँकी पछि थप्न सकिन्छ।' : 'Only your name is required. Add skills, experience, and a CV later.'}</p>
    <label className="block font-medium">{t('full_name')}
      <input className="block w-full border rounded-xl p-4 mt-2" maxLength={120} value={name} onChange={e=>setName(e.target.value)} required autoComplete="name" />
    </label>
    <label className="block font-medium">{t('district')} ({lang === 'ne' ? 'ऐच्छिक' : 'optional'})
      <select className="block w-full border rounded-xl p-4 mt-2 bg-white" value={district} onChange={e=>setDistrict(e.target.value)}><option value="">{lang === 'ne' ? 'पछि छान्नुहोस्' : 'Choose later'}</option>{DISTRICTS.map(d=><option key={d} value={d}>{d}</option>)}</select>
    </label>
    <details className="border rounded-xl p-4"><summary className="cursor-pointer font-medium">{lang === 'ne' ? 'कामका रुचिहरू (ऐच्छिक)' : 'Work interests (optional)'}</summary>
      <div className="flex flex-wrap gap-2 mt-3">{ALL_CATEGORIES.map(c=><button type="button" key={c} onClick={()=>setWorkWanted(old=>old.includes(c)?old.filter(x=>x!==c):[...old,c])} aria-pressed={workWanted.includes(c)} className={'border rounded-full px-3 py-2 '+(workWanted.includes(c)?'bg-[#FAF0EE] border-[#59684a]':'')}>{c}</button>)}</div>
    </details>
    <button type="button" disabled={!name.trim()} onClick={finish} className="w-full rounded-full bg-[#59684a] text-white font-semibold min-h-[52px] disabled:opacity-40">{lang === 'ne' ? 'अगाडि बढ्नुहोस्' : 'Continue to Vouch'}</button>
  </section>;
}
