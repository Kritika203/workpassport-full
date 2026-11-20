// API calls for features shared between freelancers and clients.
import { api, listAll, readApiSession } from './client.js';

export const flow = (path, options) => api(`/api/flows/${path}`, options, readApiSession());
export const flowList = (path) => listAll(`/api/flows/${path}`, readApiSession());

export function toEvidence(row) {
  return {
    id: row.id, text: row.text, categories: row.categories || [],
    source: row.source, jobTitle: row.job_title || '', clientName: row.client_name || '',
    date: row.created_at,
  };
}

export function toContribution(row) {
  return { ...row.payload, id: `server-${row.id}`, backendId: row.id,
    type: row.kind, status: row.status, date: row.created_at };
}

export function toMessage(row, freelancerId, myId) {
  return { id: row.id, text: row.text,
    from: row.sender_id === myId ? 'me' : 'client', ts: Date.parse(row.created_at) || Date.now(),
    actualSenderId: row.sender_id, freelancerId };
}
