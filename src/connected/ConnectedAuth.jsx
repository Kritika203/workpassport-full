// Sign up and sign in forms for WorkPassport accounts.

import { useState } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { api, storeApiSession } from '../api/client.js';
import { PasswordInput } from './PasswordInput.jsx';

const INPUT = 'w-full border border-[#EAE7E1] rounded-[12px] bg-white px-4 py-3 min-h-[48px] outline-none focus:border-[#C73E33]';
const COPY = {
  en: {
    back: 'Back', create: 'Create your WorkPassport', login: 'Welcome back',
    createSub: 'Create an account to save your skills, jobs and applications.',
    loginSub: 'Sign in to pick up where you left off.',
    username: 'Username', email: 'Email address', name: 'Full name',
    password: 'Password', confirm: 'Confirm password', account: 'I want to',
    freelancer: 'Find freelance work', client: 'Hire freelancers',
    createButton: 'Create account', loginButton: 'Log in',
    busy: 'Please wait…', switchToLogin: 'Already have an account? Log in',
    switchToCreate: 'New to WorkPassport? Create an account',
    mismatch: 'Your passwords do not match.',
    length: 'Choose a password with at least 8 characters.',
    safe: 'Use a password you have not used elsewhere.',
    forgot: 'Forgot password?', forgotTitle: 'Reset your password',
    forgotSub: 'Enter your email address and we will send reset instructions.',
    sendReset: 'Send reset link', resetSent: 'If an account uses that email, a reset link will be sent.',
  },
  ne: {
    back: 'पछाडि', create: 'आफ्नो WorkPassport बनाउनुहोस्', login: 'फेरि स्वागत छ',
    createSub: 'आफ्ना सीप, काम र आवेदन सुरक्षित राख्न खाता बनाउनुहोस्।',
    loginSub: 'आफ्नो काम जारी राख्न लग इन गर्नुहोस्।',
    username: 'प्रयोगकर्ता नाम', email: 'इमेल ठेगाना', name: 'पूरा नाम',
    password: 'पासवर्ड', confirm: 'पासवर्ड फेरि लेख्नुहोस्', account: 'म चाहन्छु',
    freelancer: 'फ्रिलान्स काम खोज्न', client: 'फ्रिलान्सरलाई काम दिन',
    createButton: 'खाता बनाउनुहोस्', loginButton: 'लग इन गर्नुहोस्',
    busy: 'कृपया पर्खनुहोस्…', switchToLogin: 'पहिल्यै खाता छ? लग इन गर्नुहोस्',
    switchToCreate: 'WorkPassport मा नयाँ हुनुहुन्छ? खाता बनाउनुहोस्',
    mismatch: 'दुवै पासवर्ड मिलेनन्।', length: 'कम्तीमा ८ अक्षरको पासवर्ड राख्नुहोस्।',
    safe: 'अरू ठाउँमा प्रयोग नगरेको पासवर्ड राख्नुहोस्।',
    forgot: 'पासवर्ड बिर्सनुभयो?', forgotTitle: 'पासवर्ड परिवर्तन गर्नुहोस्',
    forgotSub: 'इमेल ठेगाना लेख्नुहोस्। हामी पासवर्ड परिवर्तन गर्ने लिंक पठाउनेछौँ।',
    sendReset: 'लिंक पठाउनुहोस्', resetSent: 'यो इमेलको खाता भए लिंक पठाइनेछ।',
  },
};

