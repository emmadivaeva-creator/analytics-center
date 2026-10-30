'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const base = 'http://127.0.0.1:8765/analytics-center/';
const baseline = execFileSync('git', ['show', '6d29f679d097e5b6b8e474a438f8ec4d19c1445f:domain-auth.js'], {encoding:'utf8'});
const googleStub = 'window.google={accounts:{oauth2:{initTokenClient(){return{requestAccessToken(){}}},hasGrantedAllScopes(){return true}}}};';
async function scenario(browser, mode, before) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [], held = [];
  page.on('pageerror', e => errors.push(e.message));
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.href.startsWith(base+'google-fixture.js')) {
      if (mode === 'pending') {held.push(route); return;}
      if (mode === 'blocked') return route.abort();
      return route.fulfill({contentType:'text/javascript',body:googleStub});
    }
    if (url.href.startsWith(base+'rpc-fixture')) {
      const callback = url.searchParams.get('callback');
      const data = url.searchParams.get('method') === 'v2HealthCheck'
        ? {ok:true,result:{ok:true,backendBuild:'TEST'}}
        : {ok:false,error:'Test fixture: analytics data intentionally omitted'};
      return route.fulfill({contentType:'text/javascript',body:callback+'('+JSON.stringify(data)+');'});
    }
    if (!url.href.startsWith(base)) return route.abort();
    const rel = url.pathname.slice('/analytics-center/'.length) || 'index.html';
    const filename = path.resolve(root,rel);
    if (!filename.startsWith(root+path.sep) || !fs.existsSync(filename)) return route.fulfill({status:404,body:'Not found'});
    let body = fs.readFileSync(filename,'utf8');
    if (rel === 'domain-auth.js' && before) body = baseline;
    if (rel === 'index.html') body = body.replace('https://accounts.google.com/gsi/client',base+'google-fixture.js');
    if (rel === 'domain-config.js') body = body.replace(/publicReadUrl: '[^']+'/,"publicReadUrl: '"+base+"rpc-fixture'");
    const contentType = rel.endsWith('.html') ? 'text/html' : rel.endsWith('.css') ? 'text/css' : 'text/javascript';
    return route.fulfill({contentType,body});
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(700);
  const state = await page.evaluate(() => ({app:!!document.querySelector('.app'),readyState:document.readyState,ownerHandler:typeof window.analyticsRequestOwnerLogin}));
  if (before) {
    assert.equal(state.app,false,'Baseline must reproduce the stuck loading screen');
    assert.notEqual(state.readyState,'complete');
  } else {
    assert.equal(state.app,true,'Anonymous UI must start without waiting for Google');
    assert.equal(state.ownerHandler,'function');
    await page.locator('#ownerLoginBtn').click();
    assert.equal(await page.locator('#authGate').isVisible(),true);
    if (mode !== 'normal') assert.match(await page.locator('#authStatus').innerText(),/Не удалось загрузить Google-вход/);
    await page.locator('#authGate button').filter({hasText:'Закрыть'}).click();
    assert.equal(await page.locator('#authGate').isVisible(),false);
    const writeError = await page.evaluate(async()=>{try{await window.analyticsRpc('syncDemoStats');return '';}catch(e){return e.message;}});
    assert.match(writeError,/вход владельца/);
  }
  assert.deepEqual(errors,[]);
  console.log('STARTUP_REGRESSION',JSON.stringify({before,mode,state,errors}));
  for (const route of held) {try {await route.abort();} catch {}}
  await context.close();
}
async function liveAudit(browser) {
  const page = await browser.newPage();
  const errors = [], states = [];
  page.on('pageerror',e=>errors.push(e.message));
  const response = await page.goto('https://emmadivaeva-creator.github.io/analytics-center/',{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(response.status(),200);
  await page.locator('.app').waitFor({timeout:30000});
  await page.waitForTimeout(9000);
  for (const name of ['pulse','sources','mail','news','demand','vio','vika','service']) {
    await page.locator('.navbtn[data-page="'+name+'"]').click();
    await page.waitForTimeout(name === 'mail' || name === 'vika' || name === 'demand' ? 12000 : 2500);
    states.push(await page.evaluate(name=>({name,active:document.querySelector('.page.active')?.id,status:document.querySelector('#'+name+'Status')?.textContent||'',error:document.querySelector('#'+name+'Error')?.textContent||'',rows:document.querySelectorAll('#'+name+'Rows > *').length}),name));
  }
  await page.locator('.navbtn[data-page="sources"]').click();
  await page.waitForTimeout(2500);
  const sources = await page.evaluate(()=>({
    status:document.querySelector('#sourcesStatus')?.textContent||'',
    period:document.querySelector('#sourcesPeriod')?.textContent||'',
    summary:[...document.querySelectorAll('#sourcesSummary > div')].map(x=>x.textContent.replace(/\\s+/g,' ').trim()),
    cards:[...document.querySelectorAll('#sourceCards .source-card')].map(x=>x.textContent.replace(/\\s+/g,' ').trim())
  }));
  await page.locator('.navbtn[data-page="pulse"]').click();
  await page.waitForTimeout(2500);
  const pulse = await page.evaluate(async()=>{
    const cards=[...document.querySelectorAll('#products .product')].map(card=>({
      product:card.querySelector('h3')?.textContent||'',
      text:card.textContent.replace(/\\s+/g,' ').trim()
    }));
    let snapshot=null,stored=null,fresh=null;
    try{snapshot=await fetch('pulse-current.json?audit='+Date.now(),{cache:'no-store'}).then(r=>r.json());}catch(e){snapshot={error:e.message};}
    try{stored=await window.analyticsRpc('getPulseDataStoredUi');}catch(e){stored={error:e.message};}
    try{fresh=await window.analyticsRpc('getPulseDataFresh');}catch(e){fresh={error:e.message};}
    return {
      weekSelect:document.querySelector('#weekSelect')?.value||'',
      cards,
      snapshot,
      stored:{meta:stored?.meta,products:stored?.products},
      fresh:{meta:fresh?.meta,products:fresh?.products}
    };
  });
  const result = {errors,states,bootstrap:await page.locator('script[src*="domain-auth.js"]').getAttribute('src'),sources,pulse};
  console.log('LIVE_TAB_AUDIT',JSON.stringify(result));
  fs.writeFileSync('startup-tabs.json',JSON.stringify(result,null,2));
  assert.deepEqual(errors,[],'Published page must not throw unhandled JavaScript errors');
  for (const state of states) assert.equal(state.active,'page-'+state.name);
  await page.close();
}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  try {
    await scenario(browser,'pending',true);
    for (const mode of ['pending','blocked','normal']) await scenario(browser,mode,false);
    if (process.env.LIVE_AUDIT==='1') await liveAudit(browser);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
