/**
 * Analytics Center — модуль «Звонки / Что продает».
 * Хранит нормализованные звонки, GPT-разметку и журнал импортов
 * в существующем служебном Spreadsheet Analytics Center.
 */
const CALLS_CFG = Object.freeze({
  rawSheet: '_Calls Raw',
  analysisSheet: '_Call Analysis',
  topicsSheet: '_Call Topics',
  importsSheet: '_Call Imports',
  promptVersion: 'calls-v1-2026-09-04',
  keyProperty: 'OPENAI_API_KEY',
  modelProperty: 'CALLS_OPENAI_MODEL',
  defaultModel: 'gpt-5.6-luna',
  batchSize: 4,
  minSample: 5
});

const CALLS_RAW_HEADERS = Object.freeze([
  'Call ID','Source file','Import batch','Imported at','Updated at',
  'Year','Half','Month','Product','Group','Action no','sl_api_nr',
  'Sale','Sales count','Transcript','Source error','Fingerprint',
  'Analysis status','Classifier version'
]);
const CALLS_ANALYSIS_HEADERS = Object.freeze([
  'Call ID','Analyzed at','Status','Topics JSON','Materials JSON','Pain',
  'Techniques JSON','Objections JSON','Arguments JSON','Price mentioned',
  'Discount mentioned','Demo mentioned','LPR mentioned','Next step',
  'Presentation score','Why','Key fragment','Content recommendation','Prompt version'
]);
const CALLS_TOPIC_HEADERS = Object.freeze([
  'Kind','Name','Calls','Sales','Sale rate','Share success','Share all',
  'Sales index','Sample status','Recommendation','Updated at'
]);
const CALLS_IMPORT_HEADERS = Object.freeze([
  'Batch ID','Source file','File size','File type','Started at','Finished at',
  'Rows read','Added','Updated','Duplicates','Errors','Status','Message'
]);

function setupCallsModule() {
  assertAdmin_();
  const storage = openStorage_();
  callsEnsureSheets_(storage);
  return { ok: true, sheets: [CALLS_CFG.rawSheet, CALLS_CFG.analysisSheet, CALLS_CFG.topicsSheet, CALLS_CFG.importsSheet] };
}

function getCallsData(filters) {
  const storage = openStorage_();
  callsEnsureSheets_(storage);
  return callsBuildDashboard_(storage, filters || {});
}

function beginCallsImport(meta) {
  assertAdmin_();
  const storage = openStorage_();
  callsEnsureSheets_(storage);
  const batchId = String((meta && meta.batchId) || Utilities.getUuid());
  const sheet = storage.getSheetByName(CALLS_CFG.importsSheet);
  sheet.appendRow([
    batchId, String(meta && meta.fileName || ''), Number(meta && meta.fileSize || 0),
    String(meta && meta.fileType || ''), new Date(), '', Number(meta && meta.rowsRead || 0),
    0,0,0,0,'Импортируется',''
  ]);
  return { ok: true, batchId: batchId };
}

function importCallsBatch(payload) {
  assertAdmin_();
  const storage = openStorage_();
  callsEnsureSheets_(storage);
  const rows = Array.isArray(payload && payload.records) ? payload.records : [];
  const batchId = String(payload && payload.batchId || '');
  const sourceFile = String(payload && payload.fileName || '');
  if (!batchId) throw new Error('Не передан batchId импорта.');
  if (!rows.length) return { ok: true, added: 0, updated: 0, duplicates: 0, errors: 0 };

  const sheet = storage.getSheetByName(CALLS_CFG.rawSheet);
  callsEnsureRawCapacity_(sheet, rows.length);
  const values = sheet.getDataRange().getValues();
  const index = {};
  for (let i = 1; i < values.length; i++) {
    const id = String(values[i][0] || '');
    if (id) index[id] = { row: i + 1, values: values[i] };
  }

  let added = 0, updated = 0, duplicates = 0, errors = 0;
  const appendRows = [];
  const now = new Date();

  rows.forEach(raw => {
    try {
      const record = callsNormalizeRecord_(raw, sourceFile, batchId);
      if (!record.actionNo || !record.slApiNr) throw new Error('Нет Номера действия или sl_api_nr.');
      if (!record.transcript) throw new Error('Пустая расшифровка.');
      const existing = index[record.id];
      if (!existing) {
        appendRows.push(callsRawRow_(record, now, now));
        added++;
        return;
      }

      const merged = callsMergeRecord_(existing.values, record);
      if (String(existing.values[16] || '') === merged.fingerprint) {
        duplicates++;
        return;
      }

      const importedAt = existing.values[3] || now;
      const output = callsRawRow_(merged, importedAt, now);
      sheet.getRange(existing.row, 1, 1, CALLS_RAW_HEADERS.length).setValues([output]);
      updated++;
    } catch (error) {
      errors++;
    }
  });

  if (appendRows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, appendRows.length, CALLS_RAW_HEADERS.length).setValues(appendRows);
  }
  callsAddImportCounts_(storage, batchId, added, updated, duplicates, errors);
  clearCache_();
  return { ok: true, added: added, updated: updated, duplicates: duplicates, errors: errors };
}

