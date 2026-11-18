/**
 * Торговые письма ГФ/ГЗ из Sendsay API (stat.uni).
 * Данные хранятся отдельно от DEMO: никаких изменений в R/Y/G и в папке отчётов.
 *
 * Настройка выполняется в Script Properties проекта Apps Script:
 * SENDSAY_TRADE_GF_ACCOUNT / SENDSAY_TRADE_GF_APIKEY
 * SENDSAY_TRADE_GZ_ACCOUNT / SENDSAY_TRADE_GZ_APIKEY
 * SENDSAY_TRADE_SINCE (необязательно; по умолчанию 2026-01-01).
 *
 * Ключи НИКОГДА не передаются в HTML и не сохраняются в Google Sheets.
 */
const TRADE_MAIL_HEADERS = Object.freeze([
  'Направление', 'Issue ID', 'Дата', 'Время', 'Метки',
  'Campaign', 'Тема письма', 'Отправлено', 'Доставлено',
  'Уник. открытия', 'OR', 'Уник. клики', 'CTR', 'CTOR',
  'Отписки', 'Ссылка Sendsay', 'Идентификатор синхронизации'
]);

const TRADE_MAIL_SELECT = Object.freeze([
  'issue.id', 'issue.name', 'issue.subject', 'issue.dt',
  'issue.format', 'issue.members', 'issue.deliv_ok', 'issue.u_readed',
  'issue.open_rate', 'issue.click_rate', 'issue.click_open_rate',
  'issue.u_clicked', 'issue.unsubed',
  'issue.label0', 'issue.label1', 'issue.label2', 'issue.label3',
  'issue.label4', 'issue.label5', 'issue.label6', 'issue.label7',
  'issue.label8', 'issue.label9'
]);

const TRADE_MAIL_CURSOR_KEY = 'ANALYTICS_TRADE_SYNC_CURSOR';
const TRADE_MAIL_LAST_SYNC_KEY = 'ANALYTICS_TRADE_LAST_SYNC';
const TRADE_MAIL_PAGE_SIZE = 150;
const TRADE_MAIL_TAGS = Object.freeze(['Market', 'Project', 'Event']);

function tradeMailSources_() {
  const properties = PropertiesService.getScriptProperties();
  const sources = [
    {
      direction: 'ГФ',
      account: String(properties.getProperty('SENDSAY_TRADE_GF_ACCOUNT') || '').trim(),
      apiKey: String(properties.getProperty('SENDSAY_TRADE_GF_APIKEY') || '').trim()
    },
    {
      direction: 'ГЗ',
      account: String(properties.getProperty('SENDSAY_TRADE_GZ_ACCOUNT') || '').trim(),
      apiKey: String(properties.getProperty('SENDSAY_TRADE_GZ_APIKEY') || '').trim()
    }
  ];
  const available = sources.filter(function(source) {
    return source.account && source.apiKey;
  });
  if (available.length === 2 && available[0].account === available[1].account) {
    throw new Error('Для ГФ и ГЗ указан один аккаунт Sendsay. Без отдельного признака направления письма будут посчитаны дважды. Нужны разные аккаунты или дополнительное правило разделения.');
  }
  return {
    sources: available,
    configured: sources.map(function(source) {
      return {direction: source.direction, ready: Boolean(source.account && source.apiKey)};
    })
  };
}

function tradeMailSince_() {
  const raw = String(PropertiesService.getScriptProperties()
    .getProperty('SENDSAY_TRADE_SINCE') || '2026-06-29').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || isNaN(new Date(raw + 'T12:00:00Z').getTime())) {
    throw new Error('SENDSAY_TRADE_SINCE должен быть датой YYYY-MM-DD.');
  }
  if (raw < '2026-06-29') throw new Error('Для торговых писем начало периода — 27-я неделя 2026 года (2026-06-29).');
  return raw;
}

function tradeMailSheet_() {
  const storage = openStorage_();
  const name = '_Торговые письма';
  let sheet = storage.getSheetByName(name);
  if (!sheet) sheet = storage.insertSheet(name);
  const existing = sheet.getRange(1, 1, 1, TRADE_MAIL_HEADERS.length).getValues()[0];
  if (TRADE_MAIL_HEADERS.some(function(header, index) {return existing[index] !== header;})) {
    sheet.getRange(1, 1, 1, TRADE_MAIL_HEADERS.length).setValues([TRADE_MAIL_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function tradeMailStoredRows_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, TRADE_MAIL_HEADERS.length)
    .getValues().filter(function(row) {return row[0] && row[1];});
}

function tradeMailWriteRows_(sheet, rows) {
  rows.sort(function(a, b) {
    return String(b[2] || '').localeCompare(String(a[2] || '')) ||
      String(b[3] || '').localeCompare(String(a[3] || ''));
  });
  const previous = sheet.getLastRow() - 1;
  if (previous > 0) {
    sheet.getRange(2, 1, previous, TRADE_MAIL_HEADERS.length).clearContent();
  }
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, TRADE_MAIL_HEADERS.length).setValues(rows);
  }
}

