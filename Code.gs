/**
 * Analytics Center — server side for a Google Apps Script web app.
 *
 * Install this project as a bound script of the editorial analytics workbook.
 * Run setup() once, then deploy as a web app for users in the Workspace domain.
 */

const APP = Object.freeze({
  version: '1.2.0',
  cachePrefix: 'analytics-center-v3',
  cacheSeconds: 300,
  sourceProperty: 'ANALYTICS_SHEET_ID',
  adminProperty: 'ANALYTICS_ADMIN_EMAIL',
  reportsFolderProperty: 'SENDSAY_REPORTS_FOLDER_ID',
  importSheet: '_Импорт Sendsay',
  importBatchSize: 6,
  currentDashboardSheet: '1. Редакциям — главное',
  resultsSheet: 'Итоги DEMO',
  registrySheet: 'Реестр писем',
  methodsSheet: 'Методика',
  topicSheet: '1.3 Лучшие темы — инфоповоды',
  materialSheet: '1.4 Статьи — что дает green',
  productOrder: [
    'ГЗ Периодика', 'ГЗ Система', 'ГЗ Школа',
    'ГФ Периодика', 'ГФ Система', 'ГФ Школа'
  ],
  planSheets: [
    '1.2 План для Вики — 31.08–04.09',
    '1.2 План для Вики — 24–28.08',
    '1.2 План для Вики — 17–21.08',
    '1.1 Досылки активдемо',
    '1.5 Досыл по живым'
  ]
});

const IMPORT_HEADERS = Object.freeze([
  'File ID', 'Имя файла', 'Изменён на Drive', 'Импортирован', 'Статус', 'Ошибка',
  'Дата отправки', 'Время отправки', 'Тип', 'Продукт', 'Поток', 'Сегмент', 'Campaign',
  'Sendsay', 'Тема письма', 'Отправлено', 'Доставлено', 'Доставляемость',
  'Уник. открытия', 'OR', 'Уник. клики', 'Click rate', 'CTOR', 'Отписки', 'UTOR'
]);

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Редакционная аналитика DEMO')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Run once from the editor while the script is bound to the analytics sheet. */
function setup() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('Откройте Apps Script из таблицы редакционной аналитики и повторите setup().');
  }

  const missing = [APP.currentDashboardSheet, APP.registrySheet]
    .filter(name => !spreadsheet.getSheetByName(name));
  if (missing.length) {
    throw new Error('Это не таблица редакционной аналитики. Не найдены листы: ' + missing.join(', '));
  }

  const props = PropertiesService.getScriptProperties();
  props.setProperty(APP.sourceProperty, spreadsheet.getId());
  const email = Session.getEffectiveUser().getEmail();
  if (email) props.setProperty(APP.adminProperty, email.toLowerCase());
  ensureImportSheet_(spreadsheet);
  clearCache_();

  return {
    ok: true,
    title: spreadsheet.getName(),
    admin: email || 'владелец проекта'
  };
}

function getAppData() {
  const cached = readCache_();
  if (cached) return cached;
  const data = buildAppData_();
  writeCache_(data);
  return data;
}

function refreshAppData() {
  assertAdmin_();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    clearCache_();
    SpreadsheetApp.flush();
    const data = buildAppData_();
    writeCache_(data);
    return data;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Imports the next small batch of new or updated Sendsay snapshots from Drive.
 * The browser repeats this call while `remaining` is greater than zero, which
 * keeps every Apps Script execution short enough for large MHTML files.
 */
function syncDriveReports() {
  assertAdmin_();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const result = importNewDriveReports_(openSource_(), APP.importBatchSize);
    clearCache_();
    return result;
  } finally {
    lock.releaseLock();
  }
}

/** Receives one MHTML file selected in the web app and saves it to Drive. */
function uploadSendsayReport(formObject) {
  assertAdmin_();
  const blob = formObject && formObject.reportFile;
  if (!blob || typeof blob.getBytes !== 'function') {
    throw new Error('Не удалось получить файл. Выберите отчёт Sendsay в формате .mhtml.');
  }

  const name = safeFileName_(blob.getName());
  if (!/\.mhtml?$/i.test(name)) {
    throw new Error('Поддерживаются отчёты Sendsay только в формате .mhtml.');
  }
  const bytes = blob.getBytes();
  if (!bytes.length) throw new Error('Файл «' + name + '» пустой.');
  if (bytes.length > 20 * 1024 * 1024) {
    throw new Error('Файл «' + name + '» больше 20 МБ. Загрузите его в папку Drive и нажмите «Обновить».');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const spreadsheet = openSource_();
    const folder = reportsFolder_();
    const existing = folder.getFilesByName(name);
    const imported = importIndex_(spreadsheet);
    let file = null;
    while (existing.hasNext()) {
      const candidate = existing.next();
      const previous = imported[candidate.getId()];
      if (candidate.getSize() === bytes.length && (!previous || previous.status !== 'Ошибка')) {
        file = candidate;
        break;
      }
    }

    const duplicate = Boolean(file);
    if (!file) {
      file = folder.createFile(Utilities.newBlob(bytes, 'multipart/related', name));
    }
    const report = importDriveFile_(spreadsheet, file);
    clearCache_();
    return {
      ok: true,
      duplicate: duplicate,
      fileName: name,
      subject: report.subject,
      product: report.product,
      date: report.date
    };
  } finally {
    lock.releaseLock();
  }
}

