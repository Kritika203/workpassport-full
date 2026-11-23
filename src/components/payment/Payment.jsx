// Show estimated payments and fees.

import { AlertTriangle, Wallet } from 'lucide-react';
import { useState } from 'react';
import { fmtMoney } from '../../utils/format.js';
import { Disclaimer } from '../common/Disclaimer.jsx';



const PAY_RATE = 133;

const PAY_METHODS = [
  { id: 'bank', pct: 2, flat: 15 },     // Bank transfer: 2% + $15 flat
  { id: 'payoneer', pct: 2, flat: 0 },  // Payoneer: 2% + $0
  { id: 'wise', pct: 1.5, flat: 1 },    // Wise: 1.5% + $1 flat
];

export function NetPayPreview({ usd, t }) {
  const [chosen, setChosen] = useState(null);
  const amount = Number(usd) || 0;
  const gross = amount * PAY_RATE;
  const feeFor = (x) => (amount * x.pct / 100 + x.flat) * PAY_RATE;
  // Until the user picks a method, show the lowest-fee one for this amount.
  // A fixed-charge method (bank/SWIFT) can take most of a small payment, so
  // it must never be the silent default.
  const cheapest = PAY_METHODS.reduce((a, b) => (feeFor(b) < feeFor(a) ? b : a), PAY_METHODS[0]);
  const m = PAY_METHODS.find(x => x.id === chosen) || cheapest;
  const fee = feeFor(m);
  const feePct = gross > 0 ? Math.round(fee / gross * 100) : 0;
  const net = gross - fee;
  // Display whole rupees only, and derive the net from the two displayed
  // numbers so the arithmetic on screen always adds up exactly.
  const grossR = Math.round(gross);
  const feeR = Math.round(fee);
  const netShown = grossR - feeR;
  const label = (id) => id === 'bank' ? t('np_bank') : id === 'payoneer' ? 'Payoneer' : 'Wise';
  return (
    <div>
      <div className="bg-white border border-[#E3E6E1] rounded-[20px] p-5 sm:p-6">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2"><Wallet size={22} className="text-[#003D14] shrink-0" /> {t('np_title')}</h3>
        <div className="flex flex-wrap gap-2 mb-5">
          {PAY_METHODS.map(x => (
            <button key={x.id} onClick={() => setChosen(x.id)} aria-pressed={m.id === x.id} className={`px-4 rounded-full border text-base font-semibold min-h-[44px] transition-colors ${m.id === x.id ? 'border-[#003D14] bg-[#FAF0EE] text-[#AE332A]' : 'border-[#E3E6E1] bg-white text-[#475249] hover:border-[#DDD8CE]'}`}>
              {label(x.id)}
            </button>
          ))}
        </div>
        <div className="space-y-3 text-base">
          <div className="flex justify-between gap-4"><span className="text-[#475249]">{t('np_price')}</span><span className="font-semibold">${fmtMoney(amount)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-[#475249]">{t('np_rupees')}</span><span className="font-semibold">NPR {fmtMoney(grossR)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-[#475249]">{t('np_fees')}</span><span className="font-semibold">− NPR {fmtMoney(feeR)} ({feePct}%)</span></div>
        </div>
        {net > 0 && feePct > 20 && (
          <div className="flex items-start gap-2 text-[#AE332A] font-semibold text-base bg-[#FAF0EE] p-3 rounded-[12px] mt-3"><AlertTriangle size={20} className="mt-0.5 shrink-0" /> <span>{t('np_fee_high')}</span></div>
        )}
        <div className="border-t border-[#E3E6E1] mt-4 pt-4">
          {net > 0 && netShown > 0 ? (
            <div className="flex justify-between items-baseline gap-4 flex-wrap">
              <span className="font-semibold text-lg">{t('np_receive')}</span>
              <span className="font-semibold text-2xl">NPR {fmtMoney(netShown)}</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-[#AE332A] font-semibold text-base bg-[#FAF0EE] p-3 rounded-[12px]"><AlertTriangle size={20} className="mt-0.5 shrink-0" /> <span>{t('np_warn')}</span></div>
          )}
        </div>
        <p className="text-sm text-[#6B6561] mt-3">{t('np_sample_note')}</p>
      </div>
      <Disclaimer t={t} k="disc_paynet" className="mt-3" />
    </div>
  );
}

export function NetPayCalculator({ t }) {
  const [val, setVal] = useState('60');
  return (
    <div className="mt-6 mb-8">
      <label htmlFor="np-calc" className="block text-base font-semibold mb-2">{t('np_calc_label')}</label>
      <input id="np-calc" type="number" inputMode="decimal" min="0" value={val} onChange={e => setVal(e.target.value)} className="w-full sm:w-48 mb-4 px-4 border border-[#E3E6E1] rounded-full text-base min-h-[48px] bg-white focus:outline-none focus:border-[#003D14]" />
      <NetPayPreview usd={Math.max(0, parseFloat(val) || 0)} t={t} />
    </div>
  );
}
