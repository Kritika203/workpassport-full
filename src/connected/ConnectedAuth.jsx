// Account access: one centered, accessible form for workers and employers.
import { useState } from 'react';
import { api, storeApiSession } from '../api/client.js';
import { PasswordInput } from './PasswordInput.jsx';
import './VouchAuth.css';

const COPY = {
  en: {
    back: 'Back to home', create: 'Create your WorkPassport', login: 'Welcome back',
    createSub: 'Save your skills, applications and work in one place.',
    loginSub: 'Sign in to continue where you left off.',
    name: 'Full name', username: 'Username', email: 'Email address',
    password: 'Password', confirm: 'Confirm password', account: 'I want to',
    freelancer: 'Find freelance work', client: 'Hire freelancers',
    createButton: 'Create account', loginButton: 'Log in', busy: 'Please wait…',
    switchToLogin: 'Already have an account?', switchToCreate: 'New to Vouch?',
    createLink: 'Create an account', loginLink: 'Log in',
    mismatch: 'Passwords do not match. Please check your confirmation.',
    length: 'Use a password with at least 8 characters.',
    safe: 'Choose a password you do not use elsewhere.',
    forgot: 'Forgot password?', forgotTitle: 'Reset your password',
    forgotSub: 'Enter your email address and we will send reset instructions.',
    sendReset: 'Send reset link', resetSent: 'If an account uses that email, a reset link will be sent.',
    passwordHelp: 'At least 8 characters',
  },
  ne: {
    back: 'गृहपृष्ठमा फर्कनुहोस्', create: 'आफ्नो WorkPassport बनाउनुहोस्', login: 'फेरि स्वागत छ',
    createSub: 'आफ्ना सीप, आवेदन र काम एकै ठाउँमा राख्नुहोस्।',
    loginSub: 'आफ्नो काम जारी राख्न लग इन गर्नुहोस्।',
    name: 'पूरा नाम', username: 'प्रयोगकर्ता नाम', email: 'इमेल ठेगाना',
    password: 'पासवर्ड', confirm: 'पासवर्ड फेरि लेख्नुहोस्', account: 'म चाहन्छु',
    freelancer: 'फ्रिलान्स काम खोज्न', client: 'फ्रिलान्सरलाई काम दिन',
    createButton: 'खाता बनाउनुहोस्', loginButton: 'लग इन गर्नुहोस्', busy: 'कृपया पर्खनुहोस्…',
    switchToLogin: 'पहिल्यै खाता छ?', switchToCreate: 'Vouch मा नयाँ हुनुहुन्छ?',
    createLink: 'खाता बनाउनुहोस्', loginLink: 'लग इन गर्नुहोस्',
    mismatch: 'दुवै पासवर्ड मिलेनन्।', length: 'कम्तीमा ८ अक्षरको पासवर्ड राख्नुहोस्।',
    safe: 'अरू ठाउँमा प्रयोग नगरेको पासवर्ड राख्नुहोस्।',
    forgot: 'पासवर्ड बिर्सनुभयो?', forgotTitle: 'पासवर्ड परिवर्तन गर्नुहोस्',
    forgotSub: 'इमेल ठेगाना लेख्नुहोस्। हामी पासवर्ड परिवर्तन गर्ने लिंक पठाउनेछौँ।',
    sendReset: 'लिंक पठाउनुहोस्', resetSent: 'यो इमेलको खाता भए लिंक पठाइनेछ।',
    passwordHelp: 'कम्तीमा ८ अक्षर',
  },
};

