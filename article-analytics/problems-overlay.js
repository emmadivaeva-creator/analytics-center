(()=>{
  const baseRenderProblems=renderProblems;
  renderProblems=function(){
    baseRenderProblems();
    const proven=problemRows();
    const research=researchRows();
    const total=proven.length+research.length;
    const host=document.getElementById('problemsTable');
    if(!host)return;
    const strip=document.createElement('div');
    strip.className='summary-strip';
    strip.style.marginBottom='16px';
    strip.innerHTML=`
      <div class="summary-tile"><small>Всего на разбор</small><b>${n(total)}</b><span class="small-note">под текущими фильтрами</span></div>
      <div class="summary-tile"><small>Подтверждённые проблемы</small><b>${n(proven.length)}</b><span class="small-note">есть сравнение и заметный разрыв</span></div>
      <div class="summary-tile"><small>Требуют ручной проверки</small><b>${n(research.length)}</b><span class="small-note">пока недостаточно данных для вывода</span></div>`;
    host.prepend(strip);
  };
})();
