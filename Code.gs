/**
 * Analytics Center v2 — независимая сборка аналитики DEMO.
 *
 * Источники истины:
 * 1) папка Drive с фактическими отчётами Sendsay (.webarchive / .mhtml / .mht);
 * 2) исходная таблица "Статистика по ДЕМО".
 *
 * Старые листы "DEMO-аналитики" не читаются и не участвуют в расчётах.
 */

const APP = Object.freeze({
  version: '2.0.0',
  parserVersion: 'sendsay-webarchive-v2',
  cachePrefix: 'analytics-center-v6',
  cacheSeconds: 300,

  storageProperty: 'ANALYTICS_STORAGE_SHEET_ID',
  adminProperty: 'ANALYTICS_ADMIN_EMAIL',
  reportsFolderProperty: 'SENDSAY_REPORTS_FOLDER_ID',
  demoSourceProperty: 'DEMO_STATS_SHEET_ID',

  // Это исходная "Статистика по ДЕМО", а не старая редакционная DEMO-аналитика.
  defaultDemoStatsId: '1d8l_kvvBWB2oVhU3cYtZF_Lx9iBI6kKn2fNVd_QZ0m0',

  sendsaySheet: '_Sendsay v2',
  demoSheet: '_DEMO v2',
  readmeSheet: 'О системе',
  importBatchSize: 4,

  productOrder: [
    'ГЗ Периодика', 'ГЗ Система', 'ГЗ Школа',
    'ГФ Периодика', 'ГФ Система', 'ГФ Школа'
  ],

  demoSheets: [
    { name: 'Факт ДЕМО пер', family: 'Периодика' },
    { name: 'ФАКТ демо СС', family: 'Система' },
    { name: 'ФАКТ демо Школа', family: 'Школа' }
  ],

  demoPlanSheet: 'Планы на год'
});

const SENDSAY_HEADERS = Object.freeze([
  'File ID', 'Имя файла', 'Формат', 'Изменён на Drive', 'Импортирован',
  'Parser version', 'Статус', 'Ошибка',
  'Campaign ID', 'Дата отправки', 'Время отправки', 'Тип',
  'Продукт', 'Поток', 'Сегмент', 'Campaign', 'Sendsay', 'Тема письма',
  'Отправлено', 'Доставлено', 'Доставляемость',
  'Уник. открытия', 'OR', 'Уник. клики', 'Click rate', 'CTOR',
  'Отписки', 'UTOR',
  'DEMO статус', 'DEMO источник', 'DEMO ключ', 'DEMO R', 'DEMO Y', 'DEMO G',
  'DEMO обновлено'
]);

const DEMO_HEADERS = Object.freeze([
  'Неделя', 'Продукт', 'R', 'Y', 'G', 'План', 'Обновлено', 'Источник'
]);

function doGet() {
  return buildAnalyticsWebApp_();
}

/**
 * Запустить один раз после перехода на v2.
 * Создаёт отдельную служебную таблицу-хранилище и больше не использует
 * старую "DEMO-аналитику" как источник.
 */
