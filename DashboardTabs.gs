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
  const planRows=rows.slice(header+1).filter(function(r){
    if(!r.some(Boolean))return false;
    const flow=String(r[1]||'');
    return !/АПФАС|ГЗВИО|ГЗ Периодика\s*[·-]\s*(?:ВИО|ФАС)/i.test(flow);
  });
  return {plans:plans,selected:selected,title:rows[0][0],headers:rows[header],rows:planRows,sourceUrl:book.getUrl()+'#gid='+selected.id,readAt:new Date().toISOString()};
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
  if (typeof PUBLIC_DASHBOARD_READ_ !== "undefined" && PUBLIC_DASHBOARD_READ_) return;
  const viewer=String(Session.getActiveUser().getEmail()||'').toLowerCase();
  const owner=String(Session.getEffectiveUser().getEmail()||'').toLowerCase();
  if(!viewer||viewer!==owner)throw new Error('Войдите в аккаунт владельца аналитики для доступа к плану и расшифровкам.');
}

function getMailRegistryUi() {
  requireDashboardOwner_();
  const emails=readImportedEmails_(openStorage_());
  return {
    emails:dashboardMatchMails_(emails,dashboardDemoRows_(false)),
    mode:'full',
    readAt:new Date().toISOString()
  };
}

function getMailRegistryRecentUi(days) {
  requireDashboardOwner_();

  const count=Math.max(1,Math.min(7,Number(days)||3));
  const to=todayIso_();
  const from=shiftIsoDate_(to,-(count-1));

  const emails=readImportedEmails_(openStorage_()).filter(function(mail){
    return mail.date>=from&&mail.date<=to;
  });

  return {
    emails:dashboardMatchMails_(emails,dashboardDemoRows_(false)),
    mode:'recent',
    days:count,
    from:from,
    to:to,
    readAt:new Date().toISOString()
  };
}


/**
 * Читает полный реестр писем порциями, чтобы браузеру не приходилось
 * ждать один гигантский ответ Apps Script. offset — смещение по физическим
 * строкам листа _Sendsay v2. Размер порции фиксирован на сервере.
 */
function getMailRegistryPageUi(offset) {
  requireDashboardOwner_();

  const storage=openStorage_();
  const sheet=storage.getSheetByName(APP.sendsaySheet);
  const start=Math.max(0,Number(offset)||0);
  const pageSize=2000;

  if(!sheet||sheet.getLastRow()<2){
    return {emails:[],offset:start,nextOffset:start,done:true,totalRows:0,readAt:new Date().toISOString()};
  }

  const lastRow=sheet.getLastRow();
  const lastCol=sheet.getLastColumn();
  const totalRows=Math.max(0,lastRow-1);
  if(start>=totalRows){
    return {emails:[],offset:start,nextOffset:start,done:true,totalRows:totalRows,readAt:new Date().toISOString()};
  }

  const header=sheet.getRange(1,1,1,lastCol).getDisplayValues()[0];
  const count=Math.min(pageSize,totalRows-start);
  const values=sheet.getRange(2+start,1,count,lastCol).getDisplayValues();
  const emails=dashboardMailPageRows_(header,values,start);

  return {
    emails:dashboardMatchMails_(emails,dashboardDemoRows_(false)),
    offset:start,
    nextOffset:start+count,
    done:start+count>=totalRows,
    totalRows:totalRows,
    readAt:new Date().toISOString()
  };
}

