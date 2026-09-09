document.addEventListener('DOMContentLoaded',function(){
  document.body.innerHTML="<div class=\"app\">\n<aside>\n  <div class=\"brand\"><b>Analytics Center</b><span>Чистая сборка V2</span></div>\n  <nav>\n    <button class=\"navbtn active\" data-page=\"pulse\">Пульс</button>\n    <button class=\"navbtn\" data-page=\"mail\">Письма</button>\n    <button class=\"navbtn\" data-page=\"news\">Новости</button>\n    <button class=\"navbtn\" data-page=\"demo\">Дожим демо</button>\n    <button class=\"navbtn\" data-page=\"vika\">План для Вики</button>\n    <button class=\"navbtn\" data-page=\"calls\">Звонки / Что продает</button>\n    <button class=\"navbtn\" data-page=\"service\">Служебное</button>\n  </nav>\n  <div class=\"asidefoot\"><b>v2-static-assets-2026-09-09-09</b>Интерфейс живёт на GitHub Pages. Apps Script используется только как серверный мост к данным.</div>\n</aside>\n<main>\n  <div class=\"topline\">\n    <div class=\"build\"><span id=\"serverDot\" class=\"dot\"></span><span id=\"serverStatus\">Проверяем сервер…</span></div>\n    <div class=\"topactions\"><button class=\"health\" id=\"healthBtn\">Проверить сервер</button><button class=\"refresh\" id=\"refreshBtn\">Обновить факт</button></div>\n  </div>\n\n  <section class=\"page active\" id=\"page-pulse\">\n    <div class=\"head\">\n      <div><div class=\"eyebrow\">Главный экран</div><h1>Пульс</h1><p>Факт читается напрямую из «Статистики по ДЕМО». План считаем только по зелёным; жёлтые — резерв для дожима; красные — диагностика.</p></div>\n      <div class=\"weekmeta\">\n        <div class=\"weekbadge current\" id=\"currentWeekBadge\">Сейчас: неделя —</div>\n        <select class=\"weekselect\" id=\"weekSelect\"><option>Загружаю недели…</option></select>\n      </div>\n    </div>\n    <div id=\"pulseError\" class=\"errorbox hidden\"></div>\n    <div id=\"pulseLoading\" class=\"loading\">Читаю свежий DEMO-факт из исходной таблицы…</div>\n    <div id=\"pulseContent\" class=\"hidden\">\n      <div class=\"freshnote\" id=\"freshNote\"></div>\n      <div class=\"summary\" id=\"summary\"></div>\n      <div class=\"sectiontitle\"><div><h2>Шесть продуктов</h2><p>Факт выбранной недели и решение на следующий шаг.</p></div><p id=\"sourceStamp\"></p></div>\n      <div class=\"productgrid\" id=\"products\"></div>\n      <div class=\"twocol\">\n        <section class=\"panel\"><div class=\"panelhead\"><h2>Что делать сейчас</h2><p>Решение по каждому продукту.</p></div><div class=\"decisionlist\" id=\"decisions\"></div></section>\n        <section class=\"panel\"><div class=\"panelhead\"><h2>Динамика по неделям</h2><p>Номер недели, даты и зелёные относительно плана.</p></div><div class=\"weeks\" id=\"weeks\"></div></section>\n      </div>\n    </div>\n  </section>\n\n  <section class=\"page\" id=\"page-mail\"><div class=\"head\"><div><div class=\"eyebrow\">Этап 2</div><h1>Письма</h1><p>Только обычные DEMO-рассылки. Новости и дожим демо сюда не попадут.</p></div></div><div class=\"placeholder\"><h2>Следующая страница</h2><p>Соберём после фиксации Пульса.</p></div></section>\n  <section class=\"page\" id=\"page-news\"><div class=\"head\"><div><div class=\"eyebrow\">Этап 3</div><h1>Новости</h1><p>Отдельная страница фактических новостных рассылок ГФ и ГЗ.</p></div></div><div class=\"placeholder\"><h2>Строгий NEWS-классификатор</h2><p>Только утверждённые Campaign-префиксы.</p></div></section>\n  <section class=\"page\" id=\"page-demo\"><div class=\"head\"><div><div class=\"eyebrow\">Этап 4</div><h1>Дожим демо</h1><p>Жёлтые сначала, зелёных исключаем.</p></div></div><div class=\"placeholder\"><h2>Решение, а не отчёт</h2></div></section>\n  <section class=\"page\" id=\"page-vika\"><div class=\"head\"><div><div class=\"eyebrow\">Этап 5</div><h1>План для Вики</h1><p>Каждое письмо отдельной строкой.</p></div></div><div class=\"placeholder\"><h2>Операционный план</h2></div></section>\n  <section class=\"page\" id=\"page-calls\"><div class=\"head\"><div><div class=\"eyebrow\">Этап 6</div><h1>Звонки / Что продает</h1><p>Накопительный анализ звонков.</p></div></div><div class=\"placeholder\"><h2>После основных DEMO-страниц</h2></div></section>\n  <section class=\"page\" id=\"page-service\"><div class=\"head\"><div><div class=\"eyebrow\">Этап 7</div><h1>Служебное</h1><p>Источники, синхронизация, ошибки и дубли.</p></div></div><div class=\"placeholder\"><h2>Служебный экран</h2></div></section>\n</main>\n</div>";
(function(){
'use strict';
const BUILD='v2-static-assets-2026-09-09-09';
const buttons=[...document.querySelectorAll('.navbtn')];
const pages=[...document.querySelectorAll('.page')];
let appData=null;
let activeWeek=null;

function openPage(name){buttons.forEach(b=>b.classList.toggle('active',b.dataset.page===name));pages.forEach(p=>p.classList.toggle('active',p.id==='page-'+name));}
buttons.forEach(b=>b.addEventListener('click',()=>openPage(b.dataset.page)));
function setHealth(ok,text){document.getElementById('serverDot').className='dot '+(ok?'ok':'bad');document.getElementById('serverStatus').textContent=text;}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
function fmt(v){return new Intl.NumberFormat('ru-RU').format(n(v))}
function pct(v){return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(n(v))+'%'}
function cleanDecision(t){return String(t||'').replace(/green/gi,'зелёных').replace(/yellow/gi,'жёлтых').replace(/red/gi,'красных')}
function productClass(p){if(n(p.progress)>=100)return'done';if(n(p.green)+n(p.yellow)>=n(p.plan)&&n(p.plan)>0)return'reserve';return'risk'}
function productStatus(p){if(n(p.progress)>=100)return'План выполнен';if(n(p.green)+n(p.yellow)>=n(p.plan)&&n(p.plan)>0)return'Резерв есть';if(/школа/i.test(p.product||''))return'Дозревает';return'Нужен приток'}
function dateRu(v){if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
function isoMonday(year,week){const jan4=new Date(Date.UTC(year,0,4));const jan4day=jan4.getUTCDay()||7;const monday=new Date(jan4);monday.setUTCDate(jan4.getUTCDate()-(jan4day-1)+(week-1)*7);return monday}
function rangeLabel(year,week){const start=isoMonday(year,week),end=new Date(start);end.setUTCDate(start.getUTCDate()+6);const m=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];return start.getUTCMonth()===end.getUTCMonth()?`${start.getUTCDate()}–${end.getUTCDate()} ${m[end.getUTCMonth()]}`:`${start.getUTCDate()} ${m[start.getUTCMonth()]}–${end.getUTCDate()} ${m[end.getUTCMonth()]}`}

const RPC_PENDING=new Map();
window.addEventListener('message',e=>{const m=e.data||{};if(m.type!=='analytics-rpc-result'||!m.id)return;const p=RPC_PENDING.get(m.id);if(!p)return;RPC_PENDING.delete(m.id);m.ok?p.resolve(m.result):p.reject(new Error(m.error||'Ошибка сервера'));});
function rpc(method,...args){
 if(window.google&&google.script&&google.script.run){return new Promise((resolve,reject)=>{const r=google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(new Error(e&&e.message?e.message:String(e))));r[method](...args);});}
 if(window.parent!==window){return new Promise((resolve,reject)=>{const id='rpc-'+Date.now()+'-'+Math.random().toString(36).slice(2);RPC_PENDING.set(id,{resolve,reject});window.parent.postMessage({type:'analytics-rpc',id,method,args},'*');setTimeout(()=>{if(RPC_PENDING.has(id)){RPC_PENDING.delete(id);reject(new Error('Сервер не ответил вовремя'));}},30000);});}
 return Promise.reject(new Error('Нет соединения с Apps Script'));
}
function checkServer(){
 rpc('v2HealthCheck').then(r=>setHealth(Boolean(r&&r.ok),r&&r.ok?'GitHub Pages UI · сервер '+(r.backendBuild||'подключён'):'Сервер не ответил')).catch(e=>setHealth(false,'Ошибка сервера: '+e.message));
}

function loadData(){
 const btn=document.getElementById('refreshBtn');btn.disabled=true;btn.textContent='Читаю источник…';
 document.getElementById('pulseError').classList.add('hidden');
 rpc('getPulseDataFresh').then(data=>{btn.disabled=false;btn.textContent='Обновить факт';appData=data;activeWeek=data.meta.currentWeek;setupWeeks();renderSelectedWeek();}).catch(err=>{btn.disabled=false;btn.textContent='Обновить факт';showError(err&&err.message?err.message:String(err));});
}
function showError(msg){document.getElementById('pulseLoading').classList.add('hidden');document.getElementById('pulseContent').classList.add('hidden');const b=document.getElementById('pulseError');b.textContent='Не удалось загрузить Пульс: '+msg;b.classList.remove('hidden')}
function setupWeeks(){
 const meta=appData.meta||{},year=meta.year||new Date().getFullYear(),weeks=appData.weekDetails||[];
 document.getElementById('currentWeekBadge').textContent=`Сейчас: неделя ${meta.calendarWeek||'—'} · ${meta.calendarWeek?rangeLabel(year,meta.calendarWeek):'—'}`;
 const select=document.getElementById('weekSelect');
 select.innerHTML=weeks.slice().reverse().map(w=>`<option value="${w.week}" ${w.week===activeWeek?'selected':''}>Показаны: неделя ${w.week} · ${rangeLabel(year,w.week)}</option>`).join('');
 select.onchange=()=>{activeWeek=Number(select.value);renderSelectedWeek()};
}
function renderSelectedWeek(){
 const meta=appData.meta||{},year=meta.year||new Date().getFullYear();
 const detail=(appData.weekDetails||[]).find(w=>Number(w.week)===Number(activeWeek));
 if(!detail){showError('В источнике нет данных выбранной недели.');return}
 const productOrder=['ГЗ Периодика','ГФ Периодика','ГЗ Система','ГФ Система','ГЗ Школа','ГФ Школа'];
 const products=(detail.products||[]).slice().sort((a,b)=>productOrder.indexOf(a.product)-productOrder.indexOf(b.product)),summary=detail.summary||{};
 document.getElementById('pulseLoading').classList.add('hidden');document.getElementById('pulseContent').classList.remove('hidden');
 const current=Number(activeWeek)===Number(meta.calendarWeek);
 document.getElementById('freshNote').textContent=current?`Текущая неделя ${activeWeek} (${rangeLabel(year,activeWeek)}): факт ещё накапливается.`:`Неделя ${activeWeek} (${rangeLabel(year,activeWeek)}): показываем текущий дозревший факт из исходной таблицы, а не старый кэш.`;
 document.getElementById('sourceStamp').textContent='Источник прочитан '+dateRu(meta.sourceReadAt);
 const remaining=Math.max(0,n(summary.plan)-n(summary.green));
 document.getElementById('summary').innerHTML=`<div class="kpi primary"><span>Зелёные демо / план</span><strong><span class="good">${fmt(summary.green)}</span> / ${fmt(summary.plan)}</strong><div class="overallbar"><i style="width:${Math.min(100,n(summary.progress))}%"></i></div><div class="overallmeta"><span>Выполнение <b>${pct(summary.progress)}</b></span><span>До плана <b>${fmt(remaining)}</b></span></div></div><div class="kpi"><span>Жёлтые демо</span><strong>${fmt(summary.yellow)}</strong><small>Первый резерв для дожима</small></div><div class="kpi"><span>Красные демо</span><strong>${fmt(summary.red)}</strong><small>Диагностика, не выполнение плана</small></div><div class="kpi"><span>Зелёные + жёлтые</span><strong>${fmt(summary.potential)}</strong><small>Потенциал, не факт выполнения</small></div>`;
 document.getElementById('products').innerHTML=products.map(p=>{const cls=productClass(p),gap=Math.max(0,n(p.plan)-n(p.green));return `<article class="product ${cls}"><div class="producttop"><h3>${esc(p.product)}</h3><span class="status ${cls}">${productStatus(p)}</span></div><div class="metricrow"><div class="metricbox fact"><span>Факт</span><strong>${fmt(p.green)}</strong><small>зелёных демо</small></div><div class="metricbox plan"><span>План</span><strong>${fmt(p.plan)}</strong><small>зелёных демо</small></div><div class="metricbox progress"><span>Выполнение</span><strong>${pct(p.progress)}</strong><small>до плана ${fmt(gap)}</small></div></div><div class="bar"><i style="width:${Math.min(100,n(p.progress))}%"></i></div><div class="gapline"><span>Факт <b>${fmt(p.green)}</b> из <b>${fmt(p.plan)}</b></span><span>До плана <b>${fmt(gap)}</b></span></div><div class="triplet"><div class="mini"><span>Зелёные</span><b>${fmt(p.green)}</b></div><div class="mini reserve"><span>Жёлтые</span><b>${fmt(p.yellow)}</b></div><div class="mini red"><span>Красные</span><b>${fmt(p.red)}</b></div></div><div class="decision"><b>Что делать</b>${esc(cleanDecision(p.decision))}<small>Зелёные + жёлтые: ${fmt(n(p.green)+n(p.yellow))} при плане ${fmt(p.plan)}</small></div></article>`}).join('');
 document.getElementById('decisions').innerHTML=products.map(p=>`<div class="decisionrow"><b>${esc(p.product)}</b><span>разрыв ${fmt(Math.max(0,n(p.plan)-n(p.green)))}</span><p>${esc(cleanDecision(p.decision))}</p></div>`).join('');
 const weeks=appData.weeks||[],maxPlan=Math.max(1,...weeks.map(w=>n(w.plan)));
 document.getElementById('weeks').innerHTML=weeks.slice(-8).map(w=>`<div class="weekrow" data-week="${w.week}"><span><b>Неделя ${w.week}</b>${rangeLabel(year,w.week)}</span><div class="weekbar"><i style="width:${Math.min(100,n(w.green)/maxPlan*100)}%"></i></div><b>${fmt(w.green)} / ${fmt(w.plan)}</b></div>`).join('');
 document.querySelectorAll('.weekrow').forEach(row=>row.addEventListener('click',()=>{activeWeek=Number(row.dataset.week);document.getElementById('weekSelect').value=String(activeWeek);renderSelectedWeek()}));
}

document.getElementById('healthBtn').addEventListener('click',checkServer);
document.getElementById('refreshBtn').addEventListener('click',loadData);
checkServer();loadData();
})();
});
