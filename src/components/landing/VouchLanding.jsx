import { useState } from 'react';
import './vouch.css';

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
        <div className="vouch-cta-stack"><button type="button" className="vouch-button" onClick={onSignup}>{ne ? 'सुरु गर्नुहोस्' : 'Get started'} <span aria-hidden="true">→</span></button><button className="vouch-link" type="button" onClick={onDemo}>Continue Demo</button></div>
        {entryError && <p role="alert" className="vouch-form-error">{entryError}</p>}
      </div><aside className="vouch-hero-preview" aria-label="Example job experience"><div className="vouch-preview-top"><span>FIRSTWORK / JOB PREVIEW</span><span className="vouch-green-dot">Example</span></div><h2>Junior social media designer</h2><p>Remote · Project-based</p><div className="vouch-preview-details"><div><span>Budget</span><strong>NPR 18,000</strong></div><div><span>Deliverables</span><strong>3 social posts</strong></div><div><span>Timeline</span><strong>7 days</strong></div></div><div className="vouch-preview-bottom"><span>Understand the work before you agree to it.</span><span aria-hidden="true">↗</span></div></aside></div></section>
      <section className="vouch-steps" id="what"><div className="vouch-inner"><span className="vouch-eyebrow">A BETTER START</span><div className="vouch-step-row"><article><span>01</span><h2>Find an opportunity</h2><p>Browse entry-level work with clear expectations.</p></article><article><span>02</span><h2>Discuss the terms</h2><p>Ask questions, negotiate fairly, and plan the job.</p></article><article><span>03</span><h2>Keep the proof</h2><p>Save what you delivered and build experience.</p></article></div></div></section>
      <section className="vouch-short-section" id="trust"><div className="vouch-inner vouch-short-grid"><div><span className="vouch-eyebrow">BUILT AROUND TRUST</span><h2>A place to start, and a community to grow with.</h2></div><p>Vouch brings opportunities, safety guidance, peer experiences, and work records together. Women-first in its priorities, open to workers and employers who value respectful work.</p></div></section>
      <section className="vouch-short-section vouch-employer-section" id="employers"><div className="vouch-inner vouch-short-grid"><div><span className="vouch-eyebrow">FOR EMPLOYERS</span><h2>Better hiring begins with clarity.</h2></div><div><p>Post clear work, see applicants, discuss rates and coordinate deliverables without losing the business perspective.</p><button type="button" className="vouch-link" onClick={onClient}>Explore employer demo →</button></div></div></section>
    </main><footer className="vouch-footer"><div className="vouch-inner"><strong>vouch.</strong><span>Automated checks help spot risks; they cannot guarantee a job or employer is legitimate.</span></div></footer>
  </div>;
}
