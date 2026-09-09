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
const V2_BACKEND_BUILD_ = 'v2-backend-assets-2026-09-09-04';

function buildAnalyticsWebApp_() {
  const cacheBust = Date.now();
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

/**
 * Пульс читает DEMO напрямую из исходной «Статистики по ДЕМО».
 * Служебный лист _DEMO v2 здесь намеренно не используется: он может отставать
 * от дозревающего факта прошлой недели и первых событий текущей недели.
 */
function getPulseDataFresh() {
  const result = buildDemoStats_(demoStatsSpreadsheet_());
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
      sourceUrl: result.sourceUrl
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
