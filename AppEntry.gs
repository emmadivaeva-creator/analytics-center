/** Единственная точка сборки интерфейса веб-приложения. */
doGet = function() {
  const base = HtmlService.createHtmlOutputFromFile('index').getContent();
  const modules = [
    'compat_ui',
    'calls_ui',
    'sendsay_ui',
    'email_analytics_ui',
    'news_ui',
    'runtime_fixes_ui',
    'final_polish_ui',
    'mail_classification_ui',
    'russian_metrics_ui',
    'service_status_ui'
  ].map(function(name) {
    return HtmlService.createHtmlOutputFromFile(name).getContent();
  }).join('\n');

  const html = base.indexOf('</body>') >= 0
    ? base.replace('</body>', modules + '\n</body>')
    : base + modules;

  return HtmlService.createHtmlOutput(html)
    .setTitle('DEMO Analytics')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
};