/** Saves the reports folder privately in Apps Script properties. */
function saveReportsFolder(folderUrl) {
  assertAdmin_();
  const match = String(folderUrl || '').match(/(?:folders\/|^)([-\w]{20,})(?:[/?#]|$)/i);
  if (!match) throw new Error('Вставьте полную ссылку на папку Google Drive.');
  const folder = DriveApp.getFolderById(match[1]);
  folder.getName(); // Verifies that the deploying account can read the folder.
  PropertiesService.getScriptProperties().setProperty(APP.reportsFolderProperty, folder.getId());
  clearCache_();
  return { ok: true, name: folder.getName() };
}

function buildAppData_() {
  const spreadsheet = openSource_();
  const products = readCurrentProducts_(spreadsheet);
  const currentWeek = detectCurrentWeek_(spreadsheet) || 36;
  const weeks = readWeeks_(spreadsheet, products, currentWeek);
  const plans = readPlans_(spreadsheet);
  const emails = mergeEmails_(readEmails_(spreadsheet, plans), readImportedEmails_(spreadsheet, plans));
  const insights = readInsights_(spreadsheet);
  const updated = new Date();
  const activeEmail = (Session.getActiveUser().getEmail() || '').toLowerCase();
  const adminEmail = (PropertiesService.getScriptProperties().getProperty(APP.adminProperty) || '').toLowerCase();

  return {
    version: APP.version,
    meta: {
      title: spreadsheet.getName(),
      updatedAt: updated.toISOString(),
      currentWeek: currentWeek,
      viewer: activeEmail,
      canRefresh: Boolean(activeEmail && adminEmail && activeEmail === adminEmail),
      canImport: Boolean(activeEmail && adminEmail && activeEmail === adminEmail),
      sourceUrl: spreadsheet.getUrl(),
      generatedAt: new Date().toISOString(),
      import: readImportStatus_(spreadsheet)
    },
    summary: aggregateProducts_(products),
    products: products,
    weeks: weeks,
    emails: emails,
    plans: plans,
    insights: insights,
    methodology: readMethodology_(spreadsheet)
  };
}

function openSource_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(APP.sourceProperty);
  if (id) return SpreadsheetApp.openById(id);

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    props.setProperty(APP.sourceProperty, active.getId());
    return active;
  }
  throw new Error('Проект не настроен. В редакторе Apps Script один раз запустите функцию setup().');
}

function assertAdmin_() {
  const props = PropertiesService.getScriptProperties();
  const admin = (props.getProperty(APP.adminProperty) || '').toLowerCase();
  const active = (Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!admin) throw new Error('Сначала запустите setup() из редактора Apps Script.');
  if (!active || active !== admin) {
    throw new Error('Обновлять данные может только ответственный за аналитику.');
  }
}

function readCurrentProducts_(spreadsheet) {
  const rows = sheetValues_(spreadsheet, APP.currentDashboardSheet);
  let headerIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const first = norm_(rows[i][0]);
    const joined = rows[i].map(norm_).join('|');
    if (first === 'продукт' && joined.includes('|r|') && joined.includes('|y|') && joined.includes('|g|')) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex < 0) throw new Error('Не найден блок текущего план-факта на листе «' + APP.currentDashboardSheet + '».');

  const header = rows[headerIndex];
  const columns = headerMap_(header);
  const idx = {
    product: indexOfHeader_(columns, ['продукт']),
    red: indexOfHeader_(columns, ['r', 'red', 'красные']),
    yellow: indexOfHeader_(columns, ['y', 'yellow', 'желтые', 'жёлтые']),
    green: indexOfHeader_(columns, ['g', 'green', 'зеленые', 'зелёные']),
    plan: indexOfHeaderContains_(columns, ['план']),
    progress: indexOfHeaderContains_(columns, ['% плана', 'план-факт']),
    decision: indexOfHeaderContains_(columns, ['что делаем', 'решение', 'статус', 'вывод'])
  };

  const found = {};
  for (let i = headerIndex + 1; i < Math.min(rows.length, headerIndex + 18); i++) {
    const original = valueAt_(rows[i], idx.product);
    const product = normalizeProduct_(original);
    if (!product || found[product]) continue;
    const plan = number_(valueAt_(rows[i], idx.plan));
    const green = number_(valueAt_(rows[i], idx.green));
    found[product] = {
      product: product,
      red: number_(valueAt_(rows[i], idx.red)),
      yellow: number_(valueAt_(rows[i], idx.yellow)),
      green: green,
      plan: plan,
      progress: plan ? round_(green / plan * 100, 1) : percent_(valueAt_(rows[i], idx.progress)),
      decision: valueAt_(rows[i], idx.decision) || ''
    };
  }

  return APP.productOrder.map(name => found[name] || {
    product: name, red: 0, yellow: 0, green: 0, plan: 0, progress: 0, decision: 'Нет данных'
  });
}

function detectCurrentWeek_(spreadsheet) {
  const rows = sheetValues_(spreadsheet, APP.currentDashboardSheet).slice(0, 8);
  const text = rows.flat().join(' ');
  const match = text.match(/(?:W|недел[^\d]{0,6})(\d{1,2})/i) || text.match(/(\d{1,2})[-–— ]*(?:я|ая)?\s*недел/i);
  return match ? Number(match[1]) : null;
}

function readWeeks_(spreadsheet, currentProducts, currentWeek) {
  const rows = sheetValues_(spreadsheet, APP.resultsSheet);
  const byWeek = {};

  for (let i = 0; i < rows.length; i++) {
    const title = String(rows[i][0] || '');
    const match = title.match(/ФАКТ\s+(\d{1,2})\s+НЕДЕЛ/i);
    if (!match) continue;
    const week = Number(match[1]);
    let headerIndex = -1;
    for (let j = i + 1; j < Math.min(rows.length, i + 7); j++) {
      if (norm_(rows[j][0]) === 'продукт') { headerIndex = j; break; }
    }
    if (headerIndex < 0) continue;
    const columns = headerMap_(rows[headerIndex]);
    const idx = {
      product: indexOfHeader_(columns, ['продукт']),
      plan: indexOfHeaderContains_(columns, ['план green', 'план']),
      red: indexOfHeader_(columns, ['red', 'r', 'красные']),
      yellow: indexOfHeader_(columns, ['yellow', 'y', 'желтые', 'жёлтые']),
      green: indexOfHeader_(columns, ['green', 'g', 'зеленые', 'зелёные'])
    };
    const products = [];
    for (let j = headerIndex + 1; j < Math.min(rows.length, headerIndex + 14); j++) {
      const product = normalizeProduct_(valueAt_(rows[j], idx.product));
      if (!product) {
        if (products.length) break;
        continue;
      }
      products.push({
        product: product,
        plan: number_(valueAt_(rows[j], idx.plan)),
        red: number_(valueAt_(rows[j], idx.red)),
        yellow: number_(valueAt_(rows[j], idx.yellow)),
        green: number_(valueAt_(rows[j], idx.green))
      });
    }
    if (products.length >= 4) byWeek[week] = aggregateWeek_(week, products);
  }

  byWeek[currentWeek] = aggregateWeek_(currentWeek, currentProducts);
  return Object.keys(byWeek).map(Number).sort((a, b) => a - b).map(week => byWeek[week]);
}

