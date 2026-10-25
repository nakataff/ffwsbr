(()=>{
  const cleanLegacy=()=>document.querySelectorAll('.admin-header-actions [data-admin-edicao-link]').forEach(el=>el.remove());
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',cleanLegacy,{once:true});
  else cleanLegacy();
})();