function tradeMailLabels_(rawValues) {
  const found = {};
  (rawValues || []).forEach(function(value) {
    const values = Array.isArray(value) ? value : [value];
    values.forEach(function(item) {
      const current = String(item == null ? '' : item).trim().toLowerCase();
      TRADE_MAIL_TAGS.forEach(function(label) {
        if (current === label.toLowerCase()) found[label] = true;
      });
    });
  });
  return TRADE_MAIL_TAGS.filter(function(label) {return Boolean(found[label]);});
}

function tradeMailIssue_(source, issue, syncId) {
  if (!Array.isArray(issue)) return null;
  const issueId = String(issue[0] == null ? '' : issue[0]).trim();
  if (!/^\d+$/.test(issueId)) return null;
  if (String(issue[4] == null ? '' : issue[4]).toLowerCase() !== 'e') return null;
  const labels = tradeMailLabels_(issue.slice(13, 23));
  if (!labels.length) return null;

  const dateTime = String(issue[3] == null ? '' : issue[3]).replace('T', ' ').trim();
  const date = normalizeDate_(dateTime);
  if (!date) return null;

  const counts = function(value) {return Math.max(0, number_(value));};
  return [
    source.direction, issueId, date,
    (dateTime.match(/\b(\d{1,2}:\d{2})(?::\d{2})?/) || [,''])[1],
    labels.join('|'),
    String(issue[1] || '').trim(),
    String(issue[2] || '').trim() || 'Тема не указана в Sendsay',
    counts(issue[5]),
    counts(issue[6]),
    counts(issue[7]),
    percent_(issue[8]),
    counts(issue[11]),
    percent_(issue[9]),
    percent_(issue[10]),
    counts(issue[12]),
    'https://app.sendsay.ru/reports/campaigns/' + encodeURIComponent(issueId) + '/summary',
    syncId
  ];
}

function tradeMailApiPage_(source, skip, since) {
  const endpoint = 'https://api.sendsay.ru/general/api/v100/json/' +
    encodeURIComponent(source.account);
  const request = {
    action: 'stat.uni',
    apikey: source.apiKey,
    select: TRADE_MAIL_SELECT,
    filter: [
      {a: 'issue.dt:YD', op: '>=', v: since},
      {a: 'issue.format', op: '==', v: 'e'}
    ],
    order: ['-issue.dt'],
    skip: skip,
    first: TRADE_MAIL_PAGE_SIZE
  };
  const response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    payload: JSON.stringify(request),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code !== 200) {
    throw new Error('Sendsay (' + source.direction + ') вернул HTTP ' + code +
      '. Проверьте API-ключ, доступ и лимиты.');
  }

  let body;
  try {
    body = JSON.parse(response.getContentText('UTF-8'));
  } catch (error) {
    throw new Error('Sendsay (' + source.direction + ') вернул ответ не в формате JSON.');
  }
  if (body && Array.isArray(body.errors) && body.errors.length) {
    // Не выводим исходный ответ: в нём потенциально могут быть служебные данные.
    throw new Error('Ошибка Sendsay (' + source.direction + '): ' +
      String(body.errors[0].id || 'неизвестная ошибка'));
  }
  if (!body || !Array.isArray(body.list)) {
    throw new Error('Sendsay (' + source.direction +
      ') не вернул массив list. Проверьте права на stat.uni и синхронную выдачу.');
  }
  return body.list;
}

function tradeMailUpsert_(newRows) {
  if (!newRows.length) return 0;
  const sheet = tradeMailSheet_();
  const rows = tradeMailStoredRows_(sheet);
  const index = {};
  rows.forEach(function(row, i) {index[String(row[0]) + '|' + String(row[1])] = i;});
  newRows.forEach(function(row) {
    const key = String(row[0]) + '|' + String(row[1]);
    if (Object.prototype.hasOwnProperty.call(index, key)) {
      rows[index[key]] = row;
    } else {
      index[key] = rows.length;
      rows.push(row);
    }
  });
  tradeMailWriteRows_(sheet, rows);
  return newRows.length;
}