function importNewDriveReports_(spreadsheet, batchSize) {
  ensureImportSheet_(spreadsheet);
  const imported = importIndex_(spreadsheet);
  const iterator = reportsFolder_().getFiles();
  const candidates = [];

  while (iterator.hasNext()) {
    const file = iterator.next();
    const name = file.getName();
    if (!/\.mhtml?$/i.test(name)) continue;
    const modified = file.getLastUpdated().toISOString();
    const previous = imported[file.getId()];
    if (!previous || previous.modified !== modified) {
      candidates.push({ file: file, modified: modified });
    }
  }

  candidates.sort((a, b) => b.modified.localeCompare(a.modified));
  const batch = candidates.slice(0, Math.max(1, batchSize || APP.importBatchSize));
  let success = 0;
  let errors = 0;
  const items = [];

  batch.forEach(item => {
    try {
      const report = importDriveFile_(spreadsheet, item.file);
      success++;
      items.push({ fileName: item.file.getName(), ok: true, subject: report.subject });
    } catch (error) {
      errors++;
      writeImportError_(spreadsheet, item.file, error);
      items.push({ fileName: item.file.getName(), ok: false, error: error.message || String(error) });
    }
  });

  return {
    ok: true,
    processed: batch.length,
    success: success,
    errors: errors,
    remaining: Math.max(0, candidates.length - batch.length),
    found: candidates.length,
    items: items,
    importedTotal: readImportStatus_(spreadsheet).total
  };
}

function importDriveFile_(spreadsheet, file) {
  const raw = file.getBlob().getDataAsString('UTF-8');
  const report = parseSendsayMhtml_(raw, file.getName());
  report.fileId = file.getId();
  report.fileName = file.getName();
  report.modified = file.getLastUpdated().toISOString();
  report.importedAt = new Date().toISOString();

  const missing = [];
  if (!report.campaignId) missing.push('ссылка на кампанию');
  if (!report.date) missing.push('дата отправки');
  if (!report.subject) missing.push('тема письма');
  if (missing.length) {
    const error = new Error('Не найдены поля Sendsay: ' + missing.join(', ') + '. Пересохраните страницу отчёта после её полной загрузки.');
    error.report = report;
    throw error;
  }

  upsertImportRow_(spreadsheet, report);
  return report;
}

function parseSendsayMhtml_(raw, fileName) {
  if (!raw || raw.indexOf('app.sendsay.ru/reports/campaigns/') < 0) {
    throw new Error('Файл не похож на сохранённую сводку Sendsay.');
  }

  const unfolded = raw.replace(/=\r?\n/g, '');
  const campaignIdMatch = raw.match(/reports\/campaigns\/(\d+)\/summary/i);
  const campaignId = campaignIdMatch ? campaignIdMatch[1] : '';
  const campaign = extractCampaignName_(raw, fileName);
  const sentBlock = snippetAfter_(unfolded, 'data-sentry=3D"CampaignReportHeader-sent"', 1200);
  const sentMatch = sentBlock.match(/(\d{2}\.\d{2}\.\d{4})[\s\S]{0,120}?(\d{2}:\d{2})/);
  const date = sentMatch ? normalizeDate_(sentMatch[1]) : dateFromText_(campaign + ' ' + fileName);
  const time = sentMatch ? sentMatch[2] : '';
  const subject = extractInputValue_(unfolded, 'StatReportSummaryLetterParams-subject');
  const fromEmail = extractInputValue_(unfolded, 'StatReportSummaryLetterParams-fromEmail');
  const fromName = extractInputValue_(unfolded, 'StatReportSummaryLetterParams-fromName');
  const classification = classifyCampaign_(campaign, fileName, subject, fromEmail + ' ' + fromName);

  return {
    campaignId: campaignId,
    campaign: campaign,
    sendsay: campaignId ? 'https://app.sendsay.ru/reports/campaigns/' + campaignId + '/summary' : '',
    date: date,
    time: time,
    type: classification.type,
    product: classification.product,
    flow: classification.flow,
    segment: classification.segment,
    subject: subject,
    sent: metricNumber_(unfolded, 'SummaryStatsWithTooltips-sent'),
    delivered: metricNumber_(unfolded, 'SummaryStatsWithTooltips-delivered'),
    deliveredRate: metricPercent_(unfolded, 'SummaryStatsWithTooltips-deliveredRatio'),
    uniqueOpened: metricNumber_(unfolded, 'SummaryStatsWithTooltips-uniqueOpened'),
    openRate: metricPercent_(unfolded, 'SummaryStatsWithTooltips-uniqueOpenedRatio'),
    uniqueClicked: metricNumber_(unfolded, 'SummaryStatsWithTooltips-uniqueClicked'),
    clickRate: metricPercent_(unfolded, 'SummaryStatsWithTooltips-uniqueClickedRatio'),
    ctor: metricPercent_(unfolded, 'SummaryStatsWithTooltips-CTOR'),
    unsubscribed: metricNumber_(unfolded, 'SummaryStatsWithTooltips-unsubed'),
    utor: metricPercent_(unfolded, 'SummaryStatsWithTooltips-UTOR')
  };
}

function extractCampaignName_(raw, fileName) {
  const header = raw.match(/^Subject:\s*(.+)$/mi);
  const title = header ? decodeQpText_(header[1]) : String(fileName || '');
  const parts = title.split(/\s*[|_]\s*/).filter(Boolean);
  const demoIndex = parts.findIndex(part => /^(demo|news)$/i.test(part));
  if (demoIndex >= 0 && parts.length > demoIndex + 1) {
    const tail = parts.slice(demoIndex + 1);
    while (tail.length && /^(sendsay|mhtml|webarchive)$/i.test(tail[tail.length - 1].replace(/\..*$/, ''))) tail.pop();
    if (tail.length) return tail.join('_').replace(/_+$/, '');
  }
  const match = title.match(/(?:Demo|News)\s*[|_]\s*(.*?)\s*[|_]\s*Sendsay/i);
  return match ? match[1].trim() : String(fileName || '').replace(/\.mhtml?$/i, '');
}

