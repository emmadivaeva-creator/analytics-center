/**
 * Подмешивает дополнительные интерфейсные модули в текущий index.html.
 * doGet объявлен как обычная функция, чтобы Apps Script видел его как entry point.
 */
function doGet() {
  const base = HtmlService.createHtmlOutputFromFile('index').getContent();
  const callsUi = HtmlService.createHtmlOutputFromFile('calls_ui').getContent();
  const sendsayUi = HtmlService.createHtmlOutputFromFile('sendsay_ui').getContent();
  const emailAnalyticsUi = HtmlService.createHtmlOutputFromFile('email_analytics_ui').getContent();
  const newsUi = HtmlService.createHtmlOutputFromFile('news_ui').getContent();
  const runtimeFixesUi = HtmlService.createHtmlOutputFromFile('runtime_fixes_ui').getContent();
  const addons = callsUi + '\n' + sendsayUi + '\n' + emailAnalyticsUi + '\n' + newsUi + '\n' + runtimeFixesUi;
  const html = base.indexOf('</body>') >= 0
    ? base.replace('</body>', addons + '\n</body>')
    : base + addons;

  return HtmlService.createHtmlOutput(html)
    .setTitle('DEMO Analytics')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
