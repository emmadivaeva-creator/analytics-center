'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..');
const base='http://127.0.0.1:8765/analytics-center/';
const oldApp=execFileSync('git',['show','8aa344ff4c008700cf1c08db5d9014a84a61fed8:app.js'],{encoding:'utf8'});
const results=[];
function letter(i,extra={}){
 return {id:'import-api:52:'+i,bodyRef:'52:'+i,type:'demo',date:'2026-10-15',time:'08:00',week:42,product:'ГЗ Система',subject:'Тестовое письмо '+i,campaign:'letter_demo_goszakaz_cgz_'+i,sendsay:'https://app.sendsay.ru/reports/campaigns/'+i+'/summary',sent:110,delivered:100,uniqueOpened:25,openRate:25,clicks:5,clickRate:5,ctor:20,red:2,yellow:1,green:1,hasDemoData:true,demoEvidence:[],...extra};
}
const synthetic=Array.from({length:106},(_,i)=>letter(10000+i)).concat([
 letter(20001,{subject:'Два сегмента',segment:'Живые'}),
 letter(20002,{subject:'Два сегмента',segment:'Дожим демо'}),
 letter(20003,{subject:'Сохранённый текст',bodyPreview:{text:'Текст из кэша',subject:'Сохранённый текст'}}),
 letter(20004,{subject:'Без предпросмотра',bodyRef:'',id:'legacy-sample'}),
 letter(20005,{subject:'Проверка <img src=x onerror=alert(1)>',sendsay:'javascript:alert(1)',product:'ГФ Система',demoEvidence:[{source:'Исходная таблица',sourceUrl:'https://example.test/source',product:'ГФ Система',campaign:'letter_demo_sample',red:2,yellow:1,green:1}]}),
 letter(30001,{type:'news',subject:'Тестовый дайджест',campaign:'letter_news_goszakaz_regular_news_digest_15_10_2026'})
]);
async function fixture(browser,label,emails,before=false,exercise=false){
 const context=await browser.newContext();
 const page=await context.newPage();
 const errors=[],calls=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.href.startsWith(base+'google-fixture.js'))return route.fulfill({contentType:'text/javascript',body:'window.google={accounts:{oauth2:{initTokenClient(){return{requestAccessToken(){}}},hasGrantedAllScopes(){return true}}}};'});
  if(u.href.startsWith(base+'rpc-fixture')){
   const method=u.searchParams.get('method');
   const args=JSON.parse(u.searchParams.get('args')||'[]');
   calls.push({method,args});
   let result;
   if(method==='getMailRegistryPageUi'){
    const offset=Number(args[0])||0;
    const count=exercise?50:emails.length;
    result={emails:emails.slice(offset,offset+count),offset,nextOffset:Math.min(offset+count,emails.length),done:offset+count>=emails.length,totalRows:emails.length,readAt:'2026-10-16T09:00:00Z'};
   }else if(method==='v2HealthCheck')result={ok:true,backendBuild:'fixture'};
   else if(method==='getPulseDataStoredUi'||method==='getPulseDataFresh')result={meta:{year:2026,currentWeek:42,sourceReadAt:'2026-10-16T09:00:00Z'},weekDetails:[{week:42,products:[],summary:{}}],weeks:[],products:[],summary:{}};
   else if(method==='getMailBodyUi')result={subject:'Текст тестового письма',text:'Проверенный текст <b>без HTML-исполнения</b>'};
   else if(method==='getMailDemoDetailsUi')result={materials:[],rows:[],note:'Тестовое сопоставление'};
   else return route.fulfill({contentType:'text/javascript',body:u.searchParams.get('callback')+'('+JSON.stringify({ok:false,error:'Unexpected test RPC: '+method})+');'});
   return route.fulfill({contentType:'text/javascript',body:u.searchParams.get('callback')+'('+JSON.stringify({ok:true,result})+');'});
  }
  if(!u.href.startsWith(base))return route.abort();
  const rel=u.pathname.slice('/analytics-center/'.length)||'index.html';
  const file=path.resolve(root,rel);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:'Not found'});
  let body=fs.readFileSync(file,'utf8');
  if(rel==='app.js'&&before)body=oldApp;
  if(rel==='index.html')body=body.replace('https://accounts.google.com/gsi/client',base+'google-fixture.js');
  if(rel==='domain-config.js')body=body.replace(/publicReadUrl: '[^']+'/,'publicReadUrl: '+JSON.stringify(base+'rpc-fixture'));
  const contentType=rel.endsWith('.html')?'text/html':rel.endsWith('.css')?'text/css':'text/javascript';
  return route.fulfill({contentType,body});
 });
 try{
  await page.goto(base+'#mail',{waitUntil:'domcontentloaded'});
  if(before){
   await page.waitForFunction(()=>/mailLetterHtml_/.test(document.querySelector('#mailStatus')?.textContent||''),{},{timeout:15000});
   const baselineError=await page.locator('#mailStatus').innerText();
   assert.match(baselineError,/mailLetterHtml_/);
   assert.equal(await page.locator('#mailRows tbody tr').count(),0);
   results.push({label,baselineFailureReproduced:true,error:baselineError});
   return;
  }
  await page.locator('#mailRows tbody tr').first().waitFor({timeout:20000});
  const initialRows=await page.locator('#mailRows tbody tr').count();
  assert(initialRows>0);
  if(exercise){
   assert.equal(initialRows,100);
   assert.equal(calls.filter(c=>c.method==='getMailRegistryPageUi').length,3);
   await page.locator('#mailMore').click();
   assert.equal(await page.locator('#mailRows tbody tr').count(),110);
   await page.locator('#mailSearch').fill('Два сегмента');
   assert.equal(await page.locator('#mailRows tbody tr').count(),1);
   const grouped=page.locator('#mailRows tbody tr');
   assert.match(await grouped.innerText(),/2 сегмента Sendsay/);
   await grouped.locator('summary').filter({hasText:'Подробности'}).click();
   assert.equal(await grouped.locator('a[href^="https://app.sendsay.ru/"]').count(),2);
   await grouped.locator('.mail-body-preview summary').click();
   await page.locator('.mail-body-preview[data-loaded="1"]').waitFor();
   assert.match(await grouped.locator('.mail-body-content').innerText(),/Проверенный текст <b>/);
   assert.equal(await grouped.locator('.mail-body-content b').count(),1);
   await page.locator('#mailSearch').fill('Сохранённый текст');
   assert.equal(await page.locator('.mail-body-preview[data-loaded="1"]').count(),1);
   await page.locator('#mailSearch').fill('Без предпросмотра');
   assert.match(await page.locator('#mailRows').innerText(),/API недоступен/);
   await page.locator('#mailSearch').fill('Проверка');
   assert.equal(await page.locator('#mailRows img').count(),0);
   assert.equal(await page.locator('#mailRows a[href^="javascript:"]').count(),0);
   await page.locator('#mailSearch').fill('');
   await page.locator('#mailProduct').selectOption('ГФ Система');
   assert.equal(await page.locator('#mailRows tbody tr').count(),1);
   await page.locator('#mailProduct').selectOption('');
   await page.locator('#mailSearch').fill('Заведомо отсутствующее письмо');
   assert.equal(await page.locator('#mailRows tbody tr').count(),0);
   assert.match(await page.locator('#mailRows').innerText(),/Нет писем/);
   await page.locator('#mailSearch').fill('');
   await page.locator('.navbtn[data-page="news"]').click();
   await page.locator('#newsRows tbody tr').first().waitFor();
   assert.equal(await page.locator('#newsRows tbody tr').count(),1);
   await page.locator('.navbtn[data-page="mail"]').click();
   await page.waitForTimeout(1600);
   const reads=calls.filter(c=>c.method==='getMailRegistryPageUi').length;
   await page.reload({waitUntil:'domcontentloaded'});
   await page.locator('#mailRows tbody tr').first().waitFor();
   assert.equal(calls.filter(c=>c.method==='getMailRegistryPageUi').length,reads,'Reload must reuse existing mail cache');
  }
  assert.deepEqual(errors,[]);
  assert(!calls.some(c=>/^sync|^save|^refresh/.test(c.method)),'Tests must not call write methods');
  results.push({label,inputEmails:emails.length,initialRenderedRows:initialRows,exercisedPaginationFiltersPreviewsAndCache:exercise,errors});
 }finally{await context.close();}
}
async function readRealFirstPage(){
 const config=fs.readFileSync(path.join(root,'domain-config.js'),'utf8');
 const url=new URL(config.match(/publicReadUrl:\s*'([^']+)'/)[1]);
 url.searchParams.set('method','getMailRegistryPageUi');url.searchParams.set('args','[0]');url.searchParams.set('_',String(Date.now()));
 const response=await fetch(url,{signal:AbortSignal.timeout(90000)});
 if(!response.ok)throw new Error('HTTP '+response.status);
 const data=await response.json();
 if(data.ok!==true||!Array.isArray(data.result?.emails)||!data.result.emails.length)throw new Error(data.error||'No real first-page emails returned');
 return data.result;
}
(async()=>{
 let real=null;
 if(process.env.REAL_FIRST_PAGE==='1'){
  try{real=await readRealFirstPage();results.push({label:'server-first-page',ok:true,returnedEmails:real.emails.length,totalRows:real.totalRows,done:real.done});}
  catch(e){results.push({label:'server-first-page',ok:false,error:e.message});}
 }
 const engines=[['chromium',chromium,{executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']}]];
 if(process.env.WEBKIT==='1')engines.push(['webkit',webkit,{}]);
 for(const [name,engine,options] of engines){
  const browser=await engine.launch({headless:true,...options});
  try{
   await fixture(browser,name+' baseline',synthetic,true,false);
   await fixture(browser,name+' synthetic',synthetic,false,true);
   if(real)await fixture(browser,name+' real-first-page-render-only',real.emails,false,false);
  }finally{await browser.close();}
 }
 fs.writeFileSync('mail-render-results.json',JSON.stringify({ok:true,tests:results},null,2));
 console.log('MAIL_RENDER_TESTS',JSON.stringify({ok:true,tests:results}));
})().catch(e=>{fs.writeFileSync('mail-render-results.json',JSON.stringify({ok:false,tests:results,error:e.stack},null,2));console.error(e);process.exitCode=1;});
