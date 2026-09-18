function startAnalyticsApp(){
  document.body.innerHTML="<div class=\"app\">\n<aside>\n  <div class=\"brand\"><b>Analytics Center</b><span>Чистая сборка V2</span></div>\n  <nav>\n    <button class=\"navbtn active\" data-page=\"pulse\">Пульс</button>\n    <button class=\"navbtn\" data-page=\"mail\">Письма</button>\n    <button class=\"navbtn\" data-page=\"news\">Новости</button>\n    <button class=\"navbtn\" data-page=\"demand\">Спрос / Темы</button>\n    <button class=\"navbtn\" data-page=\"vika\">План для Вики</button>\n    \n    <button class=\"navbtn\" data-page=\"service\">Служебное</button>\n  </nav>\n  <div class=\"asidefoot\"><b>v2-full-refresh-2026-09-10-10</b>Интерфейс живёт на GitHub Pages. Apps Script используется только как серверный мост к данным.</div>\n</aside>\n<main>\n  <div class=\"topline\">\n    <div class=\"build\"><span id=\"serverDot\" class=\"dot\"></span><span id=\"serverStatus\">Проверяем сервер…</span></div>\n    <div class=\"topactions\"><button class=\"health\" id=\"healthBtn\">Проверить сервер</button><button class=\"refresh\" id=\"refreshBtn\">Обновить всё</button></div>\n  </div>\n\n  <section class=\"page active\" id=\"page-pulse\">\n    <div class=\"head\">\n      <div><div class=\"eyebrow\">Главный экран</div><h1>Пульс</h1><p>Факт читается напрямую из «Статистики по ДЕМО». План считаем только по зелёным; жёлтые — резерв для дожима; красные — диагностика.</p></div>\n      <div class=\"weekmeta\">\n        <div class=\"weekbadge current\" id=\"currentWeekBadge\">Сейчас: неделя —</div>\n        <select class=\"weekselect\" id=\"weekSelect\"><option>Загружаю недели…</option></select>\n      </div>\n    </div>\n    <div id=\"pulseError\" class=\"errorbox hidden\"></div>\n    <div id=\"pulseLoading\" class=\"loading\">Читаю свежий DEMO-факт из исходной таблицы…</div>\n    <div id=\"pulseContent\" class=\"hidden\">\n      <div class=\"freshnote\" id=\"freshNote\"></div>\n      <div class=\"sectiontitle\"><div><h2>Шесть продуктов</h2><p>Факт выбранной недели и решение на следующий шаг.</p></div><p id=\"sourceStamp\"></p></div>\n      <div class=\"productgrid\" id=\"products\"></div>\n      <div class=\"twocol\">\n        <section class=\"panel\"><div class=\"panelhead\"><h2>Что делать сейчас</h2><p>Решение по каждому продукту.</p></div><div class=\"decisionlist\" id=\"decisions\"></div></section>\n        <section class=\"panel\"><div class=\"panelhead\"><h2>Динамика по неделям</h2><p>Номер недели, даты и зелёные относительно плана.</p></div><div class=\"weeks\" id=\"weeks\"></div></section>\n      </div>\n    </div>\n  </section>\n\n  <section class=\"page\" id=\"page-mail\"><div class=\"head\"><div><h1>Письма</h1><p>Демо-рассылки. Новостные рассылки — во вкладке «Новости». Самые свежие — сверху.</p></div></div><div class=\"tab-tools\"><input id=\"mailSearch\" placeholder=\"Поиск по теме или кампании\"><select id=\"mailProduct\"><option value=\"\">Все продукты</option></select><button id=\"mailReload\">Обновить</button></div><p id=\"mailStatus\" role=\"status\"></p><div class=\"registry\" id=\"mailRows\"></div><button id=\"mailMore\" class=\"hidden\">Показать ещё</button></section>\n  <section class=\"page\" id=\"page-news\"><div class=\"head\"><div><h1>Новости</h1><p>Как читают рассылки и какие материалы приносят демо.</p></div></div>\n<div class=\"tab-tools\"><button id=\"newsLettersTab\" aria-pressed=\"true\">Рассылки с новостями</button><button id=\"newsMaterialsTab\" aria-pressed=\"false\">Какие новости дают демо</button></div>\n<div id=\"newsLettersPanel\"><div class=\"tab-tools\"><input id=\"newsSearch\" placeholder=\"Поиск письма\"><select id=\"newsProduct\"><option value=\"\">Все продукты</option></select><button id=\"newsReload\">Обновить</button></div><p id=\"newsStatus\" role=\"status\"></p><div class=\"registry\" id=\"newsRows\"></div><button id=\"newsMore\" class=\"hidden\">Показать ещё</button></div>\n<div id=\"newsMaterialsPanel\" class=\"hidden\"><h2>Какие новости дают демо</h2><p>Все материалы из загруженных новостных писем, включая статьи. Демо — по всем источникам переходов, а не только из рассылок. Повторы материалов учтены один раз.</p><div class=\"tab-tools\"><input id=\"newsMaterialSearch\" placeholder=\"Найти новость или статью\"><select id=\"newsMaterialGroup\"><option value=\"\">ГФ и ГЗ</option><option>ГФ</option><option>ГЗ</option></select><select id=\"newsMaterialWeek\"><option value=\"\">Все доступные недели</option></select><select id=\"newsMaterialFilter\"><option value=\"\">Все материалы</option><option value=\"zero\">Без демо</option><option value=\"green\">С зелёными демо</option></select><select id=\"newsMaterialSort\"><option value=\"green\">Сначала больше зелёных</option><option value=\"total\">Сначала больше всех демо</option></select></div><p id=\"newsMaterialStatus\" role=\"status\"></p><div id=\"newsMaterialSummary\" class=\"demand-summary\"></div><div id=\"newsMaterialRows\" class=\"registry\"></div></div></section>\n  <section class=\"page\" id=\"page-demand\"><div class=\"head\"><div><h1>Спрос: темы, которые дают демо</h1><p>Результаты тем писем: зелёные, жёлтые и красные демо с подтверждением из статистики.</p></div><button id=\"demandReload\">Обновить спрос</button></div><div class=\"demand-filters\"><input id=\"demandSearch\" placeholder=\"Найти тему: зарплата, закупки, ИИ…\" aria-label=\"Поиск темы спроса\"></div><p id=\"demandStatus\" role=\"status\"></p><div id=\"demandSummary\" class=\"demand-summary\"></div><div class=\"demand-panels\"><section class=\"calls-box\"><h2>Какие темы дают демо</h2><p>Темы фактически отправленных писем, по зелёным демо. Одинаковые темы объединены внутри продукта. Повторные отчёты одной метки учтены один раз. Общие уведомления о закрытии доступа без предметной темы исключены.</p><p>Здесь прямые результаты Campaign за доступные недели после отправки. Для новостей и статей — результаты материалов по Content / Term за все доступные недели, по всем реферам. Каждый материал в продукте учитывается один раз, даже если был в нескольких письмах.</p><div id=\"demandDemo\" class=\"tablewrap\"></div></section></div></section><section class=\"page\" id=\"page-vika\"><div class=\"head\"><div><h1>План для Вики</h1><p>Письма из действующего рабочего плана. Полный текст и материалы — в каждой строке.</p></div></div><div class=\"tab-tools\"><select id=\"vikaPeriod\"><option>Текущий план</option></select><select id=\"vikaDate\" aria-label=\"Дата писем\"><option value=\"\">Все даты</option></select><input id=\"vikaSearch\" placeholder=\"Поиск по продукту, теме или сегменту\"><button id=\"vikaReload\">Обновить план</button></div><p id=\"vikaStatus\" role=\"status\"></p><p id=\"vikaSource\"></p><div class=\"registry\" id=\"vikaRows\"></div></section>\n  <section class=\"page\" id=\"page-calls\"><div class=\"head\"><div><h1>Звонки / Что продаёт</h1><p>Темы разговоров, потребности клиентов, возражения и подтверждающие фрагменты.</p></div></div><div class=\"panel calls-box\"><h2>Загрузить расшифровки</h2><p>Excel или CSV: «Номер действия», «sl_api_nr», «Анализ — Расшифровка звонков». Также можно загрузить отдельный разговор в TXT.</p><input id=\"callFiles\" type=\"file\" accept=\".xlsx,.csv,.txt\" multiple><p id=\"callImportStatus\" role=\"status\"></p><details><summary>Как обрабатываются разговоры</summary><p>Расшифровки сохраняются в служебной таблице. По кнопке анализа текст с маскировкой телефонов и электронной почты передаётся в OpenAI. Анализ требует настроенного API-ключа и оплачивается по тарифу API.</p></details></div><div class=\"tab-tools\"><button id=\"callsReload\">Обновить результаты</button><button id=\"callsAnalyze\" disabled>Проанализировать загруженные звонки</button><button id=\"callsStop\" class=\"hidden\">Остановить после текущей партии</button></div><p id=\"callsStatus\" role=\"status\"></p><div id=\"callsMetrics\"></div><div class=\"registry\" id=\"callsTopics\"></div><div id=\"callsDetail\" class=\"panel calls-box hidden\"></div><details class=\"calls-box\"><summary>История загрузок</summary><div id=\"callsImports\"></div></details></section>\n  <section class=\"page\" id=\"page-service\"><div class=\"head\"><div><div class=\"eyebrow\">Этап 7</div><h1>Служебное</h1><p>Источники, синхронизация, ошибки и дубли.</p></div></div><div class=\"placeholder\"><h2>Служебный экран</h2></div></section>\n</main>\n</div>";
(function(){
'use strict';
const BUILD='v2-full-refresh-2026-09-10-10';
const buttons=[...document.querySelectorAll('.navbtn')];
const pages=[...document.querySelectorAll('.page')];
let appData=null;
let activeWeek=null;

function openPage(name){if(name==='demand')loadDemand();if(name==='vika'&&!vikaData)loadVika();if(name==='calls')loadCalls();if(['mail','news'].includes(name))loadRegistry();buttons.forEach(b=>b.classList.toggle('active',b.dataset.page===name));pages.forEach(p=>p.classList.toggle('active',p.id==='page-'+name));}
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
 if(window.analyticsRpc)return window.analyticsRpc(method,...args);
 if(window.google&&google.script&&google.script.run){return new Promise((resolve,reject)=>{const r=google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(new Error(e&&e.message?e.message:String(e))));r[method](...args);});}
 if(window.parent!==window){return new Promise((resolve,reject)=>{const id='rpc-'+Date.now()+'-'+Math.random().toString(36).slice(2);RPC_PENDING.set(id,{resolve,reject});window.parent.postMessage({type:'analytics-rpc',id,method,args},'*');setTimeout(()=>{if(RPC_PENDING.has(id)){RPC_PENDING.delete(id);reject(new Error('Сервер не ответил вовремя'));}},30000);});}
 return Promise.reject(new Error('Нет соединения с Apps Script'));
}
function checkServer(){
 rpc('v2HealthCheck').then(r=>setHealth(Boolean(r&&r.ok),r&&r.ok?'GitHub Pages UI · сервер '+(r.backendBuild||'подключён'):'Сервер не ответил')).catch(e=>setHealth(false,'Ошибка сервера: '+e.message));
}

async function loadData(){
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
   const refreshed=await rpc('getMailRegistryUi');
   registryData=(refreshed.emails||[]).slice().sort((a,b)=>mailDate(b).localeCompare(mailDate(a)));renderRegistries();renderDemand();startMaterialMatching();
   btn.textContent='Обновляю Пульс…';
   const data=await rpc('getPulseDataFresh');
   appData=data;activeWeek=data.meta.currentWeek;setupWeeks();renderSelectedWeek();
   btn.textContent='Обновляю план для Вики…';
   await loadVika(vikaData?.selected?.id);
   setHealth(true,'Факт и письма обновлены · Sendsay обработано '+totalProcessed+' · Новости сопоставляются постепенно; статус плана — во вкладке Вики');
 }catch(err){
   showRefreshError(err&&err.message?err.message:String(err));
   setHealth(false,'Ошибка обновления данных');
 }finally{
   btn.disabled=false;btn.textContent='Обновить всё';
 }
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
 const products=(detail.products||[]).slice().sort((a,b)=>productOrder.indexOf(a.product)-productOrder.indexOf(b.product));
 document.getElementById('pulseLoading').classList.add('hidden');document.getElementById('pulseContent').classList.remove('hidden');
 const current=Number(activeWeek)===Number(meta.calendarWeek);
 document.getElementById('freshNote').textContent=current?`Текущая неделя ${activeWeek} (${rangeLabel(year,activeWeek)}): факт ещё накапливается.`:`Неделя ${activeWeek} (${rangeLabel(year,activeWeek)}): показываем текущий дозревший факт из исходной таблицы, а не старый кэш.`;
 document.getElementById('sourceStamp').textContent='Источник прочитан '+dateRu(meta.sourceReadAt);
 document.getElementById('products').innerHTML=products.map(p=>{const cls=productClass(p),gap=Math.max(0,n(p.plan)-n(p.green)),total=n(p.red)+n(p.yellow)+n(p.green);return `<article class="product ${cls}"><div class="producttop"><h3>${esc(p.product)}</h3><span class="status ${cls}">${productStatus(p)}</span></div><div class="metricrow"><div class="metricbox fact"><span>Факт</span><strong>${fmt(p.green)}</strong><small>зелёных демо</small></div><div class="metricbox plan"><span>План</span><strong>${fmt(p.plan)}</strong><small>зелёных демо</small></div><div class="metricbox progress"><span>Выполнение</span><strong>${pct(p.progress)}</strong><small>до плана ${fmt(gap)}</small></div></div><div class="bar"><i style="width:${Math.min(100,n(p.progress))}%"></i></div><div class="gapline"><span>Факт <b>${fmt(p.green)}</b> из <b>${fmt(p.plan)}</b></span><span>До плана <b>${fmt(gap)}</b></span></div><div class="triplet"><div class="mini"><span>Зелёные</span><b>${fmt(p.green)}</b></div><div class="mini reserve"><span>Жёлтые</span><b>${fmt(p.yellow)}</b></div><div class="mini red"><span>Красные</span><b>${fmt(p.red)}</b></div></div><div class="green-share"><span>Доля зелёных из всех полученных демо</span><strong>${total>0?pct(n(p.green)/total*100):"—"}</strong><small>${fmt(p.green)} из ${fmt(total)} демо</small></div><div class="decision"><b>Что делать</b>${esc(cleanDecision(p.decision))}<small>Зелёные + жёлтые: ${fmt(n(p.green)+n(p.yellow))} при плане ${fmt(p.plan)}</small></div></article>`}).join('');
 document.getElementById('decisions').innerHTML=products.map(p=>`<div class="decisionrow"><b>${esc(p.product)}</b><span>разрыв ${fmt(Math.max(0,n(p.plan)-n(p.green)))}</span><p>${esc(cleanDecision(p.decision))}</p></div>`).join('');
 const weeks=appData.weeks||[],maxPlan=Math.max(1,...weeks.map(w=>n(w.plan)));
 document.getElementById('weeks').innerHTML=weeks.slice(-8).map(w=>`<div class="weekrow" data-week="${w.week}"><span><b>Неделя ${w.week}</b>${rangeLabel(year,w.week)}</span><div class="weekbar"><i style="width:${Math.min(100,n(w.green)/maxPlan*100)}%"></i></div><b>${fmt(w.green)} / ${fmt(w.plan)}</b></div>`).join('');
 document.querySelectorAll('.weekrow').forEach(row=>row.addEventListener('click',()=>{activeWeek=Number(row.dataset.week);document.getElementById('weekSelect').value=String(activeWeek);renderSelectedWeek()}));
}