function classifyCampaign_(campaign, fileName, subject, sender) {
  const text = norm_([campaign, fileName, subject, sender].join(' '));
  const type = /letter_news|\bnews\b|digest/.test(text) ? 'news' : 'demo';
  let product = 'Не указано';
  let flow = 'Не указано';

  if (/goszakaz[_-]?cgz/.test(text)) { product = 'ГЗ Система'; flow = product; }
  else if (/goszakaz[_-]?(gzru|vio|fas)/.test(text)) {
    product = 'ГЗ Периодика';
    flow = /[_-]vio(?:_|\b)/.test(text) ? product + ' · ВИО' : /[_-]fas(?:_|\b)/.test(text) ? product + ' · ФАС' : product + ' · ГЗРУ';
  }
  else if (/letter_demo_goszakaz|goszakaz-school|высшая школа госзакупок/.test(text)) { product = 'ГЗ Школа'; flow = product; }
  else if (/gosfinansi[_-]?letter[_-]?gfss/.test(text)) { product = 'ГФ Система'; flow = product; }
  else if (/gosfinansi[_-]?letter[_-]?demo[_-]?school|школа главбуха/.test(text)) { product = 'ГФ Школа'; flow = product; }
  else if (/gosfinansi[_-]?letteri?[_-]?(ubu|zbu)|\bubu\b|\bzbu\b/.test(text)) {
    product = 'ГФ Периодика';
    flow = /[_-]zbu(?:_|\b)/.test(text) ? product + ' · ЗБУ' : product + ' · УБУ';
  }
  else if (/letter_news_goszakaz/.test(text)) { product = 'ГЗ Периодика'; flow = product; }
  else if (/letter_news_gf/.test(text)) { product = 'ГФ Периодика'; flow = product; }

  let segment = type === 'news' ? 'Новостная рассылка' : 'Живые';
  if (/(?:^|_)open(?:_|\.)/.test(campaign.toLowerCase())) segment = 'Clicks';
  else if (/(?:^|_)d(?:_|\.)/.test(campaign.toLowerCase())) segment = 'Дожим демо';
  else if (/(?:^|_)50(?:_|\.)/.test(campaign.toLowerCase())) segment = 'Прогрев 0–50';
  else if (/(?:^|_)1(?:_|\.)/.test(campaign.toLowerCase())) segment = 'Все доступные';

  return { type: type, product: product, flow: flow === 'Не указано' ? product : flow, segment: segment };
}

function metricNumber_(unfolded, key) {
  return number_(extractMetricText_(unfolded, key));
}

function metricPercent_(unfolded, key) {
  return percent_(extractMetricText_(unfolded, key));
}

function extractMetricText_(unfolded, key) {
  const marker = 'data-sentry=3D"' + key + '"';
  const snippet = snippetAfter_(unfolded, marker, 1600);
  if (!snippet) return '';
  const h4End = snippet.indexOf('</h4>');
  const spanEnd = snippet.indexOf('</span>');
  let end = -1;
  if (h4End >= 0 && spanEnd >= 0) end = Math.min(h4End + 5, spanEnd + 7);
  else end = h4End >= 0 ? h4End + 5 : spanEnd + 7;
  if (end < 0) return '';
  const match = snippet.slice(end).match(/<span[^>]*>([^<]*)<\/span>/i);
  return match ? decodeQpText_(match[1]) : '';
}

function extractInputValue_(unfolded, key) {
  const marker = 'data-sentry=3D"' + key + '"';
  const snippet = snippetAfter_(unfolded, marker, 5000);
  if (!snippet) return '';
  const match = snippet.match(/<input[^>]*\svalue=3D"([^"]*)"/i);
  return match ? decodeQpText_(match[1]) : '';
}

function snippetAfter_(text, marker, length) {
  const index = text.indexOf(marker);
  return index < 0 ? '' : text.slice(index, index + length);
}

function decodeQpText_(value) {
  const source = String(value || '').replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '=' && /^[0-9a-f]{2}$/i.test(source.slice(i + 1, i + 3))) {
      bytes.push(parseInt(source.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      const code = source.charCodeAt(i);
      if (code <= 127) bytes.push(code);
      else bytes.push.apply(bytes, Utilities.newBlob(source[i]).getBytes().map(byte => byte < 0 ? byte + 256 : byte));
    }
  }
  const signed = bytes.map(byte => byte > 127 ? byte - 256 : byte);
  return htmlText_(Utilities.newBlob(signed).getDataAsString('UTF-8'));
}

function htmlText_(value) {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function reportsFolder_() {
  const id = PropertiesService.getScriptProperties().getProperty(APP.reportsFolderProperty);
  if (!id) throw new Error('Папка с отчётами ещё не подключена. Вставьте ссылку на сайте один раз.');
  return DriveApp.getFolderById(id);
}

function ensureImportSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(APP.importSheet);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(APP.importSheet);
    sheet.getRange(1, 1, 1, IMPORT_HEADERS.length).setValues([IMPORT_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, IMPORT_HEADERS.length)
      .setBackground('#111b31')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.hideSheet();
  } else if (sheet.getLastColumn() < IMPORT_HEADERS.length || norm_(sheet.getRange(1, 1).getDisplayValue()) !== 'file id') {
    sheet.getRange(1, 1, 1, IMPORT_HEADERS.length).setValues([IMPORT_HEADERS]);
  }
  return sheet;
}

function importIndex_(spreadsheet) {
  const sheet = ensureImportSheet_(spreadsheet);
  const values = sheet.getDataRange().getDisplayValues();
  const index = {};
  for (let i = 1; i < values.length; i++) {
    const id = String(values[i][0] || '').trim();
    if (!id) continue;
    index[id] = { row: i + 1, modified: values[i][2], status: values[i][4] };
  }
  return index;
}

