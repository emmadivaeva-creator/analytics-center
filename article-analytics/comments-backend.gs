const SHEET_ID = '1SyU8kprgqbcR1vOPhhYwF3FjVM3IBQkfeiqdCN_1-5A';
const SHEET_NAME = 'Комментарии';

function doGet(e) {
  const data = listNotes_();
  const callback = String((e && e.parameter && e.parameter.callback) || '');
  const body = callback ? callback + '(' + JSON.stringify(data) + ')' : JSON.stringify(data);
  return ContentService.createTextOutput(body)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function doPost(e) {
  const p = (e && e.parameter) || {};
  if (String(p.action || '') === 'save') saveNote_(p);
  return ContentService.createTextOutput(JSON.stringify({ok:true}))
    .setMimeType(ContentService.MimeType.JSON);
}

function listNotes_() {
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const values = sh.getDataRange().getDisplayValues();
  const items = values.slice(1).filter(r => r[0] && r[1]).map(r => ({
    site:r[0], id:r[1], title:r[2], status:r[3], comment:r[4], author:r[5], updatedAt:r[6]
  }));
  return {ok:true, items:items};
}

function saveNote_(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const site = String(p.site || '').trim();
    const id = String(p.id || '').trim();
    if (!site || !id) throw new Error('Не указан сайт или ID статьи');
    const title = String(p.title || '').trim();
    const status = String(p.status || 'Не разобрано').trim();
    const comment = String(p.comment || '').trim();
    const author = String(p.author || 'Без имени').trim();
    const lastRow = Math.max(sh.getLastRow(), 1);
    const keys = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, 2).getDisplayValues() : [];
    let row = 0;
    for (let i = 0; i < keys.length; i++) {
      if (keys[i][0] === site && keys[i][1] === id) { row = i + 2; break; }
    }
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Europe/Moscow', 'dd.MM.yyyy HH:mm');
    const vals = [[site,id,title,status,comment,author,stamp]];
    if (row) sh.getRange(row,1,1,7).setValues(vals);
    else sh.getRange(lastRow + 1,1,1,7).setValues(vals);
  } finally {
    lock.releaseLock();
  }
}