function finishCallsImport(meta) {
  assertAdmin_();
  const storage = openStorage_();
  callsEnsureSheets_(storage);
  const batchId = String(meta && meta.batchId || '');
  callsFinishImportLog_(storage, batchId, meta || {});
  callsRebuildTopicSnapshot_(storage);
  clearCache_();
  const pending = callsPendingCount_(storage);
  return { ok: true, pendingAnalysis: pending, gptConfigured: callsOpenAIConfigured_() };
}

function saveCallsOpenAIKey(apiKey) {
  assertAdmin_();
  const key = String(apiKey || '').trim();
  if (!/^sk-[A-Za-z0-9_\-]{20,}$/.test(key)) throw new Error('Ключ выглядит некорректно.');
  PropertiesService.getScriptProperties().setProperty(CALLS_CFG.keyProperty, key);
  return { ok: true, configured: true };
}

function clearCallsOpenAIKey() {
  assertAdmin_();
  PropertiesService.getScriptProperties().deleteProperty(CALLS_CFG.keyProperty);
  return { ok: true, configured: false };
}

function analyzeCallsBatch(limit) {
  assertAdmin_();
  const storage = openStorage_();
  callsEnsureSheets_(storage);
  const key = PropertiesService.getScriptProperties().getProperty(CALLS_CFG.keyProperty);
  if (!key) return { ok: true, configured: false, analyzed: 0, errors: 0, pending: callsPendingCount_(storage) };

  const rawSheet = storage.getSheetByName(CALLS_CFG.rawSheet);
  if (rawSheet.getLastRow() < 2) return { ok: true, configured: true, analyzed: 0, errors: 0, pending: 0 };
  const raw = rawSheet.getDataRange().getValues();
  const analysisSheet = storage.getSheetByName(CALLS_CFG.analysisSheet);
  const analysisIndex = callsAnalysisIndex_(analysisSheet);
  const maxItems = Math.max(1, Math.min(Number(limit) || CALLS_CFG.batchSize, 8));
  const queue = [];

  for (let i = 1; i < raw.length && queue.length < maxItems; i++) {
    const id = String(raw[i][0] || '');
    const status = String(raw[i][17] || '');
    const classifier = String(raw[i][18] || '');
    if (!id || !raw[i][14]) continue;
    if (status === 'Готово' && classifier === CALLS_CFG.promptVersion && analysisIndex[id]) continue;
    queue.push({ row: i + 1, record: callsRawObject_(raw[i]) });
  }

  let analyzed = 0, errors = 0;
  queue.forEach(item => {
    try {
      const result = callsAnalyzeWithOpenAI_(item.record, key);
      callsUpsertAnalysis_(analysisSheet, analysisIndex, item.record.id, result);
      rawSheet.getRange(item.row, 18, 1, 2).setValues([['Готово', CALLS_CFG.promptVersion]]);
      analyzed++;
    } catch (error) {
      rawSheet.getRange(item.row, 18, 1, 2).setValues([['Ошибка анализа', CALLS_CFG.promptVersion]]);
      errors++;
    }
  });

  if (analyzed) callsRebuildTopicSnapshot_(storage);
  clearCache_();
  return { ok: true, configured: true, analyzed: analyzed, errors: errors, pending: callsPendingCount_(storage) };
}

