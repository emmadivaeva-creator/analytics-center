const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('domain-auth.js','utf8');
async function setup(clientId='client'){
 const nodes={authGate:{isConnected:true,hidden:false},signIn:{},authStatus:{}};let onLoad,options,fetches=0;
 const window={ANALYTICS_DOMAIN_CONFIG:{clientId,scriptId:'script',scopes:['scope']},addEventListener:(name,fn)=>{onLoad=fn;}};
 const google={accounts:{oauth2:{initTokenClient:o=>{options=o;return{requestAccessToken(){}};},hasGrantedAllScopes:()=>true}}};window.google=google;
 const ctx={window,google,document:{getElementById:id=>nodes[id],body:{append(){}},head:{append(){}},createElement:()=>({})},fetch:async()=>{fetches++;return{ok:true,status:200,json:async()=>({done:true,response:{result:{ok:true}}})};},Date,Set,Error,JSON,Number,Math,encodeURIComponent};
 vm.runInNewContext(source,ctx);onLoad();return{window,nodes,options,ctx,count:()=>fetches};
}
(async()=>{
 let t=await setup('');assert(t.nodes.signIn.disabled);assert.match(t.nodes.authStatus.textContent,/готовится/);
 t=await setup();await assert.rejects(t.window.analyticsRpc('getPulseDataFresh'),/вход/);assert.equal(t.count(),0);
 await t.options.callback({access_token:'test-only',expires_in:3600});assert.equal(t.count(),1);assert(t.nodes.authGate.hidden);
 assert.equal((await t.window.analyticsRpc('getPulseDataFresh')).ok,true);
 await assert.rejects(t.window.analyticsRpc('saveCallsOpenAIKey','never-send'),/недоступен/);assert.equal(t.count(),2);
 t.ctx.fetch=async()=>({status:401});await assert.rejects(t.window.analyticsRpc('getPulseDataFresh'),/завершился/);assert(!t.nodes.authGate.hidden);
 assert(!/localStorage|sessionStorage/.test(source));console.log('PASS: unconfigured login, no unauthenticated calls, allowed methods, expiry gate, memory-only token');
})().catch(e=>{console.error(e);process.exit(1);});
