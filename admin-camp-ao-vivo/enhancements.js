(function(){
  'use strict';

  const PRESETS={
    ffws:{url:'admin-camp-ao-vivo/data/backup-ffws-br-2026-s2-segunda-fase.json',label:'FFWS BR 2026 S2'},
    base:{url:'admin-camp-ao-vivo/data/backup-torneio.json',label:'Base do torneio'}
  };
  const LOGO_KEY='cff_camp_logo_bank_v1';
  const FOCUS_KEY='cff_camp_focus_v1';
  const LOGO_CATALOG_URL='team-data/logo-map.json?v=20261001-camp-logos-v3';
  const BUILTIN_LOGOS={
    ANTISOCIALTEAM:'ast.webp',
    ANTISOCIAL:'ast.webp',
    AST:'ast.webp',
    ATS:'ast.webp',
    LYON:'lyon.webp',
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
    if($('#cff-camp-workspace-polish-v3'))return;
    const style=document.createElement('style');style.id='cff-camp-workspace-polish-v3';
    style.textContent=`
      /* Only workspace controls; tables and scoring fields keep their own rules. */
      body .main-layout{grid-template-columns:minmax(0,1fr) minmax(0,1.15fr)!important;gap:16px!important;align-items:start}
      .main-layout>.collapsible-section{min-width:0;box-sizing:border-box;border-radius:12px!important}
      .main-layout>.summary-section{container-type:inline-size}
      .main-layout>.collapsible-section>summary{font-size:.85rem;line-height:1.4;padding:10px 12px!important}
      .main-layout>.collapsible-section>.collapsible-content{padding:12px!important}
      .drop-section button,.summary-section button{white-space:nowrap}
      .drop-section .drop-top-tools{gap:8px;align-items:center;flex-wrap:wrap}
      .drop-section .drop-fill-counter{margin-left:auto;white-space:nowrap}
      .cff-drop-primary-row{display:grid!important;grid-template-columns:minmax(105px,.65fr) minmax(0,1.3fr) minmax(0,1.2fr);gap:10px!important;align-items:start;margin-bottom:12px!important}
      .cff-drop-primary-row>div{min-width:0}
      .cff-drop-primary-row label{font-size:.72rem;line-height:1.4;margin-bottom:5px}
      .cff-drop-primary-row select{width:100%;min-width:0}
      .drop-section .drop-utility-actions{gap:8px;align-items:center;flex-wrap:wrap}
      .drop-section .drop-utility-actions .hint{flex:1 1 260px;line-height:1.4}
      .drop-section .mvp-inline-box{gap:10px;align-items:end}
      .drop-section .btn-save{min-height:42px;border-radius:8px;margin-top:14px}
      /* Global input width must never apply to radio buttons or checkboxes. */
      .main-layout input[type="checkbox"],.main-layout input[type="radio"]{
        width:16px!important;min-width:16px!important;max-width:16px!important;
        height:16px!important;min-height:16px!important;padding:0!important;margin:0!important;flex:0 0 16px!important;
      }
      .main-layout label.switch{display:inline-flex;align-items:center;gap:7px;width:auto!important;min-width:0;text-transform:none;font-size:.76rem;line-height:1.4}
      .summary-section .summary-toolbar{display:grid!important;grid-template-columns:minmax(0,1fr);gap:10px;align-items:start}
      .summary-section .summary-main-controls{display:grid!important;grid-template-columns:repeat(12,minmax(0,1fr));gap:8px;align-items:stretch}
      .summary-section .summary-main-controls>label.switch{grid-column:span 3;box-sizing:border-box;min-height:40px;margin:0;padding:8px 9px;border:1px solid #293c50;border-radius:7px;white-space:nowrap}
      .summary-section .summary-main-controls>div.cff-visual-field{grid-column:span 4;min-width:0!important;display:flex!important;flex-direction:column;align-items:stretch;justify-content:center;gap:6px;box-sizing:border-box;min-height:76px;padding:8px 10px;background:#0c1420;border:1px solid #293c50;border-radius:7px}
      .summary-section .summary-main-controls>div.cff-visual-field>label{display:block;font-size:.68rem!important;line-height:16px;margin:0!important;color:#8eb0cf;text-transform:uppercase}
      .summary-section .summary-main-controls>#v90-champion-activated-logos-row{grid-column:span 4;min-height:76px;white-space:normal;line-height:1.4;background:#0c1420}
      .summary-section .summary-style-control{gap:6px}
      .summary-section .summary-style-control label{margin:0;white-space:nowrap}
      .summary-section .summary-main-controls select{width:100%;max-width:100%;min-width:0;min-height:36px;padding:7px 9px;margin:0}
      .summary-section .summary-actions-compact{display:flex;align-items:center;justify-content:flex-start;width:100%;margin:0;padding-top:2px;gap:7px}
      .summary-section .summary-actions-compact::before{content:'Ferramentas';font-size:.7rem;color:#8eb0cf;margin-right:5px}
      .summary-section .summary-actions-compact .btn-mini{display:inline-flex;align-items:center;justify-content:center;width:36px;min-width:36px;height:36px;padding:0;border-radius:7px;line-height:1}
      .summary-section #v57-day-split-ui{margin-top:10px}
      .summary-section .v57-day-main{display:flex;flex-wrap:wrap;align-items:center;gap:10px;min-height:40px}
      .summary-section .v57-day-main>.switch{margin:0;min-height:36px}
      .summary-section .v57-day-main>.btn-mini{min-height:36px}
      .summary-section .sub-summary-section{border-radius:9px;margin-bottom:10px}
      .summary-section .sub-summary-section>summary{padding:9px 11px;font-size:.78rem;line-height:1.4}
      .summary-section .sub-summary-content{padding:10px}
      .summary-section .summary-columns-box{display:flex;flex-wrap:wrap;align-items:center;gap:9px}
      .summary-section .column-order-control{flex-basis:100%;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      .summary-section .column-order-control input{flex:1 1 200px;min-width:0}
      .summary-section .column-order-control label{margin:0}
      .summary-section .table-edit-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
      .summary-section .code-actions-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .summary-section .code-actions-grid>div{min-width:0}
      .summary-section .code-actions-grid textarea{width:100%;box-sizing:border-box}
      #teams-inputs-container .team-row{min-width:0;border-radius:9px!important;gap:8px;align-items:center}
      #teams-inputs-container .team-flex{min-width:0}
      #teams-inputs-container .micro-label{display:block;height:22px;min-height:22px;margin:0!important;font-size:.58rem!important;line-height:22px;white-space:nowrap}
      #teams-inputs-container .team-row>.small-cell{align-self:start;min-width:0}
      #teams-inputs-container .small-cell>input[type="number"]{height:32px!important;box-sizing:border-box;padding:5px 3px!important;font-size:.85rem}
      #teams-inputs-container.v46-simple-placement-enabled .team-row.detailed-row,
      body.v41-simple-mode #teams-inputs-container.v46-simple-placement-enabled .team-row.detailed-row{
        grid-template-columns:50px 50px minmax(174px,1fr) 30px!important;
        padding:8px!important;gap:6px!important;row-gap:7px;
      }
      #teams-inputs-container.v46-simple-placement-enabled .team-row.detailed-row>.team-flex{grid-column:1/-1;overflow:visible!important;min-height:28px}
      #teams-inputs-container.v46-simple-placement-enabled .team-row.detailed-row>.team-flex>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #teams-inputs-container .v46-placement-grid{align-self:stretch;grid-template-columns:minmax(0,1fr)!important}
      #teams-inputs-container.v46-simple-placement-enabled .team-row.detailed-row>.v46-placement-grid{grid-column:1/-1!important;grid-row:3!important}
      #teams-inputs-container.v46-simple-placement-enabled .team-row.detailed-row>.slot-actions{grid-column:4;grid-row:2}
      #teams-inputs-container .cff-placement-line{display:grid;grid-column:1/-1;grid-template-columns:repeat(var(--cff-placement-count),minmax(0,1fr));gap:4px;min-width:0}
      #teams-inputs-container .cff-placement-line>.v46-placement-choice{min-height:22px;box-sizing:border-box}
      #teams-inputs-container.cff-hide-clear-slot .slot-actions button[onclick*="clearTeamSlot"]{display:none!important}
      #teams-inputs-container .v46-placement-choice input{width:14px!important;min-width:14px!important;max-width:14px!important;height:14px!important;min-height:14px!important;flex-basis:14px!important}
      #teams-inputs-container .v46-placement-choice{gap:3px;line-height:1.3}
      /* Keep scores beside the editor, including on smaller desktop screens. */
      body.v81-launch-grid-mode .main-layout,
      body.v41-tournament-mode.v81-launch-grid-mode .main-layout,
      body.v81-launch-grid-mode.v81-launch-grid-wide .main-layout,
      body.v41-tournament-mode.v81-launch-grid-mode.v81-launch-grid-wide .main-layout{grid-template-columns:minmax(0,1fr) minmax(0,min(48vw,var(--cff-grid-table-slot-width,520px)))!important}
      body.v81-launch-grid-mode #summary-section{position:sticky;top:76px;max-height:calc(100vh - 90px);overflow:auto}
      body.v81-launch-grid-mode #teams-inputs-container.v81-launch-grid{grid-template-columns:repeat(var(--v81-grid-columns),minmax(max(350px,calc(var(--v81-grid-card-min) * .66)),1fr))!important}
      body.v81-launch-grid-mode #teams-inputs-container.v81-launch-grid>.team-row{min-width:max(350px,calc(var(--v81-grid-card-min) * .66))!important}
      #teams-inputs-container input:is([id^="kills-"],[id^="place-"]){width:50px!important;min-width:50px!important;max-width:50px!important;height:32px;padding:5px 3px!important;text-align:center;box-sizing:border-box;font-size:.85rem;-moz-appearance:textfield}
      #teams-inputs-container input:is([id^="kills-"],[id^="place-"])::-webkit-inner-spin-button,
      #teams-inputs-container input:is([id^="kills-"],[id^="place-"])::-webkit-outer-spin-button{-webkit-appearance:none!important;appearance:none!important;margin:0}
      #teams-inputs-container .v46-placement-grid{gap:2px!important;padding:5px!important}
      #teams-inputs-container .v46-placement-choice{padding:3px 0!important;gap:2px!important;font-size:.6rem!important}
      #teams-inputs-container .v46-placement-choice input{width:12px!important;min-width:12px!important;max-width:12px!important;height:12px!important;min-height:12px!important;flex-basis:12px!important}
      #teams-inputs-container .slot-actions .btn-slot{width:30px!important;min-width:30px!important;max-width:30px!important;height:32px;padding:0!important}
      #teams-inputs-container .v82-calculated-kills.pending{display:none!important}
      #teams-inputs-container .team-row>.team-flex{grid-column:1/-1;min-height:34px;padding:5px 7px;box-sizing:border-box;border-radius:6px;background:var(--cff-team-color);color:var(--cff-team-ink,#fff)}
      #teams-inputs-container .team-row>.team-flex>span:not(.team-quick-actions-v28){color:inherit!important;min-width:0;overflow:hidden;text-overflow:ellipsis}
      #teams-inputs-container .cff-color-picker{position:relative;display:none;flex:0 0 26px;width:26px!important;height:26px;margin:0!important;padding:0!important;align-items:center;justify-content:center;border:1px solid currentColor;border-radius:5px;cursor:pointer;color:inherit;font-size:16px}
      #teams-inputs-container.cff-custom-colors .cff-color-picker{display:inline-flex}
      #teams-inputs-container .cff-color-picker input[type="color"]{position:absolute;inset:0;opacity:0;width:100%!important;min-width:0!important;height:100%;margin:0;padding:0;border:0;cursor:pointer}
      #teams-inputs-container .cff-color-picker:focus-within{outline:2px solid #fff;outline-offset:2px}
      #teams-inputs-container .cff-color-picker svg{width:16px;height:16px;fill:currentColor;pointer-events:none}
      #drop-settings-panel{width:min(420px,calc(100vw - 44px))!important;max-height:min(720px,calc(100dvh - 115px));overflow:auto;box-sizing:border-box;padding:12px!important;background:#101924!important;border-color:#31485d!important}
      #drop-settings-panel>.cff-launch-group{margin:8px 0 0;border:1px solid #293e51;border-radius:8px;background:#131f2c}
      #drop-settings-panel>.cff-launch-group>summary{padding:9px 10px!important;color:#aacce9;font-size:.76rem;text-transform:none;cursor:pointer}
      #drop-settings-panel .cff-launch-options{padding:0 8px 8px;display:grid;gap:6px}
      #drop-settings-panel .cff-launch-options .switch:not([style*="display: none"]){display:flex!important;flex-direction:row-reverse!important;justify-content:flex-end!important;gap:8px!important;width:100%!important;box-sizing:border-box;padding:8px!important;margin:0!important;min-height:34px;font-size:.74rem!important;text-align:left;white-space:normal;text-transform:none;background:#1b2938!important}
      #drop-settings-panel .v81-option-note::after{display:none!important}
      #drop-settings-panel .cff-launch-options>div{margin:0!important}
      #drop-settings-panel .cff-launch-options button{white-space:normal;min-height:32px}
      #drop-settings-panel #cff-auto-colors{width:100%;text-align:left;padding:8px 10px;border-color:#486583;color:#cbe6ff}
      #drop-settings-panel #v34-hide-toggle,#drop-settings-panel .v34-hide-title,#drop-settings-panel #v34-hide-body>.hint{display:none!important}
      #drop-settings-panel #v34-hide-buttons-panel{margin:0!important}
      #drop-settings-panel #v34-hide-body{display:grid!important;gap:6px;padding:0!important;margin:0!important;border:0!important;background:transparent!important}
      #drop-settings-panel .cff-launch-options .switch.cff-eye-control{flex-direction:row!important;justify-content:space-between!important;margin:0!important;gap:10px!important}
      #drop-settings-panel .cff-eye-control>input{display:none!important}
      #drop-settings-panel .cff-eye-control>.cff-visibility-eye{display:inline-flex;align-items:center;justify-content:center;width:32px!important;min-width:32px;height:30px!important;min-height:30px!important;flex:0 0 32px;padding:4px!important;background:#203c54;color:#95d4ff;border:1px solid #496b8a;border-radius:6px;cursor:pointer}
      #drop-settings-panel .cff-visibility-eye[aria-pressed="true"]{background:#17212e;color:#8597ac;border-color:#35485b}
      #drop-settings-panel .cff-visibility-eye svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      #drop-settings-panel .cff-launch-help{font-size:.68rem;line-height:1.45;color:#a1b6cb;margin:0 2px 2px}
      #v92-table-view-switch[hidden],#v76-table-view-toolbar[hidden],#v92-table-view-switch button[hidden]{display:none!important}
      /* Focus keeps the existing day/general view switch and hides editing tools. */
      body.cff-camp-focus>.container>:not(.main-layout){display:none!important}
      body.cff-camp-focus .main-layout{display:block!important}
      body.cff-camp-focus .drop-section{display:none!important}
      body.cff-camp-focus #summary-section{position:static!important;max-height:none!important;width:min(100%,var(--cff-focus-table-width,500px))!important;margin:0 auto!important;padding:0!important;border:0;background:transparent!important}
      body.cff-camp-focus #summary-section>summary,
      body.cff-camp-focus #summary-section .sub-summary-section:not(:has(#table-print-area)),
      body.cff-camp-focus #summary-section .sub-summary-section:has(#table-print-area)>summary,
      body.cff-camp-focus #summary-section .table-edit-toolbar,
      body.cff-camp-focus #summary-section #column-edit-panel,
      body.cff-camp-focus #summary-section .code-actions-grid,
      body.cff-camp-focus #v76-table-view-toolbar,
      body.cff-camp-focus #v93-table-controls-gear-row{display:none!important}
      body.cff-camp-focus #summary-section>.collapsible-content,
      body.cff-camp-focus #summary-section .sub-summary-content{padding:0!important}
      body.cff-camp-focus #summary-section .sub-summary-section:has(#table-print-area){border:0!important;margin:0!important;padding:0!important;background:transparent!important}
      body.cff-camp-focus #v92-table-view-switch{display:flex!important;width:100%!important;box-sizing:border-box;flex-wrap:nowrap!important;gap:8px;margin:0 0 12px!important;position:static!important}
      body.cff-camp-focus #v92-table-view-switch .v76-view-button{flex:1 1 0!important;min-width:0;min-height:36px}
      body.cff-camp-focus .cff-camp-topbar{position:sticky;top:0}
      body.cff-camp-launch-focus>.container>:not(.main-layout){display:none!important}
      body.cff-camp-launch-focus:not(.v81-launch-grid-mode) .main-layout{grid-template-columns:minmax(0,1fr)!important}
      body.cff-camp-launch-focus:not(.v81-launch-grid-mode) #summary-section{display:none!important}
      body.cff-camp-launch-focus.cff-camp-launch-hide-table .main-layout{display:block!important}
      body.cff-camp-launch-focus.cff-camp-launch-hide-table #summary-section{display:none!important}
      #cff-launch-hide-table-wrap[hidden]{display:none!important}
      #cff-launch-hide-table-wrap{padding:6px 8px;border:1px solid #31485d;border-radius:6px;background:#142130;white-space:nowrap}
      @container(max-width:720px){
        .summary-section .summary-main-controls>label.switch{grid-column:span 6}
        .summary-section .summary-main-controls>div.cff-visual-field{grid-column:span 6}
        .summary-section .summary-main-controls>#v90-champion-activated-logos-row{grid-column:1/-1;min-height:40px}
      }
      @media(max-width:1250px){body .main-layout{grid-template-columns:minmax(0,1fr)!important}}
      @media(max-width:980px){
        body.v81-launch-grid-mode .main-layout,
        body.v41-tournament-mode.v81-launch-grid-mode .main-layout,
        body.v81-launch-grid-mode.v81-launch-grid-wide .main-layout,
        body.v41-tournament-mode.v81-launch-grid-mode.v81-launch-grid-wide .main-layout{grid-template-columns:minmax(0,1fr)!important}
        body.v81-launch-grid-mode #summary-section{position:static;max-height:none}
      }
      @media(max-width:760px){
        .summary-section .summary-main-controls>label.switch{white-space:normal}
        .summary-section .summary-main-controls>div.cff-visual-field{grid-column:1/-1}
        #teams-inputs-container.v46-simple-placement-enabled .team-row.detailed-row,
        body.v41-simple-mode #teams-inputs-container.v46-simple-placement-enabled .team-row.detailed-row{grid-template-columns:50px minmax(50px,1fr) 30px!important}
        #teams-inputs-container.v46-simple-placement-enabled .team-row.detailed-row>.v46-placement-grid{grid-column:1/-1;grid-row:3}
        #teams-inputs-container.v46-simple-placement-enabled .team-row.detailed-row>.slot-actions{grid-column:3;grid-row:2}
        .container{width:calc(100% - 12px)!important;padding:12px!important}
        .cff-drop-primary-row{grid-template-columns:1fr!important}
        .summary-section .code-actions-grid{grid-template-columns:1fr}
        body.v81-launch-grid-mode #teams-inputs-container.v81-launch-grid{grid-template-columns:minmax(0,1fr)!important;overflow:visible!important}
        body.v81-launch-grid-mode #teams-inputs-container.v81-launch-grid>.team-row{min-width:0!important}
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
    const cpLabel=$('#v90-champion-activated-logos-row');
    cpLabel?.childNodes.forEach(node=>{
      if(node.nodeType===Node.TEXT_NODE&&node.textContent.includes('Mostrar logos do Champion Point'))node.textContent=' Logos do Champion Point';
    });
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
    const styleField=$('#summary-table-style')?.closest('.summary-style-control');
    const spacingField=$('#table-spacing')?.parentElement;
    styleField?.classList.add('cff-visual-field');
    spacingField?.classList.add('cff-visual-field');
    const dropNum=$('#drop-num');
    if(dropNum){
      const row=dropNum.parentElement?.parentElement;
      if(row&&row.querySelector('#input-mode')&&row.querySelector('#drop-map')){
        row.classList.add('cff-drop-primary-row');
        // Keep the original inline sizing as a fallback; CSS handles this row.
      }
    }
    document.querySelectorAll('#teams-inputs-container>*').forEach(card=>card.classList.add('cff-team-entry'));
    organizeLaunchOptions();
    refreshLaunchColors();
    compactInputLabels();
    applyLaunchDesign();
    layoutPlacementRows();
    syncLaunchEditorPreview();
    fitGridTableSlot();
  }

  function compactInputLabels(){
    const mode=$('#input-mode')?.value||'per-drop';
    const simpleKills=$('#drop-opt-simple-kills')?.checked===true;
    const modes={
      'per-drop':simpleKills?'Pts + abates da queda':'Pts da queda','per-drop-cumulative-kills':'Pts + abates acum.',
      'cumulative':simpleKills?'Pts acum. + abates acum.':'Pts acumulados','detail-pos-kills':'Abates + posição',
      'detail-points-kills':'Abates + pts colocação','detail-cumulative-kills':'Abates acum. + pts acum.',
      'detail-pos-total':'Posição + pts acum.','detail-pos-drop-points':'Posição + pts da queda'
    };
    document.querySelectorAll('#input-mode option').forEach(option=>{
      const text=modes[option.value];
      if(text&&option.textContent!==text){if(!option.title)option.title=option.textContent;option.textContent=text}
    });
    document.querySelectorAll('#teams-inputs-container .small-cell').forEach(cell=>{
      const label=cell.querySelector('.micro-label'),input=cell.querySelector('input[id]');
      if(!label||!input)return;
      let text;
      if(input.id.startsWith('place-'))text='POSIÇÃO';
      else if(input.id.startsWith('kills-'))text=mode.includes('cumulative')?'ABAT. AC.':'ABATES';
      else if(input.id.startsWith('start-'))text='PTS INIC.';
      else if(input.id.startsWith('pts-'))text=mode==='detail-points-kills'?'PTS COL.':mode==='cumulative'||mode==='detail-cumulative-kills'||mode==='detail-pos-total'?'PTS ACUM.':'PTS';
      if(text&&label.textContent!==text){if(!label.title)label.title=label.textContent;label.textContent=text}
    });
  }

  const LAUNCH_HIDE_TABLE_KEY='cff_camp_launch_hide_table_v1';
  let launchTableHidden=(()=>{try{return localStorage.getItem(LAUNCH_HIDE_TABLE_KEY)==='1'}catch(_){return false}})();
  function syncLaunchTableVisibility(){
    const active=document.body.classList.contains('cff-camp-launch-focus');
    document.body.classList.toggle('cff-camp-launch-hide-table',launchTableHidden);
    const wrap=$('#cff-launch-hide-table-wrap');if(wrap)wrap.hidden=!active;
    const input=$('#cff-launch-hide-table');if(input){input.checked=launchTableHidden;input.disabled=launchEditorOpen}
  }

  function fitGridTableSlot(){
    const layout=$('.main-layout'),table=$('#summary-section #table-print-area table');
    if(!layout||!table)return;
    // The print-width control writes a fixed width inline. Fit that table's slot,
    // rather than stretching its black canvas across a fraction of the workspace.
    const fixedWidth=/^\d+(?:\.\d+)?px$/.test(table.style.width);
    const width=fixedWidth?Math.ceil(table.getBoundingClientRect().width):500;
    if(!width)return;
    const value=(width+20)+'px';
    if(layout.style.getPropertyValue('--cff-grid-table-slot-width')!==value){
      layout.style.setProperty('--cff-grid-table-slot-width',value);
    }
    if(document.body.classList.contains('cff-camp-focus'))fitFocusedTable();
    const title=$('#summary-section #table-print-area .table-title-box');
    // Recompute a title left over from the wider canvas, so its drop badge fits too.
    if(document.body.classList.contains('v81-launch-grid-mode')&&title&&Math.abs(title.getBoundingClientRect().width-table.getBoundingClientRect().width)>1)window.syncTableHeaderWidth?.({updateUi:false});
  }

  function fitFocusedTable(){
    const section=$('#summary-section'),table=$('#summary-section #table-print-area table');
    const width=table?.getBoundingClientRect().width;
    if(section&&width){
      const value=Math.ceil(width)+'px';
      if(section.style.getPropertyValue('--cff-focus-table-width')!==value)section.style.setProperty('--cff-focus-table-width',value);
    }
  }

  const LAUNCH_COLORS_KEY='cff_camp_launch_colors_v1';
  const LAUNCH_PALETTE=['#275ba3','#7948a7','#a83b58','#a56325','#27815b','#277d91','#684db5','#986024','#397444','#9d417f','#386d91','#86722a','#4b548c','#875b46','#347b76','#863e48'];
  function normalizeLaunchColors(value){
    const colors=Object.create(null);
    Object.entries(value?.colors||{}).forEach(([code,color])=>{
      if(code&&/^#[0-9a-f]{6}$/i.test(String(color)))colors[code]=color;
    });
    return {customize:value?.customize===true,colors};
  }
  let launchColors=(()=>{
    try{
      const backup=JSON.parse(localStorage.getItem('ffws_autosave')||'null');
      return normalizeLaunchColors(backup?.config?.cffLaunchColorsV1||JSON.parse(localStorage.getItem(LAUNCH_COLORS_KEY)||'null'));
    }catch(_){return normalizeLaunchColors(null)}
  })();
  function saveLaunchColors(saveCamp=false){
    try{localStorage.setItem(LAUNCH_COLORS_KEY,JSON.stringify(launchColors))}catch(_){toast('Não foi possível salvar as cores neste navegador.','err')}
    if(saveCamp&&window.__CFF_CAMP_READY__===true)window.autoSave?.(true);
  }
  function launchTeamCode(row){
    // Historical sort patches may leave a stale row dataset. Scoring inputs own the team identity.
    return row.querySelector('input[id^="kills-"],input[id^="pts-"],input[id^="place-"],input[id^="start-"]')?.id.replace(/^(kills|pts|place|start)-/,'')||row.querySelector('input[name="booyah"]')?.value||row.dataset.teamCode||'';
  }
  function extraLaunchColor(index){
    return '#'+[0,120,240].map(offset=>Math.round(90+45*Math.sin((index*137.5+offset)*Math.PI/180)).toString(16).padStart(2,'0')).join('');
  }
  function colorInk(color){
    const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    const luminance=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
    return luminance>.179?'#0b1320':'#ffffff';
  }
  function refreshLaunchColors(){
    const container=$('#teams-inputs-container');
    if(!container)return;
    container.classList.toggle('cff-custom-colors',launchColors.customize);
    let added=false;
    container.querySelectorAll('.team-row').forEach(row=>{
      const code=launchTeamCode(row),header=row.querySelector(':scope>.team-flex');
      if(!code||!header)return;
      if(!launchColors.colors[code]){
        // The saved team code, rather than its position in a sorted list, owns the color.
        const used=new Set(Object.values(launchColors.colors));
        let color=LAUNCH_PALETTE.find(value=>!used.has(value)),index=used.size;
        while(!color||used.has(color))color=extraLaunchColor(index++);
        launchColors.colors[code]=color;
        added=true;
      }
      const color=launchColors.colors[code];
      if(row.style.getPropertyValue('--cff-team-color')!==color){
        row.style.setProperty('--cff-team-color',color);
        row.style.setProperty('--cff-team-ink',colorInk(color));
      }
      let picker=header.querySelector('.cff-color-picker');
      if(picker&&picker.dataset.cffColorTeam!==code){picker.remove();picker=null}
      if(!picker){
        picker=document.createElement('label');picker.className='cff-color-picker';
        picker.dataset.cffColorTeam=code;
        const name=teamRows().find(t=>t.code===code)?.name||code;
        picker.title='Personalizar cor de '+name;
        picker.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.7 2.3a1 1 0 0 0-1.4 0L9 12.6l2.4 2.4L21.7 4.7a1 1 0 0 0 0-1.4l-1-1zM7.5 14C4 14 6 19 2 20c5 2 9-1 9-3.5A3.5 3.5 0 0 0 7.5 14z"/></svg><input type="color">';
        const input=picker.querySelector('input');
        input.setAttribute('aria-label',picker.title);
        input.addEventListener('input',event=>{
          event.stopPropagation();
          launchColors.colors[code]=input.value;refreshLaunchColors();saveLaunchColors();
        });
        input.addEventListener('change',event=>{event.stopPropagation();saveLaunchColors(true)});
        picker.addEventListener('click',event=>event.stopPropagation());
        const nameNode=Array.from(header.children).find(el=>el.tagName==='SPAN'&&!el.classList.contains('team-quick-actions-v28'));
        if(nameNode)nameNode.insertAdjacentElement('afterend',picker);else header.appendChild(picker);
      }
      const input=picker.querySelector('input');
      if(input.value!==color)input.value=color;
    });
    if(added)saveLaunchColors();
    const toggle=$('#cff-customize-colors');if(toggle)toggle.checked=launchColors.customize;
  }
  function organizeLaunchOptions(){
    const panel=$('#drop-settings-panel');if(!panel)return;
    if(!$('#cff-hide-clear-slot')){
      const row=document.createElement('label');row.id='cff-clear-slot-row';row.className='switch';
      row.innerHTML='LIMPAR SLOT <input type="checkbox" id="cff-hide-clear-slot">';
      row.querySelector('input').checked=launchDesign.hideClearSlot;
      row.querySelector('input').addEventListener('change',event=>{launchDesign.hideClearSlot=event.target.checked;applyLaunchDesign();saveLaunchDesign(true)});
      panel.appendChild(row);
    }
    if(!$('#cff-launch-edit-mode')){
      const edit=document.createElement('button');edit.id='cff-launch-edit-mode';edit.type='button';edit.className='btn-mini';edit.textContent='MODO EDIÇÃO';
      edit.setAttribute('aria-controls','cff-launch-editor');edit.setAttribute('aria-expanded','false');
      edit.addEventListener('click',()=>{window.toggleDropSettingsPanel?.(false);setLaunchEditorOpen(!launchEditorOpen)});
      panel.appendChild(edit);
    }
    if(!$('#cff-customize-colors')){
      const row=document.createElement('label');row.id='cff-customize-colors-row';row.className='switch';
      row.innerHTML='Personalizar cor <input type="checkbox" id="cff-customize-colors">';
      row.title='Mostra o pincel ao lado do nome de cada time. As cores continuam aplicadas ao desativar.';
      row.querySelector('input').addEventListener('change',event=>{
        launchColors.customize=event.target.checked;refreshLaunchColors();saveLaunchColors(true);
      });
      panel.appendChild(row);
      const auto=document.createElement('button');auto.id='cff-auto-colors';auto.type='button';auto.className='btn-mini';auto.textContent='🎲 Cores auto';
      auto.title='Sortear novas cores para os cabeçalhos de todos os times desta lista.';
      auto.addEventListener('click',()=>{
        const cards=Array.from(document.querySelectorAll('#teams-inputs-container .team-row'));
        const codes=[...new Set(cards.map(launchTeamCode).filter(Boolean))];
        const palette=Array.from({length:Math.max(codes.length,LAUNCH_PALETTE.length)},(_,i)=>LAUNCH_PALETTE[i]||extraLaunchColor(i));
        // Shuffle once per click; scrolling, sorting and reloads never reroll colors.
        for(let i=palette.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[palette[i],palette[j]]=[palette[j],palette[i]];}
        codes.forEach((code,i)=>launchColors.colors[code]=palette[i]);
        refreshLaunchColors();saveLaunchColors(true);
      });
      panel.appendChild(auto);
    }
    const groups=[
      ['entry','Preenchimento',true,['.v32-drop-order-box','#drop-opt-auto-update-row','#drop-opt-simple-placement-row','#drop-opt-simple-kills-row','#drop-opt-count-kills-without-placement-row','#drop-opt-v57-team-score-row','#drop-opt-v81-top12-last-row']],
      ['visual','Cores e visual',true,['#cff-launch-edit-mode','#cff-customize-colors-row','#cff-auto-colors','#drop-opt-v59-short-names-row','#drop-opt-v59-show-logos-row','label:has(#drop-opt-legends)']],
      ['tools','Botões e ferramentas',false,['label:has(#drop-opt-random)','label:has(#drop-opt-clear-maps)','label:has(#drop-opt-clear-placements)','#v34-hide-buttons-panel','#cff-clear-slot-row','#v40-estimator-box','#v95-tournament-csv-tools','#tiebreak-panel-v28']],
      ['clear','Limpar dados',false,['#v33-remove-team-panel','#v38-clear-drops-box']]
    ];
    groups.forEach(([id,title,open,selectors])=>{
      let group=$('#cff-launch-group-'+id);
      if(!group){
        group=document.createElement('details');group.id='cff-launch-group-'+id;group.className='cff-launch-group';group.open=open;
        const heading=document.createElement('summary');heading.textContent=title;
        group.appendChild(heading);const content=document.createElement('div');content.className='cff-launch-options';group.appendChild(content);panel.appendChild(group);
      }
      const content=group.querySelector('.cff-launch-options');
      selectors.forEach(selector=>{
        const option=panel.querySelector(selector);if(option&&option.parentElement!==content)content.appendChild(option);
      });
    });
    const names={
      'drop-opt-auto-update':'Atualizar tabelas ao vivo','drop-opt-simple-placement':'Colocação simples',
      'drop-opt-count-kills-without-placement':'Contar abates sem colocação','drop-opt-v57-team-score':'Ajuste manual de abates',
      'drop-opt-v81-top12-last':'Posições definidas no fim da lista','drop-opt-v59-short-names':'Nome curto dos times',
      'drop-opt-v59-show-logos':'Exibir logos','drop-opt-legends':'Exibir legendas','drop-opt-random':'Mostrar botão de teste',
      'drop-opt-clear-maps':'Mostrar botão de limpar mapas','drop-opt-clear-placements':'Mostrar botão de limpar posições'
    };
    Object.entries(names).forEach(([id,text])=>{
      const label=document.getElementById(id)?.closest('label');
      const node=Array.from(label?.childNodes||[]).find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
      if(node&&!label.classList.contains('cff-eye-control')&&node.textContent.trim()!==text)node.textContent=text+' ';
    });
    syncVisibilityEyes();
  }

  function syncVisibilityEyes(){
    const controls=[
      ['drop-opt-random','Botão de teste',false],['drop-opt-clear-maps','Limpar mapas',false],['drop-opt-clear-placements','Limpar posições',false],
      ['v34-hide-tiebreak','Desempate',true],['v34-hide-options','Opções do time',true],['v34-hide-delete','Apagar time',true],['v34-hide-pause','Pausa',true],
      ['cff-hide-clear-slot','LIMPAR SLOT',true]
    ];
    controls.forEach(([id,name,inverted])=>{
      const input=document.getElementById(id),row=input?.closest('label');if(!row)return;
      row.classList.add('cff-eye-control');input.hidden=true;
      const text=Array.from(row.childNodes).find(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim());
      if(text&&text.textContent.trim()!==name)text.textContent=name+' ';
      let button=row.querySelector('.cff-visibility-eye');
      if(!button){
        button=document.createElement('button');button.type='button';button.className='cff-visibility-eye';button.dataset.cffVisibilityTarget=id;
        button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();input.checked=!input.checked;input.dispatchEvent(new Event('change',{bubbles:true}));syncVisibilityEyes()});
        row.appendChild(button);
      }
      const visible=inverted?!input.checked:input.checked;
      const action=(visible?'Ocultar ':'Mostrar ')+name;
      button.title=action;button.setAttribute('aria-label',action);button.setAttribute('aria-pressed',String(!visible));
      if(button.dataset.visible!==String(visible)){
        button.dataset.visible=String(visible);
        button.innerHTML=visible?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a20 20 0 0 1-3.2 4.1M6.1 6.2A20 20 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.1-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
      }
    });
  }

  function layoutPlacementRows(){
    const count=Number(launchDesign.simpleRows)||2;
    const set=(element,name,value)=>{if(element.style.getPropertyValue(name)!==String(value))element.style.setProperty(name,value)};
    document.querySelectorAll('#teams-inputs-container .team-row').forEach(row=>{
      const grid=row.querySelector(':scope>.v46-placement-grid');
      row.classList.toggle('cff-placement-paired',!!grid);if(!grid)return;
      const choices=Array.from(grid.querySelectorAll('.v46-placement-choice'));
      if(!choices.length)return;
      if(grid.dataset.cffPlacementRows!==String(count)){
        grid.querySelectorAll(':scope>.cff-placement-line').forEach(line=>line.remove());
        const rows=Math.min(count,choices.length),base=Math.floor(choices.length/rows),extra=choices.length%rows;
        let offset=0;
        for(let index=0;index<rows;index++){
          const length=base+(index<extra?1:0),line=document.createElement('div');line.className='cff-placement-line';
          line.style.setProperty('--cff-placement-count',length);line.style.setProperty('--cff-placement-row',index+1);
          choices.slice(offset,offset+length).forEach(choice=>line.appendChild(choice));offset+=length;grid.appendChild(line);
        }
        grid.dataset.cffPlacementRows=String(count);
      }
      // Share the card's rows so each pair of extra fields stays beside its placement row.
      const extras=row.querySelector(':scope>.cff-extra-grid'),fields=Array.from(extras?.querySelectorAll('.cff-extra-field')||[]);
      const warning=extras?.querySelector('.cff-extra-warning'),extraRows=Math.ceil(fields.length/2),extraSpan=extraRows+(warning&&!warning.hidden?1:0),rows=Math.max(count,extraSpan+1);
      set(row,'--cff-paired-rows',rows);if(extras)set(extras,'--cff-extra-rows',Math.max(1,extraSpan));
      const widths=[Math.max(launchDesign.fieldWidth,Math.ceil(launchDesign.labelSize*6.5)),Math.max(launchDesign.fieldWidth,Math.ceil(launchDesign.labelSize*6.5))];
      const labels=[Math.max(22,Math.ceil(launchDesign.labelSize*1.5))],heights=[launchDesign.fieldHeight];
      fields.forEach((field,index)=>{
        const input=field.querySelector('input'),label=field.querySelector('.micro-label'),font=parseFloat(getComputedStyle(label).fontSize)||launchDesign.labelSize;
        const width=parseFloat(field.style.getPropertyValue('--cff-extra-width'))||launchDesign.fieldWidth,height=parseFloat(getComputedStyle(input).height)||launchDesign.fieldHeight;
        const fieldRow=Math.floor(index/2)+1,column=index%2;
        widths[column]=Math.max(widths[column],width,Math.ceil(font*6.5));
        labels[fieldRow]=Math.max(labels[fieldRow]||22,Math.ceil(font*1.5));heights[fieldRow]=Math.max(heights[fieldRow]||0,height);
        set(field,'grid-column',column+1);set(field,'grid-row',fieldRow);
      });
      widths.forEach((width,index)=>set(row,'--cff-paired-column-'+(index+1),width+'px'));
      grid.querySelectorAll(':scope>.cff-placement-line').forEach((line,index)=>{
        set(line,'--cff-placement-label-height',(labels[index]||labels[0])+'px');
        set(line,'--cff-placement-choice-height',Math.max(launchDesign.simpleHeight,heights[index]||launchDesign.fieldHeight)+'px');
      });
      if(warning)set(warning,'grid-row',extraRows+1);
    });
  }
  const LAUNCH_DESIGN_KEY='cff_camp_launch_design_v1';
  const LAUNCH_DESIGN_FIELDS=[
    {title:'Nome dos times',fields:[
      {key:'nameSize',label:'Tamanho do nome',min:10,max:26,value:13},
      {key:'nameFont',label:'Fonte do nome',value:'inherit',options:[['inherit','Padrão'],['Arial, sans-serif','Arial'],['"Segoe UI", sans-serif','Segoe UI'],['Verdana, sans-serif','Verdana'],['Georgia, serif','Georgia'],['monospace','Monoespaçada']]},
      {key:'nameWeight',label:'Peso da fonte',value:'inherit',options:[['inherit','Padrão'],['400','Normal'],['600','Seminegrito'],['800','Negrito']]},
      {key:'customNameColor',label:'Personalizar cor da letra',value:false,type:'checkbox'},
      {key:'nameColor',label:'Cor do nome',value:'#ffffff',type:'color'}
    ]},
    {title:'Textos e caixas',fields:[
      {key:'labelSize',label:'Tamanho dos rótulos',min:8,max:16,step:.5,value:9.5},
      {key:'labelColor',label:'Cor dos rótulos',value:'#888888',type:'color'},
      {key:'valueSize',label:'Tamanho dos números',min:12,max:24,value:14},
      {key:'fieldWidth',label:'Largura das caixas',min:45,max:90,value:50},
      {key:'fieldHeight',label:'Altura das caixas',min:28,max:52,value:32},
      {key:'killsSize',label:'Texto dos abates calculados',min:9,max:20,value:11}
    ]},
    {title:'Colocação simples',fields:[
      {key:'simpleSize',label:'Tamanho das posições',min:9,max:20,value:10},
      {key:'simpleHeight',label:'Altura das opções',min:18,max:40,value:22},
      {key:'radioSize',label:'Tamanho das bolinhas',min:10,max:22,value:12},
      {key:'simpleRows',label:'Total de linhas',value:'2',options:Array.from({length:12},(_,i)=>[String(i+1),(i+1)+(i===0?' linha':' linhas')])}
    ]},
    {title:'Colocação normal',fields:[
      {key:'normalSize',label:'Texto do seletor',min:10,max:22,value:12},
      {key:'normalHeight',label:'Altura do seletor',min:26,max:52,value:30},
      {key:'specialSize',label:'Texto Top 12 / Booyah',min:9,max:18,value:11}
    ]},
    {title:'Cards e logos',fields:[
      {key:'cardPadding',label:'Espaço dentro do card',min:4,max:20,value:8},
      {key:'cardGap',label:'Espaço entre os cards',min:4,max:24,value:8},
      {key:'cardRadius',label:'Arredondamento',min:0,max:24,value:9},
      {key:'logoSize',label:'Tamanho das logos',min:16,max:44,value:22},
      {key:'hideClearSlot',label:'LIMPAR SLOT',value:false,type:'checkbox',optionsOnly:true}
    ]}
  ];
  const launchDesignFields=LAUNCH_DESIGN_FIELDS.flatMap(group=>group.fields);
  function normalizeLaunchDesign(value){
    if(value?.simpleRows===undefined&&['3','4','6'].includes(value?.simpleColumns))value={...value,simpleRows:String(12/Number(value.simpleColumns))};
    const design={};
    launchDesignFields.forEach(field=>{
      const candidate=value?.[field.key];
      if(field.options)design[field.key]=field.options.some(([option])=>option===candidate)?candidate:field.value;
      else if(field.type==='color')design[field.key]=/^#[0-9a-f]{6}$/i.test(String(candidate))?candidate:field.value;
      else if(field.type==='checkbox')design[field.key]=candidate===true;
      else{
        const numeric=typeof candidate==='number'&&Number.isFinite(candidate)?candidate:field.value;
        design[field.key]=Math.min(field.max,Math.max(field.min,numeric));
      }
    });
    return design;
  }
  let launchDesign=(()=>{
    try{
      const backup=JSON.parse(localStorage.getItem('ffws_autosave')||'null');
      return normalizeLaunchDesign(backup?.config?.cffLaunchDesignV1||JSON.parse(localStorage.getItem(LAUNCH_DESIGN_KEY)||'null'));
    }catch(_){return normalizeLaunchDesign(null)}
  })();
  let launchEditorOpen=false;
  function saveLaunchDesign(saveCamp=false){
    try{localStorage.setItem(LAUNCH_DESIGN_KEY,JSON.stringify(launchDesign))}
    catch(_){toast('Não foi possível salvar o visual neste navegador.','err')}
    if(saveCamp&&window.__CFF_CAMP_READY__===true)window.autoSave?.(true);
  }
  function applyLaunchDesign(){
    const container=$('#teams-inputs-container');if(!container)return;
    // Leave the original rendering intact until a visual setting is changed.
    container.classList.toggle('cff-launch-design',launchDesignFields.some(field=>!field.optionsOnly&&launchDesign[field.key]!==field.value));
    container.classList.toggle('cff-hide-clear-slot',launchDesign.hideClearSlot);
    const clear=$('#cff-hide-clear-slot');if(clear)clear.checked=launchDesign.hideClearSlot;
    syncVisibilityEyes();
    launchDesignFields.forEach(field=>{
      if(field.type==='checkbox'||field.key==='nameColor')return;
      const value=launchDesign[field.key]+(typeof field.value==='number'?'px':'');
      const property='--cff-launch-'+field.key;
      if(container.style.getPropertyValue(property)!==value)container.style.setProperty(property,value);
    });
    const height=Math.max(22,Math.ceil(launchDesign.labelSize*1.5));
    if(container.style.getPropertyValue('--cff-launch-label-height')!==height+'px')container.style.setProperty('--cff-launch-label-height',height+'px');
    const track=Math.max(launchDesign.fieldWidth,Math.ceil(launchDesign.labelSize*6.5))+'px';
    if(container.style.getPropertyValue('--cff-launch-field-track')!==track)container.style.setProperty('--cff-launch-field-track',track);
    if(launchDesign.customNameColor)container.style.setProperty('--cff-launch-name-ink',launchDesign.nameColor);
    else container.style.removeProperty('--cff-launch-name-ink');
  }
  function syncLaunchEditorControls(){
    launchDesignFields.forEach(field=>{
      const input=$('#cff-launch-design-'+field.key);if(!input)return;
      if(field.type==='checkbox')input.checked=launchDesign[field.key];
      else if(input.value!==String(launchDesign[field.key]))input.value=launchDesign[field.key];
      const output=$('#cff-launch-value-'+field.key);
      if(output)output.textContent=launchDesign[field.key]+' px';
    });
    const color=$('#cff-launch-design-nameColor');if(color)color.disabled=!launchDesign.customNameColor;
  }
  function syncLaunchEditorPreview(){
    const control=$('#cff-launch-preview-placement'),original=$('#drop-opt-simple-placement');
    if(!control)return;
    const mode=$('#input-mode')?.value;
    const supported=$('#game-detail-mode')?.value==='detailed'&&['detail-pos-kills','detail-points-kills','detail-pos-total','detail-pos-drop-points'].includes(mode)&&$('#drop-num')?.value!=='starting';
    control.disabled=!supported||!original;
    control.value=original?.checked?'simple':'normal';
    const hint=$('#cff-launch-preview-note');
    const text=supported?'A prévia usa a colocação selecionada.':'Os ajustes de colocação aparecem nos modos com posição.';
    if(hint&&hint.textContent!==text)hint.textContent=text;
  }
  function setLaunchEditorOpen(open){
    const panel=$('#cff-launch-editor');if(!panel)return;
    if(open&&document.body.classList.contains('cff-camp-focus'))setWorkspaceFocus('launch');
    launchEditorOpen=!!open;
    document.body.classList.toggle('cff-launch-editing',launchEditorOpen);
    panel.hidden=!launchEditorOpen;
    window.toggleDropSettingsPanel?.(false);
    const options=$('.drop-settings-wrap>button');if(options)options.disabled=launchEditorOpen;
    const button=$('#cff-launch-edit-mode');
    button?.setAttribute('aria-expanded',String(launchEditorOpen));
    button?.classList.toggle('is-active',launchEditorOpen);
    if(launchEditorOpen){$('.drop-section')?.setAttribute('open','');syncLaunchEditorControls();syncLaunchEditorPreview();$('#cff-launch-editor-close')?.focus({preventScroll:true})}
    syncLaunchTableVisibility();
    requestAnimationFrame(()=>{markWorkspaceElements();window.syncTableHeaderWidth?.({updateUi:false})});
  }
  function buildLaunchEditor(){
    const layout=$('.main-layout');if(!layout||$('#cff-launch-editor'))return;
    const style=document.createElement('style');style.id='cff-launch-editor-style';
    style.textContent=`
      #cff-launch-editor[hidden]{display:none!important}
      body.cff-launch-editing .main-layout:has(>#cff-launch-editor){display:grid!important;grid-template-columns:minmax(0,1fr) 340px!important;align-items:start}
      body.cff-launch-editing #summary-section{display:none!important}
      body.cff-launch-editing #drop-settings-panel{display:none!important}
      body.cff-launch-editing .drop-settings-wrap>button{opacity:.5;cursor:default}
      body.cff-launch-editing .drop-section{grid-column:1;grid-row:1;min-width:0}
      #cff-launch-editor{grid-column:2;grid-row:1;position:sticky;top:76px;max-height:calc(100dvh - 92px);overflow:auto;box-sizing:border-box;min-width:0;padding:14px;border:1px solid #3b526d;border-radius:10px;background:#101a27;color:#d8e5f5;scrollbar-width:thin}
      #cff-launch-editor .cff-editor-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;position:sticky;top:-14px;padding:8px 0;background:#101a27;z-index:1}
      #cff-launch-editor h3{font-size:.86rem;margin:0;color:#b7dcff}
      #cff-launch-editor p{font-size:.72rem;line-height:1.4;color:#94a9bf;margin:7px 0 12px}
      #cff-launch-editor button{min-height:32px;font-size:.7rem}
      #cff-launch-editor>details{margin-top:10px;border:1px solid #2b4057;border-radius:7px;background:#142131}
      #cff-launch-editor>details>summary{padding:10px;font-size:.76rem;cursor:pointer;color:#bdd9f4}
      #cff-launch-editor .cff-editor-fields{display:grid;gap:13px;padding:5px 10px 12px}
      #cff-launch-editor .cff-editor-control{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:7px;margin:0;min-width:0;font-size:.73rem;line-height:1.3;color:#b9cbe0;text-transform:none;font-weight:400}
      #cff-launch-editor .cff-editor-control output{color:#71caff;font-size:.7rem;min-width:32px;text-align:right}
      #cff-launch-editor .cff-editor-control>input[type="range"],#cff-launch-editor .cff-editor-control>select{grid-column:1/-1;width:100%;min-width:0;box-sizing:border-box;margin:0;height:30px;padding:3px 6px;font-size:.76rem;accent-color:#67b9ff}
      #cff-launch-editor input[type="range"]{cursor:pointer;border:0;background:transparent}
      #cff-launch-editor input[type="color"]{width:42px!important;min-width:42px;height:28px;padding:2px;border:1px solid #47637c;border-radius:5px;cursor:pointer}
      #cff-launch-editor input[type="checkbox"]{width:16px;min-width:16px;height:16px;margin:0;accent-color:#67b9ff}
      #cff-launch-editor input:disabled{opacity:.4;cursor:default}
      #cff-launch-editor .cff-editor-preview{padding:10px;border:1px solid #34506b;border-radius:7px;background:#18283b}
      #cff-launch-editor .cff-editor-preview p{margin-bottom:0}
      #cff-launch-editor-reset{width:100%;margin-top:12px}
      #drop-settings-panel #cff-launch-edit-mode{width:100%;padding:10px;text-align:left;border-color:#5380a8;color:#b6dcff;background:#213950}
      #drop-settings-panel #cff-launch-edit-mode.is-active{border-color:#71caff}
      body #teams-inputs-container.cff-launch-design .team-row.cff-team-entry:has(>.team-flex){padding:var(--cff-launch-cardPadding)!important;border-radius:var(--cff-launch-cardRadius)!important;margin-bottom:var(--cff-launch-cardGap)!important;container-name:cff-launch-card;container-type:inline-size}
      body #teams-inputs-container.cff-launch-design.v81-launch-grid{gap:var(--cff-launch-cardGap)!important}
      body #teams-inputs-container.cff-launch-design.v81-launch-grid>.team-row.cff-team-entry{margin-bottom:0!important}
      #teams-inputs-container.cff-launch-design .team-row>.team-flex>span:not(.team-quick-actions-v28){font-size:var(--cff-launch-nameSize)!important;font-family:var(--cff-launch-nameFont)!important;font-weight:var(--cff-launch-nameWeight)!important;color:var(--cff-launch-name-ink,var(--cff-team-ink,#fff))!important;white-space:nowrap}
      #teams-inputs-container.cff-launch-design .mini-logo{width:var(--cff-launch-logoSize)!important;height:var(--cff-launch-logoSize)!important}
      #teams-inputs-container.cff-launch-design .micro-label{font-size:var(--cff-launch-labelSize)!important;color:var(--cff-launch-labelColor)!important;height:var(--cff-launch-label-height)!important;line-height:var(--cff-launch-label-height)!important}
      #teams-inputs-container.cff-launch-design .small-cell>input[type="number"]{font-size:var(--cff-launch-valueSize)!important;height:var(--cff-launch-fieldHeight)!important;width:var(--cff-launch-fieldWidth)!important;min-width:var(--cff-launch-fieldWidth)!important;max-width:var(--cff-launch-fieldWidth)!important;text-align:center}
      #teams-inputs-container.cff-launch-design .v82-calculated-kills{font-size:var(--cff-launch-killsSize)!important}
      #teams-inputs-container.cff-launch-design .team-row.detailed-row{grid-template-columns:var(--cff-launch-field-track) var(--cff-launch-field-track) minmax(36px,1fr) 32px 30px!important}
      #teams-inputs-container.cff-launch-design.v46-simple-placement-enabled .team-row.detailed-row,
      body.v41-simple-mode #teams-inputs-container.cff-launch-design.v46-simple-placement-enabled .team-row.detailed-row{grid-template-columns:var(--cff-launch-field-track) var(--cff-launch-field-track) minmax(0,1fr) 30px!important}
      #teams-inputs-container.cff-launch-design .v46-placement-grid{grid-template-columns:minmax(0,1fr)!important}
      #teams-inputs-container.cff-launch-design .v46-placement-title{font-size:var(--cff-launch-labelSize)!important;color:var(--cff-launch-labelColor)!important}
      #teams-inputs-container.cff-launch-design .v46-placement-choice{font-size:var(--cff-launch-simpleSize)!important;min-height:var(--cff-launch-simpleHeight)!important;box-sizing:border-box}
      #teams-inputs-container.cff-launch-design .v46-placement-choice input{width:var(--cff-launch-radioSize)!important;height:var(--cff-launch-radioSize)!important;min-width:var(--cff-launch-radioSize)!important;max-width:var(--cff-launch-radioSize)!important;min-height:var(--cff-launch-radioSize)!important;flex-basis:var(--cff-launch-radioSize)!important}
      #teams-inputs-container.cff-launch-design .position-helper select{font-size:var(--cff-launch-normalSize)!important;height:var(--cff-launch-normalHeight)!important;box-sizing:border-box}
      #teams-inputs-container.cff-launch-design .top12-cell{font-size:var(--cff-launch-specialSize)!important}
      @container cff-launch-card (max-width:500px){
        #teams-inputs-container.cff-launch-design.v46-simple-placement-enabled .team-row.detailed-row>.v46-placement-grid{grid-column:1/-1!important;grid-row:3!important}
        #teams-inputs-container.cff-launch-design.v46-simple-placement-enabled .team-row.detailed-row>.slot-actions{grid-column:-2!important;grid-row:2!important}
      }
      #teams-inputs-container#teams-inputs-container .team-row.cff-placement-paired{grid-template-columns:var(--cff-paired-column-1) var(--cff-paired-column-2) minmax(0,1fr) 30px!important;align-items:start}
      #teams-inputs-container#teams-inputs-container .team-row.cff-placement-paired>.team-flex{grid-row:1!important}
      #teams-inputs-container#teams-inputs-container .team-row.cff-placement-paired>.small-cell{grid-row:2}
      #teams-inputs-container#teams-inputs-container .team-row.cff-placement-paired>.v46-placement-grid{position:relative;grid-column:3!important;grid-row:2 / span var(--cff-paired-rows)!important;display:grid;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:subgrid!important;padding:0!important;gap:inherit!important;border:0;background:transparent;align-items:stretch}
      #teams-inputs-container#teams-inputs-container .cff-placement-paired .v46-placement-title{position:absolute;top:0;left:0;right:0;height:22px;margin:0;line-height:22px;font-size:var(--cff-launch-labelSize,9.5px)!important}
      #teams-inputs-container#teams-inputs-container .cff-placement-paired .cff-placement-line{grid-row:var(--cff-placement-row);padding-top:var(--cff-placement-label-height);align-items:start;align-self:stretch;box-sizing:border-box;overflow-x:auto;grid-template-columns:repeat(var(--cff-placement-count),minmax(max-content,1fr));gap:1px}
      #teams-inputs-container#teams-inputs-container .cff-placement-paired .cff-placement-line>.v46-placement-choice{min-height:var(--cff-placement-choice-height)!important}
      #teams-inputs-container#teams-inputs-container .team-row.cff-placement-paired>.slot-actions{grid-column:4!important;grid-row:2!important}
      #teams-inputs-container#teams-inputs-container .team-row.cff-placement-paired>.cff-extra-grid{grid-column:1/3!important;grid-row:3 / span var(--cff-extra-rows);display:grid!important;grid-template-columns:subgrid;grid-template-rows:subgrid;gap:inherit;padding:0;border:0;align-items:start}
      #teams-inputs-container#teams-inputs-container .cff-placement-paired .cff-extra-field{align-self:start}
      #teams-inputs-container#teams-inputs-container .cff-placement-paired .cff-extra-warning{grid-column:1/-1}
      @media(max-width:760px){
        #teams-inputs-container#teams-inputs-container .team-row.cff-placement-paired{grid-template-columns:var(--cff-paired-column-1) var(--cff-paired-column-2) minmax(0,1fr)!important}
        #teams-inputs-container#teams-inputs-container .team-row.cff-placement-paired>.slot-actions{grid-column:3!important;grid-row:1!important;justify-self:end;z-index:1}
        #teams-inputs-container#teams-inputs-container .team-row.cff-placement-paired>.team-flex{padding-right:38px!important}
        #teams-inputs-container#teams-inputs-container:not(.cff-launch-design) .cff-placement-paired .v46-placement-choice{font-size:8px!important;gap:1px!important}
        #teams-inputs-container#teams-inputs-container:not(.cff-launch-design) .cff-placement-paired .v46-placement-choice input{width:10px!important;min-width:10px!important;max-width:10px!important;height:10px!important;min-height:10px!important;flex-basis:10px!important}
      }
      @media(max-width:1250px){body.cff-launch-editing #teams-inputs-container.v81-launch-grid{grid-template-columns:minmax(0,1fr)!important}}
      @media(max-width:980px){
        body.cff-launch-editing .main-layout:has(>#cff-launch-editor){grid-template-columns:minmax(0,1fr)!important}
        body.cff-launch-editing .drop-section{grid-column:1;grid-row:2}
        #cff-launch-editor{grid-column:1;grid-row:1;top:65px;max-height:40dvh;z-index:10}
      }
      @media(max-width:760px){
        #teams-inputs-container.cff-launch-design .team-row.detailed-row{grid-template-columns:var(--cff-launch-field-track) minmax(var(--cff-launch-field-track),1fr) 30px!important}
        #teams-inputs-container.cff-launch-design.v46-simple-placement-enabled .team-row.detailed-row,
        body.v41-simple-mode #teams-inputs-container.cff-launch-design.v46-simple-placement-enabled .team-row.detailed-row{grid-template-columns:var(--cff-launch-field-track) minmax(var(--cff-launch-field-track),1fr) 30px!important}
      }
    `;
    document.head.appendChild(style);
    const panel=document.createElement('aside');panel.id='cff-launch-editor';panel.hidden=true;panel.setAttribute('aria-label','Modo edição do lançar quedas');
    panel.innerHTML='<div class="cff-editor-heading"><h3>MODO EDIÇÃO</h3><button type="button" class="btn-mini" id="cff-launch-editor-close">Concluir</button></div><p>Prévia ao vivo · ajustes salvos automaticamente</p><div class="cff-editor-preview"><label class="cff-editor-control" for="cff-launch-preview-placement"><span>Colocação na prévia</span><select id="cff-launch-preview-placement"><option value="simple">Simples · bolinhas</option><option value="normal">Normal · seletor</option></select></label><p id="cff-launch-preview-note"></p></div>';
    LAUNCH_DESIGN_FIELDS.forEach((group,index)=>{
      const section=document.createElement('details');section.open=index<2;
      const summary=document.createElement('summary');summary.textContent=group.title;section.appendChild(summary);
      const fields=document.createElement('div');fields.className='cff-editor-fields';section.appendChild(fields);
      group.fields.forEach(field=>{
        if(field.optionsOnly)return;
        const label=document.createElement('label');label.className='cff-editor-control';label.htmlFor='cff-launch-design-'+field.key;
        const title=document.createElement('span');title.textContent=field.label;label.appendChild(title);
        const input=document.createElement(field.options?'select':'input');input.id=label.htmlFor;input.dataset.cffLaunchField=field.key;
        if(field.options)field.options.forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;input.appendChild(option)});
        else{
          input.type=field.type||'range';
          if(!field.type){input.min=field.min;input.max=field.max;input.step=field.step||1;const output=document.createElement('output');output.id='cff-launch-value-'+field.key;output.htmlFor=input.id;label.appendChild(output)}
        }
        label.appendChild(input);fields.appendChild(label);
      });
      panel.appendChild(section);
    });
    const reset=document.createElement('button');reset.id='cff-launch-editor-reset';reset.type='button';reset.className='btn-mini';reset.textContent='Restaurar visual padrão';panel.appendChild(reset);
    layout.appendChild(panel);
    panel.querySelector('#cff-launch-editor-close').addEventListener('click',()=>{setLaunchEditorOpen(false);$('#cff-launch-edit-mode')?.focus({preventScroll:true})});
    panel.querySelector('#cff-launch-preview-placement').addEventListener('change',event=>{
      const target=$('#drop-opt-simple-placement');if(!target)return;
      target.checked=event.target.value==='simple';target.dispatchEvent(new Event('change',{bubbles:true}));
      requestAnimationFrame(markWorkspaceElements);
    });
    panel.addEventListener('input',event=>{
      const key=event.target.dataset.cffLaunchField;if(!key)return;
      const field=launchDesignFields.find(field=>field.key===key);if(!field)return;
      launchDesign=normalizeLaunchDesign({...launchDesign,[key]:field.type==='checkbox'?event.target.checked:typeof field.value==='number'?Number(event.target.value):event.target.value});
      applyLaunchDesign();layoutPlacementRows();syncLaunchEditorControls();saveLaunchDesign();
      clearTimeout(saveLaunchDesign._timer);saveLaunchDesign._timer=setTimeout(()=>saveLaunchDesign(true),180);
    });
    panel.addEventListener('change',event=>{if(event.target.dataset.cffLaunchField){clearTimeout(saveLaunchDesign._timer);saveLaunchDesign(true)}});
    reset.addEventListener('click',()=>{launchDesign=normalizeLaunchDesign(null);applyLaunchDesign();layoutPlacementRows();syncLaunchEditorControls();saveLaunchDesign(true);toast('Visual padrão restaurado.')});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&launchEditorOpen){setLaunchEditorOpen(false);event.preventDefault()}});
    syncLaunchEditorControls();
  }

  function installLaunchColorBackup(){
    const collect=window.collectBackupData;
    if(typeof collect==='function'){
      window.collectBackupData=function(){
        const data=collect.apply(this,arguments);data.config=data.config||{};
        data.config.cffLaunchColorsV1=JSON.parse(JSON.stringify(launchColors));
        data.config.cffLaunchDesignV1={...launchDesign};return data;
      };
    }
    const importer=window.importBackup;
    if(typeof importer==='function'){
      window.importBackup=function(){
        let data;try{data=JSON.parse($('#backup-input')?.value||'')}catch(_){}
        const result=importer.apply(this,arguments);
        if(data?.config?.cffLaunchColorsV1){
          launchColors=normalizeLaunchColors(data.config.cffLaunchColorsV1);
          refreshLaunchColors();saveLaunchColors(true);
        }
        if(data?.config){
          launchDesign=normalizeLaunchDesign(data.config.cffLaunchDesignV1);
          applyLaunchDesign();syncLaunchEditorControls();saveLaunchDesign(true);
        }
        return result;
      };
    }
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
    document.addEventListener('click',event=>{if(event.target.closest?.('[data-v81-view]'))refresh()},{passive:true});
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
  function setWorkspaceFocus(mode){
    if(mode==='tables')setLaunchEditorOpen(false);
    if(mode==='tables'){
      $('#summary-section')?.setAttribute('open','');
      $('#table-print-area')?.closest('details')?.setAttribute('open','');
      fitFocusedTable();
    }
    if(mode==='launch')$('.drop-section')?.setAttribute('open','');
    document.body.classList.toggle('cff-camp-focus',mode==='tables');
    document.body.classList.toggle('cff-camp-launch-focus',mode==='launch');
    syncLaunchTableVisibility();
    try{localStorage.setItem(FOCUS_KEY,mode==='tables'?'1':mode==='launch'?'launch':'0')}catch(_){}
    const btn=$('#cff-camp-focus');if(btn){const active=mode==='tables';btn.classList.toggle('is-active',active);btn.textContent=active?'← Sair do foco':'▦ Foco nas tabelas';btn.title=active?'Voltar ao painel completo':'Mostrar apenas Tabela do dia e Tabela geral quando disponível';btn.setAttribute('aria-pressed',String(active))}
    const launch=$('#cff-camp-launch-focus');if(launch){const active=mode==='launch';launch.classList.toggle('is-active',active);launch.textContent=active?'← Sair do foco de quedas':'Foco no lançar quedas';launch.setAttribute('aria-pressed',String(active))}
    requestAnimationFrame(()=>{markWorkspaceElements();window.syncTableHeaderWidth?.({updateUi:false})});
  }
  function wireToolbar(){
    document.querySelectorAll('[data-cff-preset]').forEach(btn=>btn.addEventListener('click',()=>loadPreset(btn.dataset.cffPreset,true)));
    $('#cff-camp-import')?.addEventListener('click',()=>$('#cff-camp-file')?.click());
    $('#cff-camp-file')?.addEventListener('change',e=>{const file=e.target.files?.[0];if(file)importFile(file);e.target.value=''});
    $('#cff-camp-download')?.addEventListener('click',()=>window.downloadBackupJson?.());
    $('#cff-camp-focus')?.addEventListener('click',()=>setWorkspaceFocus(document.body.classList.contains('cff-camp-focus')?'none':'tables'));
    $('#cff-camp-launch-focus')?.addEventListener('click',()=>setWorkspaceFocus(document.body.classList.contains('cff-camp-launch-focus')?'none':'launch'));
    $('#cff-launch-hide-table')?.addEventListener('change',event=>{
      launchTableHidden=event.target.checked;
      try{localStorage.setItem(LAUNCH_HIDE_TABLE_KEY,launchTableHidden?'1':'0')}catch(_){}
      syncLaunchTableVisibility();
      requestAnimationFrame(markWorkspaceElements);
    });
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
    openLaunchEditor(){setLaunchEditorOpen(true)},
    meaningfulAutosave,
    updateSaveState
  };

  function boot(){
    installLaunchColorBackup();
    injectCampFixStyles();
    injectWorkspacePolishStyles();
    buildLaunchEditor();
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
    const focus=localStorage.getItem(FOCUS_KEY);
    setWorkspaceFocus(focus==='1'?'tables':focus==='launch'?'launch':'none');
    [250,700,1500].forEach(delay=>setTimeout(()=>{patchLogoResolver();buildLogoBank();applyRepoLogosToRows();renderLogoBank();},delay));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
