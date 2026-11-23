import { Bell, ChevronDown, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NotificationBell, PassportShieldIcon } from './Header.jsx';
import './ShellHeader.css';

/** Compact, accessible navigation shared by workers and employers. */
export function ShellHeader({ mode = 'worker', lang = 'en', setLang, currentView, navTo, t,
  user, connected = false, sharedOn = false, onQuickHide, onLock,
  onLogout, onSwitch, onPost, onMessages, lowData, onToggleLowData }) {
  const [open, setOpen] = useState('');
  const root = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = event => { if (root.current && !root.current.contains(event.target)) setOpen(''); };
    const closeEscape = event => { if (event.key === 'Escape') setOpen(''); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape); };
  }, [open]);

  const isClient = mode === 'client';
  const words = lang === 'ne' ? {
    jobs: 'FirstWork', passport: 'मेरो WorkPassport', community: 'समुदाय', safety: 'WorkShield',
    dashboard: 'ड्यासबोर्ड', talent: 'फ्रिलान्सरहरू', inbox: 'सन्देश', more: 'थप',
    payments: 'भुक्तानी', extension: 'एक्सटेन्सन', learning: 'सीप विकास',
    post: 'काम पोस्ट गर्नुहोस्', switch: 'FirstWork मा जानुहोस्', logout: 'लग आउट',
    lowData: 'कम डाटा / ठूलो अक्षर', normal: 'सामान्य दृश्य', quickHide: 'छिटो लुकाउनुहोस्',
    lock: 'स्क्रिन लक गर्नुहोस्', account: 'खाता', menu: 'मेनु',
  } : {
    jobs: 'FirstWork', passport: 'My WorkPassport', community: 'Community', safety: 'WorkShield',
    dashboard: 'Dashboard', talent: 'Find talent', inbox: 'Messages', more: 'More',
    payments: 'Payments', extension: 'Extension', learning: 'SkillBridge',
    post: 'Post a job', switch: 'Switch to FirstWork', logout: 'Log out',
    lowData: 'Low data / larger text', normal: 'Standard view', quickHide: 'Quick hide',
    lock: 'Lock screen', account: 'Account', menu: 'Open menu',
  };
  const navigate = (view, params) => { setOpen(''); navTo(view, params); };
  const links = isClient ? [
    { label: words.dashboard, view: 'client', active: ['client', 'client-applicants', 'client-agreement'].includes(currentView) },
    { label: words.talent, view: 'client-explore', active: currentView === 'client-explore' },
    { label: words.community, view: 'community', active: currentView === 'community' },
    ...(connected ? [{ label: words.inbox, view: 'client-inbox', active: ['client-inbox', 'client-conversation', 'client-workroom'].includes(currentView), action: onMessages }] : []),
  ] : [
    { label: words.jobs, view: 'firstwork', active: ['firstwork', 'job-detail', 'apply', 'opportunities', 'bring', 'bring-queue'].includes(currentView) },
    { label: words.passport, view: 'passport', active: currentView === 'passport' },
    { label: words.community, view: 'community', active: currentView === 'community' },
    { label: words.safety, view: 'shield', active: currentView === 'shield' },
  ];
  const first = user?.name?.split(' ')[0] || (isClient ? 'Employer' : 'Member');
  const initials = first.trim().slice(0, 1).toUpperCase();
  const pick = item => { if (item.action) { setOpen(''); item.action(); } else navigate(item.view); };
  const toggle = id => setOpen(prev => prev === id ? '' : id);
  return <nav className="vouch-shell" aria-label={isClient ? 'Employer navigation' : 'Vouch navigation'} ref={root}>
    <div className="vouch-shell-inner">
      <button type="button" className="vouch-shell-logo" onClick={() => navigate(isClient ? 'client' : 'firstwork')} aria-label="WorkPassport home"><PassportShieldIcon color="#28563e" size={24}/><span>WorkPassport</span></button>
      <div className="vouch-shell-links">
        {links.map(item => <button key={item.view} type="button" onClick={() => pick(item)} className={item.active ? 'is-current' : ''} aria-current={item.active ? 'page' : undefined}>{item.label}</button>)}
      </div>
      <div className="vouch-shell-actions">
        <div className="vouch-shell-more">
          <button type="button" aria-expanded={open === 'more'} aria-haspopup="true" className="vouch-shell-secondary" onClick={() => toggle('more')}>{words.more}<ChevronDown size={15} aria-hidden="true"/></button>
          {open === 'more' && <div className="vouch-shell-popover vouch-shell-more-popover" role="menu">
            <button type="button" role="menuitem" onClick={() => navigate('payments')}>{words.payments}</button>
            {!isClient && <><button type="button" role="menuitem" onClick={() => navigate('skillbridge')}>{words.learning}</button><button type="button" role="menuitem" onClick={() => navigate('ext')}>{words.extension}</button></>}
            {isClient && <button type="button" role="menuitem" onClick={() => { setOpen(''); onPost?.(); }}>{words.post}</button>}
          </div>}
        </div>
        {!isClient && <NotificationBell t={t} priv={sharedOn} connected={connected} />}
        <button type="button" className="vouch-shell-language" onClick={() => setLang(lang === 'en' ? 'ne' : 'en')} title="Switch language" aria-label={lang === 'en' ? 'Switch to Nepali' : 'Switch to English'}>{lang === 'en' ? 'EN' : 'ने'}</button>
        <div className="vouch-shell-user">
          <button type="button" className="vouch-shell-user-button" aria-haspopup="true" aria-expanded={open === 'account'} onClick={() => toggle('account')}><span className="vouch-shell-avatar">{initials}</span><span className="vouch-shell-user-name">{first}</span><ChevronDown size={15} aria-hidden="true"/></button>
          {open === 'account' && <div className="vouch-shell-popover vouch-shell-account-menu" role="menu">
            <p className="vouch-shell-menu-heading">{first} · {words.account}</p>
            {!isClient && <button type="button" role="menuitem" onClick={() => navigate('passport')}>{words.passport}</button>}
            <button type="button" role="menuitem" aria-pressed={lowData} onClick={() => { onToggleLowData?.(); setOpen(''); }}>{lowData ? words.normal : words.lowData}</button>
            {sharedOn && onQuickHide && <button type="button" role="menuitem" onClick={() => { setOpen(''); onQuickHide(); }}>{words.quickHide}</button>}
            {sharedOn && onLock && <button type="button" role="menuitem" onClick={() => { setOpen(''); onLock(); }}>{words.lock}</button>}
            {isClient && <button type="button" role="menuitem" onClick={() => { setOpen(''); onSwitch?.(); }}>{words.switch}</button>}
            <button type="button" role="menuitem" className="vouch-shell-logout" onClick={() => { setOpen(''); onLogout?.(); }}>{words.logout}</button>
          </div>}
        </div>
        <button type="button" className="vouch-shell-hamburger" aria-label={open === 'mobile' ? 'Close menu' : words.menu} aria-expanded={open === 'mobile'} onClick={() => toggle('mobile')}>{open === 'mobile' ? <X size={20}/> : <Menu size={20}/>}</button>
      </div>
    </div>
    {open === 'mobile' && <div className="vouch-shell-mobile" role="menu">
      {links.map(item => <button type="button" role="menuitem" key={item.view} onClick={() => pick(item)}>{item.label}</button>)}
      <button type="button" role="menuitem" onClick={() => navigate('payments')}>{words.payments}</button>
      {!isClient && <><button type="button" role="menuitem" onClick={() => navigate('ext')}>{words.extension}</button><button type="button" role="menuitem" onClick={() => navigate('skillbridge')}>{words.learning}</button></>}
      {isClient && <button type="button" role="menuitem" onClick={() => { setOpen(''); onPost?.(); }}>{words.post}</button>}
      <button type="button" role="menuitem" aria-pressed={lowData} onClick={() => { onToggleLowData?.(); setOpen(''); }}>{lowData ? words.normal : words.lowData}</button>
    </div>}
  </nav>;
}
