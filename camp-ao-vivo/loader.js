(function(){
  'use strict';
  const PREFIX='cff_public_camp_v1:';
  const VERSION='20261003-public-v2';
  const status=document.getElementById('cff-camp-load-status');
  const setStatus=text=>{if(status)status.textContent=text;};
  window.__CFF_CAMP_READY__=false;

  // Every storage access in the shared editor is routed to this public workspace.
  // The admin's storage and its remote persistence modules are never loaded here.
  function scopedStorage(native,guard=false){
    return Object.freeze({
      getItem:key=>native.getItem(PREFIX+String(key)),
      setItem(key,value){
        if(guard&&String(key)==='ffws_autosave'&&!window.__CFF_CAMP_READY__)return;
        native.setItem(PREFIX+String(key),String(value));
      },
      removeItem:key=>native.removeItem(PREFIX+String(key)),
      key(index){return Object.keys(native).filter(key=>key.startsWith(PREFIX))[index]?.slice(PREFIX.length)||null;},
      clear(){Object.keys(native).filter(key=>key.startsWith(PREFIX)).forEach(key=>native.removeItem(key));},
      get length(){return Object.keys(native).filter(key=>key.startsWith(PREFIX)).length;}
    });
  }
  function prepareSource(source){
    return source.replace(/\blocalStorage\b/g,'CFF_PUBLIC_STORAGE')
      .replace(/\bsessionStorage\b/g,'CFF_PUBLIC_SESSION_STORAGE')
      .replace(/Gerador Liquipedia PRO(?: V\d+)?/g,'Camp ao vivo');
  }
  async function fetchText(path){
    const response=await fetch(path,{cache:'default'});
    if(!response.ok)throw new Error('Não foi possível carregar as ferramentas ('+response.status+').');
    return response.text();
  }
  async function compressedText(path){
    if(typeof DecompressionStream!=='function')throw new Error('Atualize seu navegador para abrir o Camp ao vivo.');
    const response=await fetch(path,{cache:'default'});
    if(!response.ok)throw new Error('Não foi possível carregar o editor ('+response.status+').');
    return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).text();
  }
  async function runScript(source,label){
    const url=URL.createObjectURL(new Blob([prepareSource(source)+'\n//# sourceURL='+label],{type:'text/javascript'}));
    try{
      await new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src=url;script.async=false;
        script.onload=resolve;script.onerror=()=>reject(new Error('Falha ao iniciar '+label));
        document.body.appendChild(script);
      });
    }finally{URL.revokeObjectURL(url);}
  }
  async function addon(path){await runScript(await fetchText(path+'?v='+VERSION),path);}
  function read(native,key){try{return JSON.parse(native.getItem(PREFIX+key)||'null');}catch(_){return null;}}
  function hasTournament(data){return !!(data&&typeof data==='object'&&(data.selectedTeams?.length||data.tournamentModeV1?.days?.length));}

  async function load(){
    const native=window.localStorage;
    window.CFF_PUBLIC_STORAGE=scopedStorage(native,true);
    window.CFF_PUBLIC_SESSION_STORAGE=scopedStorage(window.sessionStorage);
    let protectedRaw=null;
    try{
      setStatus('Carregando seu campeonato…');
      let saved=read(native,'ffws_autosave');
      if(!hasTournament(saved)){
        const history=read(native,'cff_camp_safe_history_v1');
        const candidates=[read(native,'cff_camp_safe_autosave_v1'),...(Array.isArray(history)?history:[])];
        const recovery=candidates.find(item=>hasTournament(item?.backup));
        if(recovery){saved=recovery.backup;native.setItem(PREFIX+'ffws_autosave',JSON.stringify(saved));}
      }
      if(!saved){
        saved=JSON.parse(await fetchText('camp-ao-vivo/base.json?v='+VERSION));
        native.setItem(PREFIX+'ffws_autosave',JSON.stringify(saved));
      }
      protectedRaw=native.getItem(PREFIX+'ffws_autosave');
      const [css,source]=await Promise.all([
        compressedText('admin-camp-ao-vivo/app.css.gz?v=20261001-camp-v4'),
        compressedText('admin-camp-ao-vivo/app.js.gz?v=20261001-camp-v4')
      ]);
      const style=document.createElement('style');style.id='cff-camp-full-style';style.textContent=css.replace('tabela, quedas, wiki e publicação','tabelas e lançamento de quedas');document.head.appendChild(style);
      if(!source.includes('window.onload = () => {'))throw new Error('Inicializador do editor não encontrado.');
      const core=source.replace('window.onload = () => {','window.__CFF_CAMP_INITIALIZE__ = () => {')
        .replace(/window\.addEventListener\(\s*(['"])load\1\s*,/g,'window.addEventListener("cff:camp-core-ready",');
      await runScript(core,'camp-ao-vivo/core.js');
      window.__CFF_CAMP_INITIALIZE__();window.dispatchEvent(new Event('cff:camp-core-ready'));
      if(!document.getElementById('drop-num')?.options.length||(saved.selectedTeams?.length&&!document.querySelector('#teams-inputs-container .team-row'))){
        throw new Error('Não foi possível restaurar o campeonato. Seu backup foi preservado.');
      }
      window.__CFF_CAMP_READY__=true;
      let enhancements=await fetchText('admin-camp-ao-vivo/enhancements.js?v=20261001-camp-fixes-v24');
      enhancements=enhancements.replace("base:{url:'admin-camp-ao-vivo/data/backup-torneio.json',label:'Base do torneio'}","base:{url:'camp-ao-vivo/base.json',label:'Novo campeonato'}");
      await runScript(enhancements,'camp-ao-vivo/enhancements.js');
      await addon('admin-camp-ao-vivo/launch-extras.js');
      await addon('camp-ao-vivo/persistence.js');
      await addon('camp-ao-vivo/live.js');
      await addon('camp-ao-vivo/public-ui.js');
      document.body.classList.remove('cff-assets-pending');setStatus('Pronto • seu campeonato salvo neste navegador');
    }catch(error){
      if(protectedRaw&&!window.__CFF_CAMP_READY__)native.setItem(PREFIX+'ffws_autosave',protectedRaw);
      console.error('[Camp público]',error);document.body.classList.remove('cff-assets-pending');setStatus('Falha ao carregar • backup preservado');
      const box=document.createElement('div');box.className='cff-camp-load-error';box.setAttribute('role','alert');box.textContent=error.message;document.body.prepend(box);
    }
  }
  load();
})();
