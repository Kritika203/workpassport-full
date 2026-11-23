import { useState } from 'react';
import { AlertTriangle, Check, Copy, ExternalLink, ShieldAlert, Wallet } from 'lucide-react';
import { flow } from '../../api/flows.js';
import { copyToClipboard } from '../../utils/clipboard.js';
import { PROVIDER_URLS, downloadPaymentFile, fileToUpload, methodRows, payCopy } from './paymentsShared.js';

// DirectPay panel inside a Workroom milestone. Shown once the milestone is
// approved (released). The employer pays directly in their own app, records
// the transaction here, and only the freelancer can confirm receipt.
const field = 'w-full mt-1 px-4 border border-[#E3E6E1] rounded-[12px] text-base min-h-[44px] bg-white focus:outline-none focus:border-[#003D14]';
const redBtn = 'px-5 rounded-full bg-[#003D14] text-white font-semibold min-h-[44px] hover:bg-[#0E5C2A] disabled:opacity-50 inline-flex items-center gap-2';
const ghostBtn = 'px-4 rounded-full border border-[#E3E6E1] bg-white font-semibold min-h-[40px] hover:border-[#DDD8CE] inline-flex items-center gap-1.5 disabled:opacity-50';

function StatusChip({ status, lang }) {
  const s = payCopy(lang);
  const danger = status === 'disputed';
  const good = status === 'confirmed';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${good ? 'bg-[#F2F7F0] border-[#DCE8D8] text-[#2F6B2F]' : danger ? 'bg-[#FAF0EE] border-[#F3E1DD] text-[#AE332A]' : 'bg-[#F7F3E8] border-[#EAE0C3] text-[#7A5B12]'}`}>
      {good ? <Check size={14} /> : danger ? <ShieldAlert size={14} /> : <Wallet size={14} />}
      {s.status[status] || status}
    </span>
  );
}

export function PaymentPanel({ payment, milestone, isClient, lang, refresh, showError }) {
  const s = payCopy(lang);
  const [busy, setBusy] = useState(false);
  const [showSent, setShowSent] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [amount, setAmount] = useState('');
  const [ref, setRef] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receiptFile, setReceiptFile] = useState(null);
  const [tick, setTick] = useState(false);
  const [reason, setReason] = useState('not_received');
  const [note, setNote] = useState('');
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [copied, setCopied] = useState('');

  const run = async (fn) => {
    setBusy(true); showError('');
    try { await fn(); await refresh(); }
    catch (err) { showError(err?.message || 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  };

  const copy = async (label, value) => {
    const ok = await copyToClipboard(value);
    if (ok) { setCopied(label); setTimeout(() => setCopied(''), 1500); }
  };

  if (!payment) {
    if (!isClient) return null;
    return (
      <section className="mt-3 rounded-xl border border-[#E3E6E1] bg-white p-4 space-y-2">
        <div className="flex items-center gap-2 font-semibold"><Wallet size={18} className="text-[#003D14]" /> {s.title}</div>
        <p className="text-sm text-[#475249]">{s.startNote}</p>
        <button type="button" className={redBtn} disabled={busy}
          onClick={() => run(() => flow('payments/start/', { method: 'POST', body: { milestone_id: milestone.id } }))}>
          {s.payBtn}
        </button>
      </section>
    );
  }

  const rows = methodRows(payment.method_snapshot, lang);
  const kind = payment.method_snapshot?.kind;
  const dispute = payment.disputes?.[0];

  const submitSent = (e) => {
    e.preventDefault();
    run(async () => {
      const receipt = receiptFile ? await fileToUpload(receiptFile) : null;
      await flow(`payments/${payment.id}/sent/`, { method: 'POST', body: {
        amount: amount || payment.agreed_amount_usd, transaction_ref: ref, paid_date: date,
        ...(receipt ? { receipt } : {}),
      } });
      setShowSent(false);
    });
  };

  const submitDispute = (e) => {
    e.preventDefault();
    run(async () => {
      const evidence = evidenceFile ? await fileToUpload(evidenceFile) : null;
      await flow(`payments/${payment.id}/dispute/`, { method: 'POST', body: {
        reason, note, ...(evidence ? { evidence } : {}),
      } });
      setShowDispute(false);
    });
  };

  return (
    <section className="mt-3 rounded-xl border border-[#E3E6E1] bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 font-semibold"><Wallet size={18} className="text-[#003D14]" /> {s.title}</span>
        <StatusChip status={payment.status} lang={lang} />
        {payment.attempt > 1 && <span className="text-sm text-[#6B6561]">#{payment.attempt}</span>}
      </div>
      <p className="text-sm text-[#475249]">{s.agreed}: <strong>${payment.agreed_amount_usd}</strong>
        {payment.reported_amount_usd && <> · {s.status.sent}: <strong>${payment.reported_amount_usd}</strong></>}
        {payment.transaction_ref && <> · {payment.transaction_ref}</>}
        {payment.paid_date && <> · {payment.paid_date}</>}
      </p>

      {(payment.status === 'awaiting_payment' || payment.status === 'sent') && (
        <div className="rounded-[12px] bg-[#FAFAF9] border border-[#E3E6E1] p-3 space-y-1.5">
          <div className="text-sm font-semibold">{s.methodFor}: {s.kinds[kind] || kind}</div>
          {rows.map(r => (
            <div key={r.label} className="flex items-center gap-2 text-sm">
              <span className="text-[#6B6561]">{r.label}:</span>
              <span className="font-semibold break-all">{r.value}</span>
              <button type="button" className="inline-flex items-center gap-1 text-[#AE332A] font-semibold" onClick={() => copy(r.label, r.value)}>
                <Copy size={13} /> {copied === r.label ? s.copied : s.copy}
              </button>
            </div>
          ))}
          {PROVIDER_URLS[kind] && (
            <a href={PROVIDER_URLS[kind]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-[#AE332A]">
              {s.openProvider} {s.kinds[kind]} <ExternalLink size={13} />
            </a>
          )}
        </div>
      )}

      <p className="flex items-start gap-2 text-sm text-[#475249] bg-[#F7F3E8] border border-[#EAE0C3] rounded-[12px] p-3">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#7A5B12]" /> <span>{s.safety}</span>
      </p>

      {payment.status === 'awaiting_payment' && !isClient && <p className="text-sm text-[#6B6561]">{s.waitingFreelancer}</p>}
      {payment.status === 'awaiting_payment' && isClient && !showSent && (
        <div className="space-y-2">
          <p className="text-sm text-[#475249]">{s.completeOutside}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={redBtn} disabled={busy} onClick={() => { setAmount(payment.agreed_amount_usd); setShowSent(true); }}>{s.sentBtn}</button>
            <button type="button" className={ghostBtn} disabled={busy} onClick={() => run(() => flow(`payments/${payment.id}/cancel/`, { method: 'POST', body: {} }))}>{s.cancelBtn}</button>
          </div>
        </div>
      )}
      {payment.status === 'awaiting_payment' && isClient && showSent && (
        <form onSubmit={submitSent} className="space-y-3 rounded-[12px] border border-[#E3E6E1] p-3">
          <label className="block text-sm font-semibold">{s.amountPaid}
            <input required type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={field} />
          </label>
          <label className="block text-sm font-semibold">{s.refLabel}
            <input required maxLength={120} value={ref} onChange={e => setRef(e.target.value)} className={field} />
            <span className="block text-xs font-normal text-[#6B6561] mt-1">{s.refHint}</span>
          </label>
          <label className="block text-sm font-semibold">{s.dateLabel}
            <input required type="date" value={date} onChange={e => setDate(e.target.value)} className={field} />
          </label>
          <label className="block text-sm font-semibold">{s.receiptLabel}
            <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={e => setReceiptFile(e.target.files?.[0] || null)} className="mt-1 block text-sm" />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={tick} onChange={e => setTick(e.target.checked)} className="w-5 h-5 mt-0.5 accent-[#003D14]" />
            {s.confirmTick}
          </label>
          <button type="submit" className={redBtn} disabled={busy || !tick}>{s.recordBtn}</button>
        </form>
      )}

      {payment.status === 'sent' && isClient && <p className="text-sm font-semibold text-[#7A5B12]">{s.waitingConfirm}</p>}
      {payment.status === 'sent' && payment.has_receipt && (
        <button type="button" className={ghostBtn} onClick={() => downloadPaymentFile(`/api/flows/payments/${payment.id}/receipt/`, 'receipt').catch(() => showError('Could not download the receipt.'))}>
          {s.receiptLabel.replace(/ \(optional\)| \(ऐच्छिक\)/, '')}
        </button>
      )}
      {payment.status === 'sent' && !isClient && !showDispute && (
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={tick} onChange={e => setTick(e.target.checked)} className="w-5 h-5 mt-0.5 accent-[#003D14]" />
            {s.confirmTickFree}
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={redBtn} disabled={busy || !tick}
              onClick={() => run(() => flow(`payments/${payment.id}/confirm/`, { method: 'POST', body: {} }))}>
              <Check size={16} /> {s.confirmBtn}
            </button>
            <button type="button" className={ghostBtn} disabled={busy} onClick={() => setShowDispute(true)}>{s.problemBtn}</button>
          </div>
        </div>
      )}
      {payment.status === 'sent' && !isClient && showDispute && (
        <form onSubmit={submitDispute} className="space-y-3 rounded-[12px] border border-[#F3E1DD] p-3">
          <p className="text-sm text-[#475249]">{s.problemNote}</p>
          <label className="block text-sm font-semibold">{s.reasonLabel}
            <select value={reason} onChange={e => setReason(e.target.value)} className={field}>
              {Object.entries(s.reasons).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">{s.noteLabel}
            <textarea required minLength={5} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} className={field} rows={3} />
          </label>
          <label className="block text-sm font-semibold">{s.evidenceLabel}
            <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={e => setEvidenceFile(e.target.files?.[0] || null)} className="mt-1 block text-sm" />
          </label>
          <div className="flex gap-2">
            <button type="submit" className={redBtn} disabled={busy}>{s.sendReport}</button>
            <button type="button" className={ghostBtn} onClick={() => setShowDispute(false)}>{s.cancelBtn.replace(/this payment|यो भुक्तानी/, '') || 'Cancel'}</button>
          </div>
        </form>
      )}

      {payment.status === 'disputed' && dispute && (
        <div className="rounded-[12px] bg-[#FAF0EE] border border-[#F3E1DD] p-3 text-sm space-y-1">
          <div className="font-semibold text-[#AE332A]">{s.reasons[dispute.reason] || dispute.reason}</div>
          <p className="text-[#475249]">{dispute.note}</p>
        </div>
      )}
      {(payment.status === 'disputed' || payment.status === 'cancelled') && isClient && (
        <button type="button" className={redBtn} disabled={busy}
          onClick={() => run(() => flow('payments/start/', { method: 'POST', body: { milestone_id: milestone.id } }))}>
          {s.retryBtn}
        </button>
      )}

      {!!payment.events?.length && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-[#475249]">History</summary>
          <ul className="mt-1 space-y-1 text-[#6B6561]">
            {payment.events.map(ev => (
              <li key={ev.id}>{s.events[ev.action] || ev.action} · {ev.actor_name} · {new Date(ev.created_at).toLocaleString()}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
