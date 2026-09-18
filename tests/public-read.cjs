const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let called=0;const ctx={ContentService:{MimeType:{JSON:'json',JAVASCRIPT:'js',TEXT:'text'},createTextOutput:text=>({text,setMimeType(type){this.type=type;return this}})}};
for(const method of ['v2HealthCheck','getPulseDataFresh','getMailRegistryUi','getMailDemoDetailsUi','getVikaPlanUi','getVikaEditorialUi'])ctx[method]=()=>{called++;return{sample:true}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('PublicRead.gs','utf8'),ctx);
for(const method of ['syncDemoStats','syncDriveReportsReliable','getCallsDataUi','saveCallsOpenAIKey','constructor','__proto__','toString']){const r=ctx.publicDashboardRead_({parameter:{method}});assert.equal(JSON.parse(r.text).ok,false);}
assert.equal(called,0);assert.equal(ctx.PUBLIC_DASHBOARD_READ_,false);
let r=ctx.publicDashboardRead_({parameter:{method:'getVikaPlanUi',args:'[123]',callback:'analyticsJsonp_1'}});assert.equal(r.type,'js');assert.match(r.text,/sample/);assert.equal(called,1);assert.equal(ctx.PUBLIC_DASHBOARD_READ_,false);
r=ctx.publicDashboardRead_({parameter:{method:'getVikaPlanUi',callback:'alert(1)//'}});assert.equal(r.type,'text');assert.equal(called,1);
ctx.getVikaPlanUi=()=>{throw Error('failed')};ctx.publicDashboardRead_({parameter:{method:'getVikaPlanUi'}});assert.equal(ctx.PUBLIC_DASHBOARD_READ_,false);
console.log('PASS: writes and calls denied, prototype names denied, callback validated, public context cleared after failures');
