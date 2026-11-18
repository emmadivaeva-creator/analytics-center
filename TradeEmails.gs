/**
 * Торговые письма из существующего аккаунта Sendsay.
 * Использует тот же SENDSAY_API_KEY, SENDSAY_ACCOUNT и LBAC policies,
 * что рабочая загрузка DEMO / NEWS. Никаких новых секретов и данных R/Y/G.
 *
 * ISO-неделя 27 2026 года начинается 2026-06-29.
 * Публичный доступ только к обезличенным сводным данным выпусков.
 */
const TRADE_MAIL_FROM_ = '2026-06-29';
const TRADE_MAIL_PAGE_SIZE_ = 400;
const TRADE_MAIL_MAIN_SHEET_ = '_Торговые письма';
const TRADE_MAIL_STAGE_SHEET_ = '_Торговые письма staging';
const TRADE_MAIL_CURSOR_KEY_ = 'TRADE_MAIL_IMPORT_CURSOR_V1';
const TRADE_MAIL_LAST_SYNC_KEY_ = 'TRADE_MAIL_LAST_SYNC_V1';
const TRADE_MAIL_HEADERS_ = Object.freeze([
  'Policy ID', 'Направление', 'Issue ID', 'Дата', 'Время',
  'Метки', 'Campaign', 'Тема', 'Отправлено', 'Доставлено',
  'Открыли уникально', 'OR', 'Кликнули уникально', 'CTR',
  'CTOR', 'Отписались', 'Sendsay'
]);
const TRADE_MAIL_SELECT_ = Object.freeze([
  'issue.id', 'issue.dt:Ys', 'issue.name', 'issue.subject',
  'issue.format', 'issue.group.gid', 'issue.members', 'issue.deliv_ok',
  'issue.u_readed', 'issue.open_rate', 'issue.u_clicked',
  'issue.click_rate', 'issue.click_open_rate', 'issue.unsubed',
  'issue.label0', 'issue.label1', 'issue.label2', 'issue.label3',
  'issue.label4', 'issue.label5', 'issue.label6', 'issue.label7',
  'issue.label8', 'issue.label9'
]);
const TRADE_MAIL_LABELS_ = Object.freeze(['Market', 'Project', 'Event']);

// Из существующего проекта: goi (52) = Госфинансы; mcfr_gos (61) = Госзаказ.
function tradeMailPolicyDirection_(policyId) {
  return String(policyId) === '52' ? 'ГФ' :
    String(policyId) === '61' ? 'ГЗ' : '';
}

function tradeMailTags_(values) {
  const found = {};
  (values || []).forEach(function(value) {
    const items = Array.isArray(value) ? value : [value];
    items.forEach(function(item) {
      const token = String(item == null ? '' : item).trim().toLowerCase();
      TRADE_MAIL_LABELS_.forEach(function(tag) {
        if (token === tag.toLowerCase()) found[tag] = true;
      });
    });
  });
  return TRADE_MAIL_LABELS_.filter(function(tag){return Boolean(found[tag]);});
}

function tradeMailRow_(raw, policyId) {
  if (!Array.isArray(raw) || raw.length < TRADE_MAIL_SELECT_.length) return null;
  const id = String(raw[0] == null ? '' : raw[0]).trim();
  const date = normalizeDate_(raw[1]);
  const format = String(raw[4] || '').toLowerCase();
  const group = String(raw[5] || '').toLowerCase();
  const subject = String(raw[3] || '').trim();
  const tags = tradeMailTags_(raw.slice(14,24));
  const direction = tradeMailPolicyDirection_(policyId);

  if (!direction || !/^\d+$/.test(id) || !date || date < TRADE_MAIL_FROM_ ||
    format !== 'e' || group === 'personal' || /^\s*тест\s*:/i.test(subject) ||
    !tags.length) return null;

  const when = String(raw[1] || '').replace('T',' ');
  const match = when.match(/\b(\d{1,2}:\d{2})/);
  const name = String(raw[2] || '').trim();
  const campaign = typeof campaignFromIssueName_ === 'function'
    ? campaignFromIssueName_(name) : name;

  return [
    String(policyId), direction, id, date, match ? match[1] : '',
    tags.join('|'), campaign, subject || name || 'Тема не указана',
    number_(raw[6]), number_(raw[7]), number_(raw[8]),
    sendsayApiRate_(raw[9]), number_(raw[10]),
    sendsayApiRate_(raw[11]), sendsayApiRate_(raw[12]),
    number_(raw[13]),
    'https://app.sendsay.ru/reports/campaigns/' + encodeURIComponent(id) + '/summary'
  ];
}