function upsertImportRow_(spreadsheet, report) {
  const sheet = ensureImportSheet_(spreadsheet);
  const index = importIndex_(spreadsheet);
  const row = [
    report.fileId, report.fileName, report.modified, report.importedAt, 'Готово', '',
    report.date, report.time, report.type, report.product, report.flow, report.segment, report.campaign,
    report.sendsay, report.subject, report.sent, report.delivered, report.deliveredRate,
    report.uniqueOpened, report.openRate, report.uniqueClicked, report.clickRate, report.ctor,
    report.unsubscribed, report.utor
  ];
  const rowNumber = index[report.fileId] ? index[report.fileId].row : sheet.getLastRow() + 1;
  sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  markReplacedErrors_(sheet, report.fileName, report.fileId);
}

function markReplacedErrors_(sheet, fileName, currentFileId) {
  const rowCount = sheet.getLastRow() - 1;
  if (rowCount < 1 || !fileName) return;
  const values = sheet.getRange(2, 1, rowCount, 5).getDisplayValues();
  let changed = false;
  values.forEach(row => {
    if (row[0] !== currentFileId && row[1] === fileName && row[4] === 'Ошибка') {
      row[4] = 'Заменено';
      changed = true;
    }
  });
  if (changed) sheet.getRange(2, 5, rowCount, 1).setValues(values.map(row => [row[4]]));
}

function writeImportError_(spreadsheet, file, error) {
  const partial = error && error.report ? error.report : {};
  const report = Object.assign({
    date: '', time: '', type: '', product: '', flow: '', segment: '', campaign: '', sendsay: '',
    subject: '', sent: '', delivered: '', deliveredRate: '', uniqueOpened: '', openRate: '',
    uniqueClicked: '', clickRate: '', ctor: '', unsubscribed: '', utor: ''
  }, partial, {
    fileId: file.getId(),
    fileName: file.getName(),
    modified: file.getLastUpdated().toISOString(),
    importedAt: new Date().toISOString()
  });
  const sheet = ensureImportSheet_(spreadsheet);
  const index = importIndex_(spreadsheet);
  const row = [
    report.fileId, report.fileName, report.modified, report.importedAt, 'Ошибка',
    String(error && error.message ? error.message : error).slice(0, 500),
    report.date, report.time, report.type, report.product, report.flow, report.segment, report.campaign,
    report.sendsay, report.subject, report.sent, report.delivered, report.deliveredRate,
    report.uniqueOpened, report.openRate, report.uniqueClicked, report.clickRate, report.ctor,
    report.unsubscribed, report.utor
  ];
  const rowNumber = index[report.fileId] ? index[report.fileId].row : sheet.getLastRow() + 1;
  sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
}

function readImportStatus_(spreadsheet) {
  const folderConfigured = Boolean(PropertiesService.getScriptProperties().getProperty(APP.reportsFolderProperty));
  const sheet = spreadsheet.getSheetByName(APP.importSheet);
  if (!sheet || sheet.getLastRow() < 2) {
    return { total: 0, errors: 0, failed: [], lastImportedAt: '', folderConfigured: folderConfigured };
  }

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 15).getDisplayValues();
  let ready = 0;
  let errors = 0;
  let lastImportedAt = '';
  const failed = [];

  values.forEach(row => {
    if (!row[0]) return;
    const status = row[4];
    if (status === 'Готово') ready++;
    if (status === 'Ошибка') {
      errors++;
      failed.push({
        fileId: row[0],
        fileName: row[1] || 'Файл без названия',
        message: row[5] || 'Отчёт не удалось распознать.',
        importedAt: row[3] || '',
        driveUrl: 'https://drive.google.com/file/d/' + encodeURIComponent(row[0]) + '/view',
        sendsayUrl: /^https:\/\//i.test(row[13] || '') ? row[13] : ''
      });
    }
    if (row[3] > lastImportedAt) lastImportedAt = row[3];
  });

  failed.sort((a, b) => String(b.importedAt).localeCompare(String(a.importedAt)));
  return {
    total: ready,
    errors: errors,
    failed: failed.slice(0, 50),
    lastImportedAt: lastImportedAt,
    folderConfigured: folderConfigured
  };
}