function setup() {
  const storage = ensureStorageSpreadsheet_();
  const props = PropertiesService.getScriptProperties();
  const email = Session.getEffectiveUser().getEmail();

  if (email) props.setProperty(APP.adminProperty, email.toLowerCase());
  if (!props.getProperty(APP.demoSourceProperty)) {
    props.setProperty(APP.demoSourceProperty, APP.defaultDemoStatsId);
  }

  ensureSendsaySheet_(storage);
  ensureDemoSheet_(storage);
  clearCache_();

  return {
    ok: true,
    version: APP.version,
    admin: email || 'владелец проекта',
    storageUrl: storage.getUrl(),
    demoSourceUrl: demoStatsSpreadsheet_().getUrl()
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
  clearCache_();
  SpreadsheetApp.flush();
  const data = buildAppData_();
  writeCache_(data);
  return data;
}

/**
 * Обрабатывает очередную порцию новых, изменённых или ранее ошибочных файлов.
 * .webarchive поддерживается наравне с .mhtml/.mht.
 */
function syncDriveReports() {
  assertAdmin_();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const result = importDriveReportsBatch_(openStorage_(), APP.importBatchSize);
    clearCache_();
    return result;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Пересобирает свод DEMO напрямую из исходной "Статистики по ДЕМО"
 * и заново связывает фактические Sendsay-кампании.
 */
function syncDemoStats() {
  assertAdmin_();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const storage = openStorage_();
    const result = buildDemoStats_(demoStatsSpreadsheet_());
    writeDemoSummary_(storage, result);
    const links = linkImportedReportsToDemo_(storage, result.campaigns);
    clearCache_();

    return {
      ok: true,
      currentWeek: result.currentWeek,
      matched: links.matched,
      unmatched: links.unmatched,
      newsSkipped: links.newsSkipped,
      updatedAt: result.updatedAt
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Необязательная ручная загрузка через сайт.
 * Основной рабочий маршрут — положить файлы в подключённую папку Drive.
 */
function uploadSendsayReport(formObject) {
  assertAdmin_();
  const blob = formObject && formObject.reportFile;
  if (!blob || typeof blob.getBytes !== 'function') {
    throw new Error('Не удалось получить файл отчёта.');
  }

  const name = safeFileName_(blob.getName());
  if (!isSupportedReportName_(name)) {
    throw new Error('Поддерживаются .webarchive, .mhtml и .mht.');
  }

  const bytes = blob.getBytes();
  if (!bytes.length) throw new Error('Файл «' + name + '» пустой.');
  if (bytes.length > 35 * 1024 * 1024) {
    throw new Error('Файл «' + name + '» больше 35 МБ. Положите его в папку Drive и нажмите «Обновить данные».');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const folder = reportsFolder_();
    const mime = /\.webarchive$/i.test(name) ? 'application/x-webarchive' : 'multipart/related';
    const file = folder.createFile(Utilities.newBlob(bytes, mime, name));
    const report = importDriveFile_(openStorage_(), file);
    reconcileCanonicalRows_(ensureSendsaySheet_(openStorage_()));
    clearCache_();

    return {
      ok: true,
      duplicate: report.duplicate || false,
      fileName: name,
      subject: report.subject,
      product: report.product,
      date: report.date
    };
  } finally {
    lock.releaseLock();
  }
}

/** Сохраняет папку фактических отчётов Sendsay. */
function saveReportsFolder(folderUrl) {
  assertAdmin_();
  const match = String(folderUrl || '').match(/(?:folders\/|^)([-\w]{20,})(?:[/?#]|$)/i);
  if (!match) throw new Error('Вставьте полную ссылку на папку Google Drive.');

  const folder = DriveApp.getFolderById(match[1]);
  folder.getName();

  PropertiesService.getScriptProperties()
    .setProperty(APP.reportsFolderProperty, folder.getId());

  clearCache_();
  return { ok: true, name: folder.getName() };
}

/** При необходимости позволяет заменить исходную таблицу "Статистика по ДЕМО". */
function saveDemoStatsSource(spreadsheetUrl) {
  assertAdmin_();
  const match = String(spreadsheetUrl || '').match(/(?:spreadsheets\/d\/|^)([-\w]{20,})(?:[/?#]|$)/i);
  if (!match) throw new Error('Вставьте ссылку на Google-таблицу «Статистика по ДЕМО».');

  const spreadsheet = SpreadsheetApp.openById(match[1]);
  APP.demoSheets.forEach(spec => {
    if (!spreadsheet.getSheetByName(spec.name)) {
      throw new Error('В источнике нет листа «' + spec.name + '».');
    }
  });

  PropertiesService.getScriptProperties()
    .setProperty(APP.demoSourceProperty, spreadsheet.getId());

  clearCache_();
  return { ok: true, name: spreadsheet.getName(), url: spreadsheet.getUrl() };
}

/**
 * Полный безопасный сброс только служебного кэша v2.
 * Исходные файлы Sendsay и "Статистика по ДЕМО" не меняются.
 */
function resetV2Cache() {
  assertAdmin_();
  const storage = openStorage_();
  const sendsay = ensureSendsaySheet_(storage);
  const demo = ensureDemoSheet_(storage);

  if (sendsay.getLastRow() > 1) {
    sendsay.getRange(2, 1, sendsay.getLastRow() - 1, sendsay.getLastColumn()).clearContent();
  }
  if (demo.getLastRow() > 1) {
    demo.getRange(2, 1, demo.getLastRow() - 1, demo.getLastColumn()).clearContent();
  }

  clearCache_();
  return { ok: true };
}

function buildAppData_() {
  const storage = openStorage_();
  const demo = readDemoSnapshot_(storage);
  const currentWeek = demo.currentWeek || isoWeek_(todayIso_()) || 36;
  const products = demo.products.length
    ? demo.products
    : APP.productOrder.map(name => emptyProduct_(name));

  const emails = readImportedEmails_(storage);
  const plans = buildDecisionCards_(products, emails, currentWeek);
  const insights = buildInsights_(emails);

  return {
    version: APP.version,
    meta: {
      title: 'Редакционная аналитика DEMO',
      updatedAt: new Date().toISOString(),
      currentWeek: currentWeek,
      viewer: (Session.getActiveUser().getEmail() || '').toLowerCase(),
      canRefresh: canAdmin_(),
      canImport: canAdmin_(),
      sourceUrl: storage.getUrl(),
      demoUpdatedAt: demo.updatedAt || '',
      generatedAt: new Date().toISOString(),
      import: readImportStatus_(storage)
    },
    summary: aggregateProducts_(products),
    products: products,
    weeks: demo.weeks,
    emails: emails,
    plans: plans,
    insights: insights,
    methodology: protocolMethodology_()
  };
}

function ensureStorageSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty(APP.storageProperty);

  if (existingId) {
    try {
      return SpreadsheetApp.openById(existingId);
    } catch (error) {}
  }

  const spreadsheet = SpreadsheetApp.create('Analytics Center — служебные данные v2');
  props.setProperty(APP.storageProperty, spreadsheet.getId());

  const first = spreadsheet.getSheets()[0];
  first.setName(APP.readmeSheet);
  first.getRange('A1:B8').setValues([
    ['Analytics Center v2', 'Служебное хранилище'],
    ['Что это', 'Сайт хранит здесь только свой технический кэш.'],
    ['Источник Sendsay', 'Подключённая папка Google Drive с фактическими отчётами.'],
    ['Источник DEMO', 'Таблица «Статистика по ДЕМО».'],
    ['Важно', 'Старая редакционная DEMO-аналитика не используется как источник.'],
    ['Форматы', '.webarchive, .mhtml, .mht'],
    ['Версия', APP.version],
    ['Обновлено', new Date()]
  ]);
  first.autoResizeColumns(1, 2);

  ensureSendsaySheet_(spreadsheet);
  ensureDemoSheet_(spreadsheet);
  return spreadsheet;
}

function openStorage_() {
  const id = PropertiesService.getScriptProperties().getProperty(APP.storageProperty);
  if (!id) throw new Error('После перехода на v2 один раз запустите setup() в Apps Script.');
  return SpreadsheetApp.openById(id);
}

function demoStatsSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(APP.demoSourceProperty) || APP.defaultDemoStatsId;
  return SpreadsheetApp.openById(id);
}

function reportsFolder_() {
  const id = PropertiesService.getScriptProperties().getProperty(APP.reportsFolderProperty);
  if (!id) throw new Error('Папка с отчётами Sendsay ещё не подключена.');
  return DriveApp.getFolderById(id);
}

function assertAdmin_() {
  const props = PropertiesService.getScriptProperties();
  let admin = (props.getProperty(APP.adminProperty) || '').toLowerCase();
  const active = (Session.getActiveUser().getEmail() || '').toLowerCase();

  if (!admin) {
    const effective = (Session.getEffectiveUser().getEmail() || '').toLowerCase();
    if (effective) {
      props.setProperty(APP.adminProperty, effective);
      admin = effective;
    }
  }

  if (!admin) throw new Error('Не удалось определить владельца. Один раз запустите setup().');
  if (active && active !== admin) {
    throw new Error('Обновлять данные может только ответственный за аналитику.');
  }
}

function canAdmin_() {
  const props = PropertiesService.getScriptProperties();
  const admin = (props.getProperty(APP.adminProperty) || '').toLowerCase();
  const active = (Session.getActiveUser().getEmail() || '').toLowerCase();
  return Boolean(admin && active && admin === active);
}

function ensureSendsaySheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(APP.sendsaySheet);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(APP.sendsaySheet);
    sheet.getRange(1, 1, 1, SENDSAY_HEADERS.length).setValues([SENDSAY_HEADERS]);
    sheet.setFrozenRows(1);
    styleHeader_(sheet, SENDSAY_HEADERS.length);
    try { sheet.hideSheet(); } catch (error) {}
  } else {
    const first = norm_(sheet.getRange(1, 1).getDisplayValue());
    if (first !== 'file id' || sheet.getLastColumn() < SENDSAY_HEADERS.length) {
      sheet.getRange(1, 1, 1, SENDSAY_HEADERS.length).setValues([SENDSAY_HEADERS]);
      styleHeader_(sheet, SENDSAY_HEADERS.length);
    }
  }
  return sheet;
}

function ensureDemoSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(APP.demoSheet);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(APP.demoSheet);
    sheet.getRange(1, 1, 1, DEMO_HEADERS.length).setValues([DEMO_HEADERS]);
    sheet.setFrozenRows(1);
    styleHeader_(sheet, DEMO_HEADERS.length);
    try { sheet.hideSheet(); } catch (error) {}
  } else {
    const first = norm_(sheet.getRange(1, 1).getDisplayValue());
    if (first !== 'неделя' || sheet.getLastColumn() < DEMO_HEADERS.length) {
      sheet.getRange(1, 1, 1, DEMO_HEADERS.length).setValues([DEMO_HEADERS]);
      styleHeader_(sheet, DEMO_HEADERS.length);
    }
  }
  return sheet;
}

function styleHeader_(sheet, width) {
  sheet.getRange(1, 1, 1, width)
    .setBackground('#111b31')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
}

function importDriveReportsBatch_(storage, batchSize) {
  const sheet = ensureSendsaySheet_(storage);
  const index = importIndex_(sheet);
  const iterator = reportsFolder_().getFiles();
  const currentIds = {};
  const candidates = [];
  let eligibleCount = 0;

  while (iterator.hasNext()) {
    const file = iterator.next();
    const name = file.getName();
    if (!isSupportedReportName_(name)) continue;

    eligibleCount++;
    const id = file.getId();
    const modified = file.getLastUpdated().toISOString();
    const previous = index[id];
    currentIds[id] = true;

    const shouldProcess =
      !previous ||
      previous.modified !== modified ||
      previous.parserVersion !== APP.parserVersion ||
      previous.status === 'Удалено';

    if (shouldProcess) {
      candidates.push({
        file: file,
        modified: modified,
        sendDate: dateFromText_(name)
      });
    }
  }

  markRemovedFiles_(sheet, currentIds);

  candidates.sort((a, b) => {
    const bySendDate = String(b.sendDate || '').localeCompare(String(a.sendDate || ''));
    if (bySendDate) return bySendDate;
    return String(b.modified).localeCompare(String(a.modified));
  });

  const batch = candidates.slice(0, Math.max(1, batchSize || APP.importBatchSize));
  let success = 0;
  let errors = 0;
  const items = [];

  batch.forEach(item => {
    try {
      const report = importDriveFile_(storage, item.file);
      success++;
      items.push({
        fileName: item.file.getName(),
        ok: true,
        date: report.date,
        subject: report.subject,
        product: report.product
      });
    } catch (error) {
      errors++;
      writeImportError_(storage, item.file, error);
      items.push({
        fileName: item.file.getName(),
        ok: false,
        error: error.message || String(error)
      });
    }
  });

  reconcileCanonicalRows_(sheet);

  return {
    ok: true,
    processed: batch.length,
    success: success,
    errors: errors,
    remaining: Math.max(0, candidates.length - batch.length),
    found: candidates.length,
    folderFiles: eligibleCount,
    items: items,
    importedTotal: readImportStatus_(storage).total
  };
}

function importDriveFile_(storage, file) {
  const blob = file.getBlob();
  const raw = blob.getDataAsString('UTF-8');
  const report = parseSendsaySnapshot_(raw, file.getName());

  report.fileId = file.getId();
  report.fileName = file.getName();
  report.format = reportFormat_(file.getName());
  report.modified = file.getLastUpdated().toISOString();
  report.importedAt = new Date().toISOString();
  report.parserVersion = APP.parserVersion;

  const missing = [];
  if (!report.campaignId) missing.push('ссылка/ID кампании');
  if (!report.date) missing.push('дата отправки');
  if (!report.subject) report.subject = 'Тема не сохранена в отчёте Sendsay';

  if (missing.length) {
    const error = new Error(
      'Не найдены поля Sendsay: ' + missing.join(', ') +
      '. Файл распознан как ' + report.format + ', но сводка сохранена не полностью.'
    );
    error.report = report;
    throw error;
  }

  upsertImportRow_(storage, report);
  return report;
}

function parseSendsaySnapshot_(raw, fileName) {
  if (!raw || !/reports\/campaigns\/\d+\/summary/i.test(raw)) {
    throw new Error('Файл не похож на сохранённую сводку Sendsay.');
  }

  const text = raw.replace(/=\r?\n/g, '');
  const campaignIdMatch = text.match(/reports\/campaigns\/(\d+)\/summary/i);
  const campaignId = campaignIdMatch ? campaignIdMatch[1] : '';
  const campaign = extractCampaignName_(raw, fileName);

  const sentBlock = snippetForMarker_(text, 'CampaignReportHeader-sent', 1800);
  const sentMatch = sentBlock.match(
    /(\d{1,2}\.\d{1,2}\.\d{4})[\s\S]{0,220}?(\d{1,2}:\d{2})/
  );

  const date = sentMatch
    ? normalizeDate_(sentMatch[1])
    : dateFromText_(campaign + ' ' + fileName);

  const time = sentMatch ? normalizeTime_(sentMatch[2]) : '';

  const subject = extractInputValue_(text, 'StatReportSummaryLetterParams-subject');
  const fromEmail = extractInputValue_(text, 'StatReportSummaryLetterParams-fromEmail');
  const fromName = extractInputValue_(text, 'StatReportSummaryLetterParams-fromName');
  const classification = classifyCampaign_(
    campaign,
    fileName,
    subject,
    fromEmail + ' ' + fromName
  );

  return {
    campaignId: campaignId,
    campaign: campaign,
    sendsay: campaignId
      ? 'https://app.sendsay.ru/reports/campaigns/' + campaignId + '/summary'
      : '',
    date: date,
    time: time,
    type: classification.type,
    product: classification.product,
    flow: classification.flow,
    segment: classification.segment,
    subject: subject,

    sent: metricNumber_(text, 'SummaryStatsWithTooltips-sent'),
    delivered: metricNumber_(text, 'SummaryStatsWithTooltips-delivered'),
    deliveredRate: metricPercent_(text, 'SummaryStatsWithTooltips-deliveredRatio'),
    uniqueOpened: metricNumber_(text, 'SummaryStatsWithTooltips-uniqueOpened'),
    openRate: metricPercent_(text, 'SummaryStatsWithTooltips-uniqueOpenedRatio'),
    uniqueClicked: metricNumber_(text, 'SummaryStatsWithTooltips-uniqueClicked'),
    clickRate: metricPercent_(text, 'SummaryStatsWithTooltips-uniqueClickedRatio'),
    ctor: metricPercent_(text, 'SummaryStatsWithTooltips-CTOR'),
    unsubscribed: metricNumber_(text, 'SummaryStatsWithTooltips-unsubed'),
    utor: metricPercent_(text, 'SummaryStatsWithTooltips-UTOR')
  };
}

function extractCampaignName_(raw, fileName) {
  const baseName = String(fileName || '')
    .replace(/\.(?:mhtml?|webarchive)$/i, '')
    .trim();

  const direct = baseName.match(
    /^\s*\d+\s*\|\s*(?:demo|news)\s*\|\s*(.*?)\s*\|\s*sendsay\s*$/i
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
    ? generic[1].replace(/\s*\|\s*Sendsay\s*$/i, '').trim()
    : baseName;
}

function classifyCampaign_(campaign, fileName, subject, sender) {
  const text = norm_([campaign, fileName, subject, sender].join(' '));
  const rawCampaign = String(campaign || '').toLowerCase();

  const type = /letter_news|\bnews\b|digest/.test(text) ? 'news' : 'demo';
  let product = 'Не указано';
  let flow = 'Не указано';

  if (/goszakaz[_-]?cgz|activdemo[_-]?cgz/.test(text)) {
    product = 'ГЗ Система';
    flow = product;
  } else if (/goszakaz[_-]?(gzru|vio|fas)|activdemo[_-]?(gzru|vio|fas)/.test(text)) {
    product = 'ГЗ Периодика';
    flow = /[_-]vio(?:_|\.|\b)/.test(text)
      ? product + ' · ВИО'
      : /[_-]fas(?:_|\.|\b)/.test(text)
        ? product + ' · ФАС'
        : product + ' · ГЗРУ';
  } else if (
    /letter_demo_goszakaz|goszakaz-school|высшая школа госзакупок|action-goszakaz-school/.test(text)
  ) {
    product = 'ГЗ Школа';
    flow = product;
  } else if (/gosfinansi[_-]?letter[_-]?(?:activdemo[_-]?)?gfss/.test(text)) {
    product = 'ГФ Система';
    flow = product;
  } else if (
    /gosfinansi[_-]?letter[_-]?demo[_-]?school|школа главбуха|action-gosfinansy-school/.test(text)
  ) {
    product = 'ГФ Школа';
    flow = product;
  } else if (
    /gosfinansi[_-]?letteri?[_-]?(?:activdemo[_-]?)?(ubu|zbu)|\bubu\b|\bzbu\b/.test(text)
  ) {
    product = 'ГФ Периодика';
    flow = /[_-]zbu(?:_|\.|\b)/.test(text)
      ? product + ' · ЗБУ'
      : product + ' · УБУ';
  } else if (/letter_news_goszakaz/.test(text)) {
    product = 'ГЗ Периодика';
    flow = product;
  } else if (/letter_news_gf|gosfinansi_letter_news/.test(text)) {
    product = 'ГФ Периодика';
    flow = product;
  }

  let segment = type === 'news' ? 'Новостная рассылка' : 'Живые';

  if (/activdemo/.test(rawCampaign)) {
    segment = 'Дожим демо';
  } else if (/(?:^|_)open(?:_|\.|$)/.test(rawCampaign)) {
    segment = 'Клики';
  } else if (/(?:^|_)d(?:_|\.|$)/.test(rawCampaign)) {
    segment = 'Дожим демо';
  } else if (/(?:^|_)50(?:_|\.|$)/.test(rawCampaign)) {
    segment = 'Прогрев 0–50';
  } else if (/(?:^|_)1(?:_|\.|$)/.test(rawCampaign)) {
    segment = 'Все доступные';
  }

  return {
    type: type,
    product: product,
    flow: flow === 'Не указано' ? product : flow,
    segment: segment
  };
}

function metricNumber_(text, key) {
  return number_(extractMetricText_(text, key));
}

function metricPercent_(text, key) {
  return percent_(extractMetricText_(text, key));
}

function extractMetricText_(text, key) {
  const snippet = snippetForMarker_(text, key, 1800);
  if (!snippet) return '';

  const endCandidates = [
    snippet.indexOf('</h4>'),
    snippet.indexOf('</span>')
  ].filter(index => index >= 0);

  if (!endCandidates.length) return '';
  const end = Math.min.apply(null, endCandidates);
  const tail = snippet.slice(end + 1);

  const match = tail.match(/<span[^>]*>([^<]{0,160})<\/span>/i);
  return match ? decodeSnapshotText_(match[1]) : '';
}

function extractInputValue_(text, key) {
  const snippet = snippetForMarker_(text, key, 6500);
  if (!snippet) return '';

  const match = snippet.match(
    /<input[\s\S]{0,2500}?\svalue(?:=3D|=)"([^"]*)"/i
  );
  return match ? decodeSnapshotText_(match[1]) : '';
}

function snippetForMarker_(text, key, length) {
  const markers = [
    'data-sentry="' + key + '"',
    'data-sentry=3D"' + key + '"'
  ];

  let index = -1;
  markers.forEach(marker => {
    const found = text.indexOf(marker);
    if (found >= 0 && (index < 0 || found < index)) index = found;
  });

  return index < 0 ? '' : text.slice(index, index + length);
}

function decodeSnapshotText_(value) {
  const source = String(value || '');
  if (/=[0-9A-F]{2}/i.test(source)) return decodeQpText_(source);
  return htmlText_(source);
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
      if (code <= 127) {
        bytes.push(code);
      } else {
        const local = Utilities.newBlob(source[i]).getBytes();
        local.forEach(byte => bytes.push(byte < 0 ? byte + 256 : byte));
      }
    }
  }

  const signed = bytes.map(byte => byte > 127 ? byte - 256 : byte);
  return htmlText_(Utilities.newBlob(signed).getDataAsString('UTF-8'));
}

function htmlText_(value) {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#8239;|&#x202f;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSupportedReportName_(name) {
  return /\.(?:mhtml?|webarchive)$/i.test(String(name || ''));
}

function reportFormat_(name) {
  return /\.webarchive$/i.test(name) ? 'webarchive' : 'mhtml';
}

function safeFileName_(value) {
  const name = String(value || 'report.webarchive')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .trim();
  return name.slice(0, 220) || 'report.webarchive';
}

function importIndex_(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return {};

  const headers = headerMap_(values[0]);
  const col = aliases => indexOfHeader_(headers, aliases);
  const idx = {
    fileId: col(['file id']),
    modified: col(['изменен на drive', 'изменён на drive']),
    parser: col(['parser version']),
    status: col(['статус'])
  };

  const index = {};
  for (let i = 1; i < values.length; i++) {
    const id = String(valueAt_(values[i], idx.fileId) || '').trim();
    if (!id) continue;

    index[id] = {
      row: i + 1,
      modified: String(valueAt_(values[i], idx.modified) || ''),
      parserVersion: String(valueAt_(values[i], idx.parser) || ''),
      status: String(valueAt_(values[i], idx.status) || '')
    };
  }
  return index;
}

function upsertImportRow_(storage, report) {
  const sheet = ensureSendsaySheet_(storage);
  const index = importIndex_(sheet);

  const row = [
    report.fileId, report.fileName, report.format, report.modified, report.importedAt,
    report.parserVersion, 'Готово', '',
    report.campaignId, report.date, report.time, report.type,
    report.product, report.flow, report.segment, report.campaign,
    report.sendsay, report.subject,
    report.sent, report.delivered, report.deliveredRate,
    report.uniqueOpened, report.openRate, report.uniqueClicked, report.clickRate, report.ctor,
    report.unsubscribed, report.utor,
    '', '', '', '', '', '', ''
  ];

  const rowNumber = index[report.fileId]
    ? index[report.fileId].row
    : sheet.getLastRow() + 1;

  sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
}

function writeImportError_(storage, file, error) {
  const partial = error && error.report ? error.report : {};
  const report = Object.assign({
    campaignId: '', date: '', time: '', type: '', product: '', flow: '', segment: '',
    campaign: '', sendsay: '', subject: '', sent: '', delivered: '', deliveredRate: '',
    uniqueOpened: '', openRate: '', uniqueClicked: '', clickRate: '', ctor: '',
    unsubscribed: '', utor: ''
  }, partial, {
    fileId: file.getId(),
    fileName: file.getName(),
    format: reportFormat_(file.getName()),
    modified: file.getLastUpdated().toISOString(),
    importedAt: new Date().toISOString(),
    parserVersion: APP.parserVersion
  });

  const sheet = ensureSendsaySheet_(storage);
  const index = importIndex_(sheet);

  const row = [
    report.fileId, report.fileName, report.format, report.modified, report.importedAt,
    report.parserVersion, 'Ошибка',
    String(error && error.message ? error.message : error).slice(0, 800),
    report.campaignId, report.date, report.time, report.type,
    report.product, report.flow, report.segment, report.campaign,
    report.sendsay, report.subject,
    report.sent, report.delivered, report.deliveredRate,
    report.uniqueOpened, report.openRate, report.uniqueClicked, report.clickRate, report.ctor,
    report.unsubscribed, report.utor,
    '', '', '', '', '', '', ''
  ];

  const rowNumber = index[report.fileId]
    ? index[report.fileId].row
    : sheet.getLastRow() + 1;

  sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
}

function markRemovedFiles_(sheet, currentIds) {
  if (sheet.getLastRow() < 2) return;

  const values = sheet.getDataRange().getDisplayValues();
  const headers = headerMap_(values[0]);
  const fileIdCol = indexOfHeader_(headers, ['file id']);
  const statusCol = indexOfHeader_(headers, ['статус']);
  if (fileIdCol < 0 || statusCol < 0) return;

  const output = [];
  let changed = false;

  for (let i = 1; i < values.length; i++) {
    const id = String(valueAt_(values[i], fileIdCol) || '').trim();
    let status = String(valueAt_(values[i], statusCol) || '');

    if (id && !currentIds[id] && status !== 'Удалено') {
      status = 'Удалено';
      changed = true;
    }

    output.push([status]);
  }

  if (changed) {
    sheet.getRange(2, statusCol + 1, output.length, 1).setValues(output);
  }
}

function reconcileCanonicalRows_(sheet) {
  if (sheet.getLastRow() < 2) return;

  const values = sheet.getDataRange().getDisplayValues();
  const headers = headerMap_(values[0]);
  const col = aliases => indexOfHeader_(headers, aliases);

  const idx = {
    fileId: col(['file id']),
    modified: col(['изменен на drive', 'изменён на drive']),
    imported: col(['импортирован']),
    status: col(['статус']),
    campaignId: col(['campaign id'])
  };

  const groups = {};
  const statuses = [];

  for (let i = 1; i < values.length; i++) {
    let status = String(valueAt_(values[i], idx.status) || '');
    statuses.push([status]);

    if (status !== 'Готово' && status !== 'Дубль') continue;

    const campaignId = String(valueAt_(values[i], idx.campaignId) || '').trim();
    if (!campaignId) continue;

    if (!groups[campaignId]) groups[campaignId] = [];
    groups[campaignId].push({
      arrayIndex: i - 1,
      modified: String(valueAt_(values[i], idx.modified) || ''),
      imported: String(valueAt_(values[i], idx.imported) || ''),
      fileId: String(valueAt_(values[i], idx.fileId) || '')
    });
  }

  Object.keys(groups).forEach(campaignId => {
    const rows = groups[campaignId].sort((a, b) => {
      const byModified = b.modified.localeCompare(a.modified);
      return byModified || b.imported.localeCompare(a.imported);
    });

    rows.forEach((item, position) => {
      statuses[item.arrayIndex][0] = position === 0 ? 'Готово' : 'Дубль';
    });
  });

  sheet.getRange(2, idx.status + 1, statuses.length, 1).setValues(statuses);
}

function readImportStatus_(storage) {
  const folderConfigured = Boolean(
    PropertiesService.getScriptProperties().getProperty(APP.reportsFolderProperty)
  );

  const sheet = storage.getSheetByName(APP.sendsaySheet);
  if (!sheet || sheet.getLastRow() < 2) {
    return {
      total: 0, errors: 0, duplicates: 0, removed: 0,
      demoMatched: 0, demoUnmatched: 0, demoNewsSkipped: 0,
      failed: [], lastImportedAt: '', latestSendDate: '',
      folderConfigured: folderConfigured
    };
  }

  const values = sheet.getDataRange().getDisplayValues();
  const headers = headerMap_(values[0]);
  const col = aliases => indexOfHeader_(headers, aliases);

  const idx = {
    fileId: col(['file id']),
    fileName: col(['имя файла']),
    imported: col(['импортирован']),
    status: col(['статус']),
    error: col(['ошибка']),
    sendsay: col(['sendsay']),
    date: col(['дата отправки']),
    demoStatus: col(['demo статус']),
    demoUpdated: col(['demo обновлено'])
  };

  let ready = 0;
  let errors = 0;
  let duplicates = 0;
  let removed = 0;
  let demoMatched = 0;
  let demoUnmatched = 0;
  let demoNewsSkipped = 0;
  let lastImportedAt = '';
  let latestSendDate = '';
  let demoUpdatedAt = '';
  const failed = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!valueAt_(row, idx.fileId)) continue;

    const status = String(valueAt_(row, idx.status) || '');
    if (status === 'Готово') ready++;
    if (status === 'Ошибка') errors++;
    if (status === 'Дубль') duplicates++;
    if (status === 'Удалено') removed++;

    if (status === 'Готово') {
      const demoStatus = String(valueAt_(row, idx.demoStatus) || '');
      if (demoStatus === 'Связано точно') {
        demoMatched++;
      } else if (demoStatus.indexOf('Новостное:') === 0) {
        demoNewsSkipped++;
      } else if (demoStatus) {
        demoUnmatched++;
      }

      const sentDate = normalizeDate_(valueAt_(row, idx.date));
      if (sentDate > latestSendDate) latestSendDate = sentDate;
    }

    if (status === 'Ошибка') {
      failed.push({
        fileId: valueAt_(row, idx.fileId),
        fileName: valueAt_(row, idx.fileName) || 'Файл без названия',
        message: valueAt_(row, idx.error) || 'Отчёт не удалось распознать.',
        importedAt: valueAt_(row, idx.imported) || '',
        driveUrl: 'https://drive.google.com/file/d/' +
          encodeURIComponent(valueAt_(row, idx.fileId)) + '/view',
        sendsayUrl: /^https:\/\//i.test(valueAt_(row, idx.sendsay) || '')
          ? valueAt_(row, idx.sendsay)
          : ''
      });
    }

    const importedAt = String(valueAt_(row, idx.imported) || '');
    const demoStamp = String(valueAt_(row, idx.demoUpdated) || '');
    if (importedAt > lastImportedAt) lastImportedAt = importedAt;
    if (demoStamp > demoUpdatedAt) demoUpdatedAt = demoStamp;
  }

  failed.sort((a, b) => String(b.importedAt).localeCompare(String(a.importedAt)));

  return {
    total: ready,
    errors: errors,
    duplicates: duplicates,
    removed: removed,
    demoMatched: demoMatched,
    demoUnmatched: demoUnmatched,
    demoNewsSkipped: demoNewsSkipped,
    demoUpdatedAt: demoUpdatedAt,
    failed: failed.slice(0, 50),
    lastImportedAt: lastImportedAt,
    latestSendDate: latestSendDate,
    folderConfigured: folderConfigured
  };
}

