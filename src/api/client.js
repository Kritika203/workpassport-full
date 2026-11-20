// Requests for the Django-connected account.

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const SESSION_KEY = 'wp_api_session';
let refreshInProgress = null;

export function readApiSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    return value && typeof value.access === 'string' && typeof value.refresh === 'string' ? value : null;
  } catch {
    return null;
  }
}

export function storeApiSession(session) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Private browsing can restrict storage.
  }
}

function messageFromError(data, status) {
  if (typeof data?.detail === 'string') return data.detail;
  if (typeof data?.message === 'string') return data.message;
  if (data && typeof data === 'object') {
    const field = Object.keys(data).find(key => key !== 'status');
    if (field) {
      const info = data[field];
      return `${field}: ${Array.isArray(info) ? info.join(', ') : String(info)}`;
    }
  }
  return status === 0 ? 'Could not connect to WorkPassport. Please try again.' : `Request failed (${status}).`;
}

async function send(path, { method = 'GET', body, access } = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    const err = new Error('Could not connect to WorkPassport. Please check your connection and try again.');
    err.status = 0;
    throw err;
  }
  let data = null;
  if (response.status !== 204) {
    const text = await response.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  }
  if (!response.ok) {
    const error = new Error(messageFromError(data, response.status));
    error.status = response.status;
    throw error;
  }
  return data;
}

async function refreshTokens(current, onSessionChange) {
  if (!refreshInProgress) {
    refreshInProgress = send('/api/auth/refresh/', {
      method: 'POST', body: { refresh: current.refresh },
    }).finally(() => { refreshInProgress = null; });
  }
  const data = await refreshInProgress;
  const next = { ...current, access: data.access, refresh: data.refresh || current.refresh };
  storeApiSession(next);
  onSessionChange?.(next);
  return next;
}

export async function api(path, options = {}, session, onSessionChange) {
  if (!session) return send(path, options);
  try {
    return await send(path, { ...options, access: session.access });
  } catch (error) {
    if (error.status !== 401 || !session.refresh) throw error;
    let next;
    try {
      const latest = readApiSession();
      // Another request may have refreshed the session already.
      next = latest && latest.access !== session.access ? latest : await refreshTokens(session, onSessionChange);
    }
    catch {
      storeApiSession(null);
      onSessionChange?.(null);
      const expired = new Error('Your session expired. Please sign in again.');
      expired.status = 401;
      throw expired;
    }
    return send(path, { ...options, access: next.access });
  }
}

export async function listAll(path, session, onSessionChange) {
  let url = path;
  const records = [];
  for (let page = 0; url && page < 20; page += 1) {
    // The API supplies a next URL for each page.
    const data = await api(url, {}, session, onSessionChange);
    if (Array.isArray(data)) return records.concat(data);
    records.push(...(data.results || []));
    const next = data.next;
    if (!next) break;
    const parsed = new URL(next, BASE);
    if (parsed.origin !== new URL(BASE).origin) throw new Error('Invalid pagination URL.');
    url = parsed.pathname + parsed.search;
  }
  return records;
}

export async function apiLogout(session) {
  if (!session?.refresh) return;
  try { await send('/api/auth/logout/', { method: 'POST', body: { refresh: session.refresh }, access: session.access }); }
  catch { /* Still sign out locally if the backend is unavailable. */ }
}
