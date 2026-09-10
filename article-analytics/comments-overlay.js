(()=>{
  const STORAGE_KEY='aa.problemNotes.v1';
  const AUTHOR_KEY='aa.problemAuthor.v1';
  const REMOTE_ENDPOINT=''; // После публикации Apps Script сюда подставляется URL /exec
  const STATUSES=['Не разобрано','В работе','Исправить','Не трогать','Готово'];
  let notes={};
  try{notes=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')||{}}catch(e){notes={}}
  let remoteBusy=false;

  const noteKey=(site,id)=>`${site}::${id}`;
  const getNote=(site,id)=>notes[noteKey(site,id)]||{status:'Не разобрано',comment:'',author:'',updatedAt:''};
  const saveLocal=()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(notes))}catch(e){console.warn('Не удалось сохранить комментарии локально',e)}};

  function addStyles(){
    if(document.getElementById('problemCommentsStyle'))return;
    const s=document.createElement('style');s.id='problemCommentsStyle';s.textContent=`
      .review-toolbar{display:flex;align-items:end;gap:12px;flex-wrap:wrap;background:#fff;border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:0 0 16px}
      .review-toolbar label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#8e95a2;font-weight:800;margin-bottom:4px}
      .review-toolbar input{width:240px;max-width:65vw;border:1px solid #dfe2e7;border-radius:7px;padding:8px 9px;background:#fff;color:#242833}
      .review-mode{margin-left:auto;align-self:center;font-size:11px;color:#7b8290}
      .review-cell{min-width:300px;width:340px}
      .review-status{width:100%;border:1px solid #dfe2e7;border-radius:7px;padding:7px 8px;background:#fff;margin-bottom:7px}
      .review-comment{display:block;width:100%;min-height:74px;resize:vertical;border:1px solid #dfe2e7;border-radius:7px;padding:8px 9px;font:inherit;line-height:1.35;background:#fff;color:#242833}
      .review-actions{display:flex;align-items:center;gap:8px;margin-top:7px;min-height:30px}
      .review-save{border:1px solid #d8daf0;background:#f2f1ff;color:#4840a0;border-radius:7px;padding:6px 9px;cursor:pointer;font-weight:700;font-size:11px}
      .review-save:hover{background:#e9e7ff}
      .review-meta{font-size:10px;color:#9298a5;line-height:1.3}
      #problemsTable table{min-width:1300px}
    `;document.head.appendChild(s);
  }

  function author(){return (localStorage.getItem(AUTHOR_KEY)||'').trim()}
  function setAuthor(v){localStorage.setItem(AUTHOR_KEY,(v||'').trim())}

  function insertToolbar(host){
    const old=document.getElementById('problemReviewToolbar');if(old)old.remove();
    const bar=document.createElement('div');bar.id='problemReviewToolbar';bar.className='review-toolbar';
    const mode=REMOTE_ENDPOINT
      ? 'Общие комментарии: синхронизация с таблицей'
      : 'Пока сохраняется только в этом браузере. Общая таблица уже подготовлена, нужен адрес Apps Script.';
    bar.innerHTML=`<div><label>Кто анализирует</label><input id="problemReviewAuthor" placeholder="Имя" value="${esc(author())}"></div><div class="review-mode">${esc(mode)}</div>`;
    const strip=host.querySelector('.summary-strip');
    if(strip)strip.insertAdjacentElement('afterend',bar);else host.prepend(bar);
    const inp=bar.querySelector('#problemReviewAuthor');
    inp.addEventListener('change',()=>setAuthor(inp.value));
    inp.addEventListener('blur',()=>setAuthor(inp.value));
  }

  function parseArticleId(tr){
    const note=tr.querySelector('td:first-child .small-note')?.textContent||'';
    return (note.match(/(?:ID|№)\s*(\d+)/i)||[])[1]||'';
  }

  function decorateTable(table){
    if(!table||table.dataset.reviewDecorated==='1')return;
    table.dataset.reviewDecorated='1';
    const head=table.querySelector('thead tr');if(!head)return;
    const th=document.createElement('th');th.textContent='Разбор / комментарий';th.style.minWidth='320px';head.appendChild(th);
    table.querySelectorAll('tbody tr').forEach(tr=>{
      const id=parseArticleId(tr);if(!id)return;
      const site=state.site,title=tr.querySelector('td:first-child .title-link')?.textContent?.trim()||'';
      const nt=getNote(site,id);
      const td=document.createElement('td');td.className='review-cell';td.dataset.site=site;td.dataset.id=id;td.dataset.title=title;
      td.innerHTML=`
        <select class="review-status">${STATUSES.map(x=>`<option ${x===(nt.status||'Не разобрано')?'selected':''}>${esc(x)}</option>`).join('')}</select>
        <textarea class="review-comment" placeholder="Что нашли, что исправить, почему не трогаем…">${esc(nt.comment||'')}</textarea>
        <div class="review-actions"><button class="review-save">Сохранить</button><span class="review-meta">${nt.updatedAt?`${esc(nt.author||'')} · ${esc(nt.updatedAt)}`:'Комментария пока нет'}</span></div>`;
      tr.appendChild(td);
      td.querySelector('.review-save').addEventListener('click',()=>saveCell(td));
    });
  }

  function decorate(){
    addStyles();
    const host=document.getElementById('problemsTable');if(!host)return;
    insertToolbar(host);
    host.querySelectorAll('table').forEach(decorateTable);
  }

  function nowLabel(){
    return new Date().toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  }

  function saveCell(td){
    const site=td.dataset.site,id=td.dataset.id,title=td.dataset.title||'';
    const status=td.querySelector('.review-status').value;
    const comment=td.querySelector('.review-comment').value.trim();
    const who=author()||'Без имени';
    const updatedAt=nowLabel();
    notes[noteKey(site,id)]={status,comment,author:who,updatedAt,title};saveLocal();
    const meta=td.querySelector('.review-meta');
    if(!REMOTE_ENDPOINT){meta.textContent=`Сохранено локально · ${who} · ${updatedAt}`;return}
    meta.textContent='Сохраняю в общей таблице…';
    submitRemote({site,id,title,status,comment,author:who});
    setTimeout(()=>{loadRemote(true).then(ok=>{meta.textContent=ok?`Сохранено · ${who} · ${updatedAt}`:'Сохранено локально, общая таблица пока недоступна';});},900);
  }

  function submitRemote(data){
    try{
      let frame=document.getElementById('problemCommentsSink');
      if(!frame){frame=document.createElement('iframe');frame.id='problemCommentsSink';frame.name='problemCommentsSink';frame.style.display='none';document.body.appendChild(frame)}
      const form=document.createElement('form');form.method='POST';form.action=REMOTE_ENDPOINT;form.target='problemCommentsSink';form.style.display='none';
      const payload={action:'save',...data};
      Object.entries(payload).forEach(([k,v])=>{const i=document.createElement('input');i.type='hidden';i.name=k;i.value=v??'';form.appendChild(i)});
      document.body.appendChild(form);form.submit();setTimeout(()=>form.remove(),1000);
    }catch(e){console.error('Не удалось отправить комментарий',e)}
  }

  function loadRemote(force=false){
    if(!REMOTE_ENDPOINT||remoteBusy)return Promise.resolve(false);
    remoteBusy=true;
    return new Promise(resolve=>{
      const cb='aaComments_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const sc=document.createElement('script');
      let done=false;
      const finish=ok=>{if(done)return;done=true;remoteBusy=false;delete window[cb];sc.remove();resolve(ok)};
      window[cb]=data=>{
        try{
          (data?.items||[]).forEach(x=>{notes[noteKey(String(x.site||''),String(x.id||''))]={status:x.status||'Не разобрано',comment:x.comment||'',author:x.author||'',updatedAt:x.updatedAt||'',title:x.title||''}});
          saveLocal();
          if(force&&state.view==='problems')renderProblems();
          finish(true);
        }catch(e){console.error('Ошибка чтения общих комментариев',e);finish(false)}
      };
      sc.onerror=()=>finish(false);
      sc.src=`${REMOTE_ENDPOINT}${REMOTE_ENDPOINT.includes('?')?'&':'?'}action=list&callback=${encodeURIComponent(cb)}&_=${Date.now()}`;
      document.head.appendChild(sc);
      setTimeout(()=>finish(false),7000);
    });
  }

  const baseRenderProblems=renderProblems;
  renderProblems=function(){baseRenderProblems();decorate()};
  if(REMOTE_ENDPOINT)loadRemote(false).then(ok=>{if(ok&&state.view==='problems')renderProblems()});
})();