function buildDemoStats_(demoSpreadsheet) {
  const campaigns = {};
  const totals = {};
  const observedWeeks = {};
  const updatedAt = new Date().toISOString();

  APP.demoSheets.forEach(spec => {
    const sheet = demoSpreadsheet.getSheetByName(spec.name);
    if (!sheet) throw new Error('В «Статистике по ДЕМО» нет листа «' + spec.name + '».');

    const rows = sheet.getDataRange().getDisplayValues();
    const headerIndex = rows.findIndex(row => {
      const first = norm_(row[0]);
      const second = norm_(row[1]);
      return first === 'издательская группа' && second.indexOf('utm ') === 0;
    });

    if (headerIndex < 1) {
      throw new Error('На листе «' + spec.name + '» не найдена таблица UTM.');
    }

    const weekRow = rows[headerIndex - 1] || [];
    const headers = rows[headerIndex] || [];
    const metricColumns = [];

    for (let column = 2; column < headers.length; column++) {
      const weekMatch = String(weekRow[column] || '').match(/\d{1,2}/);
      const metric = demoMetric_(headers[column]);
      if (!weekMatch || !metric) continue;

      const week = Number(weekMatch[0]);
      observedWeeks[week] = true;
      metricColumns.push({ column: column, week: week, metric: metric });
    }

    for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const group = demoGroup_(row[0]);
      const sourceKey = String(row[1] || '').trim();

      if (!group || !sourceKey || /итог/i.test(sourceKey)) continue;

      const product = group + ' ' + spec.family;

      metricColumns.forEach(info => {
        const amount = number_(row[info.column]);
        if (!amount) return;

        const totalKey = product + '|' + info.week;
        if (!totals[totalKey]) totals[totalKey] = emptyDemoTotal_(product, info.week);
        totals[totalKey][info.metric] += amount;

        const campaignKey = demoCampaignLookupKey_(product, info.week, sourceKey);
        if (!campaigns[campaignKey]) {
          campaigns[campaignKey] = {
            product: product,
            week: info.week,
            campaign: sourceKey,
            source: spec.name,
            red: 0,
            yellow: 0,
            green: 0
          };
        }
        campaigns[campaignKey][info.metric] += amount;
      });
    }
  });

  const weeks = Object.keys(observedWeeks)
    .map(Number)
    .filter(Boolean)
    .sort((a, b) => a - b);

  const plans = readDemoPlans_(demoSpreadsheet, observedWeeks);

  APP.productOrder.forEach(product => {
    weeks.forEach(week => {
      const key = product + '|' + week;
      if (!totals[key]) totals[key] = emptyDemoTotal_(product, week);
      totals[key].plan = number_(plans[key]);
    });
  });

  return {
    campaigns: campaigns,
    totals: totals,
    currentWeek: weeks.length ? weeks[weeks.length - 1] : null,
    updatedAt: updatedAt,
    sourceUrl: demoSpreadsheet.getUrl()
  };
}