let registryData=null,registryPromise=null;
const registryLimits={mail:100,news:100};
function isNewsMail(x){return /^Gosfinansi_letter_news_GF_digest(?:_|$)/i.test(x.campaign||'')||/^letter_news_goszakaz_regular_news_digest(?:_|$)/i.test(x.campaign||'');}
function mailDate(x){const t=String(x.time||'00:00').split(':').map(v=>v.padStart(2,'0')).join(':');return String(x.date||'')+'T'+t;}
function safeLink(url,label){return /^https?:\/\//i.test(String(url||''))?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:'';}
async function loadRegistry(force=false){
 if(registryPromise)return registryPromise;
 if(registryData&&!force){renderRegistries();return;}
 ['mail','news'].forEach(k=>document.getElementById(k+'Status').textContent='Загружаю письма…');
 registryPromise=(async()=>{try{
 const data=await rpc('getMailRegistryUi');
 registryData=(data.emails||[]).slice().sort((a,b)=>mailDate(b).localeCompare(mailDate(a)));
 for(const key of ['mail','news']){const el=document.getElementById(key+'Product'),prev=el.value;const products=[...new Set(registryData.filter(x=>key==='news'?isNewsMail(x):!isNewsMail(x)).map(x=>x.product).filter(Boolean))].sort();el.innerHTML='<option value="">Все продукты</option>'+products.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');el.value=products.includes(prev)?prev:'';}
 renderRegistries();startMaterialMatching();
 }catch(e){['mail','news'].forEach(k=>document.getElementById(k+'Status').textContent='Не удалось загрузить письма: '+e.message);}finally{registryPromise=null;}})();return registryPromise;
}
function renderRegistries(){for(const key of ['mail','news']){
 if(key==='news'){renderNewsLetters();renderNewsMaterials();continue;}
 const query=document.getElementById(key+'Search').value.trim().toLowerCase(),product=document.getElementById(key+'Product').value;
 const rows=(registryData||[]).filter(x=>(key==='news'?isNewsMail(x):!isNewsMail(x))&&(!product||x.product===product)&&(!query||[x.subject,x.campaign,x.segment].join(' ').toLowerCase().includes(query)));
 document.getElementById(key+'Status').textContent='Писем: '+fmt(rows.length)+' · от новых к старым'+(key==='news'?' · Новости сопоставлены: '+(registryData||[]).filter(m=>isNewsMail(m)&&m.materialData).length+'/'+(registryData||[]).filter(isNewsMail).length:'');
 document.getElementById(key+'Rows').innerHTML=rows.length?`<table><thead><tr><th>Отправлено</th><th>Продукт / тип</th><th>Письмо</th><th>Доставлено</th><th>Открыли</th><th>Кликнули</th><th>DEMO: R / Y / G</th></tr></thead><tbody>${rows.slice(0,registryLimits[key]).map(x=>`<tr><td>${esc(x.date)}<br>${esc(x.time||'')}</td><td>${esc(x.product)}<small>${isNewsMail(x)?'Новости':/activdemo/i.test(x.campaign||'')?'Дожим демо':esc(x.segment||'Демо')}</small></td><td>${key==='mail'?`<b>${safeLink(x.sendsay,x.subject)||esc(x.subject)}</b>`:`<b>${esc(x.subject)}</b><details><summary>Подробности</summary><p>${esc(x.campaign)}</p>${safeLink(x.sendsay,'Открыть Sendsay')}<p>${esc(isNewsMail(x)?(x.materialData?.note||'Автоматически сопоставляем ссылки материалов с Content / Term.'):x.note||x.maturity||'')}</p>${(isNewsMail(x)?[]:x.demoEvidence||[]).map(d=>`<p>${safeLink(d.sourceUrl,d.source)} · ${esc(d.product)}<br>${esc(d.campaign)}<br>R ${fmt(d.red)} / Y ${fmt(d.yellow)} / G ${fmt(d.green)}</p>`).join('')}${isNewsMail(x)?materialDetails(x):`<button class="material-demo" data-mail-id="${esc(x.id)}">Сопоставить материалы по Content / Term</button><div class="material-result"></div>`}</details>`}</td><td>${fmt(x.delivered)}</td><td>${x.openRate==null?"—":pct(x.openRate)}</td><td>${x.clickRate==null?"—":pct(x.clickRate)}</td><td>${isNewsMail(x)?materialSummary(x):x.hasDemoData===true?`R ${fmt(x.red)} / Y ${fmt(x.yellow)} / G ${fmt(x.green)}`:isNewsMail(x)?'По материалам — в подробностях':'Нет совпадения Campaign'}</td></tr>`).join('')}</tbody></table>`:'<div class="placeholder">Нет писем по выбранным условиям.</div>';
 document.getElementById(key+'More').classList.toggle('hidden',rows.length<=registryLimits[key]);
 document.getElementById(key+'Rows').querySelectorAll('.material-demo').forEach(button=>button.onclick=()=>loadMaterialDemo(button));
}}
function renderNewsLetters(){
 const query=document.getElementById('newsSearch').value.trim().toLowerCase(),product=document.getElementById('newsProduct').value;
 const rows=(registryData||[]).filter(isNewsMail).filter(x=>(!product||x.product===product)&&(!query||[x.subject,x.campaign].join(' ').toLowerCase().includes(query)));
 document.getElementById('newsStatus').textContent='Писем: '+fmt(rows.length)+' · свежие сверху. Демо материалов — в разделе «Какие новости дают демо».';
 document.getElementById('newsRows').innerHTML=rows.length?`<table><thead><tr><th>Дата</th><th>Продукт</th><th>Письмо в Sendsay</th><th>Отправлено</th><th>Доставлено</th><th>Открытия, %</th><th>Клики</th><th>Клики, %</th><th>CTOR, %</th></tr></thead><tbody>${rows.slice(0,registryLimits.news).map(x=>`<tr><td>${esc(x.date)}<small>${esc(x.time||'')}</small></td><td>${esc(x.product)}</td><td><b>${safeLink(x.sendsay,x.subject)||esc(x.subject)}</b></td><td>${x.sent==null?'—':fmt(x.sent)}</td><td>${fmt(x.delivered)}</td><td>${x.openRate==null?'—':pct(x.openRate)}</td><td>${x.clicks==null?'—':fmt(x.clicks)}</td><td>${x.clickRate==null?'—':pct(x.clickRate)}</td><td>${x.ctor==null?'—':pct(x.ctor)}</td></tr>`).join('')}</tbody></table><p>«—» — показатель не передан источником.</p>`:'<p>Нет писем по выбранным условиям.</p>';
 document.getElementById('newsMore').classList.toggle('hidden',rows.length<=registryLimits.news);
}
function newsMaterialTopics(emails,week){
 const topics=new Map();
 const identity=url=>String(url||'').replace(/^https?:\/\/(?:www\.)?/i,'').split(/[?#]/)[0].replace(/\/$/,'');
 for(const mail of emails.filter(isNewsMail)){
  if(!mail.materialData)continue;
  for(const material of mail.materialData.materials||[]){
   const key=identity(material.url);if(!key)continue;
   let t=topics.get(key);if(!t){t={title:material.title,url:material.url,kind:material.kind,group:String(mail.product||'').split(' ')[0],red:0,yellow:0,green:0,letters:new Map(),evidence:new Set()};topics.set(key,t);}
   if((material.title||'').length>(t.title||'').length)t.title=material.title;
   t.letters.set(mail.id,{subject:mail.subject,url:mail.sendsay});
   for(const r of mail.materialData.rows||[]){
    if(identity(r.url)!==key)continue;
    const factKey=r.product+'|'+r.sourceUrl;if(t.evidence.has(factKey))continue;t.evidence.add(factKey);
    const values=week?(r.weeks||[]).filter(w=>String(w.week)===String(week)):r.weeks||[r.values];
    for(const w of values)for(const metric of ['red','yellow','green'])t[metric]+=n(w[metric]);
   }
  }
 }
 return [...topics.values()].map(t=>({...t,total:t.red+t.yellow+t.green}));
}
function renderNewsMaterials(){
 const mails=(registryData||[]).filter(isNewsMail),done=mails.filter(m=>m.materialData).length,errors=mails.filter(m=>m.materialError).length;
 const select=document.getElementById('newsMaterialWeek'),previous=select.value;
 const weeks=[...new Set(mails.flatMap(m=>(m.materialData?.rows||[]).flatMap(r=>(r.weeks||[]).map(w=>w.week))))].sort((a,b)=>b-a);
 select.innerHTML='<option value="">Все доступные недели</option>'+weeks.map(w=>`<option value="${w}">Неделя ${w}</option>`).join('');select.value=weeks.some(w=>String(w)===previous)?previous:'';
 const query=document.getElementById('newsMaterialSearch').value.trim().toLowerCase(),group=document.getElementById('newsMaterialGroup').value,filter=document.getElementById('newsMaterialFilter').value,sort=document.getElementById('newsMaterialSort').value;
 const all=newsMaterialTopics(mails,select.value).filter(t=>(!group||t.group===group)&&(!query||[t.title,t.url].join(' ').toLowerCase().includes(query)));
 const rows=all.filter(t=>filter==='zero'?t.total===0:filter==='green'?t.green>0:true).sort((a,b)=>sort==='total'?b.total-a.total||b.green-a.green:b.green-a.green||b.total-a.total);
 document.getElementById('newsMaterialStatus').textContent=`Проверено писем: ${done} из ${mails.length}${errors?' · Ошибок: '+errors+' · '+mails.find(m=>m.materialError).materialError:''}. ${done<mails.length?'Результат пока неполный. ':''}Период: ${select.value?'неделя '+select.value:'все доступные недели'}. Без демо — нет результата в доступном факте за этот период; переходы на отдельные материалы здесь не учитываются.`;
 document.getElementById('newsMaterialSummary').innerHTML=`<div><b>${fmt(all.length)}</b><span>материалов</span></div><div><b>${fmt(all.filter(t=>t.total>0).length)}</b><span>приносят демо</span></div><div><b>${fmt(all.filter(t=>!t.total).length)}</b><span>без демо</span></div><div><b>${fmt(all.reduce((s,t)=>s+t.green,0))}</b><span>зелёных демо</span></div>`;
 document.getElementById('newsMaterialRows').innerHTML=rows.length?`<table><thead><tr><th>Новость / статья</th><th>Всего демо</th><th>Зелёные</th><th>Жёлтые</th><th>Красные</th><th>Письма</th></tr></thead><tbody>${rows.map(t=>`<tr><td><b>${safeLink(t.url,t.title)||esc(t.title)}</b><small>${esc(t.group)} · ${t.kind==='news'?'Новость':'Статья'}</small></td><td>${fmt(t.total)}</td><td><b>${fmt(t.green)}</b></td><td>${fmt(t.yellow)}</td><td>${fmt(t.red)}</td><td><details><summary>${t.letters.size}</summary>${[...t.letters.values()].map(m=>`<p>${safeLink(m.url,m.subject)||esc(m.subject)}</p>`).join('')}</details></td></tr>`).join('')}</tbody></table>`:'<p>Материалов по выбранным условиям пока нет.</p>';
}
for(const mode of ['Letters','Materials'])document.getElementById('news'+mode+'Tab').onclick=()=>{for(const name of ['Letters','Materials']){document.getElementById('news'+name+'Panel').classList.toggle('hidden',name!==mode);document.getElementById('news'+name+'Tab').setAttribute('aria-pressed',String(name===mode));}};
for(const name of ['Search','Group','Week','Filter','Sort'])document.getElementById('newsMaterial'+name).addEventListener(name==='Search'?'input':'change',renderNewsMaterials);
function materialSummary(x){if(x.materialError)return 'Ошибка сопоставления: '+esc(x.materialError);if(!x.materialData)return 'Сопоставляем Content / Term…';if(!x.materialData.rows.length)return 'Нет совпадений Content / Term';const t={red:0,yellow:0,green:0};x.materialData.rows.forEach(r=>{for(const k of Object.keys(t))t[k]+=n(r.values[k]);});return `Материалы: R ${fmt(t.red)} / Y ${fmt(t.yellow)} / G ${fmt(t.green)}<small>Все доступные недели, все реферы</small>`;}
function materialDetails(x){return x.materialData?`<p>Материалов: ${x.materialData.materials.length}; совпадений: ${x.materialData.rows.length}</p>`+x.materialData.rows.map(r=>`<p>${safeLink(r.url,r.title)} · Term ${esc(r.term)} · ${esc(r.product)}<br>${safeLink(r.sourceUrl,r.source)} · R ${fmt(r.values.red)} / Y ${fmt(r.values.yellow)} / G ${fmt(r.values.green)}</p>`).join(''):materialSummary(x);}
async function startMaterialMatching(){
 const current=registryData;
 for(const mail of current.filter(isNewsMail)){
  if(current!==registryData)return;
  if(mail.materialData||mail.materialLoading)continue;
  mail.materialLoading=true;
  try{mail.materialData=await rpc('getMailDemoDetailsUi',mail.id);delete mail.materialError;}catch(e){mail.materialError=e.message;}finally{mail.materialLoading=false;}
  if(current!==registryData)return;
  // Preserve expanded evidence while automatic results arrive.
  const opened=[];for(const key of ['mail','news'])document.querySelectorAll('#'+key+'Rows tbody tr').forEach((r,i)=>{if(r.querySelector('details[open]'))opened.push([key,i]);});
  renderRegistries();opened.forEach(([key,i])=>{const d=document.querySelectorAll('#'+key+'Rows tbody tr')[i]?.querySelector('details');if(d)d.open=true;});renderDemand();
 }
}
async function loadMaterialDemo(button){
 const box=button.nextElementSibling;button.disabled=true;box.textContent='Читаю ссылки письма и термы в статистике…';
 try{const data=await rpc('getMailDemoDetailsUi',button.dataset.mailId);box.innerHTML=`<p>${esc(data.note)}</p><p>Найдено материалов в письме: ${data.materials.length}. Совпадений Content / Term: ${data.rows.length}. За все доступные недели.</p>`+data.rows.map(r=>`<p>${safeLink(r.url,r.content+' / '+r.term)} · ${esc(r.product)}<br>${safeLink(r.sourceUrl,r.source)}<br>${r.values?`R ${fmt(r.values.red)} / Y ${fmt(r.values.yellow)} / G ${fmt(r.values.green)}`:'Неделя отсутствует в источнике'}</p>`).join('')+(data.rows.length?'':'<p>В этих листах не найдены пары Content / Term для ссылок данного письма.</p>');}catch(e){box.textContent='Не удалось сопоставить: '+e.message;}finally{button.disabled=false;}
}
for(const key of ['mail','news']){
 for(const suffix of ['Search','Product'])document.getElementById(key+suffix).addEventListener(suffix==='Search'?'input':'change',()=>{registryLimits[key]=100;renderRegistries();});
 document.getElementById(key+'Reload').onclick=()=>loadRegistry(true);
 document.getElementById(key+'More').onclick=()=>{registryLimits[key]+=100;renderRegistries();};
}

  function normHead(v){return String(v||'').toLowerCase().replace(/ё/g,'е').replace(/[_–—-]+/g,' ').replace(/[^a-zа-я0-9]+/gi,' ').replace(/\s+/g,' ').trim()}
  function detectHeaders(headers){const h=headers.map(normHead),has=x=>h.includes(normHead(x)),trans=h.some(x=>x==='анализ расшифровка звонков'||x.includes('расшифровка звонков')),action=has('номер действия'),sl=h.some(x=>x==='sl api nr');if(!trans||!action||!sl)return null;if(h.some(x=>x==='кол во продаж'||x.includes('кол во продаж')))return'sales';if(has('год')||has('полугодие'))return'all';return'all'}
  function getVal(row,map,aliases){for(const a of aliases){const k=normHead(a);if(map[k]!=null)return row[map[k]]}return''}
  function parseSheet(sheet){const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false});let headerRow=-1,type=null;for(let i=0;i<Math.min(25,matrix.length);i++){type=detectHeaders(matrix[i]||[]);if(type){headerRow=i;break}}if(headerRow<0)return null;const headers=(matrix[headerRow]||[]).map(normHead),map={};headers.forEach((h,i)=>{if(h&&!Object.prototype.hasOwnProperty.call(map,h))map[h]=i});const records=[];for(let i=headerRow+1;i<matrix.length;i++){const r=matrix[i]||[],action=getVal(r,map,['Номер действия']),sl=getVal(r,map,['sl_api_nr']);if(!String(action).trim()&&!String(sl).trim())continue;const sales=getVal(r,map,['Кол-во продаж','Количество продаж']);records.push({year:getVal(r,map,['Год']),half:getVal(r,map,['Полугодие']),month:getVal(r,map,['Месяц']),product:getVal(r,map,['Тип головного продукта']),group:getVal(r,map,['Издательская группа']),actionNo:action,slApiNr:sl,salesCount:sales,sale:type==='sales'?(String(sales).trim()?Number(String(sales).replace(',','.'))>0:true):false,transcript:getVal(r,map,['Анализ - Расшифровка звонков','Анализ Расшифровка звонков']),sourceError:getVal(r,map,['Ошибка'])})}return{type,records,headers:matrix[headerRow]}}
  async function parseFile(file){await loadXlsx();const buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:'array'}),parts=[];for(const name of wb.SheetNames){const p=parseSheet(wb.Sheets[name]);if(p)parts.push(p)}if(!parts.length){const first=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(first,{header:1,defval:'',raw:false}),found=(rows.slice(0,10).find(r=>r.some(Boolean))||[]).map(String);throw new Error('Структура не распознана. Найдены колонки: '+found.join(' | ')+'. Нужны минимум: Номер действия, sl_api_nr, Анализ - Расшифровка звонков; для файла продаж также Кол-во продаж.')}const type=parts.some(x=>x.type==='sales')?'sales':'all';return{type,records:parts.flatMap(x=>x.records)}}


