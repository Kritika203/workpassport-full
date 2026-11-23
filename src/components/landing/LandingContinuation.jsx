import { useState } from 'react';
import { analyzeText, SHIELD_EXAMPLES, verdictOf } from '../../services/safety.js';
import './LandingContinuation.css';

/** Adapted from the reference's moving editorial cards, not its page layout. */
const copy = {
  en: {
    label: 'THE WAY FORWARD',
    highlights: [
      ['Beginner-first', 'Jobs with clearer expectations and room to learn.'],
      ['Levels of proof', 'See who added or confirmed each piece of work.'],
      ['Safer choices', 'Check warning signs before you commit to a job.'],
      ['Clearer terms', 'Talk about scope, payment and expectations early.'],
    ],
    pause: 'Pause movement', play: 'Resume movement',
    proofTag: 'LEVELS OF PROOF', proofTitle: 'Your work can speak for itself.',
    proofIntro: 'A WorkPassport shows where evidence came from. Not every entry has the same level of confirmation.',
    levels: [
      ['01', 'Self-added', 'Your own samples, projects and links. Clearly labelled as not yet confirmed.'],
      ['02', 'Client-confirmed', 'Work reviewed and accepted through a shared Workroom.'],
      ['03', 'Institution-verified', 'Training records confirmed by an eligible education or training partner.'],
    ],
    safetyTag: 'WORKSHIELD', safetyTitle: 'A second look before you say yes.',
    safetyIntro: 'Paste a message or job post. Get plain-language warning signs, not a guarantee of safety.',
    sample: 'Try a sample message', placeholder: 'Paste a message or job post here…',
    check: 'Check the message', verdict: { danger: 'Danger signs detected', warning: 'Some warning signs', ok: 'No obvious danger signs', unknown: 'Not enough information' },
    verdictNote: 'This quick check is only a guide. It does not verify an employer or a payment.',
    insideTag: 'INSIDE WORKPASSPORT', insideTitle: 'The essentials stay together.',
    inside: [
      ['FirstWork', 'Find and compare opportunities.'],
      ['Guided Apply', 'Explain your skills and discuss a fair rate.'],
      ['Workroom', 'Agree on milestones and keep records of delivery.'],
      ['Evidence Vault', 'Keep screenshots and important promises together.'],
      ['SkillBridge', 'See skill gaps and places to start learning.'],
      ['Shared-device tools', 'Keep private information hidden on a shared screen.'],
    ],
    endingTag: 'START WHERE YOU ARE', endingTitle: 'Your first opportunity should open doors.',
    endingText: 'Find work, ask questions and build a WorkPassport you can carry into your next opportunity.',
    create: 'Create an account', demo: 'Continue Demo',
    footer: 'Work that is clearer, safer and more respectful. Women-first in its priorities, open to all.',
    workers: 'For workers', employers: 'For employers', links: 'Explore',
    jobs: 'Find jobs', safety: 'WorkShield', how: 'How it works', employersDemo: 'Employer demo', login: 'Log in', signup: 'Create account',
  },
  ne: {
    label: 'अगाडिको बाटो',
    highlights: [
      ['नयाँ कामदारलाई प्राथमिकता', 'स्पष्ट अपेक्षा र सिक्ने अवसर भएका काम।'],
      ['प्रमाणका तह', 'प्रमाण कसले राख्यो वा पुष्टि गर्‍यो थाहा पाउनुहोस्।'],
      ['सुरक्षित निर्णय', 'काम स्वीकार्नुअघि जोखिमका संकेत जाँच्नुहोस्।'],
      ['स्पष्ट सहमति', 'काम, रकम र अपेक्षाबारे सुरुमा कुरा गर्नुहोस्।'],
    ],
    pause: 'चल्न रोक्नुहोस्', play: 'फेरि चलाउनुहोस्',
    proofTag: 'प्रमाणका तह', proofTitle: 'तपाईंको कामले तपाईंलाई चिनाओस्।',
    proofIntro: 'WorkPassport मा प्रमाण कहाँबाट आयो देखिन्छ। हरेक प्रमाणको पुष्टि एउटै स्तरमा हुँदैन।',
    levels: [
      ['01', 'आफैंले थपेको', 'आफ्ना नमुना, काम र लिङ्क। अझै पुष्टि नभएको भनेर देखिन्छ।'],
      ['02', 'ग्राहकले पुष्टि गरेको', 'Workroom मा ग्राहकले समीक्षा गरी स्वीकृत गरेको काम।'],
      ['03', 'संस्थाले पुष्टि गरेको', 'योग्य साझेदार संस्था वा तालिम केन्द्रबाट पुष्टि भएको तालिम।'],
    ],
    safetyTag: 'WorkShield', safetyTitle: 'सहमत हुनुअघि एकपटक जाँच्नुहोस्।',
    safetyIntro: 'सन्देश वा कामको पोस्ट राख्नुहोस्। सामान्य भाषामा जोखिमका संकेत हेर्नुहोस्।',
    sample: 'नमुना सन्देश', placeholder: 'यहाँ सन्देश वा कामको पोस्ट राख्नुहोस्…',
    check: 'सन्देश जाँच्नुहोस्', verdict: { danger: 'खतराका संकेत भेटिए', warning: 'केही चेतावनी संकेत छन्', ok: 'स्पष्ट खतरा देखिएन', unknown: 'पर्याप्त जानकारी छैन' },
    verdictNote: 'यो जाँच सुझाव मात्रै हो। यसले रोजगारदाता वा भुक्तानी प्रमाणित गर्दैन।',
    insideTag: 'WorkPassport भित्र', insideTitle: 'आवश्यक कुराहरू एकै ठाउँमा।',
    inside: [
      ['FirstWork', 'काम खोज्नुहोस् र तुलना गर्नुहोस्।'],
      ['Guided Apply', 'सीप देखाउनुहोस् र उचित दरबारे कुरा गर्नुहोस्।'],
      ['Workroom', 'कामका चरण र डेलिभरीको प्रमाण राख्नुहोस्।'],
      ['Evidence Vault', 'स्क्रिनसट र महत्त्वपूर्ण सहमति सुरक्षित राख्नुहोस्।'],
      ['SkillBridge', 'कुन सीप सिक्ने र कहाँ सिक्ने जान्नुहोस्।'],
      ['साझा डिभाइस सुरक्षा', 'साझा स्क्रिनमा निजी जानकारी लुकाउनुहोस्।'],
    ],
    endingTag: 'आजै सुरुवात', endingTitle: 'तपाईंको पहिलो अवसरले नयाँ बाटो खोलोस्।',
    endingText: 'काम खोज्नुहोस्, प्रश्न सोध्नुहोस् र अगाडिको अवसरका लागि WorkPassport बनाउनुहोस्।',
    create: 'खाता बनाउनुहोस्', demo: 'डेमो हेर्नुहोस्',
    footer: 'स्पष्ट, सुरक्षित र सम्मानजनक कामका लागि। महिलालाई प्राथमिकता, सबैका लागि खुला।',
    workers: 'काम खोज्नेका लागि', employers: 'रोजगारदाताका लागि', links: 'हेर्नुहोस्',
    jobs: 'काम खोज्नुहोस्', safety: 'WorkShield', how: 'कसरी काम गर्छ', employersDemo: 'रोजगारदाता डेमो', login: 'लग इन', signup: 'खाता बनाउनुहोस्',
  },
};