function readDemoPlans_(demoSpreadsheet, observedWeeks) {
  const sheet = demoSpreadsheet.getSheetByName(APP.demoPlanSheet);
  if (!sheet) return {};

  const rows = sheet.getDataRange().getDisplayValues();
  const plans = {};
  let family = '';
  let weekColumns = {};

  for (let i = 0; i < rows.length; i++) {
    const first = norm_(rows[i][0]);

    if (first === 'школа') {
      family = 'Школа';
      weekColumns = {};
      continue;
    }
    if (first === 'система') {
      family = 'Система';
      weekColumns = {};
      continue;
    }
    if (first === 'периодика') {
      family = 'Периодика';
      weekColumns = {};
      continue;
    }
    if (!family) continue;

    const maybeWeeks = {};
    for (let c = 1; c < rows[i].length; c++) {
      const week = Number(rows[i][c]);
      if (observedWeeks[week]) maybeWeeks[c] = week;
    }

    if (Object.keys(maybeWeeks).length >= 3) {
      weekColumns = maybeWeeks;
      continue;
    }

    const group = demoGroup_(rows[i][0]);
    if (!group || !Object.keys(weekColumns).length) continue;

    const planRow = rows[i + 1] || [];
    if (norm_(planRow[0]) !== 'план') continue;

    Object.keys(weekColumns).forEach(column => {
      const week = weekColumns[column];
      plans[group + ' ' + family + '|' + week] =
        number_(planRow[Number(column)]);
    });
  }

  return plans;
}