function getCallTopicDetail(name, kind, filters) {
  const storage = openStorage_();
  callsEnsureSheets_(storage);
  const data = callsJoinedRecords_(storage, filters || {});
  const target = callsNorm_(name);
  const field = String(kind || 'Тема') === 'Материал' ? 'materials' : 'topics';
  const matches = data.filter(item => (item[field] || []).some(v => callsNorm_(typeof v === 'string' ? v : v.name) === target));
  const sales = matches.filter(x => x.sale);
  const allSales = data.filter(x => x.sale).length;
  const index = data.length && allSales ? (sales.length / allSales) / (matches.length / data.length) : 0;

  const products = callsCountBy_(matches, x => x.product || 'Не указан');
  const materials = callsCountBy_(matches, x => (x.materials || []).join(' • ') || 'Без материала');
  const pains = callsCountBy_(matches, x => x.pain || 'Не определена');
  const techniques = {};
  matches.forEach(x => (x.techniques || []).forEach(v => { techniques[v] = (techniques[v] || 0) + 1; }));
  const trends = callsCountBy_(matches, x => callsPeriodLabel_(x));

  return {
    name: name,
    kind: kind || 'Тема',
    calls: matches.length,
    sales: sales.length,
    salesIndex: callsRound_(index, 2),
    saleRate: matches.length ? callsRound_(sales.length / matches.length * 100, 1) : 0,
    products: callsTopPairs_(products, 8),
    coMaterials: callsTopPairs_(materials, 8),
    pains: callsTopPairs_(pains, 8),
    techniques: callsTopPairs_(techniques, 8),
    trend: callsTopPairs_(trends, 24).sort((a,b) => String(a.name).localeCompare(String(b.name),'ru')),
    successfulFragments: sales.slice(0,3).map(x => x.keyFragment || callsSafeSnippet_(x.transcript, name)).filter(Boolean),
    unsuccessfulFragments: matches.filter(x => !x.sale).slice(0,3).map(x => x.keyFragment || callsSafeSnippet_(x.transcript, name)).filter(Boolean),
    recommendation: callsTopicRecommendation_(name, matches.length, sales.length, index)
  };
}

function callsEnsureSheets_(storage) {
  callsEnsureSheet_(storage, CALLS_CFG.rawSheet, CALLS_RAW_HEADERS, true);
  callsEnsureSheet_(storage, CALLS_CFG.analysisSheet, CALLS_ANALYSIS_HEADERS, true);
  callsEnsureSheet_(storage, CALLS_CFG.topicsSheet, CALLS_TOPIC_HEADERS, true);
  callsEnsureSheet_(storage, CALLS_CFG.importsSheet, CALLS_IMPORT_HEADERS, true);
}

function callsEnsureRawCapacity_(sheet, incomingRows) {
  const needRows = Math.max(2, sheet.getLastRow() + Math.max(0, Number(incomingRows || 0)) + 25);
  if (sheet.getMaxRows() < needRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), needRows - sheet.getMaxRows());
  }
  return sheet;
}

function callsEnsureSheet_(storage, name, headers, hidden) {
  let sheet = storage.getSheetByName(name);
  if (!sheet) sheet = storage.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1,1,1,headers.length).setValues([headers]);
  else {
    const current = sheet.getRange(1,1,1,Math.max(sheet.getLastColumn(),headers.length)).getValues()[0];
    if (String(current[0] || '') !== headers[0]) sheet.getRange(1,1,1,headers.length).setValues([headers]);
  }
  sheet.setFrozenRows(1);
  if (hidden && !sheet.isSheetHidden()) sheet.hideSheet();
  return sheet;
}

