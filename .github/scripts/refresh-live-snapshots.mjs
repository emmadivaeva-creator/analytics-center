import fs from 'node:fs/promises';

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

const demand=await call('getDemandEvidenceUi',[],180000);
await fs.writeFile('demand-current.json',JSON.stringify({...demand,generatedAt},null,2)+'\n','utf8');

const recent=await call('getMailRegistryRecentUi',[7],180000);
const news=(recent.emails||[]).filter(mail=>{
  const type=String(mail.type||'').toLowerCase(),campaign=String(mail.campaign||'');
  return type==='news'||/letter_news|news_digest/i.test(campaign);
});
const details=await mapLimit(news,4,async mail=>({mail,details:await call('getMailDemoDetailsUi',[mail.id],150000)}));
const topics=new Map(),errors=[];

for(const entry of details){
  if(!entry||entry.error){errors.push(entry?.error||'Unknown news detail error');continue;}
  const {mail,details:detail}=entry;
  const materials=Array.isArray(detail?.materials)?detail.materials:[];
  const rows=Array.isArray(detail?.rows)?detail.rows:[];
  for(const material of materials){
    const key=identity(material.url);if(!key)continue;
    let topic=topics.get(key);
    if(!topic){
      topic={
        title:material.title||('Материал '+(material.id||'')),
        url:material.url||'',
        term:String(material.id||''),
        kind:material.kind==='news'?'news':'art',
        group:String(mail.product||'').split(' ')[0]||material.group||'',
        red:0,yellow:0,green:0,
        byWeek:{},
        letters:[],
        evidenceKeys:new Set()
      };
      topics.set(key,topic);
    }
    if(String(material.title||'').length>String(topic.title||'').length)topic.title=material.title;
    if(!topic.letters.some(x=>x.id===mail.id))topic.letters.push({id:mail.id,subject:mail.subject||'',url:mail.sendsay||'',date:mail.date||''});
  }
  for(const row of rows){
    const key=identity(row.url);if(!key)continue;
    let topic=topics.get(key);
    if(!topic){
      topic={
        title:row.title||('Материал '+(row.term||'')),
        url:row.url||'',
        term:String(row.term||''),
        kind:/^news$/i.test(String(row.content||''))?'news':'art',
        group:String(mail.product||'').split(' ')[0]||String(row.product||'').split(' ')[0],
        red:0,yellow:0,green:0,byWeek:{},letters:[],evidenceKeys:new Set()
      };
      topics.set(key,topic);
    }
    const evidenceKey=[row.product,row.sourceUrl].join('|');
    if(topic.evidenceKeys.has(evidenceKey))continue;
    topic.evidenceKeys.add(evidenceKey);
    for(const w of row.weeks||[]){
      const wk=String(w.week);
      if(!topic.byWeek[wk])topic.byWeek[wk]={red:0,yellow:0,green:0};
      for(const metric of ['red','yellow','green']){
        const value=n(w[metric]);
        topic.byWeek[wk][metric]+=value;
        topic[metric]+=value;
      }
    }
  }
}

const cleanTopics=[...topics.values()].map(topic=>{
  delete topic.evidenceKeys;
  return {...topic,total:topic.red+topic.yellow+topic.green};
}).sort((a,b)=>b.green-a.green||b.total-a.total||String(a.title).localeCompare(String(b.title),'ru'));
const weeks=[...new Set(cleanTopics.flatMap(t=>Object.keys(t.byWeek).map(Number)))].filter(Boolean).sort((a,b)=>a-b);

const newsSnapshot={
  generatedAt,
  period:{from:recent.from||'',to:recent.to||'',days:recent.days||7},
  periodLabel:recent.from&&recent.to?recent.from+' — '+recent.to:'последние 7 дней',
  mailsChecked:news.length,
  successfulDetails:details.filter(x=>x&&!x.error).length,
  errors:[...new Set(errors)],
  weeks,
  topics:cleanTopics
};
await fs.writeFile('news-demo-current.json',JSON.stringify(newsSnapshot,null,2)+'\n','utf8');

console.log(JSON.stringify({
  demandEvidence:(demand.evidence||[]).length,
  demandMeta:demand.meta||{},
  newsMails:news.length,
  newsTopics:cleanTopics.length,
  newsErrors:newsSnapshot.errors.length,
  weeks
}));
