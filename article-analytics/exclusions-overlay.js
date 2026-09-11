(()=>{
  function patchStaticLabels(){
    const nonTargetBtn=document.querySelector('.nav button[data-view="nontarget"]');
    if(nonTargetBtn) nonTargetBtn.style.display='none';

    const exclusionBtn=document.querySelector('.nav button[data-view="kpiexclude"]');
    if(exclusionBtn) exclusionBtn.textContent='Исключено из целевого трафика';

    const section=document.getElementById('view-kpiexclude');
    if(!section) return;
    const cards=section.querySelectorAll('.card');
    if(cards[0]){
      const h=cards[0].querySelector('.card-head h3');
      const hint=cards[0].querySelector('.card-head .hint');
      if(h) h.textContent='Уже исключено из целевого трафика';
      if(hint) hint.textContent='эти статьи не участвуют в целевых показателях и основной аналитике';
    }
    if(cards[1]){
      const h=cards[1].querySelector('.card-head h3');
      const hint=cards[1].querySelector('.card-head .hint');
      if(h) h.textContent='Кандидаты на исключение';
      if(hint) hint.textContent='пока остаются в целевом трафике до отдельного решения';
    }
  }

  const baseRenderKpiExclusions=renderKpiExclusions;
  renderKpiExclusions=function(){
    baseRenderKpiExclusions();
    patchStaticLabels();

    const applied=(DATA.kpiExclusions?.applied||[]).filter(x=>x.site===state.site);
    const newly=(DATA.kpiExclusions?.approvedNew||[]).filter(x=>x.site===state.site);
    const candidates=(DATA.kpiExclusions?.candidates||[]).filter(x=>x.site===state.site);
    const appliedVisits=applied.reduce((z,x)=>z+(+x.visits||0),0);
    const appliedDemos=applied.reduce((z,x)=>z+(+x.demos||0),0);
    const newVisits=newly.reduce((z,x)=>z+(+x.visits||0),0);
    const newDemos=newly.reduce((z,x)=>z+(+x.demos||0),0);
    const candVisits=candidates.reduce((z,x)=>z+(+x.visits||0),0);

    const summary=document.getElementById('kpiExcludeSummary');
    if(summary){
      summary.innerHTML=`
        <div class="warning"><b>Как читать этот раздел:</b> верхний список уже полностью исключён из целевого трафика и не влияет на показатели эффективности. Нижний список — только кандидаты: они пока остаются в целевом трафике, пока по ним не принято отдельное решение.</div>
        <div class="summary-strip">
          <div class="summary-tile"><small>Уже исключено статей</small><b>${n(applied.length)}</b><span class="small-note">не участвуют в целевых показателях</span></div>
          <div class="summary-tile"><small>Исключено визитов</small><b>${n(appliedVisits)}</b></div>
          <div class="summary-tile"><small>Исключено демо</small><b>${n(appliedDemos)}</b></div>
          <div class="summary-tile"><small>Дополнительно исключено по правилам</small><b>${n(newly.length)}</b><span class="small-note">${n(newVisits)} визитов • ${n(newDemos)} демо</span></div>
          <div class="summary-tile"><small>Кандидатов на исключение</small><b>${n(candidates.length)}</b><span class="small-note">${n(candVisits)} визитов пока остаются в целевом трафике</span></div>
        </div>`;
    }
  };

  const baseSwitchView=switchView;
  switchView=function(v){
    if(v==='nontarget') v='kpiexclude';
    baseSwitchView(v);
    patchStaticLabels();
    if(v==='kpiexclude') document.getElementById('pageTitle').textContent='Исключено из целевого трафика';
  };

  patchStaticLabels();
})();
