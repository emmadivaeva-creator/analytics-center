/**
 * Подмешивает интерфейс «Звонки / Что продает» в текущий index.html,
 * не переписывая существующие вкладки DEMO / Sendsay.
 */
doGet = function() {
  const base = HtmlService.createHtmlOutputFromFile('index').getContent();
  const callsUi = HtmlService.createHtmlOutputFromFile('calls_ui').getContent();
  const html = base.indexOf('</body>') >= 0
    ? base.replace('</body>', callsUi + '\n</body>')
    : base + callsUi;

  return HtmlService.createHtmlOutput(html)
    .setTitle('DEMO Analytics')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
};
