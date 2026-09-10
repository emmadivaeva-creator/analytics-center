(async()=>{
 const txt=(await fetch('weekly-data.b64?v=20260910-weekly2',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('weekly-data '+r.status);return r.text()})).trim();
 const bytes=Uint8Array.from(atob(txt),c=>c.charCodeAt(0));
 const WD=JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
 const W=WD.weeks, MAP={};
 Object.entries(WD.sites).forEach(([site,rows])=>{const m={};rows.forEach(r=>m[String(r[0])]=r.slice(1));MAP[site]=m});
 const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
 const pp=v=>v==null?'—':`${v>0?'+':''}${d(v*100)}%`;
 function cls(vals){
  const p=vals.at(-2)||0,c=vals.at(-1)||0,a3=avg(vals.slice(-5,-2)),a4=avg(vals.slice(-5,-1));
  const ch=p?(c-p)/p:null,v4=a4?(c-a4)/a4:null,spike=p>=20&&p>=Math.max(20,2.5*a3)&&c<=.5*p;
  if(p>=20&&c===0)return{label:'Трафик исчез',css:'high',rank:0,kind:'real',ch,v4};
  if(spike)return{label:'Всплеск закончился',css:'info',rank:4,kind:'spike',ch,v4};
  if(p>=20&&ch<=-.5&&v4<=-.3)return{label:'Сильное устойчивое падение',css:'high',rank:0,kind:'real',ch,v4};
  if(p>=10&&ch<=-.2&&v4<=-.2)return{label:'Устойчивое падение',css:'mid',rank:1,kind:'real',ch,v4};
  if(a4>=20&&v4<=-.3)return{label:'Ниже обычного уровня',css:'mid',rank:2,kind:'real',ch,v4};
  if(p>=10&&ch<=-.2)return{label:'Разовая просадка',css:'neutral',rank:3,kind:'noise',ch,v4};
  if(p===0&&c>=10)return{label:'Новый рост',css:'good',rank:6,kind:'growth',ch,v4};
  if(p>=10&&ch>=.2)return{label:'Рост',css:'good',rank:6,kind:'growth',ch,v4};
  return{label:'Стабильно / мало данных',css:'neutral',rank:9,kind:'other',ch,v4};
 }
 function rows(){
  const meta=new Map((DATA.articles[state.site]||[]).map(a=>[String(a.id),a])),out=[];
  Object.entries(MAP[state.site]||{}).forEach(([id,vals])=>{const a=meta.get(id);if(!a||!articleFilter(a)||!vals.some(v=>v>0))return;const s=cls(vals),p=vals.at(-2)||0,c=vals.at(-1)||0;out.push({...a,vals,prev:p,curr:c,delta:c-p,_w:s})});
  return out;
 }
 function intro(){
  const sec=document.getElementById('view-weekly'),w=sec?.querySelector('.warning'),upload=w?.nextElementSibling;
  if(w)w.innerHTML='<b>Что реально упало.</b> Загружены <b>9 полных недель</b> с 6 июля по 6 сентября. Последнюю неделю сравниваем и с предыдущей, и со средним за предыдущие 4 недели. Период 1–5 июля исключён как неполный. <b>Бюджетник и ПроГосзаказ считаются строго отдельно.</b>';
  if(upload)upload.style.display='none';
 }
 renderWeekly=function(){
  intro();const sum=document.getElementById('weeklySummary'),table=document.getElementById('weeklyTable'),lab=document.getElementById('weeklyCompareLabel'),all=rows();
  if(!all.length){sum.innerHTML='';table.innerHTML='<div class="empty">Нет недельных данных под текущими фильтрами.</div>';lab.textContent='нет данных';return}
  const pt=all.reduce((s,x)=>s+x.prev,0),ct=all.reduce((s,x)=>s+x.curr,0),chg=pt?(ct-pt)/pt:null;
  const real=all.filter(x=>x._w.kind==='real'),strong=real.filter(x=>x._w.label==='Сильное устойчивое падение'||x._w.label==='Трафик исчез'),noise=all.filter(x=>x._w.kind==='noise'),spikes=all.filter(x=>x._w.kind==='spike'),growth=all.filter(x=>x._w.kind==='growth');
  const lost=real.reduce((s,x)=>s+Math.max(0,x.prev-x.curr),0),show=all.filter(x=>['real','noise','spike'].includes(x._w.kind));
  show.sort((a,b)=>a._w.rank-b._w.rank||a.delta-b.delta||b.prev-a.prev);
  const top=[...real].sort((a,b)=>a.delta-b.delta||b.prev-a.prev).slice(0,8),pl=W.at(-2).label,cl=W.at(-1).label;lab.textContent=`${pl} → ${cl}`;
  const topHtml=top.length?top.map((a,i)=>`<tr><td class="num">${i+1}</td><td><a class="title-link" href="${esc(a.url)}" target="_blank">${esc(a.title||a.url)}</a><div class="small-note">№ ${esc(a.id)}</div></td><td class="num">${n(a.prev)}</td><td class="num">${n(a.curr)}</td><td class="num">${n(a.delta)}</td><td class="num">${pp(a._w.ch)}</td><td class="num">${pp(a._w.v4)}</td><td><span class="chip ${a._w.css}">${esc(a._w.label)}</span></td></tr>`).join(''):'<tr><td colspan="8"><div class="empty">Устойчивых падений нет.</div></td></tr>';
  sum.innerHTML=`<div class="summary-strip"><div class="summary-tile"><small>Прошлая неделя</small><b>${n(pt)}</b><span class="small-note">${pl}</span></div><div class="summary-tile"><small>Последняя неделя</small><b>${n(ct)}</b><span class="small-note">${cl}</span></div><div class="summary-tile"><small>Изменение</small><b>${pp(chg)}</b><span class="small-note">${ct-pt>=0?'+':''}${n(ct-pt)} визитов</span></div><div class="summary-tile"><small>Реально падают</small><b>${n(real.length)}</b></div><div class="summary-tile"><small>Сильное падение</small><b>${n(strong.length)}</b></div><div class="summary-tile"><small>Потеряно визитов</small><b>${n(lost)}</b></div><div class="summary-tile"><small>Разовая просадка</small><b>${n(noise.length)}</b></div><div class="summary-tile"><small>Закончился всплеск</small><b>${n(spikes.length)}</b></div></div><div class="card" style="margin-bottom:16px"><div class="card-head"><div><h3>Главные потери последней недели</h3><div class="small-note" style="margin-top:5px">Только подтверждённое падение, сортировка по потерянным визитам.</div></div><span class="hint">${esc(state.site)}</span></div><div class="table-wrap" style="max-height:430px"><table style="min-width:1050px"><thead><tr><th class="num">№</th><th>Статья</th><th class="num">${pl}</th><th class="num">${cl}</th><th class="num">Потеря</th><th class="num">К прошлой</th><th class="num">К среднему 4 нед.</th><th>Что происходит</th></tr></thead><tbody>${topHtml}</tbody></table></div></div>`;
  const wh=W.map(w=>`<th class="num">${esc(w.label)}</th>`).join('');
  table.innerHTML=`<table style="min-width:1550px"><thead><tr><th>Статья</th><th>Интент / тема</th>${wh}<th class="num">Δ визитов</th><th class="num">К прошлой</th><th class="num">К среднему 4 нед.</th><th>Что происходит</th><th class="num">Демо за период</th></tr></thead><tbody>`+show.map(a=>`<tr><td><a class="title-link" href="${esc(a.url)}" target="_blank">${esc(a.title||a.url)}</a><div class="small-note">№ ${esc(a.id)}</div></td><td><span class="chip neutral">${esc(a.intent)}</span><div style="margin-top:6px"><span class="topic">${esc(a.topic)}</span></div></td>${W.map((w,i)=>`<td class="num">${n(a.vals[i]||0)}</td>`).join('')}<td class="num">${a.delta>0?'+':''}${n(a.delta)}</td><td class="num">${pp(a._w.ch)}</td><td class="num">${pp(a._w.v4)}</td><td><span class="chip ${a._w.css}">${esc(a._w.label)}</span></td><td class="num">${n(a.demos)}</td></tr>`).join('')+'</tbody></table>';
  enhanceAllTables();
 };
 renderWeekly();
})();
