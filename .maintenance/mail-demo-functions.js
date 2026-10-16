// Verified direct DEMO facts are refreshed separately from the Sendsay archive.
const MAIL_DEMO_BUILD_='20261016-demo-match-01';
let mailDemoPromise=null,mailDemoTimer=null,mailDemoState='idle',mailDemoMessage='';
function mailSendingId_(value){return String(value||'').replace(/^import-/,'');}
function mailEvidenceCellKey_(e,w){
 return JSON.stringify([e.sourceUrl||e.source||'',e.product||'',e.campaign||'',Number(w.week)]);
}
function mailDemoTotals_(rows){
 const cells=new Map(),evidence=new Map();let checked=0,unmatched=0;
 (rows||[]).forEach(m=>{
  if(m.demoVerifiedBuild!==MAIL_DEMO_BUILD_)return;
  checked++;if(!m.hasDemoData)unmatched++;
  (m.demoEvidence||[]).forEach(e=>{
   const ek=JSON.stringify([e.sourceUrl||e.source||'',e.product||'',e.campaign||'']);
   let entry=evidence.get(ek);
   if(!entry){entry={...e,weeks:[],red:0,yellow:0,green:0};evidence.set(ek,entry);}
   (e.weeks||[]).forEach(w=>{
    const key=mailEvidenceCellKey_(e,w);if(cells.has(key))return;
    const cell={week:Number(w.week),red:n(w.red),yellow:n(w.yellow),green:n(w.green)};
    cells.set(key,cell);entry.weeks.push(cell);
    for(const k of ['red','yellow','green'])entry[k]+=cell[k];
   });
  });
 });
 const result={red:0,yellow:0,green:0,checked,unmatched,evidence:[...evidence.values()]};
 cells.forEach(w=>{for(const k of ['red','yellow','green'])result[k]+=w[k];});
 return result;
}
function applyMailDemoEvidence_(emails,data){
 if(!data||data.ok!==true||!Array.isArray(data.evidence))throw new Error('Сервер не вернул проверенный DEMO-факт. Старые значения сохранены.');
 const bySending=new Map(),readAt=String(data.readAt||new Date().toISOString());
 const count=value=>{const x=Number(value);if(!Number.isFinite(x)||x<0)throw new Error('В DEMO-факте некорректное число. Значения не изменены.');return x;};
 data.evidence.forEach(f=>{
  if(!f||!Array.isArray(f.sendings)||!Array.isArray(f.weeks)||!f.product||!f.factCampaign)throw new Error('Неполная запись DEMO. Значения не изменены.');
  const weeks=f.weeks.map(w=>{
   if(!w||!Number.isInteger(Number(w.week))||Number(w.week)<1||Number(w.week)>53)throw new Error('Некорректная неделя DEMO.');
   return {week:Number(w.week),red:count(w.red),yellow:count(w.yellow),green:count(w.green)};
  });
  const seen=new Set();
  f.sendings.forEach(s=>{
   const id=mailSendingId_(s&&s.id);if(!id||seen.has(id))return;seen.add(id);
   if(!bySending.has(id))bySending.set(id,[]);
   bySending.get(id).push({fact:f,weeks});
  });
 });
 // Prepare the entire result before mutating the displayed archive.
 const changes=[];
 (emails||[]).filter(m=>!isNewsMail(m)).forEach(m=>{
  const week=mailWeek_(m);if(!week)throw new Error('У письма не определена неделя отправки.');
  const evidence=[];
  (bySending.get(mailSendingId_(m.id))||[]).forEach(({fact:f,weeks})=>{
   if(String(f.product)!==String(m.product))return;
   const eligible=weeks.filter(w=>w.week>=week);
   if(!eligible.length)return;
   evidence.push({product:f.product,campaign:f.factCampaign,source:f.demoSource,sourceUrl:f.demoSourceUrl,weeks:eligible});
  });
  const sums=mailDemoTotals_([{demoVerifiedBuild:MAIL_DEMO_BUILD_,hasDemoData:evidence.length>0,demoEvidence:evidence}]);
  changes.push({m,fields:{red:sums.red,yellow:sums.yellow,green:sums.green,potential:sums.yellow+sums.green,
   demoEvidence:sums.evidence,hasDemoData:sums.evidence.length>0,demoVerifiedBuild:MAIL_DEMO_BUILD_,demoCheckedAt:readAt,
   demoMatchStatus:sums.evidence.length?'Связано по фактическому ID отправки и Campaign':'Нет точного сопоставления Campaign',
   note:sums.evidence.length?'DEMO из исходной статистики: с недели отправки, включая последующие недели. Один факт Campaign учитывается в сводке один раз.':'В доступном DEMO-факте точная связь с этой отправкой не найдена. Это не подтверждение нулевой эффективности письма.'}});
 });
 changes.forEach(({m,fields})=>Object.assign(m,fields));
 return {readAt,checked:changes.length,matched:changes.filter(x=>x.fields.hasDemoData).length};
}
function mailDirectDemoHtml_(m){
 if(m.demoVerifiedBuild!==MAIL_DEMO_BUILD_)return '<small>DEMO ожидают проверки</small>';
 if(!m.hasDemoData)return '<small>Нет точного сопоставления Campaign</small>';
 return 'R '+fmt(m.red)+' / Y '+fmt(m.yellow)+' / G '+fmt(m.green)+'<small>Прямые DEMO по Campaign</small>';
}
function ensureMailDemoUi_(){
 if(!document.getElementById('mailDemoReload')){
  const anchor=document.getElementById('mailReloadAll');if(!anchor)return;
  const button=document.createElement('button');button.type='button';button.id='mailDemoReload';button.textContent='Обновить DEMO';
  button.onclick=()=>refreshMailDemo_();anchor.after(button);
  const status=document.createElement('p');status.id='mailDemoStatus';status.setAttribute('role','status');
  document.getElementById('mailStatus').after(status);
 }
 const button=document.getElementById('mailDemoReload'),status=document.getElementById('mailDemoStatus');
 if(button)button.disabled=mailDemoState==='loading'||!registryData;
 if(status)status.textContent=mailDemoMessage||'Прямые DEMO проверяются отдельно от загрузки писем. Content / Term показывает результат материалов, а не письма.';
}
function scheduleMailDemoCheck_(){
 ensureMailDemoUi_();clearTimeout(mailDemoTimer);
 mailDemoTimer=setTimeout(()=>refreshMailDemo_(),150);
}
async function refreshMailDemo_(){
 if(mailDemoPromise)return mailDemoPromise;
 if(!registryData)return;
 const current=registryData;
 mailDemoState='loading';mailDemoMessage='Читаю свежую «Статистику по ДЕМО» и проверяю точные связи с письмами…';ensureMailDemoUi_();
 mailDemoPromise=(async()=>{
  try{
   const data=await rpc('getDemandEvidenceUi');
   if(current!==registryData)return;
   const result=applyMailDemoEvidence_(current,data);
   mailDemoState='ready';mailDemoMessage='DEMO проверены '+dateRu(result.readAt)+' · сопоставлено '+fmt(result.matched)+' из '+fmt(result.checked)+' отправок. Без точной связи: '+fmt(result.checked-result.matched)+'.';
   renderRegistries();scheduleRegistryCacheSave_();
  }catch(e){
   mailDemoState='error';mailDemoMessage='Не удалось обновить DEMO: '+String(e&&e.message||e)+'. Предыдущие значения сохранены; свежесть DEMO не подтверждена.';
  }finally{
   mailDemoPromise=null;ensureMailDemoUi_();
   if(current!==registryData&&registryData)scheduleMailDemoCheck_();
  }
 })();
 return mailDemoPromise;
}
function mailMaterialIds_(value){
 const raw=String(value||'');
 return [...new Set((raw.startsWith('logical:')?raw.slice(8).split(','):[raw]).filter(Boolean))];
}