function tradeMailPrune_(syncId, sources) {
  const directions = {};
  sources.forEach(function(source) {directions[source.direction] = true;});
  const sheet = tradeMailSheet_();
  const rows = tradeMailStoredRows_(sheet);
  const retained = rows.filter(function(row) {
    return !directions[String(row[0])] || String(row[16]) === syncId;
  });
  const removed = rows.length - retained.length;
  if (removed) tradeMailWriteRows_(sheet, retained);
  return removed;
}

/**
 * Один вызов = одна страница API из одного аккаунта.
 * Вызывать firstPass=true один раз и затем false, пока remaining не станет false.
 * Старые данные удаляются только после ПОЛНОГО успешного прохода.
 */
function syncTradeMailBatch(firstPass) {
  assertAdmin_();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const props = PropertiesService.getScriptProperties();
    const config = tradeMailSources_();
    const sources = config.sources;
    if (!sources.length) {
      throw new Error('Не настроен Sendsay для торговых писем. Добавьте ACCOUNT и APIKEY для ГФ/ГЗ в Script Properties.');
    }
    const since = tradeMailSince_();
    let cursor;
    if (firstPass === true) {
      cursor = {
        sourceIndex: 0, skip: 0, since: since,
        directions: sources.map(function(source) {return source.direction;}),
        syncId: new Date().toISOString()
      };
    } else {
      try {cursor = JSON.parse(props.getProperty(TRADE_MAIL_CURSOR_KEY) || 'null');}
      catch (error) {cursor = null;}
      if (!cursor) throw new Error('Синхронизация не запущена. Начните с первого пакета.');
      if (cursor.since !== since ||
        cursor.directions.join('|') !== sources.map(function(source) {return source.direction;}).join('|')) {
        throw new Error('Настройки Sendsay изменились. Перезапустите синхронизацию с первого пакета.');
      }
    }

    const source = sources[cursor.sourceIndex];
    const list = tradeMailApiPage_(source, cursor.skip, since);
    const valid = list.map(function(issue) {
      return tradeMailIssue_(source, issue, cursor.syncId);
    }).filter(Boolean);
    tradeMailUpsert_(valid);

    cursor.skip += list.length;
    if (list.length < TRADE_MAIL_PAGE_SIZE) {
      cursor.sourceIndex += 1;
      cursor.skip = 0;
    }

    const remaining = cursor.sourceIndex < sources.length;
    let removed = 0;
    if (remaining) {
      props.setProperty(TRADE_MAIL_CURSOR_KEY, JSON.stringify(cursor));
    } else {
      removed = tradeMailPrune_(cursor.syncId, sources);
      props.deleteProperty(TRADE_MAIL_CURSOR_KEY);
      props.setProperty(TRADE_MAIL_LAST_SYNC_KEY, new Date().toISOString());
    }
    return {
      ok: true, processed: list.length, matched: valid.length,
      direction: source.direction, removed: removed,
      remaining: remaining
    };
  } finally {
    lock.releaseLock();
  }
}

/** Read-only метод для вкладки; конфигурация возвращается БЕЗ ключей и кодов аккаунтов. */
function getTradeMailData() {
  const config = tradeMailSources_();
  const props = PropertiesService.getScriptProperties();
  const sheet = tradeMailSheet_();
  const items = tradeMailStoredRows_(sheet).map(function(row) {
    const date = normalizeDate_(row[2]);
    const labels = String(row[4] || '').split('|')
      .filter(function(label) {return TRADE_MAIL_TAGS.indexOf(label) !== -1;});
    return {
      id: 'trade-' + String(row[0]) + '-' + String(row[1]),
      direction: String(row[0]),
      campaignId: String(row[1]),
      date: date,
      time: String(row[3] || ''),
      week: isoWeek_(date),
      labels: labels,
      campaign: String(row[5] || ''),
      subject: String(row[6] || ''),
      sent: number_(row[7]),
      delivered: number_(row[8]),
      opened: number_(row[9]),
      openRate: percent_(row[10] + '%'),
      clicked: number_(row[11]),
      clickRate: percent_(row[12] + '%'),
      ctor: percent_(row[13] + '%'),
      unsubscribed: number_(row[14]),
      sendsay: String(row[15] || '')
    };
  }).filter(function(item) {
    return item.date && (item.direction === 'ГФ' || item.direction === 'ГЗ') &&
      item.labels.length > 0;
  });

  return {
    items: items,
    status: {
      configured: config.configured,
      since: tradeMailSince_(),
      lastSync: props.getProperty(TRADE_MAIL_LAST_SYNC_KEY) || '',
      syncing: Boolean(props.getProperty(TRADE_MAIL_CURSOR_KEY))
    }
  };
}
