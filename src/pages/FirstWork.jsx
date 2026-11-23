// FirstWork: an uncluttered job board, with advanced filters available on demand.
import { Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { JobCard } from '../components/jobs/JobCard.jsx';
import { ALL_CATEGORIES, ALL_SKILLS } from '../data/demo.js';
import { DUMMY_JOBS } from '../data/jobs.js';
import './FirstWorkVouch.css';

const sorts = [
  ['Best match for me', 'sort_best'], ['Newest', 'sort_new'],
  ['Budget: High to Low', 'sort_high'], ['Budget: Low to High', 'sort_low'], ['Best skill match', 'sort_match'],
];
const budgets = [['All','budget_all'], ['fixed','budget_fixed'], ['hourly','budget_hourly']];
const strings = {
  en: { jobs: 'Jobs', filters: 'Filters', category: 'Category', budget: 'Budget type', skills: 'Skills', preferences: 'Preferences', applied: 'My applications', client: 'Posting a job?', bring: 'Share an opportunity', clear: 'Clear all', show: 'Show jobs', result: 'opportunities', results: 'jobs available', verified: 'Payment verified', note: 'Automated screening is not a guarantee of safety or payment.', searchSkill: 'Find a skill', noMatch: 'No jobs match your current filters.' },
  ne: { jobs: 'कामहरू', filters: 'फिल्टर', category: 'वर्ग', budget: 'भुक्तानी प्रकार', skills: 'सीप', preferences: 'प्राथमिकता', applied: 'मेरो आवेदन', client: 'काम पोस्ट गर्ने?', bring: 'कामको अवसर साझा गर्नुहोस्', clear: 'सबै हटाउनुहोस्', show: 'काम हेर्नुहोस्', result: 'अवसरहरू', results: 'काम उपलब्ध', verified: 'भुक्तानी पुष्टि भएको', note: 'स्वचालित जाँचले रोजगारी वा भुक्तानी सुरक्षित भएको ग्यारेन्टी गर्दैन।', searchSkill: 'सीप खोज्नुहोस्', noMatch: 'यी फिल्टरसँग मिल्ने काम छैन।' },
};
export function FirstWorkFeed({ t, navTo, user, savedJobs, setSavedJobs, lang, allJobs = DUMMY_JOBS, lowdata = false, onSwitchClient = () => {} }) {
  const copy = strings[lang] || strings.en;
  const [search,setSearch] = useState('');
  const [category,setCategory] = useState('All');
  const [skills,setSkills] = useState([]);
  const [skillQuery,setSkillQuery] = useState('');
  const [budget,setBudget] = useState('All');
  const [beginner,setBeginner] = useState(false);
  const [verified,setVerified] = useState(false);
  const [match,setMatch] = useState(false);
  const [sort,setSort] = useState('Best match for me');
  const [showFilters,setShowFilters] = useState(false);
  const filterClose = useRef(null);
  useEffect(() => { if (showFilters) filterClose.current?.focus(); }, [showFilters]);
  const userSkills = user?.skills || [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = allJobs.filter(job => {
      const required = Array.isArray(job.skillsRequired) ? job.skillsRequired : [];
      if(q && ![job.title || '',job.clientName || '',...required].some(s=>String(s).toLowerCase().includes(q)))return false;
      if(category !== 'All' && job.category !== category)return false;
      if(skills.length && !skills.some(s=>required.includes(s)))return false;
      if(budget !== 'All' && job.budgetType !== budget)return false;
      if(beginner && !job.beginnerFriendly)return false;
      if(verified && !job.paymentVerified)return false;
      if(match && !required.some(s=>userSkills.includes(s)))return false;
      return true;
    });
    const count = j=>(j.skillsRequired || []).filter(s=>userSkills.includes(s)).length;
    const score = j => { const n=count(j); return n && n===(j.skillsRequired||[]).length?1000+n:n; };
    result.sort((a,b)=>{
      if(sort==='Newest')return (a.postedHoursAgo||0)-(b.postedHoursAgo||0);
      if(sort==='Budget: High to Low')return (b.budgetUSD||0)-(a.budgetUSD||0);
      if(sort==='Budget: Low to High')return (a.budgetUSD||0)-(b.budgetUSD||0);
      if(sort==='Best skill match')return count(b)-count(a);
      return score(b)-score(a)||(a.postedHoursAgo||0)-(b.postedHoursAgo||0);
    });
    return result;
  },[allJobs,search,category,skills,budget,beginner,verified,match,sort,userSkills]);
  const activeCount=skills.length+Number(budget!=='All')+Number(beginner)+Number(verified)+Number(match);
  const clear=()=>{setSearch('');setCategory('All');setSkills([]);setBudget('All');setBeginner(false);setVerified(false);setMatch(false);setSkillQuery('');setSort('Best match for me');};
  const chipData=[
    ...(category!=='All'?[{value:category,remove:()=>setCategory('All')}]:[]),
    ...(budget!=='All'?[{value:budget==='fixed'?t('budget_fixed'):t('budget_hourly'),remove:()=>setBudget('All')}]:[]),
    ...skills.map(value=>({value,remove:()=>setSkills(prev=>prev.filter(x=>x!==value))})),
    ...(beginner?[{value:t('tog_beginner'),remove:()=>setBeginner(false)}]:[]),
    ...(verified?[{value:t('tog_verified'),remove:()=>setVerified(false)}]:[]),
    ...(match?[{value:t('tog_match'),remove:()=>setMatch(false)}]:[]),
  ];
  return <section className="fw-vouch" lang={lang} aria-labelledby="fw-vouch-title">
    <div className="fw-vouch-heading"><div><span className="fw-vouch-eyebrow">FIRSTWORK</span><h1 id="fw-vouch-title">{t('fw_title')}</h1><p>{t('fw_sub')}</p></div></div>
    <nav className="fw-vouch-tabs" aria-label="FirstWork views"><button type="button" aria-current="page">{copy.jobs}</button><button type="button" onClick={()=>navTo('opportunities')}>{copy.applied}</button></nav>
    <div className="fw-vouch-toolbar"><label className="fw-vouch-search"><Search size={19} aria-hidden="true"/><span className="sr-only">{t('search_placeholder')}</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('search_placeholder')}/></label>
      <label className="fw-vouch-select"><span className="sr-only">{copy.category}</span><select value={category} onChange={e=>setCategory(e.target.value)}><option value="All">{t('cat_all')}</option>{ALL_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select><ChevronDown size={15} aria-hidden="true"/></label>
      <button className="fw-vouch-filter-button" type="button" aria-expanded={showFilters} onClick={()=>setShowFilters(true)}><SlidersHorizontal size={17}/>{copy.filters}{activeCount>0&&<span className="fw-vouch-filter-count">{activeCount}</span>}</button>
      <label className="fw-vouch-select"><span className="sr-only">{t('sort_by')}</span><select value={sort} onChange={e=>setSort(e.target.value)}>{sorts.map(([value,key])=><option key={value} value={value}>{t(key)}</option>)}</select><ChevronDown size={15} aria-hidden="true"/></label>
    </div>
    {chipData.length>0&&<div className="fw-vouch-chips" aria-label={copy.filters}>{chipData.map(chip=><button key={chip.value} type="button" onClick={chip.remove}>{chip.value} <X size={14} aria-hidden="true"/></button>)}<button className="fw-vouch-clear" onClick={clear} type="button">{copy.clear}</button></div>}
    <div className="fw-vouch-result-line"><p role="status"><strong>{filtered.length}</strong> {copy.results}</p><p>{copy.note}</p></div>
    {lowdata&&<p className="fw-vouch-lowdata">{t('ld_on_line')}</p>}
    <div className="fw-vouch-feed">{filtered.length?filtered.map(job=><JobCard key={job.id} job={job} t={t} navTo={navTo} saved={savedJobs.includes(job.id)} onToggleSave={()=>setSavedJobs(prev=>prev.includes(job.id)?prev.filter(x=>x!==job.id):[...prev,job.id])} lang={lang} compact={lowdata}/>):<div className="fw-vouch-empty"><Search size={26} aria-hidden="true"/><h2>{copy.noMatch}</h2><button type="button" onClick={clear}>{t('clear_filters')}</button></div>}</div>
    {showFilters&&<div className="fw-vouch-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setShowFilters(false);}}><div className="fw-vouch-filter-panel" role="dialog" aria-modal="true" aria-labelledby="fw-filter-title" onKeyDown={e=>{if(e.key==='Escape')setShowFilters(false);}}><div className="fw-vouch-filter-heading"><h2 id="fw-filter-title">{copy.filters}</h2><button ref={filterClose} type="button" onClick={()=>setShowFilters(false)} aria-label="Close filters"><X size={20}/></button></div>
      <fieldset><legend>{copy.budget}</legend><div className="fw-vouch-filter-choices">{budgets.map(([value,key])=><label key={value}><input name="fw-budget" type="radio" checked={budget===value} onChange={()=>setBudget(value)}/>{t(key)}</label>)}</div></fieldset>
      <fieldset><legend>{copy.skills}</legend><input className="fw-vouch-skill-search" value={skillQuery} onChange={e=>setSkillQuery(e.target.value)} placeholder={copy.searchSkill}/><div className="fw-vouch-filter-choices fw-vouch-skill-list">{ALL_SKILLS.filter(s=>s.toLowerCase().includes(skillQuery.trim().toLowerCase())).map(s=><label key={s}><input type="checkbox" checked={skills.includes(s)} onChange={e=>setSkills(prev=>e.target.checked?[...prev,s]:prev.filter(x=>x!==s))}/>{s}</label>)}</div></fieldset>
      <fieldset><legend>{copy.preferences}</legend><div className="fw-vouch-filter-choices"><label><input type="checkbox" checked={beginner} onChange={e=>setBeginner(e.target.checked)}/>{t('tog_beginner')}</label><label><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>{t('tog_verified')}</label><label><input type="checkbox" checked={match} onChange={e=>setMatch(e.target.checked)}/>{t('tog_match')}</label></div></fieldset>
      <div className="fw-vouch-filter-footer"><button type="button" onClick={clear}>{copy.clear}</button><button type="button" onClick={()=>setShowFilters(false)}>{copy.show} ({filtered.length})</button></div>
    </div></div>}
  </section>;
}
