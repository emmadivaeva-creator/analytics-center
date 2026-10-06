/**
 * Analytics Center V2.
 *
 * Архитектура:
 * - единственный doGet() остаётся в Code.gs;
 * - интерфейс публикуется как app.css + app.js на GitHub Pages;
 * - Apps Script Web App отдаёт только лёгкую HTML-оболочку;
 * - внешний JS выполняется внутри Apps Script-страницы и использует google.script.run напрямую;
 * - UI можно менять в GitHub без нового Apps Script deployment.
 */
const V2_ASSET_BASE_ = 'https://emmadivaeva-creator.github.io/analytics-center/';
const V2_BACKEND_BUILD_ = 'v2-pulse-week41-2026-10-06-01';

function buildAnalyticsWebApp_() {
  const cacheBust = Date.now() + '-mail-cache-20260930-01';
  const cssUrl = V2_ASSET_BASE_ + 'app.css?v=' + cacheBust;
  const jsUrl = V2_ASSET_BASE_ + 'app.js?v=' + cacheBust;

  const html = '<!doctype html>' +
    '<html lang="ru">' +
    '<head>' +
      '<meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Analytics Center</title>' +
      '<link rel="stylesheet" href="' + cssUrl + '">' +
      '<style>html,body{margin:0;min-height:100%;background:#f4f6f9}#boot{padding:32px;font:14px Arial,sans-serif;color:#667085}</style>' +
    '</head>' +
    '<body>' +
      '<div id="boot">Загружаю Analytics Center…</div>' +
      '<script src="' + jsUrl + '"></script>' +
    '</body>' +
    '</html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('Analytics Center')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Проверка backend. */
function v2HealthCheck() {
  return {
    ok: true,
    backendBuild: V2_BACKEND_BUILD_,
    frontendMode: 'github-pages-assets',
    checkedAt: new Date().toISOString()
  };
}

function pulseNorm_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

function pulseNumber_(value) {
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

function pulseMetric_(value) {
  const text = pulseNorm_(value);
  if (text.indexOf('красн') >= 0) return 'red';
  if (text.indexOf('желт') >= 0) return 'yellow';
  if (text.indexOf('зелен') >= 0) return 'green';
  return '';
}

function pulseGroup_(value) {
  const text = pulseNorm_(value);
  if (text.indexOf('госзаказ') >= 0) return 'ГЗ';
  if (text.indexOf('госфинанс') >= 0) return 'ГФ';
  return '';
}

function readPulsePlans_(spreadsheet, observedWeeks) {
  const sheet = spreadsheet.getSheetByName('Планы на год');
  if (!sheet) return {};

  const rows = sheet.getDataRange().getDisplayValues();
  const plans = {};
  let family = '';
  let weekColumns = {};

  for (let i = 0; i < rows.length; i++) {
    const first = pulseNorm_(rows[i][0]);

    if (first === 'школа') { family = 'Школа'; weekColumns = {}; continue; }
    if (first === 'система') { family = 'Система'; weekColumns = {}; continue; }
    if (first === 'периодика') { family = 'Периодика'; weekColumns = {}; continue; }
    if (!family) continue;

    const candidateWeeks = {};
    for (let column = 1; column < rows[i].length; column++) {
      const week = Number(rows[i][column]);
      if (observedWeeks[week]) candidateWeeks[column] = week;
    }

    if ((first === 'неделя' || first === '') && Object.keys(candidateWeeks).length >= 3) {
      weekColumns = candidateWeeks;
      continue;
    }

    const group = pulseGroup_(rows[i][0]);
    if (!group || !Object.keys(weekColumns).length) continue;

    const planRow = rows[i + 1] || [];
    if (pulseNorm_(planRow[0]) !== 'план') continue;

    Object.keys(weekColumns).forEach(function(column) {
      const week = weekColumns[column];
      plans[group + ' ' + family + '|' + week] = pulseNumber_(planRow[Number(column)]);
    });
  }

  return plans;
}

function buildPulseSourceTruth_() {
  // Intentionally read the canonical source directly. This Pulse path does not
  // call buildDemoStats_, so any stale/duplicate global implementation cannot
  // double the System fact again.
  const spreadsheet = SpreadsheetApp.openById(APP.defaultDemoStatsId);
  const totals = {};
  const observedWeeks = {};
  const updatedAt = new Date().toISOString();

  APP.demoSheets.forEach(function(spec) {
    const sheet = spreadsheet.getSheetByName(spec.name);
    if (!sheet) throw new Error('В «Статистике по ДЕМО» нет листа «' + spec.name + '».');

    const rows = sheet.getDataRange().getDisplayValues();
    const headerIndex = rows.findIndex(function(row) {
      return pulseNorm_(row[0]) === 'издательская группа' &&
        pulseNorm_(row[1]).indexOf('utm ') === 0;
    });

    if (headerIndex < 1) {
      throw new Error('На листе «' + spec.name + '» не найдена таблица UTM.');
    }

    const weekRow = rows[headerIndex - 1] || [];
    const headers = rows[headerIndex] || [];
    const metricColumns = [];

    for (let column = 2; column < headers.length; column++) {
      const weekMatch = String(weekRow[column] || '').match(/\d{1,2}/);
      const metric = pulseMetric_(headers[column]);
      if (!weekMatch || !metric) continue;

      const week = Number(weekMatch[0]);
      observedWeeks[week] = true;
      metricColumns.push({column: column, week: week, metric: metric});
    }

    for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex] || [];

      // Critical rule: the Systems source contains another analytical slice
      // after the first "Общий итог". It repeats the same events in another
      // breakdown, so Pulse must stop here.
      if (spec.family === 'Система' && pulseNorm_(row[0]) === 'общий итог') break;

      const group = pulseGroup_(row[0]);
      const sourceKey = String(row[1] || '').trim();
      if (!group || !sourceKey || /итог/i.test(sourceKey)) continue;

      const product = group + ' ' + spec.family;

      metricColumns.forEach(function(info) {
        const amount = pulseNumber_(row[info.column]);
        if (!amount) return;

        const key = product + '|' + info.week;
        if (!totals[key]) {
          totals[key] = {
            product: product,
            week: info.week,
            red: 0,
            yellow: 0,
            green: 0,
            plan: 0
          };
        }
        totals[key][info.metric] += amount;
      });
    }
  });

  const calendarWeek = isoWeek_(todayIso_());
  observedWeeks[calendarWeek] = true;
  const weeks = Object.keys(observedWeeks).map(Number).filter(Boolean).sort(function(a,b){ return a-b; });
  const plans = readPulsePlans_(spreadsheet, observedWeeks);

  APP.productOrder.forEach(function(product) {
    weeks.forEach(function(week) {
      const key = product + '|' + week;
      if (!totals[key]) {
        totals[key] = {product: product, week: week, red: 0, yellow: 0, green: 0, plan: 0};
      }
      totals[key].plan = pulseNumber_(plans[key]);
    });
  });

  return {
    totals: totals,
    currentWeek: weeks.length ? weeks[weeks.length - 1] : null,
    updatedAt: updatedAt,
    sourceUrl: spreadsheet.getUrl(),
    parserBuild: 'pulse-direct-source-first-system-section-20261005'
  };
}

