'use strict';
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 const archive=await import(pathToFileURL(path.resolve(__dirname,'../.github/scripts/news-archive.mjs')).href);
 const make=(id,date)=>({id:'import-api:52:'+id,date,product:'ГФ Периодика',campaign:'Gosfinansi_letter_news_GF_digest_v_'+date,subject:'Новости '+id,sendsay:'https://app.sendsay.ru/reports/campaigns/'+id+'/summary'});
 const m1=make(111,'2026-07-27'),m2=make(222,'2026-08-03');
 const merged=archive.mergeIssues([{...m1,sent:100,delivered:90,openRate:12}], [{...m1,subject:'Повторная загрузка'},m2]);
 assert.equal(merged.length,2);
 assert.equal(merged[0].sent,100,'Newer snapshots cannot delete source Sendsay metrics');
 const url='https://www.budgetnik.ru/news/12345-abc';
 const row={product:'ГФ Периодика',url,sourceUrl:'https://sheet.local/#gid=17&range=A20',weeks:[{week:31,red:1,yellow:2,green:3}]};
 const item={url,title:'Материал',id:'12345',kind:'news'};
 const record={materials:[item],rows:[row]};
 const result=archive.buildNewsSummary({emails:[m1,m2],missingEarlyWeeks:[27,28,29,30]},{
  results:{[m1.id]:record,[m2.id]:record},failures:{}
 },'2026-11-23T15:00:00Z');
 assert.equal(result.mailsTotal,2);
 assert.equal(result.mailsChecked,2);
 assert.equal(result.pendingCount,0);
 assert.equal(result.archiveComplete,true);
 assert.equal(result.topics.length,1);
 assert.equal(result.topics[0].green,3,'A repeated material fact must not double-count');
 assert.equal(result.topics[0].letters.length,2,'The material must retain both newsletter proofs');
 assert.deepEqual(result.weeks.slice(0,4),[27,28,29,30]);
 assert.equal(result.weeklyCoverage[0].complete,false,'Missing W27 registry cannot be presented as zero demand');
 assert.equal(result.weeklyCoverage.find(w=>w.week===31).processed,1);
 console.log('NEWS_ARCHIVE_TESTS',JSON.stringify({ok:true,tests:8}));
})().catch(e=>{console.error(e);process.exitCode=1;});
