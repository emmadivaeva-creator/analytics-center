/**
 * Analytics Center V2.
 *
 * Архитектура:
 * - единственный doGet() остаётся в Code.gs;
 * - UI живёт в GitHub, ветка v2-rebuild;
 * - Apps Script при каждом открытии Web App забирает свежий index.html с GitHub;
 * - локальный index.html остаётся аварийным fallback, если GitHub временно недоступен.
 */
const V2_FRONTEND_API_URL_ = 'https://api.github.com/repos/emmadivaeva-creator/analytics-center/contents/index.html?ref=v2-rebuild';
const V2_FRONTEND_RAW_URL_ = 'https://raw.githubusercontent.com/emmadivaeva-creator/analytics-center/v2-rebuild/index.html';
const V2_BACKEND_BUILD_ = 'v2-backend-2026-09-09-02';

function buildAnalyticsWebApp_() {
  let html = '';
  let frontendSource = 'github-api';
  let lastError = '';

  // Основной путь: официальный GitHub Contents API в raw-режиме.
  try {
    const response = UrlFetchApp.fetch(V2_FRONTEND_API_URL_ + '&ts=' + Date.now(), {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'Accept': 'application/vnd.github.raw+json',
        'User-Agent': 'analytics-center-apps-script',
        'Cache-Control': 'no-cache'
      }
    });
    if (response.getResponseCode() !== 200) {
      throw new Error('GitHub API вернул HTTP ' + response.getResponseCode());
    }
    html = response.getContentText('UTF-8');
    assertAnalyticsHtml_(html, 'GitHub API');
  } catch (err) {
    lastError = String(err);
    html = '';
  }

  // Запасной путь: raw.githubusercontent.com.
  if (!html) {
    frontendSource = 'github-raw';
    try {
      const response = UrlFetchApp.fetch(V2_FRONTEND_RAW_URL_ + '?ts=' + Date.now(), {
        muteHttpExceptions: true,
        followRedirects: true,
        headers: {
          'User-Agent': 'analytics-center-apps-script',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (response.getResponseCode() !== 200) {
        throw new Error('GitHub raw вернул HTTP ' + response.getResponseCode());
      }
      html = response.getContentText('UTF-8');
      assertAnalyticsHtml_(html, 'GitHub raw');
    } catch (err) {
      lastError += (lastError ? ' | ' : '') + String(err);
      html = '';
    }
  }

  // Аварийный fallback: локальная копия из Apps Script.
  if (!html) {
    frontendSource = 'local-fallback';
    html = HtmlService.createHtmlOutputFromFile('index').getContent();
    console.error('Не удалось загрузить V2 UI из GitHub, использован локальный fallback: ' + lastError);
  }

  const marker = '<script>window.__ANALYTICS_FRONTEND_SOURCE__=' + JSON.stringify(frontendSource) + ';<\/script>';
  html = html.indexOf('</head>') >= 0 ? html.replace('</head>', marker + '\n</head>') : marker + html;

  return HtmlService.createHtmlOutput(html)
    .setTitle('Analytics Center')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function assertAnalyticsHtml_(html, source) {
  if (!html || html.indexOf('<title>Analytics Center</title>') === -1) {
    throw new Error(source + ' вернул неожиданный HTML');
  }
}

/** Проверка backend. UI-версия больше не обязана совпадать с backend-версией. */
function v2HealthCheck() {
  return {
    ok: true,
    backendBuild: V2_BACKEND_BUILD_,
    frontendMode: 'github-live',
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
