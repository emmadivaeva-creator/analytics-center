/** Read-only dashboard sources and JSON-safe call results. */
function getVikaPlanUi(sheetId) {
  requireDashboardOwner_();
  const book = SpreadsheetApp.openById('14mGKHyMFU45br5x5F5QqKhSIb590WtbBZcMARKZ3IVo');
  const sheets = book.getSheets().filter(s => /^1\.2 План для Вики/.test(s.getName()) && !s.isSheetHidden());
  const plans = sheets.map(s => { const title=s.getRange(1,1).getDisplayValue(); const m=title.match(/(\d{1,2})[−–-]?[яй]?\s*недел/i); return {id:s.getSheetId(),name:s.getName(),week:m?Number(m[1]):0}; });
  const week=isoWeek_(todayIso_());
  const selected=sheetId?plans.find(p=>String(p.id)===String(sheetId)):(plans.find(p=>p.week===week)||plans.slice().sort((a,b)=>b.week-a.week)[0]);
  if(!selected)throw new Error('План для Вики не найден.');
  const sheet=sheets.find(s=>s.getSheetId()===selected.id);
  const rows=sheet.getRange(1,1,Math.max(4,sheet.getLastRow()),14).getDisplayValues();
  const header=rows.findIndex(r=>r[0]==='Дата'&&r[1]==='Продукт / поток');
  if(header<0)throw new Error('В плане не найдена строка заголовков.');
  return {plans:plans,selected:selected,title:rows[0][0],headers:rows[header],rows:rows.slice(header+1).filter(r=>r.some(Boolean)),sourceUrl:book.getUrl()+'#gid='+selected.id,readAt:new Date().toISOString()};
}
function getCallsDataUi(filters) {
  requireDashboardOwner_();
  return JSON.parse(JSON.stringify(getCallsData(filters||{})));
}
function getCallTopicDetailUi(name,kind,filters) {
  requireDashboardOwner_();
  const detail=getCallTopicDetail(name,kind,filters||{});
  const target=callsNorm_(name);
  const records=callsJoinedRecords_(openStorage_(),filters||{}).filter(r=>(r.topics||[]).some(t=>callsNorm_(typeof t==='string'?t:t.name)===target));
  const counts=field=>{const out={};records.forEach(r=>(r[field]||[]).forEach(t=>{out[t]=(out[t]||0)+1;}));return callsTopPairs_(out,12);};
  detail.objections=counts('objections');
  detail.arguments=counts('arguments');
  return JSON.parse(JSON.stringify(detail));
}

function requireDashboardOwner_() {
  const viewer=String(Session.getActiveUser().getEmail()||'').toLowerCase();
  const owner=String(Session.getEffectiveUser().getEmail()||'').toLowerCase();
  if(!viewer||viewer!==owner)throw new Error('Войдите в аккаунт владельца аналитики для доступа к плану и расшифровкам.');
}

function getMailRegistryUi() {
  requireDashboardOwner_();
  const storage=openStorage_();
  const emails=readImportedEmails_(storage);
  const sheet=storage.getSheetByName(APP.sendsaySheet);
  const values=sheet?sheet.getDataRange().getDisplayValues():[];
  if(values.length>1){
    const headers=values[0];
    const col=name=>headers.indexOf(name);
    const byId={};
    values.slice(1).forEach((row,i)=>{byId['import-'+(row[col('File ID')]||i+1)]=row;});
    emails.forEach(mail=>{
      const row=byId[mail.id];if(!row)return;
      const count=name=>{const value=row[col(name)];return value==null||String(value).trim()===''?null:number_(value);};
      const delivered=count('Доставлено'),opens=count('Уник. открытия'),clicks=count('Уник. клики');
      mail.openRate=delivered>0&&opens!==null?round_(opens/delivered*100,2):null;
      mail.clickRate=delivered>0&&clicks!==null?round_(clicks/delivered*100,2):null;
      mail.ctor=opens>0&&clicks!==null?round_(clicks/opens*100,2):null;
    });
  }
  return {emails:dashboardMatchMails_(emails,dashboardDemoRows_(false))};
}

