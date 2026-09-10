from pathlib import Path

p = Path('app.js')
s = p.read_text(encoding='utf-8')

s = s.replace('v2-static-assets-2026-09-09-09', 'v2-full-refresh-2026-09-10-10')
s = s.replace('>Обновить факт</button>', '>Обновить всё</button>')

old = """function loadData(){
 const btn=document.getElementById('refreshBtn');btn.disabled=true;btn.textContent='Читаю источник…';
 document.getElementById('pulseError').classList.add('hidden');
 rpc('getPulseDataFresh').then(data=>{btn.disabled=false;btn.textContent='Обновить факт';appData=data;activeWeek=data.meta.currentWeek;setupWeeks();renderSelectedWeek();}).catch(err=>{btn.disabled=false;btn.textContent='Обновить факт';showError(err&&err.message?err.message:String(err));});
}
"""

new = """async function loadData(){
 const btn=document.getElementById('refreshBtn');btn.disabled=true;btn.textContent='Читаю DEMO…';
 document.getElementById('pulseError').classList.add('hidden');
 try{
   const data=await rpc('getPulseDataFresh');
   appData=data;activeWeek=data.meta.currentWeek;setupWeeks();renderSelectedWeek();
 }catch(err){showError(err&&err.message?err.message:String(err));}
 finally{btn.disabled=false;btn.textContent='Обновить всё';}
}
function showRefreshError(msg){
 const b=document.getElementById('pulseError');
 b.textContent='Не удалось обновить все данные: '+msg;
 b.classList.remove('hidden');
}
async function refreshAllData(){
 const btn=document.getElementById('refreshBtn');
 btn.disabled=true;
 document.getElementById('pulseError').classList.add('hidden');
 let first=true,totalProcessed=0;
 try{
   while(true){
     btn.textContent=first?'Проверяю Sendsay…':'Обновляю Sendsay…';
     const r=await rpc('syncDriveReportsReliable',first);
     first=false;
     totalProcessed+=n(r&&r.processed);
     const remaining=n(r&&r.remaining);
     btn.textContent='Sendsay: '+totalProcessed+' · осталось '+remaining;
     if(remaining<=0) break;
     if(n(r&&r.processed)<=0) throw new Error('Очередь Sendsay не уменьшается. Осталось файлов: '+remaining);
   }
   btn.textContent='Пересчитываю DEMO…';
   await rpc('syncDemoStats');
   btn.textContent='Пересобираю данные…';
   await rpc('refreshAppData');
   btn.textContent='Обновляю Пульс…';
   const data=await rpc('getPulseDataFresh');
   appData=data;activeWeek=data.meta.currentWeek;setupWeeks();renderSelectedWeek();
   setHealth(true,'Данные обновлены · Sendsay обработано '+totalProcessed);
 }catch(err){
   showRefreshError(err&&err.message?err.message:String(err));
   setHealth(false,'Ошибка обновления данных');
 }finally{
   btn.disabled=false;btn.textContent='Обновить всё';
 }
}
"""

if old not in s:
    raise SystemExit('loadData block not found')
s = s.replace(old, new)

old2 = "document.getElementById('refreshBtn').addEventListener('click',loadData);\ncheckServer();loadData();"
new2 = "document.getElementById('refreshBtn').addEventListener('click',refreshAllData);\ncheckServer();loadData();"
if old2 not in s:
    raise SystemExit('refresh listener not found')
s = s.replace(old2, new2)

p.write_text(s, encoding='utf-8')
