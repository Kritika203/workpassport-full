import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WEB = process.env.VOUCH_WEB_URL || 'https://workpassport-web.onrender.com';
const API = process.env.VOUCH_API_URL || 'https://workpassport-api.onrender.com';
const results = [];
const crashes = [];
const failures = [];
fs.mkdirSync('smoke-artifacts', { recursive: true });

function add(label, state, detail='') {
  results.push({ label, state, detail });
  console.log((state === 'PASS' ? 'PASS' : state === 'FAIL' ? 'FAIL' : 'INFO') + ' | ' + label + (detail ? ' | ' + detail : ''));
  if (state === 'FAIL') failures.push(label + ': ' + detail);
}
async function run(label, action) {
  try { await action(); add(label, 'PASS'); }
  catch(e) { add(label, 'FAIL', String(e?.message || e).slice(0, 350)); }
}
async function waitGet(url) {
  let last;
  for(let attempt=1; attempt<=5; attempt++){
    try {
      const res=await fetch(url, { signal: AbortSignal.timeout(70000), redirect:'follow' });
      if(res.status>=500 && attempt<5){last=new Error('HTTP '+res.status); await new Promise(r=>setTimeout(r,9000));continue;}
      return res;
    } catch(e) {
      last=e;
      if(attempt<5)await new Promise(r=>setTimeout(r,9000));
    }
  }
  throw last;
}
const health = await run('Public API health is responding', async () => {
  const r=await waitGet(API + '/api/health/');
  assert.equal(r.status,200,'Health status '+r.status);
  const json=await r.json();
  assert.equal(json.status,'ok');
  add('API reports service', 'INFO', String(json.service || 'unknown'));
});
await run('Unauthenticated job listings endpoint', async()=>{
  const r=await waitGet(API + '/api/jobs/');
  assert.equal(r.status,200,'Job feed returned '+r.status);
  const d=await r.json();
  const jobs=Array.isArray(d)?d:Array.isArray(d.results)?d.results:[];
  add('Currently visible jobs', 'INFO', String(d.count ?? jobs.length));
});
await run('Private application endpoint rejects guests', async()=>{
  const r=await waitGet(API + '/api/me/applications/');
  assert.ok([401,403].includes(r.status),'Expected 401 or 403, got '+r.status);
});
await run('Private employer endpoint rejects guests', async()=>{
  const r=await waitGet(API + '/api/client/jobs/');
  assert.ok([401,403].includes(r.status),'Expected 401 or 403, got '+r.status);
});
await run('Public React HTML and JS/CSS assets', async()=>{
  const res=await waitGet(WEB + '/');
  assert.equal(res.status,200,'Homepage '+res.status);
  const html=await res.text();
  assert.ok(html.includes('<div id="root"') || html.includes('<div id="root"'), 'React root not found');
  const paths=[...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(x=>x[1]);
  assert.ok(paths.length>0, 'No build assets discovered');
  for(const path of paths){
    const asset=await waitGet(WEB+path);
    assert.equal(asset.status,200, path+' -> '+asset.status);
    assert.ok((Number(asset.headers.get('content-length')) || (await asset.arrayBuffer()).byteLength) > 0, 'Empty asset '+path);
  }
  add('Vite assets found', 'INFO', String(paths.length));
});

const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
const page=await context.newPage();
page.on('pageerror',e=>crashes.push(String(e.message).slice(0,240)));
page.on('response',r=>{if(r.status()>=500) crashes.push('HTTP '+r.status()+' '+r.url().slice(0,160));});
await run('Browser loads landing page',async()=>{
  const r=await page.goto(WEB,{waitUntil:'domcontentloaded',timeout:100000});
  assert.equal(r.status(),200);
  await page.getByRole('heading',{name:/Your first opportunity/i}).waitFor({timeout:30000});
  await page.locator('.vouch-hero-preview').waitFor({state:'visible'});
  await page.screenshot({path:'smoke-artifacts/landing-desktop.png',fullPage:false});
});
await run('Desktop landing does not overflow horizontally',async()=>{
  const size=await page.evaluate(()=>({w:innerWidth,doc:document.documentElement.scrollWidth}));
  assert.ok(size.doc<=size.w+8,JSON.stringify(size));
});
await run('Three-step cards respond to hover',async()=>{
  const stack=page.locator('.vouch-step-row');
  await stack.scrollIntoViewIfNeeded();
  const cards=stack.locator('article');
  assert.equal(await cards.count(),3);
  const before=await cards.nth(2).evaluate(el=>getComputedStyle(el).transform);
  await stack.hover();
  await page.waitForTimeout(650);
  const after=await cards.nth(2).evaluate(el=>getComputedStyle(el).transform);
  assert.notEqual(before,after,'Card hover position did not change');
  await page.screenshot({path:'smoke-artifacts/step-cards.png',fullPage:false});
});
await run('Signup form includes confirm-password validation',async()=>{
  await page.locator('.vouch-header-cta').click();
  const form=page.locator('form');
  await form.locator('input[autocomplete="name"]').fill('Smoke Test User');
  await form.locator('input[autocomplete="username"]').fill('vouch_smoke_readonly');
  await form.locator('input[type="email"]').fill('smoke@example.org');
  const pw=form.locator('input[type="password"]');
  assert.equal(await pw.count(),2);
  await pw.nth(0).fill('DifferentPassword101!');
  await pw.nth(1).fill('WrongPassword202!');
  await form.getByRole('button',{name:/Create account/i}).click();
  await page.getByText(/Passwords do not match/i).waitFor({timeout:10000});
});
await run('Login form is reachable',async()=>{
  await page.getByRole('button',{name:/Back to home/i}).click();
  await page.getByRole('button',{name:/Log in/i}).first().click();
  await page.getByRole('heading',{name:/Welcome back/i}).waitFor();
  assert.ok(await page.locator('form input[type="password"]').count()>=1);
});
await run('Employer demo opens without production account',async()=>{
  await page.getByRole('button',{name:/Back to home/i}).click();
  await page.getByRole('button',{name:/Employer Demo/i}).first().click();
  await page.getByRole('navigation',{name:'Employer navigation'}).waitFor({timeout:15000});
  await page.screenshot({path:'smoke-artifacts/employer.png',fullPage:false});
});
await run('Employer Find talent navigation',async()=>{
  await page.locator('.vouch-shell-links').getByRole('button',{name:'Find talent'}).click();
  await page.getByRole('heading',{name:/Explore Freelancers/i}).waitFor();
  const empty=page.locator('.vouch-no-live-job');
  if(await empty.count()){
    const status=await empty.first().evaluate(el=>getComputedStyle(el));
    assert.ok(await empty.first().isVisible());
    add('Employer empty-job state', 'INFO', 'Visible centered state instead of disabled select');
  }
});
await run('Employer deliverable formats use grouped selector',async()=>{
  await page.locator('.vouch-shell-links').getByRole('button',{name:'Dashboard'}).click();
  await page.locator('.vouch-shell-user-button').click();
  await page.getByRole('menuitem',{name:/Post a job/i}).click();
  const dropdown=page.locator('.vouch-formats-picker').first();
  await dropdown.waitFor({state:'attached',timeout:12000});
  assert.ok(!(await dropdown.getAttribute('open')),'Selector should start collapsed');
  await dropdown.locator('summary').click();
  assert.ok(await dropdown.locator('.vouch-formats-options button').count()>=12,'Missing format options');
  await page.screenshot({path:'smoke-artifacts/employer-formats.png',fullPage:false});
});
await run('Employer logout returns to Vouch public page',async()=>{
  await page.locator('.vouch-shell-user-button').click();
  await page.getByRole('menuitem',{name:/Log out/i}).click();
  await page.getByRole('heading',{name:/Your first opportunity/i}).waitFor();
});
await run('Maya demo authenticates against live backend',async()=>{
  await page.getByRole('button',{name:/Continue Demo \(Maya\)/i}).first().click();
  await page.getByRole('navigation',{name:'Vouch navigation'}).waitFor({timeout:45000});
  await page.locator('.vouch-shell-links').getByRole('button',{name:'FirstWork'}).waitFor();
  await page.screenshot({path:'smoke-artifacts/worker.png',fullPage:false});
});
await run('FirstWork search and filters are accessible',async()=>{
  await page.locator('.vouch-shell-links').getByRole('button',{name:'FirstWork'}).click();
  await page.locator('.fw-vouch-search input').waitFor({state:'visible'});
  await page.locator('.fw-vouch-filter-button').click();
  await page.locator('.fw-vouch-filter-panel').waitFor({state:'visible'});
  const close=page.locator('.fw-vouch-filter-panel button').filter({hasText:/Show jobs|Close|Clear all/}).last();
  await page.keyboard.press('Escape');
});
await run('My WorkPassport section tabs change content',async()=>{
  await page.locator('.vouch-shell-links').getByRole('button',{name:'My WorkPassport'}).click();
  await page.locator('.vouch-passport-tabs').waitFor();
  await page.getByRole('tab',{name:'Profile'}).click();
  assert.equal(await page.locator('[data-passport-pane="profile"]').isVisible(),true);
  await page.getByRole('tab',{name:/Skills & proof/i}).click();
  assert.equal(await page.locator('[data-passport-pane="skills"]').isVisible(),true);
  await page.getByRole('tab',{name:/Completed work/i}).click();
  assert.equal(await page.locator('[data-passport-pane="work"]').isVisible(),true);
});
await run('WorkShield checker is available',async()=>{
  await page.locator('.vouch-shell-links').getByRole('button',{name:'WorkShield'}).click();
  await page.locator('textarea#ws-one-text').waitFor();
  await page.locator('textarea#ws-one-text').fill('Pay a fee to apply; send your bank OTP via Telegram.');
  assert.ok((await page.locator('textarea#ws-one-text').inputValue()).includes('OTP'));
});
await run('Community is reachable and labeled as local demo',async()=>{
  await page.locator('.vouch-shell-links').getByRole('button',{name:'Community'}).click();
  await page.getByText(/Posts are not yet shared with other users/i).first().waitFor({timeout:12000});
});
await run('Worker account menu shows Payments and Extension',async()=>{
  await page.locator('.vouch-shell-user-button').click();
  await page.getByRole('menuitem',{name:'Payments'}).click();
  await page.getByRole('heading',{name:'Payments'}).first().waitFor();
  await page.locator('.vouch-shell-user-button').click();
  await page.getByRole('menuitem',{name:'Extension'}).click();
  await page.getByText(/WorkShield in your browser/i).first().waitFor();
});
await run('Low-data mode can be switched on and off',async()=>{
  await page.locator('.vouch-shell-user-button').click();
  await page.getByRole('menuitem',{name:/Low data \/ larger text/i}).click();
  assert.ok(await page.evaluate(()=>document.documentElement.classList.contains('vouch-low-data')),'Low-data HTML class missing');
  await page.locator('.vouch-shell-user-button').click();
  await page.getByRole('menuitem',{name:/Standard view/i}).click();
  assert.ok(!(await page.evaluate(()=>document.documentElement.classList.contains('vouch-low-data'))));
});
await run('Mobile landing fits 390px screen and menu opens',async()=>{
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const mp=await mobile.newPage();
  await mp.goto(WEB,{waitUntil:'domcontentloaded',timeout:100000});
  await mp.getByRole('heading',{name:/Your first opportunity/i}).waitFor();
  const size=await mp.evaluate(()=>({w:document.documentElement.clientWidth,sw:document.documentElement.scrollWidth}));
  assert.ok(size.sw<=size.w+8,JSON.stringify(size));
  const menu=mp.locator('.vouch-mobile-menu');
  await menu.click();
  await mp.locator('.vouch-nav.open a[href="#what"]').waitFor();
  await mp.screenshot({path:'smoke-artifacts/landing-mobile.png',fullPage:false});
  await mobile.close();
});
await run('No uncaught runtime errors or API 5xx during tested flows',async()=>{
  assert.equal(crashes.length,0,crashes.slice(0,5).join('; '));
});
console.log('\n=== LIVE SMOKE SUMMARY ===');
for(const x of results)console.log(x.state+' '+x.label+(x.detail?' :: '+x.detail:''));
console.log('FAILURES='+failures.length+' PASSES='+results.filter(x=>x.state==='PASS').length);
await browser.close();
if(failures.length)process.exitCode=1;