let callsData=null,callsBusy=false,callsLoading=false,stopCalls=false,xlsxPromise=null;
function loadXlsx(){if(window.XLSX)return Promise.resolve();if(!xlsxPromise)xlsxPromise=new Promise((resolve,reject)=>{const el=document.createElement('script');el.src='https://emmadivaeva-creator.github.io/analytics-center/vendor/xlsx.full.min.js';el.onload=resolve;el.onerror=()=>{xlsxPromise=null;reject(new Error('Не удалось загрузить чтение Excel. Повторите попытку.'));};document.head.appendChild(el);});return xlsxPromise;}
function callState(text){document.getElementById('callsStatus').textContent=text;}
function setCallsBusy(busy){callsBusy=busy;document.getElementById('callFiles').disabled=busy;document.getElementById('callsAnalyze').disabled=busy||!callsData?.meta?.gptConfigured||!callsData?.meta?.pending;document.getElementById('callsReload').disabled=busy;}
async function loadCalls(){if(callsBusy||callsLoading)return;callsLoading=true;callState('Загружаю анализ звонков…');try{callsData=await rpc('getCallsDataUi',{});if(!callsData)throw new Error('Сервер вернул пустой ответ.');renderCalls();}catch(e){callState('Не удалось загрузить звонки: '+e.message);}finally{callsLoading=false;}}
function renderCalls(){
 const meta=callsData.meta||{};callState(meta.gptConfigured?'Ожидают анализа: '+fmt(meta.pending):'Загрузка доступна. Для смыслового анализа нужно настроить API-ключ на сервере.');
 document.getElementById('callsAnalyze').disabled=callsBusy||!meta.gptConfigured||!meta.pending;
 const setup=document.getElementById('callsSetup');if(setup)setup.classList.toggle('hidden',Boolean(meta.gptConfigured));
 document.getElementById('callsMetrics').textContent=`Звонков: ${fmt(meta.total)} · Проанализировано: ${fmt(meta.analyzed)} · С продажей: ${fmt(meta.sales)}`;
 const topics=callsData.allTopics||[];
 document.getElementById('callsTopics').innerHTML=topics.length?`<table><thead><tr><th>Тема разговора</th><th>Звонков</th><th>С продажей</th><th>Надёжность</th></tr></thead><tbody>${topics.map((x,i)=>`<tr><td><button data-topic="${i}">${esc(x.name)}</button></td><td>${fmt(x.calls)}</td><td>${fmt(x.sales)}</td><td>${x.lowSample?'Мало наблюдений':'Достаточно для сравнения'}</td></tr>`).join('')}</tbody></table>`:'<div class="calls-box">Пока нет результатов анализа. Загрузите расшифровки и запустите обработку.</div>';
 document.getElementById('callsImports').innerHTML=(callsData.imports||[]).map(x=>`<p><b>${esc(x.fileName)}</b> · ${esc(x.status)} · новых ${fmt(x.added)} · обновлено ${fmt(x.updated)} · ошибок ${fmt(x.errors)}</p>`).join('')||'Загрузок пока нет.';
 document.querySelectorAll('[data-topic]').forEach(el=>el.onclick=()=>openCallTopic(topics[Number(el.dataset.topic)].name));
}
async function openCallTopic(name){const box=document.getElementById('callsDetail');box.classList.remove('hidden');box.textContent='Читаю фрагменты…';try{
 const d=await rpc('getCallTopicDetailUi',name,'Тема',{});
 const list=(title,items)=>`<h3>${title}</h3>${(items||[]).length?items.map(x=>`<p>${esc(x.name)} · ${fmt(x.count)}</p>`).join(''):'<p>Нет подтверждённых данных.</p>'}`;
 const quotes=(title,items)=>`<h3>${title}</h3>${(items||[]).length?items.map(x=>`<blockquote>${esc(x)}</blockquote>`).join(''):'<p>Фрагменты пока не выделены.</p>'}`;
 box.innerHTML=`<h2>${esc(d.name)}</h2><p>${esc(d.recommendation||'')}</p>${list('Потребности и затруднения клиентов',d.pains)}${list('Возражения и ответы клиентов',d.objections)}${list('Аргументы в разговоре',d.arguments)}${list('Что предлагали в разговоре',d.coMaterials)}${quotes('Фрагменты звонков с продажей',d.successfulFragments)}${quotes('Фрагменты звонков без продажи',d.unsuccessfulFragments)}`;
 }catch(e){box.textContent='Не удалось загрузить детали: '+e.message;}}
