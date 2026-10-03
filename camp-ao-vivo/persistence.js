(function(){
  'use strict';

  const CORE_KEY='ffws_autosave';
  const SAFE_KEY='cff_camp_safe_autosave_v1';
  const HISTORY_KEY='cff_camp_safe_history_v1';
  const HISTORY_LIMIT=15;

  let localTimer=0;
  let historyTimer=0;
  let lastFingerprint='';
  let saveDropPatched=false;

  const $=sel=>document.querySelector(sel);

  function clone(value){
    try{return JSON.parse(JSON.stringify(value))}catch(_){return value}
  }

  function currentBackup(){
    try{
      const live=window.collectBackupData?.(true);
      if(live&&typeof live==='object')return clone(live);
    }catch(error){console.warn('[Camp persistência] collectBackupData falhou',error)}
    try{return JSON.parse(localStorage.getItem(CORE_KEY)||'null')}catch(_){return null}
  }

  function backupName(data){
    return String(data?.config?.tournamentName||data?.tournamentModeV1?.name||$('#tournament-name')?.value||'Camp ao vivo').trim()||'Camp ao vivo';
  }

  function backupDrop(data){
    const selected=Number($('#drop-num')?.value||0);
    if(Number.isFinite(selected)&&selected>0)return selected;
    const drops=Array.isArray(data?.drops)?data.drops:[];
    let last=0;
    drops.forEach((drop,index)=>{
      const has=drop&&typeof drop==='object'&&Object.keys(drop).length>0;
      if(has)last=Math.max(last,Number(drop.drop||drop.number||index+1)||0);
    });
    return last;
  }

  function meaningful(data){
    if(!data||typeof data!=='object')return false;
    if(Array.isArray(data.selectedTeams)&&data.selectedTeams.length)return true;
    if(Array.isArray(data.drops)&&data.drops.some(Boolean))return true;
    if(Array.isArray(data.tournamentModeV1?.days)&&data.tournamentModeV1.days.length)return true;
    const name=String(data.config?.tournamentName||data.tournamentModeV1?.name||'').trim();
    return !!(name&&name!=='Resumo do Torneio');
  }

  function fingerprint(data){
    try{
      const {generatedAt,...stable}=data;
      const text=JSON.stringify(stable);
      let hash=2166136261;
      for(let i=0;i<text.length;i++){
        hash^=text.charCodeAt(i);
        hash=Math.imul(hash,16777619);
      }
      return (hash>>>0).toString(36)+':'+text.length;
    }catch(_){return String(Date.now())}
  }

  function readSafe(){
    try{return JSON.parse(localStorage.getItem(SAFE_KEY)||'null')}catch(_){return null}
  }

  function setIndicator(text,title){
    const el=$('#cff-camp-save-state');
    if(!el)return;
    el.textContent='● '+text;
    el.title=title||text;
  }

  function writeHistory(snapshot){
    try{
      const raw=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
      const list=Array.isArray(raw)?raw:[];
      const fp=snapshot.fingerprint||fingerprint(snapshot.backup);
      if(list[0]?.fingerprint===fp)return;
      list.unshift({
        savedAt:snapshot.savedAt||Date.now(),
        fingerprint:fp,
        tournamentName:snapshot.tournamentName||backupName(snapshot.backup),
        drop:snapshot.drop||0,
        backup:snapshot.backup
      });
      localStorage.setItem(HISTORY_KEY,JSON.stringify(list.slice(0,HISTORY_LIMIT)));
    }catch(error){
      console.warn('[Camp persistência] não foi possível atualizar o histórico local',error);
    }
  }

  function saveLocalNow(reason='change',forceHistory=false){
    if(window.__CFF_CAMP_READY__!==true)return false;
    const data=currentBackup();
    if(!data)return false;

    const previous=readSafe();
    const core=(()=>{try{return JSON.parse(localStorage.getItem(CORE_KEY)||'null')}catch(_){return null}})();
    const hasTeams=value=>!!(value?.selectedTeams?.length||value?.tournamentModeV1?.days?.length);
    if((!meaningful(data)||!hasTeams(data))&&(hasTeams(previous?.backup)||hasTeams(core))){
      setIndicator('Salvamento bloqueado: painel vazio','O campeonato anterior foi preservado. Restaure um backup antes de continuar.');
      return false;
    }

    const fp=fingerprint(data);
    const snapshot={
      version:1,
      savedAt:Date.now(),
      reason,
      fingerprint:fp,
      tournamentName:backupName(data),
      drop:backupDrop(data),
      backup:data
    };

    if(previous?.backup&&previous.fingerprint!==fp){writeHistory(previous)}
    try{
      localStorage.setItem(CORE_KEY,JSON.stringify(data));
      localStorage.setItem(SAFE_KEY,JSON.stringify(snapshot));
    }catch(error){
      console.error('[Camp persistência] falha no auto-save local',error);
      setIndicator('ERRO AO SALVAR LOCAL','O navegador não conseguiu gravar o backup local.');
      return false;
    }

    setIndicator('Salvo no navegador',`${snapshot.tournamentName} • auto-save local ${new Date(snapshot.savedAt).toLocaleTimeString('pt-BR')}`);

    const changed=fp!==lastFingerprint;
    lastFingerprint=fp;
    if(forceHistory||changed){
      clearTimeout(historyTimer);
      historyTimer=setTimeout(()=>writeHistory(snapshot),forceHistory?0:900);
    }
    return snapshot;
  }

  function scheduleLocalSave(reason='change'){
    clearTimeout(localTimer);
    localTimer=setTimeout(()=>saveLocalNow(reason,false),120);
  }

  function restoreSafeIfCoreWasLost(){
    const safe=readSafe();
    if(!safe?.backup||!meaningful(safe.backup))return false;
    let core=null;
    try{core=JSON.parse(localStorage.getItem(CORE_KEY)||'null')}catch(_){}
    if(meaningful(core))return false;
    if(sessionStorage.getItem('cff_camp_recovered_safe_v1')==='1')return false;
    try{
      localStorage.setItem(CORE_KEY,JSON.stringify(safe.backup));
      sessionStorage.setItem('cff_camp_recovered_safe_v1','1');
      location.reload();
      return true;
    }catch(_){return false}
  }

  function patchSaveDrop(){
    if(saveDropPatched)return true;
    let original=null;
    try{if(typeof saveDrop==='function')original=saveDrop}catch(_){}
    if(!original&&typeof window.saveDrop==='function')original=window.saveDrop;
    if(typeof original!=='function')return false;
    if(original.__cffPersistencePatched){saveDropPatched=true;return true}

    const wrapped=function(...args){
      const savedDrop=Number($('#drop-num')?.value||0);
      const validDrop=Number.isInteger(savedDrop)&&savedDrop>0&&savedDrop<=Number($('#num-quedas')?.value||0);
      let result;
      try{result=original.apply(this,args)}
      catch(error){throw error}

      const after=async()=>{
        if(result&&typeof result.then==='function'){
          try{await result}catch(_){return}
        }
        setTimeout(()=>{
          const snapshot=saveLocalNow('save-drop',true);
          if(!snapshot||!validDrop)return;
          // saveDrop advances the selector; the local history belongs to the saved drop.
          snapshot.drop=savedDrop;
          writeHistory(snapshot);
        },120);
      };
      after();
      return result;
    };
    wrapped.__cffPersistencePatched=true;
    wrapped.__cffPersistenceOriginal=original;
    window.saveDrop=wrapped;
    try{saveDrop=wrapped}catch(_){}
    saveDropPatched=true;
    return true;
  }

  function wire(){
    document.addEventListener('input',()=>scheduleLocalSave('input'),{passive:true,capture:true});
    document.addEventListener('change',()=>scheduleLocalSave('change'),{passive:true,capture:true});
    document.addEventListener('click',event=>{
      const target=event.target.closest?.('button,[role="button"],input[type="radio"],input[type="checkbox"]');
      if(!target)return;
      if(target.matches('[data-cff-preset],#cff-camp-import')){
        const snapshot=saveLocalNow('before-destructive-action',true);
        if(snapshot){clearTimeout(historyTimer);writeHistory(snapshot)}
      }
      setTimeout(()=>scheduleLocalSave('click'),0);
    },{passive:true,capture:true});
    window.addEventListener('beforeunload',()=>{const snapshot=saveLocalNow('beforeunload',true);if(snapshot){clearTimeout(historyTimer);writeHistory(snapshot)}});
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='hidden'){const snapshot=saveLocalNow('hidden',true);if(snapshot){clearTimeout(historyTimer);writeHistory(snapshot)}}
    });
  }

  function boot(){
    if(window.__CFF_CAMP_READY__!==true)return;
    if(restoreSafeIfCoreWasLost())return;
    wire();
    saveLocalNow('boot',false);
    patchSaveDrop();
    [250,700,1500,3000].forEach(delay=>setTimeout(patchSaveDrop,delay));

    window.CFF_CAMP={
      ...(window.CFF_CAMP||{}),
      persistence:{
        saveLocalNow,
        restoreLastSafeBackup(){
          const safe=readSafe();
          if(!safe?.backup)return false;
          const input=$('#backup-input');
          if(input&&typeof window.importBackup==='function'){
            input.value=JSON.stringify(safe.backup);
            window.importBackup();
            saveLocalNow('manual-restore',true);
            return true;
          }
          return false;
        },
        safeKey:SAFE_KEY,
        historyKey:HISTORY_KEY
      }
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();


