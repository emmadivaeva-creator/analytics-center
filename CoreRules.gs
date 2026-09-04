/* Canonical runtime rules for Analytics Center. */

function canonicalNewsCampaign_(campaign) {
  const c = String(campaign || '').trim();
  return /^Gosfinansi_letter_news_GF_digest(?:_|$)/i.test(c) ||
    /^letter_news_goszakaz_regular_news_digest(?:_|$)/i.test(c);
}

extractCampaignName_ = function(raw, fileName) {
  const baseName = String(fileName || '')
    .replace(/\.(?:mhtml?|webarchive)$/i, '')
    .trim();

  const direct = baseName.match(
    /^\s*\d+\s*(?:\||_)\s*(?:demo|news)\s*(?:\||_)\s*(.*?)\s*(?:\||_)\s*sendsay\s*$/i
  );
  if (direct && direct[1]) return direct[1].trim();

  const header = String(raw || '').match(/^Subject:\s*(.+)$/mi);
  const headerText = header ? decodeSnapshotText_(header[1]) : '';
  const headerMatch = headerText.match(
    /(?:Demo|News)\s*[|_]\s*(.*?)\s*[|_]\s*Sendsay/i
  );
  if (headerMatch && headerMatch[1]) return headerMatch[1].trim();

  const generic = baseName.match(/(?:Demo|News)\s*[|_]\s*(.*)$/i);
  return generic && generic[1]
    ? generic[1].replace(/\s*(?:\||_)\s*Sendsay\s*$/i, '').trim()
    : baseName.replace(/\s*(?:\||_)\s*Sendsay\s*$/i, '').trim();
};

classifyCampaign_ = function(campaign, fileName, subject, sender) {
  const text = norm_([campaign, fileName, subject, sender].join(' '));
  const rawCampaign = String(campaign || '').toLowerCase();
  const isNews = canonicalNewsCampaign_(campaign);
  const type = isNews ? 'news' : 'demo';
  let product = 'Не указано';
  let flow = 'Не указано';

  if (isNews && /^Gosfinansi_letter_news_GF_digest/i.test(String(campaign || ''))) {
    product = 'ГФ Периодика'; flow = product;
  } else if (isNews && /^letter_news_goszakaz_regular_news_digest/i.test(String(campaign || ''))) {
    product = 'ГЗ Периодика'; flow = product;
  } else if (/goszakaz[_-]?cgz|activdemo[_-]?cgz/.test(text)) {
    product = 'ГЗ Система'; flow = product;
  } else if (/goszakaz[_-]?(gzru|vio|fas)|activdemo[_-]?(gzru|vio|fas)/.test(text)) {
    product = 'ГЗ Периодика';
    flow = /[_-]vio(?:_|\.|\b)/.test(text) ? product + ' · ВИО' :
      /[_-]fas(?:_|\.|\b)/.test(text) ? product + ' · ФАС' : product + ' · ГЗРУ';
  } else if (/letter_demo_goszakaz|goszakaz-school|высшая школа госзакупок|action-goszakaz-school/.test(text)) {
    product = 'ГЗ Школа'; flow = product;
  } else if (/gosfinansi[_-]?letter[_-]?(?:activdemo[_-]?)?gfss/.test(text)) {
    product = 'ГФ Система'; flow = product;
  } else if (/gosfinansi[_-]?letter[_-]?demo[_-]?school|школа главбуха|action-gosfinansy-school/.test(text)) {
    product = 'ГФ Школа'; flow = product;
  } else if (/gosfinansi[_-]?letteri?[_-]?(?:activdemo[_-]?)?(ubu|zbu)|\bubu\b|\bzbu\b/.test(text)) {
    product = 'ГФ Периодика';
    flow = /[_-]zbu(?:_|\.|\b)/.test(text) ? product + ' · ЗБУ' : product + ' · УБУ';
  }

  let segment = isNews ? 'Новостная рассылка' : 'Живые';
  if (!isNews && /activdemo/.test(rawCampaign)) segment = 'Дожим демо';
  else if (!isNews && /(?:^|_)open(?:_|\.|$)/.test(rawCampaign)) segment = 'Клики';
  else if (!isNews && /(?:^|_)d(?:_|\.|$)/.test(rawCampaign)) segment = 'Дожим демо';
  else if (!isNews && /(?:^|_)50(?:_|\.|$)/.test(rawCampaign)) segment = 'Прогрев 0–50';
  else if (!isNews && /(?:^|_)1(?:_|\.|$)/.test(rawCampaign)) segment = 'Все доступные';

  return { type: type, product: product, flow: flow === 'Не указано' ? product : flow, segment: segment };
};

readDemoPlans_ = function(demoSpreadsheet, observedWeeks) {
  const sheet = demoSpreadsheet.getSheetByName(APP.demoPlanSheet);
  if (!sheet) return {};
  const rows = sheet.getDataRange().getDisplayValues();
  const plans = {};
  let family = '';
  let weekColumns = {};

  for (let i = 0; i < rows.length; i++) {
    const first = norm_(rows[i][0]);
    if (first === 'школа') { family = 'Школа'; weekColumns = {}; continue; }
    if (first === 'система') { family = 'Система'; weekColumns = {}; continue; }
    if (first === 'периодика') { family = 'Периодика'; weekColumns = {}; continue; }
    if (!family) continue;

    const candidateWeeks = {};
    for (let c = 1; c < rows[i].length; c++) {
      const week = Number(rows[i][c]);
      if (observedWeeks[week]) candidateWeeks[c] = week;
    }
    if ((first === 'неделя' || first === '') && Object.keys(candidateWeeks).length >= 3) {
      weekColumns = candidateWeeks;
      continue;
    }

    const group = demoGroup_(rows[i][0]);
    if (!group || !Object.keys(weekColumns).length) continue;
    const planRow = rows[i + 1] || [];
    if (norm_(planRow[0]) !== 'план') continue;
    Object.keys(weekColumns).forEach(function(column) {
      plans[group + ' ' + family + '|' + weekColumns[column]] = number_(planRow[Number(column)]);
    });
  }
  return plans;
};