async function txtRecord(file){const transcript=(await file.text()).trim();if(!transcript)throw new Error('Пустой файл');if(transcript.length>45000)throw new Error('Разделите расшифровку на отдельные звонки: файл превышает 45 000 символов.');const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(transcript)))].map(x=>x.toString(16).padStart(2,'0')).join('');return{type:'all',records:[{actionNo:'txt-'+hash,slApiNr:'text-'+hash,transcript}]};}
async function uploadCalls(files){if(callsBusy)return;setCallsBusy(true);const label=document.getElementById('callImportStatus');let failed=false;
 try{for(const file of files){if(!/\.(xlsx|csv|txt)$/i.test(file.name))throw new Error('Поддерживаются XLSX, CSV и TXT.');label.textContent='Читаю '+file.name+'…';const parsed=/\.txt$/i.test(file.name)?await txtRecord(file):await parseFile(file);if(!parsed.records.length)throw new Error('В файле нет разговоров.');const invalid=parsed.records.filter(r=>!String(r.actionNo||'').trim()||!String(r.slApiNr||'').trim()||!String(r.transcript||'').trim()||String(r.transcript).length>45000);if(invalid.length)throw new Error('Строк без идентификаторов, без текста или длиннее 45 000 символов: '+invalid.length+'. Исправьте файл и повторите загрузку.');
 const batch=await rpc('beginCallsImport',{fileName:file.name,fileSize:file.size,fileType:parsed.type,rowsRead:parsed.records.length});let count=0,errors=0;
 try{for(let pos=0;pos<parsed.records.length;pos+=50){const r=await rpc('importCallsBatch',{batchId:batch.batchId,fileName:file.name,records:parsed.records.slice(pos,pos+50)});count+=n(r.added)+n(r.updated);errors+=n(r.errors);label.textContent=file.name+': обработано '+Math.min(pos+50,parsed.records.length)+' из '+parsed.records.length;}
 await rpc('finishCallsImport',{batchId:batch.batchId,rowsRead:parsed.records.length,status:errors?'Частично':'Готово',message:errors?'Ошибок: '+errors:''});
 }catch(e){try{await rpc('finishCallsImport',{batchId:batch.batchId,status:'Ошибка',message:e.message});}catch(_){}throw e;}
 label.textContent=file.name+': сохранено новых/обновлённых '+count+', ошибок '+errors+'.';if(errors)failed=true;
 }}catch(e){failed=true;label.textContent='Ошибка загрузки: '+e.message;}finally{setCallsBusy(false);document.getElementById('callFiles').value='';await loadCalls();}
}
async function analyzeCalls(){if(callsBusy||!callsData?.meta?.gptConfigured)return;stopCalls=false;setCallsBusy(true);document.getElementById('callsStop').classList.remove('hidden');let total=0,message='';try{while(!stopCalls){const r=await rpc('analyzeCallsBatch',4);if(!r.configured)throw new Error('На сервере не настроен API-ключ.');total+=n(r.analyzed);callState('Разобрано '+total+' · осталось '+n(r.pending));if(r.errors)throw new Error('Сервер не смог обработать '+r.errors+' звонков. Проверьте настройки анализа.');if(!r.pending)break;if(!r.analyzed)throw new Error('Обработка не продвигается.');}message=stopCalls?'Обработка остановлена. Готово: '+total:'Обработка завершена. Разобрано: '+total;}catch(e){message='Обработка остановлена: '+e.message;}finally{setCallsBusy(false);document.getElementById('callsStop').classList.add('hidden');await loadCalls();callState(message);}}

