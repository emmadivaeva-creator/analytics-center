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
  async function publicRead(method, parameters) {
    const url = new URL(config.publicReadUrl);
    url.searchParams.set('method', method);
    url.searchParams.set('args', JSON.stringify(parameters));
    // Anonymous CORS reads avoid account redirects and cross-site script blocking.
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      let data;
      try {
        const response = await fetch(url.href, {
          method: 'GET', credentials: 'omit', redirect: 'follow',
          cache: 'no-store', signal: controller.signal
        });
        if (!response.ok) {
          const error = new Error('Сервер аналитики временно недоступен (' + response.status + ').');
          error.retryable = response.status === 429 || response.status >= 500;
          throw error;
        }
        data = await response.json();
      } catch (error) {
        if (attempt === 2 || error.retryable === false) {
          throw new Error(error.name === 'AbortError'
            ? 'Данные загружаются слишком долго. Повторите попытку.'
            : 'Не удалось подключиться к данным аналитики. Нажмите «Проверить сервер» или обновите страницу.');
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      } finally {
        clearTimeout(timer);
      }
      // Application errors are not network failures and must not be retried.
      if (!data || data.ok !== true) throw new Error(data?.error || 'Не удалось прочитать данные.');
      return data.result;
    }
  }
  function startApp() {
    if(started)return;
    const script=document.createElement('script');script.src='app.js?v=20260918-demand-progress';
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
      if (!config?.publicReadUrl) showGate('Не удалось загрузить вход Google. Обновите страницу.');
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
