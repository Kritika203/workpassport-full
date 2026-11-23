import { useState } from 'react';
import { api } from '../api/client.js';
import { PasswordInput } from './PasswordInput.jsx';

export function PasswordReset({ uid, token }) {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async event => {
    event.preventDefault();
    setError('');
    if (password !== again) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await api('/api/auth/password-reset/confirm/', { method: 'POST', body: { uid, token, password } });
      setMessage('Password changed. You can now log in.');
      window.history.replaceState({}, '', window.location.pathname);
    } catch (err) { setError(err.message || 'This link has expired. Request another reset.'); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-[#FFFFFF] p-6 flex items-center justify-center text-[#141614]">
    <section className="bg-white border border-[#E3E6E1] rounded-[20px] p-6 max-w-md w-full space-y-4">
      <h1 className="text-2xl font-semibold">Reset your Vouch password</h1>
      {message ? <><p>{message}</p><a href="/" className="underline text-[#AE332A]">Return to Vouch</a></> :
        <form onSubmit={submit} className="space-y-4">
          <PasswordInput label="New password" inputClassName="w-full border border-[#E3E6E1] rounded-xl px-4 py-3 min-h-[48px]" minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
          <PasswordInput label="Confirm password" inputClassName="w-full border border-[#E3E6E1] rounded-xl px-4 py-3 min-h-[48px]" autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} />
          {error && <p role="alert" className="text-[#AE332A]">{error}</p>}
          <button disabled={busy} className="bg-[#003D14] text-white rounded-full px-5 py-3 min-h-[48px]">{busy ? 'Saving…' : 'Change password'}</button>
        </form>}
    </section>
  </main>;
}