const callsSetup=document.createElement('details');callsSetup.id='callsSetup';callsSetup.className='calls-box hidden';callsSetup.innerHTML='<summary>Подключить анализ звонков</summary><p>Введите API-ключ OpenAI. Он сохранится на сервере и не будет отображаться в результатах.</p><input id="callsKey" type="password" autocomplete="off" placeholder="API-ключ"><button id="callsSaveKey">Сохранить ключ</button>';
document.getElementById('callsStatus').after(callsSetup);
document.getElementById('callsSaveKey').onclick=async()=>{const input=document.getElementById('callsKey'),key=input.value.trim();if(!key||callsBusy)return;setCallsBusy(true);try{await rpc('saveCallsOpenAIKey',key);input.value='';setCallsBusy(false);await loadCalls();}catch(e){callState('Не удалось сохранить ключ: '+e.message);}finally{setCallsBusy(false);}};

document.getElementById('callFiles').onchange=e=>uploadCalls([...e.target.files]);
document.getElementById('callsReload').onclick=loadCalls;
document.getElementById('callsAnalyze').onclick=analyzeCalls;
document.getElementById('callsStop').onclick=()=>{stopCalls=true;callState('Останавливаемся после текущей партии…');};


let demandBusy=false,demandShowAll=false;
function demandMailTopics(emails){
 const seen=new Set(),groups=new Map();
 for(const mail of emails){
  if(mail.materialData){for(const r of mail.materialData.rows){const key=r.sourceUrl;if(seen.has(key))continue;seen.add(key);const groupKey=r.product+'|'+r.url; if(!groups.has(groupKey))groups.set(groupKey,{title:r.title,product:r.product,red:0,yellow:0,green:0,letters:[],lastDate:mail.date});const item=groups.get(groupKey);for(const k of ['red','yellow','green'])item[k]+=n(r.values[k]);item.letters.push({date:'Все доступные недели',campaign:'Content '+r.content+' / Term '+r.term,url:r.sourceUrl,sendsay:r.url,material:true});}}
  if(/^Gosfinansi_letter_news_GF_digest|^letter_news_goszakaz_regular_news_digest/i.test(mail.campaign||'')||!mail.hasDemoData)continue;
  for(const evidence of mail.demoEvidence||[]){
   const key=evidence.sourceUrl||evidence.source+'|'+evidence.product+'|'+evidence.campaign;
   if(seen.has(key))continue;seen.add(key);
   const title=String(mail.subject||'Без темы').trim();
   if(/деактиваци|доступ.{0,25}(?:сгор|закрыт|заблок)|(?:сгор|заблок).{0,25}доступ|зарегистрирован доступ|доступ подписчика|открыли для вас доступ|уйдет в архив/i.test(title))continue;
   const groupKey=evidence.product+'|'+title.toLowerCase();
   if(!groups.has(groupKey))groups.set(groupKey,{title,product:evidence.product,red:0,yellow:0,green:0,letters:[],lastDate:mail.date});
   const item=groups.get(groupKey);for(const metric of ['red','yellow','green'])item[metric]+=n(evidence[metric]);
   item.letters.push({date:mail.date,campaign:mail.campaign,url:evidence.sourceUrl,sendsay:mail.sendsay});
  }
 }
 return [...groups.values()].sort((a,b)=>b.green-a.green||b.yellow-a.yellow||b.lastDate.localeCompare(a.lastDate));
}
async function loadDemand(){
 if(demandBusy)return;demandBusy=true;document.getElementById('demandReload').disabled=true;document.getElementById('demandStatus').textContent='Сопоставляю темы с результатами DEMO…';
 try{await loadRegistry();if(!registryData)throw new Error('Реестр писем не загружен');renderDemand();}catch(e){document.getElementById('demandStatus').textContent='Не удалось загрузить спрос: '+e.message;}finally{demandBusy=false;document.getElementById('demandReload').disabled=false;}
}
function renderDemand(){
 if(!registryData)return;
 const q=document.getElementById('demandSearch').value.trim().toLowerCase(),all=demandMailTopics(registryData),topics=all.filter(t=>[t.title,t.product].join(' ').toLowerCase().includes(q));
 const matched=registryData.filter(m=>m.hasDemoData).length;
 document.getElementById('demandStatus').textContent='Письма: '+fmt(registryData.length)+' · Campaign сопоставлен: '+fmt(matched)+' · Новостные письма проверены: '+registryData.filter(m=>isNewsMail(m)&&m.materialData).length+'/'+registryData.filter(isNewsMail).length;
 document.getElementById('demandSummary').innerHTML=`<div><b>${fmt(all.filter(t=>t.green>0).length)}</b><span>тем с зелёными демо</span></div><div><b>${fmt(all.reduce((sum,t)=>sum+t.green,0))}</b><span>зелёных демо по этим темам</span></div><div><b>${fmt(all.length)}</b><span>тем с сопоставленной статистикой</span></div>`;
 document.getElementById('demandDemo').innerHTML=topics.length?`<table><thead><tr><th>Тема / продукт</th><th>Зелёные</th><th>Жёлтые</th><th>Красные</th><th>Основание</th></tr></thead><tbody>${topics.slice(0,demandShowAll?topics.length:20).map(t=>`<tr><td><b>${esc(t.title)}</b><small>${esc(t.product)}</small></td><td><b>${fmt(t.green)}</b></td><td>${fmt(t.yellow)}</td><td>${fmt(t.red)}</td><td><details><summary>Метки: ${t.letters.length}</summary>${t.letters.map(m=>`<p>${esc(m.date)} · ${esc(m.campaign)}<br>${safeLink(m.url,'Статистика DEMO')} · ${safeLink(m.sendsay,m.material?'Материал':'Письмо в Sendsay')}</p>`).join('')}</details></td></tr>`).join('')}</tbody></table>${topics.length>20?`<button id="demandMore">${demandShowAll?'Показать первые 20':'Показать все темы: '+topics.length}</button>`:''}`:'<p>Нет сопоставленных тем по выбранному запросу.</p>';
 const more=document.getElementById('demandMore');if(more)more.onclick=()=>{demandShowAll=!demandShowAll;renderDemand();};
}
document.getElementById('demandReload').onclick=async()=>{registryData=null;await loadDemand();};
document.getElementById('demandSearch').oninput=renderDemand;

