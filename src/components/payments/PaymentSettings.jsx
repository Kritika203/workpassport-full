import { useEffect, useState } from 'react';
import { CreditCard, Star, Trash2, Pencil } from 'lucide-react';
import { flow } from '../../api/flows.js';

// Payment Settings inside My WorkPassport. Freelancers save how employers
// can pay them directly (eSewa, Khalti or bank). Account mode stores the
// methods in Django; demo mode keeps them in this browser only. Details are
// private: they are revealed only to an employer paying for an approved
// milestone. No passwords, PINs or OTPs are ever asked for.
const COPY = {
  en: {
    title: 'Payment Settings',
    intro: 'Add how employers can pay you directly. These details stay private. They are shown only to an employer who is paying you for an approved milestone.',
    never: 'Never enter a wallet password, PIN or OTP here. Vouch never asks for them.',
    add: 'Add a payment method',
    kind: 'Method', holder: 'Account holder name', mobile: 'Registered mobile number',
    bank: 'Bank name', account: 'Account number', branch: 'Branch (optional)',
    preferred: 'This is my preferred method', save: 'Save method', cancel: 'Cancel',
    edit: 'Edit', remove: 'Remove', preferredBadge: 'Preferred', none: 'No payment method yet. Add one so employers can pay you.',
    saved: 'Payment method saved.', removed: 'Payment method removed.',
    demoNote: 'Demo mode: methods are saved in this browser only.',
    kinds: { esewa: 'eSewa', khalti: 'Khalti', bank: 'Bank transfer' },
  },
  ne: {
    title: 'भुक्तानी सेटिङ',
    intro: 'रोजगारदाताले तपाईंलाई सिधै कसरी तिर्न सक्छन् भनेर थप्नुहोस्। यी विवरण निजी रहन्छन्। स्वीकृत माइलस्टोनको भुक्तानी गर्ने रोजगारदातालाई मात्र देखाइन्छ।',
    never: 'यहाँ वालेट पासवर्ड, PIN वा OTP कहिल्यै नहाल्नुहोस्। Vouch ले ती कहिल्यै माग्दैन।',
    add: 'भुक्तानी विधि थप्नुहोस्',
    kind: 'विधि', holder: 'खातावालाको नाम', mobile: 'दर्ता गरिएको मोबाइल नम्बर',
    bank: 'बैंकको नाम', account: 'खाता नम्बर', branch: 'शाखा (ऐच्छिक)',
    preferred: 'यो मेरो मनपर्ने विधि हो', save: 'विधि सुरक्षित गर्नुहोस्', cancel: 'रद्द गर्नुहोस्',
    edit: 'मिलाउनुहोस्', remove: 'हटाउनुहोस्', preferredBadge: 'मनपर्ने', none: 'अहिलेसम्म कुनै भुक्तानी विधि छैन। रोजगारदाताले तिर्न सकून् भनेर एउटा थप्नुहोस्।',
    saved: 'भुक्तानी विधि सुरक्षित भयो।', removed: 'भुक्तानी विधि हटाइयो।',
    demoNote: 'डेमो मोड: विधिहरू यो ब्राउजरमा मात्र सुरक्षित हुन्छन्।',
    kinds: { esewa: 'eSewa', khalti: 'Khalti', bank: 'बैंक स्थानान्तरण' },
  },
};

const LOCAL_KEY = 'wp_payment_methods';
const EMPTY = { kind: 'esewa', holder_name: '', mobile: '', bank_name: '', account_number: '', branch: '', is_preferred: false };
const field = 'w-full mt-1 px-4 border border-[#e5e7dd] rounded-[12px] text-base min-h-[44px] bg-white focus:outline-none focus:border-[#59684a]';
const redBtn = 'px-5 rounded-full bg-[#59684a] text-white font-semibold min-h-[44px] hover:bg-[#415947] disabled:opacity-50';
const ghostBtn = 'px-4 rounded-full border border-[#e5e7dd] bg-white font-semibold min-h-[40px] hover:border-[#DDD8CE] inline-flex items-center gap-1.5';

export function readLocalMethods() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
}
function writeLocalMethods(rows) { localStorage.setItem(LOCAL_KEY, JSON.stringify(rows)); }