function callsNormalizeRecord_(raw, sourceFile, batchId) {
  const actionNo = callsClean_(raw.actionNo);
  const slApiNr = callsNormalizeSl_(raw.slApiNr);
  const sale = raw.sale === true || String(raw.sale).toLowerCase() === 'true' || Number(raw.salesCount || 0) > 0;
  let transcript = String(raw.transcript || '').replace(/\u0000/g,'').trim();
  if (transcript.length > 45000) {
    transcript = transcript.slice(0, 45000) + '\n[Расшифровка обрезана при импорте: превышен лимит ячейки Google Sheets]';
  }
  const record = {
    id: callsHash_(actionNo + '|' + slApiNr).slice(0, 24),
    sourceFile: sourceFile || callsClean_(raw.sourceFile),
    batchId: batchId,
    year: callsClean_(raw.year),
    half: callsClean_(raw.half),
    month: callsClean_(raw.month),
    product: callsClean_(raw.product),
    group: callsClean_(raw.group),
    actionNo: actionNo,
    slApiNr: slApiNr,
    sale: sale,
    salesCount: Math.max(0, Number(raw.salesCount || 0)),
    transcript: transcript,
    sourceError: callsClean_(raw.sourceError)
  };
  record.fingerprint = callsFingerprint_(record);
  return record;
}

function callsMergeRecord_(existingRow, incoming) {
  const existing = callsRawObject_(existingRow);
  const merged = Object.assign({}, incoming);
  merged.sourceFile = incoming.sourceFile || existing.sourceFile;
  merged.year = incoming.year || existing.year;
  merged.half = incoming.half || existing.half;
  merged.month = incoming.month || existing.month;
  merged.product = incoming.product || existing.product;
  merged.group = incoming.group || existing.group;
  merged.sale = Boolean(incoming.sale || existing.sale);
  merged.salesCount = Math.max(Number(incoming.salesCount || 0), Number(existing.salesCount || 0), merged.sale ? 1 : 0);
  merged.transcript = incoming.transcript || existing.transcript;
  merged.sourceError = incoming.sourceError || existing.sourceError;
  merged.id = incoming.id;
  merged.fingerprint = callsFingerprint_(merged);
  return merged;
}

function callsRawRow_(r, importedAt, updatedAt) {
  return [
    r.id,r.sourceFile,r.batchId,importedAt,updatedAt,r.year,r.half,r.month,
    r.product,r.group,r.actionNo,r.slApiNr,r.sale ? 'Да' : 'Нет',r.salesCount,
    r.transcript,r.sourceError,r.fingerprint,'Ожидает анализа',''
  ];
}

function callsRawObject_(row) {
  return {
    id:String(row[0]||''),sourceFile:String(row[1]||''),batchId:String(row[2]||''),
    importedAt:row[3],updatedAt:row[4],year:String(row[5]||''),half:String(row[6]||''),
    month:String(row[7]||''),product:String(row[8]||''),group:String(row[9]||''),
    actionNo:String(row[10]||''),slApiNr:String(row[11]||''),sale:String(row[12]||'').toLowerCase()==='да',
    salesCount:Number(row[13]||0),transcript:String(row[14]||''),sourceError:String(row[15]||''),
    fingerprint:String(row[16]||''),analysisStatus:String(row[17]||''),classifierVersion:String(row[18]||'')
  };
}

function callsFingerprint_(r) {
  return callsHash_([r.year,r.half,r.month,r.product,r.group,r.actionNo,r.slApiNr,r.sale?1:0,r.salesCount,r.transcript,r.sourceError].join('\u241f'));
}

function callsHash_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ''), Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + ((b < 0 ? b + 256 : b).toString(16))).slice(-2)).join('');
}

function callsNormalizeSl_(value) {
  const parts = String(value || '').split(/[;,|\s]+/).map(v => v.trim()).filter(Boolean);
  const unique = {};
  parts.forEach(v => unique[v.replace(/\.0$/,'')] = true);
  return Object.keys(unique).sort((a,b) => a.localeCompare(b,'ru',{numeric:true})).join(',');
}

function callsClean_(value) { return String(value == null ? '' : value).replace(/\s+/g,' ').trim(); }
function callsNorm_(value) { return callsClean_(value).toLowerCase().replace(/ё/g,'е'); }
function callsRound_(v,d) { const p=Math.pow(10,d||0); return Math.round((Number(v)||0)*p)/p; }

function callsAddImportCounts_(storage, batchId, added, updated, duplicates, errors) {
  const sheet = storage.getSheetByName(CALLS_CFG.importsSheet);
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0] || '') !== batchId) continue;
    sheet.getRange(i+1,8,1,4).setValues([[
      Number(rows[i][7]||0)+added,Number(rows[i][8]||0)+updated,
      Number(rows[i][9]||0)+duplicates,Number(rows[i][10]||0)+errors
    ]]);
    return;
  }
}

