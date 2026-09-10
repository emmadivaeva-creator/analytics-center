(async()=>{
 const B64="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";
 const bytes=Uint8Array.from(atob(B64),c=>c.charCodeAt(0));
 const raw=JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
 const labels={
  '2026-07-06':'06.07–12.07','2026-07-13':'13.07–19.07','2026-07-20':'20.07–26.07',
  '2026-07-27':'27.07–02.08','2026-08-03':'03.08–09.08','2026-08-10':'10.08–16.08',
  '2026-08-17':'17.08–23.08','2026-08-24':'24.08–30.08','2026-08-31':'31.08–06.09'
 };
 const DROP={};
 raw.rows.forEach(r=>DROP[String(r[0])]=r.slice(1));
 const baseRenderWeekly=renderWeekly;
 const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
 function classify(vals){
   const prev=vals.at(-2)||0,curr=vals.at(-1)||0,avgPrior3=avg(vals.slice(-5,-2)),avg4=avg(vals.slice(-5,-1));
   const change=prev?(curr-prev)/prev:null,vs4=avg4?(curr-avg4)/avg4:null;
   const spike=prev>=20 && prev>=Math.max(20,2.5*avgPrior3) && curr<=0.5*prev;
   if(prev>=20 && curr===0)return{label:'Трафик исчез',cls:'high',rank:0,kind:'real'};
   if(spike)return{label:'Всплеск закончился',cls:'info',rank:3,kind:'spike'};
   if(prev>=20 && change!==null && change<=-.5 && vs4!==null && vs4<=-.3)return{label:'Сильное устойчивое падение',cls:'high',rank:0,kind:'real'};
   if(prev>=10 && change!==null && change<=-.2 && vs4!==null && vs4<=-.2)return{label:'Устойчивое падение',cls:'mid',rank:1,kind:'real'};
   if(prev>=10 && change!==null && change<=-.2)return{label:'Разовая просадка',cls:'neutral',rank:2,kind:'noise'};
   return{label:'Стабильно / мало данных',cls:'neutral',rank:9,kind:'other'};
 }
 const pchange=v=>v==null?'—':`${v>0?'+':''}${d(v*100)}%`;
 function setIntro(progos){
   const sec=document.getElementById('view-weekly'); if(!sec)return;
   const warning=sec.querySelector('.warning'),upload=warning?.nextElementSibling;
   if(progos){
    warning.innerHTML='<b>Что реально упало.</b> Загружены 9 полных недель с 6 июля по 6 сентября. Падение сравниваем не только с прошлой неделей, но и со средним уровнем за предыдущие 4 недели. Отдельно отмечаем разовую просадку и закончившийся всплеск, чтобы не путать их с настоящим спадом.';
    if(upload)upload.style.display='none';
   }else{
    warning.innerHTML='<b>Для Бюджетника недельные файлы пока не подключены.</b> Как только будут выгрузки с теми же недельными периодами, соотнесу их отдельно. Сайты по ID не смешиваются.';
    if(upload)upload.style.display='block';
   }
 }
 renderWeekly=function(){
   if(state.site!=='ПроГосзаказ'){setIntro(false);return baseRenderWeekly();}
   setIntro(true);
   const weeks=raw.weeks;
   const meta=new Map((DATA.articles['ПроГосзаказ']||[]).map(a=>[String(a.id),a]));
   const rows=[];
   Object.entries(DROP).forEach(([id,vals])=>{
     const a=meta.get(id); if(!a||!articleFilter(a))return;
     const prev=vals.at(-2)||0,curr=vals.at(-1)||0,avg4=avg(vals.slice(-5,-1));
     const stat=classify(vals);
     if(stat.kind==='other')return;
     rows.push({...a,vals,prev,curr,delta:curr-prev,change:prev?(curr-prev)/prev:null,vs4:avg4?(curr-avg4)/avg4:null,_ws:stat});
   });
   rows.sort((a,b)=>a._ws.rank-b._ws.rank||a.delta-b.delta||b.prev-a.prev);
   const real=rows.filter(x=>x._ws.kind==='real'),strong=real.filter(x=>x._ws.label==='Сильное устойчивое падение'||x._ws.label==='Трафик исчез');
   const one=rows.filter(x=>x._ws.kind==='noise'),spike=rows.filter(x=>x._ws.kind==='spike');
   const lost=real.reduce((s,x)=>s+Math.max(0,x.prev-x.curr),0);
   document.getElementById('weeklySummary').innerHTML=`<div class="summary-strip">
    <div class="summary-tile"><small>Реально падают</small><b>${n(real.length)}</b><span class="small-note">ниже прошлой недели и обычного уровня</span></div>
    <div class="summary-tile"><small>Сильное падение</small><b>${n(strong.length)}</b><span class="small-note">обвал примерно на 50% и сильнее</span></div>
    <div class="summary-tile"><small>Потеряно визитов</small><b>${n(lost)}</b><span class="small-note">по устойчиво падающим статьям</span></div>
    <div class="summary-tile"><small>Разовая просадка</small><b>${n(one.length)}</b><span class="small-note">пока не считаем устойчивым падением</span></div>
    <div class="summary-tile"><small>Закончился всплеск</small><b>${n(spike.length)}</b><span class="small-note">предыдущая неделя была аномально высокой</span></div>
   </div>
   <div class="chart-comment"><b>Приоритет:</b> сначала строки «Сильное устойчивое падение», затем «Устойчивое падение». 
   «Разовая просадка» требует ещё недели наблюдения. «Всплеск закончился» отдельно вынесен, потому что это не то же самое, что потеря стабильного поискового трафика.</div>`;
   document.getElementById('weeklyCompareLabel').textContent='24.08–30.08 → 31.08–06.09';
   const wh=weeks.map(k=>`<th class="num">${esc(labels[k]||k)}</th>`).join('');
   document.getElementById('weeklyTable').innerHTML=`<table><thead><tr><th>Статья</th><th>Интент / тема</th>${wh}<th class="num">Изменение</th><th class="num">К среднему 4 недель</th><th>Вывод</th><th class="num">Демо</th></tr></thead><tbody>${
    rows.map(a=>`<tr>
     <td><a class="title-link" href="${esc(a.url)}" target="_blank">${esc(a.title)}</a><div class="small-note">ID ${esc(a.id)}</div></td>
     <td><span class="chip neutral">${esc(a.intent)}</span><div style="margin-top:5px"><span class="topic">${esc(a.topic)}</span></div></td>
     ${a.vals.map(v=>`<td class="num">${n(v)}</td>`).join('')}
     <td class="num"><b>${a.delta>0?'+':''}${n(a.delta)}</b><div class="small-note">${pchange(a.change)}</div></td>
     <td class="num">${pchange(a.vs4)}</td>
     <td><span class="chip ${a._ws.cls}">${esc(a._ws.label)}</span></td>
     <td class="num">${n(a.demos)}</td>
    </tr>`).join('')
   }</tbody></table>`;
   enhanceAllTables();
 }
 if(state.view==='weekly')renderWeekly();
})().catch(e=>console.error('weekly overlay',e));