/** Read current source rows; keep campaign facts and referer material facts separate. */
function dashboardDemoRows_(reference) {
  const book=demoStatsSpreadsheet_();
  const specs=reference?[
    {name:'Новостные ДЕМО пер',family:'Периодика'},
    {name:'Статейные Демо СС',family:'Система'},
    {name:'Новостные демо Школа',family:'Школа'}
  ]:APP.demoSheets;
  const out=[];
  specs.forEach(spec=>{
    const sheet=book.getSheetByName(spec.name);
    if(!sheet)throw new Error('Нет листа '+spec.name);
    const rows=sheet.getDataRange().getDisplayValues();
    const h=rows.findIndex(r=>norm_(r[0])==='издательская группа'&&/^utm /i.test(r[1]||''));
    if(h<1)throw new Error('Не найдены заголовки '+spec.name);
    const columns=[],seen={};
    rows[h].forEach((v,c)=>{const metric=demoMetric_(v),m=String(rows[h-1][c]||'').match(/^\s*(\d{1,2})\s*$/);if(!metric||!m||seen[m[1]+'|'+metric])return;seen[m[1]+'|'+metric]=true;columns.push({c,metric,week:Number(m[1])});});
    rows.slice(h+1).forEach((r,i)=>{
      const group=demoGroup_(r[0]),key=String(r[1]||'').trim(),term=String(r[2]||'').trim();
      if(!group||!key||/итог/i.test(key)||(reference&&/итог/i.test(term)))return;
      const weeks={};columns.forEach(col=>{if(!weeks[col.week])weeks[col.week]={week:col.week,red:0,yellow:0,green:0};weeks[col.week][col.metric]+=number_(r[col.c]);});
      out.push({product:group+' '+spec.family,key,term:reference?term:'',weeks:Object.values(weeks),source:spec.name,sourceUrl:book.getUrl()+'#gid='+sheet.getSheetId()+'&range=A'+(h+i+2)});
    });
  });
  return out;
}
function dashboardMatchMails_(emails,facts) {
  const byCampaign={};facts.forEach(r=>{const k=demoCampaignKey_(r.key);(byCampaign[k]||(byCampaign[k]=[])).push(r);});
  const counts={};emails.forEach(m=>{const k=demoCampaignKey_(m.campaign);counts[k]=(counts[k]||0)+1;});
  emails.forEach(mail=>{
    const matches=byCampaign[demoCampaignKey_(mail.campaign)]||[];
    mail.demoEvidence=[];mail.red=0;mail.yellow=0;mail.green=0;
    matches.forEach(r=>{const weeks=r.weeks.filter(w=>w.week>=mail.week);if(!weeks.length)return;const totals={red:0,yellow:0,green:0};weeks.forEach(w=>['red','yellow','green'].forEach(k=>totals[k]+=w[k]));mail.demoEvidence.push({product:r.product,campaign:r.key,source:r.source,sourceUrl:r.sourceUrl,weeks,...totals});['red','yellow','green'].forEach(k=>mail[k]+=totals[k]);});
    mail.hasDemoData=mail.demoEvidence.length>0;
    mail.potential=mail.yellow+mail.green;
    mail.note=mail.hasDemoData?'Совпадение Campaign с исходной статистикой. Результат с недели отправки, включая последующие недели.'+(counts[demoCampaignKey_(mail.campaign)]>1?' Одна метка встречается у нескольких записей отправки; результат общий для метки.':''):'В листах «Факт» нет совпадения Campaign в доступных неделях. Проверка материалов по Content / Term доступна ниже.';
  });
  return emails;
}
function getMailDemoDetailsUi(id) {
  requireDashboardOwner_();
  const mail=readImportedEmails_(openStorage_()).find(m=>m.id===id);
  if(!mail)throw new Error('Письмо не найдено');
  const fileId=String(id).replace(/^import-/,'');
  const raw=DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8').replace(/=\r?\n/g,'').replace(/=([a-f0-9]{2})/gi,(_,h)=>String.fromCharCode(parseInt(h,16))).replace(/&amp;/g,'&');
  const links=raw.match(/https?:\/\/[^\s<>"']+/g)||[];
  const materials={};
  links.forEach(url=>{const m=url.match(/^https?:\/\/(?:www\.)?(?:budgetnik\.ru|pro-goszakaz\.ru)\/(art|news)\/(\d+)(?:-|[/?#]|$)/i);if(m)materials[m[2]]={id:m[2],kind:m[1].toLowerCase(),url:url};});
  const group=String(mail.product).split(' ')[0];
  const rows=dashboardDemoRows_(true).filter(r=>r.product.split(' ')[0]===group&&materials[r.term]&&(/^(?:art|article)$/i.test(r.key)?materials[r.term].kind==='art':/^news$/i.test(r.key)&&materials[r.term].kind==='news')).map(r=>({product:r.product,content:r.key,term:r.term,url:materials[r.term].url,source:r.source,sourceUrl:r.sourceUrl,values:r.weeks.find(w=>w.week===mail.week)||null}));
  return {week:mail.week,materials:Object.values(materials),rows,note:'Результат материалов за неделю отправки по всем реферам в исходном листе. Это связь письма с материалом; общий результат материала не является отдельным результатом каждого письма.'};
}
