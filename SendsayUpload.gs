/**
 * Первая стадия ручной загрузки Sendsay.
 * Функция только сохраняет файл в подключённую папку Drive.
 * Разбор выполняется единым маршрутом синхронизации.
 * Искусственного лимита размера файла здесь нет: действуют только ограничения Google Apps Script.
 */
function saveSendsayReportFile(formObject) {
  assertAdmin_();

  const blob = formObject && formObject.reportFile;
  if (!blob || typeof blob.getBytes !== 'function') {
    throw new Error('Не удалось получить файл отчёта.');
  }

  const name = safeFileName_(blob.getName());
  if (!isSupportedReportName_(name)) {
    throw new Error('Поддерживаются .webarchive, .mhtml и .mht.');
  }

  const bytes = blob.getBytes();
  if (!bytes.length) throw new Error('Файл «' + name + '» пустой.');

  const folder = reportsFolder_();
  const mime = /\.webarchive$/i.test(name)
    ? 'application/x-webarchive'
    : 'multipart/related';

  const file = folder.createFile(Utilities.newBlob(bytes, mime, name));
  clearCache_();

  return {
    ok: true,
    fileId: file.getId(),
    fileName: file.getName(),
    folderId: folder.getId(),
    savedAt: new Date().toISOString()
  };
}

/**
 * Надёжная порционная синхронизация. Клиент вызывает её столько раз,
 * сколько нужно, пока remaining не станет 0. Общего лимита по числу файлов нет.
 */
function syncDriveReportsReliable(firstPass) {
  assertAdmin_();

  if (firstPass === true) {
    prepareCanonicalReparseOnce_();
    prepareFailedSendsayRowsForRetry_();
  }

  return syncDriveReports();
}

/**
 * После изменения канонических правил один раз заставляет перечитать весь архив.
 * Это нужно, чтобы уже сохранённые строки получили новую классификацию NEWS/DEMO.
 */
function prepareCanonicalReparseOnce_() {
  const props = PropertiesService.getScriptProperties();
  const version = '2026-09-04-canonical-news-v1';
  const key = 'ANALYTICS_CANONICAL_RULES_VERSION';
  if (props.getProperty(key) === version) return 0;

  const storage = openStorage_();
  const sheet = ensureSendsaySheet_(storage);
  if (sheet.getLastRow() < 2) {
    props.setProperty(key, version);
    return 0;
  }

  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(value => String(value || '').trim().toLowerCase());
  const parserCol = headers.indexOf('parser version');
  const statusCol = headers.indexOf('статус');
  if (parserCol < 0) return 0;

  const output = [];
  let changed = 0;
  for (let i = 1; i < values.length; i++) {
    const status = statusCol >= 0 ? String(values[i][statusCol] || '') : '';
    if (status === 'Удалено') {
      output.push([values[i][parserCol]]);
    } else {
      output.push(['']);
      changed++;
    }
  }

  if (changed) {
    sheet.getRange(2, parserCol + 1, output.length, 1).setValues(output);
    SpreadsheetApp.flush();
  }
  props.setProperty(key, version);
  return changed;
}

function prepareFailedSendsayRowsForRetry_() {
  const storage = openStorage_();
  const sheet = ensureSendsaySheet_(storage);
  if (sheet.getLastRow() < 2) return 0;

  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(value => String(value || '').trim().toLowerCase());
  const statusCol = headers.indexOf('статус');
  const parserCol = headers.indexOf('parser version');
  if (statusCol < 0 || parserCol < 0) return 0;

  const output = [];
  let changed = 0;

  for (let i = 1; i < values.length; i++) {
    const status = String(values[i][statusCol] || '').trim().toLowerCase();
    const parserVersion = values[i][parserCol];
    if (status === 'ошибка') {
      output.push(['']);
      changed++;
    } else {
      output.push([parserVersion]);
    }
  }

  if (changed) {
    sheet.getRange(2, parserCol + 1, output.length, 1).setValues(output);
    SpreadsheetApp.flush();
  }

  return changed;
}
