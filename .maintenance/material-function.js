async function loadMaterialDemo(button){
 const box=button.nextElementSibling;if(!box)return;
 button.disabled=true;box.textContent='Читаю ссылки отправок и Content / Term в статистике…';
 try{
  const ids=mailMaterialIds_(button.dataset.mailId),materials=new Map(),rows=new Map(),errors=[];
  for(const id of ids){
   try{
    const data=await rpc('getMailDemoDetailsUi',id);
    if(!data||!Array.isArray(data.materials)||!Array.isArray(data.rows))throw new Error('Сервер вернул неполный результат.');
    data.materials.forEach(m=>materials.set(JSON.stringify([m.rootDomain||m.domain||'',m.kind||'',m.id||m.url]),m));
    data.rows.forEach(r=>rows.set(JSON.stringify([r.sourceUrl||r.source||'',r.product,r.content,r.term]),r));
    const original=(registryData||[]).find(m=>m.id===id);if(original){original.materialData=data;delete original.materialError;}
   }catch(e){errors.push(String(e&&e.message||e));}
  }
  const matches=[...rows.values()];
  box.innerHTML='<p><b>DEMO материалов, не прямой результат письма.</b> Все доступные недели и источники переходов. Повторы между сегментами учтены один раз.</p>'+
   '<p>Проверено отправок: '+fmt(ids.length-errors.length)+' из '+fmt(ids.length)+'. Материалов: '+fmt(materials.size)+'. Совпадений Content / Term: '+fmt(matches.length)+'.</p>'+
   (errors.length?'<p>Результат неполный: '+esc([...new Set(errors)].join('; '))+'</p>':'')+
   matches.map(r=>'<p>'+safeLink(r.url,String(r.content||'')+' / '+String(r.term||''))+' · '+esc(r.product)+'<br>'+safeLink(r.sourceUrl,r.source)+'<br>'+(r.values?'R '+fmt(r.values.red)+' / Y '+fmt(r.values.yellow)+' / G '+fmt(r.values.green):'Данные недели не получены')+'</p>').join('')+
   (!matches.length&&!errors.length?'<p>Пары Content / Term для найденных ссылок в доступной статистике не найдены.</p>':'');
  if(ids.length>errors.length)scheduleRegistryCacheSave_();
 }catch(e){box.textContent='Не удалось сопоставить: '+String(e&&e.message||e);}
 finally{button.disabled=false;}
}
