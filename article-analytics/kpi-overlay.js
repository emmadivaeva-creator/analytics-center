(()=>{
 const base=renderKpis;
 renderKpis=function(){
   const box=document.getElementById('kpis');
   if(state.view!=='overview'){
     box.innerHTML='';
     box.style.display='none';
     return;
   }
   box.style.display='grid';
   return base();
 };
 renderKpis();
})();