function dashboardMailPageRows_(header,rows,physicalOffset) {
  const headers=headerMap_(header);
  const col=function(aliases){return indexOfHeader_(headers,aliases);};
  const idx={
    fileId:col(['file id']),
    fileName:col(['имя файла']),
    status:col(['статус']),
    campaignId:col(['campaign id']),
    date:col(['дата отправки']),
    time:col(['время отправки']),
    type:col(['тип']),
    product:col(['продукт']),
    flow:col(['поток']),
    segment:col(['сегмент']),
    campaign:col(['campaign']),
    sendsay:col(['sendsay']),
    subject:col(['тема письма']),
    sent:col(['отправлено']),
    delivered:col(['доставлено']),
    uniqueOpened:col(['уник. открытия']),
    openRate:col(['or']),
    clicks:col(['уник. клики']),
    clickRate:col(['click rate']),
    ctor:col(['ctor']),
    demoStatus:col(['demo статус']),
    demoSource:col(['demo источник']),
    red:col(['demo r']),
    yellow:col(['demo y']),
    green:col(['demo g'])
  };

  const output=[];
  rows.forEach(function(row,i){
    if(String(valueAt_(row,idx.status)||'')!=='Готово')return;

    const sourceId=String(valueAt_(row,idx.fileId)||'').trim();
    if(!/^api:/i.test(sourceId))return;
    const fileName=String(valueAt_(row,idx.fileName)||'').trim();
    const campaign=String(valueAt_(row,idx.campaign)||'').trim();
    const isNews=canonicalNewsCampaign_(campaign);
    const demoStatus=String(valueAt_(row,idx.demoStatus)||'').trim();
    const hasDemoData=demoStatus==='Связано точно';
    const campaignText=fileName+' '+campaign+' '+String(valueAt_(row,idx.type)||'');
    const isTrigger=/trigg?er|триггер/i.test(campaignText);
    const isDemo=norm_(valueAt_(row,idx.type))==='demo'||/(?:^|[_\s|])demo(?:[_\s|]|$)/i.test(campaignText);
    if(!isNews&&isTrigger)return;
    if(!isNews&&!isDemo)return;

    const date=normalizeDate_(valueAt_(row,idx.date));
    const subject=String(valueAt_(row,idx.subject)||'').trim();
    if(!date||!subject)return;

    const product=normalizeProduct_(valueAt_(row,idx.product))||'Не указано';
    const red=hasDemoData?number_(valueAt_(row,idx.red)):0;
    const yellow=hasDemoData?number_(valueAt_(row,idx.yellow)):0;
    const green=hasDemoData?number_(valueAt_(row,idx.green)):0;
    const sent=number_(valueAt_(row,idx.sent));
    const delivered=number_(valueAt_(row,idx.delivered));
    const uniqueOpened=number_(valueAt_(row,idx.uniqueOpened));
    const clicks=number_(valueAt_(row,idx.clicks));
    const openRate=delivered>0?round_(uniqueOpened/delivered*100,2):percent_(valueAt_(row,idx.openRate));
    const clickRate=delivered>0?round_(clicks/delivered*100,2):percent_(valueAt_(row,idx.clickRate));
    const ctor=uniqueOpened>0?round_(clicks/uniqueOpened*100,2):percent_(valueAt_(row,idx.ctor));

    output.push({
      id:'import-'+String(valueAt_(row,idx.fileId)||physicalOffset+i+1),
      bodyRef:String(valueAt_(row,idx.fileId)||'').replace(/^api:/i,''),
      importedOnly:true,
      hasDemoData:hasDemoData,
      date:date,
      time:String(valueAt_(row,idx.time)||'').trim(),
      week:isoWeek_(date),
      type:String(valueAt_(row,idx.type)||'demo').trim(),
      product:product,
      productFlow:String(valueAt_(row,idx.flow)||product).trim(),
      segment:String(valueAt_(row,idx.segment)||'').trim(),
      campaignId:String(valueAt_(row,idx.campaignId)||'').trim(),
      campaign:campaign,
      sendsay:url_(valueAt_(row,idx.sendsay)),
      subject:subject,
      material:'',
      sent:sent,
      delivered:delivered,
      uniqueOpened:uniqueOpened,
      openRate:openRate,
      clicks:clicks,
      clickRate:clickRate,
      ctor:ctor,
      red:red,
      yellow:yellow,
      green:green,
      potential:yellow+green,
      maturity:hasDemoData?demoMaturity_(date,product):'В статистике DEMO событий нет',
      score:hasDemoData?scoreEmail_(red,yellow,green,openRate,ctor):'DEMO 0 / 0 / 0',
      worked:hasDemoData?workedLabel_(red,yellow,green):'',
      failed:hasDemoData?failedLabel_(red,yellow,green):'',
      source:'Фактический Sendsay',
      demoMatchStatus:demoStatus,
      demoSource:String(valueAt_(row,idx.demoSource)||'').trim(),
      weeklyPlan:0,
      weeklyFact:0,
      weeklyProgress:0,
      note:hasDemoData
        ?'R / Y / G связаны только по точному совпадению Campaign.'
        :(norm_(valueAt_(row,idx.type))==='news'
          ?'Новостному письму не назначаем R / Y / G без точной UTM Content/Term-привязки.'
          :'Campaign отсутствует в фактовой DEMO-таблице: считаем R / Y / G = 0.'),
      body:'',
      innerTitle:'',
      cta:'',
      targetUrl:'',
      rationale:'',
      exclusions:'',
      planStatus:''
    });
  });
  return output;
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
    mail.note=mail.hasDemoData?'Совпадение Campaign с исходной статистикой. Результат с недели отправки, включая последующие недели.'+(counts[demoCampaignKey_(mail.campaign)]>1?' Одна метка встречается у нескольких записей отправки; результат общий для метки.':''):'В фактовой DEMO-таблице событий по Campaign нет: R / Y / G = 0.';
  });
  return emails;
}
function dashboardMaterialRootDomain_(domain) {
  const d=String(domain||'').toLowerCase().replace(/^www\./,'').split(':')[0];
  const roots=[
    'budgetnik.ru',
    'zpbudgetnik.ru',
    'gosfinansy.ru',
    'goszakupkiru.ru',
    'goszakaz-vo.ru',
    'faspraktika.ru',
    '1gzakaz.ru',
    'gzakypki.ru',
    'pro-goszakaz.ru'
  ];
  return roots.find(function(root){return d===root||d.endsWith('.'+root);})||'';
}

