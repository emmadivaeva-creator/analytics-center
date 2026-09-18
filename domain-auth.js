(() => {
  'use strict';
  const config = window.ANALYTICS_DOMAIN_CONFIG;
  let token = '', expiresAt = 0, client, started = false;
  const allowed = new Set(['v2HealthCheck', 'getPulseDataFresh', 'syncDriveReportsReliable',
    'syncDemoStats', 'refreshAppData', 'getMailRegistryUi', 'getMailDemoDetailsUi',
    'getVikaPlanUi', 'getVikaEditorialUi']);
  const gate = document.getElementById('authGate');
  const button = document.getElementById('signIn');
  const status = document.getElementById('authStatus');
  function showGate(message) {
    if (!gate.isConnected) document.body.append(gate);
    gate.hidden = false;
    status.textContent = message;
    button.disabled = !client;
  }
  const readMethods = new Set(['v2HealthCheck','getPulseDataFresh','getMailRegistryUi','getMailDemoDetailsUi','getVikaPlanUi','getVikaEditorialUi']);
  function publicRead(method, parameters) {
    return new Promise((resolve,reject) => {
      const callback = 'analyticsJsonp_'+crypto.randomUUID().replace(/-/g,'');
      const script = document.createElement('script');
      const url = new URL(config.publicReadUrl);
      url.searchParams.set('method',method);
      url.searchParams.set('args',JSON.stringify(parameters));
      url.searchParams.set('callback',callback);
      const cleanup=()=>{clearTimeout(timer);script.remove();delete window[callback];};
      const timer=setTimeout(()=>{cleanup();reject(new Error('Данные загружаются слишком долго. Повторите попытку.'));},120000);
      window[callback]=data=>{cleanup();data.ok?resolve(data.result):reject(new Error(data.error||'Не удалось прочитать данные.'));};
      script.onerror=()=>{cleanup();reject(new Error('Не удалось подключиться к данным аналитики.'));};
      script.src=url.href;document.head.append(script);
    });
  }
  function startApp() {
    if(started)return;
    const script=document.createElement('script');script.src='app.js';
    script.onerror=()=>{started=false;showGate('Не удалось загрузить приложение. Обновите страницу.');};
    document.head.append(script);started=true;gate.hidden=true;
  }
  window.analyticsRpc = async function(method, ...parameters) {
    if(config.publicReadUrl && readMethods.has(method))return publicRead(method,parameters);
    if (!allowed.has(method)) throw new Error('Этот раздел пока недоступен на новом адресе.');
    if (!token || Date.now() >= expiresAt) {
      token = '';
      showGate('Войдите через Google, чтобы продолжить.');
      throw new Error('Требуется вход через Google.');
    }
    const response = await fetch('https://script.googleapis.com/v1/scripts/' + encodeURIComponent(config.scriptId) + ':run', {
      method: 'POST', credentials: 'omit', cache: 'no-store',
      headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
      body: JSON.stringify({function: method, parameters, devMode: false})
    });
    if (response.status === 401) {
      token = '';
      showGate('Сеанс завершился. Войдите снова.');
      throw new Error('Сеанс Google завершился.');
    }
    const data = await response.json();
    if (!response.ok || data.error) {
      const detail = data.error?.details?.find(d => d.errorMessage)?.errorMessage;
      throw new Error(detail || data.error?.message || 'Не удалось получить данные Google.');
    }
    if (!data.done) throw new Error('Сервер не подтвердил завершение операции. Обновите данные перед повтором.');
    return data.response?.result;
  };
  // Tokens remain in memory; neither browser storage nor URL contains credentials.
  function init() {
    if(config?.publicReadUrl)startApp();
    if (!config?.clientId || !config.scriptId) {
      showGate('Новая версия готовится к подключению. Текущая аналитика работает по прежней ссылке.');
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      showGate('Не удалось загрузить вход Google. Обновите страницу.');
      return;
    }
    client = google.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: config.scopes.join(' '),
      callback: async result => {
        button.disabled = false;
        if (result.error || !result.access_token) {
          showGate('Вход не завершён. Попробуйте снова.'); return;
        }
        if (!google.accounts.oauth2.hasGrantedAllScopes(result, ...config.scopes)) {
          showGate('Google не предоставил необходимые разрешения для аналитики.'); return;
        }
        token = result.access_token;
        expiresAt = Date.now() + Math.max(0, Number(result.expires_in) - 60) * 1000;
        try {
          await window.analyticsRpc('v2HealthCheck');
          startApp();
          gate.hidden = true;
        } catch (error) { showGate(error.message); }
      },
      error_callback: () => showGate('Окно входа закрыто или заблокировано. Нажмите «Войти через Google» снова.')
    });
    button.disabled = false;
    status.textContent = 'Для обновления исходных данных войдите в аккаунт владельца. Просмотр доступен без входа.';
    button.onclick = () => { button.disabled = true; client.requestAccessToken({prompt: ''}); };
  }
  window.addEventListener('load', init, {once: true});
})();