function callsFinishImportLog_(storage, batchId, meta) {
  const sheet = storage.getSheetByName(CALLS_CFG.importsSheet);
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0] || '') !== batchId) continue;
    if (meta.rowsRead != null) sheet.getRange(i+1,7).setValue(Number(meta.rowsRead||0));
    sheet.getRange(i+1,6).setValue(new Date());
    sheet.getRange(i+1,12,1,2).setValues([['Готово',String(meta.message||'')]]);
    return;
  }
}

function callsPendingCount_(storage) {
  const sheet = storage.getSheetByName(CALLS_CFG.rawSheet);
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const rows = sheet.getRange(2,18,sheet.getLastRow()-1,2).getValues();
  return rows.filter(r => String(r[0]||'') !== 'Готово' || String(r[1]||'') !== CALLS_CFG.promptVersion).length;
}

function callsAnalysisIndex_(sheet) {
  const index = {};
  if (!sheet || sheet.getLastRow() < 2) return index;
  const rows = sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues();
  rows.forEach((r,i) => { if (r[0]) index[String(r[0])] = i + 2; });
  return index;
}

function callsUpsertAnalysis_(sheet, index, callId, result) {
  const row = [
    callId,new Date(),'Готово',JSON.stringify(result.topics||[]),JSON.stringify(result.materials||[]),
    result.pain||'',JSON.stringify(result.techniques||[]),JSON.stringify(result.objections||[]),
    JSON.stringify(result.arguments||[]),result.priceMentioned?'Да':'Нет',result.discountMentioned?'Да':'Нет',
    result.demoMentioned?'Да':'Нет',result.lprMentioned?'Да':'Нет',result.nextStep||'',
    Number(result.presentationScore||0),result.why||'',result.keyFragment||'',result.contentRecommendation||'',CALLS_CFG.promptVersion
  ];
  if (index[callId]) sheet.getRange(index[callId],1,1,row.length).setValues([row]);
  else { sheet.appendRow(row); index[callId] = sheet.getLastRow(); }
}

function callsOpenAIConfigured_() {
  return Boolean(PropertiesService.getScriptProperties().getProperty(CALLS_CFG.keyProperty));
}

function callsAnalyzeWithOpenAI_(record, apiKey) {
  const model = PropertiesService.getScriptProperties().getProperty(CALLS_CFG.modelProperty) || CALLS_CFG.defaultModel;
  const transcript = callsMaskPii_(record.transcript).slice(0,24000);
  const schema = {
    type:'object',additionalProperties:false,
    properties:{
      topics:{type:'array',items:{type:'object',additionalProperties:false,properties:{name:{type:'string'},stage:{type:'string'}},required:['name','stage']}},
      materials:{type:'array',items:{type:'string'}},pain:{type:'string'},techniques:{type:'array',items:{type:'string'}},
      objections:{type:'array',items:{type:'string'}},arguments:{type:'array',items:{type:'string'}},
      priceMentioned:{type:'boolean'},discountMentioned:{type:'boolean'},demoMentioned:{type:'boolean'},lprMentioned:{type:'boolean'},
      nextStep:{type:'string'},presentationScore:{type:'integer',minimum:1,maximum:5},why:{type:'string'},keyFragment:{type:'string'},contentRecommendation:{type:'string'}
    },
    required:['topics','materials','pain','techniques','objections','arguments','priceMentioned','discountMentioned','demoMentioned','lprMentioned','nextStep','presentationScore','why','keyFragment','contentRecommendation']
  };
  const payload = {
    model:model,
    input:[
      {role:'developer',content:[{type:'input_text',text:'Ты анализируешь расшифровку презентационного звонка профессионального продукта для бухгалтеров госсектора и закупщиков. Выделяй только то, что реально есть в тексте. Не придумывай материалы. Темы формулируй конкретно: действие, документ, проверка, расчет, сервис или предотвращенная ошибка. Не сообщается, была ли продажа: не пытайся это угадывать. Возвращай краткие значения для последующей статистики.'}]},
      {role:'user',content:[{type:'input_text',text:'Продукт: '+(record.product||'не указан')+'\nГруппа: '+(record.group||'не указана')+'\nРасшифровка:\n'+transcript}]}
    ],
    text:{format:{type:'json_schema',name:'call_analysis',strict:true,schema:schema}}
  };
  const response = UrlFetchApp.fetch('https://api.openai.com/v1/responses',{
    method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+apiKey},payload:JSON.stringify(payload),muteHttpExceptions:true
  });
  const code = response.getResponseCode();
  const body = response.getContentText();
  if (code < 200 || code >= 300) throw new Error('OpenAI '+code+': '+body.slice(0,300));
  const json = JSON.parse(body);
  let text = String(json.output_text || '');
  if (!text && Array.isArray(json.output)) {
    json.output.forEach(item => (item.content || []).forEach(part => { if (part.type === 'output_text' && part.text) text += part.text; }));
  }
  if (!text) throw new Error('OpenAI вернул ответ без текста.');
  return JSON.parse(text);
}

