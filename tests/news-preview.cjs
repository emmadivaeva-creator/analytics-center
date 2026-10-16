'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const base='http://127.0.0.1:8765/analytics-center/';
const baseline=process.env.NEWS_PREVIEW_BASELINE
 ?fs.readFileSync(process.env.NEWS_PREVIEW_BASELINE,'utf8')
 :execFileSync('git',['show','e9e45d12c9483aba8259f8473d69d080582854b4:app.js'],{encoding:'utf8'});
const reports=[];
function news(id,extra={}){
 return {id:'import-api:52:'+id,bodyRef:'52:'+id,type:'news',date:'2026-10-15',time:'07:00',week:42,
  product:'ГФ Периодика',subject:'Дайджест '+id,campaign:'Gosfinansi_letter_news_GF_digest_'+id,
  sendsay:'https://example.test/sendsay/'+id,sent:110,delivered:100,uniqueOpened:25,openRate:25,clicks:5,clickRate:5,ctor:20,
  materialData:{materials:[],rows:[]},...extra};
}
const emails=Array.from({length:101},(_,i)=>news(90000+i)).concat([
 news(91000,{subject:'Сохранённый дайджест',bodyPreview:{subject:'Сохранённый дайджест',text:'Сохранённый текст новостей'}}),
 news(91001,{subject:'Дайджест без API',id:'legacy-news',bodyRef:''}),
 news(91002,{subject:'Ошибка загрузки'}),
 news(91003,{subject:'Небезопасный <img src=x onerror=alert(1)>',sendsay:'javascript:alert(1)'}),
 news(91004,{subject:'Дайджест ГЗ',product:'ГЗ Периодика',bodyRef:'61:91004',id:'import-api:61:91004',campaign:'letter_news_goszakaz_regular_news_digest_91004'}),
 news(92000,{type:'demo',subject:'Обычное демо-письмо',campaign:'Gosfinansi_letter_demo_UBU_92000'})
]);
async function test(browser,engine,before){
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();page.setDefaultTimeout(12000);
 const errors=[],calls=[];let holdBody=true,rejectBody=true,releaseBody;
 const bodyGate=new Promise(resolve=>{releaseBody=resolve;});
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.href.startsWith(base+'google-fixture.js'))return route.fulfill({contentType:'text/javascript',body:'window.google={accounts:{oauth2:{initTokenClient(){return{requestAccessToken(){}}},hasGrantedAllScopes(){return true}}}};'});
  if(u.href.startsWith(base+'rpc-fixture')){
   const method=u.searchParams.get('method'),args=JSON.parse(u.searchParams.get('args')||'[]');calls.push({method,args});
   let result,envelope;
   if(method==='v2HealthCheck')result={ok:true,backendBuild:'test'};
   else if(method==='getMailRegistryPageUi')result={emails,offset:0,nextOffset:emails.length,done:true,totalRows:emails.length,readAt:'2026-10-16T13:00:00Z'};
   else if(method==='getPulseDataStoredUi'||method==='getPulseDataFresh')result={meta:{year:2026,currentWeek:42},weekDetails:[{week:42,products:[],summary:{}}],weeks:[],products:[],summary:{}};
   else if(method==='getDemandEvidenceUi')result={ok:true,evidence:[],readAt:'2026-10-16T13:00:00Z'};
   else if(method==='getMailDemoDetailsUi')result={materials:[],rows:[]};
   else if(method==='getMailBodyUi'){
    if(args[0]==='52:90080'&&holdBody)await bodyGate;
    if(args[0]==='52:91002'&&rejectBody)envelope={ok:false,error:'Тест: временный отказ сервера'};
    result={subject:'Предпросмотр '+args[0],text:'Полный текст новостей\n<b>Это текст, а не HTML</b>\n<img src=x onerror=alert(1)>'};
   }else envelope={ok:false,error:'Unexpected fixture method: '+method};
   return route.fulfill({contentType:'text/javascript',body:u.searchParams.get('callback')+'('+JSON.stringify(envelope||{ok:true,result})+');'});
  }
  if(!u.href.startsWith(base))return route.abort();
  const rel=u.pathname.slice('/analytics-center/'.length)||'index.html',file=path.resolve(root,rel);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:'Not found'});
  let body=fs.readFileSync(file,'utf8');
  if(rel==='app.js'&&before)body=baseline;
  if(rel==='index.html')body=body.replace('https://accounts.google.com/gsi/client',base+'google-fixture.js');
  if(rel==='domain-config.js')body=body.replace(/publicReadUrl:\s*'[^']+'/,'publicReadUrl: '+JSON.stringify(base+'rpc-fixture'));
  return route.fulfill({contentType:rel.endsWith('.html')?'text/html':rel.endsWith('.css')?'text/css':'text/javascript',body});
 });
 const bodyReads=ref=>calls.filter(c=>c.method==='getMailBodyUi'&&(!ref||c.args[0]===ref)).length;
 try{
  await page.goto(base+'#news',{waitUntil:'domcontentloaded'});
  await page.locator('#newsRows tbody tr').first().waitFor();
  await page.waitForFunction(()=>/DEMO проверены/.test(document.querySelector('#mailDemoStatus')?.textContent||''));
  if(before){
   assert.equal(await page.locator('#newsRows .mail-body-preview').count(),0);
   assert.equal(await page.locator('#mailRows .mail-body-preview').count(),1);
   reports.push({engine,baselineNewsHasNoPreview:true});return;
  }
  assert.equal(await page.locator('#newsRows tbody tr').count(),100);
  assert.equal(await page.locator('#newsRows .mail-body-preview').count(),100);
  await page.waitForFunction(()=>document.querySelector('#newsRows .mail-body-preview[data-body-ref="52:90000"]')?.dataset.loaded==='1');
  assert.equal(bodyReads('52:90000'),1,'Latest news text is preloaded during the registry pass');
  await page.locator('#newsSearch').fill('Дайджест 90000');
  let preview=page.locator('#newsRows .mail-body-preview');
  await preview.locator('summary').click();
  await page.locator('#newsRows .mail-body-preview[data-loaded="1"]').waitFor();
  assert.equal(bodyReads('52:90000'),1,'Opening a preloaded news item does not wait for another request');
  await preview.locator('summary').click();
  await page.locator('#newsSearch').fill('Дайджест 90080');
  preview=page.locator('#newsRows .mail-body-preview');
  assert.equal(await page.locator('#newsRows a[href="https://example.test/sendsay/90080"]').count(),1);
  await preview.locator('summary').click();
  await page.waitForFunction(()=>document.querySelector('#newsRows .mail-body-preview')?.dataset.loading==='1');
  // Redraw while the response is pending: the preview stays open and shares one request.
  await page.locator('#newsSearch').fill('Дайджест 90080 ');
  assert.equal(await preview.getAttribute('open'),'');
  await page.waitForTimeout(150);assert.equal(bodyReads('52:90080'),1);
  holdBody=false;releaseBody();
  await page.locator('#newsRows .mail-body-preview[data-loaded="1"]').waitFor();
  assert.match(await preview.locator('.mail-body-content').innerText(),/Полный текст новостей/);
  assert.equal(await preview.locator('img').count(),0);
  assert.equal(await preview.locator('.mail-body-text b').count(),0);
  await preview.locator('summary').click();await preview.locator('summary').click();
  assert.equal(bodyReads('52:90080'),1,'Reopening uses cached text');
  await page.locator('#newsSearch').fill('');
  await page.locator('#newsMore').click();
  assert.equal(await page.locator('#newsRows tbody tr').count(),106);
  assert.equal(await page.locator('#newsRows .mail-body-preview').count(),105);
  await page.locator('#newsSearch').fill('Сохранённый дайджест');
  await page.locator('#newsRows .mail-body-preview summary').click();
  assert.match(await page.locator('#newsRows .mail-body-content').innerText(),/Сохранённый текст новостей/);
  assert.equal(bodyReads('52:91000'),0);
  await page.locator('#newsSearch').fill('Дайджест без API');
  assert.match(await page.locator('#newsRows').innerText(),/API недоступен/);
  assert.equal(await page.locator('#newsRows .mail-body-preview').count(),0);
  await page.locator('#newsSearch').fill('Ошибка загрузки');
  await page.locator('#newsRows .mail-body-preview summary').click();
  await page.locator('#newsRows .mail-body-error').waitFor();
  assert.match(await page.locator('#newsRows .mail-body-error').innerText(),/временный отказ/);
  rejectBody=false;
  await page.locator('#newsRows .mail-body-preview summary').click();
  await page.locator('#newsRows .mail-body-preview summary').click();
  await page.locator('#newsRows .mail-body-preview[data-loaded="1"]').waitFor();
  await page.locator('#newsSearch').fill('Небезопасный');
  assert.equal(await page.locator('#newsRows img').count(),0);
  assert.equal(await page.locator('#newsRows a[href^="javascript:"]').count(),0);
  await page.locator('#newsSearch').fill('');
  await page.locator('#newsProduct').selectOption('ГЗ Периодика');
  assert.equal(await page.locator('#newsRows tbody tr').count(),1);
  await page.locator('#newsRows .mail-body-preview summary').click();
  await page.locator('#newsRows .mail-body-preview[data-loaded="1"]').waitFor();
  assert.equal(bodyReads('61:91004'),1);
  await page.locator('#newsProduct').selectOption('');
  await page.locator('#newsSearch').fill('Ничего такого не существует');
  assert.equal(await page.locator('#newsRows tbody tr').count(),0);
  await page.locator('.navbtn[data-page="mail"]').click();
  await page.locator('#mailRows .mail-body-preview summary').click();
  await page.locator('#mailRows .mail-body-preview[data-loaded="1"]').waitFor();
  assert.equal(bodyReads('52:92000'),1,'Existing mail preview is intact');
  await page.locator('.navbtn[data-page="news"]').click();
  await page.locator('#newsSearch').fill('Дайджест 90000');
  const countBeforeReload=bodyReads('52:90000'),registryReads=calls.filter(c=>c.method==='getMailRegistryPageUi').length;
  await page.waitForTimeout(1600);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#newsRows tbody tr').first().waitFor();
  await page.waitForFunction(()=>/DEMO проверены/.test(document.querySelector('#mailDemoStatus')?.textContent||''));
  await page.locator('#newsSearch').fill('Дайджест 90000');
  await page.locator('#newsRows .mail-body-preview summary').click();
  await page.locator('#newsRows .mail-body-text').waitFor();
  assert.equal(bodyReads('52:90000'),countBeforeReload,'Reload must reuse cached preview');
  assert.equal(calls.filter(c=>c.method==='getMailRegistryPageUi').length,registryReads,'Existing archive cache survives');
  assert.deepEqual(errors,[]);
  assert(!calls.some(c=>/^sync|^save|^refresh/.test(c.method)),'No source-data writes');
  if(process.env.NEWS_PREVIEW_SCREENSHOT)await page.screenshot({path:process.env.NEWS_PREVIEW_SCREENSHOT,fullPage:true});
  reports.push({engine,ok:true,newsRows:106,tests:['latest-news body preload','preloaded open without wait','lazy fallback body read','preview in every eligible news row','pending read deduplication on redraw','open state retained on redraw','repeat opening','cached body','missing API ID','error and retry','escaped source content','search and filters','show more','existing mail preview','browser cache after reload','no source-data writes'],errors});
 }finally{releaseBody();await context.close();}
}
(async()=>{
 const engines=[['chromium',chromium,{executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']}]];
 if(process.env.WEBKIT==='1')engines.push(['webkit',webkit,{}]);
 for(const [name,engine,options] of engines){const browser=await engine.launch({headless:true,...options});try{await test(browser,name,true);await test(browser,name,false);}finally{await browser.close();}}
 fs.writeFileSync('news-preview-results.json',JSON.stringify({ok:true,syntheticOnly:true,tests:reports},null,2));
 console.log('NEWS_PREVIEW_TESTS',JSON.stringify({ok:true,tests:reports}));
})().catch(e=>{fs.writeFileSync('news-preview-results.json',JSON.stringify({ok:false,tests:reports,error:e.stack},null,2));console.error(e);process.exitCode=1;});
