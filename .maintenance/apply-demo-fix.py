from pathlib import Path
import hashlib,re
root=Path('.')
p=root/'app.js';raw=p.read_bytes();s=raw.decode('utf-8')
assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()=='cf9835f3dff5966a02c70f0e61a489f13be0ba3b','Unexpected production app revision'
def replace(old,new):
    global s
    assert old in s,'Missing patch anchor: '+old[:80]
    s=s.replace(old,new,1)
replace('let registryCacheTimer=null;','let registryCacheTimer=null;\n\n'+Path('.maintenance/mail-demo-functions.js').read_text())
replace(' populateMailWeeks_();\n renderRegistries();',' populateMailWeeks_();\n renderRegistries();\n scheduleMailDemoCheck_();')
old=" const products=[...map.values()].sort((a,b)=>a.product.localeCompare(b.product,'ru'));"
replace(old," map.forEach(r=>{const t=mailDemoTotals_(logical.filter(m=>String(m.product||'Не указано')===r.product));r.red=t.red;r.yellow=t.yellow;r.green=t.green;r.demoChecked=t.checked;r.demoUnmatched=t.unmatched;});\n"+old)
replace("<td><b class=\"demo-r\">'+fmt(r.red)+'</b> / <b class=\"demo-y\">'+fmt(r.yellow)+'</b> / <b class=\"demo-g\">'+fmt(r.green)+'</b></td>","<td>'+(!r.demoChecked?'DEMO не проверены':'<b class=\"demo-r\">'+fmt(r.red)+'</b> / <b class=\"demo-y\">'+fmt(r.yellow)+'</b> / <b class=\"demo-g\">'+fmt(r.green)+'</b><small>Без точной связи: '+fmt(r.demoUnmatched)+'</small>')+'</td>")
replace('Справа — DEMO: красные / жёлтые / зелёные за ту же неделю.','Справа — подтверждённые DEMO по Campaign с недели отправки, включая дозревание. Повторы факта не суммируются.')
replace('   group.red=red;group.yellow=yellow;group.green=green;',"   const demo=mailDemoTotals_(members);\n   group.red=demo.red;group.yellow=demo.yellow;group.green=demo.green;\n   group.demoEvidence=demo.evidence;\n   group.demoVerifiedBuild=members.every(m=>m.demoVerifiedBuild===MAIL_DEMO_BUILD_)?MAIL_DEMO_BUILD_:'';")
replace('   group.potential=yellow+green;\n   group.hasDemoData=members.some(item=>item.hasDemoData===true);','   group.potential=demo.yellow+demo.green;\n   group.hasDemoData=demo.evidence.length>0;')
replace('isNewsMail(x)?materialSummary(x):x.hasDemoData===true?`R ${fmt(x.red)} / Y ${fmt(x.yellow)} / G ${fmt(x.green)}`:`R 0 / Y 0 / G 0<small>В статистике DEMO событий нет</small>`','isNewsMail(x)?materialSummary(x):mailDirectDemoHtml_(x)')
start=s.index('async function loadMaterialDemo(button){');end=s.index("for(const key of ['mail','news']){",start)
s=s[:start]+Path('.maintenance/material-function.js').read_text()+s[end:]
p.write_text(s)
for name in ['index.html','domain-auth.js']:
    p=root/name;text=p.read_text();text,n=re.subn(r'20261016-mail-render-\d+|20261015-startup-01','20261016-demo-match-01',text)
    assert n==1,'Unexpected cache anchors in '+name
    p.write_text(text)
print('Assembled frontend repair; server files and source data unchanged.')
