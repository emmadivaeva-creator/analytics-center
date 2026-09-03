/**
 * Analytics Center — server side for a Google Apps Script web app.
 *
 * Install this project as a bound script of the editorial analytics workbook.
 * Run setup() once, then deploy as a web app for users in the Workspace domain.
 */

const APP = Object.freeze({
  version: '1.0.0',
  cachePrefix: 'analytics-center-v1',
  cacheSeconds: 300,
  sourceProperty: 'ANALYTICS_SHEET_ID',
  adminProperty: 'ANALYTICS_ADMIN_EMAIL',
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

function buildAppData_() {
  const spreadsheet = openSource_();
  const products = readCurrentProducts_(spreadsheet);
  const currentWeek = detectCurrentWeek_(spreadsheet) || 36;
  const weeks = readWeeks_(spreadsheet, products, currentWeek);
  const plans = readPlans_(spreadsheet);
  const emails = readEmails_(spreadsheet, plans);
  const insights = readInsights_(spreadsheet);
  const updated = DriveApp.getFileById(spreadsheet.getId()).getLastUpdated();
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
      sourceUrl: spreadsheet.getUrl(),
      generatedAt: new Date().toISOString()
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