/**
 * Пульс читает DEMO напрямую из исходной «Статистики по ДЕМО».
 * Служебный лист _DEMO v2 здесь намеренно не используется: он может отставать
 * от дозревающего факта прошлой недели и первых событий текущей недели.
 */
function auditPulseNumbers() {
  const result = buildPulseSourceTruth_();
  const rows = [];

  Object.keys(result.totals || {})
    .map(function(key){ return result.totals[key]; })
    .sort(function(a,b){ return number_(a.week)-number_(b.week) || APP.productOrder.indexOf(a.product)-APP.productOrder.indexOf(b.product); })
    .forEach(function(raw){
      const red = number_(raw.red);
      const yellow = number_(raw.yellow);
      const green = number_(raw.green);
      const plan = number_(raw.plan);
      rows.push({
        week: number_(raw.week),
        product: raw.product,
        red: red,
        yellow: yellow,
        green: green,
        plan: plan,
        progress: plan ? round_(green / plan * 100, 1) : 0
      });
    });

  const out = {
    ok: true,
    sourceUrl: result.sourceUrl,
    updatedAt: result.updatedAt,
    rows: rows
  };
  console.log(JSON.stringify(out, null, 2));
  return out;
}

function getPulseDataStoredUi() {
  const storage = openStorage_();
  const sheet = storage.getSheetByName(APP.demoSheet);
  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error('Служебный DEMO-свод пуст. Запустите syncDemoStats().');
  }

  const rows = sheet.getDataRange().getDisplayValues();
  const headers = headerMap_(rows[0]);
  const col = function(aliases){ return indexOfHeader_(headers, aliases); };
  const idx = {
    week: col(['неделя']),
    product: col(['продукт']),
    red: col(['r']),
    yellow: col(['y']),
    green: col(['g']),
    plan: col(['план']),
    updated: col(['обновлено']),
    source: col(['источник'])
  };

  const byWeek = {};
  let updatedAt = '';
  let sourceUrl = '';

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

    const stamp = String(valueAt_(rows[i], idx.updated) || '');
    if (stamp > updatedAt) updatedAt = stamp;

    const source = String(valueAt_(rows[i], idx.source) || '');
    if (source) sourceUrl = source;
  }

  const today = todayIso_();
  const calendarWeek = isoWeek_(today);

  // The DEMO pivot can lag at the start of a new ISO week. Pulse must still
  // switch to the real calendar week immediately. Until fact columns appear,
  // R/Y/G are zero and the plan is read from "Планы на год".
  if (!byWeek[calendarWeek]) byWeek[calendarWeek] = {};

  const planWeeks = {};
  Object.keys(byWeek).forEach(function(week){ planWeeks[Number(week)] = true; });
  planWeeks[calendarWeek] = true;
  const currentPlans = readPulsePlans_(demoStatsSpreadsheet_(), planWeeks);

  APP.productOrder.forEach(function(product) {
    const existing = byWeek[calendarWeek][product];
    const plan = pulseNumber_(currentPlans[product + '|' + calendarWeek]);

    if (existing) {
      existing.plan = plan || existing.plan;
      existing.progress = existing.plan ? round_(existing.green / existing.plan * 100, 1) : 0;
      existing.decision = protocolDecision_(product, existing.red, existing.yellow, existing.green, existing.plan);
      return;
    }

    byWeek[calendarWeek][product] = {
      product: product,
      red: 0,
      yellow: 0,
      green: 0,
      plan: plan,
      progress: 0,
      decision: protocolDecision_(product, 0, 0, 0, plan)
    };
  });

  const weekNumbers = Object.keys(byWeek).map(Number).filter(Boolean).sort(function(a,b){ return a-b; });
  if (!weekNumbers.length) throw new Error('В служебном DEMO-своде нет недель.');

  const details = weekNumbers.map(function(week) {
    const products = APP.productOrder.map(function(product) {
      return byWeek[week][product] || {
        product: product, red: 0, yellow: 0, green: 0, plan: 0, progress: 0,
        decision: protocolDecision_(product, 0, 0, 0, 0)
      };
    });
    return {
      week: week,
      products: products,
      summary: aggregateProducts_(products)
    };
  });

  const selectedWeek = calendarWeek;
  const selected = details.filter(function(item){ return item.week === selectedWeek; })[0];

  return {
    ok: true,
    version: APP.version,
    meta: {
      calendarWeek: calendarWeek,
      currentWeek: selectedWeek,
      year: Number(String(today).slice(0,4)) || new Date().getFullYear(),
      sourceReadAt: updatedAt,
      sourceUrl: sourceUrl,
      parserBuild: 'pulse-stored-demo-v2-20261005'
    },
    products: selected.products,
    summary: selected.summary,
    weeks: details.map(function(item) {
      return {
        week: item.week,
        green: item.summary.green,
        yellow: item.summary.yellow,
        red: item.summary.red,
        plan: item.summary.plan,
        progress: item.summary.progress
      };
    }),
    weekDetails: details
  };
}

