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

// Canonical source: "Новостные ДЕМО пер", UTM Content=news + numeric Term.
// A newsletter's subject, HTML, links and send date are never used to infer
// DEMO performance for a news article.
const readJson=async(path,fallback)=>{
 try{return JSON.parse(await fs.readFile(path,'utf8'));}
 catch(error){if(error.code==='ENOENT')return fallback;throw error;}
};
function validateTermPivot(data){
 if(!data||data.schemaVersion!==3||data.sourceType!=='pivot-term'||
    data.sourceSheet!=='Новостные ДЕМО пер'||!Array.isArray(data.topics)||
    !data.topics.length||!Array.isArray(data.weeks)||data.weeks[0]!==27)
   throw new Error('Invalid news UTM Term pivot response');
 const seen=new Set(),sum={red:0,yellow:0,green:0};
 for(const row of data.topics){
  const term=String(row.term||''),group=row.group;
  if(!/^\d{5,8}$/.test(term)||!['ГЗ','ГФ'].includes(group))
   throw new Error('Invalid news group or Term');
  const key=group+'|'+term;
  if(seen.has(key))throw new Error('Duplicate news Term '+key);
  seen.add(key);
  const url=(group==='ГЗ'?'https://www.pro-goszakaz.ru/news/':'https://www.budgetnik.ru/news/')+term;
  if(row.url!==url)throw new Error('News link mismatch for '+key);
  for(const metric of ['red','yellow','green']){
   const total=data.weeks.reduce((acc,week)=>acc+n(row.byWeek?.[week]?.[metric]),0);
   if(total!==n(row[metric]))throw new Error('News weekly count mismatch for '+key);
   sum[metric]+=total;
  }
  if(n(row.total)!==n(row.red)+n(row.yellow)+n(row.green))
   throw new Error('News total mismatch for '+key);
  if(row.letters?.length)throw new Error('Newsletter is not an eligible Term evidence source');
 }
 if(data.termsTotal!==data.topics.length||
    Object.keys(sum).some(k=>sum[k]!==n(data.totals?.[k])))
   throw new Error('News pivot summary does not match source Term rows');
 return sum;
}
try{
 const latest=await call('getNewsDemoTermsUi',[],180000);
 const totals=validateTermPivot(latest);
 await fs.writeFile('news-demo-current.json',JSON.stringify({...latest,generatedAt},null,2)+'\n','utf8');
 console.log('NEWS_UTM_TERM_REFRESH',JSON.stringify({count:latest.topics.length,weeks:latest.weeks,totals}));
}catch(error){
 // Until the owner deploys the new server method, keep the direct, verified
 // Google Sheets snapshot. Never resurrect stale newsletter-derived numbers.
 const existing=await readJson('news-demo-current.json',null);
 if(!existing||existing.schemaVersion!==3||existing.sourceType!=='pivot-term')
  throw new Error('No trusted news Term snapshot: '+String(error.message||error));
 const totals=validateTermPivot(existing);
 console.warn('NEWS_TERM_REFRESH_UNAVAILABLE_PRESERVED',String(error.message||error),JSON.stringify(totals));
}