function callsMaskPii_(text) {
  return String(text || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[EMAIL]')
    .replace(/(?:\+7|8)[\s()\-]*\d{3}[\s()\-]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}/g,'[ТЕЛЕФОН]')
    .replace(/\b\d{3}-\d{3}-\d{3}\s?\d{2}\b/g,'[СНИЛС]')
    .replace(/\b[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\b/g,'[ФИО]');
}

function callsJoinedRecords_(storage, filters) {
  const rawSheet = storage.getSheetByName(CALLS_CFG.rawSheet);
  if (!rawSheet || rawSheet.getLastRow() < 2) return [];
  const raw = rawSheet.getRange(2,1,rawSheet.getLastRow()-1,CALLS_RAW_HEADERS.length).getValues();
  const analysisSheet = storage.getSheetByName(CALLS_CFG.analysisSheet);
  const analysis = {};
  if (analysisSheet && analysisSheet.getLastRow() >= 2) {
    const rows = analysisSheet.getRange(2,1,analysisSheet.getLastRow()-1,CALLS_ANALYSIS_HEADERS.length).getValues();
    rows.forEach(r => {
      const id = String(r[0]||''); if (!id) return;
      analysis[id] = {
        topics:callsJson_(r[3],[]),materials:callsJson_(r[4],[]),pain:String(r[5]||''),techniques:callsJson_(r[6],[]),
        objections:callsJson_(r[7],[]),arguments:callsJson_(r[8],[]),priceMentioned:String(r[9])==='Да',discountMentioned:String(r[10])==='Да',
        demoMentioned:String(r[11])==='Да',lprMentioned:String(r[12])==='Да',nextStep:String(r[13]||''),presentationScore:Number(r[14]||0),
        why:String(r[15]||''),keyFragment:String(r[16]||''),contentRecommendation:String(r[17]||''),promptVersion:String(r[18]||'')
      };
    });
  }
  return raw.map(callsRawObject_).map(r => Object.assign(r, analysis[r.id] || {topics:[],materials:[],techniques:[],objections:[],arguments:[]})).filter(r => callsMatchesFilters_(r, filters));
}

function callsMatchesFilters_(r, f) {
  if (f.direction && callsDirection_(r) !== f.direction) return false;
  if (f.family && callsFamily_(r) !== f.family) return false;
  if (f.group && r.group !== f.group) return false;
  if (f.month && r.month !== f.month) return false;
  if (f.sale === 'sale' && !r.sale) return false;
  if (f.sale === 'no-sale' && r.sale) return false;
  return true;
}

function callsDirection_(r) {
  const t = callsNorm_((r.product||'')+' '+(r.group||''));
  if (/госзаказ|\bгз\b|закуп/.test(t)) return 'ГЗ';
  if (/госфинанс|\bгф\b|бюджет/.test(t)) return 'ГФ';
  return 'Не определено';
}
function callsFamily_(r) {
  const t = callsNorm_((r.product||'')+' '+(r.group||''));
  if (/систем/.test(t)) return 'Система';
  if (/период|журнал/.test(t)) return 'Периодика';
  if (/академ|школ/.test(t)) return 'Академия';
  return 'Не определено';
}

function callsBuildDashboard_(storage, filters) {
  const data = callsJoinedRecords_(storage, filters);
  const minSample = Math.max(1, Number(filters.minSample || CALLS_CFG.minSample));
  const sales = data.filter(x => x.sale);
  const topics = callsAggregateKind_(data, sales, 'topics', 'Тема', minSample);
  const materials = callsAggregateKind_(data, sales, 'materials', 'Материал', minSample);
  const imports = callsRecentImports_(storage, 12);
  const months = {}, groups = {};
  data.forEach(x => { if (x.month) months[x.month]=true; if (x.group) groups[x.group]=true; });
  const periodValues = data.map(x => callsPeriodLabel_(x)).filter(Boolean).sort();

  const strong = topics.filter(x => !x.lowSample && x.index > 1).sort((a,b) => b.index-a.index || b.calls-a.calls);
  const weak = topics.filter(x => !x.lowSample && x.index <= 1).sort((a,b) => a.index-b.index || b.calls-a.calls);
  const strongMaterials = materials.filter(x => !x.lowSample && x.index > 1).sort((a,b) => b.index-a.index || b.calls-a.calls);

  return {
    meta:{
      total:data.length,sales:sales.length,saleRate:data.length?callsRound_(sales.length/data.length*100,1):0,
      analyzed:data.filter(x => x.promptVersion===CALLS_CFG.promptVersion).length,
      pending:callsPendingCount_(storage),gptConfigured:callsOpenAIConfigured_(),
      model:PropertiesService.getScriptProperties().getProperty(CALLS_CFG.modelProperty)||CALLS_CFG.defaultModel,
      lastImport:imports.length?imports[0].finishedAt||imports[0].startedAt:'',
      period:periodValues.length?(periodValues[0]+' — '+periodValues[periodValues.length-1]):'—',
      topicCount:topics.length,materialCount:materials.length,minSample:minSample
    },
    topTopics:strong.slice(0,10),
    topMaterials:strongMaterials.slice(0,10),
    weakTopics:weak.slice(0,10),
    allTopics:topics.slice(0,80),
    recommendations:callsEditorialRecommendations_(strong,weak,strongMaterials),
    filters:{months:Object.keys(months).sort(),groups:Object.keys(groups).sort()},
    imports:imports
  };
}

function callsAggregateKind_(data, sales, field, kind, minSample) {
  const allCount = data.length, salesCount = sales.length, map = {};
  data.forEach(item => {
    const seen = {};
    (item[field] || []).forEach(raw => {
      const name = callsClean_(typeof raw === 'string' ? raw : raw.name);
      const key = callsNorm_(name); if (!key || seen[key]) return; seen[key]=true;
      if (!map[key]) map[key]={kind:kind,name:name,calls:0,sales:0,recommendations:{}};
      map[key].calls++;
      if (item.sale) map[key].sales++;
      if (item.contentRecommendation) map[key].recommendations[item.contentRecommendation]=(map[key].recommendations[item.contentRecommendation]||0)+1;
    });
  });
  return Object.keys(map).map(k => {
    const x=map[k], shareSuccess=salesCount?x.sales/salesCount:0, shareAll=allCount?x.calls/allCount:0, index=shareAll?shareSuccess/shareAll:0;
    return {
      kind:x.kind,name:x.name,calls:x.calls,sales:x.sales,saleRate:x.calls?callsRound_(x.sales/x.calls*100,1):0,
      shareSuccess:callsRound_(shareSuccess*100,1),shareAll:callsRound_(shareAll*100,1),index:callsRound_(index,2),
      lowSample:x.calls<minSample,sampleLabel:x.calls<minSample?'Мало данных':'Достаточно данных',
      recommendation:callsMostCommonKey_(x.recommendations)||callsTopicRecommendation_(x.name,x.calls,x.sales,index)
    };
  }).sort((a,b) => b.index-a.index || b.calls-a.calls);
}

function callsEditorialRecommendations_(strong, weak, materials) {
  const out=[];
  strong.slice(0,4).forEach(x => out.push({type:'strong',title:x.name,text:'Тема заметно чаще встречается в успешных звонках. Использовать конкретный рабочий заход в DEMO, active-demo, посте или обучении.',index:x.index,calls:x.calls}));
  materials.slice(0,3).forEach(x => out.push({type:'material',title:x.name,text:'Конкретный материал связан с продажей сильнее среднего. Стоит повторять сам механизм показа, а не только название темы.',index:x.index,calls:x.calls}));
  weak.slice(0,3).forEach(x => out.push({type:'weak',title:x.name,text:'Тема встречается часто, но непропорционально редко сопровождается продажей. Не использовать как широкий самостоятельный оффер, сузить до действия, формы, ошибки или проверки.',index:x.index,calls:x.calls}));
  return out.slice(0,10);
}

function callsTopicRecommendation_(name,calls,sales,index) {
  if (calls < CALLS_CFG.minSample) return 'Пока мало данных: не делать вывод по 1–2 звонкам.';
  if (index > 1.5) return 'Сильный сигнал: использовать конкретный рабочий результат и повторять механику показа.';
  if (index > 1) return 'Есть положительная связь с продажей. Проверять на большем объеме и в разрезе продукта.';
  return 'Самостоятельно не отличает успешные звонки. Сужать до конкретного действия, документа, ошибки или проверки.';
}

function callsRebuildTopicSnapshot_(storage) {
  const dashboard = callsBuildDashboard_(storage, {minSample:CALLS_CFG.minSample});
  const sheet = storage.getSheetByName(CALLS_CFG.topicsSheet);
  if (sheet.getLastRow()>1) sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).clearContent();
  const combined = dashboard.allTopics.concat(dashboard.topMaterials || []);
  const seen = {};
  const rows=[];
  combined.forEach(x => {
    const key=x.kind+'|'+callsNorm_(x.name); if (seen[key]) return; seen[key]=true;
    rows.push([x.kind,x.name,x.calls,x.sales,x.saleRate,x.shareSuccess,x.shareAll,x.index,x.sampleLabel,x.recommendation,new Date()]);
  });
  if (rows.length) sheet.getRange(2,1,rows.length,CALLS_TOPIC_HEADERS.length).setValues(rows);
}