function tradeMailSheet_(name) {
  const ss = openStorage_();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const h = sheet.getRange(1,1,1,TRADE_MAIL_HEADERS_.length).getValues()[0];
  if (TRADE_MAIL_HEADERS_.some(function(value, i){return h[i] !== value;})) {
    // При несовпадении схемы не портим рабочие данные.
    if (sheet.getLastRow() > 1) {
      throw new Error('Неверная схема листа «' + name + '». Сверьте заголовки.');
    }
    sheet.getRange(1,1,1,TRADE_MAIL_HEADERS_.length).setValues([TRADE_MAIL_HEADERS_]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function tradeMailReadRows_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,TRADE_MAIL_HEADERS_.length)
    .getValues().filter(function(row){return row[0] && row[2];});
}

function tradeMailWriteRows_(sheet, rows) {
  const old = Math.max(0,sheet.getLastRow()-1);
  if (rows.length) {
    if (sheet.getMaxRows() < rows.length + 1)
      sheet.insertRowsAfter(sheet.getMaxRows(),rows.length+1-sheet.getMaxRows());
    sheet.getRange(2,1,rows.length,TRADE_MAIL_HEADERS_.length).setValues(rows);
  }
  if (old > rows.length)
    sheet.getRange(rows.length+2,1,old-rows.length,TRADE_MAIL_HEADERS_.length).clearContent();
}

function tradeMailApiPage_(policy, from, to, skip) {
  const data = sendsayApiRequest_({
    action: 'stat.uni',
    select: TRADE_MAIL_SELECT_.slice(),
    filter: [
      {a:'issue.dt:YD',op:'>=',v:from},
      {a:'issue.dt:YD',op:'<=',v:to},
      {a:'issue.format',op:'==',v:'e'}
    ],
    order: ['issue.dt:Ys','issue.id'],
    skip: Math.max(0,Number(skip)||0),
    first: TRADE_MAIL_PAGE_SIZE_
  },policy.id);
  if (!data || !Array.isArray(data.list)) {
    throw new Error('Sendsay (' + policy.name + ') не вернул список выпусков.');
  }
  return data.list;
}

function tradeMailCursor_() {
  const value = PropertiesService.getScriptProperties().getProperty(TRADE_MAIL_CURSOR_KEY_);
  if (!value) throw new Error('Синхронизация торговых писем не запущена.');
  let cursor;
  try {cursor=JSON.parse(value);} catch(e){throw new Error('Повреждён курсор синхронизации торговых писем.');}
  if(!cursor || !cursor.to || !cursor.startedAt || !Array.isArray(cursor.policies)) {
    throw new Error('Некорректный курсор торговых писем.');
  }
  return cursor;
}

/**
 * Одна API-страница на вызов, чтобы не упираться в таймаут Apps Script.
 * Сначала staging, публикация новой выборки только после полного успешного прохода.
 */
function syncTradeMailBatch(firstPass) {
  assertAdmin_();
  const lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const props=PropertiesService.getScriptProperties();
    let cursor;
    if (firstPass === true) {
      const stage=tradeMailSheet_(TRADE_MAIL_STAGE_SHEET_);
      if(stage.getLastRow()>1)
        stage.getRange(2,1,stage.getLastRow()-1,TRADE_MAIL_HEADERS_.length).clearContent();
      cursor={
        from:TRADE_MAIL_FROM_,to:todayIso_(),policyIndex:0,skip:0,
        policies:SENDSAY_API.policies.map(function(p){return String(p.id);}),
        startedAt:new Date().toISOString(),read:0,selected:0
      };
      props.setProperty(TRADE_MAIL_CURSOR_KEY_,JSON.stringify(cursor));
    } else {
      cursor=tradeMailCursor_();
    }
    const policy=SENDSAY_API.policies[cursor.policyIndex];
    if(!policy || String(policy.id)!==cursor.policies[cursor.policyIndex])
      throw new Error('Набор LBAC-политик изменился. Перезапустите синхронизацию.');

    const page=tradeMailApiPage_(policy,cursor.from,cursor.to,cursor.skip);
    const rows=page.map(function(raw){return tradeMailRow_(raw,policy.id);}).filter(Boolean);
    if(rows.length){
      const stage=tradeMailSheet_(TRADE_MAIL_STAGE_SHEET_);
      if(stage.getMaxRows()<stage.getLastRow()+rows.length)
        stage.insertRowsAfter(stage.getMaxRows(),stage.getLastRow()+rows.length-stage.getMaxRows());
      stage.getRange(stage.getLastRow()+1,1,rows.length,TRADE_MAIL_HEADERS_.length).setValues(rows);
    }
    cursor.read+=page.length;
    cursor.selected+=rows.length;
    cursor.skip+=page.length;
    if (page.length < TRADE_MAIL_PAGE_SIZE_) {cursor.policyIndex++;cursor.skip=0;}
    const remaining=cursor.policyIndex<SENDSAY_API.policies.length;
    let total=0;
    if (remaining) {
      props.setProperty(TRADE_MAIL_CURSOR_KEY_,JSON.stringify(cursor));
    } else {
      const stage=tradeMailReadRows_(tradeMailSheet_(TRADE_MAIL_STAGE_SHEET_));
      const uniq={};
      stage.forEach(function(row){uniq[String(row[0])+'|'+String(row[2])]=row;});
      const all=Object.keys(uniq).map(function(key){return uniq[key];}).sort(function(a,b){
        return String(b[3]+' '+b[4]).localeCompare(String(a[3]+' '+a[4])) ||
          String(a[2]).localeCompare(String(b[2]));
      });
      tradeMailWriteRows_(tradeMailSheet_(TRADE_MAIL_MAIN_SHEET_),all);
      total=all.length;
      props.setProperty(TRADE_MAIL_LAST_SYNC_KEY_,new Date().toISOString());
      props.deleteProperty(TRADE_MAIL_CURSOR_KEY_);
    }
    return {
      ok:true,remaining:remaining,direction:tradeMailPolicyDirection_(policy.id),
      processed:page.length,selected:rows.length,readTotal:cursor.read,
      selectedTotal:cursor.selected,total:total,from:TRADE_MAIL_FROM_,to:cursor.to
    };
  } finally{lock.releaseLock();}
}

