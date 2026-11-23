// Explore Freelancers: search and filter the public Vouch directory,
// shortlist freelancers, and invite them to a live job.
// Real accounts use the client API; the demo uses the demo applicants locally.
import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, MapPin, Search } from 'lucide-react';
import { api, readApiSession } from '../api/client.js';
import { CL_CARD, CL_INPUT, CL_LABEL } from '../components/client/ClientControls.jsx';
import { DEMO_APPLICANTS } from '../data/demo.js';
import { fmtMoney, toDigits } from '../utils/format.js';

const PROOFS = ['self', 'demonstrated', 'institution', 'client', 'platform'];
const PROOF_LABEL = {
  self: ['Self-added', 'आफैँ थपेको'], demonstrated: ['Demonstrated', 'देखाएको'],
  institution: ['Institution-verified', 'संस्थाले प्रमाणित'], client: ['Client-confirmed', 'ग्राहकले पुष्टि गरेको'],
  platform: ['Platform-verified', 'प्लेटफर्मले प्रमाणित'],
};

const demoRows = DEMO_APPLICANTS.map(a => ({
  user_id: a.id, name: a.name, district: a.place, availability: a.availability, headline: '',
  skills: a.skills.map(sk => ({ name: sk.name, level: sk.level, proof: sk.level })),
  proofs: a.proofs, completed_jobs: a.completed, training: [],
}));

