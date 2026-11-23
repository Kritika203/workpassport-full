// Navigation and header controls.

import { Bell, ChevronDown, Lock, LogOut, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { flow, flowList } from '../../api/flows.js';



export function LangToggle({ lang, setLang, compact = false }) {
  const opt = (code, label) => (
    <button
      key={code}
      onClick={() => setLang(code)}
      aria-pressed={lang === code}
      className={`relative rounded-full font-medium transition-all before:content-[''] before:absolute before:-inset-y-2 before:-inset-x-0.5 ${compact ? 'px-3 py-1.5 text-sm' : 'px-6 py-2 text-[15px] min-h-[44px]'} ${lang === code ? 'bg-white text-[#141614] shadow-[0_1px_2px_rgba(28,27,26,0.08)]' : 'text-[#70776F] hover:text-[#475249]'}`}
    >
      {label}
    </button>
  );
  return (
    <div className="inline-flex items-center gap-0.5 p-1 rounded-full bg-[#E7F0E9]">
      {opt('en', compact ? 'EN' : 'English')}
      {opt('ne', compact ? 'ने' : 'नेपाली')}
    </div>
  );
}

export function PassportShieldIcon({ color = "black", size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 10h6" />
      <path d="M9 14h6" />
    </svg>
  );
}

export function NavLink({ label, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`min-h-[48px] flex items-center whitespace-nowrap text-base font-medium border-b-2 transition-colors ${active ? 'border-[#003D14] text-[#354a37]' : 'border-transparent text-[#475249] hover:text-[#141614]'}`}
    >
      {label}
    </button>
  );
}

export function NotificationBell({ t, priv = false, connected = false }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(['nt_1', 'nt_2', 'nt_3']);
  const [remoteItems, setRemoteItems] = useState([]);
  useEffect(() => {
    if (!connected) return;
    let live = true;
    const refresh = () => flowList('notifications/').then(rows => {
      if (live) setRemoteItems(rows);
    }).catch(() => {});
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => { live = false; clearInterval(interval); };
  }, [connected]);
  const count = connected ? remoteItems.filter(item => !item.is_read).length : items.length;
  const read = async item => {
    try {
      await flow(`notifications/${item.id}/read/`, { method: 'POST' });
      setRemoteItems(prev => prev.map(row => row.id === item.id ? { ...row, is_read: true } : row));
    } catch (e) { /* Keep the unread message available if saving fails. */ }
  };
  const ref = useRef();
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={t('nt_title')} className="relative min-h-[48px] min-w-[44px] px-2 flex items-center justify-center rounded-full hover:bg-[#E7F0E9]">
        <Bell size={24} className="text-[#475249]" />
        {count > 0 && <div className="absolute top-3 right-2 w-2.5 h-2.5 bg-[#003D14] rounded-full ring-2 ring-[#FFFFFF]"></div>}
      </button>
      {open && (
        <div className="absolute right-[-72px] sm:right-0 mt-2 w-[min(340px,calc(100vw-32px))] bg-white border border-[#E3E6E1] rounded-[20px] shadow-[0_8px_24px_rgba(28,27,26,0.08)] overflow-hidden z-50" role="dialog" aria-label={t('nt_title')}>
          <div className="flex items-center justify-between gap-2 pl-5 pr-2 py-1 border-b border-[#E3E6E1]">
            <div>
              <div className="font-semibold text-base">{t('nt_title')}</div>
              <div className="text-[13px] text-[#687169]">{connected ? 'Account updates' : t('nt_demo')}</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label={t('pp_close')} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-[#F7F7F4]"><X size={20} /></button>
          </div>
          {priv ? (
            <p className="px-5 py-6 text-base text-[#141614]">{t('pv_notif_private')}</p>
          ) : connected ? (
            remoteItems.length === 0 ? <p className="px-5 py-6 text-base text-[#475249]">{t('nt_empty')}</p> :
            <ul className="divide-y divide-[#E3E6E1] max-h-[60vh] overflow-y-auto">
              {remoteItems.map(item => <li className="px-5 py-4" key={item.id}>
                <p className="text-base text-[#141614]">{item.message}</p>
                {!item.is_read && <button onClick={() => read(item)} className="min-h-[44px] mt-2 px-3 underline font-semibold">Mark read</button>}
              </li>)}
            </ul>
          ) : items.length === 0 ? (
            <p className="px-5 py-6 text-base text-[#475249]">{t('nt_empty')}</p>
          ) : (
            <ul className="divide-y divide-[#E3E6E1] max-h-[60vh] overflow-y-auto">
              {items.map(k => (
                <li key={k} className="px-5 py-4">
                  <p className="text-base text-[#141614] mb-2">{t(k)}</p>
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center rounded-full bg-[#E7F0E9] px-3 py-1 text-[13px] font-semibold text-[#687169]">{t('nt_demo')}</span>
                    <button onClick={() => setItems(prev => prev.filter(x => x !== k))} className="min-h-[44px] px-3 text-base font-semibold text-[#475249] underline underline-offset-4">{t('nt_dismiss')}</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function UserDropdown({ user, onLogout, t, navTo, lang, setLang, showLock = false, onLock }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  
  useEffect(() => {
    const handleClick = (e) => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!user) return null;
  const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 bg-[#F7F7F4] border border-[#E3E6E1] rounded-full pl-1.5 pr-3 py-1.5 hover:bg-[#EDEAE4] transition-colors min-h-[48px]">
        <div className="w-8 h-8 bg-[#FAF0EE] text-[#AE332A] rounded-full flex items-center justify-center text-sm font-semibold">{initials}</div>
        <div className="text-sm text-left hidden sm:block">
          <div className="font-semibold leading-tight text-[#141614]">{user.name.split(' ')[0]}</div>
          <div className="text-[#687169] leading-tight text-[13px]">{user.badge || "Beginner"}</div>
        </div>
        <ChevronDown size={16} className="text-[#475249]" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-[#E3E6E1] rounded-[16px] shadow-[0_8px_24px_rgba(28,27,26,0.08)] overflow-hidden z-50">
          <div className="px-5 py-4 border-b border-[#E3E6E1] sm:hidden">
            <div className="font-semibold text-[#141614] text-lg">{user.name}</div>
            <div className="text-sm text-[#70776F]">{user.badge || "Beginner"}</div>
          </div>
          <button onClick={() => { navTo('passport'); setOpen(false); }} className="w-full text-left px-5 py-4 min-h-[48px] text-base text-[#475249] hover:bg-[#F7F7F4] border-b border-[#E3E6E1]">{t('nav_passport')}</button>
          <button onClick={() => { setLang(lang === 'en' ? 'ne' : 'en'); setOpen(false); }} className="w-full text-left px-5 py-4 min-h-[48px] text-base text-[#475249] hover:bg-[#F7F7F4] border-b border-[#E3E6E1]">Language: {lang === 'en' ? 'नेपाली' : 'English'}</button>
          {showLock && <button onClick={() => { setOpen(false); onLock(); }} className="w-full text-left px-5 py-4 min-h-[48px] text-base text-[#475249] hover:bg-[#F7F7F4] border-b border-[#E3E6E1] flex items-center gap-3"><Lock size={20} /> {t('pv_lock_now')}</button>}
          <button onClick={() => { onLogout(); setOpen(false); }} className="w-full text-left px-5 py-4 min-h-[48px] text-base text-[#AE332A] hover:bg-[#F7F7F4] flex items-center gap-3 font-semibold"><LogOut size={20}/> {t('nav_logout')}</button>
        </div>
      )}
    </div>
  );
}
