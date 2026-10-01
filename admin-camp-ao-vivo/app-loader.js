(function(){
  'use strict';
  const status=document.getElementById('cff-camp-load-status');
  const setStatus=text=>{if(status)status.textContent=text;};

  async function fetchBytes(url){
    const response=await fetch(url,{cache:'default'});
    if(!response.ok)throw new Error('Falha ao carregar '+url+' ('+response.status+').');
    return new Uint8Array(await response.arrayBuffer());
  }
  async function gunzipBytes(parts){
    const arrays=await Promise.all(parts.map(fetchBytes));
    const size=arrays.reduce((sum,x)=>sum+x.byteLength,0),joined=new Uint8Array(size);let offset=0;
    arrays.forEach(x=>{joined.set(x,offset);offset+=x.byteLength});
    const stream=new Blob([joined]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }
  async function gunzipUrl(url){return gunzipBytes([url])}

  async function load(){
    try{
      setStatus('Carregando ferramentas…');
      if(typeof DecompressionStream!=='function')throw new Error('Seu navegador precisa ser atualizado para abrir o Camp ao Vivo.');
      if(!localStorage.getItem('ffws_autosave')){
        try{
          const safe=JSON.parse(localStorage.getItem('cff_camp_safe_autosave_v1')||'null');
          if(safe&&safe.backup&&typeof safe.backup==='object'){
            localStorage.setItem('ffws_autosave',JSON.stringify(safe.backup));
            setStatus('Recuperando auto-save seguro…');
          }
        }catch(error){console.warn('[Camp ao vivo] auto-save seguro inválido',error)}
      }
      const shouldSeed=!localStorage.getItem('ffws_autosave');
      const presetPromise=shouldSeed
        ?fetch('admin-camp-ao-vivo/data/backup-ffws-br-2026-s2-segunda-fase.json?v=20261001',{cache:'no-store'})
        :Promise.resolve(null);

      const [cssSource,appSource,presetResponse]=await Promise.all([
        gunzipUrl('admin-camp-ao-vivo/app.css.gz?v=20261001-camp-v4'),
        gunzipUrl('admin-camp-ao-vivo/app.js.gz?v=20261001-camp-v4'),
        presetPromise
      ]);

      const style=document.createElement('style');
      style.id='cff-camp-full-style';
      style.textContent=cssSource;
      document.head.appendChild(style);

      if(shouldSeed&&presetResponse?.ok){
        try{localStorage.setItem('ffws_autosave',JSON.stringify(await presetResponse.json()))}
        catch(error){console.warn('[Camp ao vivo] preset inicial ignorado',error)}
      }

      const url=URL.createObjectURL(new Blob([appSource],{type:'text/javascript'}));
      const script=document.createElement('script');
      script.src=url;script.async=false;
      script.onload=()=>{
        URL.revokeObjectURL(url);
        const extra=document.createElement('script');
        extra.src='admin-camp-ao-vivo/enhancements.js?v=20261001-camp-fixes-v8';
        extra.async=false;
        extra.onload=()=>{
          const persistence=document.createElement('script');
          persistence.src='admin-camp-ao-vivo/persistence.js?v=20261001-camp-persist-v2';
          persistence.async=false;
          persistence.onload=()=>{
            const integrations=document.createElement('script');
            integrations.src='admin-camp-ao-vivo/integrations.js?v=20261001-camp-v4';
            integrations.async=false;
            integrations.onload=()=>{document.body.classList.remove('cff-assets-pending');setStatus('Pronto • auto-save + integrações ativas')};
            integrations.onerror=()=>{document.body.classList.remove('cff-assets-pending');setStatus('Pronto • auto-save ativo • integração externa indisponível')};
            document.body.appendChild(integrations);
          };
          persistence.onerror=()=>{
            const integrations=document.createElement('script');
            integrations.src='admin-camp-ao-vivo/integrations.js?v=20261001-camp-v4';
            integrations.async=false;
            integrations.onload=()=>{document.body.classList.remove('cff-assets-pending');setStatus('Pronto • integração ativa • auto-save extra indisponível')};
            integrations.onerror=()=>{document.body.classList.remove('cff-assets-pending');setStatus('Pronto • ferramentas extras parciais')};
            document.body.appendChild(integrations);
          };
          document.body.appendChild(persistence);
        };
        extra.onerror=()=>{
          document.body.classList.remove('cff-assets-pending');
          setStatus('Ferramentas extras indisponíveis');
        };
        document.body.appendChild(extra);
      };
      script.onerror=()=>{URL.revokeObjectURL(url);throw new Error('Falha ao iniciar o núcleo do camp.')};
      document.body.appendChild(script);
    }catch(error){
      console.error('[Camp ao vivo]',error);
      setStatus('Erro ao carregar');
      document.body.classList.remove('cff-assets-pending');
      const box=document.createElement('div');
      box.className='cff-camp-load-error';
      box.textContent='Não foi possível iniciar o Camp ao Vivo. '+String(error?.message||error);
      document.body.prepend(box);
    }
  }
  load();
})();