function dashboardMaterialGroupByDomain_(domain) {
  const root=dashboardMaterialRootDomain_(domain);
  if(['budgetnik.ru','zpbudgetnik.ru','gosfinansy.ru'].includes(root))return'ГФ';
  if(['pro-goszakaz.ru','goszakupkiru.ru','goszakaz-vo.ru','faspraktika.ru','1gzakaz.ru','gzakypki.ru'].includes(root))return'ГЗ';
  return'';
}

function dashboardMaterialProductByDomain_(domain) {
  const host=String(domain||'').toLowerCase().replace(/^www\./,'').split(':')[0];
  const root=dashboardMaterialRootDomain_(host);

  if(host==='finacademy.budgetnik.ru'||host.endsWith('.finacademy.budgetnik.ru')) {
    return {product:'ГФ Школа',flow:'ГФ Школа'};
  }
  if(root==='gosfinansy.ru') return {product:'ГФ Система',flow:'ГФ Система'};
  if(root==='zpbudgetnik.ru') return {product:'ГФ Периодика',flow:'ГФ Периодика · ЗБУ'};
  if(root==='budgetnik.ru') return {product:'ГФ Периодика',flow:'ГФ Периодика · УБУ'};

  if(host==='academy.gzakypki.ru'||host.endsWith('.academy.gzakypki.ru')) {
    return {product:'ГЗ Школа',flow:'ГЗ Школа'};
  }
  if(root==='1gzakaz.ru') return {product:'ГЗ Система',flow:'ГЗ Система'};
  if(root==='goszakupkiru.ru') return {product:'ГЗ Периодика',flow:'ГЗ Периодика · ГЗРУ'};
  if(root==='goszakaz-vo.ru') return {product:'ГЗ Периодика',flow:'ГЗ Периодика · ВИО'};
  if(root==='faspraktika.ru') return {product:'ГЗ Периодика',flow:'ГЗ Периодика · ФАС'};
  if(root==='pro-goszakaz.ru') return {product:'ГЗ Периодика',flow:'ГЗ Периодика'};

  return {product:'',flow:''};
}

