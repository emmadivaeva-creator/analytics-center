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
  window.analyticsRpc = async function(method, ...parameters) {
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
          if (!started) {
            const script = document.createElement('script');
            script.src = 'app.js';
            script.onerror = () => { started = false; showGate('Не удалось загрузить приложение. Повторите вход.'); };
            document.head.append(script);
            started = true;
          }
          gate.hidden = true;
        } catch (error) { showGate(error.message); }
      },
      error_callback: () => showGate('Окно входа закрыто или заблокировано. Нажмите «Войти через Google» снова.')
    });
    button.disabled = false;
    status.textContent = 'Войдите в аккаунт владельца аналитики.';
    button.onclick = () => { button.disabled = true; client.requestAccessToken({prompt: ''}); };
  }
  window.addEventListener('load', init, {once: true});
})();
