function startAnalyticsApp(){
  document.body.innerHTML="<div class=\"app\">\n<aside>\n  <div class=\"brand\"><b>Analytics Center</b><span>Чистая сборка V2</span></div>\n  <nav>\n    <button class=\"navbtn active\" data-page=\"pulse\">Пульс</button>\n    <button class=\"navbtn\" data-page=\"sources\">Источники демо</button>\n    <button class=\"navbtn\" data-page=\"mail\">Письма</button>\n    <button class=\"navbtn\" data-page=\"news\">Новости</button>\n    <button class=\"navbtn\" data-page=\"demand\">Спрос / Темы</button>\n    <button class=\"navbtn\" data-page=\"vio\">ВИО / Спрос</button>\n    <button class=\"navbtn\" data-page=\"vika\">План для Вики</button>\n    \n    <button class=\"navbtn\" data-page=\"service\">Служебное</button>\n  </nav>\n  <div class=\"asidefoot\"><b>v2-mail-cache-2026-10-01-03</b>Интерфейс живёт на GitHub Pages. Apps Script используется только как серверный мост к данным.</div>\n</aside>\n<main>\n  <div class=\"topline\">\n    <div class=\"build\"><span id=\"serverDot\" class=\"dot\"></span><span id=\"serverStatus\">Проверяем сервер…</span></div>\n    <div class=\"topactions\"><button class=\"health\" id=\"healthBtn\">Проверить сервер</button><button class=\"health\" id=\"refreshAllMailBtn\">Обновить все письма</button><button class=\"refresh\" id=\"refreshBtn\">Обновить последние 3 дня</button></div>\n  </div>\n\n  <section class=\"page active\" id=\"page-pulse\">\n    <div class=\"head\">\n      <div><div class=\"eyebrow\">Главный экран</div><h1>Пульс</h1><p>Факт читается напрямую из «Статистики по ДЕМО». План считаем только по зелёным; жёлтые — резерв для дожима; красные — диагностика.</p></div>\n      <div class=\"weekmeta\">\n        <div class=\"weekbadge current\" id=\"currentWeekBadge\">Сейчас: неделя —</div>\n        <select class=\"weekselect\" id=\"weekSelect\"><option>Загружаю недели…</option></select>\n      </div>\n    </div>\n    <div id=\"pulseError\" class=\"errorbox hidden\"></div>\n    <div id=\"pulseLoading\" class=\"loading\">Читаю свежий DEMO-факт из исходной таблицы…</div>\n    <div id=\"pulseContent\" class=\"hidden\">\n      <div class=\"freshnote\" id=\"freshNote\"></div>\n      <div class=\"sectiontitle\"><div><h2>Шесть продуктов</h2><p>Факт выбранной недели и решение на следующий шаг.</p></div><p id=\"sourceStamp\"></p></div>\n      <div class=\"productgrid\" id=\"products\"></div>\n      <div class=\"twocol\">\n        <section class=\"panel\"><div class=\"panelhead\"><h2>Что делать сейчас</h2><p>Решение по каждому продукту.</p></div><div class=\"decisionlist\" id=\"decisions\"></div></section>\n        <section class=\"panel\"><div class=\"panelhead\"><h2>Динамика по неделям</h2><p>Номер недели, даты и зелёные относительно плана.</p></div><div class=\"weeks\" id=\"weeks\"></div></section>\n      </div>\n    </div>\n  </section>\n\n  <section class=\"page\" id=\"page-sources\">\n    <div class=\"head\">\n      <div><div class=\"eyebrow\">Откуда приходят DEMO</div><h1>Источники демо</h1><p>Теперь можно провалиться до продукта и недели и увидеть, за счёт чего именно сделан DEMO-факт: Letter, Trigger, Landing или Refer / сайт.</p></div>\n      <div class=\"sources-period\" id=\"sourcesPeriod\">Неделя —</div>\n    </div>\n    <div class=\"tab-tools sources-switch\">\n      <button id=\"sourcesAll\" aria-pressed=\"true\">Все</button>\n      <button id=\"sourcesGf\" aria-pressed=\"false\">Госфинансы</button>\n      <button id=\"sourcesGz\" aria-pressed=\"false\">Госзаказ</button>\n    </div>\n    <div class=\"sources-filters\">\n      <label><span>Продукт</span><select id=\"sourcesProduct\"><option value=\"\">Все продукты</option></select></label>\n      <label><span>Неделя</span><select id=\"sourcesWeek\"><option value=\"\">Загружаю недели…</option></select></label>\n    </div>\n    <p id=\"sourcesStatus\" role=\"status\">Загружаю срез источников…</p>\n    <div id=\"sourcesSummary\" class=\"demand-summary sources-summary\"></div>\n    <div id=\"sourceAnswer\" class=\"source-answer\"></div>\n    <div id=\"sourceCards\" class=\"sources-cards\"></div>\n    <section class=\"panel calls-box sources-weekly-panel\">\n      <div class=\"sources-section-head\"><div><h2>По неделям: за счёт чего сделан факт</h2><p>В ячейке крупно — зелёные DEMO, рядом — сколько DEMO источник дал всего. Так видно не только объём, но и что именно закрывает план.</p></div></div>\n      <div id=\"sourcesWeekly\" class=\"tablewrap\"></div>\n    </section>\n    <div class=\"sources-layout\">\n      <section class=\"panel calls-box sources-site-panel\">\n        <div class=\"sources-section-head\"><div><h2>Что внутри Refer / сайта</h2><p>Сайтовый трафик для выбранного продукта и недели. Landing исключён, чтобы не задваивать его с отдельным источником.</p></div></div>\n        <div id=\"siteBreakdown\"></div>\n      </section>\n      <section class=\"panel calls-box sources-insight-panel\">\n        <h2>Что видно сразу</h2>\n        <div id=\"sourceInsights\" class=\"source-insights\"></div>\n        <details class=\"sources-method\">\n          <summary>Как сгруппированы источники</summary>\n          <div class=\"sources-method-grid\">\n            <p><b>Letter</b><span>Прямые кампании, начинающиеся с letter_. Trigger вынесен отдельно.</span></p>\n            <p><b>Trigger</b><span>letter_trigger_* и letter_triger_*.</span></p>\n            <p><b>Landing</b><span>landing / lending; смешанные search_string_lending,letter_* не задваиваются.</span></p>\n            <p><b>Пейволы</b><span>PW_*, pw_*, pw_click-button, placeholder*, id2panel* и ph_*.</span></p>\n            <p><b>Новости</b><span>UTM Content = news.</span></p>\n            <p><b>Статьи</b><span>UTM Content = article / art и портальные статейные метки.</span></p>\n            <p><b>ВиО / QA</b><span>Question, qa и search_string_qa.</span></p>\n            <p><b>Блоки и кнопки сайта</b><span>push_id2, SB_*, iframe_content, statbloc_*, leftmenu_*, undermainmenucross, dd-ss-* и похожие внутренние точки.</span></p>\n            <p><b>Не размечено</b><span>UTM Content не указан.</span></p>\n          </div>\n        </details>\n      </section>\n    </div>\n    <section class=\"panel calls-box sources-compare\">\n      <div class=\"sources-section-head\"><div><h2>ГФ и ГЗ: сравнение источников</h2><p>Сравнение пересчитывается для выбранной недели. Для периода «Все полные недели» используются недели 27–39.</p></div></div>\n      <div id=\"sourcesCompare\" class=\"tablewrap\"></div>\n    </section>\n  </section>\n\n  <section class=\"page\" id=\"page-mail\"><div class=\"head\"><div><h1>Письма</h1><p>Демо-рассылки по неделям. Новостные рассылки — во вкладке «Новости».</p></div></div><div class=\"tab-tools\"><select id=\"mailWeek\"><option value=\"\">Все недели</option></select><input id=\"mailSearch\" placeholder=\"Поиск по теме или кампании\"><select id=\"mailProduct\"><option value=\"\">Все продукты</option></select><button id=\"mailReload\">Обновить 3 дня</button><button id=\"mailReloadAll\">Обновить все письма</button></div><div id=\"mailWeekSummary\" class=\"mail-week-summary\"></div><p id=\"mailStatus\" role=\"status\"></p><div class=\"registry\" id=\"mailRows\"></div><button id=\"mailMore\" class=\"hidden\">Показать ещё</button></section>\n  <section class=\"page\" id=\"page-news\"><div class=\"head\"><div><h1>Новости</h1><p>Как читают рассылки и какие материалы приносят демо.</p></div></div>\n<div class=\"tab-tools\"><button id=\"newsLettersTab\" aria-pressed=\"true\">Рассылки с новостями</button><button id=\"newsMaterialsTab\" aria-pressed=\"false\">Какие новости дают демо</button></div>\n<div id=\"newsLettersPanel\"><div class=\"tab-tools\"><input id=\"newsSearch\" placeholder=\"Поиск письма\"><select id=\"newsProduct\"><option value=\"\">Все продукты</option></select><button id=\"newsReload\">Обновить 3 дня</button><button id=\"newsReloadAll\">Обновить все письма</button></div><p id=\"newsStatus\" role=\"status\"></p><div class=\"registry\" id=\"newsRows\"></div><button id=\"newsMore\" class=\"hidden\">Показать ещё</button></div>\n<div id=\"newsMaterialsPanel\" class=\"hidden\"><h2>Какие новости дают демо</h2><p>Все материалы из загруженных новостных писем, включая статьи. Демо — по всем источникам переходов, а не только из рассылок. Повторы материалов учтены один раз.</p><div class=\"tab-tools\"><input id=\"newsMaterialSearch\" placeholder=\"Найти новость или статью\"><select id=\"newsMaterialGroup\"><option value=\"\">ГФ и ГЗ</option><option>ГФ</option><option>ГЗ</option></select><select id=\"newsMaterialWeek\"><option value=\"\">Все доступные недели</option></select><select id=\"newsMaterialFilter\"><option value=\"\">Все материалы</option><option value=\"zero\">Без демо</option><option value=\"green\">С зелёными демо</option></select><select id=\"newsMaterialSort\"><option value=\"green\">Сначала больше зелёных</option><option value=\"total\">Сначала больше всех демо</option></select></div><p id=\"newsMaterialStatus\" role=\"status\"></p><div id=\"newsMaterialSummary\" class=\"demand-summary\"></div><div id=\"newsMaterialRows\" class=\"registry\"></div></div></section>\n  <section class=\"page\" id=\"page-demand\"><div class=\"head\"><div><h1>Спрос: темы, которые дают демо</h1><p>Результаты тем писем: зелёные, жёлтые и красные демо с подтверждением из статистики.</p></div><button id=\"demandReload\">Обновить спрос</button></div><div class=\"demand-filters tab-tools\"><select id=\"demandGroup\" aria-label=\"Группа продуктов спроса\"><option value=\"\">ГФ и ГЗ</option><option value=\"ГФ\">ГФ</option><option value=\"ГЗ\">ГЗ</option></select><input id=\"demandSearch\" placeholder=\"Найти тему: зарплата, закупки, ИИ…\" aria-label=\"Поиск темы спроса\"></div><p id=\"demandStatus\" role=\"status\"></p><div id=\"demandSummary\" class=\"demand-summary\"></div><div class=\"demand-panels\"><section class=\"calls-box\"><h2>Какие темы дают демо</h2><p>Темы фактически отправленных писем, по зелёным демо. Одинаковые темы объединены внутри продукта. Повторные отчёты одной метки учтены один раз. Общие уведомления о закрытии доступа без предметной темы исключены.</p><p>Здесь прямые результаты Campaign за доступные недели после отправки. Для новостей и статей — результаты материалов по Content / Term за все доступные недели, по всем реферам. Каждый материал в продукте учитывается один раз, даже если был в нескольких письмах.</p><div id=\"demandDemo\" class=\"tablewrap\"></div></section></div></section><section class=\"page\" id=\"page-vio\"><div class=\"head\"><div><div class=\"eyebrow\">Спрос из ВИО</div><h1>Что спрашивают пользователи</h1><p>Здесь не просто рубрики и частотность. Главный слой — конкретная рабочая ситуация: что делают, с чем и какой ответ хотят получить.</p></div><button id=\"vioReload\">Обновить</button></div><div class=\"tab-tools vio-switch\"><button id=\"vioGz\" aria-pressed=\"true\">Госзаказ</button><button id=\"vioGf\" aria-pressed=\"false\">Госфинансы</button></div><p id=\"vioStatus\" role=\"status\"></p><div id=\"vioSummary\" class=\"demand-summary vio-summary\"></div><div class=\"vio-overview-head\"><h2>Обзор спроса</h2><p>Сначала общий масштаб: какие темы доминируют, что растёт и какой результат хотят получить.</p></div><div class=\"vio-grid\"><section class=\"panel calls-box\"><h2>Большие темы</h2><p>Куда приходится основной объём вопросов в текущем месяце.</p><div id=\"vioTopics\"></div></section><section class=\"panel calls-box\"><h2>Что растёт</h2><p>Темы, доля которых выросла относительно прошлого месяца.</p><div id=\"vioRising\"></div></section><section class=\"panel calls-box\"><h2>Что хотят получить</h2><p>Проверить правомерность, оформить, посчитать, исправить ошибку или понять порядок действий.</p><div id=\"vioIntents\"></div></section></div><section class=\"panel calls-box vio-concrete\"><div class=\"vio-section-head\"><div><h2>Что именно спрашивают</h2><p>Формулировки собраны из повторяющихся вопросов: действие + конкретный предмет + основной интент. Это уже можно использовать как основу для редакционных тем.</p></div><span class=\"vio-section-hint\">действие + предмет + интент</span></div><div id=\"vioConcrete\"></div></section><section class=\"panel calls-box vio-rubric-panel\"><details><summary>Ведущие рубрики исходной выгрузки</summary><p>Контрольный слой классификации. Для редакционной работы полезнее блок «Что именно спрашивают».</p><div id=\"vioRubrics\" class=\"vio-rubrics\"></div></details></section><p class=\"vio-note\">Тексты исходных вопросов используются только для классификации. На экран выводится агрегированный спрос, без самих пользовательских вопросов.</p></section>\n  <section class=\"page\" id=\"page-vika\"><div class=\"head\"><div><h1>План для Вики</h1><p>Письма из действующего рабочего плана. Полный текст и материалы — в каждой строке.</p></div></div><div class=\"tab-tools\"><select id=\"vikaPeriod\"><option>Текущий план</option></select><select id=\"vikaDate\" aria-label=\"Дата писем\"><option value=\"\">Все даты</option></select><input id=\"vikaSearch\" placeholder=\"Поиск по продукту, теме или сегменту\"><button id=\"vikaReload\">Обновить план</button></div><p id=\"vikaStatus\" role=\"status\"></p><p id=\"vikaSource\"></p><div class=\"registry\" id=\"vikaRows\"></div></section>\n  <section class=\"page\" id=\"page-calls\"><div class=\"head\"><div><h1>Звонки / Что продаёт</h1><p>Темы разговоров, потребности клиентов, возражения и подтверждающие фрагменты.</p></div></div><div class=\"panel calls-box\"><h2>Загрузить расшифровки</h2><p>Excel или CSV: «Номер действия», «sl_api_nr», «Анализ — Расшифровка звонков». Также можно загрузить отдельный разговор в TXT.</p><input id=\"callFiles\" type=\"file\" accept=\".xlsx,.csv,.txt\" multiple><p id=\"callImportStatus\" role=\"status\"></p><details><summary>Как обрабатываются разговоры</summary><p>Расшифровки сохраняются в служебной таблице. По кнопке анализа текст с маскировкой телефонов и электронной почты передаётся в OpenAI. Анализ требует настроенного API-ключа и оплачивается по тарифу API.</p></details></div><div class=\"tab-tools\"><button id=\"callsReload\">Обновить результаты</button><button id=\"callsAnalyze\" disabled>Проанализировать загруженные звонки</button><button id=\"callsStop\" class=\"hidden\">Остановить после текущей партии</button></div><p id=\"callsStatus\" role=\"status\"></p><div id=\"callsMetrics\"></div><div class=\"registry\" id=\"callsTopics\"></div><div id=\"callsDetail\" class=\"panel calls-box hidden\"></div><details class=\"calls-box\"><summary>История загрузок</summary><div id=\"callsImports\"></div></details></section>\n  <section class=\"page\" id=\"page-service\"><div class=\"head\"><div><div class=\"eyebrow\">Этап 7</div><h1>Служебное</h1><p>Источники, синхронизация, ошибки и дубли.</p></div></div><div class=\"placeholder\"><h2>Служебный экран</h2></div></section>\n</main>\n</div>";
(function(){
'use strict';
const BUILD='v2-mail-cache-2026-10-02-01';
const buttons=[...document.querySelectorAll('.navbtn')];
const pages=[...document.querySelectorAll('.page')];
let appData=null;
let activeWeek=null;
let sourceData=null;
let sourceGroup='Все';
let sourceProduct='';
let sourceWeek='';
let vioData=null;
let vioGroup='ГЗ';

const PAGE_STORAGE_KEY='analytics-active-page';
function validPage(name){return buttons.some(b=>b.dataset.page===name);}
function rememberedPage(){
 const hash=decodeURIComponent(String(location.hash||'').replace(/^#/,''));
 if(validPage(hash))return hash;
 try{const saved=localStorage.getItem(PAGE_STORAGE_KEY);if(validPage(saved))return saved;}catch(e){}
 return 'pulse';
}
function rememberPage(name){
 try{localStorage.setItem(PAGE_STORAGE_KEY,name);}catch(e){}
 if(location.hash!=='#'+name)history.replaceState(null,'','#'+name);
}
function openPage(name,persist=true){
 if(!validPage(name))name='pulse';
 if(name==='demand')loadDemand();
 if(name==='sources'&&!sourceData)loadSources();
 if(name==='vio'&&!vioData)loadVio();
 if(name==='vika'&&!vikaData)loadVika();
 if(name==='calls')loadCalls();
 if(name==='mail')loadRegistry();
 if(name==='news')loadRegistry().then(()=>startMaterialMatching());
 buttons.forEach(b=>b.classList.toggle('active',b.dataset.page===name));
 pages.forEach(p=>p.classList.toggle('active',p.id==='page-'+name));
 if(persist)rememberPage(name);
}
buttons.forEach(b=>b.addEventListener('click',()=>openPage(b.dataset.page)));
function setHealth(ok,text){document.getElementById('serverDot').className='dot '+(ok?'ok':'bad');document.getElementById('serverStatus').textContent=text;}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
function fmt(v){return new Intl.NumberFormat('ru-RU').format(n(v))}
function pct(v){return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(n(v))+'%'}
function cleanDecision(t){return String(t||'').replace(/green/gi,'зелёных').replace(/yellow/gi,'жёлтых').replace(/red/gi,'красных')}
function progressTone(v){const p=n(v);if(p>=99)return'progress-good';if(p>=95)return'progress-warn';return'progress-low'}
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

const LEGACY_PULSE_SYSTEM_FIX_={
  27:{'ГЗ Система':[65,24,32,71],'ГФ Система':[64,48,46,105]},
  28:{'ГЗ Система':[94,55,80,71],'ГФ Система':[73,55,89,105]},
  29:{'ГЗ Система':[104,41,55,71],'ГФ Система':[106,60,74,105]},
  30:{'ГЗ Система':[107,42,74,71],'ГФ Система':[213,86,108,105]},
  31:{'ГЗ Система':[163,55,89,71],'ГФ Система':[242,84,105,105]},
  32:{'ГЗ Система':[134,48,70,76],'ГФ Система':[179,69,102,100]},
  33:{'ГЗ Система':[146,59,70,76],'ГФ Система':[159,91,119,100]},
  34:{'ГЗ Система':[129,36,79,76],'ГФ Система':[176,82,113,100]},
  35:{'ГЗ Система':[110,43,53,76],'ГФ Система':[160,99,118,110]},
  36:{'ГЗ Система':[122,46,61,86],'ГФ Система':[209,90,112,200]},
  37:{'ГЗ Система':[111,39,68,86],'ГФ Система':[227,94,136,200]},
  38:{'ГЗ Система':[142,47,66,86],'ГФ Система':[155,79,98,200]},
  39:{'ГЗ Система':[104,29,62,86],'ГФ Система':[193,87,140,200]},
  40:{'ГЗ Система':[119,45,50,86],'ГФ Система':[211,69,97,200]}
};
function pulseDecisionClient_(p){
 if(n(p.green)>=n(p.plan)&&n(p.plan)>0)return'Дополнительный дожим не нужен: план выполнен.';
 if(n(p.green)+n(p.yellow)>=n(p.plan)&&n(p.plan)>0)return'Дожимаем жёлтых: их достаточно, чтобы закрыть текущий разрыв.';
 if(/школа/i.test(p.product||''))return'План ещё не закрыт: ждём дозревание и усиливаем дожим.';
 return'План ещё не закрыт: нужен дополнительный приток и дожим.';
}
function pulseAggregateClient_(products){
 const s=(products||[]).reduce((a,p)=>{a.red+=n(p.red);a.yellow+=n(p.yellow);a.green+=n(p.green);a.plan+=n(p.plan);return a;},{red:0,yellow:0,green:0,plan:0});
 s.progress=s.plan?Math.round(s.green/s.plan*1000)/10:0;
 s.potential=s.green+s.yellow;
 s.totalEvents=s.red+s.yellow+s.green;
 s.greenShare=s.totalEvents?Math.round(s.green/s.totalEvents*1000)/10:0;
 return s;
}
function repairLegacyPulse_(data){
 if(!data||!Array.isArray(data.weekDetails))return data;
 data.weekDetails.forEach(detail=>{
   const fixes=LEGACY_PULSE_SYSTEM_FIX_[Number(detail.week)];
   if(fixes){
     (detail.products||[]).forEach(p=>{
       const v=fixes[p.product];
       if(!v)return;
       p.red=v[0];p.yellow=v[1];p.green=v[2];p.plan=v[3];
       p.progress=p.plan?Math.round(p.green/p.plan*1000)/10:0;
       p.decision=pulseDecisionClient_(p);
     });
   }
   detail.summary=pulseAggregateClient_(detail.products||[]);
 });
 data.weeks=data.weekDetails.map(detail=>({week:detail.week,green:detail.summary.green,yellow:detail.summary.yellow,red:detail.summary.red,plan:detail.summary.plan,progress:detail.summary.progress}));
 const current=data.weekDetails.find(x=>Number(x.week)===Number(data.meta&&data.meta.currentWeek))||data.weekDetails[data.weekDetails.length-1];
 if(current){data.products=current.products;data.summary=current.summary;}
 data.meta=data.meta||{};
 data.meta.parserBuild='legacy-public-endpoint-with-verified-system-correction-20261005';
 return data;
}
const PULSE_PLAN_FALLBACK_={
  41:{'ГЗ Периодика':28,'ГФ Периодика':57,'ГЗ Система':95,'ГФ Система':210,'ГЗ Школа':27,'ГФ Школа':53},
  42:{'ГЗ Периодика':28,'ГФ Периодика':57,'ГЗ Система':92,'ГФ Система':215,'ГЗ Школа':27,'ГФ Школа':53},
  43:{'ГЗ Периодика':28,'ГФ Периодика':57,'ГЗ Система':92,'ГФ Система':220,'ГЗ Школа':27,'ГФ Школа':53},
  44:{'ГЗ Периодика':28,'ГФ Периодика':57,'ГЗ Система':92,'ГФ Система':220,'ГЗ Школа':27,'ГФ Школа':53},
  45:{'ГЗ Периодика':14,'ГФ Периодика':34,'ГЗ Система':45,'ГФ Система':93,'ГЗ Школа':7,'ГФ Школа':35},
  46:{'ГЗ Периодика':24,'ГФ Периодика':59,'ГЗ Система':80,'ГФ Система':250,'ГЗ Школа':20,'ГФ Школа':60},
  47:{'ГЗ Периодика':24,'ГФ Периодика':59,'ГЗ Система':80,'ГФ Система':250,'ГЗ Школа':20,'ГФ Школа':60},
  48:{'ГЗ Периодика':24,'ГФ Периодика':59,'ГЗ Система':80,'ГФ Система':250,'ГЗ Школа':20,'ГФ Школа':60},
  49:{'ГЗ Периодика':32,'ГФ Периодика':54,'ГЗ Система':100,'ГФ Система':250,'ГЗ Школа':16,'ГФ Школа':33},
  50:{'ГЗ Периодика':32,'ГФ Периодика':54,'ГЗ Система':100,'ГФ Система':250,'ГЗ Школа':16,'ГФ Школа':33},
  51:{'ГЗ Периодика':32,'ГФ Периодика':54,'ГЗ Система':100,'ГФ Система':250,'ГЗ Школа':16,'ГФ Школа':33},
  52:{'ГЗ Периодика':32,'ГФ Периодика':54,'ГЗ Система':100,'ГФ Система':250,'ГЗ Школа':16,'ГФ Школа':33},
  53:{'ГЗ Периодика':11,'ГФ Периодика':14,'ГЗ Система':21,'ГФ Система':67,'ГЗ Школа':1,'ГФ Школа':3}
};
function currentIsoWeekClient_(){
 const now=new Date(),d=new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate(),12));
 const day=d.getUTCDay()||7;
 d.setUTCDate(d.getUTCDate()+4-day);
 const start=new Date(Date.UTC(d.getUTCFullYear(),0,1));
 return Math.ceil((((d-start)/86400000)+1)/7);
}
function ensureCalendarPulseWeek_(data){
 if(!data||!Array.isArray(data.weekDetails))return data;
 data.meta=data.meta||{};
 const week=currentIsoWeekClient_();
 data.meta.calendarWeek=week;
 data.meta.currentWeek=week;
 data.meta.year=new Date().getFullYear();

 let detail=data.weekDetails.find(x=>Number(x.week)===week);
 if(!detail){
   const plans=PULSE_PLAN_FALLBACK_[week]||{};
   const order=['ГЗ Периодика','ГЗ Система','ГЗ Школа','ГФ Периодика','ГФ Система','ГФ Школа'];
   const products=order.map(product=>{
     const plan=n(plans[product]);
     const p={product,red:0,yellow:0,green:0,plan,progress:0};
     p.decision=pulseDecisionClient_(p);
     return p;
   });
   detail={week,products,summary:pulseAggregateClient_(products)};
   data.weekDetails.push(detail);
   data.weekDetails.sort((a,b)=>Number(a.week)-Number(b.week));
 }
 data.weeks=data.weekDetails.map(item=>({
   week:item.week,
   green:n(item.summary?.green),
   yellow:n(item.summary?.yellow),
   red:n(item.summary?.red),
   plan:n(item.summary?.plan),
   progress:n(item.summary?.progress)
 }));
 data.products=detail.products;
 data.summary=detail.summary;
 return data;
}
async function loadPulseData_(){
 try{
   const fresh=await rpc('getPulseDataStoredUi');
   return ensureCalendarPulseWeek_(fresh);
 }catch(primaryError){
   const legacy=await rpc('getPulseDataFresh');
   return ensureCalendarPulseWeek_(repairLegacyPulse_(legacy));
 }
}
async function loadData(){
 const btn=document.getElementById('refreshBtn');btn.disabled=true;btn.textContent='Читаю DEMO…';
 document.getElementById('pulseError').classList.add('hidden');
 try{
   const data=await loadPulseData_();
   appData=data;activeWeek=data.meta.currentWeek;setupWeeks();renderSelectedWeek();
 }catch(err){showError(err&&err.message?err.message:String(err));}
 finally{btn.disabled=false;btn.textContent='Обновить последние 3 дня';}
}
function showRefreshError(msg){
 const b=document.getElementById('pulseError');
 b.textContent='Не удалось обновить последние 3 дня: '+msg;
 b.classList.remove('hidden');
}
async function refreshLast3Days(){
 const buttons=[
   document.getElementById('refreshBtn'),
   document.getElementById('mailReload'),
   document.getElementById('newsReload')
 ].filter(Boolean);
 buttons.forEach(button=>{button.disabled=true;});

 document.getElementById('pulseError').classList.add('hidden');
 try{
   buttons.forEach(button=>button.textContent='Обновляю Sendsay…');
   try{
     await rpc('syncSendsayApiLast3Days');
     await rpc('syncDemoStats');
   }catch(syncError){
     const message=String(syncError&&syncError.message?syncError.message:syncError||'');
     if(!/Требуется вход|Сеанс Google|недоступен|not found|not sufficient|permissions/i.test(message))throw syncError;
   }

   buttons.forEach(button=>button.textContent='Забираю 3 дня…');
   const recent=await rpc('getMailRegistryRecentUi',3);
   await mergeRegistryRecent_(recent);

   buttons.forEach(button=>button.textContent='Обновляю Пульс…');
   const data=await loadPulseData_();
   appData=data;activeWeek=data.meta.currentWeek;setupWeeks();renderSelectedWeek();

   if(registryData)renderDemand();
   setHealth(true,'Последние 3 дня перечитаны из свежего серверного хранилища · история осталась в браузере');
 }catch(err){
   showRefreshError(err&&err.message?err.message:String(err));
   setHealth(false,'Ошибка обновления последних 3 дней');
 }finally{
   buttons.forEach(button=>{
     button.disabled=false;
     button.textContent=button.id==='refreshBtn'?'Обновить последние 3 дня':'Обновить 3 дня';
   });
 }
}
async function refreshAllMailRegistry(){
 const buttons=[
   document.getElementById('refreshAllMailBtn'),
   document.getElementById('mailReloadAll'),
   document.getElementById('newsReloadAll')
 ].filter(Boolean);

 buttons.forEach(button=>{button.disabled=true;button.textContent='Загружаю всю историю…';});
 ['mail','news'].forEach(k=>document.getElementById(k+'Status').textContent='Обновляю полный архив писем из служебного хранилища…');

 try{
   await fetchFullRegistryPaged_();
   renderDemand();
   setHealth(true,'Полный архив писем обновлён · в браузере '+fmt((registryData||[]).length)+' записей');
 }catch(err){
   ['mail','news'].forEach(k=>document.getElementById(k+'Status').textContent='Не удалось обновить полный архив: '+(err&&err.message?err.message:String(err)));
   setHealth(false,'Ошибка полного обновления писем');
 }finally{
   buttons.forEach(button=>{button.disabled=false;button.textContent='Обновить все письма';});
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
 document.getElementById('products').innerHTML=products.map(p=>{const cls=productClass(p),gap=Math.max(0,n(p.plan)-n(p.green)),total=n(p.red)+n(p.yellow)+n(p.green);return `<article class="product ${cls}"><div class="producttop"><h3>${esc(p.product)}</h3><span class="status ${cls}">${productStatus(p)}</span></div><div class="metricrow"><div class="metricbox fact"><span>Факт</span><strong>${fmt(p.green)}</strong><small>зелёных демо</small></div><div class="metricbox plan"><span>План</span><strong>${fmt(p.plan)}</strong><small>зелёных демо</small></div><div class="metricbox progress ${progressTone(p.progress)}"><span>Выполнение</span><strong>${pct(p.progress)}</strong><small>до плана ${fmt(gap)}</small></div></div><div class="bar"><i style="width:${Math.min(100,n(p.progress))}%"></i></div><div class="gapline"><span>Факт <b>${fmt(p.green)}</b> из <b>${fmt(p.plan)}</b></span><span>До плана <b>${fmt(gap)}</b></span></div><div class="triplet"><div class="mini"><span>Зелёные</span><b>${fmt(p.green)}</b></div><div class="mini reserve"><span>Жёлтые</span><b>${fmt(p.yellow)}</b></div><div class="mini red"><span>Красные</span><b>${fmt(p.red)}</b></div></div><div class="green-share"><span>Доля зелёных из всех полученных демо</span><strong>${total>0?pct(n(p.green)/total*100):"—"}</strong><small>${fmt(p.green)} из ${fmt(total)} демо</small></div><div class="decision"><b>Что делать</b>${esc(cleanDecision(p.decision))}<small>Зелёные + жёлтые: ${fmt(n(p.green)+n(p.yellow))} при плане ${fmt(p.plan)}</small></div></article>`}).join('');
 document.getElementById('decisions').innerHTML=products.map(p=>`<div class="decisionrow"><b>${esc(p.product)}</b><span>разрыв ${fmt(Math.max(0,n(p.plan)-n(p.green)))}</span><p>${esc(cleanDecision(p.decision))}</p></div>`).join('');
 const weeks=appData.weeks||[],maxPlan=Math.max(1,...weeks.map(w=>n(w.plan)));
 document.getElementById('weeks').innerHTML=weeks.slice(-8).map(w=>`<div class="weekrow" data-week="${w.week}"><span><b>Неделя ${w.week}</b>${rangeLabel(year,w.week)}</span><div class="weekbar"><i style="width:${Math.min(100,n(w.green)/maxPlan*100)}%"></i></div><b>${fmt(w.green)} / ${fmt(w.plan)}</b></div>`).join('');
 document.querySelectorAll('.weekrow').forEach(row=>row.addEventListener('click',()=>{activeWeek=Number(row.dataset.week);document.getElementById('weekSelect').value=String(activeWeek);renderSelectedWeek()}));
}


let registryData=null,registryPromise=null,registryCacheSavedAt='';
const registryLimits={mail:100,news:100};
const REGISTRY_CACHE_DB='analytics-center-cache';
const REGISTRY_CACHE_STORE='kv';
const REGISTRY_CACHE_KEY='mail-registry-v7';
const REGISTRY_CACHE_VERSION=7;
let registryCacheTimer=null;

function isNewsMail(x){return /^Gosfinansi_letter_news_GF_digest(?:_|$)/i.test(x.campaign||'')||/^letter_news_goszakaz_regular_news_digest(?:_|$)/i.test(x.campaign||'');}
function keepMailInReport_(x){
 if(isNewsMail(x))return true;
 const text=[x&&x.campaign,x&&x.segment,x&&x.type,x&&x.fileName,x&&x.issueName,x&&x.name].filter(Boolean).join(' ');
 // Вкладка «Письма» содержит только DEMO-рассылки.
 if(/trigg?er|триггер/i.test(text))return false;
 const type=String(x&&x.type||'').trim().toLowerCase();
 return type==='demo'||/(?:^|[_\s|])demo(?:[_\s|]|$)/i.test(text);
}
function mailDate(x){const t=String(x.time||'00:00').split(':').map(v=>v.padStart(2,'0')).join(':');return String(x.date||'')+'T'+t;}
function mailWeek_(x){
 const ready=Number(x&&x.week);
 if(ready)return ready;
 const iso=String(x&&x.date||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return 0;
 const d=new Date(iso+'T12:00:00Z');
 const day=d.getUTCDay()||7;
 d.setUTCDate(d.getUTCDate()+4-day);
 const start=new Date(Date.UTC(d.getUTCFullYear(),0,1));
 return Math.ceil((((d-start)/86400000)+1)/7);
}
function populateMailWeeks_(){
 const select=document.getElementById('mailWeek');
 if(!select)return;
 const previous=select.value;
 const mailRows=(registryData||[]).filter(x=>!isNewsMail(x));
 const weeks=[...new Set(mailRows.map(mailWeek_).filter(Boolean))].sort((a,b)=>b-a);
 let year=new Date().getFullYear();
 const first=mailRows.find(x=>/^\d{4}-/.test(String(x.date||'')));
 if(first)year=Number(String(first.date).slice(0,4))||year;
 select.innerHTML='<option value="">Все недели</option>'+weeks.map(w=>'<option value="'+w+'">Неделя '+w+' · '+esc(rangeLabel(year,w))+'</option>').join('');
 if(previous&&weeks.includes(Number(previous)))select.value=previous;
 else if(weeks.length)select.value=String(weeks[0]);
}
function mailWeekSummaryHtml_(rows,selectedWeek){
 if(!selectedWeek)return '<div class="mail-week-note">Выберите неделю, чтобы сравнить объём отправок по продуктам и сегментам.</div>';
 const logical=logicalMailRows_(rows||[]);
 if(!logical.length)return '<div class="mail-week-note">За эту неделю писем по выбранным условиям нет.</div>';
 const preferred=['Живые','Дожим демо','Все доступные','Клики','Демо','Несколько сегментов'];
 const segmentSet=new Set(logical.map(x=>String(x.segment||'Демо')));
 const segments=[...segmentSet].sort((a,b)=>{
   const ai=preferred.indexOf(a),bi=preferred.indexOf(b);
   if(ai>=0||bi>=0)return (ai<0?999:ai)-(bi<0?999:bi);
   return a.localeCompare(b,'ru');
 });
 const map=new Map();
 logical.forEach(x=>{
   const product=String(x.product||'Не указано'),segment=String(x.segment||'Демо');
   if(!map.has(product))map.set(product,{product,total:0,red:0,yellow:0,green:0,segments:{}});
   const row=map.get(product),delivered=n(x.delivered);
   row.total+=delivered;
   row.red+=n(x.red);
   row.yellow+=n(x.yellow);
   row.green+=n(x.green);
   row.segments[segment]=(row.segments[segment]||0)+delivered;
 });
 const products=[...map.values()].sort((a,b)=>a.product.localeCompare(b.product,'ru'));
 const header='<tr><th>Продукт</th>'+segments.map(s=>'<th>'+esc(s)+'</th>').join('')+'<th>Доставлено всего</th><th>DEMO R / Y / G</th></tr>';
 const body=products.map(r=>'<tr><td><b>'+esc(r.product)+'</b></td>'+segments.map(s=>'<td>'+fmt(r.segments[s]||0)+'</td>').join('')+'<td><b>'+fmt(r.total)+'</b></td><td><b class="demo-r">'+fmt(r.red)+'</b> / <b class="demo-y">'+fmt(r.yellow)+'</b> / <b class="demo-g">'+fmt(r.green)+'</b></td></tr>').join('');
 return '<div class="mail-week-head"><div><b>Доставлено за неделю '+esc(String(selectedWeek))+'</b><span>Сумма доставленных писем по сегментам и продуктам. Справа — DEMO: красные / жёлтые / зелёные за ту же неделю.</span></div></div><div class="registry mail-week-table"><table><thead>'+header+'</thead><tbody>'+body+'</tbody></table></div>';
}
function safeLink(url,label){return /^https?:\/\//i.test(String(url||''))?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:'';}

function registryDb_(){
 return new Promise((resolve,reject)=>{
  if(!window.indexedDB)return reject(new Error('IndexedDB недоступен'));
  const req=indexedDB.open(REGISTRY_CACHE_DB,1);
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(REGISTRY_CACHE_STORE))db.createObjectStore(REGISTRY_CACHE_STORE);};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||new Error('Не удалось открыть кэш браузера'));
 });
}
async function registryCacheRead_(){
 const db=await registryDb_();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(REGISTRY_CACHE_STORE,'readonly');
  const store=tx.objectStore(REGISTRY_CACHE_STORE);
  const keys=[REGISTRY_CACHE_KEY,'mail-registry-v6','mail-registry-v5','mail-registry-v4'];
  let index=0;
  const next=()=>{
    if(index>=keys.length){db.close();resolve(null);return;}
    const key=keys[index++];
    const req=store.get(key);
    req.onsuccess=()=>{
      const value=req.result;
      if(value&&Array.isArray(value.emails)&&value.emails.length){
        db.close();
        resolve({...value,_fallbackKey:key});
      }else next();
    };
    req.onerror=()=>next();
  };
  next();
 });
}
async function registryCacheWrite_(emails){
 const payload={version:REGISTRY_CACHE_VERSION,savedAt:new Date().toISOString(),emails:Array.isArray(emails)?emails:[]};
 const db=await registryDb_();
 await new Promise((resolve,reject)=>{
  const tx=db.transaction(REGISTRY_CACHE_STORE,'readwrite');
  tx.objectStore(REGISTRY_CACHE_STORE).put(payload,REGISTRY_CACHE_KEY);
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||new Error('Не удалось сохранить кэш'));
  tx.onabort=()=>reject(tx.error||new Error('Сохранение кэша отменено'));
 });
 db.close();registryCacheSavedAt=payload.savedAt;
 return payload;
}
function scheduleRegistryCacheSave_(){
 clearTimeout(registryCacheTimer);
 registryCacheTimer=setTimeout(()=>{if(registryData)registryCacheWrite_(registryData).catch(()=>{});},1200);
}
function applyRegistryData_(emails,savedAt){
 registryData=(emails||[]).filter(keepMailInReport_).slice().sort((a,b)=>mailDate(b).localeCompare(mailDate(a)));
 registryCacheSavedAt=savedAt||registryCacheSavedAt||'';
 for(const key of ['mail','news']){
  const el=document.getElementById(key+'Product'),prev=el.value;
  const products=[...new Set(registryData.filter(x=>key==='news'?isNewsMail(x):!isNewsMail(x)).map(x=>x.product).filter(Boolean))].sort();
  el.innerHTML='<option value="">Все продукты</option>'+products.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');
  el.value=products.includes(prev)?prev:'';
 }
 populateMailWeeks_();
 renderRegistries();
}
function registryCacheNote_(){
 return registryCacheSavedAt?' · кэш браузера '+dateRu(registryCacheSavedAt):'';
}
async function fetchFullRegistryPaged_(){
 ['mail','news'].forEach(k=>document.getElementById(k+'Status').textContent=
   'Загружаю полный архив писем. Это делается один раз для этого браузера…');

 const data=await rpc('getMailRegistryUi');
 const emails=Array.isArray(data&&data.emails)?data.emails:[];
 applyRegistryData_(emails,data&&data.readAt?data.readAt:new Date().toISOString());
 await registryCacheWrite_(registryData);
 return registryData;
}
async function loadRegistry(){
 if(registryPromise)return registryPromise;
 if(registryData){renderRegistries();return registryData;}
 ['mail','news'].forEach(k=>document.getElementById(k+'Status').textContent='Открываю сохранённые письма…');

 registryPromise=(async()=>{try{
   try{
     const cached=await registryCacheRead_();
     if(cached&&Array.isArray(cached.emails)&&cached.emails.length){
       applyRegistryData_(cached.emails,cached.savedAt);
       if(cached._fallbackKey&&cached._fallbackKey!==REGISTRY_CACHE_KEY){
         registryCacheWrite_(registryData).catch(()=>{});
       }
       return registryData;
     }
   }catch(cacheError){}

   ['mail','news'].forEach(k=>document.getElementById(k+'Status').textContent='Первичная загрузка всей истории. Один раз сохраняю её в этом браузере…');
   return await fetchFullRegistryPaged_();
 }catch(e){
   ['mail','news'].forEach(k=>document.getElementById(k+'Status').textContent='Не удалось загрузить письма: '+e.message);
   throw e;
 }finally{registryPromise=null;}})();
 return registryPromise;
}
async function mergeRegistryRecent_(recent){
 const payload=recent||{},from=String(payload.from||''),to=String(payload.to||'');
 const current=(Array.isArray(registryData)?registryData:[]).filter(keepMailInReport_);
 const previous=new Map(current.map(item=>[item.id,item]));
 const fresh=(payload.emails||[]).filter(keepMailInReport_).map(item=>{
   const old=previous.get(item.id);
   if(old&&old.materialData&&!item.materialData)item.materialData=old.materialData;
   return item;
 });
 const kept=current.filter(item=>!from||!to||item.date<from||item.date>to);
 const merged=new Map();
 kept.concat(fresh).forEach(item=>{if(item&&item.id)merged.set(item.id,item);});
 applyRegistryData_([...merged.values()],payload.readAt||new Date().toISOString());
 try{await registryCacheWrite_(registryData);}catch(cacheError){}
 return registryData;
}
function logicalMailRows_(rows){
 const groups=new Map();
 const subjectKey=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
 const minute=value=>String(value||'').trim().slice(0,5);

 (rows||[]).forEach(mail=>{
   const key=[mail.date,minute(mail.time),mail.product,mail.type,subjectKey(mail.subject)].join('|');
   let group=groups.get(key);
   if(!group){
     group={...mail,_members:[mail],campaignCount:1};
     groups.set(key,group);
     return;
   }
   group._members.push(mail);
   group.campaignCount=group._members.length;
 });

 return [...groups.values()].map(group=>{
   if(group._members.length===1){delete group._members;return group;}

   const members=group._members;
   const sum=field=>members.reduce((total,item)=>total+n(item[field]),0);
   const sent=sum('sent'),delivered=sum('delivered'),opened=sum('uniqueOpened'),clicks=sum('clicks');
   const red=sum('red'),yellow=sum('yellow'),green=sum('green');
   const campaigns=[...new Set(members.map(item=>item.campaign).filter(Boolean))];
   const segments=[...new Set(members.map(item=>item.segment).filter(Boolean))];
   const links=members.map(item=>({campaign:item.campaign,url:item.sendsay})).filter(item=>item.url);

   group.id='logical:'+members.map(item=>item.id).join(',');
   group.sent=sent;
   group.delivered=delivered;
   group.uniqueOpened=opened;
   group.clicks=clicks;
   group.openRate=delivered?opened/delivered*100:null;
   group.clickRate=delivered?clicks/delivered*100:null;
   group.ctor=opened?clicks/opened*100:null;
   group.red=red;group.yellow=yellow;group.green=green;
   group.potential=yellow+green;
   group.hasDemoData=members.some(item=>item.hasDemoData===true);
   group.campaign=campaigns.join(' · ');
   group.segment=segments.length===1?segments[0]:'Несколько сегментов';
   group.campaignLinks=links;
   delete group._members;
   return group;
 });
}
function renderRegistries(){for(const key of ['mail','news']){
 if(key==='news'){renderNewsLetters();renderNewsMaterials();continue;}
 const query=document.getElementById(key+'Search').value.trim().toLowerCase(),product=document.getElementById(key+'Product').value;
 const weekEl=document.getElementById('mailWeek'),selectedWeek=weekEl?Number(weekEl.value)||0:0;
 const sourceRows=(registryData||[]).filter(x=>(key==='news'?isNewsMail(x):!isNewsMail(x))&&(!selectedWeek||mailWeek_(x)===selectedWeek)&&(!product||x.product===product)&&(!query||[x.subject,x.campaign,x.segment].join(' ').toLowerCase().includes(query)));
 const rows=key==='mail'?logicalMailRows_(sourceRows):sourceRows;
 const summary=document.getElementById('mailWeekSummary');if(summary)summary.innerHTML=mailWeekSummaryHtml_(sourceRows,selectedWeek);
 document.getElementById(key+'Status').textContent='Писем в кэше: '+fmt(rows.length)+' · показано '+fmt(Math.min(rows.length,registryLimits[key]))+' · от новых к старым'+registryCacheNote_()+(key==='news'?' · Новости сопоставлены: '+(registryData||[]).filter(m=>isNewsMail(m)&&m.materialData).length+'/'+(registryData||[]).filter(isNewsMail).length:'');
 document.getElementById(key+'Rows').innerHTML=rows.length?`<table><thead><tr><th>Отправлено</th><th>Продукт / тип</th><th>Письмо</th><th>Доставлено</th><th>Открыли</th><th>Кликнули</th><th>DEMO: R / Y / G</th></tr></thead><tbody>${rows.slice(0,registryLimits[key]).map(x=>`<tr><td>${esc(x.date)}<br>${esc(x.time||'')}</td><td>${esc(x.product)}<small>${isNewsMail(x)?'Новости':/activdemo/i.test(x.campaign||'')?'Дожим демо':esc(x.segment||'Демо')}${x.campaignCount>1?' · '+fmt(x.campaignCount)+' сегмента Sendsay':''}</small></td><td>${key==='mail'?`<b>${safeLink(x.sendsay,x.subject)||esc(x.subject)}</b>`:`<b>${esc(x.subject)}</b><details><summary>Подробности</summary><p>${esc(x.campaign)}</p>${safeLink(x.sendsay,'Открыть Sendsay')}<p>${esc(isNewsMail(x)?(x.materialData?.note||'Автоматически сопоставляем ссылки материалов с Content / Term.'):x.note||x.maturity||'')}</p>${(isNewsMail(x)?[]:x.demoEvidence||[]).map(d=>`<p>${safeLink(d.sourceUrl,d.source)} · ${esc(d.product)}<br>${esc(d.campaign)}<br>R ${fmt(d.red)} / Y ${fmt(d.yellow)} / G ${fmt(d.green)}</p>`).join('')}${isNewsMail(x)?materialDetails(x):`<button class="material-demo" data-mail-id="${esc(x.id)}">Сопоставить материалы по Content / Term</button><div class="material-result"></div>`}</details>`}</td><td>${fmt(x.delivered)}</td><td>${x.openRate==null?"—":pct(x.openRate)}</td><td>${x.clickRate==null?"—":pct(x.clickRate)}</td><td>${isNewsMail(x)?materialSummary(x):x.hasDemoData===true?`R ${fmt(x.red)} / Y ${fmt(x.yellow)} / G ${fmt(x.green)}`:`R 0 / Y 0 / G 0<small>В статистике DEMO событий нет</small>`}</td></tr>`).join('')}</tbody></table>`:'<div class="placeholder">Нет писем по выбранным условиям.</div>';
 document.getElementById(key+'More').classList.toggle('hidden',rows.length<=registryLimits[key]);
 document.getElementById(key+'Rows').querySelectorAll('.material-demo').forEach(button=>button.onclick=()=>loadMaterialDemo(button));
}}
function renderNewsLetters(){
 const query=document.getElementById('newsSearch').value.trim().toLowerCase(),product=document.getElementById('newsProduct').value;
 const rows=(registryData||[]).filter(isNewsMail).filter(x=>(!product||x.product===product)&&(!query||[x.subject,x.campaign].join(' ').toLowerCase().includes(query)));
 document.getElementById('newsStatus').textContent='Писем: '+fmt(rows.length)+' · свежие сверху'+registryCacheNote_()+'. Демо материалов — в разделе «Какие новости дают демо».';
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
  renderRegistries();opened.forEach(([key,i])=>{const d=document.querySelectorAll('#'+key+'Rows tbody tr')[i]?.querySelector('details');if(d)d.open=true;});renderDemand();scheduleRegistryCacheSave_();
 }
}
async function loadMaterialDemo(button){
 const box=button.nextElementSibling;button.disabled=true;box.textContent='Читаю ссылки письма и термы в статистике…';
 try{const data=await rpc('getMailDemoDetailsUi',button.dataset.mailId);box.innerHTML=`<p>${esc(data.note)}</p><p>Найдено материалов в письме: ${data.materials.length}. Совпадений Content / Term: ${data.rows.length}. За все доступные недели.</p>`+data.rows.map(r=>`<p>${safeLink(r.url,r.content+' / '+r.term)} · ${esc(r.product)}<br>${safeLink(r.sourceUrl,r.source)}<br>${r.values?`R ${fmt(r.values.red)} / Y ${fmt(r.values.yellow)} / G ${fmt(r.values.green)}`:'Неделя отсутствует в источнике'}</p>`).join('')+(data.rows.length?'':'<p>В этих листах не найдены пары Content / Term для ссылок данного письма.</p>');}catch(e){box.textContent='Не удалось сопоставить: '+e.message;}finally{button.disabled=false;}
}
for(const key of ['mail','news']){
 for(const suffix of ['Search','Product'])document.getElementById(key+suffix).addEventListener(suffix==='Search'?'input':'change',()=>{registryLimits[key]=100;renderRegistries();});
 if(key==='mail'){const week=document.getElementById('mailWeek');if(week)week.addEventListener('change',()=>{registryLimits.mail=100;renderRegistries();});}
 document.getElementById(key+'Reload').onclick=()=>refreshLast3Days();
 const allBtn=document.getElementById(key+'ReloadAll');
 if(allBtn)allBtn.onclick=()=>refreshAllMailRegistry();
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
let demandPlanRows=null,demandPlanPromise=null,demandPlanError='',demandPlanLoaded=false,demandPlanLoadedCount=0;
let demandTempRows=null,demandTempPromise=null,demandTempError='',demandTempLoaded=false;
const DEMAND_TEMPPLAN_ID='12FtI2gu4lv3x8azRYu8F8aGEFzwi8ESUpUzFlPuipFo';
const DEMAND_TEMPPLAN_SHEETS=[
 {gid:'0',product:'ГФ Периодика',name:'ТемыГФ_Периодика'},
 {gid:'917101292',product:'ГФ Система',name:'ТемыГФ_СС'},
 {gid:'1427980339',product:'ГЗ Периодика',name:'Тема ГЗ Периодика'},
 {gid:'1889426479',product:'ГЗ Система',name:'Темы ГЗ СС'}
];

function demandNormText(v){
 return String(v||'').toLowerCase().replace(/ё/g,'е').replace(/[«»"“”„'’]/g,'').replace(/[^a-zа-я0-9]+/gi,' ').replace(/\s+/g,' ').trim();
}
function demandDraftId(v){
 const m=String(v||'').match(/(?:campaigns\/issues\/draft-|content\/drafts\/email\/)(\d+)/i);
 return m?m[1]:'';
}
function demandReportId(v){
 const m=String(v||'').match(/\/reports\/campaigns\/(\d+)/i);
 return m?m[1]:'';
}
function demandUrls(v){
 return (String(v||'').match(/https?:\/\/[^\s<>"'\])}]+/gi)||[]).map(x=>x.replace(/[.,;:]+$/,''));
}
function demandIsMaterialUrl(url){
 return /^https?:\/\/(?:[^/]+\.)?(?:budgetnik\.ru|zpbudgetnik\.ru|gosfinansy\.ru|goszakupkiru\.ru|goszakaz-vo\.ru|faspraktika\.ru|1gzakaz\.ru|gzakypki\.ru|pro-goszakaz\.ru)\//i.test(String(url||''));
}
function demandGviz(spec){
 return new Promise((resolve,reject)=>{
  const cb='analyticsTempplan_'+Date.now()+'_'+Math.random().toString(36).slice(2);
  const script=document.createElement('script');
  const timer=setTimeout(()=>finish(new Error('Темплан не ответил')),30000);
  function cleanup(){clearTimeout(timer);delete window[cb];script.remove();}
  function finish(error,data){cleanup();error?reject(error):resolve(data);}
  window[cb]=response=>{
   if(!response||response.status!=='ok')return finish(new Error((response?.errors||[]).map(e=>e.detailed_message||e.message).filter(Boolean).join('; ')||'Ошибка чтения темплана'));
   finish(null,response.table||{rows:[]});
  };
  const url=new URL('https://docs.google.com/spreadsheets/d/'+DEMAND_TEMPPLAN_ID+'/gviz/tq');
  url.searchParams.set('gid',spec.gid);
  url.searchParams.set('headers','0');
  url.searchParams.set('tq','select A,B,C,D,E,F,G,H,I,J');
  url.searchParams.set('tqx','out:json;responseHandler:'+cb);
  url.searchParams.set('_',Date.now());
  script.onerror=()=>finish(new Error('Не удалось открыть лист темплана '+spec.name));
  script.src=url.href;document.head.append(script);
 });
}
function demandTempRowsFrom(table,spec){
 const rows=table?.rows||[],out=[];
 rows.forEach((row,index)=>{
  const cells=(row.c||[]).map(cell=>cell==null?'':String(cell.f??cell.v??''));
  while(cells.length<10)cells.push('');
  const subjects=[cells[2],cells[3]].map(v=>String(v||'').trim()).filter(v=>v&&!/^тема письма$|^заг внутри рассылки$|^заголовок$/i.test(v)&&!/^https?:\/\//i.test(v));
  const text=cells.join('\n'),urls=demandUrls(text);
  const drafts=[...new Set(urls.map(demandDraftId).filter(Boolean))];
  const reports=[...new Set(urls.map(demandReportId).filter(Boolean))];
  const materials=[...new Set(urls.filter(demandIsMaterialUrl))];
  if(!subjects.length||(!drafts.length&&!reports.length&&!materials.length))return;
  out.push({product:spec.product,sheet:spec.name,row:index+1,subjects,subjectNorms:subjects.map(demandNormText),draftIds:drafts,reportIds:reports,materialUrls:materials});
 });
 return out;
}
async function loadDemandTempRows(force=false){
 if(demandTempPromise)return demandTempPromise;
 if(demandTempLoaded&&!force)return demandTempRows||[];
 demandTempPromise=(async()=>{
  if(force){demandTempRows=[];demandTempLoaded=false;demandTempError='';}
  const results=await Promise.allSettled(DEMAND_TEMPPLAN_SHEETS.map(async spec=>demandTempRowsFrom(await demandGviz(spec),spec)));
  demandTempRows=[];const errors=[];
  results.forEach((result,i)=>{if(result.status==='fulfilled')demandTempRows.push(...result.value);else errors.push(DEMAND_TEMPPLAN_SHEETS[i].name+': '+(result.reason?.message||result.reason));});
  demandTempError=errors.join(' · ');demandTempLoaded=true;
  if(registryData)renderDemand();
  return demandTempRows;
 })().finally(()=>{demandTempPromise=null;});
 return demandTempPromise;
}
function demandTempRowsForMail(mail){
 if(!Array.isArray(demandTempRows)||!mail)return[];
 const product=demandProductKey(mail.product||mail.productFlow);
 let candidates=demandTempRows.filter(r=>r.product===product);
 if(!candidates.length)return[];
 const report=demandReportId(mail.sendsay);
 if(report){
  const exact=candidates.filter(r=>r.reportIds.includes(report));
  if(exact.length)return exact;
 }
 const subject=demandNormText(mail.subject);
 if(!subject)return[];
 const exactSubject=candidates.filter(r=>r.subjectNorms.includes(subject));
 if(exactSubject.length===1)return exactSubject;
 if(exactSubject.length>1){
  const withMaterial=exactSubject.filter(r=>r.materialUrls.length);
  if(withMaterial.length===1)return withMaterial;
 }
 return[];
}
function demandDateKey(v){
 const s=String(v||'').trim();let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
 if(m)return m[1]+'-'+String(Number(m[2])).padStart(2,'0')+'-'+String(Number(m[3])).padStart(2,'0');
 m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
 if(m)return m[3]+'-'+String(Number(m[2])).padStart(2,'0')+'-'+String(Number(m[1])).padStart(2,'0');
 return s;
}
function demandProductKey(v){
 const s=demandNormText(v);
 const group=/(?:^| )гф(?: |$)|госфинанс/.test(s)?'ГФ':/(?:^| )гз(?: |$)|госзаказ/.test(s)?'ГЗ':'';
 let family='';
 if(/период|гзру|госзакупки ru|убу|збу|апфас|гзвио|(?:^| )вио(?: |$)/.test(s))family='Периодика';
 else if(/система|(?:^| )сс(?: |$)/.test(s))family='Система';
 else if(/школ/.test(s))family='Школа';
 return group&&family?group+' '+family:'';
}
function demandFlowKey(v){
 const s=demandNormText(v);
 if(/апфас/.test(s))return'apfas';
 if(/гзвио|(?:^| )вио(?: |$)/.test(s))return'vio';
 if(/(?:^| )збу(?: |$)/.test(s))return'zbu';
 if(/(?:^| )убу(?: |$)/.test(s))return'ubu';
 if(/гзру|госзакупки ru/.test(s))return'gzru';
 return'';
}
function demandMailSlot(mail){
 const raw=String(mail?.campaign||'').toLowerCase(),s=demandNormText((mail?.segment||'')+' '+raw);
 if(/activdemo/i.test(raw)){
  if(/activdemo[^a-zа-я0-9]*d(?:[^a-zа-я0-9]|$)/i.test(raw)||/_activdemo_d_/i.test(raw))return'active-day';
  return'active';
 }
 if(/клик|open/.test(s)||/_open_/i.test(raw))return'warm';
 if(/_d(?:_|\.|$)/i.test(raw)||/досыл|дожим/.test(s))return'dosyl';
 if(/_1(?:_|\.|$)/i.test(raw)||/все доступ|дополнитель/.test(s))return'extra';
 return'main';
}
function demandPlanSlot(v){
 const s=demandNormText(v);
 if(/активдемо/.test(s))return /день|(?:^| )4(?: |$)/.test(s)?'active-day':'active';
 if(/клик|open/.test(s))return'warm';
 if(/досыл|дожим/.test(s))return'dosyl';
 if(/все доступ|дополнитель/.test(s))return'extra';
 if(/живые|main|основн/.test(s))return'main';
 return'';
}
function demandPlanRowsFrom(data){
 const headers=data?.headers||[],rows=data?.rows||[],idx=name=>headers.indexOf(name);
 const dateI=idx('Дата'),productI=idx('Продукт / поток'),segmentI=idx('Сегмент'),subjectI=idx('Тема письма'),urlI=idx('Ссылка на материал'),sourceI=idx('Основание: DEMO / клики / источник');
 if([dateI,productI,segmentI,subjectI,urlI].some(i=>i<0))return[];
 return rows.flatMap(r=>{
  const url=String(r[urlI]||'').trim(),product=demandProductKey(r[productI]);
  if(!/^https?:\/\//i.test(url)||!/^(?:ГФ|ГЗ) (?:Периодика|Система)$/.test(product))return[];
  return [{
   date:demandDateKey(r[dateI]),product,flow:demandFlowKey(r[productI]),slot:demandPlanSlot(r[segmentI]),
   subject:String(r[subjectI]||'').trim(),subjectNorm:demandNormText(r[subjectI]),url,
   draftId:sourceI>=0?demandDraftId(r[sourceI]):''
  }];
 });
}
async function loadDemandPlanRows(force=false){
 if(demandPlanPromise)return demandPlanPromise;
 if(demandPlanLoaded&&!force)return demandPlanRows||[];
 demandPlanPromise=(async()=>{
  if(force){demandPlanRows=[];demandPlanLoaded=false;demandPlanLoadedCount=0;demandPlanError='';}
  if(!Array.isArray(demandPlanRows))demandPlanRows=[];
  const first=await rpc('getVikaPlanUi',null),seen=new Set();
  const ingest=data=>{
   const rows=demandPlanRowsFrom(data);
   const existing=new Set(demandPlanRows.map(r=>[r.date,r.product,r.flow,r.slot,r.url].join('|')));
   for(const row of rows){const key=[row.date,row.product,row.flow,row.slot,row.url].join('|');if(!existing.has(key)){demandPlanRows.push(row);existing.add(key);}}
   demandPlanLoadedCount++;
   if(registryData)renderDemand();
  };
  ingest(first);seen.add(String(first?.selected?.id||''));
  const plans=(first?.plans||[]).slice().sort((a,b)=>Number(b.week||0)-Number(a.week||0));
  for(const plan of plans){
   if(seen.has(String(plan.id)))continue;
   seen.add(String(plan.id));
   try{ingest(await rpc('getVikaPlanUi',plan.id));}catch(e){demandPlanError=e.message||String(e);}
  }
  demandPlanLoaded=true;
  return demandPlanRows;
 })().catch(e=>{demandPlanError=e.message||String(e);demandPlanLoaded=true;throw e;}).finally(()=>{demandPlanPromise=null;if(registryData)renderDemand();});
 return demandPlanPromise;
}
function demandPlanLinksForMail(mail){
 if(!Array.isArray(demandPlanRows)||!mail)return[];
 const date=demandDateKey(mail.date),product=demandProductKey(mail.product||mail.productFlow);
 if(!/^(?:ГФ|ГЗ) (?:Периодика|Система)$/.test(product))return[];
 const tempDrafts=new Set(demandTempRowsForMail(mail).flatMap(r=>r.draftIds||[]));
 if(tempDrafts.size){
  const byDraft=demandPlanRows.filter(r=>r.product===product&&r.draftId&&tempDrafts.has(r.draftId));
  if(byDraft.length)return byDraft;
 }
 let candidates=demandPlanRows.filter(r=>r.date===date&&r.product===product);
 if(!candidates.length)return[];
 const subject=demandNormText(mail.subject),exact=candidates.filter(r=>r.subjectNorm&&r.subjectNorm===subject);
 if(exact.length===1)return exact;
 const mailFlow=demandFlowKey((mail.productFlow||'')+' '+(mail.product||'')+' '+(mail.campaign||''));
 if(mailFlow){
  const byFlow=candidates.filter(r=>r.flow===mailFlow);
  if(byFlow.length)candidates=byFlow;
 }
 const slot=demandMailSlot(mail),bySlot=candidates.filter(r=>r.slot===slot);
 if(bySlot.length===1)return bySlot;
 if(candidates.length===1)return candidates;
 return[];
}
function demandPlanLinksForTopic(topic){
 const links=new Map();
 for(const letter of topic.letters||[]){
  const mail=(registryData||[]).find(m=>m.id===letter.id);
  for(const row of demandPlanLinksForMail(mail))if(!links.has(row.url))links.set(row.url,row);
 }
 return [...links.values()];
}
function demandResolvedLinksForTopic(topic){
 const links=new Map();
 if(topic.materialUrl)links.set(topic.materialUrl,{url:topic.materialUrl,source:'DEMO'});
 for(const letter of topic.letters||[]){
  const mail=(registryData||[]).find(m=>m.id===letter.id);if(!mail)continue;
  for(const row of demandTempRowsForMail(mail))for(const url of row.materialUrls||[])if(!links.has(url))links.set(url,{url,source:'Темплан',row});
  for(const row of demandPlanLinksForMail(mail))if(!links.has(row.url))links.set(row.url,{url:row.url,source:'План Вики',row});
 }
 return [...links.values()];
}
function demandMailTopics(emails){
 const seen=new Set(),groups=new Map();
 for(const mail of emails){
  if(mail.materialData){for(const r of mail.materialData.rows){const key=r.sourceUrl;if(seen.has(key))continue;seen.add(key);const groupKey=r.product+'|'+r.url;if(!groups.has(groupKey))groups.set(groupKey,{title:r.title,materialUrl:r.url,product:r.product,red:0,yellow:0,green:0,letters:[],lastDate:mail.date});const item=groups.get(groupKey);for(const k of ['red','yellow','green'])item[k]+=n(r.values[k]);item.letters.push({date:'Все доступные недели',campaign:'Content '+r.content+' / Term '+r.term,url:r.sourceUrl,sendsay:r.url,material:true});}}
  if(/^Gosfinansi_letter_news_GF_digest|^letter_news_goszakaz_regular_news_digest/i.test(mail.campaign||'')||!mail.hasDemoData)continue;
  for(const evidence of mail.demoEvidence||[]){
   const key=evidence.sourceUrl||evidence.source+'|'+evidence.product+'|'+evidence.campaign;
   if(seen.has(key))continue;seen.add(key);
   const title=String(mail.subject||'Без темы').trim();
   if(/деактиваци|доступ.{0,25}(?:сгор|закрыт|заблок)|(?:сгор|заблок).{0,25}доступ|зарегистрирован доступ|доступ подписчика|открыли для вас доступ|уйдет в архив/i.test(title))continue;
   const groupKey=evidence.product+'|'+title.toLowerCase();
   if(!groups.has(groupKey))groups.set(groupKey,{title,product:evidence.product,red:0,yellow:0,green:0,letters:[],lastDate:mail.date});
   const item=groups.get(groupKey);for(const metric of ['red','yellow','green'])item[metric]+=n(evidence[metric]);
   item.letters.push({id:mail.id,date:mail.date,campaign:mail.campaign,url:evidence.sourceUrl,sendsay:mail.sendsay});
  }
 }
 return [...groups.values()].sort((a,b)=>b.green-a.green||b.yellow-a.yellow||b.lastDate.localeCompare(a.lastDate));
}
async function loadDemand(force=false){
 if(demandBusy)return;
 demandBusy=true;document.getElementById('demandReload').disabled=true;document.getElementById('demandStatus').textContent='Сопоставляю темы с результатами DEMO…';
 try{
  await loadRegistry(force);
  if(!registryData)throw new Error('Реестр писем не загружен');
  renderDemand();
  await Promise.allSettled([loadDemandTempRows(force),loadDemandPlanRows(force)]);
  renderDemand();
 }catch(e){document.getElementById('demandStatus').textContent='Не удалось загрузить спрос: '+e.message;}
 finally{demandBusy=false;document.getElementById('demandReload').disabled=false;}
}
function renderDemand(){
 if(!registryData)return;
 const q=document.getElementById('demandSearch').value.trim().toLowerCase(),group=document.getElementById('demandGroup').value;
 const emails=registryData.filter(m=>!group||String(m.product||'').startsWith(group));
 const topics=demandMailTopics(registryData).filter(t=>(!group||String(t.product||'').startsWith(group))&&[t.title,t.product].join(' ').toLowerCase().includes(q));
 const matched=emails.filter(m=>m.hasDemoData).length;
 const linked=topics.filter(t=>demandResolvedLinksForTopic(t).length).length;
 const tempState=!demandTempLoaded?' · темплан загружается':demandTempError?' · темплан загружен частично':' · темплан: '+fmt((demandTempRows||[]).length)+' строк';
 const linkState=!demandPlanLoaded?' · план Вики загружается':demandPlanError?' · план Вики загружен частично':'';
 document.getElementById('demandStatus').textContent='Письма: '+fmt(emails.length)+' · Campaign сопоставлен: '+fmt(matched)+' · с материалом: '+fmt(linked)+tempState+linkState;
 document.getElementById('demandSummary').innerHTML=`<div><b>${fmt(topics.filter(t=>t.green>0).length)}</b><span>тем с зелёными демо</span></div><div><b>${fmt(topics.reduce((sum,t)=>sum+t.green,0))}</b><span>зелёных демо по этим темам</span></div><div><b>${fmt(topics.length)}</b><span>тем с сопоставленной статистикой</span></div>`;
 const visibleTopics=topics.slice(0,demandShowAll?topics.length:20);
 document.getElementById('demandDemo').innerHTML=topics.length?`<table><thead><tr><th>Тема / продукт</th><th>Зелёные</th><th>Жёлтые</th><th>Красные</th><th>Основание</th></tr></thead><tbody>${visibleTopics.map(t=>{
  const resolved=demandResolvedLinksForTopic(t),primary=resolved[0]?.url||'';
  const family=demandProductKey(t.product),needsLink=/ (?:Периодика|Система)$/.test(family);
  const extra=resolved.length>1?`<div class="demand-material-links">${resolved.slice(1).map((m,i)=>`<p>↗ ${safeLink(m.url,'Материал '+(i+2))}</p>`).join('')}</div>`:needsLink&&!primary?`<div class="demand-material-links"><small>${demandTempLoaded&&demandPlanLoaded?'Ссылка на материал не найдена в темплане и плане Вики.':'Сопоставляю материал…'}</small></div>`:'';
  return `<tr><td><b>${primary?safeLink(primary,t.title):esc(t.title)}</b><small>${esc(t.product)}</small>${extra}</td><td><b>${fmt(t.green)}</b></td><td>${fmt(t.yellow)}</td><td>${fmt(t.red)}</td><td><details><summary>Метки: ${t.letters.length}</summary>${t.letters.map(m=>`<p>${esc(m.date)} · ${esc(m.campaign)}<br>${safeLink(m.url,'Статистика DEMO')} · ${safeLink(m.sendsay,m.material?'Материал':'Письмо в Sendsay')}</p>`).join('')}</details></td></tr>`;
 }).join('')}</tbody></table>${topics.length>20?`<button id="demandMore">${demandShowAll?'Показать первые 20':'Показать все темы: '+topics.length}</button>`:''}`:'<p>Нет сопоставленных тем по выбранному запросу.</p>';
 const more=document.getElementById('demandMore');if(more)more.onclick=()=>{demandShowAll=!demandShowAll;renderDemand();};
}
document.getElementById('demandReload').onclick=async()=>{registryData=null;demandPlanRows=null;demandPlanLoaded=false;demandPlanLoadedCount=0;demandPlanError='';demandTempRows=null;demandTempLoaded=false;demandTempError='';await loadDemand(true);};
document.getElementById('demandSearch').oninput=renderDemand;
document.getElementById('demandGroup').onchange=()=>{demandShowAll=false;renderDemand();};

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


async function loadSources(){
 const status=document.getElementById('sourcesStatus');
 if(!status)return;
 status.textContent='Загружаю срез источников…';
 try{
  const response=await fetch('demo-sources.json?v='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw new Error('HTTP '+response.status);
  sourceData=await response.json();
  setupSourceFilters();
  renderSources();
 }catch(err){
  status.textContent='Не удалось загрузить источники демо: '+(err&&err.message?err.message:String(err));
 }
}
function sourcePct(part,total){return total?part/total*100:0}
function sourceMetricTotal(x){return n(x&&x.r)+n(x&&x.y)+n(x&&x.g)}
function sourceById(group,id){
 const rows=group&&Array.isArray(group.sources)?group.sources:[];
 return rows.find(function(x){return x.id===id})||{id:id,label:id,total:0,green:0};
}
function sourceScope(){
 return sourceProduct||sourceGroup||'Все';
}
function sourceProductOptions(){
 const select=document.getElementById('sourcesProduct');
 if(!select||!sourceData)return;
 const all=['ГФ Периодика','ГФ Система','ГФ Школа','ГЗ Периодика','ГЗ Система','ГЗ Школа'];
 const allowed=sourceGroup==='ГФ'?all.filter(x=>x.indexOf('ГФ ')===0):sourceGroup==='ГЗ'?all.filter(x=>x.indexOf('ГЗ ')===0):all;
 if(sourceProduct&&!allowed.includes(sourceProduct))sourceProduct='';
 select.innerHTML='<option value="">Все продукты '+(sourceGroup==='Все'?'ГФ и ГЗ':sourceGroup)+'</option>'+allowed.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
 select.value=sourceProduct;
}
function setupSourceFilters(){
 if(!sourceData)return;
 const meta=sourceData.meta||{};
 if(!sourceWeek)sourceWeek=String(meta.currentWeek||40);
 sourceProductOptions();
 const select=document.getElementById('sourcesWeek');
 if(select){
  const current=Number(meta.currentWeek||40);
  const weeks=[];
  for(let w=current;w>=27;w--)weeks.push(w);
  select.innerHTML='<option value="all">Все полные недели '+esc(meta.fullWeeks||'27–39')+'</option>'+
   weeks.map(w=>'<option value="'+w+'">Неделя '+w+(w===current?' · текущая, неполная':'')+'</option>').join('');
  select.value=sourceWeek;
  if(!select.value){sourceWeek=String(current);select.value=sourceWeek;}
 }
}
function sourceWeeklyRows(scope){
 return sourceData&&sourceData.weekly&&Array.isArray(sourceData.weekly[scope])?sourceData.weekly[scope]:[];
}
function sourceRowGroup(row){
 const labels=sourceData&&sourceData.labels||{};
 const sourceLabels=labels.sources||{letter:'Letter',trigger:'Trigger',landing:'Landing',refer:'Refer / сайт'};
 const siteLabels=labels.site||{unmarked:'Не размечено',paywall:'Пейволы',news:'Новости',blocks:'Блоки и кнопки сайта',articles:'Статьи',vio:'ВиО / QA',other:'Прочее'};
 const sources=Object.keys(sourceLabels).map(function(id){
  const v=row&&row.sources&&row.sources[id]||{};
  return{id:id,label:sourceLabels[id],total:sourceMetricTotal(v),green:n(v.g)};
 });
 const site=Object.keys(siteLabels).map(function(id){
  const v=row&&row.site&&row.site[id]||{};
  return{id:id,label:siteLabels[id],total:sourceMetricTotal(v),green:n(v.g)};
 });
 return{
  total:sources.reduce((sum,x)=>sum+n(x.total),0),
  green:sources.reduce((sum,x)=>sum+n(x.green),0),
  sources:sources,
  site:site
 };
}
function sourceAggregateScope(scope){
 const rows=sourceWeeklyRows(scope).filter(x=>Number(x.week)>=27&&Number(x.week)<=39);
 const sourceIds=['letter','trigger','landing','refer'],siteIds=['unmarked','paywall','news','blocks','articles','vio','other'];
 const sourceLabels=(sourceData.labels&&sourceData.labels.sources)||{},siteLabels=(sourceData.labels&&sourceData.labels.site)||{};
 const acc={
  sources:Object.fromEntries(sourceIds.map(id=>[id,{r:0,y:0,g:0}])),
  site:Object.fromEntries(siteIds.map(id=>[id,{r:0,y:0,g:0}]))
 };
 rows.forEach(function(row){
  sourceIds.forEach(function(id){const v=row.sources&&row.sources[id]||{};acc.sources[id].r+=n(v.r);acc.sources[id].y+=n(v.y);acc.sources[id].g+=n(v.g);});
  siteIds.forEach(function(id){const v=row.site&&row.site[id]||{};acc.site[id].r+=n(v.r);acc.site[id].y+=n(v.y);acc.site[id].g+=n(v.g);});
 });
 return sourceRowGroup(acc);
}
function selectedSourceGroup(scope){
 if(sourceWeek==='all'){
  if(sourceData.groups&&sourceData.groups[scope])return sourceData.groups[scope];
  return sourceAggregateScope(scope);
 }
 const week=Number(sourceWeek);
 const row=sourceWeeklyRows(scope).find(x=>Number(x.week)===week);
 return sourceRowGroup(row||{});
}
function sourceCardHtml(x,total,green,leaderId){
 const share=sourcePct(n(x.total),total);
 const greenRate=sourcePct(n(x.green),n(x.total));
 const greenContribution=sourcePct(n(x.green),green);
 const featured=x.id===leaderId?' featured':'';
 return '<article class="source-card'+featured+'">'+
   '<div class="source-card-head"><div><span>'+esc(x.label)+'</span><small>'+pct(share)+' всех демо</small></div><strong>'+fmt(x.total)+'</strong></div>'+
   '<div class="source-card-metrics"><div><span>Зелёных</span><b>'+fmt(x.green)+'</b></div><div><span>Доля зелёных</span><b>'+pct(greenRate)+'</b></div></div>'+
   '<div class="source-card-bottom"><span>'+pct(greenContribution)+' всех зелёных</span><div class="source-sharebar"><i style="width:'+Math.min(100,share)+'%"></i></div></div>'+
  '</article>';
}
function sourceSiteHtml(rows,referTotal){
 if(!Array.isArray(rows)||!rows.some(x=>n(x.total)))return '<div class="vio-empty">В выбранной неделе Refer / сайт не дал DEMO.</div>';
 return rows.filter(x=>n(x.total)>0).sort((a,b)=>n(b.total)-n(a.total)).map(function(x){
  const greenRate=sourcePct(n(x.green),n(x.total));
  const share=sourcePct(n(x.total),referTotal);
  const warn=x.id==='unmarked'?' warning':'';
  return '<div class="site-source-row'+warn+'">'+
   '<div class="site-source-name"><b>'+esc(x.label)+'</b><span>'+fmt(x.total)+' демо · '+fmt(x.green)+' зелёных</span></div>'+
   '<div class="site-source-rate"><b>'+pct(greenRate)+'</b><span>зелёных</span></div>'+
   '<div class="site-source-share"><b>'+pct(share)+'</b><span>от Refer</span></div>'+
   '<div class="source-sharebar"><i style="width:'+Math.min(100,share)+'%"></i></div>'+
  '</div>';
 }).join('');
}
function sourceAnswerHtml(group,scope){
 const sources=(group.sources||[]).slice().sort((a,b)=>n(b.green)-n(a.green)||n(b.total)-n(a.total));
 const green=n(group.green);
 const top=sources.filter(x=>n(x.green)>0).slice(0,4);
 const label=sourceWeek==='all'?'за полные недели 27–39':'за неделю '+sourceWeek;
 if(!green)return '<b>'+esc(scope)+'</b>: '+esc(label)+' зелёных DEMO пока нет.';
 return '<b>'+esc(scope)+' · '+esc(label)+':</b> '+top.map(function(x){return esc(x.label)+' — <strong>'+fmt(x.green)+'</strong> зелёных ('+pct(sourcePct(n(x.green),green))+')';}).join(' · ')+'.';
}
function sourceInsightsHtml(group){
 const sources=(group.sources||[]).slice();
 const total=n(group.total),green=n(group.green);
 const byVolume=sources.slice().sort((a,b)=>n(b.total)-n(a.total))[0]||{};
 const byContribution=sources.slice().sort((a,b)=>n(b.green)-n(a.green))[0]||{};
 const byGreen=sources.filter(x=>n(x.total)>0).slice().sort((a,b)=>sourcePct(n(b.green),n(b.total))-sourcePct(n(a.green),n(a.total)))[0]||{};
 const refer=sourceById(group,'refer');
 const unmarked=(group.site||[]).find(function(x){return x.id==='unmarked'})||{total:0,green:0};
 return [
  '<div class="source-insight"><span>Главный источник объёма</span><b>'+esc(byVolume.label||'—')+' · '+pct(sourcePct(n(byVolume.total),total))+'</b><p>'+fmt(byVolume.total||0)+' DEMO.</p></div>',
  '<div class="source-insight"><span>Главный вклад в зелёные</span><b>'+esc(byContribution.label||'—')+' · '+fmt(byContribution.green||0)+'</b><p>'+pct(sourcePct(n(byContribution.green),green))+' всех зелёных выбранного среза.</p></div>',
  '<div class="source-insight"><span>Самая высокая доля зелёных</span><b>'+esc(byGreen.label||'—')+' · '+pct(sourcePct(n(byGreen.green),n(byGreen.total)))+'</b><p>Зелёных '+fmt(byGreen.green||0)+' из '+fmt(byGreen.total||0)+' DEMO.</p></div>',
  '<div class="source-insight warning"><span>Не размечено на сайте</span><b>'+pct(sourcePct(n(unmarked.total),n(refer.total)))+' Refer</b><p>'+fmt(unmarked.total)+' DEMO нельзя предметно отнести к точке входа.</p></div>'
 ].join('');
}
function sourcesWeeklyHtml(scope){
 const rows=sourceWeeklyRows(scope).slice().sort((a,b)=>Number(b.week)-Number(a.week));
 const meta=sourceData.meta||{},current=Number(meta.currentWeek||40);
 if(!rows.length)return '<div class="vio-empty">Нет недельной истории.</div>';
 const labels=(sourceData.labels&&sourceData.labels.sources)||{letter:'Letter',trigger:'Trigger',landing:'Landing',refer:'Refer / сайт'};
 const ids=['letter','trigger','landing','refer'];
 const body=rows.map(function(row){
  const greens=ids.map(id=>n(row.sources&&row.sources[id]&&row.sources[id].g));
  const max=Math.max.apply(null,[0].concat(greens));
  const cells=ids.map(function(id){
   const v=row.sources&&row.sources[id]||{},g=n(v.g),total=sourceMetricTotal(v),lead=max>0&&g===max?' lead':'';
   return '<td class="source-week-cell'+lead+'"><b>'+fmt(g)+'</b><span>из '+fmt(total)+'</span></td>';
  }).join('');
  const totalG=greens.reduce((a,b)=>a+b,0);
  const totalAll=ids.reduce((sum,id)=>sum+sourceMetricTotal(row.sources&&row.sources[id]||{}),0);
  return '<tr'+(Number(row.week)===current?' class="current"':'')+'><td><b>W'+row.week+'</b>'+(Number(row.week)===current?'<span class="source-current">текущая</span>':'')+'</td>'+cells+'<td class="source-week-total"><b>'+fmt(totalG)+'</b><span>из '+fmt(totalAll)+'</span></td></tr>';
 }).join('');
 return '<table class="sources-weekly-table"><thead><tr><th>Неделя</th>'+ids.map(id=>'<th>'+esc(labels[id])+'</th>').join('')+'<th>Всего</th></tr></thead><tbody>'+body+'</tbody></table>';
}
function sourcesCompareHtml(){
 if(!sourceData)return'';
 const gf=selectedSourceGroup('ГФ'),gz=selectedSourceGroup('ГЗ');
 const ids=['letter','trigger','landing','refer'];
 const labels=(sourceData.labels&&sourceData.labels.sources)||{letter:'Letter',trigger:'Trigger',landing:'Landing',refer:'Refer / сайт'};
 const rows=ids.map(function(id){
  const a=sourceById(gf,id),b=sourceById(gz,id);
  return '<tr><td><b>'+esc(labels[id])+'</b></td>'+
   '<td>'+fmt(a.green)+' / '+fmt(a.total)+'</td><td class="source-green-cell">'+pct(sourcePct(n(a.green),n(a.total)))+'</td>'+
   '<td>'+fmt(b.green)+' / '+fmt(b.total)+'</td><td class="source-green-cell">'+pct(sourcePct(n(b.green),n(b.total)))+'</td></tr>';
 }).join('');
 return '<table class="sources-compare-table"><thead><tr><th>Источник</th><th>ГФ · зелёных / всего</th><th>ГФ · доля зелёных</th><th>ГЗ · зелёных / всего</th><th>ГЗ · доля зелёных</th></tr></thead><tbody>'+rows+'</tbody></table>';
}
function renderSources(){
 if(!sourceData)return;
 const scope=sourceScope(),group=selectedSourceGroup(scope),meta=sourceData.meta||{};
 document.getElementById('sourcesAll').setAttribute('aria-pressed',String(sourceGroup==='Все'));
 document.getElementById('sourcesGf').setAttribute('aria-pressed',String(sourceGroup==='ГФ'));
 document.getElementById('sourcesGz').setAttribute('aria-pressed',String(sourceGroup==='ГЗ'));
 document.getElementById('sourcesPeriod').textContent=sourceWeek==='all'?'Полные недели '+String(meta.fullWeeks||'27–39'):'Неделя '+sourceWeek+(Number(sourceWeek)===Number(meta.currentWeek)?' · текущая':'');
 const status=document.getElementById('sourcesStatus');
 status.textContent=scope+' · '+(sourceWeek==='all'?'полные недели '+String(meta.fullWeeks||'27–39'):'неделя '+sourceWeek+(Number(sourceWeek)===Number(meta.currentWeek)?' · неполная':''))+' · данные обновлены '+dateRu(meta.updatedAt||'');
 const total=n(group.total),green=n(group.green),refer=sourceById(group,'refer');
 const leader=(group.sources||[]).slice().sort((a,b)=>n(b.green)-n(a.green))[0]||{};
 document.getElementById('sourcesSummary').innerHTML=
  '<div><b>'+fmt(total)+'</b><span>всего DEMO</span></div>'+
  '<div><b>'+fmt(green)+'</b><span>зелёных DEMO</span></div>'+
  '<div><b>'+pct(sourcePct(green,total))+'</b><span>доля зелёных</span></div>'+
  '<div><b>'+pct(sourcePct(n(leader.green),green))+'</b><span>зелёных дал '+esc(leader.label||'главный источник')+'</span></div>';
 document.getElementById('sourceAnswer').innerHTML=sourceAnswerHtml(group,scope);
 document.getElementById('sourceCards').innerHTML=(group.sources||[]).map(function(x){return sourceCardHtml(x,total,green,leader.id)}).join('');
 document.getElementById('sourcesWeekly').innerHTML=sourcesWeeklyHtml(scope);
 document.getElementById('siteBreakdown').innerHTML=sourceSiteHtml(group.site||[],n(refer.total));
 document.getElementById('sourceInsights').innerHTML=sourceInsightsHtml(group);
 document.getElementById('sourcesCompare').innerHTML=sourcesCompareHtml();
}
document.getElementById('sourcesAll').onclick=function(){sourceGroup='Все';sourceProduct='';sourceProductOptions();renderSources();};
document.getElementById('sourcesGf').onclick=function(){sourceGroup='ГФ';sourceProduct='';sourceProductOptions();renderSources();};
document.getElementById('sourcesGz').onclick=function(){sourceGroup='ГЗ';sourceProduct='';sourceProductOptions();renderSources();};
document.getElementById('sourcesProduct').onchange=function(e){sourceProduct=e.target.value;renderSources();};
document.getElementById('sourcesWeek').onchange=function(e){sourceWeek=e.target.value;renderSources();};

async function loadVio(force=false){
 const status=document.getElementById('vioStatus');
 status.textContent='Читаю выгрузку ВИО и собираю темы…';
 try{
  vioData=await rpc('getVioTrendsUi',force?1:null);
  renderVio();
  const meta=vioData&&vioData.meta||{};
  status.textContent='Обновлено '+dateRu(meta.readAt)+' · текущий период: '+String(meta.currentLabel||'');
 }catch(err){
  try{
   const response=await fetch('vio-trends.json?v='+Date.now(),{cache:'no-store'});
   if(!response.ok)throw new Error('HTTP '+response.status);
   vioData=await response.json();
   renderVio();
   const meta=vioData&&vioData.meta||{};
   status.textContent='Срез из выгрузки · '+String(meta.currentLabel||'')+' · live-обновление включится после обновления Apps Script';
  }catch(fallbackErr){
   status.textContent='Не удалось загрузить ВИО: '+(err&&err.message?err.message:String(err));
  }
 }
}
function vioSigned(v,suffix){
 const x=n(v);
 return (x>0?'+':'')+new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(x)+(suffix||'');
}
function vioList(items,mode){
 const rows=Array.isArray(items)?items:[];
 if(!rows.length)return '<div class="vio-empty">Пока недостаточно данных.</div>';
 const max=Math.max.apply(null,[1].concat(rows.map(x=>mode==='rise'?Math.abs(n(x.deltaPp)):n(x.count))));
 return rows.map((x,i)=>{
  const value=mode==='rise'?Math.abs(n(x.deltaPp)):n(x.count);
  const width=Math.max(4,Math.round(value/max*100));
  let meta='';
  if(mode==='topic')meta=fmt(x.count)+' вопросов · '+pct(x.share)+(n(x.deltaPp)?' · '+vioSigned(x.deltaPp,' п.п.'):'');
  else if(mode==='rise')meta=vioSigned(x.deltaPp,' п.п.')+' · '+fmt(x.count)+' вопросов';
  else meta=fmt(x.count)+' · '+pct(x.share);
  return '<div class="vio-row"><div class="vio-rank">'+(i+1)+'</div><div class="vio-rowmain"><div><b>'+esc(x.name)+'</b><span>'+esc(meta)+'</span></div><div class="vio-bar"><i style="width:'+width+'%"></i></div></div></div>';
 }).join('');
}
function vioObjectHuman(v){
 const s=String(v||'').trim();
 const map={
  'контракт / договор':'контракт',
  'строительство / ремонт':'строительство и ремонт',
  'заявки участников':'заявки участников',
  'ПО / лицензии / ИТ':'ПО, лицензии и ИТ',
  'лекарства / медизделия':'лекарства и медизделия',
  'зарплата / премии':'зарплата и премии',
  'субсидии / гранты / госзадание':'субсидии, гранты и госзадание',
  'налоги / взносы':'налоги и взносы',
  'автомобили / транспорт / ГСМ':'транспорт и ГСМ',
  'дебиторская / кредиторская задолженность':'дебиторская и кредиторская задолженность',
  'здания / помещения / недвижимость':'здания, помещения и недвижимость',
  'компьютеры / оргтехника / картриджи':'компьютеры, оргтехника и картриджи',
  'стройматериалы / элементы ремонта':'стройматериалы и элементы ремонта'
 };
 return map[s]||s;
}
function vioIntentHuman(v){
 const s=String(v||'').trim();
 if(/Проверить/i.test(s))return 'Проверить, можно ли так сделать и обязательно ли это';
 if(/Разобраться/i.test(s))return 'Понять порядок действий в конкретной ситуации';
 if(/Рассчитать/i.test(s))return 'Рассчитать сумму, цену или другой показатель';
 if(/Исправить/i.test(s))return 'Исправить ошибку или решить проблему';
 if(/Отразить/i.test(s))return 'Понять отражение в учёте и проводки';
 if(/Оформить/i.test(s))return 'Понять, какие документы оформить';
 if(/Выбрать код/i.test(s))return 'Выбрать код, счёт или классификацию';
 return s||'Разобраться в рабочей ситуации';
}
function vioEditorialTitle(x,group){
 const a=String(x.action||'').trim();
 const o=vioObjectHuman(x.object);
 const t=String(x.topic||'').trim();

 if(group==='ГЗ'){
  if(a==='Расчёт НМЦК')return /строитель|ремонт/i.test(o)?'Как рассчитать НМЦК для строительства и ремонта':'Как рассчитать НМЦК и обосновать цену';
  if(a==='Заявка: допуск / отклонение')return 'Когда допустить или отклонить заявку участника';
  if(a==='Описание объекта / ТЗ')return 'Как описать объект закупки и составить техническое задание';
  if(a==='Нацрежим')return /товар/i.test(o)?'Как применить нацрежим при закупке товара':'Как применить нацрежим: '+o;
  if(a==='Изменение контракта')return /строитель|ремонт/i.test(o)?'Можно ли изменить условия контракта на строительство или ремонт':'Можно ли изменить условия уже заключённого контракта';
  if(a==='Расторжение')return 'Как расторгнуть контракт и что оформить';
  if(a==='Приёмка / экспертиза')return 'Как провести приёмку и экспертизу по контракту';
  if(a==='Оплата / неустойка')return 'Как оплатить исполнение и применить неустойку по контракту';
  if(a==='ЕИС / реестр')return 'Что и когда размещать в ЕИС по контракту';
  if(a==='Единственный поставщик')return 'Когда можно провести закупку у единственного поставщика';
  if(a==='Проведение закупки'){
   if(/строитель|ремонт/i.test(o))return 'Как провести закупку строительных и ремонтных работ';
   if(/ПО|лиценз/i.test(o))return 'Как провести закупку ПО и лицензий';
   if(/заявк/i.test(o))return 'Как установить требования к участникам и заявкам';
   if(/контракт/i.test(o))return 'Как провести закупку и заключить контракт';
   if(/товар/i.test(o))return 'Как провести закупку товара';
   return 'Как провести закупку: '+o;
  }
  if(a==='Контракт / договор'){
   if(/контроль|наруш/i.test(t))return 'Можно ли так поступить по контракту и не нарушить 44-ФЗ';
   if(/заключ/i.test(t))return 'Как заключить контракт и проверить его условия';
   if(/исполн|прием|оплат|неустой/i.test(t))return 'Как исполнить контракт, принять и оплатить результат';
   return 'Как действовать по контракту в конкретной ситуации';
  }
  return a&&a!=='Разобрать'?(a+': '+o):('Как действовать: '+o);
 }

 if(a==='Списание')return /задолж/i.test(o)?'Как списать дебиторскую или кредиторскую задолженность':'Как оформить списание: '+o;
 if(a==='Принятие к учёту')return 'Как принять к учёту: '+o;
 if(a==='Передача')return 'Как оформить передачу: '+o;
 if(a==='Инвентаризация')return 'Как провести инвентаризацию: '+o;
 if(a==='Возврат / возмещение'){
  if(/субсид|грант|госзадан/i.test(o))return 'Как вернуть или возместить средства субсидии, гранта или госзадания';
  if(/задолж/i.test(o))return 'Как вернуть или возместить задолженность';
  return 'Как оформить возврат или возмещение: '+o;
 }
 if(a==='Амортизация')return 'Как начислять амортизацию: '+o;
 if(a==='Ремонт / модернизация')return 'Как учесть ремонт или модернизацию: '+o;
 if(a==='Начисление / расчёт'){
  if(/зарплат|прем/i.test(o))return 'Как рассчитать зарплату, премии и другие выплаты';
  return 'Как рассчитать: '+o;
 }
 if(a==='Оформление документов')return 'Какие документы оформить по теме: '+o;
 if(a==='Учёт / проводки')return 'Как учесть '+o+' и какие сделать проводки';
 if(a==='Разобрать'){
  if(/зарплат|прем/i.test(o))return 'Что делать с зарплатой и премиями в конкретной ситуации';
  if(/субсид|грант|госзадан/i.test(o))return 'Как работать с субсидиями, грантами и госзаданием';
  if(/налог|взнос/i.test(o))return 'Как поступить с налогами и взносами в конкретной ситуации';
  if(/транспорт|ГСМ/i.test(o))return 'Как учитывать и оформлять операции с транспортом и ГСМ';
  return 'Как поступить в ситуации с '+o;
 }
 return a? (a+': '+o) : ('Как поступить: '+o);
}
function vioConcreteHtml(items){
 const rows=Array.isArray(items)?items:[];
 if(!rows.length)return '<div class="vio-empty">Пока недостаточно предметной классификации.</div>';
 return rows.slice(0,16).map((x,i)=>{
  const object=vioObjectHuman(x.object);
  const action=String(x.action||'').trim();
  const topic=String(x.topic||'').trim();
  const title=vioEditorialTitle(x,vioGroup);
  const examples=Array.isArray(x.examples)?x.examples.slice(0,3):[];
  const chips=[];
  if(object)chips.push('<span class="vio-chip"><small>Предмет</small><b>'+esc(object)+'</b></span>');
  if(action&&action!=='Разобрать'&&action.toLowerCase()!==String(x.object||'').toLowerCase())chips.push('<span class="vio-chip"><small>Действие</small><b>'+esc(action)+'</b></span>');
  return '<article class="vio-question-card">'+
   '<div class="vio-question-head"><span class="vio-question-rank">'+String(i+1).padStart(2,'0')+'</span><span class="vio-question-count"><b>'+fmt(x.count)+'</b> вопросов</span></div>'+
   (topic?'<div class="vio-question-topic">'+esc(topic)+'</div>':'')+
   '<h3>'+esc(title)+'</h3>'+
   (chips.length?'<div class="vio-question-tags">'+chips.join('')+'</div>':'')+
   '<div class="vio-question-intent"><span>Чаще хотят</span><b>'+esc(vioIntentHuman(x.topIntent))+'</b></div>'+
   (examples.length?'<details class="vio-examples"><summary>Примеры ВИО</summary><ul>'+examples.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul></details>':'')+
  '</article>';
 }).join('');
}
function renderVio(){
 if(!vioData)return;
 const groups=vioData.groups||{};
 const data=groups[vioGroup]||{};
 const meta=vioData.meta||{};
 document.getElementById('vioGz').setAttribute('aria-pressed',String(vioGroup==='ГЗ'));
 document.getElementById('vioGf').setAttribute('aria-pressed',String(vioGroup==='ГФ'));
 const pace=n(data.paceChangePct);
 document.getElementById('vioSummary').innerHTML=
  '<div><b>'+fmt(data.currentTotal)+'</b><span>вопросов · '+esc(meta.currentLabel||'текущий месяц')+'</span></div>'+
  '<div><b>'+esc(String(data.currentPace==null?0:data.currentPace))+'</b><span>вопросов в день</span></div>'+
  '<div><b>'+esc(vioSigned(pace,'%'))+'</b><span>темп к '+esc(meta.previousLabel||'прошлому месяцу')+'</span></div>'+
  '<div><b>'+fmt(data.previousTotal)+'</b><span>вопросов · '+esc(meta.previousLabel||'прошлый месяц')+'</span></div>';
 document.getElementById('vioTopics').innerHTML=vioList((data.topTopics||[]).filter(x=>x.name!=='Другие вопросы').slice(0,10),'topic');
 document.getElementById('vioRising').innerHTML=vioList((data.risingTopics||[]).slice(0,8),'rise');
 document.getElementById('vioIntents').innerHTML=vioList((data.intents||[]).slice(0,8),'intent');
 document.getElementById('vioConcrete').innerHTML=vioConcreteHtml(data.concreteTopics||[]);
 document.getElementById('vioRubrics').innerHTML=(data.rubrics||[]).filter(x=>x.name!=='Без рубрики').map(x=>'<span><b>'+esc(x.name)+'</b><small>'+fmt(x.count)+' · '+pct(x.share)+'</small></span>').join('');
}
document.getElementById('vioGz').onclick=()=>{vioGroup='ГЗ';renderVio();};
document.getElementById('vioGf').onclick=()=>{vioGroup='ГФ';renderVio();};
document.getElementById('vioReload').onclick=()=>loadVio(true);

document.getElementById('vikaPeriod').onchange=e=>loadVika(e.target.value);
document.getElementById('vikaSearch').oninput=renderVika;
document.getElementById('vikaDate').onchange=renderVika;
document.getElementById('vikaReload').onclick=()=>loadVika(vikaData?.selected?.id);

document.getElementById('healthBtn').addEventListener('click',checkServer);
document.getElementById('refreshBtn').addEventListener('click',refreshLast3Days);
const refreshAllMailBtn=document.getElementById('refreshAllMailBtn');if(refreshAllMailBtn)refreshAllMailBtn.addEventListener('click',refreshAllMailRegistry);
window.addEventListener('hashchange',()=>openPage(rememberedPage(),false));
openPage(rememberedPage());
checkServer();loadData();
})();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startAnalyticsApp,{once:true});else startAnalyticsApp();
