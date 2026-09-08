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
    build: 'v2-pulse-2026-09-09-03',
    checkedAt: new Date().toISOString()
  };
}
