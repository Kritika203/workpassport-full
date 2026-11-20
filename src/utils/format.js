// Number, date and text helpers.



export const fmtMoney = (n) => Number(n).toLocaleString('en-US');

export const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const fmt = (str, vars) => Object.keys(vars).reduce((acc, k) => acc.split('{' + k + '}').join(vars[k]), str);

export const slugify = (name) => (name || 'freelancer').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'freelancer';

export const initialsOf = (name) => (name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

const o = (en, ne) => ({ en, ne: ne || en });

export const spDigits = (lang, v) => lang === 'ne' ? String(v).replace(/\d/g, d => '०१२३४५६७८९'[d]) : String(v);

export const spClock = (iso, lang) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return spDigits(lang, d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }));
};

export const telHref = (phone) => 'tel:' + String(phone || '').replace(/[^\d+]/g, '');

// Opens the visitor's own SMS composer. This does not send or schedule an SMS.
// No geolocation or other personal data is attached automatically.
export const smsHref = (phone, body) => {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15 || !body) return '';
  // Keep an explicit international prefix where supplied; local mobile numbers work too.
  const number = raw.startsWith('+') ? `+${digits}` : raw.startsWith('00') ? `+${digits.slice(2)}` : digits;
  return `sms:${number}?body=${encodeURIComponent(String(body))}`;
};

// WhatsApp click-to-chat link. Normalises a Nepali mobile number to
// international form (10 digits starting with 9 gets the 977 country code).
export const waHref = (phone, text) => {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('9')) digits = '977' + digits;
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
};

export const toDigits = (n, lang) => lang === 'ne' ? String(n).replace(/\d/g, d => '०१२३४५६७८९'[d]) : String(n);