export function LandingContinuation({ lang = 'en', onSignup, onDemo, onClient, onLogin }) {
  const t = copy[lang] || copy.en;
  const [paused, setPaused] = useState(false);
  const [sample, setSample] = useState('');
  const [result, setResult] = useState(null);
  const check = event => { event.preventDefault(); if (sample.trim().length < 8) { setResult({ verdict: 'unknown', findings: [] }); return; }
    const f = analyzeText(sample); setResult({ verdict: verdictOf(f), findings: [...f.red, ...f.yellow] }); };
  return <>
    <section className="vouch-marquee-section" aria-label={t.label}>
      <div className="vouch-inner vouch-marquee-heading"><span className="vouch-eyebrow">{t.label}</span><button type="button" onClick={() => setPaused(p => !p)} aria-pressed={paused}>{paused ? t.play : t.pause}</button></div>
      <div className={`vouch-marquee ${paused ? 'is-paused' : ''}`}>
        <div className="vouch-marquee-track">
          {[0, 1].map(copyNumber => <ul key={copyNumber} aria-hidden={copyNumber === 1 ? 'true' : undefined}>
            {t.highlights.map(([heading, description], i) => <li key={i}><span className="vouch-marquee-number">0{i + 1}</span><h3>{heading}</h3><p>{description}</p></li>)}
          </ul>)}
        </div>
      </div>
    </section>
    <section className="vouch-cont-section" id="passport-proof"><div className="vouch-inner">
      <span className="vouch-eyebrow">{t.proofTag}</span><h2>{t.proofTitle}</h2><p className="vouch-cont-lead">{t.proofIntro}</p>
      <div className="vouch-cont-proofs">{t.levels.map(([n, heading, description]) => <article key={n}><span>{n}</span><h3>{heading}</h3><p>{description}</p></article>)}</div>
    </div></section>
    <section className="vouch-cont-section vouch-cont-safety" id="safety"><div className="vouch-inner vouch-cont-safety-grid">
      <div><span className="vouch-eyebrow">{t.safetyTag}</span><h2>{t.safetyTitle}</h2><p className="vouch-cont-lead">{t.safetyIntro}</p></div>
      <form className="vouch-cont-checker" onSubmit={check}>
        <label htmlFor="vouch-landing-message">{t.check}</label><textarea id="vouch-landing-message" rows={4} value={sample} onChange={e => { setSample(e.target.value); setResult(null); }} placeholder={t.placeholder} />
        <div className="vouch-cont-checker-actions"><button type="button" className="vouch-cont-sample" onClick={() => { setSample(SHIELD_EXAMPLES[0].text); setResult(null); }}>{t.sample}</button><button className="vouch-button" type="submit">{t.check}</button></div>
        {result && <div className="vouch-cont-verdict" role="status" data-verdict={result.verdict}><strong>{t.verdict[result.verdict]}</strong><p>{t.verdictNote}</p></div>}
      </form>
    </div></section>
    <section className="vouch-cont-section" id="inside-workpassport"><div className="vouch-inner"><span className="vouch-eyebrow">{t.insideTag}</span><h2>{t.insideTitle}</h2>
      <div className="vouch-cont-feature-list">{t.inside.map(([heading, description]) => <div key={heading}><h3>{heading}</h3><p>{description}</p></div>)}</div>
    </div></section>
    <section className="vouch-cont-ending"><div className="vouch-inner"><span className="vouch-eyebrow">{t.endingTag}</span><h2>{t.endingTitle}</h2><p>{t.endingText}</p>
      <div className="vouch-cont-ending-actions"><button type="button" className="vouch-button" onClick={onSignup}>{t.create}</button><button type="button" className="vouch-link" onClick={onDemo}>{t.demo}</button></div>
    </div></section>
    <footer className="vouch-cont-footer"><div className="vouch-inner vouch-cont-footer-grid">
      <div><a href="#home" className="vouch-brand">vouch<span>.</span></a><p>{t.footer}</p></div>
      <nav aria-label="Footer navigation"><div><h3>{t.workers}</h3><button type="button" onClick={onSignup}>{t.jobs}</button><a href="#safety">{t.safety}</a></div>
        <div><h3>{t.employers}</h3><button type="button" onClick={onClient}>{t.employersDemo}</button></div>
        <div><h3>{t.links}</h3><a href="#what">{t.how}</a><button type="button" onClick={onLogin}>{t.login}</button><button type="button" onClick={onSignup}>{t.signup}</button></div>
      </nav>
    </div></footer>
  </>;
}