export function PaymentSettings({ lang, showToast }) {
  const s = COPY[lang] || COPY.en;
  const [methods, setMethods] = useState([]);
  const [mode, setMode] = useState('account');
  const [form, setForm] = useState(null); // null = closed; object = editing (id may be null)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    flow('payments/methods/')
      .then(rows => { if (alive) { setMethods(Array.isArray(rows) ? rows : []); setMode('account'); } })
      .catch(() => { if (alive) { setMethods(readLocalMethods()); setMode('local'); } });
    return () => { alive = false; };
  }, []);

  const saveLocal = (rows) => { writeLocalMethods(rows); setMethods(rows); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const payload = { ...form };
      if (mode === 'account') {
        const saved = form.id
          ? await flow(`payments/methods/${form.id}/`, { method: 'PATCH', body: payload })
          : await flow('payments/methods/', { method: 'POST', body: payload });
        const rows = await flow('payments/methods/');
        setMethods(Array.isArray(rows) ? rows : [saved]);
      } else {
        let rows = [...methods];
        if (form.id) rows = rows.map(r => r.id === form.id ? { ...form } : r);
        else rows.push({ ...form, id: `local-${Date.now()}` });
        if (form.is_preferred) rows = rows.map(r => ({ ...r, is_preferred: r.id === (form.id || rows[rows.length - 1].id) }));
        saveLocal(rows);
      }
      setForm(null);
      showToast?.(s.saved);
    } catch (err) {
      setError(err?.message || 'Could not save. Check the fields and try again.');
    } finally { setBusy(false); }
  };

  const remove = async (row) => {
    setBusy(true); setError('');
    try {
      if (mode === 'account') {
        await flow(`payments/methods/${row.id}/`, { method: 'DELETE' });
        setMethods(methods.filter(r => r.id !== row.id));
      } else {
        saveLocal(methods.filter(r => r.id !== row.id));
      }
      showToast?.(s.removed);
    } catch { setError('Could not remove that method.'); } finally { setBusy(false); }
  };

  const summary = (row) => row.kind === 'bank'
    ? `${row.bank_name} · ${row.account_number}${row.branch ? ` · ${row.branch}` : ''}`
    : `${s.kinds[row.kind]} · ${row.mobile}`;

  return (
    <section className="rounded-[20px] border border-[#e5e7dd] bg-white p-5 space-y-4">
      <h3 className="font-semibold text-lg flex items-center gap-2"><CreditCard size={22} className="text-[#59684a]" /> {s.title}</h3>
      <p className="text-base text-[#4A4744]">{s.intro}</p>
      <p className="text-sm font-semibold text-[#AE332A]">{s.never}</p>
      {mode === 'local' && <p className="text-sm text-[#6B6561]">{s.demoNote}</p>}
      {error && <p className="text-sm font-semibold text-[#AE332A]">{error}</p>}
      {!methods.length && !form && <p className="text-base text-[#6B6561]">{s.none}</p>}
      <div className="space-y-2">
        {methods.map(row => (
          <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-[12px] bg-[#FAFAF9] border border-[#e5e7dd] px-4 py-3">
            <div className="flex-1 min-w-[200px]">
              <div className="font-semibold">{row.holder_name} <span className="text-[#6B6561] font-normal">· {summary(row)}</span></div>
            </div>
            {row.is_preferred && <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#AE332A]"><Star size={14} /> {s.preferredBadge}</span>}
            <button type="button" className={ghostBtn} onClick={() => setForm({ ...EMPTY, ...row })}><Pencil size={15} /> {s.edit}</button>
            <button type="button" className={ghostBtn} disabled={busy} onClick={() => remove(row)}><Trash2 size={15} /> {s.remove}</button>
          </div>
        ))}
      </div>
      {!form && <button type="button" className={redBtn} onClick={() => setForm({ ...EMPTY })}>{s.add}</button>}
      {form && (
        <form onSubmit={submit} className="space-y-3 rounded-[12px] border border-[#e5e7dd] p-4">
          <label className="block text-base font-semibold">{s.kind}
            <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })} className={field}>
              <option value="esewa">eSewa</option>
              <option value="khalti">Khalti</option>
              <option value="bank">{s.kinds.bank}</option>
            </select>
          </label>
          <label className="block text-base font-semibold">{s.holder}
            <input required maxLength={120} value={form.holder_name} onChange={e => setForm({ ...form, holder_name: e.target.value })} className={field} />
          </label>
          {form.kind !== 'bank' ? (
            <label className="block text-base font-semibold">{s.mobile}
              <input required inputMode="tel" maxLength={20} value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} className={field} />
            </label>
          ) : (<>
            <label className="block text-base font-semibold">{s.bank}
              <input required maxLength={120} value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} className={field} />
            </label>
            <label className="block text-base font-semibold">{s.account}
              <input required maxLength={40} value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} className={field} />
            </label>
            <label className="block text-base font-semibold">{s.branch}
              <input maxLength={120} value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} className={field} />
            </label>
          </>)}
          <label className="flex items-center gap-2 text-base">
            <input type="checkbox" checked={!!form.is_preferred} onChange={e => setForm({ ...form, is_preferred: e.target.checked })} className="w-5 h-5 accent-[#59684a]" />
            {s.preferred}
          </label>
          <div className="flex gap-2">
            <button type="submit" className={redBtn} disabled={busy}>{s.save}</button>
            <button type="button" className={ghostBtn} onClick={() => setForm(null)}>{s.cancel}</button>
          </div>
        </form>
      )}
    </section>
  );
}
