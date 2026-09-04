/**
 * Подмешивает дополнительные интерфейсные модули в текущий index.html.
 * final_polish_ui меняет внешний вид и клиентскую аналитику,
 * russian_metrics_ui грузится последним и переводит маркетинговые метрики на понятный редакциям язык.
 */
function doGet() {
  const base = HtmlService.createHtmlOutputFromFile('index').getContent();
  const compatUi = HtmlService.createHtmlOutputFromFile('compat_ui').getContent();
  const callsUi = HtmlService.createHtmlOutputFromFile('calls_ui').getContent();
  const sendsayUi = HtmlService.createHtmlOutputFromFile('sendsay_ui').getContent();
  const emailAnalyticsUi = HtmlService.createHtmlOutputFromFile('email_analytics_ui').getContent();
  const newsUi = HtmlService.createHtmlOutputFromFile('news_ui').getContent();
  const runtimeFixesUi = HtmlService.createHtmlOutputFromFile('runtime_fixes_ui').getContent();
  const finalPolishUi = HtmlService.createHtmlOutputFromFile('final_polish_ui').getContent();
  const russianMetricsUi = HtmlService.createHtmlOutputFromFile('russian_metrics_ui').getContent();
  const addons = compatUi + '\n' + callsUi + '\n' + sendsayUi + '\n' + emailAnalyticsUi + '\n' + newsUi + '\n' + runtimeFixesUi + '\n' + finalPolishUi + '\n' + russianMetricsUi;
  const html = base.indexOf('</body>') >= 0
    ? base.replace('</body>', addons + '\n</body>')
    : base + addons;

  return HtmlService.createHtmlOutput(html)
    .setTitle('DEMO Analytics')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
