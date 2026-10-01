(function(){
  'use strict';

  const PRESETS={
    ffws:{url:'admin-camp-ao-vivo/data/backup-ffws-br-2026-s2-segunda-fase.json',label:'FFWS BR 2026 S2'},
    base:{url:'admin-camp-ao-vivo/data/backup-torneio.json',label:'Base do torneio'}
  };
  const LOGO_KEY='cff_camp_logo_bank_v1';
  const FOCUS_KEY='cff_camp_focus_v1';
  const LOGO_CATALOG_URL='team-data/logo-map.json?v=20261001-camp-logos-v2';
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
  let catalogLogos=new Map();
  let catalogAliases=new Map();
  let logoCatalogLoaded=false;

  function catalogLogo(name){
    const key=norm(name);
    if(!key)return '';
    const canonical=catalogAliases.get(key)||key;
    return catalogLogos.get(canonical)||catalogLogos.get(key)||'';
  }
  async function loadLogoCatalog(){
    try{
      const response=await fetch(LOGO_CATALOG_URL,{cache:'default'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const data=await response.json();
      catalogLogos=new Map(Object.entries(data?.logos||{}).map(([name,url])=>[norm(name),String(url||'').trim()]).filter(([,url])=>url));
      catalogAliases=new Map(Object.entries(data?.aliases||{}).map(([alias,target])=>[norm(alias),norm(target)]).filter(([alias,target])=>alias&&target));
      logoCatalogLoaded=true;
      applyRepoLogosToRows();
      refreshViews();
      renderLogoBank();
      return true;
    }catch(error){
      console.warn('[Camp ao vivo] catálogo de logos indisponível',error);
      return false;
    }
  }

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
    return logoBank[canonical]?.src||logoBank[key]?.src||BUILTIN_LOGOS[canonical]||BUILTIN_LOGOS[key]||catalogLogo(canonical)||catalogLogo(key)||'';
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
    return BUILTIN_LOGOS[norm(team?.name)]||BUILTIN_LOGOS[norm(team?.code)]||BUILTIN_LOGOS[norm(team?.abbr)]||catalogLogo(team?.name)||catalogLogo(team?.code)||catalogLogo(team?.abbr)||'';
  }
  function shouldReplaceLogoValue(value){
    const raw=String(value||'').trim();
    if(!raw)return true;
    if(/^[a-z]:[\\/]/i.test(raw)||raw.startsWith('file:'))return true;
    if(!/^(?:https?:|data:|blob:)/i.test(raw)&&!/[\\/]/.test(raw))return true;
    return false;
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
      if(input&&input.value!==path&&shouldReplaceLogoValue(input.value)){input.value=path;changed++}
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

  function injectCampFixStyles(){
    if($('#cff-camp-fixes-style'))return;
    const style=document.createElement('style');
    style.id='cff-camp-fixes-style';
    style.textContent=`
      .v46-placement-choice input:checked{
        border-color:var(--accent)!important;
        background:radial-gradient(circle at center,#fff 0 3px,transparent 3.5px),var(--accent)!important;
        box-shadow:0 0 0 1px rgba(255,170,0,.30),0 0 7px rgba(255,170,0,.22)!important;
      }
      .v46-placement-choice:has(input:checked){font-weight:1000!important}
      .v76-day-actions [data-v76-edit-day]{border-color:rgba(0,200,255,.38)!important;color:#a9eeff!important}
    `;
    document.head.appendChild(style);
  }

  function patchImportedDayEditing(){
    if(window.__CFF_CAMP_IMPORTED_DAY_EDIT_V2__)return;
    window.__CFF_CAMP_IMPORTED_DAY_EDIT_V2__=true;
    document.addEventListener('click',event=>{
      const edit=event.target.closest?.('[data-v76-edit-day]');
      if(!edit)return;
      const id=String(edit.dataset.v76EditDay||'');
      const open=[...document.querySelectorAll('[data-v76-open-day]')].find(button=>String(button.dataset.v76OpenDay||'')===id);
      if(!open)return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      open.click();
    },true);
    const relabel=()=>document.querySelectorAll('[data-v76-edit-day]').forEach(button=>{
      if(button.textContent.trim()==='Editar registro')button.textContent='Editar quedas';
      button.title='Carrega este dia antigo no editor para alterar qualquer queda';
    });
    relabel();
    new MutationObserver(relabel).observe(document.body,{childList:true,subtree:true});
  }


  function injectWorkspacePolishStyles(){
    if($('#cff-camp-workspace-polish-v2'))return;
    const style=document.createElement('style');
    style.id='cff-camp-workspace-polish-v2';
    style.textContent=`
      /* ===== Workspace: Lançar quedas + Resumo ===== */
      .main-layout{
        display:grid!important;
        grid-template-columns:minmax(600px,.94fr) minmax(700px,1.06fr)!important;
        gap:16px!important;
        align-items:start!important;
        margin-top:16px!important;
      }
      .main-layout>.collapsible-section{
        min-width:0!important;
        margin:0!important;
        border:1px solid #203247!important;
        border-radius:12px!important;
        background:#09111a!important;
        overflow:hidden!important;
      }
      .main-layout>.collapsible-section>summary{
        display:flex!important;
        align-items:center!important;
        min-height:44px!important;
        box-sizing:border-box!important;
        padding:0 14px!important;
        border-bottom:1px solid #1c2c3d!important;
        background:#101923!important;
        color:#f4f8fc!important;
        font-size:.82rem!important;
        font-weight:900!important;
        letter-spacing:.025em!important;
        text-transform:uppercase!important;
        white-space:nowrap!important;
      }
      .main-layout>.collapsible-section>.collapsible-content{
        padding:12px!important;
      }

      /* ===== Lançar quedas ===== */
      .drop-section .drop-top-tools{
        display:flex!important;
        align-items:center!important;
        gap:7px!important;
        margin:0 0 10px!important;
        padding-bottom:10px!important;
        border-bottom:1px solid #192a3b!important;
      }
      .drop-section .drop-settings-wrap{margin-right:auto!important}
      .drop-section .drop-top-tools .btn-mini{
        min-height:32px!important;
        padding:6px 9px!important;
        border-radius:8px!important;
        white-space:nowrap!important;
      }
      .drop-section .drop-fill-counter{
        min-height:30px!important;
        display:flex!important;
        align-items:center!important;
        padding:0 11px!important;
        border-radius:999px!important;
        white-space:nowrap!important;
        font-size:.68rem!important;
      }

      .cff-drop-primary-row{
        display:grid!important;
        grid-template-columns:minmax(115px,.7fr) minmax(190px,1.25fr) minmax(200px,1.45fr)!important;
        gap:9px!important;
        align-items:end!important;
        margin:0 0 10px!important;
        padding:10px!important;
        border:1px solid #1d3043!important;
        border-radius:10px!important;
        background:#0d1620!important;
      }
      .cff-drop-primary-row>div{
        min-width:0!important;
      }
      .drop-section label{
        margin-bottom:5px!important;
        color:#87a3bc!important;
        font-size:.64rem!important;
        line-height:1.05!important;
        font-weight:900!important;
        letter-spacing:.035em!important;
        text-transform:uppercase!important;
        white-space:nowrap!important;
      }
      .drop-section input,
      .drop-section select{
        min-height:36px!important;
        box-sizing:border-box!important;
        border-radius:8px!important;
      }
      .drop-section #drop-num,
      .drop-section #input-mode,
      .drop-section #drop-map{
        width:100%!important;
      }

      .drop-section .drop-utility-actions,
      .drop-section .mvp-inline-box{
        margin:0 0 9px!important;
        padding:9px!important;
        border:1px solid #1a2b3c!important;
        border-radius:9px!important;
        background:#0c151e!important;
      }
      .drop-section .drop-utility-actions{
        display:flex!important;
        flex-wrap:wrap!important;
        align-items:center!important;
        gap:7px!important;
      }
      .drop-section .drop-utility-actions .btn-mini{
        min-height:32px!important;
        padding:6px 9px!important;
        white-space:nowrap!important;
      }
      .drop-section .drop-utility-actions .hint{
        flex:1 1 220px!important;
        margin:0!important;
        line-height:1.25!important;
      }
      .drop-section .mvp-inline-box{
        gap:8px!important;
        align-items:end!important;
      }

      /* Cards dos times - preserva o modo grade/linha do núcleo */
      #teams-inputs-container{
        margin-top:10px!important;
      }
      #teams-inputs-container>.cff-team-entry{
        min-width:0!important;
        box-sizing:border-box!important;
        border-radius:10px!important;
        border-color:#2a3b4d!important;
        box-shadow:none!important;
      }
      #teams-inputs-container>.cff-team-entry:focus-within{
        border-color:#346281!important;
        box-shadow:0 0 0 1px rgba(50,155,225,.12)!important;
      }
      #teams-inputs-container>.cff-team-entry label,
      #teams-inputs-container>.cff-team-entry small{
        white-space:nowrap!important;
      }
      #teams-inputs-container>.cff-team-entry input,
      #teams-inputs-container>.cff-team-entry select,
      #teams-inputs-container>.cff-team-entry button{
        border-radius:7px!important;
      }
      #teams-inputs-container>.cff-team-entry input[type="number"],
      #teams-inputs-container>.cff-team-entry input[type="text"]{
        min-height:34px!important;
      }
      #teams-inputs-container [class*="placement"],
      #teams-inputs-container [class*="coloc"]{
        white-space:nowrap!important;
      }
      .v46-placement-choice{
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
        gap:2px!important;
        white-space:nowrap!important;
      }

      .drop-section .btn-save{
        min-height:42px!important;
        margin-top:11px!important;
        border-radius:9px!important;
        font-size:.78rem!important;
        font-weight:900!important;
        letter-spacing:.02em!important;
        white-space:nowrap!important;
      }

      /* ===== Resumo ===== */
      .summary-section .sub-summary-section{
        margin:0 0 8px!important;
        border:1px solid #1c2e40!important;
        border-radius:9px!important;
        background:#0b141d!important;
        overflow:hidden!important;
      }
      .summary-section .sub-summary-section:last-child{margin-bottom:0!important}
      .summary-section .sub-summary-section>summary{
        display:flex!important;
        align-items:center!important;
        min-height:38px!important;
        padding:0 11px!important;
        background:#0f1923!important;
        color:#e5f0fb!important;
        font-size:.70rem!important;
        line-height:1!important;
        font-weight:900!important;
        letter-spacing:.025em!important;
        text-transform:uppercase!important;
        white-space:nowrap!important;
      }
      .summary-section .sub-summary-content{
        padding:10px!important;
      }

      .summary-section .summary-toolbar{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) auto!important;
        gap:8px!important;
        align-items:start!important;
      }
      .summary-section .summary-main-controls{
        display:flex!important;
        flex-wrap:wrap!important;
        align-items:center!important;
        gap:7px!important;
        min-width:0!important;
      }
      .summary-section .summary-main-controls>label.switch,
      .summary-section .summary-style-control,
      .summary-section .summary-main-controls>div{
        min-width:0!important;
        min-height:34px!important;
        box-sizing:border-box!important;
        margin:0!important;
        padding:6px 8px!important;
        border:1px solid #1d3042!important;
        border-radius:8px!important;
        background:#0c1620!important;
      }
      .summary-section label.switch{
        display:inline-flex!important;
        align-items:center!important;
        gap:6px!important;
        margin:0!important;
        white-space:nowrap!important;
        font-size:.68rem!important;
        line-height:1!important;
      }
      .summary-section label.switch input{
        flex:0 0 auto!important;
        margin:0!important;
      }
      .summary-section .summary-style-control label,
      .summary-section .summary-main-controls>div>label{
        margin:0 0 4px!important;
        color:#7895ae!important;
        font-size:.58rem!important;
        line-height:1!important;
        text-transform:uppercase!important;
        white-space:nowrap!important;
      }
      .summary-section .summary-main-controls select{
        min-height:27px!important;
        max-width:190px!important;
        border-radius:7px!important;
      }
      .summary-section .summary-actions-compact{
        display:flex!important;
        gap:6px!important;
      }
      .summary-section .summary-actions-compact .btn-mini{
        width:34px!important;
        min-width:34px!important;
        height:34px!important;
        padding:0!important;
        border-radius:8px!important;
      }

      .summary-section .summary-columns-box{
        display:flex!important;
        flex-wrap:wrap!important;
        align-items:center!important;
        gap:7px!important;
        padding:0!important;
        border:0!important;
        background:transparent!important;
      }
      .summary-section .summary-columns-box>.detail-mode-pill,
      .summary-section .summary-columns-box>label.switch{
        min-height:34px!important;
        box-sizing:border-box!important;
        margin:0!important;
        border-radius:8px!important;
      }
      .summary-section .summary-columns-box>.column-order-control{
        flex:1 1 100%!important;
        display:grid!important;
        grid-template-columns:auto minmax(180px,1fr) auto!important;
        align-items:center!important;
        gap:7px!important;
        margin-top:1px!important;
        padding:8px!important;
        border:1px solid #1d3042!important;
        border-radius:8px!important;
        background:#0c1620!important;
      }
      .summary-section .summary-columns-box>.column-order-control label{
        margin:0!important;
        white-space:nowrap!important;
        font-size:.62rem!important;
      }
      .summary-section .summary-columns-box>.column-order-control input{
        min-width:0!important;
        min-height:32px!important;
        border-radius:7px!important;
      }

      .summary-section .table-edit-toolbar{
        display:flex!important;
        flex-wrap:wrap!important;
        align-items:center!important;
        gap:6px!important;
        margin:0 0 8px!important;
        padding:7px!important;
        border:1px solid #1c2e40!important;
        border-radius:8px!important;
        background:#0c1620!important;
      }
      .summary-section .table-edit-toolbar .btn-mini{
        min-width:32px!important;
        min-height:32px!important;
        padding:5px 8px!important;
        border-radius:7px!important;
        white-space:nowrap!important;
      }
      .summary-section .table-edit-status{
        white-space:nowrap!important;
        color:#7f99b1!important;
        font-size:.66rem!important;
      }
      .summary-section .code-actions-grid{
        gap:9px!important;
        margin-top:10px!important;
      }
      .summary-section .code-actions-grid>div{
        min-width:0!important;
        padding:9px!important;
        border:1px solid #1c2e40!important;
        border-radius:9px!important;
        background:#0b141d!important;
      }
      .summary-section .btn-gen{
        min-height:38px!important;
        border-radius:8px!important;
        font-size:.72rem!important;
        font-weight:900!important;
        white-space:nowrap!important;
      }

      /* ===== Foco nas tabelas ===== */
      body.cff-camp-focus>.container>h1,
      body.cff-camp-focus>.container>.cff-camp-command,
      body.cff-camp-focus>.container>.setup-grid,
      body.cff-camp-focus>.container>.setup-actions-bar,
      body.cff-camp-focus>.container>.emoji-setup,
      body.cff-camp-focus>.container>.teams-setup,
      body.cff-camp-focus>.container>.wiki-import-section,
      body.cff-camp-focus>.container>.backup-section{
        display:none!important;
      }
      body.cff-camp-focus>.container{
        max-width:none!important;
        padding-top:12px!important;
      }
      body.cff-camp-focus .main-layout{
        display:block!important;
        margin:0!important;
      }
      body.cff-camp-focus .drop-section{
        display:none!important;
      }
      body.cff-camp-focus .summary-section{
        width:100%!important;
        max-width:none!important;
        border:0!important;
        background:transparent!important;
        box-shadow:none!important;
      }
      body.cff-camp-focus .summary-section>summary{
        display:none!important;
      }
      body.cff-camp-focus .summary-section>.collapsible-content{
        padding:0!important;
        background:transparent!important;
      }
      body.cff-camp-focus .summary-section .sub-summary-section:not(:has(.table-print-area)){
        display:none!important;
      }
      body.cff-camp-focus .summary-section .sub-summary-section:has(.table-print-area){
        display:block!important;
        margin:0!important;
        border:0!important;
        background:transparent!important;
      }
      body.cff-camp-focus .summary-section .sub-summary-section:has(.table-print-area)>summary{
        display:none!important;
      }
      body.cff-camp-focus .summary-section .sub-summary-section:has(.table-print-area)>.sub-summary-content{
        padding:0!important;
      }
      body.cff-camp-focus .summary-section .table-edit-toolbar,
      body.cff-camp-focus .summary-section .column-edit-panel,
      body.cff-camp-focus .summary-section .code-actions-grid{
        display:none!important;
      }
      body.cff-camp-focus .summary-section .table-print-area{
        margin-top:8px!important;
      }

      @media(max-width:1380px){
        .main-layout{
          grid-template-columns:minmax(520px,.9fr) minmax(620px,1.1fr)!important;
        }
      }
      @media(max-width:1160px){
        .main-layout{
          grid-template-columns:minmax(0,1fr)!important;
        }
      }
      @media(max-width:760px){
        .main-layout>.collapsible-section>.collapsible-content{padding:9px!important}
        .cff-drop-primary-row{
          grid-template-columns:1fr!important;
        }
        .summary-section .summary-toolbar{
          grid-template-columns:1fr!important;
        }
        .summary-section .summary-columns-box>.column-order-control{
          grid-template-columns:1fr!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function compactWorkspaceLabels(){
    const summaries=[
      ['Lançar quedas','🎯 Lançar quedas'],
      ['Resumo e gerar código','📊 Resumo e códigos'],
      ['Opções estéticas','🎨 Visual'],
      ['Visual da tabela','🎨 Visual'],
      ['Opção da coluna','☷ Colunas'],
      ['Colunas da tabela','☷ Colunas'],
      ['Tabela','▦ Tabelas'],
      ['Prévia da tabela','▦ Tabelas'],
      ['Texto automático','✎ Texto']
    ];
    document.querySelectorAll('details>summary').forEach(el=>{
      const current=el.textContent.replace(/\s+/g,' ').trim();
      const found=summaries.find(([from])=>current===from);
      if(found&&current!==found[1])el.textContent=found[1];
    });

    const buttons=[
      ['Limpar mapas das quedas não terminadas','🧹 Limpar mapas'],
      ['🎲 Random para teste','🎲 Teste'],
      ['Random para teste','🎲 Teste'],
      ['Limpar todas as colocações','↺ Limpar posições'],
      ['Salvar Queda','✓ Salvar queda'],
      ['Registrar dia','💾 Registrar dia'],
      ['Backup JSON','⬇ Backup'],
      ['Modo torneio','🏆 Torneio'],
      ['Coluna descanso','◫ Descanso'],
      ['Configurar dias','⚙ Dias'],
      ['Gerar Código Wiki','📄 Gerar Wiki'],
      ['Gerar Prizepool','💰 Prizepool']
    ];
    document.querySelectorAll('button').forEach(el=>{
      const current=el.textContent.replace(/\s+/g,' ').trim();
      const found=buttons.find(([from])=>current===from);
      if(found&&current!==found[1]){
        el.textContent=found[1];
        if(!el.title)el.title=found[0];
      }
    });
  }

  function markWorkspaceElements(){
    const dropNum=$('#drop-num');
    if(dropNum){
      const row=dropNum.parentElement?.parentElement;
      if(row&&row.querySelector('#input-mode')&&row.querySelector('#drop-map')){
        row.classList.add('cff-drop-primary-row');
        row.removeAttribute('style');
      }
    }
    document.querySelectorAll('#teams-inputs-container>*').forEach(card=>card.classList.add('cff-team-entry'));
  }

  function installWorkspacePolishObserver(){
    if(window.__CFF_CAMP_WORKSPACE_POLISH_OBSERVER__)return;
    window.__CFF_CAMP_WORKSPACE_POLISH_OBSERVER__=true;
    let queued=false;
    const refresh=()=>{
      if(queued)return;
      queued=true;
      requestAnimationFrame(()=>{
        queued=false;
        compactWorkspaceLabels();
        markWorkspaceElements();
      });
    };
    new MutationObserver(refresh).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('change',refresh,{passive:true});
    refresh();
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
    const btn=$('#cff-camp-focus');if(btn){btn.classList.toggle('is-active',active);btn.textContent=active?'← Sair do foco':'▦ Foco nas tabelas';btn.title=active?'Voltar ao painel completo':'Mostrar apenas Tabela do dia e Tabela geral quando disponível'}
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
    injectCampFixStyles();
    injectWorkspacePolishStyles();
    compactWorkspaceLabels();
    markWorkspaceElements();
    installWorkspacePolishObserver();
    patchImportedDayEditing();
    patchLogoResolver();
    buildLogoBank();
    applyRepoLogosToRows();
    loadLogoCatalog();
    wireToolbar();
    updateSaveState();
    setFocus(localStorage.getItem(FOCUS_KEY)==='1');
    [250,700,1500].forEach(delay=>setTimeout(()=>{patchLogoResolver();buildLogoBank();applyRepoLogosToRows();renderLogoBank();},delay));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
