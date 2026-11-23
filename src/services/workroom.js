// Build a job's demo milestones.



import { deliverableText } from '../utils/deliverables.js';

export function buildWorkroomMilestones(job) {
  const raw = (job.deliverables && job.deliverables.length) ? job.deliverables : [job.title];
  const items = raw.map(deliverableText);
  const n = items.length;
  const base = Math.floor(job.budgetUSD / n);
  const extra = job.budgetUSD - base * n; // leftover whole dollars go to the first milestones, one each
  let left = job.budgetUSD;
  return items.map((title, i) => {
    const amt = i === n - 1 ? left : base + (i < extra ? 1 : 0); // the last milestone takes whatever remains
    left -= amt;
    return { id: `${job.id}-m${i + 1}`, title, amountUSD: amt, state: 'not_funded' };
  });
}