function getPulseDataFresh() {
  const result = buildPulseSourceTruth_();
  const today = todayIso_();
  const calendarWeek = isoWeek_(today);
  const year = Number(String(today).slice(0, 4)) || new Date().getFullYear();

  const weeks = {};
  Object.keys(result.totals || {}).forEach(function(key) {
    const item = result.totals[key];
    const week = Number(item && item.week);
    if (week) weeks[week] = true;
  });

  const weekNumbers = Object.keys(weeks).map(Number).sort(function(a, b) { return a - b; });
  const selectedWeek = weeks[calendarWeek]
    ? calendarWeek
    : (result.currentWeek || (weekNumbers.length ? weekNumbers[weekNumbers.length - 1] : calendarWeek));

  const details = weekNumbers.map(function(week) {
    const products = APP.productOrder.map(function(product) {
      const raw = result.totals[product + '|' + week] || emptyDemoTotal_(product, week);
      const red = number_(raw.red);
      const yellow = number_(raw.yellow);
      const green = number_(raw.green);
      const plan = number_(raw.plan);
      return {
        product: product,
        red: red,
        yellow: yellow,
        green: green,
        plan: plan,
        progress: plan ? round_(green / plan * 100, 1) : 0,
        decision: protocolDecision_(product, red, yellow, green, plan)
      };
    });

    return {
      week: week,
      products: products,
      summary: aggregateProducts_(products)
    };
  });

  const selected = details.filter(function(item) { return item.week === selectedWeek; })[0] || {
    week: selectedWeek,
    products: APP.productOrder.map(function(product) { return emptyProduct_(product); }),
    summary: aggregateProducts_([])
  };

  return {
    ok: true,
    version: APP.version,
    meta: {
      calendarWeek: calendarWeek,
      currentWeek: selectedWeek,
      year: year,
      sourceReadAt: result.updatedAt,
      sourceUrl: result.sourceUrl,
      parserBuild: result.parserBuild
    },
    products: selected.products,
    summary: selected.summary,
    weeks: details.map(function(item) {
      return {
        week: item.week,
        green: item.summary.green,
        yellow: item.summary.yellow,
        red: item.summary.red,
        plan: item.summary.plan,
        progress: item.summary.progress
      };
    }),
    weekDetails: details
  };
}
