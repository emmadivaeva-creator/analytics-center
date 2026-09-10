(()=>{
 const baseRenderKpis=renderKpis;
 const baseSwitchView=switchView;

 renderKpis=function(){
   const box=document.getElementById('kpis');
   if(!box)return;
   if(state.view==='overview'){
     box.style.display='grid';
     baseRenderKpis();
   }else{
     box.innerHTML='';
     box.style.display='none';
   }
 };

 switchView=function(v){
   baseSwitchView(v);
   renderKpis();
 };

 renderKpis();
})();