export function ConnectedAuth({ initialMode = 'register', lang = 'en', onBack, onAuthenticated }) {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '', display_name: '', role: 'freelancer' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const t = COPY[lang] || COPY.en;
  const change = (key, value) => {
    setForm(current => ({ ...current, [key]: value }));
    setFieldErrors(current => ({ ...current, [key]: '' }));
  };
  const switchMode = next => { setMode(next); setError(''); setFieldErrors({}); setNotice(''); };
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    setError(''); setFieldErrors({}); setNotice('');
    if (mode === 'register' && form.password.length < 8) { setFieldErrors({ password: t.length }); return; }
    if (mode === 'register' && form.password !== form.confirm) { setFieldErrors({ confirm: t.mismatch }); return; }
    setBusy(true);
    try {
      if (mode === 'forgot') {
        await api('/api/auth/password-reset/request/', { method: 'POST', body: { email: form.email.trim() } });
        setNotice(t.resetSent);
        return;
      }
      if (mode === 'register') {
        await api('/api/auth/register/', {
          method: 'POST',
          body: {
            username: form.username.trim(), email: form.email.trim(),
            display_name: form.display_name.trim(), role: form.role, password: form.password,
          },
        });
      }
      const tokens = await api('/api/auth/login/', { method: 'POST', body: { username: form.username.trim(), password: form.password } });
      if (mode === 'register' && lang === 'ne') {
        try { await api('/api/auth/me/', { method: 'PATCH', body: { preferred_language: 'ne' } }, tokens); }
        catch { /* The account still opens if language preference saving fails. */ }
      }
      storeApiSession(tokens);
      onAuthenticated(tokens, { isNew: mode === 'register', role: form.role });
    } catch (err) {
      const data = err?.data;
      if (mode === 'register' && err?.status === 400 && data && typeof data === 'object') {
        const fields = {};
        const others = [];
        Object.entries(data).forEach(([name, val]) => {
          const text = (Array.isArray(val) ? val : [val]).filter(x => typeof x === 'string').join(' ');
          if (!text || name === 'status') return;
          if (['username','display_name','email','password','role'].includes(name)) fields[name] = text;
          else others.push(text);
        });
        setFieldErrors(fields);
        if (others.length || !Object.keys(fields).length) setError(others.join(' ') || err.message);
      } else setError(err.message || 'Could not complete your request. Please try again.');
    } finally { setBusy(false); }
  };
  const fieldError = key => fieldErrors[key] && <p className="vouch-auth-error" role="alert" id={`vouch-auth-${key}-error`}>{fieldErrors[key]}</p>;
  const inputProps = key => fieldErrors[key] ? { 'aria-invalid': true, 'aria-describedby': `vouch-auth-${key}-error` } : {};
  const registering = mode === 'register';
  return <main className="vouch-auth vouch-auth-refined" lang={lang}>
    <header className="vouch-auth-header vouch-auth-topbar">
      <span className="vouch-brand" aria-label="Vouch">vouch<span>.</span></span>
      <button type="button" onClick={onBack} className="vouch-auth-back">← {t.back}</button>
    </header>
    <div className="vouch-auth-wrap">
      <section className="vouch-auth-card" aria-labelledby="vouch-auth-heading">
        <p className="vouch-auth-eyebrow">{registering ? 'WORK · SAFETY · COMMUNITY' : 'WORKPASSPORT'}</p>
        <h1 id="vouch-auth-heading" className="vouch-auth-title">{mode === 'forgot' ? t.forgotTitle : mode === 'login' ? t.login : t.create}</h1>
        <p className="vouch-auth-intro">{mode === 'forgot' ? t.forgotSub : mode === 'login' ? t.loginSub : t.createSub}</p>
        <form onSubmit={submit} className="vouch-auth-form" noValidate={false}>
          {registering && <>
            <div className="vouch-auth-identity-grid"><label className="vouch-auth-field">{t.name}<input {...inputProps('display_name')} className="vouch-auth-input" type="text" autoComplete="name" required maxLength={120} value={form.display_name} onChange={e => change('display_name', e.target.value)}/>{fieldError('display_name')}</label>
            <label className="vouch-auth-field">{t.username}<input {...inputProps('username')} className="vouch-auth-input" type="text" autoComplete="username" required maxLength={150} value={form.username} onChange={e => change('username', e.target.value)}/>{fieldError('username')}</label></div>
            <label className="vouch-auth-field">{t.email}<input {...inputProps('email')} className="vouch-auth-input" type="email" autoComplete="email" required value={form.email} onChange={e => change('email', e.target.value)}/>{fieldError('email')}</label>
            <fieldset className="vouch-auth-roles"><legend>{t.account}</legend><div>
              <label className={form.role === 'freelancer' ? 'is-selected' : ''}><input type="radio" name="vouch-role" value="freelancer" checked={form.role === 'freelancer'} onChange={() => change('role','freelancer')}/>{t.freelancer}</label>
              <label className={form.role === 'client' ? 'is-selected' : ''}><input type="radio" name="vouch-role" value="client" checked={form.role === 'client'} onChange={() => change('role','client')}/>{t.client}</label>
            </div>{fieldError('role')}</fieldset>
          </>}
          {mode === 'login' && <label className="vouch-auth-field">{t.username}<input {...inputProps('username')} className="vouch-auth-input" autoComplete="username" required value={form.username} onChange={e=>change('username',e.target.value)} /></label>}
          {mode === 'forgot' && <label className="vouch-auth-field">{t.email}<input className="vouch-auth-input" type="email" autoComplete="email" required value={form.email} onChange={e=>change('email',e.target.value)} /></label>}
          {mode !== 'forgot' && <div className="vouch-auth-password"><PasswordInput lang={lang} label={t.password} inputClassName="vouch-auth-input" autoComplete={registering?'new-password':'current-password'} minLength={registering?8:undefined} value={form.password} onChange={e=>change('password',e.target.value)}/>{fieldError('password')}{registering && <span className="vouch-auth-hint">{t.passwordHelp}</span>}{mode === 'login' && <button type="button" className="vouch-auth-text-link vouch-auth-forgot" onClick={()=>switchMode('forgot')}>{t.forgot}</button>}</div>}
          {registering && <div className="vouch-auth-password"><PasswordInput lang={lang} label={t.confirm} inputClassName="vouch-auth-input" autoComplete="new-password" value={form.confirm} onChange={e=>change('confirm',e.target.value)}/>{fieldError('confirm')}</div>}
          {notice && <p role="status" className="vouch-auth-notice">{notice}</p>}
          {error && <p role="alert" className="vouch-auth-error">{error}</p>}
          <button type="submit" disabled={busy} className="vouch-auth-submit">{busy ? t.busy : mode === 'forgot' ? t.sendReset : mode === 'login' ? t.loginButton : t.createButton}</button>
        </form>
        <p className="vouch-auth-switch">{registering ? t.switchToLogin : mode === 'login' ? t.switchToCreate : ''} <button type="button" className="vouch-auth-text-link" onClick={()=>switchMode(mode==='login'?'register':'login')}>{registering||mode==='forgot'?t.loginLink:t.createLink}</button></p>
      </section>
    </div>
  </main>;
}
