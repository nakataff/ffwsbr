(function(){
  'use strict';

  const PRESETS={
    ffws:{url:'admin-camp-ao-vivo/data/backup-ffws-br-2026-s2-segunda-fase.json',label:'FFWS BR 2026 S2'},
    base:{url:'admin-camp-ao-vivo/data/backup-torneio.json',label:'Base do torneio'}
  };
  const LOGO_KEY='cff_camp_logo_bank_v1';
  const FOCUS_KEY='cff_camp_focus_v1';
  const BUILTIN_LOGOS={
    LOS:'home-assets/teams/los.webp',
    LOUDSNICKERS:'home-assets/teams/loud-snickers.webp',
    FLUXOW7M:'home-assets/teams/fluxo-w7m.webp',
    INTZ:'home-assets/teams/intz.webp',
    TEAMSOLID:'home-assets/teams/team-solid.webp',
    RISEGAMING:'home-assets/teams/rise-gaming.webp',
    ALPHA7:'home-assets/teams/alpha7.webp',
    RUSHGAMING:'home-assets/teams/rush-gaming.webp',
    INFLUENCERAGE:'home-assets/teams/influence-rage.webp',
    CPTVOX:'home-assets/teams/cpt-vox.webp',
    AFROGAMES:'home-assets/teams/afrogames.webp',
    SXTET:'home-assets/teams/sx-tet.webp',
    CIVIS:'home-assets/teams/civis.webp',
    LOOPS:'home-assets/teams/loops.webp'
  };
  const $=sel=>document.querySelector(sel);

  function norm(value){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toUpperCase().replace(/[^A-Z0-9]/g,'');
  }
  function toast(message,type='ok'){
    let el=$('#cff-camp-toast');
    if(!el){
      el=document.createElement('div');el.id='cff-camp-toast';el.className='cff-camp-toast';document.body.appendChild(el);
    }
    el.textContent=message;el.className='cff-camp-toast '+type+' show';
    clearTimeout(toast._timer);toast._timer=setTimeout(()=>el.classList.remove('show'),2600);
  }
  function readBank(){
    try{
      const data=JSON.parse(localStorage.getItem(LOGO_KEY)||'{}');
      return data&&typeof data==='object'?data:{};
    }catch(_){return {}}
  }
  function writeBank(bank){
    try{localStorage.setItem(LOGO_KEY,JSON.stringify(bank));return true}
    catch(error){console.error(error);toast('O navegador ficou sem espaço para salvar mais logos.','err');return false}
  }
  let logoBank=readBank();

  function teamRows(){
    const rows=[...document.querySelectorAll('#teams-config-rows .sheet-row')].map(row=>({
      name:row.querySelector('.team-sheet-name')?.value.trim()||'',
      code:row.querySelector('.team-sheet-code')?.value.trim()||'',
      abbr:row.querySelector('.team-sheet-abbr')?.value.trim()||''
    })).filter(x=>x.name);
    if(rows.length)return rows;
    return String($('#teams-input')?.value||'').split(/\r?\n/).map(line=>{
      const p=line.split(',').map(x=>x.trim());return{name:p[0]||'',code:p[1]||'',abbr:p[2]||''};
    }).filter(x=>x.name);
  }
  function aliasIndex(){
    const map=new Map();
    teamRows().forEach(team=>{
      [team.name,team.code,team.abbr].filter(Boolean).forEach(v=>map.set(norm(v),norm(team.name)));
    });
    return map;
  }
  function resolveBankLogo(name){
    const key=norm(name),canonical=aliasIndex().get(key)||key;
    return logoBank[canonical]?.src||logoBank[key]?.src||BUILTIN_LOGOS[canonical]||BUILTIN_LOGOS[key]||'';
  }

  function patchLogoResolver(){
    if(typeof window.getLogo!=='function'||window.getLogo.__cffCampPatched)return false;
    const original=window.getLogo;
    const wrapped=function(name){
      return resolveBankLogo(name)||original.call(this,name);
    };
    wrapped.__cffCampPatched=true;wrapped.__cffCampOriginal=original;
    window.getLogo=wrapped;
    try{getLogo=wrapped}catch(_){}
    return true;
  }
  function refreshViews(){
    patchLogoResolver();
    try{window.parseLogoOverrides?.()}catch(_){}
    try{window.renderSummary?.()}catch(_){}
    try{window.v76TournamentMode?.render?.()}catch(_){}
    document.querySelectorAll('img.mini-logo').forEach(img=>{
      const team=img.alt||img.closest('[data-team]')?.dataset?.team||'';
      const src=resolveBankLogo(team);if(src)img.src=src;
    });
  }

  function repoLogoForTeam(team){
    return BUILTIN_LOGOS[norm(team?.name)]||BUILTIN_LOGOS[norm(team?.code)]||BUILTIN_LOGOS[norm(team?.abbr)]||'';
  }
  function applyRepoLogosToRows(){
    const rows=[...document.querySelectorAll('#logos-config-rows .sheet-row')];
    const existing=new Map(rows.map(row=>[norm(row.querySelector('.logo-sheet-name')?.value),row]));
    let changed=0;
    teamRows().forEach(team=>{
      const path=repoLogoForTeam(team);if(!path)return;
      let row=existing.get(norm(team.name));
      if(!row&&typeof window.addLogoConfigRow==='function'){
        window.addLogoConfigRow(team.name,path);
        row=[...document.querySelectorAll('#logos-config-rows .sheet-row')].find(x=>norm(x.querySelector('.logo-sheet-name')?.value)===norm(team.name));
      }
      const input=row?.querySelector('.logo-sheet-file');
      if(input&&input.value!==path){input.value=path;changed++}
    });
    if(changed){
      try{window.syncLogosTextareaFromGrid?.();window.parseLogoOverrides?.();window.autoSave?.()}catch(_){}
    }
    return changed;
  }

  function fileToDataUrl(blob){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);
    });
  }
  async function compressLogo(file){
    if(file.size>2*1024*1024)throw new Error('Logo acima de 2 MB.');
    try{
      const bmp=await createImageBitmap(file);
      const max=192,scale=Math.min(1,max/bmp.width,max/bmp.height);
      const w=Math.max(1,Math.round(bmp.width*scale)),h=Math.max(1,Math.round(bmp.height*scale));
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d',{alpha:true});ctx.clearRect(0,0,w,h);ctx.drawImage(bmp,0,0,w,h);bmp.close?.();
      let blob=await new Promise(r=>canvas.toBlob(r,'image/webp',.86));
      if(!blob)throw new Error('Falha ao compactar');
      if(blob.size>115*1024){
        blob=await new Promise(r=>canvas.toBlob(r,'image/webp',.72))||blob;
      }
      return {src:await fileToDataUrl(blob),bytes:blob.size,width:w,height:h};
    }catch(error){
      if(file.size>350*1024)throw error;
      return {src:await fileToDataUrl(file),bytes:file.size,width:0,height:0};
    }
  }
  function bestTeamForFile(fileName){
    const stem=norm(String(fileName||'').replace(/\.[^.]+$/,''));
    let best=null,bestScore=-1;
    teamRows().forEach(team=>{
      [team.name,team.code,team.abbr].filter(Boolean).forEach(alias=>{
        const a=norm(alias);let score=0;
        if(a===stem)score=100;
        else if(a.length>=3&&(stem.startsWith(a)||a.startsWith(stem)))score=88;
        else if(a.length>=3&&(stem.includes(a)||a.includes(stem)))score=76;
        if(score>bestScore){bestScore=score;best=team}
      });
    });
    return bestScore>=70?best:null;
  }
  async function saveLogo(team,file){
    const canonical=norm(team?.name);if(!canonical||!file)throw new Error('Escolha um time e uma imagem.');
    const packed=await compressLogo(file);
    logoBank[canonical]={src:packed.src,fileName:file.name,bytes:packed.bytes,updatedAt:Date.now(),name:team.name};
    if(!writeBank(logoBank))return false;
    renderLogoBank();refreshViews();toast(`Logo de ${team.name} salva (${Math.max(1,Math.round(packed.bytes/1024))} KB).`);
    return true;
  }

  function updateLogoTeamSelect(){
    const select=$('#cff-logo-team');if(!select)return;
    const previous=select.value;
    select.innerHTML='<option value="">Escolha o time…</option>'+teamRows().map(team=>
      `<option value="${encodeURIComponent(team.name)}">${team.name}${team.abbr?' • '+team.abbr:''}</option>`).join('');
    if(previous&&[...select.options].some(o=>o.value===previous))select.value=previous;
  }
  function renderLogoBank(){
    const list=$('#cff-logo-bank-list');if(!list)return;
    updateLogoTeamSelect();
    const entries=Object.entries(logoBank);
    list.innerHTML=entries.length?entries.sort((a,b)=>String(a[1]?.name||a[0]).localeCompare(String(b[1]?.name||b[0]),'pt-BR')).map(([key,item])=>
      `<div class="cff-logo-bank-row" data-logo-key="${key}">
        <img src="${item.src}" alt="">
        <span><strong>${item.name||key}</strong><small>${item.fileName||'logo'} • ${Math.max(1,Math.round(Number(item.bytes||0)/1024))} KB</small></span>
        <button class="btn-mini danger-mini" type="button" data-remove-logo="${key}" title="Remover">×</button>
      </div>`).join(''):'<div class="hint">Nenhuma logo personalizada salva. As logos leves já existentes no site são usadas automaticamente quando disponíveis.</div>';
    list.querySelectorAll('[data-remove-logo]').forEach(btn=>btn.addEventListener('click',()=>{
      delete logoBank[btn.dataset.removeLogo];writeBank(logoBank);renderLogoBank();refreshViews();toast('Logo personalizada removida.','warn');
    }));
  }
  function buildLogoBank(){
    if($('#cff-logo-bank'))return true;
    const host=$('.logos-sheet');if(!host)return false;
    const box=document.createElement('div');box.id='cff-logo-bank';box.className='cff-logo-bank';
    box.innerHTML=`<div class="cff-logo-bank-head"><div><strong>Logos salvas neste navegador</strong><span> • reduzidas automaticamente para até 192 px</span></div><span>WebP leve</span></div>
      <div class="cff-logo-bank-form">
        <div><label for="cff-logo-team">Time</label><select id="cff-logo-team"><option value="">Escolha o time…</option></select></div>
        <div><label for="cff-logo-file">Imagem</label><input id="cff-logo-file" type="file" accept="image/*" multiple></div>
        <button id="cff-logo-save" class="btn-mini" type="button">Adicionar logo</button>
      </div>
      <div class="hint">Com 1 arquivo, o time escolhido é usado. Com vários arquivos, o painel tenta identificar o time pelo nome do arquivo. As imagens ficam só neste navegador e não pesam o repositório.</div>
      <div id="cff-logo-bank-list" class="cff-logo-bank-list"></div>`;
    host.appendChild(box);renderLogoBank();
    $('#cff-logo-save')?.addEventListener('click',async()=>{
      const input=$('#cff-logo-file'),files=[...(input?.files||[])];if(!files.length)return toast('Selecione pelo menos uma imagem.','warn');
      const selectedName=decodeURIComponent($('#cff-logo-team')?.value||'');
      const selected=teamRows().find(t=>t.name===selectedName);
      let saved=0,skipped=[];
      for(const file of files){
        const team=files.length===1&&selected?selected:bestTeamForFile(file.name);
        if(!team){skipped.push(file.name);continue}
        try{if(await saveLogo(team,file))saved++}catch(e){console.error(e);skipped.push(file.name)}
      }
      if(input)input.value='';
      if(skipped.length)toast(`${saved} logo(s) salva(s); ${skipped.length} sem time identificado. Escolha o time e envie uma por vez.`,saved?'warn':'err');
    });
    return true;
  }

  function meaningfulAutosave(){
    try{
      const data=JSON.parse(localStorage.getItem('ffws_autosave')||'null');
      return !!(data&&(data.selectedTeams?.length||data.tournamentModeV1?.days?.length||data.config?.tournamentName));
    }catch(_){return false}
  }
  async function applyBackupText(text,label,ask=true){
    JSON.parse(text);
    if(ask&&meaningfulAutosave()&&!confirm(`Carregar ${label}? O estado atual continuará disponível apenas se você já tiver baixado um backup.`))return;
    const input=$('#backup-input');if(!input)throw new Error('Campo de backup não encontrado.');
    input.value=text;
    if(typeof window.importBackup!=='function')throw new Error('Importador ainda não carregou.');
    window.importBackup();
    setTimeout(()=>{
      applyRepoLogosToRows();patchLogoResolver();refreshViews();
      $('#tournament-name')?.scrollIntoView({behavior:'smooth',block:'center'});
    },180);
  }
  async function loadPreset(key,ask=true){
    const preset=PRESETS[key];if(!preset)return;
    try{
      toast(`Carregando ${preset.label}…`,'warn');
      const response=await fetch(preset.url+'?v=20261001',{cache:'no-store'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      await applyBackupText(await response.text(),preset.label,ask);
    }catch(error){console.error(error);toast(`Não foi possível carregar ${preset.label}.`,'err')}
  }
  async function importFile(file){
    try{await applyBackupText(await file.text(),file.name,true)}
    catch(error){console.error(error);toast('Backup inválido.','err')}
  }
  function updateSaveState(){
    const el=$('#cff-camp-save-state');if(!el)return;
    try{
      const data=JSON.parse(localStorage.getItem('ffws_autosave')||'null');
      const name=data?.config?.tournamentName||data?.tournamentModeV1?.name||'Auto-save local ativo';
      el.textContent='● '+name;
      el.title='O estado do camp é salvo localmente neste navegador.';
    }catch(_){el.textContent='● Auto-save local'}
  }
  function setFocus(active){
    document.body.classList.toggle('cff-camp-focus',active);
    try{localStorage.setItem(FOCUS_KEY,active?'1':'0')}catch(_){}
    const btn=$('#cff-camp-focus');if(btn){btn.classList.toggle('is-active',active);btn.textContent=active?'Sair do foco':'Modo foco'}
  }
  function wireToolbar(){
    document.querySelectorAll('[data-cff-preset]').forEach(btn=>btn.addEventListener('click',()=>loadPreset(btn.dataset.cffPreset,true)));
    $('#cff-camp-import')?.addEventListener('click',()=>$('#cff-camp-file')?.click());
    $('#cff-camp-file')?.addEventListener('change',e=>{const file=e.target.files?.[0];if(file)importFile(file);e.target.value=''});
    $('#cff-camp-download')?.addEventListener('click',()=>window.downloadBackupJson?.());
    $('#cff-camp-focus')?.addEventListener('click',()=>setFocus(!document.body.classList.contains('cff-camp-focus')));
    $('#cff-camp-logos')?.addEventListener('click',()=>{
      document.querySelector('.teams-setup')?.setAttribute('open','');
      setTimeout(()=>$('#cff-logo-bank')?.scrollIntoView({behavior:'smooth',block:'center'}),40);
    });
    document.addEventListener('keydown',event=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){
        event.preventDefault();
        try{window.autoSave?.(true);updateSaveState();toast('Camp salvo neste navegador.')}catch(_){}
      }
    });
    document.addEventListener('input',()=>{clearTimeout(wireToolbar._saveTimer);wireToolbar._saveTimer=setTimeout(updateSaveState,700)},{passive:true});
    document.addEventListener('change',()=>{clearTimeout(wireToolbar._saveTimer);wireToolbar._saveTimer=setTimeout(updateSaveState,350)},{passive:true});
  }

  window.CFF_CAMP={
    ...(window.CFF_CAMP||{}),
    applyBackupText,
    loadPreset,
    importFile,
    toast,
    norm,
    teamRows,
    refreshViews,
    meaningfulAutosave,
    updateSaveState
  };

  function boot(){
    patchLogoResolver();
    buildLogoBank();
    applyRepoLogosToRows();
    wireToolbar();
    updateSaveState();
    setFocus(localStorage.getItem(FOCUS_KEY)==='1');
    [250,700,1500].forEach(delay=>setTimeout(()=>{patchLogoResolver();buildLogoBank();applyRepoLogosToRows();renderLogoBank();},delay));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
