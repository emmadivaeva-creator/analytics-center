import fs from 'node:fs/promises';
import {buildNewsSummary, mergeIssues, normalizeIssue, issueId, isoWeek} from './news-archive.mjs';

const endpoint='https://script.google.com/macros/s/AKfycbzseFMx8oDQPQ0BtUu6rvZiGAdZRFX6-uR2q9bqFF69olKK2pgvl_dGLJ6bC3MPLVcn7g/exec';

async function call(method,args=[],timeoutMs=180000){
  const url=new URL(endpoint);
  url.searchParams.set('method',method);
  url.searchParams.set('args',JSON.stringify(args));
  url.searchParams.set('_',String(Date.now()));
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{redirect:'follow',signal:controller.signal,headers:{'accept':'application/json'}});
    const text=await response.text();
    if(!response.ok)throw new Error(method+' HTTP '+response.status+': '+text.slice(0,300));
    let data;
    try{data=JSON.parse(text);}catch(e){throw new Error(method+' returned non-JSON: '+text.slice(0,300));}
    if(!data||data.ok!==true)throw new Error(method+': '+String(data&&data.error||'unknown error'));
    return data.result;
  }finally{clearTimeout(timer);}
}
function n(v){const x=Number(v);return Number.isFinite(x)?x:0;}
function identity(url){return String(url||'').replace(/^https?:\/\/(?:www\.)?/i,'').split(/[?#]/)[0].replace(/\/$/,'');}
async function mapLimit(items,limit,fn){
  const out=new Array(items.length);let next=0;
  async function worker(){
    while(true){
      const i=next++;if(i>=items.length)return;
      try{out[i]=await fn(items[i],i);}catch(error){out[i]={error:String(error&&error.message||error),item:items[i]};}
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
  return out;
}

const generatedAt=new Date().toISOString();
console.log('Analytics snapshot refresh started:',generatedAt);

const pulse=await call('getPulseDataFresh',[],180000);
const pulseWeek=Number(pulse?.meta?.currentWeek)||0;
const pulseProducts=(pulse?.products||[]).map(p=>({
  product:p.product,red:n(p.red),yellow:n(p.yellow),green:n(p.green),plan:n(p.plan)
}));
await fs.writeFile('pulse-current.json',JSON.stringify({
  generatedAt,
  sourceName:'Статистика по ДЕМО',
  sourceUrl:pulse?.meta?.sourceUrl||'',
  year:Number(pulse?.meta?.year)||new Date().getUTCFullYear(),
  week:pulseWeek,
  note:'Автоматический резервный снимок живого DEMO-факта. Основной источник сайта — getPulseDataFresh.',
  products:pulseProducts
},null,2)+'\n','utf8');

const demand=await call('getDemandEvidenceUi',[],180000);
await fs.writeFile('demand-current.json',JSON.stringify({...demand,generatedAt},null,2)+'\n','utf8');

// CUMULATIVE NEWS ARCHIVE FROM ISO W27. No past issue is discarded by a
// seven-day refresh. These two files are durable build inputs, not browser caches.
const readJson=async(path,fallback)=>{
  try{return JSON.parse(await fs.readFile(path,'utf8'));}
  catch(e){if(e.code==='ENOENT')return fallback;throw e;}
};
const inventory=await readJson('news-demo-inventory.json',{schemaVersion:1,from:'2026-06-29',emails:[],missingEarlyWeeks:[]});
const archive=await readJson('news-demo-letter-results.json',{schemaVersion:1,results:{},failures:{}});
archive.results=archive.results||{};
archive.failures=archive.failures||{};

let recentError='',pageError='';
let latestNews=[];
try {
  const recent=await call('getMailRegistryRecentUi',[7],180000);
  latestNews=(recent.emails||[]).filter(m=>m?.type==='news'&&normalizeIssue(m));
} catch(e) {
  recentError=String(e.message||e);
  console.warn('NEWS_RECENT_SOURCE_ERROR:',recentError);
}

// Walk ONE source-registry page per run, so late-imported old emails
// are eventually discovered without loading 27,000 DEMO rows every hour.
try {
  const offset=Number.isInteger(inventory.scanOffset)&&inventory.scanOffset>=0?inventory.scanOffset:0;
  const page=await call('getMailRegistryPageUi',[offset],180000);
  const found=(page.emails||[]).filter(m=>m?.type==='news'&&normalizeIssue(m));
  latestNews.push(...found);
  const next=Number(page.nextOffset);
  inventory.scanOffset=page.done?0:(Number.isInteger(next)&&next>offset?next:0);
  inventory.scanCheckedAt=generatedAt;
} catch(e) {
  pageError=String(e.message||e);
  console.warn('NEWS_PAGED_SOURCE_ERROR:',pageError);
}

inventory.emails=mergeIssues(inventory.emails,latestNews);
inventory.generatedAt=generatedAt;
inventory.through=inventory.emails.reduce((date,m)=>m.date>date?m.date:date,'');
if(!inventory.from)inventory.from='2026-06-29';
const all=inventory.emails;
const pending=all.filter(m=>!Object.prototype.hasOwnProperty.call(archive.results,m.id));
const eligible=pending.filter(m=>{
  const fail=archive.failures[m.id];
  return !fail||!fail.attemptedAt||Date.now()-Date.parse(fail.attemptedAt)>2*3600000;
});
const maxBatch=Math.max(1,Math.min(90,Number(process.env.NEWS_BATCH_SIZE)||55));
// Start with the earliest W31 newsletters, while also keeping new issues
// represented in a still-incomplete backfill. Then continue chronologically.
const newest=eligible.slice(-Math.min(14,Math.floor(maxBatch/3)));
const pickedIds=new Set(newest.map(m=>m.id));
const batch=eligible.filter(m=>!pickedIds.has(m.id)).slice(0,maxBatch-newest.length).concat(newest);
console.log('NEWS_HISTORY_PROGRESS',JSON.stringify({
  indexed:all.length,processed:Object.keys(archive.results).length,
  pending:pending.length,scheduled:batch.length,
  from:inventory.from,earliestIndexed:all[0]?.date,latestIndexed:inventory.through
}));

const completed=await mapLimit(batch,4,async mail=>{
  const response=await call('getMailDemoDetailsUi',[mail.id],150000);
  if(!response||!Array.isArray(response.materials)||!Array.isArray(response.rows))
    throw new Error('Invalid materials response for '+mail.id);
  return {id:mail.id,materials:response.materials.map(m=>({
    id:String(m.id||''),url:String(m.url||''),title:String(m.title||''),
    kind:String(m.kind||''),group:String(m.group||'')
  })),rows:response.rows.map(r=>({
    product:String(r.product||''),content:String(r.content||''),
    term:String(r.term||''),title:String(r.title||''),url:String(r.url||''),
    sourceUrl:String(r.sourceUrl||''),weeks:Array.isArray(r.weeks)
      ?r.weeks.map(w=>({week:Number(w.week),red:n(w.red),yellow:n(w.yellow),green:n(w.green)}))
      :[]
  })),processedAt:generatedAt};
});
let savedNew=0,failedNew=0;
for(let i=0;i<completed.length;i++){
  const mail=batch[i],result=completed[i];
  if(result&&result.error){
    const prior=archive.failures[mail.id]||{};
    archive.failures[mail.id]={attempts:Number(prior.attempts||0)+1,
      attemptedAt:generatedAt,message:String(result.error).slice(0,350)};
    failedNew++;
  }else if(result){
    archive.results[mail.id]={materials:result.materials,rows:result.rows,processedAt:generatedAt};
    delete archive.failures[mail.id];
    savedNew++;
  }
}
archive.generatedAt=generatedAt;
archive.schemaVersion=1;
await fs.writeFile('news-demo-inventory.json',JSON.stringify(inventory,null,2)+'\n','utf8');
await fs.writeFile('news-demo-letter-results.json',JSON.stringify(archive,null,2)+'\n','utf8');

const cumulative=buildNewsSummary(inventory,archive,generatedAt);
cumulative.recentSourceWarning=recentError;
cumulative.pagedSourceWarning=pageError;
// On an API outage, do not overwrite a valid report with empty fabricated facts.
const oldSnapshot=await readJson('news-demo-current.json',null);
if(cumulative.mailsChecked>0||!oldSnapshot?.topics?.length)
  await fs.writeFile('news-demo-current.json',JSON.stringify(cumulative,null,2)+'\n','utf8');
else console.warn('NEWS_ARCHIVE_PRESERVED: no historical items processed yet');

console.log('NEWS_CUMULATIVE_RESULT',JSON.stringify({
  indexed:all.length,processed:cumulative.mailsChecked,
  added:savedNew,failedThisRun:failedNew,pending:cumulative.pendingCount,
  weeks:cumulative.weeks,topics:cumulative.topics.length,
  missingEarlyWeeks:cumulative.sourceMissingWeeks
}));
if(process.env.GITHUB_OUTPUT)
  await fs.appendFile(process.env.GITHUB_OUTPUT,
    'archive_pending='+String(cumulative.pendingCount)+'\n'+
    'archive_added='+String(savedNew)+'\n','utf8');
