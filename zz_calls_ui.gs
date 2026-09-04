/**
 * Подмешивает дополнительные интерфейсные модули в текущий index.html,
 * не переписывая существующие вкладки Analytics Center.
 */
doGet = function() {
  const base = HtmlService.createHtmlOutputFromFile('index').getContent();
  const callsUi = HtmlService.createHtmlOutputFromFile('calls_ui').getContent();
  const sendsayUi = HtmlService.createHtmlOutputFromFile('sendsay_ui').getContent();
  const emailAnalyticsUi = HtmlService.createHtmlOutputFromFile('email_analytics_ui').getContent();
  const addons = callsUi + '\n' + sendsayUi + '\n' + emailAnalyticsUi;
  const html = base.indexOf('</body>') >= 0
    ? base.replace('</body>', addons + '\n</body>')
    : base + addons;

  return HtmlService.createHtmlOutput(html)
    .setTitle('DEMO Analytics')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
};
