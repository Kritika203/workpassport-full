import { connectedText } from '../i18n/connected.js';
// Skill demand from jobs actually published in Vouch.
import { useEffect, useState } from 'react';
import { flow } from '../api/flows.js';

export function ConnectedInstitutionInsight({ onBack, lang = 'en' }) {
  const t = connectedText[lang] || connectedText.en;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    flow('institution-insight/').then(setData).catch(e => setError(e.message));
  }, []);
  return <div className="mx-auto max-w-[800px] space-y-4">
    <button onClick={onBack} className="rounded-full bg-white border border-[#e5e7dd] px-5 min-h-[44px]">{t.back}</button>
    <h1 className="text-2xl font-semibold">{t.insightTitle}</h1>
    <p className="text-[#4A4744]">{t.insightIntro}</p>
    {error && <p role="alert" className="bg-[#FAF0EE] p-4 rounded-xl">{error}</p>}
    {data && <div className="bg-white rounded-[20px] border border-[#e5e7dd] p-5 space-y-3">
      <p className="font-semibold">{t.publishedJobs}: {data.published_jobs}</p>
      {(data.skills || []).map(item => <div className="flex gap-3 justify-between border-b border-[#e5e7dd] py-2" key={item.skill}>
        <span>{item.skill}</span><span>{item.jobs} {t.jobCount}</span>
      </div>)}
      <p className="text-sm text-[#6E6963]">{data.note}</p>
    </div>}
  </div>;
}
