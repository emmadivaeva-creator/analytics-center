/**
 * Safe compatibility helpers for the Sendsay API migration.
 * Read-only checks only. No backfill, no triggers.
 */

function migrationCheckSendsayApiV2() {
  const props = PropertiesService.getScriptProperties();
  const missing = [];

  ['SENDSAY_API_KEY','SENDSAY_ACCOUNT','ANALYTICS_STORAGE_SHEET_ID'].forEach(function(key) {
    if (!String(props.getProperty(key) || '').trim()) missing.push(key);
  });

  const functions = {
    canonicalNewsCampaign_: typeof canonicalNewsCampaign_ === 'function',
    classifyCampaign_: typeof classifyCampaign_ === 'function',
    demoCampaignLookupKey_: typeof demoCampaignLookupKey_ === 'function',
    readImportedEmails_: typeof readImportedEmails_ === 'function',
    dashboardMatchMails_: typeof dashboardMatchMails_ === 'function',
    getMailRegistryUi: typeof getMailRegistryUi === 'function',
    syncDemoStats: typeof syncDemoStats === 'function',
    syncSendsayApiLast3Days: typeof syncSendsayApiLast3Days === 'function'
  };

  const missingFunctions = Object.keys(functions).filter(function(name) {
    return !functions[name];
  });

  let storageRows = null;
  if (!missing.includes('ANALYTICS_STORAGE_SHEET_ID')) {
    const storage = openStorage_();
    const sheet = ensureSendsaySheet_(storage);
    storageRows = Math.max(0, sheet.getLastRow() - 1);
  }

  const result = {
    ok: missing.length === 0 && missingFunctions.length === 0,
    missingProperties: missing,
    missingFunctions: missingFunctions,
    storageRows: storageRows,
    checkedAt: new Date().toISOString()
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}


function testSendsayMaterialSourceV2() {
  const policy='52';
  const issueId='26541039';
  const data=sendsayApiRequest_({
    action:'issue.get',
    id:issueId,
    source:0,
    with_name:1
  },policy);

  const chunks=[];
  (function walk(value,depth){
    if(depth>10||value==null)return;
    if(typeof value==='string'){
      if(value.length>=40&&(/<html|<body|<a\b|href\s*=|https?:\/\//i.test(value)||/content-type:\s*text\/html/i.test(value)))chunks.push(value);
      return;
    }
    if(Array.isArray(value)){value.forEach(function(item){walk(item,depth+1);});return;}
    if(typeof value==='object')Object.keys(value).forEach(function(key){walk(value[key],depth+1);});
  })(data,0);

  chunks.sort(function(a,b){return b.length-a.length;});
  const raw=chunks.join('\n');
  const materials=dashboardMaterials_(raw);

  const result={
    ok:raw.length>0,
    issueId:issueId,
    sourceChars:raw.length,
    materialCount:materials.length,
    materials:materials.slice(0,10)
  };

  console.log(JSON.stringify(result,null,2));
  return result;
}