function callsRecentImports_(storage, limit) {
  const sheet = storage.getSheetByName(CALLS_CFG.importsSheet);
  if (!sheet || sheet.getLastRow()<2) return [];
  const rows=sheet.getRange(2,1,sheet.getLastRow()-1,CALLS_IMPORT_HEADERS.length).getValues();
  return rows.slice().reverse().slice(0,limit||10).map(r => ({
    batchId:String(r[0]||''),fileName:String(r[1]||''),fileSize:Number(r[2]||0),fileType:String(r[3]||''),
    startedAt:r[4],finishedAt:r[5],rowsRead:Number(r[6]||0),added:Number(r[7]||0),updated:Number(r[8]||0),
    duplicates:Number(r[9]||0),errors:Number(r[10]||0),status:String(r[11]||''),message:String(r[12]||'')
  }));
}

function callsCountBy_(items, fn) {
  const out={}; items.forEach(x => { const k=String(fn(x)||'').trim(); if(k) out[k]=(out[k]||0)+1; }); return out;
}
function callsTopPairs_(obj, limit) {
  return Object.keys(obj||{}).map(k => ({name:k,count:obj[k]})).sort((a,b)=>b.count-a.count).slice(0,limit||10);
}
function callsMostCommonKey_(obj) {
  let best='',count=0; Object.keys(obj||{}).forEach(k=>{if(obj[k]>count){best=k;count=obj[k];}}); return best;
}
function callsJson_(value,fallback) { try{return JSON.parse(String(value||''))}catch(e){return fallback} }
function callsPeriodLabel_(x) { return [x.year,x.month].filter(Boolean).join(' ') || x.month || x.year || ''; }
function callsSafeSnippet_(text, needle) {
  const masked=callsMaskPii_(text), lower=callsNorm_(masked), target=callsNorm_(needle), pos=target?lower.indexOf(target):-1;
  const start=Math.max(0,(pos>=0?pos:0)-120), end=Math.min(masked.length,(pos>=0?pos:0)+380);
  return masked.slice(start,end).trim();
}
