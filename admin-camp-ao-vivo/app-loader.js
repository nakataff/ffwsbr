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

  function hasTournament(data){
    return !!(data && typeof data === 'object' && (
      data.selectedTeams?.length || data.tournamentModeV1?.days?.length ||
      data.drops?.some(drop=>['points','kills','placements'].some(key=>
        Object.values(drop?.[key]||{}).some(value=>value!==null&&value!==undefined&&value!=='')))
    ));
  }
  function read(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch(_){return null}}
  function prepareAutosave(){
    const core=read('ffws_autosave');
    if(hasTournament(core))return core;
    const safe=read('cff_camp_safe_autosave_v1');
    const history=read('cff_camp_safe_history_v1');
    const startup=read('cff_camp_startup_backup_v1');
    const candidates=[safe,...(Array.isArray(history)?history:[]),startup];
    const found=candidates.find(item=>hasTournament(item?.backup));
    if(found){
      localStorage.setItem('ffws_autosave',JSON.stringify(found.backup));
      setStatus('Recuperando campeonato salvo…');
      return found.backup;
    }
    return core;
  }
  // The legacy bundle was written for static scripts and initializes on window.load.
  // This loader fetches it asynchronously, so use a dedicated lifecycle event instead.
  function prepareCoreSource(source){
    if(!source.includes('window.onload = () => {'))throw new Error('Inicializador do camp não encontrado.');
    return source.replace('window.onload = () => {','window.__CFF_CAMP_INITIALIZE__ = () => {')
      .replace(/window\.addEventListener\(\s*(['"])load\1\s*,/g,
        'window.addEventListener("cff:camp-core-ready",');
  }

  async function load(){
    try{
      setStatus('Carregando ferramentas…');
      if(typeof DecompressionStream!=='function')throw new Error('Seu navegador precisa ser atualizado para abrir o Camp ao Vivo.');
      prepareAutosave();
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

      const protectedAutosave=localStorage.getItem('ffws_autosave');
      const protectedData=read('ffws_autosave');
      if(hasTournament(protectedData)){
        // Preserve the state present before any bundle or enhancement can write.
        try{localStorage.setItem('cff_camp_startup_backup_v1',JSON.stringify({
          savedAt:Date.now(),backup:protectedData
        }))}catch(error){console.warn('[Camp ao vivo] cópia inicial indisponível',error)}
      }
      window.__CFF_CAMP_READY__=false;
      const preparedSource=prepareCoreSource(appSource);
      const originalSetItem=Storage.prototype.setItem;
      const guardedSetItem=function(key,value){
        if(this===localStorage&&key==='ffws_autosave'&&!window.__CFF_CAMP_READY__)return;
        return originalSetItem.call(this,key,value);
      };
      Storage.prototype.setItem=guardedSetItem;
      const releaseGuard=()=>{
        if(Storage.prototype.setItem===guardedSetItem)Storage.prototype.setItem=originalSetItem;
      };
      const url=URL.createObjectURL(new Blob([preparedSource],{type:'text/javascript'}));
      const script=document.createElement('script');
      script.src=url;script.async=false;
      script.onload=()=>{
        URL.revokeObjectURL(url);
        try{
          window.__CFF_CAMP_INITIALIZE__();
          window.dispatchEvent(new Event('cff:camp-core-ready'));
          if(!document.getElementById('drop-num')?.options.length ||
            (protectedData?.selectedTeams?.length &&
             !document.querySelector('#teams-inputs-container .team-row'))){
            throw new Error('O estado salvo não foi carregado. Seu backup anterior foi preservado.');
          }
          window.__CFF_CAMP_READY__=true;
          releaseGuard();
        }catch(error){
          // Keep blocking legacy autosaves from delayed timers after a failed restore.
          if(protectedAutosave)originalSetItem.call(localStorage,'ffws_autosave',protectedAutosave);
          console.error('[Camp ao vivo] inicialização bloqueada',error);
          setStatus('Falha ao restaurar • backup preservado');
          document.body.classList.remove('cff-assets-pending');
          const box=document.createElement('div');box.className='cff-camp-load-error';
          box.textContent=String(error?.message||error);document.body.prepend(box);
          return;
        }
        const extra=document.createElement('script');
        extra.src='admin-camp-ao-vivo/enhancements.js?v=20261001-camp-fixes-v24';
        extra.async=false;
        extra.onload=()=>{
          const startPersistence=()=>{
          const persistence=document.createElement('script');
          persistence.src='admin-camp-ao-vivo/persistence.js?v=20261001-camp-persist-v3';
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
          const entries=document.createElement('script');
          entries.src='admin-camp-ao-vivo/launch-extras.js?v=20261001-camp-fixes-v24';
          entries.async=false;
          entries.onload=startPersistence;
          entries.onerror=()=>{console.warn('[Camp ao vivo] entradas extras indisponíveis');startPersistence()};
          document.body.appendChild(entries);
        };
        extra.onerror=()=>{
          document.body.classList.remove('cff-assets-pending');
          setStatus('Ferramentas extras indisponíveis');
        };
        document.body.appendChild(extra);
      };
      script.onerror=()=>{releaseGuard();URL.revokeObjectURL(url);setStatus('Falha ao iniciar • backup preservado');document.body.classList.remove('cff-assets-pending')};
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