function writeDemoSummary_(storage, result) {
  const sheet = ensureDemoSheet_(storage);

  const rows = Object.keys(result.totals)
    .map(key => result.totals[key])
    .sort((a, b) =>
      a.week - b.week ||
      APP.productOrder.indexOf(a.product) - APP.productOrder.indexOf(b.product)
    )
    .map(item => [
      item.week, item.product, item.red, item.yellow, item.green, item.plan,
      result.updatedAt, result.sourceUrl
    ]);

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, DEMO_HEADERS.length).setValues(rows);
  }
}

function readDemoSnapshot_(storage) {
  const sheet = storage.getSheetByName(APP.demoSheet);
  if (!sheet || sheet.getLastRow() < 2) {
    return { products: [], weeks: [], currentWeek: null, updatedAt: '' };
  }

  const rows = sheet.getDataRange().getDisplayValues();
  const headers = headerMap_(rows[0]);
  const col = aliases => indexOfHeader_(headers, aliases);

  const idx = {
    week: col(['неделя']),
    product: col(['продукт']),
    red: col(['r']),
    yellow: col(['y']),
    green: col(['g']),
    plan: col(['план']),
    updated: col(['обновлено'])
  };

  const byWeek = {};
  let currentWeek = null;
  let updatedAt = '';

  for (let i = 1; i < rows.length; i++) {
    const week = number_(valueAt_(rows[i], idx.week));
    const product = normalizeProduct_(valueAt_(rows[i], idx.product));
    if (!week || !product) continue;

    if (!byWeek[week]) byWeek[week] = {};

    const red = number_(valueAt_(rows[i], idx.red));
    const yellow = number_(valueAt_(rows[i], idx.yellow));
    const green = number_(valueAt_(rows[i], idx.green));
    const plan = number_(valueAt_(rows[i], idx.plan));

    byWeek[week][product] = {
      product: product,
      red: red,
      yellow: yellow,
      green: green,
      plan: plan,
      progress: plan ? round_(green / plan * 100, 1) : 0,
      decision: protocolDecision_(product, red, yellow, green, plan)
    };

    currentWeek = currentWeek === null ? week : Math.max(currentWeek, week);

    const stamp = String(valueAt_(rows[i], idx.updated) || '');
    if (stamp > updatedAt) updatedAt = stamp;
  }

  if (currentWeek === null) {
    return { products: [], weeks: [], currentWeek: null, updatedAt: updatedAt };
  }

  const products = APP.productOrder.map(product =>
    byWeek[currentWeek][product] || emptyProduct_(product)
  );

  const weeks = Object.keys(byWeek)
    .map(Number)
    .sort((a, b) => a - b)
    .map(week => {
      const items = APP.productOrder.map(product =>
        byWeek[week][product] || emptyProduct_(product)
      );
      const aggregate = aggregateProducts_(items);
      aggregate.week = week;
      return aggregate;
    });

  return {
    products: products,
    weeks: weeks,
    currentWeek: currentWeek,
    updatedAt: updatedAt
  };
}

