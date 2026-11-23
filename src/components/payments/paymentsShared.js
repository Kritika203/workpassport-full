// Shared labels and helpers for Vouch DirectPay.
// DirectPay never moves money: the employer pays the freelancer directly in
// their own eSewa, Khalti or bank app. Vouch only coordinates and
// keeps the record. Labels say exactly that, in both languages.
import { readApiSession } from '../../api/client.js';

export const PAY_COPY = {
  en: {
    title: 'DirectPay',
    safety: 'Payments are made directly between you and the other party using your chosen provider. Vouch records the information you submit, but cannot independently verify external transfers or guarantee payment. Check your own wallet or bank account before confirming receipt.',
    payBtn: 'Pay Freelancer',
    startNote: 'The deliverable is approved. You can now pay the freelancer directly.',
    completeOutside: 'Complete the payment directly using your payment provider. Return to Vouch afterward to record the transaction.',
    openProvider: 'Open',
    copy: 'Copy',
    copied: 'Copied',
    sentBtn: "I've Sent the Payment",
    amountPaid: 'Amount you paid (USD)',
    refLabel: 'Transaction reference',
    refHint: 'The reference or transaction ID from your eSewa, Khalti or bank receipt.',
    dateLabel: 'Payment date',
    receiptLabel: 'Receipt screenshot or PDF (optional)',
    confirmTick: 'I confirm I have completed this payment in my own payment app.',
    recordBtn: 'Record the Payment',
    cancelBtn: 'Cancel this payment',
    waitingFreelancer: 'Waiting for the employer to pay.',
    waitingConfirm: 'Employer Marked as Sent — Awaiting Freelancer Confirmation',
    confirmBtn: 'Confirm Payment Received',
    confirmTickFree: 'I checked my own wallet or bank account and the money has arrived.',
    problemBtn: 'Report Payment Problem',
    problemNote: 'Explain the problem. The employer will see your report.',
    reasonLabel: 'What is the problem?',
    noteLabel: 'Your explanation',
    evidenceLabel: 'Supporting screenshot or PDF (optional)',
    sendReport: 'Send Report',
    retryBtn: 'Start a New Payment Attempt',
    methodFor: 'Pay to',
    agreed: 'Agreed amount',
    jobLabel: 'Job',
    milestoneLabel: 'Milestone',
    status: {
      awaiting_payment: 'Awaiting Payment',
      sent: 'Employer Marked as Sent',
      confirmed: 'Receipt Confirmed by Freelancer',
      disputed: 'Disputed',
      cancelled: 'Cancelled',
      not_requested: 'Not Requested',
    },
    reasons: {
      not_received: 'Payment not received',
      wrong_amount: 'Incorrect amount',
      invalid_reference: 'Invalid transaction reference',
      suspicious_receipt: 'Suspicious receipt',
      other: 'Other payment problem',
    },
    kinds: { esewa: 'eSewa', khalti: 'Khalti', bank: 'Bank transfer' },
    fields: { holder_name: 'Account holder', mobile: 'Registered mobile', bank_name: 'Bank', account_number: 'Account number', branch: 'Branch' },
    events: { created: 'Payment started', sent: 'Employer recorded the payment', confirmed: 'Freelancer confirmed receipt', disputed: 'Freelancer reported a problem', cancelled: 'Payment cancelled' },
  },
  ne: {
    title: 'DirectPay',
    safety: 'भुक्तानी तपाईंको रोजेको प्रदायकबाट तपाईं र अर्को पक्षबीच सिधै हुन्छ। Vouch ले तपाईंले पठाएको जानकारी मात्र राख्छ, बाहिरी स्थानान्तरण आफैं जाँच्न वा भुक्तानीको ग्यारेन्टी गर्न सक्दैन। प्राप्ति पुष्टि गर्नुअघि आफ्नो वालेट वा बैंक खाता आफैं जाँच्नुहोस्।',
    payBtn: 'फ्रीलान्सरलाई भुक्तानी गर्नुहोस्',
    startNote: 'काम स्वीकृत भइसक्यो। अब फ्रीलान्सरलाई सिधै भुक्तानी गर्न सक्नुहुन्छ।',
    completeOutside: 'आफ्नो भुक्तानी प्रदायकबाट सिधै भुक्तानी पूरा गर्नुहोस्। त्यसपछि Vouch मा फर्केर कारोबार दर्ता गर्नुहोस्।',
    openProvider: 'खोल्नुहोस्',
    copy: 'कपी गर्नुहोस्',
    copied: 'कपी भयो',
    sentBtn: 'मैले भुक्तानी पठाइसकें',
    amountPaid: 'तपाईंले तिरेको रकम (USD)',
    refLabel: 'कारोबार सन्दर्भ',
    refHint: 'तपाईंको eSewa, Khalti वा बैंक रसिदको सन्दर्भ वा कारोबार ID।',
    dateLabel: 'भुक्तानी मिति',
    receiptLabel: 'रसिदको स्क्रिनसट वा PDF (ऐच्छिक)',
    confirmTick: 'मैले आफ्नै भुक्तानी एपमा यो भुक्तानी पूरा गरेको पुष्टि गर्छु।',
    recordBtn: 'भुक्तानी दर्ता गर्नुहोस्',
    cancelBtn: 'यो भुक्तानी रद्द गर्नुहोस्',
    waitingFreelancer: 'रोजगारदाताले भुक्तानी गर्ने प्रतीक्षामा।',
    waitingConfirm: 'रोजगारदाताले पठाएको भनेर चिन्ह लगाए — फ्रीलान्सरको पुष्टिको प्रतीक्षामा',
    confirmBtn: 'भुक्तानी प्राप्त भएको पुष्टि गर्नुहोस्',
    confirmTickFree: 'मैले आफ्नो वालेट वा बैंक खाता जाँचें र पैसा आइसकेको छ।',
    problemBtn: 'भुक्तानी समस्या रिपोर्ट गर्नुहोस्',
    problemNote: 'समस्या बुझाउनुहोस्। रोजगारदाताले तपाईंको रिपोर्ट देख्नेछन्।',
    reasonLabel: 'समस्या के हो?',
    noteLabel: 'तपाईंको व्याख्या',
    evidenceLabel: 'प्रमाण स्क्रिनसट वा PDF (ऐच्छिक)',
    sendReport: 'रिपोर्ट पठाउनुहोस्',
    retryBtn: 'नयाँ भुक्तानी प्रयास सुरु गर्नुहोस्',
    methodFor: 'भुक्तानी पाउने',
    agreed: 'सहमत रकम',
    jobLabel: 'काम',
    milestoneLabel: 'माइलस्टोन',
    status: {
      awaiting_payment: 'भुक्तानीको प्रतीक्षामा',
      sent: 'रोजगारदाताले पठाएको भनेर चिन्ह लगाए',
      confirmed: 'फ्रीलान्सरले प्राप्ति पुष्टि गरे',
      disputed: 'विवादमा',
      cancelled: 'रद्द गरिएको',
      not_requested: 'मागिएको छैन',
    },
    reasons: {
      not_received: 'भुक्तानी प्राप्त भएन',
      wrong_amount: 'गलत रकम',
      invalid_reference: 'अवैध कारोबार सन्दर्भ',
      suspicious_receipt: 'शंकास्पद रसिद',
      other: 'अन्य भुक्तानी समस्या',
    },
    kinds: { esewa: 'eSewa', khalti: 'Khalti', bank: 'बैंक स्थानान्तरण' },
    fields: { holder_name: 'खातावालाको नाम', mobile: 'दर्ता गरिएको मोबाइल', bank_name: 'बैंक', account_number: 'खाता नम्बर', branch: 'शाखा' },
    events: { created: 'भुक्तानी सुरु भयो', sent: 'रोजगारदाताले भुक्तानी दर्ता गरे', confirmed: 'फ्रीलान्सरले प्राप्ति पुष्टि गरे', disputed: 'फ्रीलान्सरले समस्या रिपोर्ट गरे', cancelled: 'भुक्तानी रद्द भयो' },
  },
};

export const payCopy = (lang) => PAY_COPY[lang] || PAY_COPY.en;

export function methodRows(snapshot, lang) {
  const c = payCopy(lang);
  if (!snapshot || !snapshot.kind) return [];
  const rows = [{ label: c.fields.holder_name, value: snapshot.holder_name || '' }];
  if (snapshot.kind === 'bank') {
    rows.push({ label: c.fields.bank_name, value: snapshot.bank_name || '' });
    rows.push({ label: c.fields.account_number, value: snapshot.account_number || '' });
    if (snapshot.branch) rows.push({ label: c.fields.branch, value: snapshot.branch });
  } else {
    rows.push({ label: c.fields.mobile, value: snapshot.mobile || '' });
  }
  return rows;
}

export function fileToUpload(file) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(null); return; }
    if (file.size > 2_000_000) { reject(new Error('big')); return; }
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) { reject(new Error('type')); return; }
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, data: reader.result });
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

export async function downloadPaymentFile(path, filename) {
  const session = readApiSession();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: session ? { Authorization: `Bearer ${session.access}` } : {},
  });
  if (!response.ok) throw new Error('download');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'file';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const PROVIDER_URLS = { esewa: 'https://esewa.com.np', khalti: 'https://khalti.com' };
