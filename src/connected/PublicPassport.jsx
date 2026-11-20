// A public view of selected WorkPassport details.
import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export function PublicPassport({ token }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api(`/api/flows/public-passport/${encodeURIComponent(token)}/`).then(setProfile).catch(e => setError(e.message));
  }, [token]);
  return <div className="min-h-screen bg-[#FBFAF8] text-[#1C1B1A] p-5">
    <div className="max-w-[760px] mx-auto space-y-5">
      <header className="font-bold text-xl text-[#C73E33]">WorkPassport</header>
      {error && <p role="alert" className="bg-[#FAF0EE] rounded-xl p-4">{error}</p>}
      {!profile && !error && <p>Loading profile…</p>}
      {profile && <>
        <section className="bg-white border border-[#EAE7E1] rounded-[20px] p-6">
          <h1 className="text-3xl font-semibold mb-3">{profile.display_name}</h1>
          <p className="whitespace-pre-wrap">{profile.bio}</p>
        </section>
        <section className="bg-white border border-[#EAE7E1] rounded-[20px] p-6 space-y-3">
          <h2 className="text-xl font-semibold">Skills</h2>
          <div className="flex gap-2 flex-wrap">{profile.skills.map(skill => <span key={skill} className="px-3 py-2 bg-[#F0EEE9] rounded-full">{skill}</span>)}</div>
        </section>
        <section className="bg-white border border-[#EAE7E1] rounded-[20px] p-6 space-y-3">
          <h2 className="text-xl font-semibold">Work samples</h2>
          {profile.samples.length ? profile.samples.map((s,i)=><p key={i}><a href={s.url} target="_blank" rel="noopener noreferrer" className="underline font-semibold break-all">{s.skill}: {s.url}</a>{s.note && <span className="block text-[#6E6963]">{s.note}</span>}</p>) : <p>No shared links yet.</p>}
          <p className="text-sm text-[#6E6963]">{profile.notice}</p>
        </section>
      </>}
    </div>
  </div>;
}
