// Skill badges and safety switches.

import { Check } from 'lucide-react';



export function LevelBadge({ level, t }) {
  const style = level === 'self' ? 'bg-[#E7F0E9] text-[#475249] border border-[#E7F0E9]'
    : level === 'demonstrated' ? 'bg-[#FAF0EE] text-[#AE332A] border border-[#FAF0EE]'
    : 'bg-white text-[#141614] border border-[#141614]';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold ${style}`}>
      {(level === 'institution' || level === 'client' || level === 'platform') && <Check size={14} />}
      {t('pp_lvl_' + level)}
    </span>
  );
}

export function RuleToggle({ label, on, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between p-5 border border-[#E3E6E1] rounded-[14px] hover:border-[#DDD8CE] transition-colors bg-white min-h-[48px] text-left" role="switch" aria-checked={on}>
      <span className="text-base font-medium pr-4">{label}</span>
      <div className={`shrink-0 w-12 h-7 rounded-full flex items-center p-1 transition-colors ${on ? 'bg-[#003D14]' : 'bg-[#E3E6E1]'}`}>
        <div className={`w-5 h-5 bg-white rounded-full transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`}></div>
      </div>
    </button>
  );
}
