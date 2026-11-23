/* A tiny dependency-free PDF writer for the downloadable skills gap report.
   Free learning links are resource-search starting points, not verified courses. */
const latin = text => String(text ?? '').normalize('NFKD').replace(/[^\x20-\x7E]/g, '-');
const safe = text => latin(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const wrap = (str, max = 83) => {
  const words = latin(str).split(/\s+/); let row = '', lines = [];
  for (const word of words) {
    if ((row + ' ' + word).trim().length > max) { if (row) lines.push(row); row = word; }
    else row += (row ? ' ' : '') + word;
  }
  if (row) lines.push(row);
  return lines.length ? lines : [''];
};
export function skillResources(skill) {
  const q = encodeURIComponent(`${skill} beginner tutorial`);
  const resources = [
    { name: `YouTube: ${skill} beginner tutorials`, url: `https://www.youtube.com/results?search_query=${q}` },
    { name: 'freeCodeCamp learning library', url: 'https://www.freecodecamp.org/learn/' },
  ];
  if (/javascript|html|css|react|web|api|python|sql/i.test(skill)) resources.push({ name: 'MDN web development', url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development' });
  if (/design|canva|graphic|poster|logo|visual/i.test(skill)) resources.push({ name: 'Canva Design School', url: 'https://www.canva.com/designschool/' });
  return resources;
}
export function getSkillGap(job, user) {
  const needed = Array.isArray(job?.skillsRequired) ? job.skillsRequired.filter(Boolean) : [];
  const have = (Array.isArray(user?.skills) ? user.skills : []).map(s => String(s).toLowerCase().trim());
  return { matched: needed.filter(s => have.includes(String(s).toLowerCase().trim())), missing: needed.filter(s => !have.includes(String(s).toLowerCase().trim())), needed };
}
export function downloadSkillReport(job, user) {
  const { matched, missing, needed } = getSkillGap(job, user);
  const lines = [
    'VOUCH / SKILLS ROADMAP', '',
    `Job: ${job.title || 'Opportunity'}`,
    `Applicant: ${user?.name || 'Vouch member'}`,
    `Skills matched: ${matched.length} / ${needed.length}`,
    '', 'MATCHED SKILLS', ...(matched.length ? matched.map(s => `  - ${s}`) : ['  None listed yet']),
    '', 'SKILLS TO DEVELOP', ...(missing.length ? missing.map(s => `  - ${s}`) : ['  All listed skills matched; keep building evidence.']),
    '', 'FREE LEARNING STARTING POINTS',
  ];
  for (const skill of missing) {
    lines.push('', skill.toUpperCase());
    for (const item of skillResources(skill)) {
      lines.push(`  ${item.name}`);
      lines.push(`  ${item.url}`);
    }
  }
  lines.push('', 'NEXT STEPS', '1. Pick one missing skill and start with a beginner lesson.', '2. Create a small sample project and save it to your portfolio.', '3. Ask the employer to clarify any advanced requirements.', '', 'This is a self-reported skill match, not a certification.', 'External learning resources have not been individually vetted.');
  // PDF 1.4, landscape-free portrait letter pages, standard embedded font.
  const expanded = lines.flatMap(t => wrap(t, 88));
  const pageLines = 54;
  const pages = [];
  for (let i = 0; i < expanded.length; i += pageLines) pages.push(expanded.slice(i, i + pageLines));
  const objects = [];
  const add = text => { objects.push(text); return objects.length; };
  const catalogId = add(''); const pagesId = add('');
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds = [];
  for (const [pageIndex, texts] of pages.entries()) {
    const stream = `BT /F1 10 Tf 44 785 Td 14 TL\n${texts.map(line => `(${safe(line)}) Tj T*`).join('\n')}\nET`;
    const contentId = add(`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(new TextEncoder().encode(pdf).length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n `).join('\n')}\n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([new TextEncoder().encode(pdf)], { type: 'application/pdf' }));
  const a = document.createElement('a'); a.href = url; a.download = `Vouch_Skill_Roadmap_${String(job.title || 'Job').replace(/[^a-z0-9]+/gi, '_').slice(0, 35)}.pdf`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