function safeFileName_(value) {
  const name = String(value || 'report.mhtml').replace(/[\\/:*?"<>|]+/g, '_').trim();
  return name.slice(0, 220) || 'report.mhtml';
}

function readImportedEmails_(spreadsheet, plans) {
  const sheet = spreadsheet.getSheetByName(APP.importSheet);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getDataRange().getDisplayValues();
  const headers = headerMap_(rows[0]);
  const col = aliases => indexOfHeader_(headers, aliases);
  const idx = {
    fileId: col(['file id']), status: col(['статус']), date: col(['дата отправки']),
    type: col(['тип']), product: col(['продукт']), flow: col(['поток']), segment: col(['сегмент']), campaign: col(['campaign']),
    sendsay: col(['sendsay']), subject: col(['тема письма']), delivered: col(['доставлено']),
    openRate: col(['or']), clicks: col(['уник. клики']), clickRate: col(['click rate']), ctor: col(['ctor'])
  };
  const planIndexes = buildPlanIndexes_(plans);
  const output = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (valueAt_(row, idx.status) !== 'Готово') continue;
    const date = normalizeDate_(valueAt_(row, idx.date));
    const subject = String(valueAt_(row, idx.subject) || '').trim();
    if (!date || !subject) continue;
    const product = String(valueAt_(row, idx.product) || 'Не указано').trim();
    const plan = matchPlan_(planIndexes, subject, '', product, date);
    output.push({
      id: 'import-' + String(valueAt_(row, idx.fileId) || i),
      importedOnly: true,
      hasDemoData: false,
      date: date,
      week: isoWeek_(date),
      type: String(valueAt_(row, idx.type) || 'demo').trim(),
      product: product,
      productFlow: String(valueAt_(row, idx.flow) || product).trim(),
      segment: String(valueAt_(row, idx.segment) || '').trim(),
      campaign: String(valueAt_(row, idx.campaign) || '').trim(),
      sendsay: url_(valueAt_(row, idx.sendsay)),
      subject: subject,
      material: '',
      delivered: number_(valueAt_(row, idx.delivered)),
      openRate: percent_(valueAt_(row, idx.openRate)),
      clicks: number_(valueAt_(row, idx.clicks)),
      clickRate: percent_(valueAt_(row, idx.clickRate)),
      ctor: percent_(valueAt_(row, idx.ctor)),
      red: 0, yellow: 0, green: 0, potential: 0,
      maturity: 'Sendsay загружен · DEMO ещё не сопоставлено',
      score: 'Только данные Sendsay',
      worked: '', failed: '', source: 'Импорт из папки Sendsay',
      weeklyPlan: 0, weeklyFact: 0, weeklyProgress: 0,
      note: 'Письмо уже видно в реестре. R / Y / G появятся после точного сопоставления с отчётом DEMO.',
      body: plan ? plan.body : '', innerTitle: plan ? plan.innerTitle : '', cta: plan ? plan.cta : '',
      targetUrl: plan ? plan.targetUrl : '', rationale: plan ? plan.rationale : '',
      exclusions: plan ? plan.exclusions : '', planStatus: plan ? plan.status : ''
    });
  }
  return output;
}

function mergeEmails_(registry, imported) {
  const byKey = {};
  imported.forEach(item => { byKey[emailKey_(item)] = item; });
  registry.forEach(item => {
    item.hasDemoData = true;
    const key = emailKey_(item);
    const raw = byKey[key];
    byKey[key] = raw ? Object.assign({}, raw, item, {
      delivered: item.delivered || raw.delivered,
      openRate: item.openRate || raw.openRate,
      clicks: item.clicks || raw.clicks,
      clickRate: item.clickRate || raw.clickRate,
      ctor: item.ctor || raw.ctor,
      importedOnly: false,
      hasDemoData: true
    }) : item;
  });
  return Object.keys(byKey).map(key => byKey[key])
    .sort((a, b) => b.date.localeCompare(a.date) || b.green - a.green || a.subject.localeCompare(b.subject));
}

function emailKey_(item) {
  const sendsay = String(item.sendsay || '').match(/campaigns\/(\d+)/i);
  if (sendsay) return 'sendsay:' + sendsay[1];
  if (item.campaign) return 'campaign:' + norm_(item.campaign);
  return ['fallback', item.date, item.product, subjectKey_(item.subject)].join(':');
}

function readEmails_(spreadsheet, plans) {
  const rows = sheetValues_(spreadsheet, APP.registrySheet);
  if (!rows.length) return [];
  const headerIndex = rows.findIndex(row => norm_(row[0]) === 'дата' && row.map(norm_).includes('продукт'));
  if (headerIndex < 0) return [];
  const columns = headerMap_(rows[headerIndex]);
  const col = aliases => indexOfHeader_(columns, aliases);
  const idx = {
    date: col(['дата']), type: col(['тип']), product: col(['продукт']), segment: col(['сегмент']),
    campaign: col(['utm campaign / источник', 'utm campaign', 'источник']),
    sendsay: col(['sendsay']), subject: col(['фактическая тема sendsay', 'тема']),
    material: col(['материал / id', 'материал']), delivered: col(['доставлено']),
    openRate: col(['or']), clicks: col(['уник. клики', 'уникальные клики']),
    clickRate: col(['click rate']), ctor: col(['ctor']), red: col(['красные']),
    yellow: col(['желтые', 'жёлтые']), green: col(['зеленые = kpi', 'зелёные = kpi', 'green']),
    potential: col(['ж+з: потенциал, не kpi']), maturity: col(['срез / зрелость']),
    score: col(['оценка темы']), worked: col(['что сработало']), failed: col(['что не сработало']),
    source: col(['источник событий']), plan: col(['план недели']), fact: col(['факт недели']),
    progress: col(['% плана']), note: col(['примечание'])
  };

  const planIndexes = buildPlanIndexes_(plans);
  const output = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const date = normalizeDate_(valueAt_(row, idx.date));
    const originalProduct = valueAt_(row, idx.product);
    const product = normalizeProduct_(originalProduct) || String(originalProduct || '').trim();
    const subject = String(valueAt_(row, idx.subject) || '').trim();
    if (!date || (!product && !subject)) continue;
    const material = String(valueAt_(row, idx.material) || '').trim();
    const plan = matchPlan_(planIndexes, subject, material, product, date);
    const green = number_(valueAt_(row, idx.green));
    const weeklyPlan = number_(valueAt_(row, idx.plan));
    const weeklyFact = number_(valueAt_(row, idx.fact));
    output.push({
      id: 'mail-' + (i + 1),
      date: date,
      week: isoWeek_(date),
      type: String(valueAt_(row, idx.type) || 'demo').trim(),
      product: product || 'Не указано',
      productFlow: String(originalProduct || product).trim(),
      segment: String(valueAt_(row, idx.segment) || '').trim(),
      campaign: String(valueAt_(row, idx.campaign) || '').trim(),
      sendsay: url_(valueAt_(row, idx.sendsay)),
      subject: subject || 'Тема не указана',
      material: material,
      delivered: number_(valueAt_(row, idx.delivered)),
      openRate: percent_(valueAt_(row, idx.openRate)),
      clicks: number_(valueAt_(row, idx.clicks)),
      clickRate: percent_(valueAt_(row, idx.clickRate)),
      ctor: percent_(valueAt_(row, idx.ctor)),
      red: number_(valueAt_(row, idx.red)),
      yellow: number_(valueAt_(row, idx.yellow)),
      green: green,
      potential: number_(valueAt_(row, idx.potential)),
      maturity: String(valueAt_(row, idx.maturity) || '').trim(),
      score: String(valueAt_(row, idx.score) || '').trim(),
      worked: String(valueAt_(row, idx.worked) || '').trim(),
      failed: String(valueAt_(row, idx.failed) || '').trim(),
      source: String(valueAt_(row, idx.source) || '').trim(),
      weeklyPlan: weeklyPlan,
      weeklyFact: weeklyFact,
      weeklyProgress: weeklyPlan ? round_(weeklyFact / weeklyPlan * 100, 1) : percent_(valueAt_(row, idx.progress)),
      note: String(valueAt_(row, idx.note) || '').trim(),
      body: plan ? plan.body : '',
      innerTitle: plan ? plan.innerTitle : '',
      cta: plan ? plan.cta : '',
      targetUrl: plan ? plan.targetUrl : '',
      rationale: plan ? plan.rationale : '',
      exclusions: plan ? plan.exclusions : '',
      planStatus: plan ? plan.status : ''
    });
  }

  return output.sort((a, b) => b.date.localeCompare(a.date) || b.green - a.green);
}

