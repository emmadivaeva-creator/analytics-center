(() => {
  'use strict';
  const config = window.ANALYTICS_DOMAIN_CONFIG;
  let token = '', expiresAt = 0, client, started = false;
  const allowed = new Set(['v2HealthCheck', 'getPulseDataFresh', 'getPulseDataStoredUi', 'syncDriveReportsReliable',
    'syncSendsayApiLast3Days', 'syncDemoStats', 'refreshAppData',
    'getMailRegistryUi', 'getMailRegistryRecentUi', 'getMailRegistryPageUi', 'getMailDemoDetailsUi', 'getMailBodyUi', 'getDemandEvidenceUi',
    'getVikaPlanUi', 'getVikaEditorialUi', 'saveVikaActiveDemoUi', 'getVioTrendsUi']);
  const gate = document.getElementById('authGate');
  const button = document.getElementById('signIn');
  const status = document.getElementById('authStatus');
  function showGate(message) {
    if (!gate.isConnected) document.body.append(gate);
    gate.hidden = false;
    status.textContent = message;
    button.disabled = !client;
  }
  const readMethods = new Set(['v2HealthCheck','getPulseDataFresh','getPulseDataStoredUi','getMailRegistryUi','getMailRegistryRecentUi','getMailRegistryPageUi','getMailDemoDetailsUi','getMailBodyUi','getDemandEvidenceUi','getVikaPlanUi','getVikaEditorialUi','getVioTrendsUi']);
  let jsonpSeq = 0;
  function publicReadOnce_(method, parameters, timeoutMs) {
    return new Promise((resolve, reject) => {
      const callback = 'analyticsJsonp_' + Date.now() + String(++jsonpSeq);
      const url = new URL(config.publicReadUrl);
      url.searchParams.set('method', method);
      url.searchParams.set('args', JSON.stringify(parameters));
      url.searchParams.set('callback', callback);
      url.searchParams.set('_', String(Date.now()));

      const script = document.createElement('script');
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        try { delete window[callback]; } catch (e) { window[callback] = undefined; }
        script.remove();
      };
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn(value);
      };

      window[callback] = data => {
        if (!data || data.ok !== true) {
          finish(reject, new Error(data?.error || 'Не удалось прочитать данные.'));
          return;
        }
        finish(resolve, data.result);
      };

      script.async = true;
      script.src = url.href;
      script.onerror = () => finish(reject, new Error('Не удалось подключиться к серверу аналитики.'));
      const timer = setTimeout(
        () => finish(reject, new Error('Сервер аналитики не ответил вовремя.')),
        timeoutMs || 90000
      );
      document.head.append(script);
    });
  }
  async function publicRead(method, parameters) {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await publicReadOnce_(method, parameters, 90000);
      } catch (error) {
        lastError = error;
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }
    throw new Error(lastError?.message || 'Не удалось подключиться к данным аналитики.');
  }
  function startApp() {
    if(started)return;
    const script=document.createElement('script');script.src='app.js?v=20261010-vika-direct-06';
    script.onerror=()=>{started=false;showGate('Не удалось загрузить приложение. Обновите страницу.');};
    document.head.append(script);started=true;gate.hidden=true;
  }
  window.analyticsRpc = async function(method, ...parameters) {
    // Anonymous viewers use the public Web App. Once the owner is signed in,
    // always prefer Apps Script API so reads use the latest saved project code
    // instead of an accidentally stale /exec deployment.
    const hasLiveToken = Boolean(token && Date.now() < expiresAt);
    if(config.publicReadUrl && readMethods.has(method) && !hasLiveToken){
      return publicRead(method,parameters);
    }
    if (!allowed.has(method)) throw new Error('Этот раздел пока недоступен на новом адресе.');
    if (!token || Date.now() >= expiresAt) {
      token = '';
      showGate('Обновление доступно только владельцу. Просмотр аналитики остаётся открытым для всех.');
      throw new Error('Для обновления данных нужен вход владельца.');
    }
    const response = await fetch('https://script.googleapis.com/v1/scripts/' + encodeURIComponent(config.scriptId) + ':run', {
      method: 'POST', credentials: 'omit', cache: 'no-store',
      headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
      body: JSON.stringify({function: method, parameters, devMode: true})
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
        window.analyticsOwnerMode = true;
        expiresAt = Date.now() + Math.max(0, Number(result.expires_in) - 60) * 1000;
        try {
          await window.analyticsRpc('v2HealthCheck');
          startApp();
          gate.hidden = true;
          window.dispatchEvent(new Event('analytics-authenticated'));
        } catch (error) { showGate(error.message); }
      },
      error_callback: () => showGate('Окно входа закрыто или заблокировано. Нажмите «Войти через Google» снова.')
    });
    button.disabled = false;
    status.textContent = 'Для обновления исходных данных войдите в аккаунт владельца. Просмотр доступен без входа.';
    const requestOwnerLogin = () => {
      showGate('Вход нужен только владельцу для обновления исходных данных.');
      if (!client) {
        status.textContent = 'Google-вход ещё загружается. Повторите через несколько секунд.';
        return;
      }
      button.disabled = true;
      client.requestAccessToken({prompt: ''});
    };
    button.onclick = requestOwnerLogin;
    window.analyticsRequestOwnerLogin = requestOwnerLogin;
  }
  window.addEventListener('load', init, {once: true});
})();
