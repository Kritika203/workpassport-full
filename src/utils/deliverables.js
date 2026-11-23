// Deliverable specs: the detailed, validated replacement for free-text
// deliverable lines. A spec is a plain object stored inside Job.deliverables
// (legacy entries are plain strings and keep working everywhere):
//   { name, description, quantity, formats: ['png','pdf'], max_mb: 10,
//     link_allowed: true, milestone: 1 }   // milestone: 1-based, null = whole job
//
// The same rules exist server-side (opportunities/serializers.py and
// workflows/views.py). The browser layer gives instant feedback; the server
// layer is the one that counts.

// Max file size (MB) per format, from the agreed format table.
export const FORMAT_MAX_MB = {
  png: 10, jpg: 10, jpeg: 10, svg: 10, webp: 10, gif: 10,
  pdf: 10, docx: 10, txt: 10, xlsx: 10, csv: 10,
  mp4: 100, mov: 100,
  mp3: 25, wav: 25,
  zip: 50, psd: 50, ai: 50, fig: 50,
};
export const ALL_FORMATS = Object.keys(FORMAT_MAX_MB);

// Program files and anything executable are never deliverables.
export const BLOCKED_EXTS = [
  'exe', 'msi', 'bat', 'cmd', 'sh', 'bash', 'js', 'mjs', 'jar', 'apk', 'dmg',
  'com', 'scr', 'ps1', 'vbs', 'php', 'html', 'htm', 'dll', 'bin', 'run',
];

export function isSpec(x) {
  return !!x && typeof x === 'object' && typeof x.name === 'string' && Array.isArray(x.formats);
}

// One-line human text for any deliverable entry (string or spec).
export function deliverableText(x) {
  if (typeof x === 'string') return x;
  if (isSpec(x)) return x.name;
  return String(x ?? '');
}

// Fuller line for detail/agreement screens: name plus the exact terms.
export function deliverableDetail(x) {
  if (!isSpec(x)) return deliverableText(x);
  const bits = [];
  if (x.quantity > 1) bits.push(`×${x.quantity}`);
  if (x.formats?.length) bits.push(x.formats.map(f => f.toUpperCase()).join(', '));
  if (x.max_mb) bits.push(`up to ${x.max_mb} MB`);
  if (x.link_allowed) bits.push('link allowed');
  return bits.length ? `${x.name} (${bits.join(' · ')})` : x.name;
}

// Specs linked to a 1-based milestone index. Specs with no milestone
// (null/0) belong to the whole job and count for every milestone.
export function specsForMilestone(deliverables, milestoneIndex) {
  return (deliverables || []).filter(d => isSpec(d) &&
    (d.milestone == null || d.milestone === 0 || d.milestone === milestoneIndex));
}

export function allSpecs(deliverables) {
  return (deliverables || []).filter(isSpec);
}

// Validate one spec being built in the posting form.
// Returns a list of error codes: name, description, quantity, formats, size.
export function validateSpec(spec) {
  const errs = [];
  if (!spec.name || spec.name.trim().length < 3) errs.push('name');
  if (!spec.description || spec.description.trim().length < 20) errs.push('description');
  const q = Number(spec.quantity);
  if (!Number.isFinite(q) || q < 1 || q > 999) errs.push('quantity');
  const fmts = (spec.formats || []).filter(f => ALL_FORMATS.includes(f));
  if (!fmts.length) errs.push('formats');
  const cap = fmts.length ? Math.min(...fmts.map(f => FORMAT_MAX_MB[f])) : 0;
  const mb = Number(spec.max_mb);
  if (!Number.isFinite(mb) || mb < 1 || mb > cap) errs.push('size');
  return errs;
}

// The largest size a spec may use once its formats are chosen.
export function specSizeCap(spec) {
  const fmts = (spec.formats || []).filter(f => ALL_FORMATS.includes(f));
  return fmts.length ? Math.min(...fmts.map(f => FORMAT_MAX_MB[f])) : 100;
}

export function fileExtension(name) {
  const parts = String(name || '').split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

// "logo.pdf.exe" and "photo.jpg.png" style names: two known extensions.
export function hasDoubleExtension(name) {
  const parts = String(name || '').toLowerCase().split('.');
  if (parts.length < 3) return false;
  const known = new Set([...ALL_FORMATS, ...BLOCKED_EXTS]);
  return parts.slice(1, -1).some(p => known.has(p));
}

// Validate one chosen file against the specs of a milestone (browser layer).
// Returns { ok: true } or { ok: false, code, formats?, maxMb? }.
export function validateFileAgainstSpecs(file, specs) {
  const name = file?.name || '';
  const ext = fileExtension(name);
  if (!ext || BLOCKED_EXTS.includes(ext)) return { ok: false, code: 'blocked' };
  if (hasDoubleExtension(name)) return { ok: false, code: 'double' };
  const list = (specs || []).filter(isSpec);
  if (!list.length) return { ok: true };
  const matching = list.filter(s => (s.formats || []).includes(ext));
  if (!matching.length) {
    const allowed = [...new Set(list.flatMap(s => s.formats || []))];
    return { ok: false, code: 'format', formats: allowed };
  }
  const capMb = Math.max(...matching.map(s => Number(s.max_mb) || 0));
  if (file.size > capMb * 1_000_000) return { ok: false, code: 'size', maxMb: capMb };
  return { ok: true };
}
