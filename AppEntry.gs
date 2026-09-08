/**
 * Analytics Center V2.
 *
 * Важно: единственный doGet() остаётся в Code.gs.
 * Web App отдаёт один index.html без цепочки UI-патчей.
 */
function buildAnalyticsWebApp_() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Analytics Center')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Лёгкая проверка, что открыта именно актуальная V2 и Apps Script отвечает. */
function v2HealthCheck() {
  return {
    ok: true,
    build: 'v2-pulse-source-2026-09-09-04',
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