function readPlans_(spreadsheet) {
  const plans = [];
  APP.planSheets.forEach(sheetName => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) return;
    const rows = sheet.getDataRange().getDisplayValues();
    let headerIndex = -1;
    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      const normalized = rows[i].map(norm_);
      const hasSubject = normalized.some(v => v === 'тема' || v.includes('тема письма'));
      const hasBody = normalized.some(v => v.includes('текст') || v.includes('первый экран'));
      if (hasSubject && hasBody) { headerIndex = i; break; }
    }
    if (headerIndex < 0) return;

    const columns = headerMap_(rows[headerIndex]);
    const find = aliases => indexOfHeader_(columns, aliases);
    const findContains = aliases => indexOfHeaderContains_(columns, aliases);
    const idx = {
      date: find(['дата']),
      product: findContains(['продукт / поток', 'продукт']),
      segment: findContains(['сегмент', 'кому шлем']),
      subject: findContains(['тема письма · доступ', 'тема письма', 'тема']),
      innerTitle: findContains(['заголовок внутри', 'заголовок']),
      body: findContains(['полный текст', 'текст / первый экран', 'первый экран / текст', 'текст']),
      cta: find(['cta']),
      material: findContains(['материал', 'куда ведем / ссылка']),
      status: findContains(['статус / когда отправлять', 'решение / приоритет', 'статус / что изменено', 'статус']),
      rationale: findContains(['почему эта тема', 'почему сейчас', 'что предлагаем мы']),
      exclusions: findContains(['исключить', 'проверить утром']),
      nextStep: findContains(['следующий шаг'])
    };

    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      const subject = String(valueAt_(row, idx.subject) || '').trim();
      const productFlow = String(valueAt_(row, idx.product) || '').trim();
      if (!subject || !productFlow || subject.length < 5 || /^[-—]+$/.test(subject)) continue;
      const product = normalizeProduct_(productFlow);
      if (!product) continue;
      const status = String(valueAt_(row, idx.status) || '').trim();
      const date = normalizeDate_(valueAt_(row, idx.date)) || dateFromText_(status + ' ' + rows[0].join(' '));
      const rawMaterial = String(valueAt_(row, idx.material) || '').trim();
      const ctaRaw = String(valueAt_(row, idx.cta) || '').trim();
      plans.push({
        id: 'plan-' + slug_(sheetName) + '-' + (i + 1),
        date: date || '',
        week: date ? isoWeek_(date) : null,
        sourceSheet: sheetName,
        product: product,
        productFlow: productFlow,
        segment: String(valueAt_(row, idx.segment) || '').trim(),
        subject: subject,
        innerTitle: String(valueAt_(row, idx.innerTitle) || '').trim(),
        body: String(valueAt_(row, idx.body) || '').trim(),
        cta: ctaRaw.replace(/\s*[·|]\s*https?:\/\/.*$/i, '').trim(),
        targetUrl: url_(rawMaterial) || url_(ctaRaw),
        material: rawMaterial,
        status: status,
        rationale: String(valueAt_(row, idx.rationale) || '').trim(),
        exclusions: String(valueAt_(row, idx.exclusions) || '').trim(),
        nextStep: String(valueAt_(row, idx.nextStep) || '').trim()
      });
    }
  });
  return plans.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function readInsights_(spreadsheet) {
  return {
    topics: readSimpleTable_(spreadsheet, APP.topicSheet, ['направление', 'инфоповод'], 120),
    materials: readSimpleTable_(spreadsheet, APP.materialSheet, ['группа / слой', 'id материала'], 160)
  };
}

function readSimpleTable_(spreadsheet, sheetName, expectedHeaders, limit) {
  const rows = sheetValues_(spreadsheet, sheetName);
  if (!rows.length) return [];
  let headerIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const normalized = rows[i].map(norm_);
    if (expectedHeaders.every(h => normalized.includes(h))) { headerIndex = i; break; }
  }
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map(v => String(v || '').trim());
  const output = [];
  for (let i = headerIndex + 1; i < rows.length && output.length < limit; i++) {
    if (!rows[i].some(Boolean)) continue;
    const item = {};
    headers.forEach((header, col) => { if (header) item[header] = String(rows[i][col] || '').trim(); });
    if (Object.values(item).some(Boolean)) output.push(item);
  }
  return output;
}

function readMethodology_(spreadsheet) {
  const rows = sheetValues_(spreadsheet, APP.methodsSheet);
  return rows.slice(0, 60).map(row => row.filter(Boolean).join(' — ').trim()).filter(Boolean);
}

function buildPlanIndexes_(plans) {
  const bySubject = {};
  const byMaterial = {};
  plans.forEach(plan => {
    const subject = subjectKey_(plan.subject);
    const material = materialKey_(plan.material || plan.targetUrl);
    if (subject && !bySubject[subject]) bySubject[subject] = plan;
    if (material && !byMaterial[material]) byMaterial[material] = plan;
  });
  return { bySubject: bySubject, byMaterial: byMaterial, all: plans };
}

function matchPlan_(indexes, subject, material, product, date) {
  const materialKey = materialKey_(material);
  if (materialKey && indexes.byMaterial[materialKey]) return indexes.byMaterial[materialKey];
  const subjectKey = subjectKey_(subject);
  if (subjectKey && indexes.bySubject[subjectKey]) return indexes.bySubject[subjectKey];
  return indexes.all.find(plan => plan.product === product && plan.date === date && similarity_(subjectKey, subjectKey_(plan.subject)) >= 0.72) || null;
}

