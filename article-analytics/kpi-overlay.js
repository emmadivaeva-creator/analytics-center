function renderKpis(){
 const box=document.getElementById('kpis');
 const rows=currentArticles();
 const z=aggregate(rows);
 const pairs=currentPairs();
 const pot=pairs.reduce((sum,x)=>sum+(+x.potential||0),0);
 let cards=[];

 const card=(label,value,note='')=>[label,value,note];
 const share=(part,total)=>total?pct(part/total):'0%';
 const short=s=>String(s||'').length>34?String(s).slice(0,33)+'…':String(s||'');

 if(state.view==='method'){
   box.innerHTML='';
   box.style.display='none';
   return;
 }
 box.style.display='grid';

 if(state.view==='overview'){
   cards=[
    card('Статей',n(z.articles),'по выбранным фильтрам'),
    card('Визиты',n(z.visits),'входной трафик'),
    card('Клики',n(z.clicks),'по редблокам'),
    card('Демо',n(z.demos),`со статьи ${n(z.demo_art)} • из ограничения доступа ${n(z.demo_pw)}`),
    card('Конверсия визитов в демо',pct(z.cr),'итоговая конверсия'),
    card('Клики / визиты',pct(z.clickVisit),'диагностический показатель'),
    card('Демо / клики',pct(z.demoClick),'диагностический показатель'),
    card('Демо на 1000 визитов',d(z.demo1000),`потенциал +${d(pot)}`),
   ];
 }
 else if(state.view==='allarticles'){
   const all=masterRows();
   const az=aggregate(all);
   const zero=all.filter(a=>(+a.visits||0)===0).length;
   const nonTarget=all.filter(a=>(a.status||'').startsWith('Нецелевая')).length;
   const withDemo=all.filter(a=>(+a.demos||0)>0).length;
   const trafficOnly=all.filter(a=>(a.status||'').includes('Только в трафике')).length;
   cards=[
    card('Строк в реестре',n(all.length),'после текущих фильтров'),
    card('С входным трафиком',n(all.length-zero),share(all.length-zero,all.length)+' реестра'),
    card('Без входного трафика',n(zero),'0 входных визитов'),
    card('Нецелевых',n(nonTarget),'остаются в полном реестре'),
    card('Только в трафике',n(trafficOnly),'нет метаданных статьи'),
    card('Визиты',n(az.visits),'по строкам реестра'),
    card('Демо',n(az.demos),'по строкам реестра'),
    card('Статей с демо',n(withDemo),share(withDemo,all.length)+' реестра'),
   ];
 }
 else if(state.view==='weekly'){
   const pack=WEEKLY[state.site];
   if(!pack || (pack.completeWeeks||[]).length<2){
     cards=[
      card('Недельные данные','Не загружены','нужна отдельная дневная выгрузка'),
      card('Нужно в файле','3 поля','дата • страница входа • визиты'),
      card('Для сравнения','2 недели','только полные недели пн–вс'),
      card('Порог падения','−20%','при базе от 10 визитов'),
     ];
   }else{
     const complete=pack.completeWeeks;
     const curKey=complete[complete.length-1],prevKey=complete[complete.length-2];
     const metaMap=new Map((DATA.articles[state.site]||[]).map(a=>[String(a.id),a]));
     let wr=[];
     metaMap.forEach((meta,id)=>{
       if(!articleFilter(meta))return;
       const ww=pack.byArticle[id]||{};
       const prev=+ww[prevKey]||0,curr=+ww[curKey]||0;
       if(prev===0&&curr===0)return;
       const stat=weeklyStatus(prev,curr);
       wr.push({prev,curr,stat});
     });
     const falling=wr.filter(x=>['Падение','Сильное падение','Трафик исчез'].includes(x.stat.label));
     const strong=wr.filter(x=>['Сильное падение','Трафик исчез'].includes(x.stat.label));
     const growing=wr.filter(x=>['Рост','Новый рост'].includes(x.stat.label));
     const lost=falling.reduce((sum,x)=>sum+Math.max(0,x.prev-x.curr),0);
     const prevTotal=wr.reduce((sum,x)=>sum+x.prev,0),currTotal=wr.reduce((sum,x)=>sum+x.curr,0);
     cards=[
      card('Полных недель',n(complete.length),'в загруженном файле'),
      card('Статей упало',n(falling.length),'на 20% и сильнее'),
      card('Сильное падение',n(strong.length),'на 50% и сильнее'),
      card('Потеряно визитов',n(lost),'к предыдущей полной неделе'),
      card('Статей выросло',n(growing.length),'на 20% и сильнее'),
      card('Прошлая неделя',n(prevTotal),'визитов по выбранным статьям'),
      card('Текущая неделя',n(currTotal),'визитов по выбранным статьям'),
      card('Общее изменение',prevTotal?`${currTotal-prevTotal>=0?'+':''}${d((currTotal-prevTotal)/prevTotal*100)}%`:'—','по двум последним полным неделям'),
     ];
   }
 }
 else if(state.view==='intents'){
   const gs=group(rows,'intent');
   const active=gs.filter(g=>g.visits>0);
   const leader=[...active].sort((a,b)=>b.demo1000-a.demo1000||b.demos-a.demos)[0];
   const noDemo=gs.filter(g=>g.demos===0).length;
   cards=[
    card('Интентов',n(gs.length),'под текущими фильтрами'),
    card('Статей',n(z.articles),'в выбранных интентах'),
    card('Визиты',n(z.visits),'входной трафик'),
    card('Демо',n(z.demos),'всего'),
    card('Конверсия',pct(z.cr),'визиты → демо'),
    card('Демо на 1000',d(z.demo1000),'среднее по выбранным статьям'),
    card('Лучший интент',leader?d(leader.demo1000):'—',leader?short(leader.key):'нет данных'),
    card('Интентов без демо',n(noDemo),share(noDemo,gs.length)+' всех интентов'),
   ];
 }
 else if(state.view==='topics'){
   const gs=group(rows,'topic');
   const active=gs.filter(g=>g.visits>0);
   const leader=[...active].sort((a,b)=>b.demo1000-a.demo1000||b.demos-a.demos)[0];
   const noDemo=gs.filter(g=>g.demos===0).length;
   cards=[
    card('Тем',n(gs.length),'под текущими фильтрами'),
    card('Статей',n(z.articles),'в выбранных темах'),
    card('Визиты',n(z.visits),'входной трафик'),
    card('Демо',n(z.demos),'всего'),
    card('Конверсия',pct(z.cr),'визиты → демо'),
    card('Демо на 1000',d(z.demo1000),'среднее'),
    card('Лучшая тема',leader?d(leader.demo1000):'—',leader?short(leader.key):'нет данных'),
    card('Тем без демо',n(noDemo),share(noDemo,gs.length)+' всех тем'),
   ];
 }
 else if(state.view==='problems'){
   const proven=problemRows();
   const research=researchRows();
   const pz=aggregate(proven);
   const high=proven.filter(a=>a.priority==='Высокий').length;
   const potential=proven.reduce((sum,a)=>sum+(+a.potential||0),0);
   const gaps=proven.map(a=>{
     const b=+a.pair?.pair_demo_1000||0,c=+a.demo_1000||0;
     return b>0?1-c/b:null;
   }).filter(x=>x!=null);
   const avgGap=gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:0;
   const base=rows.filter(a=>(+a.visits||0)>=200).length;
   cards=[
    card('Подтверждённых проблем',n(proven.length),share(proven.length,base)+' статей с трафиком ≥200'),
    card('Высокий приоритет',n(high),'из подтверждённых проблем'),
    card('Ручная проверка',n(research.length),'трафик есть, пары нет'),
    card('Визиты проблемных',n(pz.visits),'масштаб затронутого трафика'),
    card('Демо проблемных',n(pz.demos),'текущий результат'),
    card('Потенциал',`+${d(potential)}`,'дополнительных демо по сравнениям'),
    card('Средний разрыв',gaps.length?`${d(avgGap*100)}%`:'—','по демо на 1000 против статьи для сравнения'),
    card('Всего на разбор',n(proven.length+research.length),'проблемы + ручная проверка'),
   ];
 }
 else if(state.view==='nodemo'){
   const nd=noDemoRows();
   const nz=aggregate(nd);
   const big=nd.filter(a=>(+a.visits||0)>=1000).length;
   const ids=new Set(nd.map(a=>String(a.id)));
   const potential=pairs.filter(p=>ids.has(String(p.id))).reduce((sum,p)=>sum+(+p.potential||0),0);
   const base=rows.filter(a=>(+a.visits||0)>=Math.max(200,state.minVisits)).length;
   const maxTraffic=nd.reduce((m,a)=>Math.max(m,+a.visits||0),0);
   cards=[
    card('Статей без демо',n(nd.length),`при трафике ≥${n(Math.max(200,state.minVisits))}`),
    card('Доля без демо',share(nd.length,base),'среди статей выше порога'),
    card('Визиты без демо',n(nz.visits),'трафик без результата'),
    card('Клики',n(nz.clicks),'клики по редблокам'),
    card('Клики / визиты',pct(nz.clickVisit),'есть ли провал до клика'),
    card('Очень трафиковых',n(big),'≥1000 визитов и 0 демо'),
    card('Потенциал',`+${d(potential)}`,'где найдено корректное сравнение'),
    card('Максимум трафика',n(maxTraffic),'у одной статьи без демо'),
   ];
 }
 else if(state.view==='best'){
   const br=bestRows();
   const bz=aggregate(br);
   const leader=br[0];
   const stable=br.filter(a=>(+a.demos||0)>=3).length;
   cards=[
    card('Статей в рейтинге',n(br.length),'только статьи с ≥1 демо'),
    card('Визиты',n(bz.visits),'у статей с демо'),
    card('Демо',n(bz.demos),'в рейтинге'),
    card('Конверсия',pct(bz.cr),'визиты → демо'),
    card('Демо на 1000',d(bz.demo1000),'по всему рейтингу'),
    card('Лучшая отдача',leader?d(leader.demo_1000):'—','демо на 1000 у лидера'),
    card('Демо у лидера',leader?n(leader.demos):'—',leader?short(leader.title):'нет данных'),
    card('Устойчивых результатов',n(stable),'статьи с 3+ демо'),
   ];
 }
 else if(state.view==='pairs'){
   const has=pairs.filter(p=>p.pair_id);
   const unique=new Set(has.map(p=>String(p.pair_id))).size;
   const high=has.filter(p=>p.benchmark_confidence==='Высокая').length;
   const confirmed=has.filter(p=>(p.comparison_stability||'').startsWith('Подтверждается')).length;
   const reused=has.reduce((m,p)=>Math.max(m,+p.benchmark_used_by||0),0);
   const gap=has.filter(p=>(+p.pair_demo_1000||0)>0 && (+p.demo_1000||0)<.7*(+p.pair_demo_1000||0)).length;
   cards=[
    card('Статей для сравнения',n(pairs.length),'под текущими фильтрами'),
    card('Есть корректная статья',n(has.length),'для сравнения внутри сайта'),
    card('Уникальных примеров',n(unique),'один пример может использоваться несколько раз'),
    card('Высокая надёжность',n(high),'3+ демо и ≥200 визитов'),
    card('Разрыв ≥30%',n(gap),'по демо на 1000'),
    card('Подтверждено аналогами',n(confirmed),'разрыв виден не на одном примере'),
    card('Потенциал',`+${d(pot)}`,'дополнительных демо'),
    card('Макс. повторов примера',n(reused),'для скольких статей используется один пример'),
   ];
 }
 else if(state.view==='nopair'){
   const np=noPairRows();
   const siteAvg=aggregate(DATA.articles[state.site]||[]).demo1000;
   const assessed=np.map(a=>({a,x:noPairAssessment(a,siteAvg)}));
   const urgent=assessed.filter(o=>o.x.status==='Срочная ручная проверка').length;
   const check=assessed.filter(o=>o.x.status==='Проверить CTA / оффер').length;
   const topic=assessed.filter(o=>o.x.status==='Сначала уточнить тему').length;
   const withDemo=np.filter(a=>(+a.demos||0)>0).length;
   const zeroDemo=np.filter(a=>(+a.demos||0)===0).length;
   const zeroVisits=np.filter(a=>(+a.demos||0)===0).reduce((sum,a)=>sum+(+a.visits||0),0);
   cards=[
    card('Без сопоставимой пары',n(np.length),'все объёмы трафика'),
    card('Срочная проверка',n(urgent),'≥1000 визитов и 0 демо'),
    card('Проверить переход в демо',n(check),'≥200 визитов и 0 демо'),
    card('Уточнить тему',n(topic),'слишком широкая классификация'),
    card('Есть демо',n(withDemo),'уникальные темы тоже могут работать'),
    card('Без демо',n(zeroDemo),share(zeroDemo,np.length)+' статей без пары'),
    card('Визиты без демо',n(zeroVisits),'среди статей без пары'),
    card('Среднее сайта',d(siteAvg),'демо на 1000 для контекста'),
   ];
 }
 else if(state.view==='zerotraffic'){
   const zr=zeroRows();
   const counts={};zr.forEach(a=>counts[a.reason_type]=(counts[a.reason_type]||0)+1);
   const similar=zr.filter(a=>a.similar_id).length;
   cards=[
    card('Без входного трафика',n(zr.length),'0 входных визитов в отчёте'),
    card('Устаревание',n(counts['Устаревание']||0),'автоматическая гипотеза'),
    card('Каннибализация',n(counts['Каннибализация']||0),'возможный внутренний конкурент'),
    card('Новая статья',n(counts['Новая статья']||0),'ещё могла не набрать трафик'),
    card('Нужна проверка',n(counts['Нужна проверка']||0),'причина неочевидна'),
    card('Есть похожая статья',n(similar),'с входным трафиком'),
   ];
 }
 else if(state.view==='nontarget'){
   const nt=(DATA.nonTarget||[]).filter(x=>x.site===state.site);
   const nz=aggregate(nt);
   const rubrics=new Set(nt.map(x=>x.rubric).filter(Boolean)).size;
   const withDemo=nt.filter(x=>(+x.demos||0)>0).length;
   const top=[...nt].sort((a,b)=>(+b.visits||0)-(+a.visits||0))[0];
   cards=[
    card('Нецелевых статей',n(nt.length),'не участвуют в основной оценке'),
    card('Визиты',n(nz.visits),'нецелевой трафик'),
    card('Клики',n(nz.clicks),'по этим страницам'),
    card('Демо',n(nz.demos),'если были зафиксированы'),
    card('С демо',n(withDemo),'нецелевых статей'),
    card('Рубрик',n(rubrics),'в нецелевом массиве'),
    card('Максимум трафика',top?n(top.visits):'—',top?short(top.title):'нет данных'),
   ];
 }
 else if(state.view==='kpiexclude'){
   const applied=(DATA.kpiExclusions?.applied||[]).filter(x=>x.site===state.site);
   const newly=(DATA.kpiExclusions?.approvedNew||[]).filter(x=>x.site===state.site);
   const candidates=(DATA.kpiExclusions?.candidates||[]).filter(x=>x.site===state.site);
   const av=applied.reduce((sum,x)=>sum+(+x.visits||0),0);
   const ad=applied.reduce((sum,x)=>sum+(+x.demos||0),0);
   const nv=newly.reduce((sum,x)=>sum+(+x.visits||0),0);
   const cv=candidates.reduce((sum,x)=>sum+(+x.visits||0),0);
   cards=[
    card('Исключено статей',n(applied.length),'из основной продуктовой оценки'),
    card('Исключено визитов',n(av),'трафик не влияет на основной показатель'),
    card('Исключено демо',n(ad),'если демо были'),
    card('Новые правила',n(newly.length),`${n(nv)} визитов затронуто`),
    card('Кандидатов на проверку',n(candidates.length),`${n(cv)} визитов затронуто`),
   ];
 }
 else if(state.view==='cleanup'){
   const cr=DATA.contentCleanup?.[state.site]||[];
   const by={};cr.forEach(x=>by[x.action]=(by[x.action]||0)+1);
   const zero=cr.filter(x=>(+x.visits||0)===0).length;
   const visits=cr.reduce((sum,x)=>sum+(+x.visits||0),0);
   cards=[
    card('Страниц на чистку',n(cr.length),'автоматический список на проверку'),
    card('Без входного трафика',n(zero),share(zero,cr.length)+' списка'),
    card('Остаточный трафик',n(visits),'нельзя удалять вслепую'),
    card('Архивировать',n(by['Убрать / архивировать']||0),'после проверки'),
    card('Перенаправить',n(by['Убрать / 301']||0),'нужна подходящая замена'),
    card('Переписать / объединить',n(by['Переписать / объединить']||0),'сохранить полезный спрос'),
    card('Переписать / перенести',n(by['Переписать / перенести']||0),'сохранить материал в другом формате'),
   ];
 }
 else{
   cards=[card('Статей',n(z.articles),'по выбранным фильтрам'),card('Визиты',n(z.visits)),card('Демо',n(z.demos)),card('Демо на 1000',d(z.demo1000))];
 }

 box.style.gridTemplateColumns=cards.length>=7?'repeat(8,minmax(110px,1fr))':'repeat(auto-fit,minmax(150px,1fr))';
 box.innerHTML=cards.map(x=>`<div class="kpi"><div class="label">${esc(x[0])}</div><div class="value">${esc(x[1])}</div><div class="note">${esc(x[2])}</div></div>`).join('');
}

// Верхняя сводка должна соответствовать текущей вкладке.
document.querySelectorAll('.nav button').forEach(btn=>btn.addEventListener('click',()=>setTimeout(renderKpis,0)));
renderKpis();