readImportStatus_ = function(storage) {
  const folderConfigured = Boolean(PropertiesService.getScriptProperties().getProperty(APP.reportsFolderProperty));
  const sheet = storage.getSheetByName(APP.sendsaySheet);
  if (!sheet || sheet.getLastRow() < 2) {
    return { total:0, filesLoaded:0, uniqueSends:0, errors:0, duplicates:0, removed:0, demoMatched:0, demoUnmatched:0, demoNewsSkipped:0, failed:[], lastImportedAt:'', latestSendDate:'', folderConfigured:folderConfigured };
  }

  const values = sheet.getDataRange().getDisplayValues();
  const headers = headerMap_(values[0]);
  const col = function(a){ return indexOfHeader_(headers, a); };
  const idx = {
    fileId:col(['file id']), fileName:col(['имя файла']), imported:col(['импортирован']),
    status:col(['статус']), error:col(['ошибка']), sendsay:col(['sendsay']), date:col(['дата отправки']),
    demoStatus:col(['demo статус']), demoUpdated:col(['demo обновлено'])
  };

  let ready=0, errors=0, duplicates=0, removed=0, filesLoaded=0;
  let demoMatched=0, demoUnmatched=0, demoNewsSkipped=0;
  let lastImportedAt='', latestSendDate='', demoUpdatedAt='';
  const failed=[];

  for (let i=1;i<values.length;i++) {
    const row=values[i];
    const fileId=String(valueAt_(row,idx.fileId)||'');
    if (!fileId) continue;
    const status=String(valueAt_(row,idx.status)||'');
    if (status !== 'Удалено') filesLoaded++;
    if (status === 'Готово') ready++;
    if (status === 'Ошибка') errors++;
    if (status === 'Дубль') duplicates++;
    if (status === 'Удалено') removed++;

    if (status === 'Готово') {
      const ds=String(valueAt_(row,idx.demoStatus)||'');
      if (ds === 'Связано точно') demoMatched++;
      else if (ds.indexOf('Новостное:') === 0) demoNewsSkipped++;
      else if (ds) demoUnmatched++;
    }

    if (status === 'Готово' || status === 'Дубль') {
      const sentDate=normalizeDate_(valueAt_(row,idx.date));
      if (sentDate > latestSendDate) latestSendDate=sentDate;
    }

    if (status === 'Ошибка') {
      failed.push({
        fileId:fileId,
        fileName:valueAt_(row,idx.fileName)||'Файл без названия',
        message:valueAt_(row,idx.error)||'Отчёт не удалось распознать.',
        importedAt:valueAt_(row,idx.imported)||'',
        driveUrl:'https://drive.google.com/file/d/'+encodeURIComponent(fileId)+'/view',
        sendsayUrl:/^https:\/\//i.test(valueAt_(row,idx.sendsay)||'')?valueAt_(row,idx.sendsay):''
      });
    }

    const importedAt=String(valueAt_(row,idx.imported)||'');
    const demoStamp=String(valueAt_(row,idx.demoUpdated)||'');
    if (importedAt > lastImportedAt) lastImportedAt=importedAt;
    if (demoStamp > demoUpdatedAt) demoUpdatedAt=demoStamp;
  }

  failed.sort(function(a,b){return String(b.importedAt).localeCompare(String(a.importedAt));});
  return {
    total:ready, filesLoaded:filesLoaded, uniqueSends:ready, errors:errors, duplicates:duplicates, removed:removed,
    demoMatched:demoMatched, demoUnmatched:demoUnmatched, demoNewsSkipped:demoNewsSkipped,
    demoUpdatedAt:demoUpdatedAt, failed:failed, lastImportedAt:lastImportedAt,
    latestSendDate:latestSendDate, folderConfigured:folderConfigured
  };
};

function importStatusForFile_(storage, fileId) {
  const sheet=ensureSendsaySheet_(storage);
  const rows=sheet.getDataRange().getDisplayValues();
  if(rows.length<2)return'';
  const headers=headerMap_(rows[0]);
  const fileCol=indexOfHeader_(headers,['file id']);
  const statusCol=indexOfHeader_(headers,['статус']);
  for(let i=1;i<rows.length;i++){
    if(String(valueAt_(rows[i],fileCol)||'')===String(fileId||''))return String(valueAt_(rows[i],statusCol)||'');
  }
  return'';
}

uploadSendsayReport = function(formObject) {
  assertAdmin_();
  const saved=saveSendsayReportFile(formObject);
  const lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try{
    const storage=openStorage_();
    const file=DriveApp.getFileById(saved.fileId);
    let report;
    try{
      report=importDriveFile_(storage,file);
    }catch(error){
      writeImportError_(storage,file,error);
      clearCache_();
      throw error;
    }
    reconcileCanonicalRows_(ensureSendsaySheet_(storage));
    const status=importStatusForFile_(storage,saved.fileId);
    clearCache_();
    return{
      ok:true,
      duplicate:status==='Дубль',
      status:status,
      fileName:saved.fileName,
      subject:report.subject,
      product:report.product,
      date:report.date
    };
  }finally{
    lock.releaseLock();
  }
};
