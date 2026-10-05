/**
 * Sendsay API source for Analytics Center.
 *
 * Replaces the working route "download report -> Google Drive -> parser".
 * Data is read directly from stat.uni under LBAC policies:
 *   goi = 52
 *   mcfr_gos = 61
 *
 * Script properties required:
 *   SENDSAY_API_KEY
 *   SENDSAY_ACCOUNT = actionmedia
 */

const SENDSAY_API = Object.freeze({
  endpoint: 'https://api.sendsay.ru/general/api/v100/json/',
  parserVersion: 'sendsay-api-v1',
  pageSize: 500,
  dailyDays: 3,
  backfillFrom: '2026-07-01',
  backfillStateProperty: 'SENDSAY_API_BACKFILL_STATE',
  backfillTriggerHandler: 'continueSendsayApiBackfill',
  dailyTriggerHandler: 'dailySendsaySync',
  policies: [
    { id: '52', name: 'goi' },
    { id: '61', name: 'mcfr_gos' }
  ]
});

const SENDSAY_API_SELECT = Object.freeze([
  'issue.id',
  'issue.dt:Ys',
  'issue.name',
  'issue.subject',
  'issue.format',
  'issue.group.gid',
  'issue.group.name',
  'issue.draft.id',
  'issue.draft.name',
  'issue.members',
  'issue.deliv_ok',
  'issue.delivery_rate',
  'issue.u_readed',
  'issue.open_rate',
  'issue.u_clicked',
  'issue.click_rate',
  'issue.click_open_rate',
  'issue.unsubed'
]);

function sendsayApiRequest_(payload, policyId) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = String(props.getProperty('SENDSAY_API_KEY') || '').trim();
  const account = String(props.getProperty('SENDSAY_ACCOUNT') || '').trim();

  if (!apiKey) throw new Error('Не задан Script Property SENDSAY_API_KEY.');
  if (!account) throw new Error('Не задан Script Property SENDSAY_ACCOUNT.');

  const request = Object.assign({}, payload, {
    apikey: apiKey,
    'lbac.policy': String(policyId)
  });

  const response = UrlFetchApp.fetch(
    SENDSAY_API.endpoint + encodeURIComponent(account),
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(request),
      muteHttpExceptions: true
    }
  );

  let data;
  try {
    data = JSON.parse(response.getContentText());
  } catch (error) {
    throw new Error(
      'Sendsay вернул не JSON. HTTP ' + response.getResponseCode() + ': ' +
      response.getContentText().slice(0, 500)
    );
  }

  if (data.errors && data.errors.length) {
    throw new Error(
      data.errors.map(function(item) {
        return item.id || item.explain || JSON.stringify(item);
      }).join(', ')
    );
  }

  return data;
}

function testSendsayApiOneDay() {
  assertAdmin_();

  const date = '2026-09-29';
  const result = SENDSAY_API.policies.map(function(policy) {
    const data = sendsayApiRequest_({
      action: 'stat.uni',
      select: SENDSAY_API_SELECT.slice(),
      filter: [
        { a: 'issue.dt:YD', op: '>=', v: date },
        { a: 'issue.dt:YD', op: '<=', v: date }
      ],
      order: ['-issue.dt:Ys'],
      first: 300
    }, policy.id);

    const rawRows = Array.isArray(data.list) ? data.list : [];
    const mapped = rawRows
      .map(function(row) { return sendsayApiRowToReport_(row, policy); })
      .filter(Boolean);

    return {
      policy: policy.name,
      policyId: policy.id,
      rawRows: rawRows.length,
      analyticsRows: mapped.length,
      sample: mapped.slice(0, 12).map(function(report) {
        return {
          issueId: report.campaignId,
          date: report.date,
          time: report.time,
          campaign: report.campaign,
          subject: report.subject,
          product: report.product,
          type: report.type,
          delivered: report.delivered,
          uniqueOpened: report.uniqueOpened,
          uniqueClicked: report.uniqueClicked,
          openRate: report.openRate,
          clickRate: report.clickRate,
          ctor: report.ctor,
          calcOpenRate: report.delivered ? round_(report.uniqueOpened / report.delivered * 100, 2) : 0,
          calcClickRate: report.delivered ? round_(report.uniqueClicked / report.delivered * 100, 2) : 0,
          calcCtor: report.uniqueOpened ? round_(report.uniqueClicked / report.uniqueOpened * 100, 2) : 0,
          sendsay: report.sendsay
        };
      })
    };
  });

  console.log(JSON.stringify(result, null, 2));
  return result;
}

