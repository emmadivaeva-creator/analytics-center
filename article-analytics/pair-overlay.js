(()=>{
  let pairPage=1;
  const PAGE=80;
  const logGap=(a,b)=>Math.abs(Math.log(Math.max(+a||1,1)/Math.max(+b||1,1)));
  const ratio=(a,b)=>(+a>0&&+b>0)?(+b/+a):null;

 function tier(a,b){
  const r=ratio(a.visits,b.visits);
  const sameTopic=(a.topic||'')===(b.topic||'');
  const sameIntent=(a.intent||'')===(b.intent||'');
  const close=r!==null&&r>=0.5&&r<=2;

  if(!sameIntent)return 99;
  if(!sameTopic)return 99;

  if(close && (+b.demos||0)>=2)return 0;
  if(close && (+b.demos||0)>0)return 1;

  return 99;
}
  function basis(a,b){
    if(!b)return 'Внутри интента нет второй статьи';
    const r=ratio(a.visits,b.visits),same=(a.topic||'')===(b.topic||''),close=r!==null&&r>=.5&&r<=2;
    if(same&&close)return 'Та же тема и похожий объём трафика';
    if(close)return 'Тот же интент и похожий объём трафика';
    if(same)return 'Та же тема, но объём трафика отличается';
    return 'Тот же интент, объём трафика отличается';
  }
  function quality(a,b){
    if(!b)return 'Нет сравнения';
    const t=tier(a,b);
    if(t===0 && (+b.demos||0)>=2)return 'Высокое';
    if(t<=2)return 'Среднее';
    return 'Базовое';
  }
 function choose(a,candidates){
  const good=candidates.filter(x=>{
    const t=tier(a,x);
    return t<99;
  });

  if(!good.length)return null;

  return [...good].sort(
    (x,y)=>
      tier(a,x)-tier(a,y) ||
      logGap(a.visits,x.visits)-logGap(a.visits,y.visits) ||
      (+y.demos||0)-(+x.demos||0)
  )[0]||null;
}
  function alternatives(a,candidates,primary){
    return [...candidates].filter(x=>!primary||String(x.id)!==String(primary.id)).sort((x,y)=>tier(a,x)-tier(a,y)||((+y.demos||0)>0)-((+x.demos||0)>0)||logGap(a.visits,x.visits)-logGap(a.visits,y.visits)).slice(0,2);
  }
  function diagnose(a,p){
    const visits=+a.visits||0,av=+a.demo_1000||0;
    if(!p)return {diagnosis:'Нет второй статьи внутри интента',reason:'В этом интенте нет другой статьи для корректного сравнения.',action:'Оставить без пары до появления второй статьи с тем же интентом.',potential:0,priority:'Нет пары'};
    if(visits<100)return {diagnosis:'Мало данных для вывода',reason:`Пара подобрана, но у статьи только ${Math.round(visits)} входных визитов. На таком объёме разница в демо слишком шумная.`,action:'Использовать пару как ориентир по теме и интенту, но не менять статью только из-за текущей конверсии.',potential:0,priority:'Низкий'};
    const bv=+p.demo_1000||0;
    if((+p.demos||0)===0)return {diagnosis:'В паре нет успешного примера',reason:'Сопоставимая статья тоже не дала демо. Пара корректна по интенту, но не показывает рабочий сценарий конверсии.',action:'Сравнить содержание и блок перехода в демо, но вывод о причине делать только после ручной проверки.',potential:0,priority:'Низкий'};
    const rel=bv>0?av/bv:1;
    let diagnosis='Текущая не хуже статьи для сравнения';
    if(rel<.7){
      const pre=(+p.click_visit||0)>0 && (+a.click_visit||0)<.7*(+p.click_visit||0);
      const post=a.demo_click!=null&&p.demo_click!=null&&(+p.demo_click||0)>0&&(+a.demo_click||0)<.7*(+p.demo_click||0);
      diagnosis=pre&&post?'Провал до клика и после клика':pre?'Провал до клика':post?'Провал после клика':'Итоговая отдача ниже статьи для сравнения';
    }else if(rel<1) diagnosis='Результат близок к статье для сравнения';
    const gap=Math.max(0,(1-rel)*100);
    const reason=rel<.7?`Статья для сравнения даёт ${bv.toFixed(2)} демо на 1000 визитов против ${av.toFixed(2)} у анализируемой статьи. Разрыв около ${gap.toFixed(0)}%.`:rel<1?`Разница небольшая: ${bv.toFixed(2)} против ${av.toFixed(2)} демо на 1000 визитов.`:`Анализируемая статья не уступает паре: ${av.toFixed(2)} против ${bv.toFixed(2)} демо на 1000 визитов.`;
    let action='Не менять статью только по этому сравнению.';
    if(diagnosis==='Провал до клика и после клика')action='Сравнить расположение и формулировку блока перехода в демо, затем проверить предложение после клика.';
    else if(diagnosis==='Провал до клика')action='Сравнить расположение, видимость и формулировку блока перехода в демо.';
    else if(diagnosis==='Провал после клика')action='Клики есть, но демо слабее. Проверить предложение после клика и следующий шаг пользователя.';
    else if(diagnosis==='Итоговая отдача ниже статьи для сравнения')action='Проверить, соответствует ли предложение интенту статьи и логично ли ведёт пользователя в демо.';
    const potential=Math.max((bv-av)*visits/1000,0);
    const priority=potential>=2||(visits>=1000&&potential>=1)?'Высокий':potential>=.5?'Средний':'Низкий';
    return {diagnosis,reason,action,potential,priority};
  }
  function rebuild(site,articles){
    const byIntent=new Map();
    articles.forEach(a=>{const k=a.intent||'Не определён';if(!byIntent.has(k))byIntent.set(k,[]);byIntent.get(k).push(a)});
    const rows=[],use={};
    articles.forEach(a=>{
const candidates=(byIntent.get(a.intent||'Не определён')||[])
.filter(
 b=>String(b.id)!==String(a.id)
 &&(+b.visits||0)>0
);      if(!p){
  a.no_pair_reason =
    candidates.length===0
      ? 'Нет других статей внутри интента'
      : 'Нет качественной статьи для сравнения';
},alts=alternatives(a,candidates,p),d0=diagnose(a,p);
      Object.assign(a,{diagnosis:d0.diagnosis,reason:d0.reason,action:d0.action,priority:d0.priority});
      const shown=[p,...alts].filter(Boolean),success=shown.filter(x=>(+x.demos||0)>0),better=success.filter(x=>(+a.demo_1000||0)<.7*(+x.demo_1000||0)).length;
      const stability=better>=2?`Сигнал подтверждают ${better} статьи из ${success.length} показанных ориентиров.`:better===1?'Сигнал есть только по одному из показанных ориентиров.':'Сильный разрыв дополнительными ориентирами не подтверждён.';
      const row={...a,candidate_count:candidates.length,comparison_quality:quality(a,p),comparison_basis:basis(a,p),alternatives:alts.map(b=>({id:String(b.id),title:b.title,url:b.url,visits:+b.visits||0,demos:+b.demos||0,demo_1000:+b.demo_1000||0,click_visit:+b.click_visit||0,topic:b.topic||''})),successful_compare_count:success.length,better30_count:better,comparison_stability:stability,potential:d0.potential, no_pair_reason:a.no_pair_reason||''};
      if(p){Object.assign(row,{pair_id:String(p.id),pair_title:p.title,pair_url:p.url,pair_visits:+p.visits||0,pair_clicks:+p.clicks||0,pair_demo_art:+p.demo_art||0,pair_demo_pw:+p.demo_pw||0,pair_demos:+p.demos||0,pair_click_visit:+p.click_visit||0,pair_demo_click:p.demo_click,pair_demo_1000:+p.demo_1000||0,pair_topic:p.topic||''});use[String(p.id)]=(use[String(p.id)]||0)+1}
      else Object.assign(row,{pair_id:'',pair_title:'',pair_url:'',pair_visits:0,pair_clicks:0,pair_demo_art:0,pair_demo_pw:0,pair_demos:0,pair_click_visit:0,pair_demo_click:null,pair_demo_1000:0,pair_topic:''});
      rows.push(row)
    });
    rows.forEach(r=>r.pair_used_by=r.pair_id?(use[r.pair_id]||0):0);
    return rows;
  }

  rebuildBenchmarksForSite=rebuild;
  DATA.pairs['Бюджетник']=rebuild('Бюджетник',DATA.articles['Бюджетник']||[]);
  DATA.pairs['ПроГосзаказ']=rebuild('ПроГосзаказ',DATA.articles['ПроГосзаказ']||[]);

  diagnosisClass=function(p){
    if(/не хуже|близок|близка/i.test(p||''))return'good';
    if(/провал|ниже статьи/i.test(p||''))return'high';
    if(/мало данных|нет второй|нет успешного/i.test(p||''))return'info';
    return'neutral';
  };

  renderPairs=function(){
    let all=currentPairs().sort((a,b)=>b.potential-a.potential||b.visits-a.visits),total=all.length;
    if(!total){document.getElementById('pairList').innerHTML='<div class="empty">Нет сравнений под выбранные фильтры.</div>';return}
    const pages=Math.max(1,Math.ceil(total/PAGE));if(pairPage>pages)pairPage=pages;
    const start=(pairPage-1)*PAGE,rows=all.slice(start,start+PAGE);
    const nav=pages>1?`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 14px"><div class="small-note">Сравниваются все ${n(total)} статей. Показано ${n(start+1)}–${n(Math.min(start+PAGE,total))}.</div><div style="display:flex;gap:8px"><button class="btn" id="pairPrev" ${pairPage<=1?'disabled':''}>← Предыдущие</button><span class="chip neutral">${pairPage} из ${pages}</span><button class="btn" id="pairNext" ${pairPage>=pages?'disabled':''}>Следующие →</button></div></div>`:`<div class="small-note" style="margin-bottom:14px">Сравниваются все ${n(total)} статей внутри текущего сайта и интента.</div>`;
    document.getElementById('pairList').innerHTML=nav+rows.map(p=>{
      const has=!!p.pair_id,q=p.comparison_quality||'—',alts=(p.alternatives||[]).slice(0,2),used=has?(+p.pair_used_by||0):0;
      const altHtml=alts.length?`<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)"><div class="small-note" style="font-weight:700;margin-bottom:7px">ЕЩЁ ДВЕ СТАТЬИ ДЛЯ ПРОВЕРКИ ВЫВОДА</div>${alts.map((x,i)=>`<div style="margin:6px 0"><a href="${esc(x.url)}" target="_blank" class="title-link">${i+1}. ${esc(x.title)}</a><span class="small-note"> · ${n(x.visits)} визитов · ${n(x.demos)} демо · ${d(x.demo_1000)} демо на 1000</span></div>`).join('')}</div>`:'';
      return `<div class="pair"><div class="pair-top"><div class="pair-side weak"><div class="small-note" style="margin-bottom:7px;font-weight:700">АНАЛИЗИРУЕМАЯ СТАТЬЯ</div><a class="pair-title" href="${esc(p.url)}" target="_blank">${esc(p.title)}</a><div class="small-note">№ ${esc(p.id)} · ${esc(p.intent)} · ${esc(p.topic)}</div><div class="metrics"><div class="metric"><small>визиты</small><b>${n(p.visits)}</b></div><div class="metric"><small>клики</small><b>${n(p.clicks)}</b></div><div class="metric"><small>демо</small><b>${n(p.demos)}</b></div><div class="metric"><small>демо на 1000</small><b>${d(p.demo_1000)}</b></div></div></div><div class="vs">↔</div><div class="pair-side strong">${has?`<div class="small-note" style="margin-bottom:7px;font-weight:700">СТАТЬЯ ДЛЯ СРАВНЕНИЯ</div><a class="pair-title" href="${esc(p.pair_url)}" target="_blank">${esc(p.pair_title)}</a><div class="small-note">№ ${esc(p.pair_id)} · ${esc(p.intent)} · ${esc(p.pair_topic||'')}</div><div class="metrics"><div class="metric"><small>визиты</small><b>${n(p.pair_visits)}</b></div><div class="metric"><small>клики</small><b>${n(p.pair_clicks)}</b></div><div class="metric"><small>демо</small><b>${n(p.pair_demos)}</b></div><div class="metric"><small>демо на 1000</small><b>${d(p.pair_demo_1000)}</b></div></div><div style="margin-top:9px;display:flex;gap:6px;flex-wrap:wrap"><span class="chip ${q==='Высокое'?'good':q==='Среднее'?'info':'mid'}">качество сравнения: ${esc(q)}</span><span class="chip neutral">${esc(p.comparison_basis||'')}</span><span class="chip neutral">используется как пара для ${n(used)} статей</span></div>${altHtml}`:`<div class="muted">Внутри этого интента нет второй статьи.</div>`}</div></div><div class="pair-bottom"><div><span class="chip ${diagnosisClass(p.diagnosis)}">${esc(p.diagnosis)}</span><div style="margin-top:6px"><span class="topic">${esc(p.topic)}</span></div></div><div><strong>Что показывает сравнение</strong><p>${esc(p.reason)}</p><div class="small-note">${esc(p.comparison_stability||'')}</div></div><div><strong>Что проверить в анализируемой статье</strong><p>${esc(p.action)}</p></div><div><strong>Потенциал дополнительных демо</strong><div class="potential">${(+p.potential||0)>0?'+'+d(p.potential):'—'}</div><span class="chip ${priorityClass(p.priority)}">${esc(p.priority||'—')}</span></div></div></div>`
    }).join('');
    const prev=document.getElementById('pairPrev'),next=document.getElementById('pairNext');
    if(prev)prev.onclick=()=>{pairPage=Math.max(1,pairPage-1);renderPairs();window.scrollTo({top:0,behavior:'smooth'})};
    if(next)next.onclick=()=>{pairPage=Math.min(pages,pairPage+1);renderPairs();window.scrollTo({top:0,behavior:'smooth'})};
  };

  const pairWarning=document.querySelector('#view-pairs .warning');
  if(pairWarning)pairWarning.innerHTML='<b>Как выбирается статья для сравнения.</b> Сравнение всегда остаётся внутри одного сайта и одного интента. Сначала ищется та же тема и похожий объём трафика. Если точной пары нет, система постепенно расширяет отличие по теме и трафику, но не выходит за пределы интента. Поэтому пары есть у всех статей, если внутри интента есть хотя бы ещё одна статья.';
  const noPairHead=document.querySelector('#view-nopair .card-head');
  if(noPairHead)noPairHead.innerHTML='<div><h3>Статьи, для которых внутри интента действительно нет второй статьи</h3><div class="small-note" style="margin-top:5px;max-width:980px;line-height:1.45">Тема и диапазон трафика больше не блокируют сравнение. Здесь остаются только реальные одиночные случаи внутри интента.</div></div><span class="hint">сайты никогда не смешиваются</span>';
  const method=document.querySelector('#view-method .method');
  if(method)method.innerHTML='<div class="warning"><b>Жёсткое правило:</b> Бюджетник сравнивается только с Бюджетником, ПроГосзаказ только с ПроГосзаказом. Между сайтами статьи никогда не сравниваются.</div><h3>Как строится сравнение статей</h3><p>Главное правило пары: <b>тот же сайт и тот же интент пользователя</b>. Узкая тема и объём трафика больше не являются запретами. Они помогают выбрать наиболее близкую статью внутри интента.</p><p>Сначала система ищет статью той же темы с трафиком примерно от половины до двойного объёма. Если такой нет, берёт статью того же интента с похожим трафиком. Затем постепенно расширяет допустимое отличие по теме и трафику. Поэтому статья остаётся без пары только если внутри её интента действительно нет второй статьи.</p><p>Если внутри подходящей группы есть статьи, которые уже дали демо, предпочтение отдаётся им. При этом близость трафика важнее максимальной конверсии.</p><p><b>Качество сравнения</b> показывает, насколько близка пара. Высокое: та же тема, похожий трафик и устойчивый результат. Среднее: совпадает тема или трафик близкий. Базовое: совпадает интент, но тема или объём трафика заметно отличаются.</p><p>Статьи с трафиком меньше 100 визитов тоже получают пару, но вывод помечается как «Мало данных для вывода».</p><h3>Как читать показатели</h3><ul><li><b>Демо на 1000 визитов</b> — основной показатель итоговой отдачи статьи.</li><li><b>Клики / визиты</b> — диагностический показатель перехода из статьи в редблок.</li><li><b>Демо / клики</b> — тоже диагностический показатель, потому что часть демо приходит через экран ограничения доступа.</li><li><b>Потенциал дополнительных демо</b> — сценарная оценка результата при достижении показателя статьи для сравнения.</li></ul><h3>Трафик по неделям</h3><p>Неполные календарные недели не используются для сравнения. Падением считается снижение минимум на 20% при базе от 10 визитов за предыдущую неделю; сильным падением — минимум на 50% при базе от 20 визитов.</p><h3>Комментарии к рекомендациям</h3><p>Рекомендации строятся по трафику, кликам, демо, интенту, теме и выбранной статье для сравнения. Это автоматическая гипотеза, а не ручной просмотр каждой страницы.</p>';
})();
