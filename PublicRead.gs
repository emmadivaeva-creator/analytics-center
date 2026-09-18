/** Anonymous read-only endpoints for the dashboard approved for public sharing. */
var PUBLIC_DASHBOARD_READ_ = false;
function publicDashboardRead_(event) {
  const p = event && event.parameter || {};
  const callback = String(p.callback || '');
  if (callback && !/^analyticsJsonp_[A-Za-z0-9]+$/.test(callback)) return ContentService.createTextOutput('Invalid callback').setMimeType(ContentService.MimeType.TEXT);
  let envelope;
  try {
    const methods = {
      v2HealthCheck: v2HealthCheck,
      getPulseDataFresh: getPulseDataFresh,
      getMailRegistryUi: getMailRegistryUi,
      getMailDemoDetailsUi: getMailDemoDetailsUi,
      getVikaPlanUi: getVikaPlanUi,
      getVikaEditorialUi: getVikaEditorialUi
    };
    const method = String(p.method || '');
    if (!Object.prototype.hasOwnProperty.call(methods, method)) throw new Error('Доступен только просмотр аналитики.');
    const args = JSON.parse(p.args || '[]');
    if (!Array.isArray(args) || args.length > 1 || (args.length && args[0] !== null && !['string','number'].includes(typeof args[0]))) throw new Error('Некорректные параметры.');
    PUBLIC_DASHBOARD_READ_ = true;
    const result = methods[method].apply(null, args);
    envelope = {ok:true,result:result};
  } catch (e) { envelope = {ok:false,error:String(e.message || e)}; }
  finally { PUBLIC_DASHBOARD_READ_ = false; }
  const json = JSON.stringify(envelope).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  return ContentService.createTextOutput(callback ? callback+'('+json+');' : json).setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
