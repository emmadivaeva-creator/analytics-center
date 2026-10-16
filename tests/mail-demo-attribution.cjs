'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
new vm.Script(app);
const start=app.indexOf('// Verified direct DEMO facts');
const end=app.indexOf('function isNewsMail',start);
assert(start>=0&&end>start);
const helpers=app.slice(start,end);
const context=vm.createContext({console,Map,Set,Date,Number,JSON,Boolean,String,Error,setTimeout,clearTimeout});
vm.runInContext(`
 const n=x=>Number(x)||0;
 const fmt=x=>String(n(x));
 const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safeLink=(u,l)=>/^https?:\\/\\//i.test(String(u||''))?'<a href="'+esc(u)+'">'+esc(l)+'</a>':'';
 const isNewsMail=m=>m.type==='news';
 const mailWeek_=m=>m.week;
 let registryData=[],saved=0;
 function scheduleRegistryCacheSave_(){saved++;}
 `+helpers,context);
function run(code){return vm.runInContext(code,context);}
run(`
 var mail=(id,product='ГФ Система',week=42)=>({id:'import-api:52:'+id,product,week,type:'demo',campaign:'test_campaign',red:999,yellow:999,green:999});
 var rows=[mail(1),mail(2),mail(3,'ГЗ Система'),mail(4),{id:'news',type:'news',green:77}];
 var payload={ok:true,readAt:'2026-10-16T09:00:00Z',evidence:[{
 product:'ГФ Система',factCampaign:'test_campaign',demoSource:'Synthetic source',demoSourceUrl:'https://example.test/source#A5',
 weeks:[{week:41,red:100,yellow:100,green:100},{week:42,red:2,yellow:1,green:3},{week:43,red:1,yellow:2,green:1}],
 sendings:[{id:'api:52:1'},{id:'api:52:2'},{id:'api:52:2'},{id:'api:52:3'}]
 }]};
 var result=applyMailDemoEvidence_(rows,payload);
 var totals=mailDemoTotals_(rows);
 `);
const json=code=>JSON.parse(run('JSON.stringify('+code+')'));
assert.deepEqual(json('[rows[0].red,rows[0].yellow,rows[0].green]'),[3,3,4]);
assert.deepEqual(json('[rows[1].red,rows[1].yellow,rows[1].green]'),[3,3,4]);
assert.equal(run('rows[2].hasDemoData'),false,'Do not match another product');
assert.equal(run('rows[3].hasDemoData'),false);
assert.equal(run('rows[4].green'),77,'Do not modify NEWS attribution');
assert.deepEqual(json('[totals.red,totals.yellow,totals.green]'),[3,3,4],'Shared fact counted once');
assert.match(run('mailDirectDemoHtml_(rows[3])'),/Нет точного сопоставления/);
assert.match(run('mailDirectDemoHtml_(mail(10))'),/ожидают проверки/);
const before=run('JSON.stringify(rows)');
assert.throws(()=>run('applyMailDemoEvidence_(rows,{ok:true,evidence:[{}]})'),/Неполная/);
assert.equal(run('JSON.stringify(rows)'),before);
assert.throws(()=>run('applyMailDemoEvidence_(rows,{ok:false,evidence:[]})'),/не вернул/);
assert.equal(run('JSON.stringify(rows)'),before);
assert.throws(()=>run("applyMailDemoEvidence_(rows,{ok:true,evidence:[{product:'ГФ Система',factCampaign:'x',sendings:[],weeks:[{week:42,red:-1,yellow:0,green:0}]}]})"),/некорректное число/);
assert.equal(run('JSON.stringify(rows)'),before);
assert.deepEqual(json("mailMaterialIds_('logical:import-api:52:1,import-api:52:2,import-api:52:1')"),['import-api:52:1','import-api:52:2']);
const materialStart=app.indexOf('async function loadMaterialDemo(button){');
const materialEnd=app.indexOf("for(const key of ['mail','news']){",materialStart);
vm.runInContext(app.slice(materialStart,materialEnd),context);
run(`
 var calls=[],failSecond=false;
 async function rpc(method,id){
  calls.push({method,id});
  if(method!=='getMailDemoDetailsUi'||id.startsWith('logical:'))throw new Error('Unexpected test request');
  if(failSecond&&id.endsWith(':2'))throw new Error('Synthetic read failure');
  return {materials:[{id:'55',kind:'art',domain:'example.test',url:'https://example.test/art/55'}],rows:[{
   sourceUrl:'https://example.test/source#A9',source:'Synthetic source',product:'ГФ Система',content:'art',term:'55',url:'https://example.test/art/55',values:{red:1,yellow:2,green:3}
  }]};
 }
 var box={textContent:'',innerHTML:''};
 var button={disabled:false,dataset:{mailId:'logical:import-api:52:1,import-api:52:2'},nextElementSibling:box};
 registryData=rows;
 `);
(async()=>{
 await run('loadMaterialDemo(button)');
 assert.deepEqual(json('calls.map(x=>x.id)'),['import-api:52:1','import-api:52:2']);
 assert.match(run('box.innerHTML'),/Совпадений Content \/ Term: 1/);
 assert.match(run('box.innerHTML'),/не прямой результат письма/);
 assert.equal(run('button.disabled'),false);
 run('calls=[];failSecond=true;');
 await run('loadMaterialDemo(button)');
 assert.match(run('box.innerHTML'),/Результат неполный/);
 assert.match(run('box.innerHTML'),/Проверено отправок: 1 из 2/);
 assert.equal(run('button.disabled'),false);
 assert(!json('calls').some(c=>/^sync|^save|^refresh/.test(c.method)));
 assert(app.includes('scheduleMailDemoCheck_();'));
 const report={ok:true,fixture:'Synthetic data only; no service, spreadsheet or external network requests.',tests:['exact sending ID and product','exclude pre-send weeks; keep subsequent maturation','deduplicate shared facts across segments','leave NEWS unchanged','distinguish missing match from zero','atomic rejection of malformed and negative counts','split logical material ID','deduplicate material matches','show partial material failures','no source write calls']};
 fs.writeFileSync('mail-demo-unit-results.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