function getTradeMailUi() {
  const sheet=tradeMailSheet_(TRADE_MAIL_MAIN_SHEET_);
  const rows=tradeMailReadRows_(sheet);
  const output=rows.map(function(row) {
    const date=normalizeDate_(row[3]);
    return {
      id:'trade-'+String(row[0])+'-'+String(row[2]),
      direction:String(row[1]||''),
      issueId:String(row[2]||''),
      date:date,time:String(row[4]||''),
      week:isoWeek_(date),
      year:date.slice(0,4),
      labels:String(row[5]||'').split('|').filter(function(tag){
        return TRADE_MAIL_LABELS_.indexOf(tag)>=0;
      }),
      campaign:String(row[6]||''),
      subject:String(row[7]||''),
      sent:number_(row[8]),
      delivered:number_(row[9]),
      opened:number_(row[10]),
      openRate:sendsayApiRate_(row[11]),
      clicked:number_(row[12]),
      clickRate:sendsayApiRate_(row[13]),
      ctor:sendsayApiRate_(row[14]),
      unsubscribed:number_(row[15]),
      sendsay:String(row[16]||'')
    };
  }).filter(function(x){return x.date>=TRADE_MAIL_FROM_ && x.labels.length>0;});
  const props=PropertiesService.getScriptProperties();
  return {
    items:output,
    meta:{
      from:TRADE_MAIL_FROM_,to:todayIso_(),
      lastSync:props.getProperty(TRADE_MAIL_LAST_SYNC_KEY_)||'',
      syncing:Boolean(props.getProperty(TRADE_MAIL_CURSOR_KEY_)),
      count:output.length
    }
  };
}

/** Трёхдневное обновление без потери исторических выпусков. */
function syncTradeMailLast3Days() {
  assertAdmin_();
  const lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try{
    const to=todayIso_(),from=shiftIsoDate_(to,-2);
    const sheet=tradeMailSheet_(TRADE_MAIL_MAIN_SHEET_);
    const current=tradeMailReadRows_(sheet);
    const recent=new Map();
    SENDSAY_API.policies.forEach(function(policy){
      for(let skip=0,pageNo=0;pageNo<100;pageNo++){
        const page=tradeMailApiPage_(policy,from,to,skip);
        page.forEach(function(raw){
          const row=tradeMailRow_(raw,policy.id);
          if(row)recent.set(String(row[0])+'|'+String(row[2]),row);
        });
        if(page.length<TRADE_MAIL_PAGE_SIZE_)break;
        skip+=page.length;
        if(pageNo===99)throw new Error('Слишком много выпусков за 3 дня: '+policy.name);
      }
    });
    const retained=current.filter(function(row){return String(row[3]||'')<from;});
    recent.forEach(function(row){retained.push(row);});
    retained.sort(function(a,b){return String(b[3]+' '+b[4]).localeCompare(String(a[3]+' '+a[4]));});
    tradeMailWriteRows_(sheet,retained);
    PropertiesService.getScriptProperties().setProperty(TRADE_MAIL_LAST_SYNC_KEY_,new Date().toISOString());
    return {ok:true,from:from,to:to,changed:recent.size,total:retained.length};
  }finally{lock.releaseLock();}
}

/** Отдельный триггер, чтобы сбой торговой статистики не ломал DEMO. */
function installTradeMailDailyTrigger() {
  assertAdmin_();
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction()==='dailyTradeMailSync')ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyTradeMailSync').timeBased()
    .atHour(8).nearMinute(35).everyDays(1).create();
  return {ok:true,handler:'dailyTradeMailSync',near:'08:35 МСК'};
}
function dailyTradeMailSync() {
  return syncTradeMailLast3Days();
}