function linkImportedReportsToDemo_(storage, campaigns) {
  const sheet = ensureSendsaySheet_(storage);
  if (sheet.getLastRow() < 2) {
    return { matched: 0, unmatched: 0, newsSkipped: 0 };
  }

  const values = sheet.getDataRange().getDisplayValues();
  const headers = headerMap_(values[0]);
  const col = aliases => indexOfHeader_(headers, aliases);

  const idx = {
    status: col(['статус']),
    date: col(['дата отправки']),
    type: col(['тип']),
    product: col(['продукт']),
    campaign: col(['campaign']),
    demoStatus: col(['demo статус']),
    demoSource: col(['demo источник']),
    demoKey: col(['demo ключ']),
    red: col(['demo r']),
    yellow: col(['demo y']),
    green: col(['demo g']),
    demoUpdated: col(['demo обновлено'])
  };

  let matched = 0;
  let unmatched = 0;
  let newsSkipped = 0;
  const updatedAt = new Date().toISOString();

  const output = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const status = String(valueAt_(row, idx.status) || '');

    if (status !== 'Готово') {
      output.push(['', '', '', '', '', '', '']);
      continue;
    }

    const product = normalizeProduct_(valueAt_(row, idx.product));
    const campaign = String(valueAt_(row, idx.campaign) || '').trim();
    const type = norm_(valueAt_(row, idx.type));
    const date = normalizeDate_(valueAt_(row, idx.date));
    const week = isoWeek_(date);

    const lookupKey = product && week && campaign
      ? demoCampaignLookupKey_(product, week, campaign)
      : '';

    if (type === 'news') {
      newsSkipped++;
      output.push([
        'Новостное: без точной UTM-привязки',
        'Новостные слои не суммируются с direct',
        lookupKey, '', '', '', updatedAt
      ]);
      continue;
    }

    const match = lookupKey ? campaigns[lookupKey] : null;
    if (match) {
      matched++;
      output.push([
        'Связано точно',
        match.source,
        lookupKey,
        match.red,
        match.yellow,
        match.green,
        updatedAt
      ]);
    } else {
      unmatched++;
      output.push([
        product ? 'Не найдено точное Campaign' : 'Не определён продукт',
        '',
        lookupKey,
        '', '', '',
        updatedAt
      ]);
    }
  }

  const startCol = idx.demoStatus + 1;
  sheet.getRange(2, startCol, output.length, 7).setValues(output);

  return {
    matched: matched,
    unmatched: unmatched,
    newsSkipped: newsSkipped
  };
}

function demoMetric_(value) {
  const text = norm_(value);
  if (text.indexOf('красн') >= 0) return 'red';
  if (text.indexOf('желт') >= 0) return 'yellow';
  if (text.indexOf('зелен') >= 0) return 'green';
  return '';
}

function demoGroup_(value) {
  const text = norm_(value);
  if (text.indexOf('госзаказ') >= 0) return 'ГЗ';
  if (text.indexOf('госфинанс') >= 0) return 'ГФ';
  return '';
}

