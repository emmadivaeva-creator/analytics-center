from pathlib import Path
p=Path('app.js')
s=p.read_text()
old="""async function preloadMailBodyPreviews_(rows,onProgress,maxCount){
 const source=(rows||[]).filter(item=>item&&!isNewsMail(item));"""
new="""async function preloadMailBodyPreviews_(rows,onProgress,maxCount,includeNews=false){
 const source=(rows||[]).filter(item=>item&&(includeNews||!isNewsMail(item)));"""
assert old in s
s=s.replace(old,new,1)

anchor="""let registryCacheTimer=null;

// Verified direct DEMO facts are refreshed separately from the Sendsay archive."""
insert="""let registryCacheTimer=null;
let newsBodyPreloadTimer=null,newsBodyPreloadPromise=null;
function scheduleNewsBodyPreload_(){
 clearTimeout(newsBodyPreloadTimer);
 newsBodyPreloadTimer=setTimeout(()=>preloadLatestNewsBodies_(),100);
}
async function preloadLatestNewsBodies_(){
 if(newsBodyPreloadPromise||!registryData)return newsBodyPreloadPromise;
 const news=(registryData||[]).filter(isNewsMail);
 const latestWeek=Math.max(0,...news.map(mailWeek_).filter(Boolean));
 const rows=latestWeek?news.filter(item=>mailWeek_(item)===latestWeek):news.slice(0,80);
 if(!rows.length)return null;
 const status=document.getElementById('newsStatus');
 newsBodyPreloadPromise=preloadMailBodyPreviews_(rows,progress=>{
   if(status)status.textContent='Загружаю тексты новостей… '+progress.done+'/'+progress.total;
 },80,true).finally(()=>{newsBodyPreloadPromise=null;});
 return newsBodyPreloadPromise;
}

// Verified direct DEMO facts are refreshed separately from the Sendsay archive."""
assert anchor in s
s=s.replace(anchor,insert,1)

anchor2=""" populateMailWeeks_();
 renderRegistries();
 scheduleMailDemoCheck_();
}"""
insert2=""" populateMailWeeks_();
 renderRegistries();
 scheduleMailDemoCheck_();
 scheduleNewsBodyPreload_();
}"""
assert anchor2 in s
s=s.replace(anchor2,insert2,1)

p.write_text(s)

t=Path('tests/news-preview.cjs')
x=t.read_text()
x=x.replace("let holdBody=true,rejectBody=true,releaseBody;","let holdBody=true,rejectBody=true,releaseBody;")
x=x.replace("if(args[0]==='52:90000'&&holdBody)await bodyGate;","if(args[0]==='52:90080'&&holdBody)await bodyGate;")
x=x.replace("  assert.equal(bodyReads(),0,'News bodies must not load before opening');\n  await page.locator('#newsSearch').fill('Дайджест 90000');","  await page.waitForFunction(()=>document.querySelector('#newsRows .mail-body-preview[data-body-ref=\"52:90000\"]')?.dataset.loaded==='1');\n  assert.equal(bodyReads('52:90000'),1,'Latest news text is preloaded during the registry pass');\n  await page.locator('#newsSearch').fill('Дайджест 90000');\n  let preview=page.locator('#newsRows .mail-body-preview');\n  await preview.locator('summary').click();\n  await page.locator('#newsRows .mail-body-preview[data-loaded=\"1\"]').waitFor();\n  assert.equal(bodyReads('52:90000'),1,'Opening a preloaded news item does not wait for another request');\n  await preview.locator('summary').click();\n  await page.locator('#newsSearch').fill('Дайджест 90080');")
x=x.replace("  let preview=page.locator('#newsRows .mail-body-preview');\n  assert.equal(await page.locator('#newsRows a[href=\"https://example.test/sendsay/90000\"]').count(),1);","  preview=page.locator('#newsRows .mail-body-preview');\n  assert.equal(await page.locator('#newsRows a[href=\"https://example.test/sendsay/90080\"]').count(),1);")
x=x.replace("  await page.waitForTimeout(150);assert.equal(bodyReads('52:90000'),1);","  await page.waitForTimeout(150);assert.equal(bodyReads('52:90080'),1);")
x=x.replace("  assert.equal(bodyReads('52:90000'),1,'Reopening uses cached text');","  assert.equal(bodyReads('52:90080'),1,'Reopening uses cached text');")
x=x.replace("  await page.locator('#newsSearch').fill('Дайджест 90000');\n  const countBeforeReload=bodyReads('52:90000'),registryReads=","  await page.locator('#newsSearch').fill('Дайджест 90000');\n  const countBeforeReload=bodyReads('52:90000'),registryReads=")
x=x.replace("  reports.push({engine,ok:true,newsRows:106,tests:['lazy body read'","  reports.push({engine,ok:true,newsRows:106,tests:['latest-news body preload','preloaded open without wait','lazy fallback body read'")
t.write_text(x)
