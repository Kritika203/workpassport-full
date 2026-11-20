// Synchronise account screens with the Django workspace.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, readApiSession } from '../api/client.js';
import { AccountStorageContext } from '../hooks/useLocalStorage.js';

export function AccountStorage({ user, initial, children, onSessionChange }) {
  const changes = useRef({});
  const active = useRef(true);
  const timer = useRef(null);
  const queue = useRef(Promise.resolve());
  const [problem, setProblem] = useState('');

  const flush = useCallback(() => {
    const updates = changes.current;
    changes.current = {};
    if (!Object.keys(updates).length) return queue.current;
    clearTimeout(timer.current);
    queue.current = queue.current.catch(() => {}).then(async () => {
      const session = readApiSession();
      if (!session) return;
      try {
        await api('/api/auth/workspace/', { method: 'PATCH', body: { updates } }, session, onSessionChange);
        if (active.current) setProblem('');
      } catch (error) {
        if (active.current) {
          // Keep unsaved changes available for retry instead of losing them silently.
          changes.current = { ...updates, ...changes.current };
          setProblem('Could not save changes. Check your connection, then choose Retry.');
        }
      }
    });
    return queue.current;
  }, [onSessionChange]);

  const save = useCallback((key, value) => {
    changes.current[key] = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 180);
  }, [flush]);

  useEffect(() => {
    active.current = true;
    return () => { clearTimeout(timer.current); flush(); active.current = false; };
  }, [flush]);

  return (
    <AccountStorageContext.Provider value={{ userId: user.id, initial, save, flush }}>
      {problem && (
        <div role="alert" className="fixed bottom-3 right-3 z-[100] bg-white border border-[#C73E33] text-[#AE332A] rounded-xl px-4 py-3 shadow-lg max-w-sm text-sm">
          {problem} <button className="underline font-semibold ml-2" onClick={flush}>Retry</button>
        </div>
      )}
      {children}
    </AccountStorageContext.Provider>
  );
}