let vikaData=null,vikaLoading=false;
async function loadVika(id){if(vikaLoading)return;vikaLoading=true;const status=document.getElementById('vikaStatus');status.textContent='Читаю рабочий план…';try{vikaData=await rpc('getVikaPlanUi',id||null);document.getElementById('vikaPeriod').innerHTML=vikaData.plans.slice().sort((a,b)=>b.week-a.week).map(p=>`<option value="${p.id}" ${p.id===vikaData.selected.id?'selected':''}>${esc(p.name)}</option>`).join('');document.getElementById('vikaSource').innerHTML=safeLink(vikaData.sourceUrl,'Открыть исходную таблицу');renderVika();loadVikaEditorial(vikaData);}catch(e){status.textContent='Не удалось загрузить план: '+e.message;}finally{vikaLoading=false;}}
async function loadVikaEditorial(plan){try{const result=await rpc('getVikaEditorialUi',plan.selected.id);if(vikaData!==plan)return;plan.editorial=result;}catch(e){if(vikaData!==plan)return;plan.editorialError='Редакционный оригинал не загружен: '+e.message;}renderVika();}
function vikaEditorialParts(i){const e=vikaData.editorial?.rows?.[i];if(!e?.text)return {body:'',notes:[]};const body=e.text.split(/\n\s*рассылка\s+(?:по|для)\s+открыто[йм]/i)[0];const notes=[];const lines=body.split('\n').filter(line=>{if(/^\s*(?:\(?Вик(?:а)?(?=[\s,.:()]|$)|Для Юры|Можешь добавить|зага в верстке нет|\(кнопка)/i.test(line)){notes.push(line.trim());return false;}return true;});return {body:lines.join('\n').trim(),notes};}
function vikaEditorialNotes(i){const notes=vikaEditorialParts(i).notes;return notes.length?`<div class="vika-field"><h4>Примечания редакции из документа</h4><p>${esc(notes.join('\n'))}</p></div>`:'';}
function vikaEditorialHtml(i){const e=vikaData.editorial?.rows?.[i];if(!e)return '';const parts=vikaEditorialParts(i);return `<div class="vika-editorial"><p>${safeLink(e.sourceUrl,'Оригинал редакции · '+e.tabTitle)}</p>${e.error?`<p>${esc(e.error)}</p>`:`<p>${e.subjectMatches?'Тема совпадает с планом':'Тема редакции отличается от подготовленной версии — проверьте перед постановкой'}</p><details><summary>Текст редакции из Google Документа</summary><p class="editorial-original">${esc(parts.body)}</p></details><details><summary>Весь раздел источника за ${esc(e.date)}</summary><p class="editorial-original">${esc(e.text)}</p></details>`}</div>`;}
function renderVika(){
  if(!vikaData)return;
  const dateSelect=document.getElementById('vikaDate'),previousDate=dateSelect.value;
  const dates=[...new Set(vikaData.rows.map(r=>String(r[0]||'').trim()).filter(Boolean))];
  dateSelect.innerHTML='<option value="">Все даты</option>'+dates.map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join('');
  dateSelect.value=dates.includes(previousDate)?previousDate:'';
  const selectedDate=dateSelect.value;
  const q=document.getElementById('vikaSearch').value.toLowerCase().trim();
  const rows=vikaData.rows.map((r,i)=>({r,i})).filter(({r,i})=>(!selectedDate||String(r[0]||'').trim()===selectedDate)&&(!q||(r.join(' ')+' '+(vikaData.editorial?.rows?.[i]?.text||'')).toLowerCase().includes(q)));
  document.getElementById('vikaStatus').textContent=vikaData.title+' · строк: '+rows.length+' · прочитано '+dateRu(vikaData.readAt)+(vikaData.editorial?' · Оригиналы редакции обновлены':vikaData.editorialError?' · '+vikaData.editorialError:' · Читаю оригиналы редакции…');
  const fields=(r,indices)=>indices.map(i=>r[i]?`<div class="vika-field"><h4>${esc(vikaData.headers[i]||'Дополнительно')}</h4><p>${i===7?safeLink(r[i],'Открыть материал')||esc(r[i]):esc(r[i])}</p></div>`:'').join('');
  document.getElementById('vikaRows').innerHTML=rows.length?`<table class="vika-table"><thead><tr><th>Дата / продукт</th><th>Тема и полный текст</th><th>Комментарии и основания</th><th>Готовность</th></tr></thead><tbody>${rows.map(({r,i})=>`<tr><td>${esc(r[0])}<p>${esc(r[1])}</p><small>${esc(r[2])}</small></td><td class="vika-letter"><b>${esc(r[3])}</b>${vikaEditorialHtml(i)}<details><summary>Подготовленный текст плана</summary>${fields(r,[4,5,6,7])}</details></td><td class="vika-comments">${vikaEditorialNotes(i)}${fields(r,[9,10,11,12,13])||'—'}</td><td>${esc(r[8])}</td></tr>`).join('')}</tbody></table>`:'<div class="calls-box">Строки не найдены.</div>';
}
document.getElementById('vikaPeriod').onchange=e=>loadVika(e.target.value);
document.getElementById('vikaSearch').oninput=renderVika;
document.getElementById('vikaDate').onchange=renderVika;
document.getElementById('vikaReload').onclick=()=>loadVika(vikaData?.selected?.id);

document.getElementById('healthBtn').addEventListener('click',checkServer);
document.getElementById('refreshBtn').addEventListener('click',refreshAllData);
checkServer();loadData();
})();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startAnalyticsApp,{once:true});else startAnalyticsApp();
