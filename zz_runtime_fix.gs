/**
 * Runtime fixes for Analytics Center.
 * 1) Makes owner/admin detection work in Apps Script web apps where ActiveUser is blank.
 * 2) Makes Sendsay uploads self-sufficient: an internal Drive folder is created automatically.
 * 3) Makes large call imports safe for 10k+ rows and long transcripts.
 */

// Apps Script web apps executed as the deployer may return an empty ActiveUser.
// In that case EffectiveUser is the correct owner identity for this private dashboard.
canAdmin_ = function() {
  const props = PropertiesService.getScriptProperties();
  const admin = String(props.getProperty(APP.adminProperty) || '').toLowerCase();
  const active = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  const effective = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  const viewer = active || effective;
  if (!admin && effective) {
    props.setProperty(APP.adminProperty, effective);
    return true;
  }
  return Boolean(admin && viewer && admin === viewer);
};

// Uploading a report from the site must not depend on the user manually connecting a folder first.
// If the configured folder is missing, create a private technical folder automatically.
reportsFolder_ = function() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty(APP.reportsFolderProperty);
  if (existingId) {
    try {
      return DriveApp.getFolderById(existingId);
    } catch (e) {
      props.deleteProperty(APP.reportsFolderProperty);
    }
  }

  const name = 'Analytics Center — Sendsay uploads';
  const folders = DriveApp.getFoldersByName(name);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
  props.setProperty(APP.reportsFolderProperty, folder.getId());
  clearCache_();
  return folder;
};

// Large call files exceed the default 1000-row sheet grid. Grow it before every batch.
function ensureCallsCapacity_(storage, incomingRows) {
  callsEnsureSheets_(storage);
  const sheet = storage.getSheetByName(CALLS_CFG.rawSheet);
  const needRows = Math.max(2, sheet.getLastRow() + Math.max(0, Number(incomingRows || 0)) + 25);
  if (sheet.getMaxRows() < needRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), needRows - sheet.getMaxRows());
  }
  return sheet;
}

// Keep transcripts under the Google Sheets single-cell limit.
const callsNormalizeRecordRuntimeBase_ = callsNormalizeRecord_;
callsNormalizeRecord_ = function(raw, sourceFile, batchId) {
  const record = callsNormalizeRecordRuntimeBase_(raw, sourceFile, batchId);
  if (record.transcript && record.transcript.length > 45000) {
    record.transcript = record.transcript.slice(0, 45000) + '\n[Расшифровка обрезана при импорте: превышен лимит ячейки Google Sheets]';
    record.fingerprint = callsFingerprint_(record);
  }
  return record;
};

const importCallsBatchRuntimeBase_ = importCallsBatch;
importCallsBatch = function(payload) {
  const storage = openStorage_();
  const rows = Array.isArray(payload && payload.records) ? payload.records : [];
  ensureCallsCapacity_(storage, rows.length);
  return importCallsBatchRuntimeBase_(payload);
};

// Lightweight diagnostic used by the UI / manual checks.
function getAnalyticsRuntimeStatus() {
  const storage = openStorage_();
  callsEnsureSheets_(storage);
  const callsSheet = storage.getSheetByName(CALLS_CFG.rawSheet);
  const folder = reportsFolder_();
  return {
    ok: true,
    canImport: canAdmin_(),
    sendsayFolderName: folder.getName(),
    sendsayFolderId: folder.getId(),
    callsRows: Math.max(0, callsSheet.getLastRow() - 1),
    callsCapacity: callsSheet.getMaxRows(),
    storageUrl: storage.getUrl()
  };
}
