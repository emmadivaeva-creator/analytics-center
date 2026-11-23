/** Deterministic cumulative NEWS materials model. No remote calls or user data. */
export const NEWS_START = '2026-06-29';
export function asNum(value) {
  const n=Number(value);
  return Number.isFinite(n)&&n>=0?n:0;
}
export function issueId(raw) {
  const id=String(raw||'').trim();
  const m=id.match(/(?:^|-)api:(52|61):(\d+)$/);
  return m?'import-api:'+m[1]+':'+m[2]:'';
}
export function newsCampaign(raw) {
  return /^(?:Gosfinansi_letter_news_GF_digest|letter_news_goszakaz_regular_news_digest)(?:_|$)/i.test(String(raw||''));
}
export function normalizeIssue(raw) {
  const id=issueId(raw?.id||raw?.fileId);
  const date=String(raw?.date||'').slice(0,10);
  const campaign=String(raw?.campaign||'').trim();
  if(!id||!/^2026-\d\d-\d\d$/.test(date)||date<NEWS_START||!newsCampaign(campaign))return null;
  return {id,date,product:String(raw.product||''),campaign,subject:String(raw.subject||''),sendsay:String(raw.sendsay||'')};
}
export function isoWeek(dateValue) {
  const d=new Date(String(dateValue||'')+'T12:00:00Z');
  if(!Number.isFinite(d.getTime()))return 0;
  d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));
  return Math.ceil((((d-new Date(Date.UTC(d.getUTCFullYear(),0,1)))/86400000)+1)/7);
}
export function urlIdentity(raw) {
  return String(raw||'').trim().replace(/^https?:\/\/(?:www\.)?/i,'').split(/[?#]/)[0].replace(/\/$/,'');
}
export function mergeIssues(existing, latest) {
  const merged=new Map();
  for(const entry of [...(existing||[]),...(latest||[])]) {
    const mail=normalizeIssue(entry);
    if(!mail)continue;
    const prev=merged.get(mail.id);
    if(!prev||(!prev.subject&&mail.subject)||(!prev.sendsay&&mail.sendsay))merged.set(mail.id,mail);
  }
  return [...merged.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
function bestTitle(topic,title) {
  const t=String(title||'').trim();
  if(t.length>topic.title.length)topic.title=t;
}
export function buildNewsSummary(inventory, archive, generatedAt=new Date().toISOString()) {
  const issues=mergeIssues(inventory?.emails||[],[]);
  const byId=new Map(issues.map(mail=>[mail.id,mail]));
  const recordMap=archive?.results||{};
  const topics=new Map();
  let count=0;
  const processedWeeks={};
  const weeklyExpected={};
  for(let week=27;week<=53;week++){processedWeeks[week]=0;weeklyExpected[week]=0;}
  for(const m of issues){const wk=isoWeek(m.date);if(wk>=27&&wk<=53)weeklyExpected[wk]++;}
  for(const [id,record] of Object.entries(recordMap)){
    const mail=byId.get(id);
    if(!mail||!Array.isArray(record.materials)||!Array.isArray(record.rows))continue;
    count++;
    const w=isoWeek(mail.date);
    if(w>=27&&w<=53)processedWeeks[w]++;
    for(const m of record.materials) {
      const url=String(m.url||'');
      const key=urlIdentity(url);
      if(!key)continue;
      let topic=topics.get(key);
      if(!topic){
        topic={title:String(m.title||('Материал '+String(m.id||''))),url,term:String(m.id||''),kind:String(m.kind||'')==='news'?'news':'art',group:mail.product.split(' ')[0]||String(m.group||''),red:0,yellow:0,green:0,byWeek:{},letters:[],seenKeys:new Set()};
        topics.set(key,topic);
      }
      bestTitle(topic,m.title);
      if(!topic.letters.some(x=>x.id===id))topic.letters.push({id,subject:mail.subject,url:mail.sendsay,date:mail.date});
    }
    for(const row of record.rows) {
      const url=String(row.url||'');
      const key=urlIdentity(url);
      if(!key)continue;
      let topic=topics.get(key);
      if(!topic){
        topic={title:String(row.title||('Материал '+String(row.term||''))),url,term:String(row.term||''),kind:/^news$/i.test(String(row.content||''))?'news':'art',group:mail.product.split(' ')[0]||String(row.product||'').split(' ')[0],red:0,yellow:0,green:0,byWeek:{},letters:[],seenKeys:new Set()};
        topics.set(key,topic);
      }
      bestTitle(topic,row.title);
      if(!topic.letters.some(x=>x.id===id))topic.letters.push({id,subject:mail.subject,url:mail.sendsay,date:mail.date});
      const evidenceKey=String(row.product||'')+'|'+String(row.sourceUrl||'');
      if(topic.seenKeys.has(evidenceKey))continue;
      topic.seenKeys.add(evidenceKey);
      for(const wk of row.weeks||[]){
        const numWeek=Number(wk.week);
        if(!Number.isInteger(numWeek)||numWeek<27||numWeek>53)continue;
        if(!topic.byWeek[numWeek])topic.byWeek[numWeek]={red:0,yellow:0,green:0};
        for(const metric of ['red','yellow','green']){
          const v=asNum(wk[metric]);
          topic.byWeek[numWeek][metric]+=v;
          topic[metric]+=v;
        }
      }
    }
  }
  const allTopics=[...topics.values()].map(topic=>{
    delete topic.seenKeys;
    topic.letters.sort((a,b)=>b.date.localeCompare(a.date));
    return {...topic,total:topic.red+topic.yellow+topic.green};
  }).sort((a,b)=>b.green-a.green||b.total-a.total||a.title.localeCompare(b.title,'ru'));
  const lastDate=issues.reduce((a,m)=>m.date>a?m.date:a,'');
  const weeks=Array.from({length:Math.max(1,Math.min(53,isoWeek(lastDate)||27)-26)},(_,i)=>i+27);
  const missing=issues.length-count;
  const coverage=weeks.map(week=>({week,expected:weeklyExpected[week],processed:processedWeeks[week],complete:weeklyExpected[week]===processedWeeks[week]}));
  const sourceStart=NEWS_START,through=lastDate||NEWS_START;
  return {
    schemaVersion:2,generatedAt,
    period:{from:sourceStart,to:through,days:0},
    periodLabel:'с 29.06.2026 по '+through,
    latestNewsletterDate:lastDate,
    mailsTotal:issues.length,mailsChecked:count,successfulDetails:count,processedCount:count,
    pendingCount:missing,archiveComplete:missing===0,
    sourceMissingWeeks:inventory?.missingEarlyWeeks||[],
    weeklyCoverage:coverage,
    errors:Object.values(archive?.failures||{}).map(x=>String(x.message||x)).slice(0,12),
    weeks,topics:allTopics
  };
}