export function ConnectedAuth({ initialMode = 'register', lang = 'en', onBack, onAuthenticated }) {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '', display_name: '', role: 'freelancer' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const text = COPY[lang] || COPY.en;
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    setNotice('');
    if (mode === 'register' && form.password !== form.confirm) {
      setError(text.mismatch);
      return;
    }
    if (mode === 'register' && form.password.length < 8) {
      setError(text.length);
      return;
    }
    setBusy(true);
    try {
      if (mode === 'forgot') {
        await api('/api/auth/password-reset/request/', { method: 'POST', body: { email: form.email.trim() } });
        setNotice(text.resetSent);
        return;
      }
      if (mode === 'register') {
        await api('/api/auth/register/', {
          method: 'POST',
          body: {
            username: form.username.trim(), email: form.email.trim(),
            password: form.password, display_name: form.display_name.trim(), role: form.role,
          },
        });
      }
      const tokens = await api('/api/auth/login/', {
        method: 'POST', body: { username: form.username.trim(), password: form.password },
      });
      if (mode === 'register' && lang === 'ne') {
        // Keep the language they selected during signup.
        try { await api('/api/auth/me/', { method: 'PATCH', body: { preferred_language: 'ne' } }, tokens); }
        catch { /* Account can still be opened if saving the language fails. */ }
      }
      storeApiSession(tokens);
      onAuthenticated(tokens, { isNew: mode === 'register', role: form.role });
    } catch (err) {
      setError(err.message || 'Could not complete your request. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFAF8] text-[#1C1B1A] px-4 py-12">
      <div className="mx-auto max-w-md">
        <button type="button" onClick={onBack} className="flex items-center gap-2 mb-8 min-h-[44px] text-[#4A4744]"><ArrowLeft size={20}/>{text.back}</button>
        <div className="bg-white border border-[#EAE7E1] rounded-[20px] p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-4"><ShieldCheck className="text-[#C73E33]"/><span className="font-semibold text-lg">WorkPassport</span></div>
          <h1 className="text-[28px] font-semibold mb-2">{mode === 'forgot' ? text.forgotTitle : mode === 'login' ? text.login : text.create}</h1>
          <p className="text-[#4A4744] mb-6">{mode === 'forgot' ? text.forgotSub : mode === 'login' ? text.loginSub : text.createSub}</p>
          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && <>
              <label className="block font-medium">{text.name}<input className={`${INPUT} mt-1`} type="text" autoComplete="name" required maxLength={120} value={form.display_name} onChange={e => change('display_name', e.target.value)}/></label>
              <label className="block font-medium">{text.email}<input className={`${INPUT} mt-1`} type="email" autoComplete="email" required value={form.email} onChange={e => change('email', e.target.value)}/></label>
            </>}
            {mode === 'forgot' && <label className="block font-medium">{text.email}<input className={`${INPUT} mt-1`} type="email" autoComplete="email" required value={form.email} onChange={e => change('email', e.target.value)}/></label>}
            {mode !== 'forgot' && <label className="block font-medium">{text.username}<input className={`${INPUT} mt-1`} autoComplete="username" required maxLength={150} value={form.username} onChange={e => change('username', e.target.value)}/></label>}
            {mode === 'register' && <label className="block font-medium">{text.account}
              <select className={`${INPUT} mt-1`} value={form.role} onChange={e => change('role', e.target.value)}>
                <option value="freelancer">{text.freelancer}</option><option value="client">{text.client}</option>
              </select>
            </label>}
            {mode !== 'forgot' && <PasswordInput lang={lang} label={text.password} inputClassName={INPUT} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 8 : undefined} value={form.password} onChange={e => change('password', e.target.value)} />}
            {mode === 'register' && <>
              <PasswordInput lang={lang} label={text.confirm} inputClassName={INPUT} autoComplete="new-password" value={form.confirm} onChange={e => change('confirm', e.target.value)} />
              <p className="text-sm text-[#6E6963]">{text.safe}</p>
            </>}
            {notice && <div role="status" className="bg-[#F5F5EF] text-[#36463F] px-4 py-3 rounded-xl">{notice}</div>}
            {error && <div role="alert" className="bg-[#FAF0EE] text-[#AE332A] px-4 py-3 rounded-xl">{error}</div>}
            <button type="submit" disabled={busy} className="w-full bg-[#C73E33] hover:bg-[#AE332A] text-white rounded-full min-h-[52px] font-semibold disabled:opacity-50">{busy ? text.busy : mode === 'forgot' ? text.sendReset : mode === 'login' ? text.loginButton : text.createButton}</button>
          </form>
          {mode === 'login' && <button type="button" className="mt-3 block underline text-[#AE332A] min-h-[44px]" onClick={() => { setMode('forgot'); setError(''); setNotice(''); }}>{text.forgot}</button>}
          <button type="button" className="mt-5 underline text-[#AE332A] min-h-[44px]" onClick={() => {setMode(mode === 'login' ? 'register' : 'login');setError('');setNotice('');}}>{mode === 'login' ? text.switchToCreate : text.switchToLogin}</button>
        </div>
      </div>
    </div>
  );
}