function demoCampaignKey_(value) {
  return norm_(value)
    .replace(/[^a-zа-я0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .replace(/^letter_demo_20\d{2}_\d{2}_\d{2}_/, '');
}

function demoCampaignLookupKey_(product, week, campaign) {
  return product + '|' + week + '|' + demoCampaignKey_(campaign);
}

function readImportedEmails_(storage) {
  const sheet = storage.getSheetByName(APP.sendsaySheet);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const rows = sheet.getDataRange().getDisplayValues();
  const headers = headerMap_(rows[0]);
  const col = aliases => indexOfHeader_(headers, aliases);

  const idx = {
    fileId: col(['file id']),
    modified: col(['изменен на drive', 'изменён на drive']),
    status: col(['статус']),
    campaignId: col(['campaign id']),
    date: col(['дата отправки']),
    time: col(['время отправки']),
    type: col(['тип']),
    product: col(['продукт']),
    flow: col(['поток']),
    segment: col(['сегмент']),
    campaign: col(['campaign']),
    sendsay: col(['sendsay']),
    subject: col(['тема письма']),
    delivered: col(['доставлено']),
    openRate: col(['or']),
    clicks: col(['уник. клики']),
    clickRate: col(['click rate']),
    ctor: col(['ctor']),
    demoStatus: col(['demo статус']),
    demoSource: col(['demo источник']),
    red: col(['demo r']),
    yellow: col(['demo y']),
    green: col(['demo g'])
  };

  const output = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (String(valueAt_(row, idx.status) || '') !== 'Готово') continue;

    const date = normalizeDate_(valueAt_(row, idx.date));
    const subject = String(valueAt_(row, idx.subject) || '').trim();
    if (!date || !subject) continue;

    const product = normalizeProduct_(valueAt_(row, idx.product)) || 'Не указано';
    const demoStatus = String(valueAt_(row, idx.demoStatus) || '').trim();
    const hasDemoData = demoStatus === 'Связано точно';

    const red = hasDemoData ? number_(valueAt_(row, idx.red)) : 0;
    const yellow = hasDemoData ? number_(valueAt_(row, idx.yellow)) : 0;
    const green = hasDemoData ? number_(valueAt_(row, idx.green)) : 0;

    output.push({
      id: 'import-' + String(valueAt_(row, idx.fileId) || i),
      importedOnly: true,
      hasDemoData: hasDemoData,

      date: date,
      time: String(valueAt_(row, idx.time) || '').trim(),
      week: isoWeek_(date),
      type: String(valueAt_(row, idx.type) || 'demo').trim(),
      product: product,
      productFlow: String(valueAt_(row, idx.flow) || product).trim(),
      segment: String(valueAt_(row, idx.segment) || '').trim(),
      campaignId: String(valueAt_(row, idx.campaignId) || '').trim(),
      campaign: String(valueAt_(row, idx.campaign) || '').trim(),
      sendsay: url_(valueAt_(row, idx.sendsay)),
      subject: subject,

      material: '',
      delivered: number_(valueAt_(row, idx.delivered)),
      openRate: percent_(valueAt_(row, idx.openRate)),
      clicks: number_(valueAt_(row, idx.clicks)),
      clickRate: percent_(valueAt_(row, idx.clickRate)),
      ctor: percent_(valueAt_(row, idx.ctor)),

      red: red,
      yellow: yellow,
      green: green,
      potential: yellow + green,

      maturity: hasDemoData
        ? demoMaturity_(date, product)
        : demoStatus || 'Sendsay загружен · DEMO ещё не сопоставлено',

      score: hasDemoData
        ? scoreEmail_(red, yellow, green, percent_(valueAt_(row, idx.openRate)), percent_(valueAt_(row, idx.ctor)))
        : 'Только верхняя воронка Sendsay',

      worked: hasDemoData
        ? workedLabel_(red, yellow, green)
        : '',

      failed: hasDemoData
        ? failedLabel_(red, yellow, green)
        : '',

      source: 'Фактический Sendsay',
      demoMatchStatus: demoStatus,
      demoSource: String(valueAt_(row, idx.demoSource) || '').trim(),

      weeklyPlan: 0,
      weeklyFact: 0,
      weeklyProgress: 0,

      note: hasDemoData
        ? 'R / Y / G связаны только по точному совпадению Campaign.'
        : (
          norm_(valueAt_(row, idx.type)) === 'news'
            ? 'Новостному письму не назначаем R / Y / G без точной UTM Content/Term-привязки.'
            : 'Отправка подтверждена, результат конкретной рассылки пока не сопоставлен.'
        ),

      body: '',
      innerTitle: '',
      cta: '',
      targetUrl: '',
      rationale: '',
      exclusions: '',
      planStatus: ''
    });
  }

  return output.sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate) return byDate;
    const byTime = String(b.time || '').localeCompare(String(a.time || ''));
    if (byTime) return byTime;
    return b.green - a.green;
  });
}

function buildDecisionCards_(products, emails, currentWeek) {
  const cards = [];

  products.forEach(product => {
    const current = emails.filter(email =>
      email.week === currentWeek &&
      email.product === product.product &&
      email.type !== 'news'
    );

    const best = current
      .filter(email => email.hasDemoData && email.green > 0)
      .sort((a, b) =>
        b.green - a.green ||
        greenShare_(b) - greenShare_(a) ||
        b.clicks - a.clicks
      )[0] || null;

    const decision = protocolDecision_(
      product.product,
      product.red,
      product.yellow,
      product.green,
      product.plan
    );

    cards.push({
      id: 'decision-' + slug_(product.product),
      date: todayIso_(),
      week: currentWeek,
      sourceSheet: 'Решение аналитики',
      product: product.product,
      productFlow: product.product,
      segment: decisionSegment_(product),
      subject: decision,
      innerTitle: best ? 'Лучший подтверждённый сигнал недели' : 'Нужен свежий подтверждённый материал',
      body: best
        ? 'Сильный сигнал: «' + best.subject + '» — ' +
          best.green + ' green, ' + best.yellow + ' yellow, ' + best.red + ' red. ' +
          'Exact-письмо не повторяем: переносим механику на новый материал.'
        : 'В текущем массиве нет точно связанного письма с green. ' +
          'Не придумываем победителя: используем базовую сетку и ждём/дособираем точную атрибуцию.',
      cta: '',
      targetUrl: '',
      material: '',
      status: product.progress >= 100 ? 'Дополнительный дожим не нужен' : 'Текущее решение',
      rationale:
        'Green ' + product.green + ' из плана ' + product.plan +
        '; yellow ' + product.yellow + '; red ' + product.red + '.',
      exclusions: 'Green исключить. Exact-материал за последние 7 дней не повторять.',
      nextStep: best
        ? 'Искать новый материал той же рабочей механики.'
        : 'Сначала получить точный DEMO-факт по свежим Campaign.'
    });
  });

  return cards;
}

function buildInsights_(emails) {
  const candidates = emails
    .filter(email =>
      email.hasDemoData &&
      email.type !== 'news' &&
      email.green > 0
    )
    .sort((a, b) =>
      b.green - a.green ||
      greenShare_(b) - greenShare_(a) ||
      b.clicks - a.clicks
    )
    .slice(0, 30);

  const topics = candidates.map(email => ({
    'Направление': email.product,
    'Инфоповод': email.subject,
    'Что сработало в теме': insightType_(email),
    'Подтверждение':
      email.green + ' G / ' + email.yellow + ' Y / ' + email.red + ' R' +
      (email.openRate ? ' · OR ' + round_(email.openRate, 1) + '%' : '') +
      (email.ctor ? ' · CTOR ' + round_(email.ctor, 1) + '%' : ''),
    'Как повторять': 'Повторять механику на новом материале; exact не повторять 7 дней.',
    'Ограничение': greenShare_(email) < 15
      ? 'Green есть, но качество потока пока низкое — чинить путь после входа.'
      : 'Подтверждено direct green.'
  }));

  return { topics: topics, materials: [] };
}

function insightType_(email) {
  const share = greenShare_(email);
  const total = email.red + email.yellow + email.green;

  if (email.green >= 3 && share >= 25) return '🔥 Full-funnel winner';
  if (email.green > 0 && email.openRate > 0 && email.openRate < 5) return '🌱 Конверсионный материал при слабом верхе';
  if (total >= 8 && share < 15) return '🧲 Цепляет, но не дожимает';
  return '✅ Direct green подтверждён';
}

