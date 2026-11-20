// Save demo data in this browser and account data through Django.
import { createContext, useContext, useRef, useState } from 'react';

// Only device preferences and unfinished drafts belong in workspace JSON.
const LOCAL_WORKSPACE_KEYS = new Set([
  'wp_pay_checklist', 'wp_chat_drafts', 'wp_apply_draft', 'wp_language',
  'wp_client_mode',
]);

export const AccountStorageContext = createContext(null);

export function useLocalStorage(key, initialValue) {
  const account = useContext(AccountStorageContext);
  const [storedValue, setStoredValue] = useState(() => {
    if (account) {
      if (key === 'wp_settings') {
        try { return JSON.parse(localStorage.getItem(`wp_device_${account.userId}_settings`) || 'null') || initialValue; }
        catch { return initialValue; }
      }
      return Object.prototype.hasOwnProperty.call(account.initial, key) ? account.initial[key] : initialValue;
    }
    // Never let browser data from an old demo sign a guest in automatically.
    if (key === 'wp_logged_in' || key === 'wp_client_mode') return initialValue;
    try {
      const text = localStorage.getItem(key);
      return text === null ? initialValue : JSON.parse(text);
    } catch { return initialValue; }
  });
  const valueRef = useRef(storedValue);
  valueRef.current = storedValue;
  const setValue = (value) => {
    const next = typeof value === 'function' ? value(valueRef.current) : value;
    valueRef.current = next;
    setStoredValue(next);
    if (account) {
      if (key === 'wp_settings') {
        // The quick-lock PIN belongs to the device, not the remote account.
        try { localStorage.setItem(`wp_device_${account.userId}_settings`, JSON.stringify(next)); }
        catch (error) { console.error('Could not save device privacy settings.', error); }
      } else if (LOCAL_WORKSPACE_KEYS.has(key)) {
        account.save(key, next);
      }
    } else {
      try { localStorage.setItem(key, JSON.stringify(next)); }
      catch (error) { console.error('Could not save browser settings.', error); }
    }
  };
  return [storedValue, setValue];
}
