(function(){
  'use strict';

  const CORE_KEY='ffws_autosave';
  const SAFE_KEY='cff_camp_safe_autosave_v1';
  const HISTORY_KEY='cff_camp_safe_history_v1';
  const HISTORY_LIMIT=15;
  const ADMIN_EMAIL='admin@centralfreefire.com.br';
  const REMOTE_PATH='adminCampDraft/current';
  const LEGACY_PATH='ffwsLive/campAoVivoBackup/current';
  const SYNC_REV='cff_camp_sync_revision_v1';
  const RESTORE_KEY='cff_camp_cloud_restore_v1';
  const PREFERENCE_KEYS=['ffws_v51_table_tools','ffws_v57_stable_features'];

  let localTimer=0;
  let historyTimer=0;
  let lastFingerprint='';
  let firebasePromise=null;
  let saveDropPatched=false;
  let remoteQueue=Promise.resolve(),openingCloud=false,lastRemoteError='';

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

  async function firebase(){
    if(firebasePromise)return firebasePromise;
    firebasePromise=Promise.all([
      import('https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js')
    ]).then(([appApi,authApi,dbApi])=>{
      const config=window.CFF_CONFIG?.firebase;
      if(!config)throw new Error('Firebase não configurado.');
      const app=appApi.getApps().length?appApi.getApp():appApi.initializeApp(config);
      return {
        app,
        auth:authApi.getAuth(app),
        db:dbApi.getDatabase(app),
        ref:dbApi.ref,
        get:dbApi.get,
        runTransaction:dbApi.runTransaction
      };
    });
    return firebasePromise;
  }

  function cloudStatus(text,error=false){
    const status=$('#cff-camp-cloud-status');
    if(status){status.textContent=text;status.dataset.error=String(error);}
  }
  async function cloud(){
    const api=await firebase();
    await api.auth.authStateReady();
    if(api.auth.currentUser?.email?.toLowerCase()!==ADMIN_EMAIL)throw new Error('Entre com a conta administradora para acessar o rascunho.');
    return api;
  }
  function editable(data){return Array.isArray(data?.selectedTeams)&&data.selectedTeams.length>0&&Array.isArray(data.drops)&&!!data.config;}
  function readPreferences(){return Object.fromEntries(PREFERENCE_KEYS.map(key=>[key,localStorage.getItem(key)]));}
  function saveRemoteAfterDrop(snapshot){
    if(!snapshot||openingCloud||!editable(snapshot.backup))return Promise.resolve(false);
    const preferences=readPreferences(),drop=String($('#drop-num')?.value||'');
    const save=async()=>{
      try{
        const api=await cloud(),ref=api.ref(api.db,REMOTE_PATH);
        const base=localStorage.getItem(SYNC_REV)||'';
        const remote=(await api.get(ref)).val();
        if((remote?.revision||'')!==base)throw new Error('Outro aparelho tem uma cópia na nuvem. Abra essa cópia antes de continuar. Suas edições estão neste navegador; baixe um JSON para guardá-las.');
        const json=JSON.stringify({backup:snapshot.backup,preferences,drop});
        if(json.length>1500000)throw new Error('A cópia é grande demais para a nuvem. Use Baixar backup.');
        const revision=crypto.randomUUID();
        const saved=await api.runTransaction(ref,current=>(current?.revision||'')===base?{revision,updatedAt:Date.now(),json}:undefined,{applyLocally:false});
        if(!saved.committed)throw new Error('A cópia mudou em outro aparelho. Abra a versão da nuvem antes de salvar.');
        localStorage.setItem(SYNC_REV,revision);
        lastRemoteError='';
        const text='Salvo na nuvem: '+snapshot.tournamentName;
        cloudStatus(text);setIndicator('Salvo no navegador + nuvem',text);
        return true;
      }catch(error){
        const detail=/permission.denied/i.test(error.message||'')?'A cópia na nuvem ainda não está disponível para esta sessão.':error.message;
        cloudStatus('Cópia na nuvem não salva. '+(detail||'Tente novamente.'),true);
        setIndicator('Cópia local preservada');
        if(snapshot.reason==='save-drop'&&lastRemoteError!==detail){
          lastRemoteError=detail;
          window.CFF_CAMP?.toast?.('Queda salva neste navegador. Confira a cópia na nuvem no início do painel.','warn');
        }
        return false;
      }
    };
    remoteQueue=remoteQueue.then(save,save);
    return remoteQueue;
  }
  async function openCloud(){
    if(openingCloud)return;
    openingCloud=true;
    const button=$('#cff-camp-cloud-open');button.disabled=true;
    try{
      cloudStatus('Buscando a última cópia na nuvem…');
      await remoteQueue;
      const api=await cloud(),remote=(await api.get(api.ref(api.db,REMOTE_PATH))).val();
      const legacy=remote?null:(await api.get(api.ref(api.db,LEGACY_PATH))).val();
      if(!remote&&!legacy)throw new Error('Não encontrei uma cópia na nuvem. No aparelho original, use Salvar na nuvem. Para recuperar placares já enviados, use Puxar resultados publicados.');
      const entry=remote?JSON.parse(remote.json):{backup:legacy.backup,drop:String(legacy.drop||'')};
      if(!editable(entry.backup))throw new Error('A cópia encontrada não tem os dados necessários. O rascunho local foi mantido.');
      const date=remote?.updatedAt||legacy?.updatedAt;
      const stamp=date?' · '+new Date(date).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'';
      const name=backupName(entry.backup);
      if(!confirm('Abrir “'+name+'”'+stamp+'? A cópia deste aparelho ficará no backup anterior. Nada será publicado.')){
        cloudStatus('Abertura cancelada. Seu rascunho continua neste navegador.');return;
      }
      const local=currentBackup();
      if(editable(local))localStorage.setItem('cff_camp_before_cloud_v1',JSON.stringify({savedAt:Date.now(),backup:local,preferences:readPreferences()}));
      sessionStorage.setItem(RESTORE_KEY,JSON.stringify({...entry,revision:remote?.revision||''}));
      location.reload();
    }catch(error){cloudStatus(error.message||'Não foi possível abrir a cópia na nuvem.',true);}
    finally{openingCloud=false;button.disabled=false;}
  }
  function wireCloud(){
    $('#cff-camp-cloud-open')?.addEventListener('click',openCloud);
    $('#cff-camp-cloud-save')?.addEventListener('click',async event=>{
      const button=event.currentTarget;button.disabled=true;
      try{
        const snapshot=saveLocalNow('cloud-save',true);
        if(!editable(snapshot?.backup)){cloudStatus('Carregue uma rodada ou um campeonato antes de salvar.',true);return;}
        cloudStatus('Salvando a cópia…');await saveRemoteAfterDrop(snapshot);
      }finally{button.disabled=false;}
    });
    $('#cff-camp-cloud-previous')?.addEventListener('click',()=>{
      const raw=localStorage.getItem('cff_camp_before_cloud_v1');
      if(!raw){cloudStatus('Este navegador ainda não tem uma cópia anterior à abertura da nuvem.');return;}
      const entry=JSON.parse(raw),url=URL.createObjectURL(new Blob([JSON.stringify(entry.backup,null,2)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download='camp-antes-da-nuvem.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
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
          // saveDrop advances the selector. The remote record belongs to the drop just saved.
          snapshot.drop=savedDrop;
          saveRemoteAfterDrop(snapshot);
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
    wire();wireCloud();
    saveLocalNow('boot',false);
    patchSaveDrop();
    [250,700,1500,3000].forEach(delay=>setTimeout(patchSaveDrop,delay));

    window.CFF_CAMP={
      ...(window.CFF_CAMP||{}),
      persistence:{
        saveLocalNow,
        saveRemoteAfterDrop,
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

