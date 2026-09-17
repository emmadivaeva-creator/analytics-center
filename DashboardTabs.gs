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
  return {emails:emails};
}
