import { useEffect, useState } from 'react';
import { VoiceField } from '../common/VoiceField.jsx';

// Demo negotiation board: persistence on this browser only, no binding contracts.
export function NegotiationPanel({ id, role = 'worker', baseline = 0, lang = 'en' }) {
  const key = `vouch_terms_demo_${String(id || 'unknown').replace(/[^a-zA-Z0-9_-]/g,'')}`;
  const [offers, setOffers] = useState(() => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } });
  const [amount, setAmount] = useState(String(baseline || 0));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(offers)); } catch { /* local storage disabled */ } }, [key, offers]);
  const send = e => {
    e.preventDefault(); setError(''); const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > 100000) { setError('Enter a positive, realistic amount (USD).'); return; }
    if (note.trim().length < 5) { setError('Explain your offer in at least five characters.'); return; }
    setOffers(old => [...old, { id: `offer-${Date.now()}`, role, amount: value, note: note.trim().slice(0, 500), state: 'proposed', at: new Date().toISOString() }]);
    setNote('');
  };
  const respond = (id, state) => setOffers(old=>old.map(o=>o.id===id?{...o,state}:o));
  return <section className="vouch-surface vouch-negotiation"><h2>Discuss fair terms</h2><p className="vouch-muted">Baseline: <strong>USD {Number(baseline).toFixed(2)}</strong>. Propose an amount and explain the scope, deadline, or revision expectations. Both sides must explicitly agree before work starts.</p>
    {offers.length > 0 && <ol className="vouch-offer-list">{offers.map(o=><li key={o.id}><div><strong>{o.role === 'client' ? 'Employer' : 'Worker'} · USD {Number(o.amount).toFixed(2)}</strong><span className="vouch-muted">{o.state}</span></div><p>{o.note}</p>{o.state==='proposed' && o.role!==role && <div className="vouch-offer-actions"><button type="button" onClick={()=>respond(o.id,'accepted-demo')}>Accept in demo</button><button type="button" onClick={()=>respond(o.id,'declined-demo')}>Decline</button></div>}</li>)}</ol>}
    <form onSubmit={send} className="vouch-offer-form"><label className="vouch-field-label">Your proposed amount (USD)<input type="number" min="1" max="100000" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label><VoiceField label="Why this amount?" value={note} onChange={setNote} lang={lang} rows={2} maxLength={500} placeholder="For this scope and deadline, I propose..."/>
      {error && <p role="alert" className="vouch-form-error">{error}</p>}
      <button type="submit" className="vouch-button">Propose terms</button></form>
    <p className="vouch-muted vouch-note">Local demo only: these offers do not sync between devices, change the signed agreement, or move money. Confirm binding terms inside the Workroom agreement.</p>
  </section>;
}