function scoreEmail_(red, yellow, green, openRate, ctor) {
  const total = red + yellow + green;
  const share = total ? green / total * 100 : 0;

  if (green >= 3 && share >= 25) return '🔥 Full-funnel winner';
  if (green > 0 && openRate > 0 && openRate < 5) return '🌱 Конверсионный самородок';
  if (total >= 8 && share < 15) return '🧲 Цепляет, не дожимает';
  if (green > 0) return 'Есть подтверждённый green';
  if (openRate >= 10 || ctor >= 10) return 'Сильный верх, green не подтверждён';
  return 'Green не подтверждён';
}

function workedLabel_(red, yellow, green) {
  if (green >= 3) return 'Тема доводит до качественного результата.';
  if (green > 0) return 'Есть подтверждённый green-сигнал.';
  if (red + yellow >= 8) return 'Тема создаёт заметный вход в воронку.';
  return '';
}

function failedLabel_(red, yellow, green) {
  const total = red + yellow + green;
  if (!total) return 'Нет прямого DEMO-сигнала.';
  if (!green && total >= 5) return 'Интерес есть, но green не получен.';
  if (green && green / total < 0.15) return 'Много входов теряются до green.';
  return '';
}

function greenShare_(email) {
  const total = number_(email.red) + number_(email.yellow) + number_(email.green);
  return total ? number_(email.green) / total * 100 : 0;
}

function protocolDecision_(product, red, yellow, green, plan) {
  if (!plan) return 'План недели не найден — сначала проверить источник плана.';

  const progress = green / plan * 100;
  const potential = green + yellow;

  if (progress >= 100) {
    return 'Дополнительный дожим не нужен: план выполнен.';
  }

  if (/школа/i.test(product)) {
    if (potential >= plan) {
      return 'Школа дозревает: дожимаем желтых, новый приток пока не добавляем.';
    }
    return 'Школа дозревает: желтых дожимаем, новый приток — только если разрыв сохранится.';
  }

  if (potential >= plan) {
    return 'Дожимаем желтых: их достаточно, чтобы закрыть текущий разрыв.';
  }

  if (yellow > 0) {
    return 'Дожимаем желтых; если резерва не хватит, нужен дополнительный новый приток.';
  }

  if (red > 0) {
    return 'Нужен дополнительный новый приток; активных красных подключать только точечно.';
  }

  return 'Нужен новый приток: подтвержденного резерва yellow сейчас нет.';
}

function decisionSegment_(product) {
  if (product.progress >= 100) return 'Не отправлять extra';
  if (product.yellow > 0) return 'Дожим демо';
  return 'Живые';
}

function protocolMethodology_() {
  return [
    'Источник факта отправки — только Sendsay. Плановая тема не считается фактом.',
    'Источник R / Y / G по продукту — только исходная «Статистика по ДЕМО».',
    'Конкретному письму R / Y / G назначаются только при точном совпадении Campaign / UTM.',
    'KPI = только green. Yellow — потенциал для дожима. Red — диагностика, но не выполненный результат.',
    'Периодика и Системы дозревают в окне 3 дней; Школы — 6 дней.',
    'Green всегда исключаем из дожима. Сначала yellow, затем при необходимости активные red.',
    'Exact-материал и очень близкий сюжет не повторяем в пределах 7 дней.',
    'OR / click / CTOR показывают верх воронки и не заменяют оценку по green.'
  ];
}

function emptyProduct_(product) {
  return {
    product: product,
    red: 0,
    yellow: 0,
    green: 0,
    plan: 0,
    progress: 0,
    decision: 'Нет свежего DEMO-среза.'
  };
}

function emptyDemoTotal_(product, week) {
  return {
    product: product,
    week: week,
    red: 0,
    yellow: 0,
    green: 0,
    plan: 0
  };
}

function aggregateProducts_(products) {
  const summary = products.reduce((sum, row) => {
    sum.red += number_(row.red);
    sum.yellow += number_(row.yellow);
    sum.green += number_(row.green);
    sum.plan += number_(row.plan);
    return sum;
  }, { red: 0, yellow: 0, green: 0, plan: 0 });

  summary.progress = summary.plan
    ? round_(summary.green / summary.plan * 100, 1)
    : 0;

  summary.potential = summary.green + summary.yellow;
  summary.totalEvents = summary.red + summary.yellow + summary.green;
  summary.greenShare = summary.totalEvents
    ? round_(summary.green / summary.totalEvents * 100, 1)
    : 0;

  return summary;
}

function demoMaturity_(date, product) {
  const sent = new Date(date + 'T12:00:00Z');
  if (isNaN(sent)) return '';

  const now = new Date();
  const age = Math.max(
    0,
    Math.floor((now.getTime() - sent.getTime()) / 86400000)
  );

  const threshold = /школа/i.test(product) ? 6 : 3;
  return age >= threshold
    ? 'Зрелый срез · D+' + age
    : 'Данные дозревают · D+' + age + ' из D+' + threshold;
}

function headerMap_(row) {
  return row.map(value => ({
    raw: String(value || '').trim(),
    normalized: norm_(value)
  }));
}

function indexOfHeader_(columns, aliases) {
  const normalized = aliases.map(norm_);
  return columns.findIndex(column =>
    normalized.includes(column.normalized)
  );
}

function valueAt_(row, index) {
  return index >= 0 && index < row.length ? row[index] : '';
}

function normalizeProduct_(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return APP.productOrder.find(product => text.startsWith(product)) || null;
}

function norm_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

function number_(value) {
  if (typeof value === 'number') return isFinite(value) ? value : 0;

  const cleaned = String(value || '')
    .replace(/≈/g, '')
    .replace(/[\s\u202f\u00a0]/g, '')
    .replace(/%/g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');

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
  if (value instanceof Date && !isNaN(value)) {
    return Utilities.formatDate(value, APP_TIME_ZONE_(), 'yyyy-MM-dd');
  }

  const text = String(value || '').trim();

  let match = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if (match) {
    return match[3] + '-' + pad_(match[2]) + '-' + pad_(match[1]);
  }

  match = text.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  if (match) {
    return match[1] + '-' + pad_(match[2]) + '-' + pad_(match[3]);
  }

  return '';
}

function dateFromText_(value) {
  const text = String(value || '');

  const full = text.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if (full) {
    return full[3] + '-' + pad_(full[2]) + '-' + pad_(full[1]);
  }

  const short = text.match(/(\d{1,2})[.\/-](\d{1,2})(?![.\/-]\d)/);
  if (short) {
    return String(new Date().getFullYear()) + '-' + pad_(short[2]) + '-' + pad_(short[1]);
  }

  return '';
}

function normalizeTime_(value) {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
  return match ? pad_(match[1]) + ':' + match[2] : '';
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

function todayIso_() {
  return Utilities.formatDate(new Date(), APP_TIME_ZONE_(), 'yyyy-MM-dd');
}

function url_(value) {
  const match = String(value || '').match(/https?:\/\/[^\s·|]+/i);
  return match ? match[0].replace(/[),.;]+$/, '') : '';
}

function slug_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
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
  for (let i = 0; i < count; i++) {
    keys.push(APP.cachePrefix + ':' + i);
  }

  const chunks = cache.getAll(keys);
  if (keys.some(key => typeof chunks[key] !== 'string')) return null;

  try {
    return JSON.parse(keys.map(key => chunks[key]).join(''));
  } catch (error) {
    return null;
  }
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

  try {
    CacheService.getScriptCache().putAll(payload, APP.cacheSeconds);
  } catch (error) {}
}

function clearCache_() {
  const cache = CacheService.getScriptCache();
  const count = Number(cache.get(APP.cachePrefix + ':count')) || 0;
  const keys = [APP.cachePrefix + ':count'];

  for (let i = 0; i < count; i++) {
    keys.push(APP.cachePrefix + ':' + i);
  }

  cache.removeAll(keys);
}
