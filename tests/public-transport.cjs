const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('domain-auth.js', 'utf8');
function setup(responses) {
  const calls = [];
  const nodes = {authGate:{isConnected:true,hidden:true},signIn:{},authStatus:{}};
  const window = {ANALYTICS_DOMAIN_CONFIG:{publicReadUrl:'https://example.com/exec'},addEventListener(){}};
  const ctx = {window,document:{getElementById:id=>nodes[id]},URL,AbortController,Set,Error,JSON,
    setTimeout:(fn,ms)=>ms<120000?setTimeout(fn,0):0,clearTimeout,
    fetch:async(url,options)=>{calls.push({url,options});const result=responses.shift();if(result instanceof Error)throw result;return result;}};
  vm.runInNewContext(source,ctx);
  return {rpc:window.analyticsRpc,calls,nodes};
}
const reply = (data,status=200)=>({ok:status===200,status,json:async()=>data});
(async()=>{
  let t=setup([new TypeError('network'),reply({ok:true,result:{rows:[1]}})]);
  assert.equal((await t.rpc('getMailRegistryUi')).rows.length,1);
  assert.equal(t.calls.length,2);
  for(const c of t.calls){assert.equal(c.options.credentials,'omit');assert.equal(c.options.method,'GET');assert(!new URL(c.url).searchParams.has('callback'));}
  t=setup([reply({ok:false,error:'Источник недоступен'})]);
  await assert.rejects(t.rpc('getPulseDataFresh'),/Источник недоступен/);assert.equal(t.calls.length,1);
  t=setup([reply({},503),reply({},429),reply({ok:true,result:42})]);assert.equal(await t.rpc('v2HealthCheck'),42);
  t=setup([new TypeError('network'),new TypeError('network'),new TypeError('network')]);
  await assert.rejects(t.rpc('v2HealthCheck'),/Проверить сервер/);assert.equal(t.calls.length,3);
  t=setup([]);await assert.rejects(t.rpc('syncDemoStats'),/вход/);assert.equal(t.calls.length,0);
  console.log('PASS: anonymous fetch, bounded read retries, application errors, owner-only writes');
})().catch(e=>{console.error(e);process.exit(1)});
