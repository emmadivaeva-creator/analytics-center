/**
 * Безопасная первая стадия ручной загрузки Sendsay.
 *
 * Важно: эта функция ТОЛЬКО сохраняет файл в подключённую папку Drive.
 * Разбор выполняется затем единым маршрутом синхронизации, поэтому
 * успешный файл и ошибка разбора обязательно попадают в _Sendsay v2.
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
  if (bytes.length > 35 * 1024 * 1024) {
    throw new Error('Файл «' + name + '» больше 35 МБ. Положите его в папку Drive и запустите синхронизацию.');
  }

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
 * Надёжная синхронизация папки.
 * На первом проходе можно разрешить повторную попытку для строк «Ошибка».
 * После повторной ошибки строка снова получает текущую parserVersion и в этом
 * же цикле бесконечно не переобрабатывается.
 */
function syncDriveReportsReliable(retryErrors) {
  assertAdmin_();

  if (retryErrors === true) {
    prepareFailedSendsayRowsForRetry_();
  }

  return syncDriveReports();
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
