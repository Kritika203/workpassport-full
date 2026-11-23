import { useEffect, useState } from 'react';
import { VoiceField } from '../components/common/VoiceField.jsx';

function useSharedDemo(key, initial = []) {
  const [items, setItems] = useState(() => { try { return JSON.parse(localStorage.getItem(key) || 'null') || initial; } catch { return initial; } });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(items)); } catch { /* storage unavailable */ } }, [key, items]);
  return [items, setItems];
}
const samples = [
  { id: 'sample-a', topic: 'First opportunities', text: 'Before applying, ask for written deliverables, payment timing, and what a revision includes.', author: 'Sample peer tip', sample: true },
  { id: 'sample-b', topic: 'Safety & boundaries', text: 'If a client asks for private photos or an advance payment, stop and report it.', author: 'Sample peer tip', sample: true },
];

export function VouchCommunity({ lang = 'en', viewer = 'worker', name = 'Vouch member', onJobBoard }) {
  const [topic, setTopic] = useState('First opportunities');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [posts, setPosts] = useSharedDemo('vouch_community_demo_v1');
  const [error, setError] = useState('');
  const topics = ['First opportunities', 'Safety & boundaries', 'Skills & confidence', 'Fair work terms'];
  const submit = event => {
    event.preventDefault(); setError('');
    if (message.trim().length < 20) { setError('Write at least 20 characters so others understand your experience.'); return; }
    if (/\b(?:phone|whatsapp|\+977\s?9\d{9})\b/i.test(message)) { setError('Please remove personal contact details before posting.'); return; }
    setPosts(old => [{ id: `p-${Date.now()}`, topic, text: message.trim().slice(0, 2000), author: anonymous ? 'Anonymous member' : name, sample: false, at: new Date().toISOString() }, ...old]);
    setMessage('');
  };
  return <section className="vouch-inner vouch-community">
    <div className="vouch-section-heading"><span className="vouch-kicker">PEOPLE FIRST · WOMEN FIRST</span><h1>You're not building your career alone.</h1><p>Share practical advice, ask questions, and build confidence with other early-career workers. Employers can learn what makes work feel fair and transparent.</p></div>
    <div className="vouch-community-grid">
      <div>
        <h2>Community conversations</h2>
        <div className="vouch-topic-row">{topics.map(item => <button type="button" key={item} aria-pressed={topic === item} onClick={() => setTopic(item)}>{item}</button>)}</div>
        <div className="vouch-stack">{[...posts, ...samples].filter(p => p.topic === topic || (!p.topic && topic === 'First opportunities')).map(post => <article key={post.id} className="vouch-surface"><div className="vouch-post-meta"><strong>{post.author}</strong><span>{post.sample ? 'Example only · not a real user review' : 'Posted on this device · demo'}</span></div><p>{post.text}</p></article>)}
          {![...posts, ...samples].some(p => p.topic === topic) && <p className="vouch-muted">No posts here yet. Start a conversation.</p>}</div>
      </div>
      <aside className="vouch-surface vouch-community-form">
        <h2>Start a conversation</h2><p className="vouch-muted">This preview stays in this browser. Posts are not yet shared with other users or moderated by Vouch staff.</p>
        <form onSubmit={submit}><VoiceField label="Your experience or question" value={message} onChange={setMessage} lang={lang} rows={5} placeholder="What helped you feel safer during your first project?" maxLength={2000}/>
          <label className="vouch-field-label">Topic<select value={topic} onChange={e => setTopic(e.target.value)}>{topics.map(i=><option key={i}>{i}</option>)}</select></label>
          <label className="vouch-inline-check"><input type="checkbox" checked={anonymous} onChange={e=>setAnonymous(e.target.checked)}/> Show as Anonymous member</label>
          {error && <p className="vouch-form-error" role="alert">{error}</p>}
          <button type="submit" className="vouch-button">Post in this demo</button></form>
        <p className="vouch-muted vouch-note">Women-first means prioritizing safer work, respectful boundaries, and support. It doesn't exclude other workers or employers.</p>
        {onJobBoard && <button type="button" className="vouch-link" onClick={onJobBoard}>Browse opportunities</button>}
      </aside>
    </div>
  </section>;
}

export function JobFeedback({ job, lang = 'en', name = 'Vouch member', canReview = false, onBack }) {
  const [all, setAll] = useSharedDemo('vouch_job_feedback_demo_v1');
  const [text, setText] = useState('');
  const [rating, setRating] = useState('clear');
  const [anonymous, setAnonymous] = useState(true);
  const [error, setError] = useState('');
  const reviews = all.filter(row => String(row.jobId) === String(job?.id));
  const submit = e => {
    e.preventDefault(); setError('');
    if (!canReview) { setError('Feedback can be submitted after completing a job.'); return; }
    if (text.trim().length < 20) { setError('Please write at least 20 characters.'); return; }
    const published = { jobId: job.id, id: `feedback-${Date.now()}`, text: text.trim().slice(0, 1400), experience: rating, author: anonymous ? 'Anonymous worker' : name, at: new Date().toISOString(), sample: false };
    setAll(old => [published, ...old]); setText('');
  };
  if (!job) return <div className="vouch-inner"><p>This job is unavailable.</p><button onClick={onBack}>Back</button></div>;
  return <section className="vouch-inner vouch-feedback-page">
    <button type="button" className="vouch-link" onClick={onBack}>← Back to job</button>
    <div className="vouch-section-heading"><span className="vouch-kicker">WORKER EXPERIENCES</span><h1>What was working on this job like?</h1><p><strong>{job.title}</strong> · {job.clientName}. Feedback can help someone else understand expectations before applying.</p></div>
    <div className="vouch-community-grid"><div><h2>Experience reports ({reviews.length})</h2><p className="vouch-muted">Reports below are local demo submissions, not verified public reviews. Vouch cannot guarantee their accuracy.</p>
      <div className="vouch-stack">{reviews.length ? reviews.map(row=><article key={row.id} className="vouch-surface"><div className="vouch-post-meta"><strong>{row.author}</strong><span>{row.experience} · local demo</span></div><p className="vouch-review-text">{row.text}</p></article>) : <article className="vouch-surface"><p>No feedback has been submitted for this job in this demo.</p></article>}</div>
    </div><aside className="vouch-surface vouch-community-form"><h2>Share your experience</h2>
      <p className="vouch-muted">Only after finishing an eligible job. Don't include names, phone numbers, addresses, or private chats.</p>
      <form onSubmit={submit}><label className="vouch-field-label">How were the terms?<select value={rating} onChange={e=>setRating(e.target.value)}><option value="clear">Clear and respectful</option><option value="mixed">Some concerns</option><option value="difficult">Difficult experience</option></select></label>
        <VoiceField label="Your feedback" lang={lang} value={text} onChange={setText} rows={5} maxLength={1400} placeholder="Were the deadlines, scope, communication and payment terms clear?"/>
        <label className="vouch-inline-check"><input type="checkbox" checked={anonymous} onChange={e=>setAnonymous(e.target.checked)}/> Publish anonymously</label>
        {!canReview && <p className="vouch-muted">Complete the job in your Workroom before this form unlocks. You can browse feedback now.</p>}
        {error && <p className="vouch-form-error" role="alert">{error}</p>}
        <button type="submit" disabled={!canReview} className="vouch-button">{canReview ? 'Post feedback in this demo' : 'Available after completion'}</button></form>
      <p className="vouch-note vouch-muted">This front-end demo stores feedback only in this browser. A real public anonymous-review system requires server moderation, eligibility checks, privacy controls and an appeal process.</p>
    </aside></div>
  </section>;
}
