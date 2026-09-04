/**
 * Безопасная первая стадия ручной загрузки Sendsay.
 *
 * Важно: эта функция ТОЛЬКО сохраняет файл в подключённую папку Drive.
 * Разбор выполняется затем единым маршрутом syncDriveReports(), поэтому
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