function dashboardMaterials_(raw) {
  raw=String(raw||'')
    .replace(/=\r?\n/g,'')
    .replace(/=3D/gi,'=')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;/gi,'"');

  const materials={};

  function add(url,title){
    const found=(String(url||'').match(/https?:\/\/[^\s"'<>)]*/i)||[])[0]||'';
    if(!found)return;

    const hostMatch=found.match(/^https?:\/\/([^/?#]+)/i);
    if(!hostMatch)return;

    const host=hostMatch[1].toLowerCase().replace(/^www\./,'');
    const root=dashboardMaterialRootDomain_(host);
    if(!root)return;

    const tail=found.slice(hostMatch[0].length);
    let id='';
    let kind='';

    const standard=tail.match(/^\/(art|article|news)\/(\d+)(?:-|[/?#]|$)/i);
    if(standard){
      id=standard[2];
      kind=/^article$/i.test(standard[1])?'art':standard[1].toLowerCase();
    }

    if(!id && /^e\./i.test(host)){
      const short=tail.match(/^\/(\d{5,})(?:[/?#]|$)/);
      if(short){
        id=short[1];
        kind='any';
      }
    }

    if(!id){
      const query=found.match(/[?&](?:id|articleid|newsid|doc_id|docid|term)=(\d{5,})/i);
      if(query){
        id=query[1];
        kind='any';
      }
    }

    if(!id)return;

    const key=root+'|'+kind+'|'+id;
    title=String(title||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    if(/=[A-F0-9]{2}/i.test(title)){
      try{title=decodeURIComponent(title.replace(/%/g,'%25').replace(/=([A-F0-9]{2})/gi,'%$1'));}catch(e){title='';}
    }
    title=title.replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').replace(/&amp;/g,'&');

    if(!materials[key]||title.length>(materials[key].title||'').length){
      materials[key]={
        id:id,
        kind:kind,
        domain:host,
        rootDomain:root,
        group:dashboardMaterialGroupByDomain_(host),
        product:dashboardMaterialProductByDomain_(host).product,
        flow:dashboardMaterialProductByDomain_(host).flow,
        url:found,
        title:title||(kind==='any'?'Материал '+id:kind+' / '+id)
      };
    }
  }

  const anchors=/<a\b[^>]*href\s*=\s*(["'])([\s\S]*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let a;
  while((a=anchors.exec(raw)))add(a[2],a[3]);

  (raw.match(/https?:\/\/[^\s<>"']+/g)||[]).forEach(function(url){add(url,'');});
  return Object.values(materials);
}

function dashboardMaterialRows_(mail,materials,facts){
  const group=String(mail.product).split(' ')[0];
  return facts.filter(r=>r.product.split(' ')[0]===group).flatMap(r=>{
    const kind=/^(?:art|article)$/i.test(r.key)?'art':/^news$/i.test(r.key)?'news':'';
    const material=materials.find(m=>
      m.id===r.term &&
      (m.kind===kind||m.kind==='any') &&
      dashboardMaterialGroupByDomain_(m.domain)===group
    );
    if(!material)return [];
    const totals={red:0,yellow:0,green:0};
    r.weeks.forEach(w=>['red','yellow','green'].forEach(k=>totals[k]+=w[k]));
    return [{
      product:r.product,
      content:r.key,
      term:r.term,
      title:material.title,
      url:material.url,
      source:r.source,
      sourceUrl:r.sourceUrl,
      weeks:r.weeks,
      values:totals
    }];
  });
}
function getMailDemoDetailsUi(id) {
  requireDashboardOwner_();

  const mail=readImportedEmails_(openStorage_()).find(function(item){ return item.id===id; });
  if(!mail)throw new Error('Письмо не найдено');

  const rawId=String(id||'').replace(/^import-/,'');
  const apiMatch=rawId.match(/^api:(52|61):(\d+)$/);
  const cache=CacheService.getScriptCache();
  let cacheKey='';
  let raw='';

  if(apiMatch){
    cacheKey='materials-api-v2-'+apiMatch[1]+'-'+apiMatch[2];
    const cached=cache.get(cacheKey);
    if(cached){
      try{
        const materials=JSON.parse(cached);
        const rows=dashboardMaterialRows_(mail,materials,dashboardDemoRows_(true));
        return {week:mail.week,materials:materials,rows:rows,note:'Ссылки письма прочитаны напрямую из Sendsay API. Демо материалов по Content / Term показано за все доступные недели источника.'};
      }catch(error){}
    }

    const data=sendsayApiRequest_({
      action:'issue.get',
      id:apiMatch[2],
      source:1,
      with_name:1
    },apiMatch[1]);

    const chunks=[];
    (function walk(value,depth){
      if(depth>10||value==null)return;
      if(typeof value==='string'){
        if(value.length>=40&&(/<html|<body|<a\b|href\s*=|https?:\/\//i.test(value)||/content-type:\s*text\/html/i.test(value)))chunks.push(value);
        return;
      }
      if(Array.isArray(value)){value.forEach(function(item){walk(item,depth+1);});return;}
      if(typeof value==='object')Object.keys(value).forEach(function(key){walk(value[key],depth+1);});
    })(data,0);

    chunks.sort(function(a,b){return b.length-a.length;});
    raw=chunks.join('\n');
    if(!raw)throw new Error('Sendsay API не вернул содержимое письма для разбора ссылок.');
  }else{
    try{
      const file=DriveApp.getFileById(rawId);
      cacheKey='materials-drive-v4-'+file.getId()+'-'+file.getLastUpdated().getTime();
      const cached=cache.get(cacheKey);
      if(cached){
        try{
          const materials=JSON.parse(cached);
          const rows=dashboardMaterialRows_(mail,materials,dashboardDemoRows_(true));
          return {week:mail.week,materials:materials,rows:rows,note:'Ссылки письма прочитаны из сохранённого отчёта. Демо материалов по Content / Term показано за все доступные недели источника.'};
        }catch(error){}
      }
      raw=file.getBlob().getDataAsString('UTF-8');
    }catch(error){
      const issueId=String(mail.campaignId||'').trim();
      const policy=/^ГФ\b/.test(String(mail.product||''))?'52':/^ГЗ\b/.test(String(mail.product||''))?'61':'';
      if(!issueId||!policy)throw error;

      cacheKey='materials-api-fallback-v2-'+policy+'-'+issueId;
      const data=sendsayApiRequest_({action:'issue.get',id:issueId,source:1,with_name:1},policy);
      const chunks=[];
      (function walk(value,depth){
        if(depth>10||value==null)return;
        if(typeof value==='string'){
          if(value.length>=40&&(/<html|<body|<a\b|href\s*=|https?:\/\//i.test(value)||/content-type:\s*text\/html/i.test(value)))chunks.push(value);
          return;
        }
        if(Array.isArray(value)){value.forEach(function(item){walk(item,depth+1);});return;}
        if(typeof value==='object')Object.keys(value).forEach(function(key){walk(value[key],depth+1);});
      })(data,0);
      chunks.sort(function(a,b){return b.length-a.length;});
      raw=chunks.join('\n');
      if(!raw)throw new Error('Не удалось прочитать содержимое письма ни с Drive, ни через Sendsay API.');
    }
  }

  const materials=dashboardMaterials_(raw);
  try{cache.put(cacheKey,JSON.stringify(materials),21600);}catch(error){}
  const rows=dashboardMaterialRows_(mail,materials,dashboardDemoRows_(true));

  return {
    week:mail.week,
    materials:materials,
    rows:rows,
    note:'Ссылки письма доступны без обязательного хранения webarchive на Drive. Демо материалов по Content / Term показано за все доступные недели источника.'
  };
}

/** Read editorial originals without changing the approved plan sheet. */
function dashboardEditorialSections_(text) {
  const months=['янв','фев','мар','апр','ма','июн','июл','авг','сен','окт','ноя','дек'];
  const sections=[];let current=null;
  String(text||'').replace(/\r\n?/g,'\n').replace(/\u000b/g,'\n').split('\n').forEach(function(line){
    const raw=String(line||'').trim();
    const m=raw.match(/^(?:(основная|дополнительная)(?:\s+рассылка)?\s+)?(\d{1,2})(?:\s*\.\s*(\d{1,2})\.?|\s+([а-яё]+)\.?)?(?:\s+(20\d{2})(?:\s*г\.?)?)?(?:\s+(актив(?:демо)?|доп|дожим))?\s*$/i);
    if(!m){if(current)current.lines.push(line);return;}
    const month=m[3]?Number(m[3]):m[4]?months.findIndex(function(x){return m[4].toLowerCase().startsWith(x);})+1:0;
    if(!month){if(current)current.lines.push(line);return;}
    const rawKind=String(m[6]||m[1]||'').toLowerCase();
    const kind=/актив/.test(rawKind)?'ACTIVE':/(доп|дожим|дополнительная)/.test(rawKind)?'DOZHIM':'MAIN';
    current={day:Number(m[2]),month:month,year:m[5]?Number(m[5]):null,kind:kind,rawKind:rawKind,lines:[]};
    sections.push(current);
  });
  return sections.map(function(s){
    return Object.assign({},s,{text:s.lines.join('\n').trim()});
  });
}
function dashboardEditorialMatch_(row,sections,kind) {
  const d=String(row[0]||'').match(/^(\d{1,2})\.(\d{1,2})\.(20\d{2})$/);
  if(!d)return null;
  const wanted=kind||'MAIN';
  const found=(sections||[]).filter(function(s){
    return s.day===Number(d[1])&&
      s.month===Number(d[2])&&
      (!s.year||s.year===Number(d[3]))&&
      s.kind===wanted;
  }).filter(function(s){return String(s.text||'').trim();});
  if(!found.length)return {error:wanted==='DOZHIM'?'На эту дату в редакционном источнике нет ДОПа.':'На эту дату в редакционном источнике нет основного письма.'};
  const selected=found.slice().sort(function(a,b){return String(b.text||'').length-String(a.text||'').length;})[0];
  const text=String(selected.text||'').trim();
  const clean=function(v){return String(v||'').toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z0-9]/g,'');};
  return {
    text:text,
    subjectMatches:row[3]?clean(text).includes(clean(row[3])):null,
    date:row[0],
    editorialKind:wanted
  };
}
function vikaTempPlanNorm_(value){
  return String(value||'').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();
}

function vikaTempPlanSource_(product){
  const p=String(product||'').trim();
  const map={
    'УБУ':{sheet:'ТемыГФ_Периодика',subgroup:'УБУ'},
    'ЗБУ':{sheet:'ТемыГФ_Периодика',subgroup:'ЗБУ'},
    'ГФ Система':{sheet:'ТемыГФ_СС'},
    'ГФ Школа':{sheet:'Темы ГФ Школа'},
    'ГЗ Периодика':{sheet:'Тема ГЗ Периодика',docTab:'t.0'},
    'ГЗ Система':{sheet:'Темы ГЗ СС',docTab:'t.f0e9uysqbhge'},
    'ГЗ Школа':{sheet:'Темы ГЗ Школа ',docTab:'t.z5vc00fi70ow'}
  };
  return map[p]||null;
}

function vikaMonthName_(month){
  return ['','январ','феврал','март','апрел','ма','июн','июл','август','сентябр','октябр','ноябр','декабр'][Number(month)||0]||'';
}

function vikaPlanPeriod_(plan){
  const dates=(plan.rows||[]).map(function(r){return String(r[0]||'');}).filter(function(x){return /^\d{2}\.\d{2}\.20\d{2}$/.test(x);});
  if(!dates.length)return null;
  const parse=function(x){const p=x.split('.').map(Number);return {day:p[0],month:p[1],year:p[2]};};
  return {first:parse(dates[0]),last:parse(dates[dates.length-1]),week:Number(plan.selected&&plan.selected.week)||0};
}

function vikaTempPlanBlock_(values,period,subgroup){
  if(!period)return [];
  const weekNeedle=period.week?String(period.week)+' неделя':'';
  const periodNeedle='с '+period.first.day+' по '+period.last.day;
  const monthNeedle=vikaMonthName_(period.first.month);
  const candidates=[];
  (values||[]).forEach(function(row,i){
    const text=vikaTempPlanNorm_((row||[]).slice(0,4).join(' '));
    if(!text)return;
    let score=0;
    if(weekNeedle&&text.indexOf(weekNeedle)>=0)score+=2;
    if(text.indexOf(periodNeedle)>=0)score+=4;
    if(monthNeedle&&text.indexOf(monthNeedle)>=0)score+=1;
    if(score)candidates.push({i:i,score:score});
  });
  if(!candidates.length)return [];
  candidates.sort(function(a,b){return b.score-a.score||b.i-a.i;});
  let start=candidates[0].i;
  let end=values.length;
  for(let i=start+1;i<values.length;i++){
    const text=vikaTempPlanNorm_((values[i]||[]).slice(0,4).join(' '));
    if(/^\d{1,2}\s+неделя/.test(text)||/^с\s+\d{1,2}\s+по\s+\d{1,2}/.test(text)){end=i;break;}
  }
  let block=values.slice(start,end);
  if(subgroup){
    const target=vikaTempPlanNorm_(subgroup);
    let subStart=-1,subEnd=block.length;
    for(let i=0;i<block.length;i++){
      const head=vikaTempPlanNorm_((block[i]||[]).slice(0,4).join(' '));
      if(head===target||head.endsWith(' '+target)||head.indexOf(target)>=0){
        if(subStart<0)subStart=i;
        else if(i>subStart){subEnd=i;break;}
      }
    }
    if(subStart>=0)block=block.slice(subStart,subEnd);
  }
  return block;
}

function vikaTempPlanRecords_(plan){
  const book=SpreadsheetApp.openById('12FtI2gu4lv3x8azRYu8F8aGEFzwi8ESUpUzFlPuipFo');
  const period=vikaPlanPeriod_(plan);
  const byProduct={};
  const productNames=[...new Set((plan.rows||[]).map(function(r){return String(r[1]||'').trim();}).filter(Boolean))];

  productNames.forEach(function(product){
    const spec=vikaTempPlanSource_(product);
    if(!spec)return;
    const sheet=book.getSheetByName(spec.sheet);
    if(!sheet)return;
    const values=sheet.getDataRange().getDisplayValues();
    const block=vikaTempPlanBlock_(values,period,spec.subgroup);
    let currentDay='';
    const records=[];

    block.forEach(function(row){
      const a=vikaTempPlanNorm_(row[0]);
      const b=vikaTempPlanNorm_(row[1]);
      const dayMatch=a.match(/^(пн|вт|ср|чт|пт)$/);
      if(dayMatch)currentDay=dayMatch[1];
      if(!currentDay)return;

      let kind='';
      if(/активдемо/.test(b))kind='ACTIVE';
      else if(/дожим|на\s*13|доп/.test(b))kind='DOZHIM';
      else if(/открыт/.test(b))kind='OPEN';
      else if(dayMatch)kind='MAIN';
      else return;

      if(kind==='ACTIVE'||kind==='OPEN')return;

      const theme=String(row[2]||'').trim();
      const title=String(row[3]||'').trim();
      const text=String(row[4]||'').trim();
      const materialUrl=String(row[5]||'').trim();
      const sendsay=String(row[8]||row[7]||'').trim();
      if(!theme&&!title&&!text&&!materialUrl)return;
      records.push({
        day:currentDay,
        kind:kind,
        theme:theme,
        title:title,
        text:text,
        materialUrl:materialUrl,
        sendsay:sendsay,
        docPointer:/рассылки\s+демо\s+периодика,\s*сс,\s*вшг/i.test(theme),
        sourceUrl:book.getUrl()+'#gid='+sheet.getSheetId()
      });
    });
    byProduct[product]={spec:spec,records:records};
  });
  return byProduct;
}

function vikaDateDay_(value){
  const m=String(value||'').match(/^(\d{2})\.(\d{2})\.(20\d{2})$/);
  if(!m)return '';
  const d=new Date(Date.UTC(Number(m[3]),Number(m[2])-1,Number(m[1])));
  return ['вс','пн','вт','ср','чт','пт','сб'][d.getUTCDay()]||'';
}

function getVikaEditorialUi(sheetId) {
  requireDashboardOwner_();
  const plan=getVikaPlanUi(sheetId);
  const temp=vikaTempPlanRecords_(plan);

  const docId='1Z5xX0To-Q-9f9R0RzIuDQsSTkrv3mfLJlceiWzT0rF4';
  let doc=null,tabs=[],byTab={};
  const needsDoc=(plan.rows||[]).some(function(r){
    const segment=String(r[2]||'');
    if(/АКТИВДЕМО/i.test(segment))return false;
    const product=String(r[1]||'').trim();
    const day=vikaDateDay_(r[0]);
    const kind=/ДОЖИМ/i.test(segment)?'DOZHIM':'MAIN';
    const bucket=temp[product];
    const record=bucket&&(bucket.records||[]).find(function(x){return x.day===day&&x.kind===kind;});
    return Boolean(record&&record.docPointer&&bucket.spec&&bucket.spec.docTab);
  });

  if(needsDoc){
    const url='https://docs.googleapis.com/v1/documents/'+encodeURIComponent(docId)+'?includeTabsContent=true';
    const response=UrlFetchApp.fetch(url,{
      headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},
      muteHttpExceptions:true
    });
    const code=response.getResponseCode();
    if(code!==200)throw new Error('Не удалось прочитать редакционный документ через Google Docs API (HTTP '+code+').');
    try{doc=JSON.parse(response.getContentText());}catch(error){throw new Error('Google Docs API вернул некорректный ответ.');}

    (function collect(items){
      (items||[]).forEach(function(tab){
        if(tab&&tab.tabProperties)tabs.push(tab);
        if(tab&&tab.childTabs)collect(tab.childTabs);
      });
    })(doc.tabs||[]);

    function bodyText(items){
      return (items||[]).map(function(e){
        if(e.paragraph){
          return (e.paragraph.elements||[]).map(function(x){
            const run=x.textRun;
            if(!run)return '';
            const link=run.textStyle&&run.textStyle.link&&run.textStyle.link.url;
            return String(run.content||'')+(link&&!String(run.content||'').includes(link)?' ('+link+')':'');
          }).join('');
        }
        if(e.table){
          return (e.table.tableRows||[]).map(function(r){
            return (r.tableCells||[]).map(function(cell){return bodyText(cell.content);}).join('\n');
          }).join('\n');
        }
        return '';
      }).join('');
    }

    tabs.forEach(function(tab){
      const props=tab.tabProperties||{},id=String(props.tabId||'');
      const body=tab.documentTab&&tab.documentTab.body&&tab.documentTab.body.content;
      if(id)byTab[id]=dashboardEditorialSections_(bodyText(body));
    });
  }

  const rows={};
  (plan.rows||[]).forEach(function(r,i){
    const segment=String(r[2]||'');
    if(/АКТИВДЕМО/i.test(segment))return; // Наши тексты: редакционные источники к ним не применяем.
    if(/АПФАС|ГЗВИО/.test(String(r[1]||'')))return;

    const product=String(r[1]||'').trim();
    const bucket=temp[product];
    if(!bucket)return;
    const kind=/ДОЖИМ/i.test(segment)?'DOZHIM':'MAIN';
    const day=vikaDateDay_(r[0]);
    const record=(bucket.records||[]).find(function(x){return x.day===day&&x.kind===kind;});
    if(!record)return;

    if(record.docPointer&&bucket.spec&&bucket.spec.docTab){
      const match=dashboardEditorialMatch_(r,byTab[bucket.spec.docTab]||[],kind);
      if(!match)return;
      const tab=tabs.find(function(item){
        return item&&item.tabProperties&&String(item.tabProperties.tabId||'')===bucket.spec.docTab;
      });
      rows[i]=Object.assign({},match,{
        subject:record.theme,
        title:record.title,
        materialUrl:record.materialUrl,
        sourceType:'tempplan-doc',
        sourceLabel:'Темплан по демкам → редакционный документ',
        sourceUrl:'https://docs.google.com/document/d/'+docId+'/edit?tab='+bucket.spec.docTab,
        tempPlanUrl:record.sourceUrl,
        tabTitle:tab&&tab.tabProperties&&tab.tabProperties.title?tab.tabProperties.title:product
      });
      return;
    }

    rows[i]={
      text:record.text,
      subject:record.theme,
      title:record.title,
      materialUrl:record.materialUrl,
      sendsay:record.sendsay,
      date:r[0],
      editorialKind:kind,
      subjectMatches:r[3]?vikaTempPlanNorm_(record.theme).indexOf(vikaTempPlanNorm_(r[3]))>=0:null,
      sourceType:'tempplan',
      sourceLabel:'Темплан по демкам',
      sourceUrl:record.sourceUrl,
      tabTitle:bucket.spec.sheet
    };
  });

  return {
    rows:rows,
    readAt:new Date().toISOString(),
    documentTitle:doc?String(doc.title||'рассылки демо периодика, сс, вшг'):'',
    source:'tempplan-first',
    rule:'АКТИВДЕМО — только наш план; MAIN/ДОЖИМ — редакционный Темплан'
  };
}
