import { useState } from 'react';
import './vouch.css';
import { LandingContinuation } from './LandingContinuation.jsx';

// Deliberately restrained: no decorative photography, badges or feature-icon wall.
export function VouchLanding({ lang = 'en', onLanguage, onLogin, onSignup, onDemo, onClient, entryError }) {
  const [menu, setMenu] = useState(false);
  const ne = lang === 'ne';
  return <div className="vouch-public">
    <header className="vouch-header"><div className="vouch-header-inner">
      <a className="vouch-brand" href="#home">vouch<span>.</span></a>
      <nav className={menu ? 'vouch-nav open' : 'vouch-nav'} aria-label="Main navigation"><a href="#what" onClick={()=>setMenu(false)}>How it works</a><a href="#trust" onClick={()=>setMenu(false)}>Why Vouch</a><a href="#employers" onClick={()=>setMenu(false)}>For employers</a></nav>
      <div className="vouch-header-actions"><button className="vouch-header-text" type="button" onClick={onLogin}>{ne ? 'लग इन' : 'Log in'}</button><button type="button" className="vouch-header-cta" onClick={onSignup}>{ne ? 'खाता बनाउनुहोस्' : 'Create account'}</button><button className="vouch-language" type="button" title="Switch language" onClick={()=>onLanguage(lang === 'en' ? 'ne' : 'en')}>{lang === 'en' ? 'ने' : 'EN'}</button><button className="vouch-mobile-menu" aria-expanded={menu} aria-label="Toggle menu" type="button" onClick={()=>setMenu(p=>!p)}>Menu</button></div>
    </div></header>
    <main id="home">
      <section className="vouch-hero"><div className="vouch-hero-grid"><div className="vouch-hero-main"><span className="vouch-eyebrow">WORK · SAFETY · COMMUNITY</span>
        <h1>{ne ? 'तपाईंको पहिलो अवसर।' : 'Your first opportunity.'}<em>{ne ? 'तपाईंको आफ्नै शर्तमा।' : 'On clearer terms.'}</em></h1>
        <p>{ne ? 'नेपालका नयाँ कामदारका लागि: काम खोज्नुहोस्, शर्त बुझ्नुहोस् र आफ्नो कामको प्रमाण राख्नुहोस्।' : 'Find work, understand the terms, and build a record of what you do. Made for people finding their way into work in Nepal.'}</p>
        <div className="vouch-cta-stack"><button type="button" className="vouch-button" onClick={onSignup}>{ne ? 'सुरु गर्नुहोस्' : 'Get started'} <span aria-hidden="true">→</span></button><div className="flex flex-wrap items-center gap-x-6 gap-y-3"><button className="vouch-link" type="button" onClick={onDemo}>{ne ? 'माया डेमो' : 'Continue Demo (Maya)'}</button><button className="vouch-link" type="button" onClick={onClient}>{ne ? 'रोजगारदाता डेमो (बिकाश)' : 'Employer Demo (Bikash)'}</button></div></div>
        {entryError && <p role="alert" className="vouch-form-error">{entryError}</p>}
      </div><aside className="vouch-hero-preview" aria-label="Example job experience"><div className="vouch-preview-top"><span>FIRSTWORK / JOB PREVIEW</span><span className="vouch-green-dot">Example</span></div><h2>Junior social media designer</h2><p>Remote · Project-based</p><div className="vouch-preview-details"><div><span>Budget</span><strong>NPR 18,000</strong></div><div><span>Deliverables</span><strong>3 social posts</strong></div><div><span>Timeline</span><strong>7 days</strong></div></div><div className="vouch-preview-bottom"><span>Understand the work before you agree to it.</span><span aria-hidden="true">↗</span></div></aside></div></section>
      <section className="vouch-steps" id="what"><div className="vouch-inner"><span className="vouch-eyebrow">A BETTER START</span><div className="vouch-step-row" aria-label="Three steps to a better start"><article tabIndex={0}><span>01</span><h2>Find an opportunity</h2><p>Browse entry-level work with clear expectations.</p></article><article tabIndex={0}><span>02</span><h2>Discuss the terms</h2><p>Ask questions, negotiate fairly, and plan the job.</p></article><article tabIndex={0}><span>03</span><h2>Keep the proof</h2><p>Save what you delivered and build experience.</p></article></div></div></section>
      <section className="vouch-short-section" id="trust"><div className="vouch-inner vouch-short-grid"><div><span className="vouch-eyebrow">PEOPLE FIRST · WOMEN FIRST</span><h2>{ne ? 'समुदायसँगै अगाडि बढ्नुहोस्।' : 'Community makes a first step easier.'}</h2></div><p>{ne ? 'साथीहरूको अनुभवबाट सिक्नुहोस्, सुरक्षित कामबारे प्रश्न गर्नुहोस् र आत्मविश्वास बढाउनुहोस्।' : 'Ask better questions, learn from shared experiences and build confidence. Women-first in priorities, without leaving workers or employers out.'}</p></div></section>
      <LandingContinuation lang={lang} onSignup={onSignup} onLogin={onLogin} onDemo={onDemo} onClient={onClient}/>
    </main>
  </div>;
}