function testSendsayApiConnection() {
  assertAdmin_();
  const today = todayIso_();

  return {
    ok: true,
    account: String(
      PropertiesService.getScriptProperties().getProperty('SENDSAY_ACCOUNT') || ''
    ),
    policies: SENDSAY_API.policies.map(function(policy) {
      const data = sendsayApiRequest_({
        action: 'stat.uni',
        select: ['issue.id', 'issue.dt:Ys', 'issue.name'],
        filter: [
          { a: 'issue.dt:YD', op: '>=', v: today },
          { a: 'issue.dt:YD', op: '<=', v: today }
        ],
        order: ['-issue.dt:Ys'],
        first: 1
      }, policy.id);

      return {
        id: policy.id,
        name: policy.name,
        visible: Array.isArray(data.list) ? data.list.length : 0
      };
    })
  };
}

/**
 * Compatibility entry point used by the existing UI button.
 * Reads the last three calendar days from Sendsay API.
 */
function syncSendsayApiLast3Days() {
  assertAdmin_();

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const to = todayIso_();
    const from = shiftIsoDate_(to, -(SENDSAY_API.dailyDays - 1));
    const result = syncSendsayApiRange_(from, to);

    clearCache_();

    return {
      ok: true,
      source: 'sendsay-api',
      from: from,
      to: to,
      processed: result.accepted,
      success: result.accepted,
      errors: 0,
      remaining: 0,
      found: result.fetched,
      folderFiles: 0,
      items: [],
      importedTotal: readImportStatus_(openStorage_()).total,
      policies: result.policies
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Daily job: refresh the last three days, then refresh DEMO links/plans.
 */
function dailySendsaySync() {
  const api = syncSendsayApiLast3Days();
  const demo = syncDemoStats();

  return {
    ok: true,
    api: api,
    demo: demo,
    finishedAt: new Date().toISOString()
  };
}

/**
 * Run once after adding the API key to this Apps Script project.
 * Validates access, installs the ~08:00 Moscow trigger and starts backfill
 * from 2026-07-01.
 */
function setupSendsayApiMigration() {
  assertAdmin_();

  const connection = testSendsayApiConnection();
  const dailyTrigger = installDailySendsayApiTrigger();
  const backfill = startSendsayApiBackfillFromJuly();

  return {
    ok: true,
    connection: connection,
    dailyTrigger: dailyTrigger,
    backfill: backfill
  };
}

function installDailySendsayApiTrigger() {
  assertAdmin_();
  deleteTriggersByHandler_(SENDSAY_API.dailyTriggerHandler);

  ScriptApp.newTrigger(SENDSAY_API.dailyTriggerHandler)
    .timeBased()
    .atHour(8)
    .nearMinute(0)
    .everyDays(1)
    .inTimezone('Europe/Moscow')
    .create();

  return {
    ok: true,
    handler: SENDSAY_API.dailyTriggerHandler,
    schedule: 'ежедневно около 08:00 Europe/Moscow',
    daysRefreshed: SENDSAY_API.dailyDays
  };
}

/**
 * Starts/starts over the one-time history load from 2026-07-01.
 * It continues in small safe batches if Apps Script cannot finish in one run.
 */
function startSendsayApiBackfillFromJuly() {
  assertAdmin_();

  const props = PropertiesService.getScriptProperties();
  const today = todayIso_();

  if (SENDSAY_API.backfillFrom > today) {
    throw new Error('Дата начала backfill позже сегодняшней даты.');
  }

  const state = {
    version: 1,
    startedAt: new Date().toISOString(),
    windowStart: SENDSAY_API.backfillFrom,
    policyIndex: 0,
    skip: 0,
    fetched: 0,
    accepted: 0,
    upserted: 0,
    today: today
  };

  props.setProperty(
    SENDSAY_API.backfillStateProperty,
    JSON.stringify(state)
  );

  ensureBackfillTrigger_();
  return continueSendsayApiBackfill();
}

/**
 * Continuation handler for the one-time history load.
 * Processes as many API pages as fit into ~4 minutes, persists the cursor,
 * then a temporary trigger continues later.
 */
function continueSendsayApiBackfill() {
  assertAdmin_();

  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(SENDSAY_API.backfillStateProperty);

  if (!raw) {
    deleteTriggersByHandler_(SENDSAY_API.backfillTriggerHandler);
    return { ok: true, done: true, message: 'Backfill уже завершён или не запускался.' };
  }

  let state = JSON.parse(raw);
  const deadline = Date.now() + 240000;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  let done = false;
  let demoResult = null;

  try {
    const storage = openStorage_();
    const sheet = ensureSendsaySheet_(storage);
    const index = buildSendsayApiIndex_(sheet);

    while (Date.now() < deadline - 15000) {
      const today = todayIso_();

      if (state.windowStart > today) {
        done = true;
        break;
      }

      const windowEnd = minIsoDate_(
        endOfMonthIso_(state.windowStart),
        today
      );

      const policy = SENDSAY_API.policies[state.policyIndex];
      const page = fetchSendsayApiPage_(
        policy,
        state.windowStart,
        windowEnd,
        state.skip
      );

      state.fetched += page.rows.length;

      page.rows.forEach(function(row) {
        const report = sendsayApiRowToReport_(row, policy);
        if (!report) return;

        state.accepted++;
        upsertSendsayApiReport_(sheet, index, report);
        state.upserted++;
      });

      if (page.rows.length < SENDSAY_API.pageSize) {
        state.skip = 0;
        state.policyIndex++;

        if (state.policyIndex >= SENDSAY_API.policies.length) {
          state.policyIndex = 0;
          state.windowStart = shiftIsoDate_(windowEnd, 1);
        }
      } else {
        state.skip += page.rows.length;
      }

      props.setProperty(
        SENDSAY_API.backfillStateProperty,
        JSON.stringify(state)
      );
    }

    if (state.windowStart > todayIso_()) done = true;

    reconcileCanonicalRows_(sheet);
    clearCache_();

    if (done) {
      props.deleteProperty(SENDSAY_API.backfillStateProperty);
      deleteTriggersByHandler_(SENDSAY_API.backfillTriggerHandler);
    } else {
      ensureBackfillTrigger_();
    }
  } finally {
    lock.releaseLock();
  }

  if (done) {
    demoResult = syncDemoStats();
  }

  return {
    ok: true,
    done: done,
    cursor: done ? '' : state.windowStart,
    policy: done ? '' : SENDSAY_API.policies[state.policyIndex].name,
    skip: done ? 0 : state.skip,
    fetched: state.fetched,
    accepted: state.accepted,
    upserted: state.upserted,
    demo: demoResult
  };
}

function getSendsayApiBackfillStatus() {
  const raw = PropertiesService.getScriptProperties()
    .getProperty(SENDSAY_API.backfillStateProperty);

  let result;

  if (!raw) {
    result = { ok: true, running: false, done: true };
  } else {
    const state = JSON.parse(raw);
    result = {
      ok: true,
      running: true,
      done: false,
      startedAt: state.startedAt,
      cursor: state.windowStart,
      policy: SENDSAY_API.policies[state.policyIndex].name,
      skip: state.skip,
      fetched: state.fetched,
      accepted: state.accepted,
      upserted: state.upserted
    };
  }

  console.log(JSON.stringify(result, null, 2));
  return result;
}

function syncSendsayApiRange_(from, to) {
  const storage = openStorage_();
  const sheet = ensureSendsaySheet_(storage);
  const index = buildSendsayApiIndex_(sheet);

  const result = {
    fetched: 0,
    accepted: 0,
    upserted: 0,
    policies: []
  };

  SENDSAY_API.policies.forEach(function(policy) {
    let skip = 0;
    let policyFetched = 0;
    let policyAccepted = 0;
    let pages = 0;

    while (true) {
      const page = fetchSendsayApiPage_(policy, from, to, skip);
      const rows = page.rows;

      result.fetched += rows.length;
      policyFetched += rows.length;

      rows.forEach(function(row) {
        const report = sendsayApiRowToReport_(row, policy);
        if (!report) return;

        result.accepted++;
        policyAccepted++;
        upsertSendsayApiReport_(sheet, index, report);
        result.upserted++;
      });

      pages++;

      if (rows.length < SENDSAY_API.pageSize) break;

      skip += rows.length;
      if (pages > 200) {
        throw new Error(
          'Sendsay API: слишком много страниц за период ' +
          from + ' — ' + to + ' / policy ' + policy.name
        );
      }
    }

    result.policies.push({
      id: policy.id,
      name: policy.name,
      fetched: policyFetched,
      accepted: policyAccepted,
      pages: pages
    });
  });

  reconcileCanonicalRows_(sheet);
  return result;
}

function fetchSendsayApiPage_(policy, from, to, skip) {
  const data = sendsayApiRequest_({
    action: 'stat.uni',
    select: SENDSAY_API_SELECT.slice(),
    filter: [
      { a: 'issue.dt:YD', op: '>=', v: from },
      { a: 'issue.dt:YD', op: '<=', v: to }
    ],
    order: ['issue.dt:Ys', 'issue.id'],
    skip: Number(skip) || 0,
    first: SENDSAY_API.pageSize
  }, policy.id);

  return {
    rows: Array.isArray(data.list) ? data.list : []
  };
}

function sendsayApiRowToReport_(row, policy) {
  if (!Array.isArray(row) || !row.length) return null;

  const issueId = String(row[0] || '').trim();
  const issueDt = String(row[1] || '').trim();
  const issueName = String(row[2] || '').trim();
  const subject = String(row[3] || '').trim();
  const format = String(row[4] || '').trim().toLowerCase();
  const groupGid = String(row[5] || '').trim();

  if (!issueId || !issueDt || format !== 'e') return null;

  // Персональные тестовые отправки не должны попадать в редакционную аналитику.
  // В тестовом срезе Sendsay они приходят с gid=personal и часто с subject "Тест: ...".
  if (groupGid === 'personal' || /^\s*тест\s*:/i.test(subject)) return null;

  const campaign = campaignFromIssueName_(issueName);

  if (!isAnalyticsSendsayIssue_(issueName, campaign)) return null;

  const classification = classifyCampaign_(
    campaign,
    issueName,
    subject,
    ''
  );

  if (!classification.product || classification.product === 'Не указано') {
    return null;
  }

  const uniqueOpened = number_(row[12]);
  const unsubscribed = number_(row[17]);
  const utor = uniqueOpened
    ? round_(unsubscribed / uniqueOpened * 100, 2)
    : 0;

  return {
    fileId: 'api:' + policy.id + ':' + issueId,
    fileName: issueName || ('Sendsay issue ' + issueId),
    format: 'api',
    modified: issueDt,
    importedAt: new Date().toISOString(),
    parserVersion: SENDSAY_API.parserVersion,

    campaignId: issueId,
    date: normalizeDate_(issueDt),
    time: normalizeTime_(issueDt),
    type: classification.type,
    product: classification.product,
    flow: classification.flow,
    segment: classification.segment,
    campaign: campaign,
    sendsay: 'https://app.sendsay.ru/reports/campaigns/' +
      encodeURIComponent(issueId) + '/summary',
    subject: subject || issueName,

    sent: number_(row[9]),
    delivered: number_(row[10]),
    deliveredRate: sendsayApiRate_(row[11]),
    uniqueOpened: uniqueOpened,
    openRate: sendsayApiRate_(row[13]),
    uniqueClicked: number_(row[14]),
    clickRate: sendsayApiRate_(row[15]),
    ctor: sendsayApiRate_(row[16]),
    unsubscribed: unsubscribed,
    utor: utor,

    policyId: policy.id,
    policyName: policy.name,
    draftId: String(row[7] || ''),
    draftName: String(row[8] || ''),
    groupGid: groupGid,
    groupName: String(row[6] || '')
  };
}

function sendsayApiRate_(value) {
  // issue.delivery_rate / open_rate / click_rate / click_open_rate
  // уже приходят из stat.uni в процентных пунктах.
  // Например 0.14 означает 0.14%, а не 14%.
  return round_(number_(value), 2);
}

function campaignFromIssueName_(issueName) {
  const text = String(issueName || '').trim();

  // В интерфейсе issue.name обычно выглядит как
  // "265 | DEMO | campaign_name" / "729 | NEWS | campaign_name".
  // У АКТИВДЕМО второй токен может отличаться, поэтому снимаем
  // общий служебный префикс, а не только DEMO/NEWS.
  const direct = text.match(
    /^\s*\d+\s*\|\s*[^|]+\|\s*(.+)$/i
  );

  return direct && direct[1]
    ? direct[1].trim()
    : text;
}

function isAnalyticsSendsayIssue_(issueName, campaign) {
  const name = String(issueName || '');
  const normalizedCampaign = String(campaign || '');
  const text = name + ' ' + normalizedCampaign;

  // Технические ML/GPT-рекомендации не берём.
  if (/mcfr[_-].*gpt[_-]recommendation|gpt[_-]recommendation|ml[_-]json|json[_-]eck/i.test(text)) {
    return false;
  }

  const sourceMatch = name.match(/^\s*(\d+)\s*\|/);
  const sourceId = sourceMatch ? sourceMatch[1] : '';

  // Наши продукты:
  // ГФ: УБУ, ЗБУ, Система Госфинансы, Школа Главбуха.
  // ГЗ: ГЗРУ, АПФАС, ГЗВИО, Система Госзаказ, ВШГЗ.
  // 821/824 — тарифные ветки Системы Госзаказ.
  const allowedSources = {
    '265': true,
    '266': true,
    '350': true,
    '1005': true,
    '1223': true,

    '729': true,
    '733': true,
    '737': true,
    '818': true,
    '821': true,
    '824': true,
    '1213': true
  };

  // 728 — общий технический источник нескольких закупочных потоков.
  // Из него берём только наши ГЗРУ / ГЗВИО / ФАС, но не соседние продукты.
  const allowedShared728 =
    sourceId === '728' &&
    /(?:gzru|gzvio|(?:^|[_-])vio(?:[_-]|$)|fas)/i.test(normalizedCampaign);

  if (!allowedSources[sourceId] && !allowedShared728) return false;

  // NEWS берём только две канонические редакционные рассылки.
  if (canonicalNewsCampaign_(normalizedCampaign)) return true;

  // Сырое API-хранилище держим шире, чем витрину сервиса:
  // точный состав вкладки «Письма» определяется не названием кампании,
  // а совпадением Campaign со «Статистикой по ДЕМО».
  if (/\|\s*demo\s*\|/i.test(name)) return true;

  // Из trigger/triger забираем только portal-цепочки.
  // Обычные триггеры больше не нужны ни в отчёте, ни в новых API-обновлениях.
  const isTrigger = /trigg?er/i.test(text);
  if (isTrigger) return /portal/i.test(text);

  // Portal без явной метки trigger оставляем как рабочую portal-цепочку.
  if (/portal[_-]|[_-]portal|learn-portal/i.test(text)) return true;

  return false;
}

function buildSendsayApiIndex_(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  const headers = headerMap_(values[0] || SENDSAY_HEADERS);
  const fileIdCol = indexOfHeader_(headers, ['file id']);
  const campaignIdCol = indexOfHeader_(headers, ['campaign id']);
  const statusCol = indexOfHeader_(headers, ['статус']);

  const index = {
    byFileId: {},
    byCampaignId: {}
  };

  for (let i = 1; i < values.length; i++) {
    const fileId = String(valueAt_(values[i], fileIdCol) || '').trim();
    const campaignId = String(valueAt_(values[i], campaignIdCol) || '').trim();
    const status = String(valueAt_(values[i], statusCol) || '').trim();
    const rowNumber = i + 1;

    if (fileId) index.byFileId[fileId] = rowNumber;

    if (campaignId) {
      if (!index.byCampaignId[campaignId] || status === 'Готово') {
        index.byCampaignId[campaignId] = rowNumber;
      }
    }
  }

  return index;
}

function upsertSendsayApiReport_(sheet, index, report) {
  const row = [
    report.fileId,
    report.fileName,
    report.format,
    report.modified,
    report.importedAt,
    report.parserVersion,
    'Готово',
    '',
    report.campaignId,
    report.date,
    report.time,
    report.type,
    report.product,
    report.flow,
    report.segment,
    report.campaign,
    report.sendsay,
    report.subject,
    report.sent,
    report.delivered,
    report.deliveredRate,
    report.uniqueOpened,
    report.openRate,
    report.uniqueClicked,
    report.clickRate,
    report.ctor,
    report.unsubscribed,
    report.utor
  ];

  let rowNumber =
    index.byFileId[report.fileId] ||
    index.byCampaignId[report.campaignId] ||
    0;

  if (!rowNumber) {
    rowNumber = sheet.getLastRow() + 1;
  }

  // Only overwrite the factual Sendsay columns.
  // DEMO matching columns 29-35 stay intact until syncDemoStats() refreshes them.
  sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);

  index.byFileId[report.fileId] = rowNumber;
  index.byCampaignId[report.campaignId] = rowNumber;
}

function ensureBackfillTrigger_() {
  const exists = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === SENDSAY_API.backfillTriggerHandler;
  });

  if (exists) return;

  ScriptApp.newTrigger(SENDSAY_API.backfillTriggerHandler)
    .timeBased()
    .everyMinutes(5)
    .create();
}

function deleteTriggersByHandler_(handler) {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function endOfMonthIso_(isoDate) {
  const parts = String(isoDate).split('-').map(Number);
  const next = new Date(Date.UTC(parts[0], parts[1], 1));
  next.setUTCDate(0);
  return Utilities.formatDate(next, 'UTC', 'yyyy-MM-dd');
}

function shiftIsoDate_(isoDate, days) {
  const parts = String(isoDate).split('-').map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return Utilities.formatDate(date, 'UTC', 'yyyy-MM-dd');
}

function minIsoDate_(a, b) {
  return String(a) <= String(b) ? String(a) : String(b);
}