export function ClientExplore({ t, lang, navTo, showToast, connected = false, clientJobs = [] }) {
  const ne = lang === 'ne';
  const digits = (n) => toDigits(n, lang);
  const [skill, setSkill] = useState('');
  const [proof, setProof] = useState('');
  const [location, setLocation] = useState('');
  const [trainingOnly, setTrainingOnly] = useState(false);
  const [rows, setRows] = useState(connected ? [] : demoRows);
  const [error, setError] = useState('');
  const [shortlisted, setShortlisted] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wp_client_shortlist') || '[]'); } catch { return []; }
  });
  const [openId, setOpenId] = useState(null);
  const [inviteJob, setInviteJob] = useState({});
  const [busy, setBusy] = useState(false);

  const liveJobs = connected
    ? clientJobs.filter(j => j.apiId && j.status === 'published')
    : clientJobs.filter(j => !j.accepted);

  useEffect(() => {
    if (!connected) return;
    api('/api/client/shortlist/', {}, readApiSession())
      .then(d => setShortlisted(d.freelancer_ids || []))
      .catch(() => {});
  }, [connected]);

  useEffect(() => {
    if (!connected) {
      const q = skill.trim().toLowerCase();
      const lq = location.trim().toLowerCase();
      setRows(demoRows.filter(r =>
        (!q || r.skills.some(s => s.name.toLowerCase().includes(q))) &&
        (!lq || r.district.toLowerCase().includes(lq)) &&
        (!proof || r.skills.some(s => PROOFS.indexOf(s.proof) >= PROOFS.indexOf(proof))) &&
        (!trainingOnly || r.training.length > 0)));
      return;
    }
    const params = new URLSearchParams();
    if (skill.trim()) params.set('skill', skill.trim());
    if (location.trim()) params.set('location', location.trim());
    if (proof) params.set('proof', proof);
    if (trainingOnly) params.set('training', '1');
    let live = true;
    api(`/api/client/explore/?${params.toString()}`, {}, readApiSession())
      .then(d => { if (live) { setRows(Array.isArray(d) ? d : []); setError(''); } })
      .catch(e => { if (live) setError(e.message || 'Could not load freelancers.'); });
    return () => { live = false; };
  }, [connected, skill, location, proof, trainingOnly]);

  const toggleShortlist = async (row) => {
    const has = shortlisted.includes(row.user_id);
    if (connected) {
      setBusy(true);
      try {
        if (has) { await api(`/api/client/shortlist/${row.user_id}/`, { method: 'DELETE' }, readApiSession()); setShortlisted(prev => prev.filter(x => x !== row.user_id)); }
        else { const d = await api('/api/client/shortlist/', { method: 'POST', body: { freelancer_id: row.user_id } }, readApiSession()); setShortlisted(d.freelancer_ids || []); }
      } catch (e) { showToast(e.message || 'Could not update the shortlist.'); }
      finally { setBusy(false); }
      return;
    }
    setShortlisted(prev => {
      const next = has ? prev.filter(x => x !== row.user_id) : [...prev, row.user_id];
      try { localStorage.setItem('wp_client_shortlist', JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  };

  const invite = async (row) => {
    const jobKey = inviteJob[row.user_id] || (liveJobs[0] && (connected ? liveJobs[0].apiId : liveJobs[0].id));
    if (!jobKey) { showToast(ne ? 'पहिले एउटा लाइभ काम चाहिन्छ।' : 'You need a live job first.'); return; }
    if (!connected) { showToast(ne ? `${row.name} लाई निम्तो पठाइयो (डेमो)।` : `Invitation sent to ${row.name} (demo).`); return; }
    setBusy(true);
    try {
      const d = await api('/api/client/invite/', { method: 'POST', body: { freelancer_id: row.user_id, job_id: jobKey } }, readApiSession());
      showToast(d.already_invited ? (ne ? 'पहिले नै निम्तो पठाइसकिएको छ।' : 'Already invited.') : (ne ? `${row.name} लाई निम्तो पठाइयो।` : `Invitation sent to ${row.name}.`));
    } catch (e) { showToast(e.message || 'Could not send the invitation.'); }
    finally { setBusy(false); }
  };

  const chip = (on) => `min-h-[38px] px-3 rounded-full border text-[13px] font-semibold ${on ? 'bg-[#FAF0EE] border-[#59684a] text-[#AE332A]' : 'bg-white border-[#e5e7dd] text-[#4A4744]'}`;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-[28px] sm:text-[30px] font-semibold mb-1">{ne ? 'फ्रीलान्सरहरू खोज्नुहोस्' : 'Explore Freelancers'}</h1>
        <p className="text-base text-[#4A4744]">{ne
          ? 'हरेक कार्ड उनको Vouch को सार्वजनिक सारांश हो। मन परेकालाई छनोट सूचीमा राख्नुहोस् वा तपाईंको लाइभ काममा आवेदन दिन निम्तो दिनुहोस्।'
          : 'Every card is the public summary from her Vouch. Save the ones you like to your shortlist, or invite them to apply for a live job.'}</p>
        {!connected && <p className="text-sm text-[#6E6963] mt-1">{ne ? 'डेमो सूची: नमुना फ्रीलान्सरहरू मात्र।' : 'Demo directory: sample freelancers only.'}</p>}
      </div>

      <div className={`${CL_CARD} space-y-3`}>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="ex-skill" className={CL_LABEL}><Search size={14} className="inline mr-1" />{ne ? 'सीपले खोज्नुहोस्' : 'Search by skill'}</label>
            <input id="ex-skill" type="text" value={skill} onChange={e => setSkill(e.target.value)} className={CL_INPUT} placeholder={ne ? 'उदाहरण: Canva' : 'e.g. Canva'} />
          </div>
          <div>
            <label htmlFor="ex-proof" className={CL_LABEL}>{ne ? 'न्यूनतम प्रमाण स्तर' : 'Minimum proof level'}</label>
            <select id="ex-proof" value={proof} onChange={e => setProof(e.target.value)} className={CL_INPUT}>
              <option value="">{ne ? 'जुनसुकै' : 'Any level'}</option>
              {PROOFS.slice(1).map(p => <option key={p} value={p}>{PROOF_LABEL[p][ne ? 1 : 0]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ex-loc" className={CL_LABEL}>{ne ? 'स्थान' : 'Location'}</label>
            <input id="ex-loc" type="text" value={location} onChange={e => setLocation(e.target.value)} className={CL_INPUT} placeholder={ne ? 'उदाहरण: Pokhara' : 'e.g. Pokhara'} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-base cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-[#59684a]" checked={trainingOnly} onChange={e => setTrainingOnly(e.target.checked)} />
          {ne ? 'तालिम लिएका मात्र' : 'With training only'}
        </label>
        {shortlisted.length > 0 && <p className="text-sm text-[#6E6963]">{ne ? 'तपाईंको छनोट सूचीमा' : 'In your shortlist'}: <strong className="text-[#1C1B1A]">{digits(shortlisted.length)}</strong></p>}
      </div>

      {error && <p role="alert" className="bg-[#FAF0EE] border border-[#F3E1DD] rounded-[14px] p-4 text-base text-[#AE332A]">{error}</p>}
      {rows.length === 0 && !error && <p className="text-base text-[#4A4744] bg-white border border-[#e5e7dd] rounded-[16px] p-5">{ne ? 'यी फिल्टरसँग मिल्ने फ्रीलान्सर भेटिएनन्।' : 'No freelancers match these filters.'}</p>}

      {rows.map(row => {
        const saved = shortlisted.includes(row.user_id);
        const jobVal = inviteJob[row.user_id] ?? (liveJobs[0] ? (connected ? liveJobs[0].apiId : liveJobs[0].id) : '');
        return (
          <div key={row.user_id} className={CL_CARD}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-xl break-words">{row.name}</div>
                {row.headline && <div className="text-base text-[#4A4744]">{row.headline}</div>}
                <div className="text-base text-[#4A4744] flex items-center gap-1.5"><MapPin size={17} className="text-[#8A8580]" /> {row.district || (ne ? 'स्थान दिएको छैन' : 'Location not given')}</div>
              </div>
              <button onClick={() => toggleShortlist(row)} disabled={busy} aria-pressed={saved}
                className={`shrink-0 min-h-[44px] px-4 rounded-full border font-semibold text-sm disabled:opacity-50 ${saved ? 'bg-[#FAF0EE] border-[#59684a] text-[#AE332A]' : 'bg-white border-[#E3E0D9] hover:border-[#DDD8CE]'}`}>
                {saved ? (ne ? 'छनोट सूचीमा छ' : 'Shortlisted') : (ne ? 'छनोट सूचीमा राख्नुहोस्' : 'Shortlist')}
              </button>
            </div>
            <ul className="space-y-1.5 mt-3 mb-3">
              {row.skills.map(sk => (
                <li key={sk.name} className="flex items-center justify-between gap-2 text-base">
                  <span><strong>{sk.name}</strong></span>
                  <span className="bg-[#F0EEE9] border border-[#e5e7dd] rounded-full px-3 py-0.5 text-[13px] font-semibold">{PROOF_LABEL[sk.proof][ne ? 1 : 0]}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-[#6E6963] mb-4">
              {ne ? 'प्रमाणित प्रमाण' : 'Verified proofs'}: {digits(row.proofs)} · {ne ? 'पूरा गरेका काम' : 'Completed jobs'}: {digits(row.completed_jobs)}
              {row.availability ? ` · ${row.availability}` : ''}
            </p>
            {openId === row.user_id && (
              <div className="rounded-[14px] border border-[#e5e7dd] bg-[#fcfbf8] p-4 mb-4 space-y-2">
                <p className="font-semibold text-base flex items-center gap-2"><BadgeCheck size={18} className="text-[#59684a]" /> Vouch — {row.name}</p>
                {row.training.length > 0
                  ? <p className="text-sm text-[#4A4744]">{ne ? 'तालिम' : 'Training'}: {row.training.map(e => `${e.title}${e.institution ? ` (${e.institution})` : ''}`).join(', ')}</p>
                  : <p className="text-sm text-[#6E6963]">{ne ? 'तालिमको विवरण राखिएको छैन।' : 'No training listed yet.'}</p>}
                <p className="text-sm text-[#6E6963]">{ne ? 'यो सारांश उनको Vouch बाट आएको हो। सम्पर्क विवरण कुराकानी सुरु भएपछि मात्र देखिन्छ।' : 'This summary comes from her Vouch. Contact details appear only after you start a conversation.'}</p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={() => setOpenId(openId === row.user_id ? null : row.user_id)} className="flex-1 border border-[#E3E0D9] bg-white rounded-full px-4 font-semibold text-base hover:border-[#DDD8CE] min-h-[48px]">
                {ne ? 'Vouch हेर्नुहोस्' : 'View Vouch'}
              </button>
              <select aria-label={ne ? 'निम्तो दिने काम' : 'Job to invite to'} value={jobVal}
                onChange={e => setInviteJob(prev => ({ ...prev, [row.user_id]: connected ? Number(e.target.value) : e.target.value }))}
                className="flex-1 rounded-full border border-[#E3E0D9] bg-white px-4 min-h-[48px] text-base" disabled={!liveJobs.length}>
                {liveJobs.length === 0 && <option value="">{ne ? 'लाइभ काम छैन' : 'No live job'}</option>}
                {liveJobs.map(j => <option key={j.id} value={connected ? j.apiId : j.id}>{j.title}</option>)}
              </select>
              <button onClick={() => invite(row)} disabled={busy || !liveJobs.length} className="flex-1 bg-[#59684a] text-white rounded-full px-4 font-semibold text-base hover:bg-[#415947] min-h-[48px] disabled:opacity-50">
                {ne ? 'आवेदन दिन निम्तो दिनुहोस्' : 'Invite to Apply'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
