const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');new vm.Script(source);
const ctx=vm.createContext({XLSX:require('../vendor/xlsx.full.min.js')});
for(const name of ['isNewsMail','mailDate','normHead','detectHeaders','getVal','parseSheet']){const line=source.split('\n').find(l=>l.trim().startsWith('function '+name+'('));assert(line,name);vm.runInContext(line,ctx);}
assert(ctx.isNewsMail({campaign:'Gosfinansi_letter_news_GF_digest_u'}));
assert(ctx.isNewsMail({campaign:'letter_news_goszakaz_regular_news_digest_v'}));
assert(!ctx.isNewsMail({campaign:'other_digest_news'}));
const sorted=[{date:'2026-09-16',time:'15:00'},{date:'2026-09-17',time:'9:00'},{date:'2026-09-17',time:'13:00'}].sort((a,b)=>ctx.mailDate(b).localeCompare(ctx.mailDate(a)));
assert.equal(sorted[0].time,'13:00');assert.equal(sorted[2].date,'2026-09-16');
const sheet=ctx.XLSX.utils.aoa_to_sheet([['Номер действия','sl_api_nr','Анализ - Расшифровка звонков','Кол-во продаж'],['123','456','Клиент: нужен образец документа',1]]);
const parsed=ctx.parseSheet(sheet);assert.equal(parsed.records.length,1);assert.equal(parsed.records[0].transcript,'Клиент: нужен образец документа');assert.equal(parsed.records[0].sale,true);
const s=fs.readFileSync('DashboardTabs.gs','utf8');new vm.Script(s);
assert(!source.includes('data-page=\\"demo\\"'));
console.log('PASS: strict NEWS, newest-first ordering, XLSX import mapping, source syntax, removed tab');
const server=vm.createContext({Session:{getActiveUser:()=>({getEmail:()=> 'owner@example.com'}),getEffectiveUser:()=>({getEmail:()=> 'owner@example.com'})},APP:{sendsaySheet:'data'},openStorage_:()=>({getSheetByName:()=>({getDataRange:()=>({getDisplayValues:()=>[['File ID','Доставлено','Уник. открытия','Уник. клики'],['a','10000','99','19']]})})}),readImportedEmails_:()=>[{id:'import-a'}],number_:Number,round_:(v,d)=>Math.round(v*10**d)/10**d});vm.runInContext(s,server);const rates=server.getMailRegistryUi().emails[0];assert.equal(rates.openRate,.99);assert.equal(rates.clickRate,.19);console.log('PASS: sub-one-percent rates are not multiplied by 100');
