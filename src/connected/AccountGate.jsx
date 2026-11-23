// Load the user's data before opening the usual Vouch screens.
import { useEffect, useState } from 'react';
import { api, listAll } from '../api/client.js';
import { DUMMY_JOBS } from '../data/jobs.js';
import { toUiJob as toAccountJob } from '../api/jobs.js';
import { MAYA_PROFILE } from '../data/demo.js';
import { AccountStorage } from './AccountStorage.jsx';
import { flow, flowList, toEvidence, toContribution } from '../api/flows.js';

const personPromiseSafePassport = session => api('/api/auth/passport/', {}, session).catch(() => null);

const makeProfile = (person) => ({
  name: person.display_name || person.username,
  district: '', workWanted: [], skills: [],
  safetyRules: { chat: true, calls: true, time: true, photo: true, hours: true },
  badge: 'Beginner', headline: '', about: person.bio || '', languages: ['Nepali', 'English'],
  availability: '', rateNote: '', tools: [], training: [],
});

export function AccountGate({ session, onSessionChange, onExit, children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        // Load the server-defined role before querying role-restricted endpoints.
        // Client accounts cannot use freelancer-only skills, applications or Passport
        // endpoints; calling them eagerly caused avoidable 403 Console errors.
        const person = await api('/api/auth/me/', {}, session, onSessionChange);
        const freelancer = person.role === 'freelancer';
        const [workspace, jobs, saved, applications, skills, samples, evidence, contributions, preferences, insights, proofs, checkins, checks, passport, completions] = await Promise.all([
          api('/api/auth/workspace/', {}, session, onSessionChange),
          listAll('/api/jobs/', session, onSessionChange),
          freelancer ? listAll('/api/me/saved-jobs/', session, onSessionChange).catch(() => []) : Promise.resolve([]),
          freelancer ? listAll('/api/me/applications/', session, onSessionChange).catch(() => []) : Promise.resolve([]),
          freelancer ? listAll('/api/auth/me/skills/', session, onSessionChange).catch(() => []) : Promise.resolve([]),
          freelancer ? listAll('/api/auth/me/work-samples/', session, onSessionChange).catch(() => []) : Promise.resolve([]),
          flowList('evidence/'),
          flowList('contributions/'),
          flow('safety/preferences/'),
          flowList('insights/approved/'),
          flow('proof/'),
          flowList('safety/checkins/'),
          flowList('shield/history/'),
          freelancer ? personPromiseSafePassport(session) : Promise.resolve(null),
          freelancer ? flow('passport/completions/').catch(() => ({ results: [] })) : Promise.resolve({ results: [] }),
        ]);
        // Client-owned jobs include pending and rejected entries; the public jobs API
        // deliberately excludes them. Always read from the ownership-scoped endpoint.
        const ownedJobs = person.role === 'client'
          ? await listAll('/api/client/jobs/', session, onSessionChange)
          : [];
        const mapping = Object.fromEntries(jobs.map(row => {
          const sample = DUMMY_JOBS.find(j => j.title === row.title);
          return [row.id, sample?.id || `api-${row.id}`];
        }));
        const state = { ...workspace.state };
        if (person.role === 'freelancer') {
          state.wp_user_profile = {
            ...makeProfile(person), ...(state.wp_user_profile || {}), ...(passport?.profile || {}),
          };
          state.wp_skill_levels = passport?.skill_levels || {};
          state.wp_confirmed = (completions.results || []).map(row => mapping[row.job_id] || `api-${row.job_id}`);
        } else {
          state.wp_user_profile = state.wp_user_profile || makeProfile(person);
          state.wp_client_mode = 'client';
          state.wp_client_jobs = ownedJobs.map(row => ({ ...toAccountJob(row),
            id: `api-${row.id}`, apiId: row.id, status: row.status,
            clientName: row.client_name, deadlineDays: row.deadline_days,
            meetingTimeNepal: row.meeting_pattern || 'To be agreed',
            aboutClient: row.status === 'published' ? 'Published listing' : 'Not publicly listed until reviewed',
          }));
          state.wp_client_profile = {
            name: person.display_name || person.username,
            business: person.business_name || '', town: person.town || '',
          };
        }
        if (!state.wp_language) state.wp_language = person.preferred_language === 'ne' ? 'ne' : 'en';
        // Use the dedicated backend records when available.
        if (Object.keys(proofs.proofs || {}).length) state.wp_skill_evidence = proofs.proofs;
        else if (state.wp_skill_evidence && Object.keys(state.wp_skill_evidence).length) {
          // Move older saved proof out of the workspace when first opening the updated app.
          try { await flow('proof/', { method: 'POST', body: { proofs: state.wp_skill_evidence } }); }
          catch { /* Old oversized photos stay available in the previous workspace. */ }
        }
        if (checkins.length) {
          const last = checkins[0];
          state.wp_checkin = {
            ...(state.wp_checkin || {}), byISO: last.scheduled_for,
            status: last.acknowledged_at ? 'safe' : 'waiting',
            backendId: last.id,
          };
        }
        state.wp_shield_history = checks.map(row => ({
          snippet: row.text_excerpt, verdict: row.risk, date: row.created_at,
        }));
        state.wp_evidence = evidence.map(toEvidence);
        state.wp_bring_submissions = contributions.map(toContribution);
        const approved = insights.map(toContribution);
        if (approved.length) state.wp_bring_submissions = [
          ...(state.wp_bring_submissions || []).filter(item => item.type !== 'insight' || item.status !== 'approved'),
          ...approved,
        ];
        state.wp_quiet = preferences.quiet_hours || {};
        state.wp_trusted_contact = preferences.trusted_contact || null;
        if (Object.keys(preferences.boundaries || {}).length && state.wp_user_profile)
          state.wp_user_profile = { ...state.wp_user_profile, safetyRules: preferences.boundaries };
        // Job records are authoritative in the database. Keep only harmless
        // presentation preferences in the old per-user workspace blob.
        state.wp_curated_jobs = [];
        state.wp_logged_in = true;
        state.wp_client_mode = person.role === 'client' ? 'client' : null;
        if (person.role !== 'client') state.wp_client_jobs = [];
        // The job APIs own these records, not a second browser-only list.
        state.wp_saved = saved.map(row => mapping[row.job.id] || `api-${row.job.id}`);
        state.wp_applied = applications.map(row => ({
          jobId: mapping[row.job] || `api-${row.job}`,
          price: Number(row.proposed_rate_usd), npr: Number(row.proposed_rate_usd) * 133,
          date: row.applied_at, apiApplicationId: row.id, status: row.status === 'submitted' ? 'waiting' : row.status,
          reason: row.decision_reason || '',
        }));
        if (live) { setData({ person, state, jobs }); setError(''); }
      } catch (err) { if (live) setError(err.message || 'Could not load your account.'); }
    })();
    return () => { live = false; };
  }, [session.access, attempt]);

  if (error) return <div className="min-h-screen bg-[#fcfbf8] p-12 text-center"><p role="alert">{error}</p><button className="underline m-4" onClick={() => setAttempt(n => n + 1)}>Retry</button><button className="underline m-4" onClick={onExit}>Sign out</button></div>;
  if (!data) return <div className="min-h-screen bg-[#fcfbf8] flex items-center justify-center" role="status">Opening your Vouch…</div>;
  return <AccountStorage key={data.person.id} user={data.person} initial={data.state} onSessionChange={onSessionChange}>
    {children(data.person, data.jobs)}
  </AccountStorage>;
}
