(function(){
  'use strict';

  const CORE_KEY='ffws_autosave';
  const SAFE_KEY='cff_camp_safe_autosave_v1';
  const HISTORY_KEY='cff_camp_safe_history_v1';
  const HISTORY_LIMIT=15;
  const ADMIN_EMAIL='admin@centralfreefire.com.br';
  const REMOTE_ROOT='ffwsLive/campAoVivoBackup';
  const GITHUB_BACKUP_PATH='admin-camp-ao-vivo/data/autosave-live.json';

  let localTimer=0;
  let historyTimer=0;
  let lastFingerprint='';
  let firebasePromise=null;
  let saveDropPatched=false;
  let githubUnavailableNotified=false;

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
      const text=JSON.stringify(data);
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
      if(list[0]?.fingerprint===snapshot.fingerprint)return;
      list.unshift({
        savedAt:snapshot.savedAt,
        fingerprint:snapshot.fingerprint,
        tournamentName:snapshot.tournamentName,
        drop:snapshot.drop,
        backup:snapshot.backup
      });
      localStorage.setItem(HISTORY_KEY,JSON.stringify(list.slice(0,HISTORY_LIMIT)));
    }catch(error){
      console.warn('[Camp persistência] não foi possível atualizar o histórico local',error);
    }
  }

  function saveLocalNow(reason='change',forceHistory=false){
    try{window.autoSave?.(true)}catch(_){}
    const data=currentBackup();
    if(!data)return false;

    const previous=readSafe();
    if(!meaningful(data)&&previous?.backup&&meaningful(previous.backup)){
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
        set:dbApi.set,
        update:dbApi.update
      };
    });
    return firebasePromise;
  }

  function safeSlug(value){
    return String(value||'camp')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'camp';
  }

  async function saveFirebaseBackup(snapshot){
    const api=await firebase();
    const user=api.auth.currentUser;
    if(!user||String(user.email||'').toLowerCase()!==ADMIN_EMAIL)throw new Error('Sessão administrativa inválida.');

    const key=`q${String(snapshot.drop||0).padStart(3,'0')}`;
    const tournament=safeSlug(snapshot.tournamentName);
    const payload={
      updatedAt:Date.now(),
      tournamentName:snapshot.tournamentName,
      drop:snapshot.drop||0,
      source:'admin-camp-ao-vivo',
      backup:snapshot.backup
    };
    const updates={};
    updates[`${REMOTE_ROOT}/current`]=payload;
    updates[`${REMOTE_ROOT}/history/${tournament}/${key}`]=payload;
    await api.update(api.ref(api.db),updates);
    return true;
  }

  async function saveGithubBackup(snapshot){
    const config=window.CFF_CONFIG?.firebase;
    const projectId=String(config?.projectId||'').trim();
    if(!projectId)throw new Error('projectId do Firebase ausente.');

    const api=await firebase();
    const user=api.auth.currentUser;
    if(!user||String(user.email||'').toLowerCase()!==ADMIN_EMAIL)throw new Error('Sessão administrativa inválida.');
    const token=await user.getIdToken();

    const endpoint=`https://southamerica-east1-${projectId}.cloudfunctions.net/campGithubBackup`;
    const response=await fetch(endpoint,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${token}`
      },
      body:JSON.stringify({
        tournamentName:snapshot.tournamentName,
        drop:snapshot.drop||0,
        backup:snapshot.backup
      })
    });
    if(!response.ok){
      const text=await response.text().catch(()=>'');
      throw new Error(`GitHub backup HTTP ${response.status}${text?': '+text.slice(0,160):''}`);
    }
    return response.json().catch(()=>({ok:true}));
  }

  async function saveRemoteAfterDrop(snapshot){
    if(!snapshot)return;
    let firebaseOk=false;
    try{
      await saveFirebaseBackup(snapshot);
      firebaseOk=true;
      setIndicator('Salvo no navegador + nuvem',`${snapshot.tournamentName} • queda ${snapshot.drop||'—'} salva também no Firebase`);
    }catch(error){
      console.warn('[Camp persistência] backup Firebase falhou',error);
    }

    try{
      const result=await saveGithubBackup(snapshot);
      setIndicator('Salvo no navegador + GitHub',`${snapshot.tournamentName} • queda ${snapshot.drop||'—'} • commit ${String(result?.commitSha||result?.commit_sha||'').slice(0,8)}`);
      githubUnavailableNotified=false;
    }catch(error){
      console.warn('[Camp persistência] backup GitHub indisponível',error);
      if(!firebaseOk)setIndicator('Salvo apenas no navegador','O backup remoto não respondeu; o backup local continua protegido.');
      if(!githubUnavailableNotified){
        githubUnavailableNotified=true;
        window.CFF_CAMP?.toast?.(
          firebaseOk
            ? 'Queda protegida no navegador e Firebase. GitHub automático ainda não está ativo.'
            : 'Queda salva no navegador; backup remoto indisponível.',
          'warn'
        );
      }
    }
  }

  function patchSaveDrop(){
    if(saveDropPatched||typeof window.saveDrop!=='function')return false;
    const original=window.saveDrop;
    if(original.__cffPersistencePatched){saveDropPatched=true;return true}

    const wrapped=function(...args){
      const before=currentBackup();
      const beforeFp=before?fingerprint(before):'';
      let result;
      try{result=original.apply(this,args)}
      catch(error){throw error}

      const after=async()=>{
        if(result&&typeof result.then==='function'){
          try{await result}catch(_){return}
        }
        setTimeout(()=>{
          const snapshot=saveLocalNow('save-drop',true);
          if(!snapshot)return;
          const afterFp=snapshot.fingerprint;
          if(afterFp===beforeFp)return;
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
      if(target.matches('[data-cff-preset],#cff-camp-import'))saveLocalNow('before-destructive-action',true);
      setTimeout(()=>scheduleLocalSave('click'),0);
    },{passive:true,capture:true});
    window.addEventListener('beforeunload',()=>saveLocalNow('beforeunload',true));
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='hidden')saveLocalNow('hidden',true);
    });
  }

  function boot(){
    if(restoreSafeIfCoreWasLost())return;
    wire();
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
        historyKey:HISTORY_KEY,
        githubPath:GITHUB_BACKUP_PATH
      }
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