function similarity_(a, b) {
  if (!a || !b) return 0;
  const left = new Set(a.split(' ').filter(word => word.length > 3));
  const right = new Set(b.split(' ').filter(word => word.length > 3));
  if (!left.size || !right.size) return 0;
  let common = 0;
  left.forEach(word => { if (right.has(word)) common++; });
  return common / Math.max(left.size, right.size);
}

function aggregateProducts_(products) {
  const summary = products.reduce((sum, row) => {
    sum.red += number_(row.red);
    sum.yellow += number_(row.yellow);
    sum.green += number_(row.green);
    sum.plan += number_(row.plan);
    return sum;
  }, { red: 0, yellow: 0, green: 0, plan: 0 });
  summary.progress = summary.plan ? round_(summary.green / summary.plan * 100, 1) : 0;
  summary.potential = summary.green + summary.yellow;
  summary.totalEvents = summary.red + summary.yellow + summary.green;
  summary.greenShare = summary.totalEvents ? round_(summary.green / summary.totalEvents * 100, 1) : 0;
  return summary;
}

function aggregateWeek_(week, products) {
  const result = aggregateProducts_(products);
  result.week = week;
  return result;
}

function sheetValues_(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  return sheet ? sheet.getDataRange().getDisplayValues() : [];
}

function headerMap_(row) {
  return row.map(value => ({ raw: String(value || '').trim(), normalized: norm_(value) }));
}

function indexOfHeader_(columns, aliases) {
  const normalized = aliases.map(norm_);
  return columns.findIndex(column => normalized.includes(column.normalized));
}

function indexOfHeaderContains_(columns, aliases) {
  const normalized = aliases.map(norm_);
  return columns.findIndex(column => normalized.some(alias => column.normalized.includes(alias)));
}

function valueAt_(row, index) {
  return index >= 0 && index < row.length ? row[index] : '';
}

function normalizeProduct_(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return APP.productOrder.find(product => text.startsWith(product)) || null;
}

function norm_(value) {
  return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function subjectKey_(value) {
  return norm_(value).replace(/https?:\/\/\S+/g, '').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
}

function materialKey_(value) {
  const text = String(value || '');
  const uuid = text.match(/[a-f0-9]{8}-[a-f0-9-]{27,}/i);
  if (uuid) return uuid[0].toLowerCase();
  const numbers = text.match(/(?:\/|\b)(\d{5,})(?:\/|\b)/g);
  return numbers && numbers.length ? numbers[numbers.length - 1].replace(/\D/g, '') : '';
}

function number_(value) {
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  const cleaned = String(value || '').replace(/≈/g, '').replace(/\s/g, '').replace(/%/g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return isFinite(parsed) ? parsed : 0;
}

function percent_(value) {
  const text = String(value || '').trim();
  const parsed = number_(text);
  if (!parsed) return 0;
  if (text.includes('%')) return round_(parsed, 2);
  return round_(Math.abs(parsed) <= 1 ? parsed * 100 : parsed, 2);
}

function round_(value, digits) {
  const power = Math.pow(10, digits || 0);
  return Math.round((Number(value) || 0) * power) / power;
}

function normalizeDate_(value) {
  if (value instanceof Date && !isNaN(value)) return Utilities.formatDate(value, APP_TIME_ZONE_(), 'yyyy-MM-dd');
  const text = String(value || '').trim();
  let match = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if (match) return match[3] + '-' + pad_(match[2]) + '-' + pad_(match[1]);
  match = text.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  if (match) return match[1] + '-' + pad_(match[2]) + '-' + pad_(match[3]);
  return '';
}

function dateFromText_(value) {
  const text = String(value || '');
  const full = text.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if (full) return full[3] + '-' + pad_(full[2]) + '-' + pad_(full[1]);
  const short = text.match(/(\d{1,2})[.\/-](\d{1,2})(?![.\/-]\d)/);
  if (short) return '2026-' + pad_(short[2]) + '-' + pad_(short[1]);
  return '';
}

function isoWeek_(isoDate) {
  if (!isoDate) return null;
  const date = new Date(isoDate + 'T12:00:00Z');
  if (isNaN(date)) return null;
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function url_(value) {
  const match = String(value || '').match(/https?:\/\/[^\s·|]+/i);
  return match ? match[0].replace(/[),.;]+$/, '') : '';
}

function slug_(value) {
  return String(value || '').toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40);
}

function pad_(value) {
  return String(value).padStart(2, '0');
}

function APP_TIME_ZONE_() {
  return Session.getScriptTimeZone() || 'Europe/Moscow';
}

function readCache_() {
  const cache = CacheService.getScriptCache();
  const count = Number(cache.get(APP.cachePrefix + ':count'));
  if (!count || count > 80) return null;
  const keys = [];
  for (let i = 0; i < count; i++) keys.push(APP.cachePrefix + ':' + i);
  const chunks = cache.getAll(keys);
  if (keys.some(key => typeof chunks[key] !== 'string')) return null;
  try { return JSON.parse(keys.map(key => chunks[key]).join('')); }
  catch (error) { return null; }
}

function writeCache_(data) {
  const json = JSON.stringify(data);
  const size = 24000;
  const payload = {};
  let count = 0;
  for (let start = 0; start < json.length; start += size) {
    payload[APP.cachePrefix + ':' + count] = json.slice(start, start + size);
    count++;
  }
  payload[APP.cachePrefix + ':count'] = String(count);
  try { CacheService.getScriptCache().putAll(payload, APP.cacheSeconds); }
  catch (error) { /* Cache is an optimization; live reads remain the source of truth. */ }
}

function clearCache_() {
  const cache = CacheService.getScriptCache();
  const count = Number(cache.get(APP.cachePrefix + ':count')) || 0;
  const keys = [APP.cachePrefix + ':count'];
  for (let i = 0; i < count; i++) keys.push(APP.cachePrefix + ':' + i);
  cache.removeAll(keys);
}

