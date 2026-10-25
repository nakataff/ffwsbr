(function(){
  'use strict';

  if(window.__CFF_CAMP_INTEGRATIONS_V1__) return;
  window.__CFF_CAMP_INTEGRATIONS_V1__=true;

  const ADMIN_EMAIL='admin@centralfreefire.com.br';
  const FFWS_ROOT='ffwsLive/2026-s2';
  const LIVE_META_KEY='cff_camp_live_import_meta_v1';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const slugify=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100);
  const vals=v=>Array.isArray(v)?v.filter(Boolean):Object.values(v||{}).filter(Boolean);

  const SECOND_BONUS={
    LOS:50,'LOUD SNICKERS':42,'FLUXO W7M':35,INTZ:29,'TEAM SOLID':24,'RISE GAMING':19,
    ALPHA7:15,'RUSH GAMING':11,'INFLUENCE RAGE':8,'CPT VOX':5,AFROGAMES:2,'SX TET':0
  };
  const STAGE_META={
    segundaFase:{label:'Segunda Fase',days:6,dropsByDay:{1:6,2:6,3:6,4:6,5:6,6:6},starting:true},
    final:{label:'Final',days:2,dropsByDay:{1:6,2:null},starting:false}
  };

  let lastLiveImport=null;
  let firebasePromise=null;

  function toast(message,type='ok'){
    if(window.CFF_CAMP?.toast) return window.CFF_CAMP.toast(message,type);
    console[type==='err'?'error':'log']('[Camp]',message);
  }
  function setStatus(text,tone=''){
    const el=$('#cff-camp-integration-status');
    if(!el)return;
    el.textContent=text||'';
    el.dataset.tone=tone||'';
  }
  function dbBase(){return String(window.CFF_CONFIG?.firebase?.databaseURL||'').replace(/\/$/,'')}

  function injectStyles(){
    if($('#cff-camp-integrations-style'))return;
    const style=document.createElement('style');style.id='cff-camp-integrations-style';
    style.textContent=`
      .cff-camp-integrations{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:9px;align-items:center;width:100%;margin-top:10px;padding-top:10px;border-top:1px solid rgba(118,164,208,.14)}
      .cff-camp-integration-copy{min-width:0}.cff-camp-integration-copy strong{display:block;color:#eaf7ff;font-size:.74rem;text-transform:uppercase;letter-spacing:.55px}.cff-camp-integration-copy small{display:block;margin-top:3px;color:#7895b1;font-size:.66rem;line-height:1.35}
      #cff-camp-integration-status[data-tone="ok"]{color:#7eeab4}#cff-camp-integration-status[data-tone="warn"]{color:#ffd06a}#cff-camp-integration-status[data-tone="err"]{color:#ff9ca9}
      .cff-camp-modal{position:fixed;inset:0;z-index:40000;display:grid;place-items:center;padding:18px;background:rgba(2,6,12,.78);backdrop-filter:blur(5px)}
      .cff-camp-modal[hidden]{display:none!important}.cff-camp-modal-card{width:min(920px,calc(100vw - 36px));max-height:calc(100vh - 36px);overflow:auto;border:1px solid rgba(80,184,255,.25);border-radius:18px;background:#0b1420;box-shadow:0 28px 90px rgba(0,0,0,.58)}
      .cff-camp-modal-head{position:sticky;top:0;z-index:2;display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:15px 17px;border-bottom:1px solid rgba(255,255,255,.08);background:#0b1420f2;backdrop-filter:blur(12px)}
      .cff-camp-modal-head h2{margin:2px 0 0;font-size:1.05rem}.cff-camp-modal-head p{margin:5px 0 0;color:#7f9ab6;font-size:.72rem;line-height:1.45}.cff-camp-modal-close{width:38px;height:38px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:#15202d;color:#fff;font-weight:1000;cursor:pointer}
      .cff-camp-modal-body{display:grid;gap:13px;padding:16px}.cff-camp-publish-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.cff-camp-publish-grid.is-mvp{grid-template-columns:repeat(5,minmax(0,1fr))}
      .cff-camp-modal label{display:grid;gap:5px;color:#a8bed4;font-size:.68rem;font-weight:900;text-transform:uppercase;letter-spacing:.45px}.cff-camp-modal input,.cff-camp-modal select{min-width:0;height:40px;box-sizing:border-box;border:1px solid #29405a;border-radius:9px;background:#07101a;color:#fff;padding:0 10px;font:800 .76rem/1 system-ui}.cff-camp-modal input:focus,.cff-camp-modal select:focus{outline:2px solid rgba(0,200,255,.35);border-color:#00c8ff}
      .cff-camp-modal-section{padding:13px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(255,255,255,.018)}.cff-camp-modal-section h3{margin:0 0 10px;color:#fff;font-size:.78rem;text-transform:uppercase;letter-spacing:.5px}
      .cff-camp-modal-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}.cff-camp-modal-note{margin:0;color:#7f9ab6;font-size:.69rem;line-height:1.5}.cff-camp-modal-message{min-height:18px;margin:0;color:#8aa4bf;font-size:.71rem;font-weight:800}.cff-camp-modal-message.ok{color:#7eeab4}.cff-camp-modal-message.err{color:#ff9ca9}
      .cff-camp-live-preview{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.cff-camp-live-stat{padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#07101a}.cff-camp-live-stat span{display:block;color:#7793af;font-size:.58rem;font-weight:900;text-transform:uppercase}.cff-camp-live-stat strong{display:block;margin-top:4px;color:#fff;font-size:.92rem}
      @media(max-width:760px){.cff-camp-integrations{grid-template-columns:1fr 1fr}.cff-camp-integration-copy{grid-column:1/-1}.cff-camp-publish-grid,.cff-camp-publish-grid.is-mvp{grid-template-columns:1fr 1fr}.cff-camp-live-preview{grid-template-columns:1fr 1fr}.cff-camp-modal{padding:7px}.cff-camp-modal-card{width:calc(100vw - 14px);max-height:calc(100vh - 14px)}}
      @media(max-width:480px){.cff-camp-publish-grid,.cff-camp-publish-grid.is-mvp{grid-template-columns:1fr}.cff-camp-integrations{grid-template-columns:1fr}.cff-camp-modal-actions .cff-camp-btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function buildToolbar(){
    const command=$('.cff-camp-command');if(!command||$('#cff-camp-integrations'))return;
    const row=document.createElement('div');row.id='cff-camp-integrations';row.className='cff-camp-integrations';
    row.innerHTML=`
      <div class="cff-camp-integration-copy"><strong>Integrações Central FF</strong><small id="cff-camp-integration-status">Puxe as quedas já confirmadas no site e continue a tabela ao vivo sem publicar o rascunho.</small></div>
      <label>Etapa FFWS<select id="cff-camp-live-stage" class="cff-camp-btn"><option value="final">Final</option><option value="segundaFase">Segunda Fase</option></select></label>
      <button class="cff-camp-btn is-primary" id="cff-camp-live-sync" type="button">↻ FFWS ao vivo</button>
      <button class="cff-camp-btn" id="cff-camp-publish-title" type="button">🏁 Enviar resultado</button>`;
    command.appendChild(row);
    $('#cff-camp-live-sync')?.addEventListener('click',syncFfwsLive);
    $('#cff-camp-publish-title')?.addEventListener('click',openPublishModal);
  }

  function ensureModal(){
    let modal=$('#cff-camp-modal');if(modal)return modal;
    modal=document.createElement('div');modal.id='cff-camp-modal';modal.className='cff-camp-modal';modal.hidden=true;
    modal.innerHTML='<section class="cff-camp-modal-card" role="dialog" aria-modal="true"><header class="cff-camp-modal-head"><div><h2 id="cff-camp-modal-title"></h2><p id="cff-camp-modal-subtitle"></p></div><button class="cff-camp-modal-close" type="button" aria-label="Fechar">×</button></header><div class="cff-camp-modal-body" id="cff-camp-modal-body"></div></section>';
    modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
    modal.querySelector('.cff-camp-modal-close')?.addEventListener('click',closeModal);
    document.body.appendChild(modal);return modal;
  }
  function closeModal(){const m=$('#cff-camp-modal');if(m)m.hidden=true}
  function openModal(title,subtitle,html){const m=ensureModal();$('#cff-camp-modal-title').textContent=title;$('#cff-camp-modal-subtitle').textContent=subtitle||'';$('#cff-camp-modal-body').innerHTML=html;m.hidden=false;m.querySelector('.cff-camp-modal-close')?.focus({preventScroll:true});return m}

  function parseTeamCatalog(text){
    return String(text||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{
      const p=line.split(',').map(x=>x.trim());return{name:p[0]||'',code:p[1]||p[0]||'',abbr:p[2]||p[1]||p[0]||''};
    }).filter(x=>x.name);
  }
  function makeTeamCode(name,catalog){
    const target=norm(name);const found=catalog.find(t=>[t.name,t.code,t.abbr].some(v=>norm(v)===target));
    if(found)return found.code;
    let code=slugify(name).replace(/-/g,' ').slice(0,18)||('team '+Math.random().toString(36).slice(2,6));
    let n=2;while(catalog.some(t=>t.code===code))code=(slugify(name).replace(/-/g,' ').slice(0,14)||'team')+' '+n++;
    const abbr=String(name||'').split(/\s+/).map(x=>x[0]).join('').toUpperCase().slice(0,5)||code.toUpperCase().slice(0,5);
    catalog.push({name:String(name||code).trim(),code,abbr});return code;
  }
  function catalogText(catalog){return catalog.map(t=>`${t.name}, ${t.code}, ${t.abbr}`).join('\n')}
  function emptyDrop(codes){
    const dict=()=>Object.fromEntries(codes.map(code=>[code,null]));
    return{map:'',date:'',booyah:'',inputMode:'detail-pos-kills',inputModeTouched:false,points:dict(),kills:dict(),placements:dict(),top12:Object.fromEntries(codes.map(code=>[code,false])),mvp:'',mvppoint:'',unknownKills:{},estimatedKills:{}};
  }
  function flattenLiveStage(stage){
    const out=[];Object.keys(stage?.drops||{}).sort((a,b)=>num(a)-num(b)).forEach(day=>{
      const rows=stage.drops[day]||{};Object.keys(rows).sort((a,b)=>num(a)-num(b)).forEach(drop=>{
        const x=rows[drop];if(x)out.push({...x,day:num(x.day||day),drop:num(x.drop||drop)});
      });
    });return out;
  }
  function liveTeamRows(item){return vals(item?.teams).filter(Boolean)}
  function livePlayerRows(item){return vals(item?.players).filter(Boolean)}
  function normalizeBonus(stage){
    const out={...SECOND_BONUS};
    const raw=stage?.bonus;
    if(Array.isArray(raw))raw.forEach(x=>{if(x?.team)out[x.team]=num(x.bonus)});
    else if(raw&&typeof raw==='object')Object.entries(raw).forEach(([k,v])=>{if(typeof v==='number')out[k]=num(v);else if(v?.team)out[v.team]=num(v.bonus)});
    return out;
  }
  function makeDropFromLive(item,codes,catalog){
    const drop=emptyDrop(codes);drop.map=String(item?.map||'').trim();drop.inputModeTouched=true;
    liveTeamRows(item).forEach(row=>{
      const code=makeTeamCode(row.team,catalog);if(!codes.includes(code))codes.push(code);
      if(!(code in drop.points)){
        drop.points[code]=null;drop.kills[code]=null;drop.placements[code]=null;drop.top12[code]=false;
      }
      drop.points[code]=num(row.points);drop.kills[code]=num(row.kills);drop.placements[code]=num(row.position)||null;drop.top12[code]=num(row.position)===12;
      if(num(row.position)===1||num(row.booyah)>0)drop.booyah=code;
    });
    return drop;
  }
  function dayStarting(stageKey,day,codes,catalog,bonus){
    const points=Object.fromEntries(codes.map(c=>[c,0]));
    if(stageKey!=='segundaFase'||day!==1)return points;
    Object.entries(bonus).forEach(([name,value])=>{const code=makeTeamCode(name,catalog);if(!(code in points))points[code]=0;points[code]=num(value)});return points;
  }
  function aggregateDay(drops,codes,starting){
    const stats=Object.fromEntries(codes.map(code=>[code,{total:num(starting?.[code]),booyahs:0,kills:0,placementPoints:0,matchesPlayed:0,starting:num(starting?.[code])}]));
    drops.forEach(drop=>codes.forEach(code=>{
      const p=drop?.points?.[code];if(p===null||p===undefined||Number.isNaN(Number(p)))return;
      const row=stats[code]||(stats[code]={total:0,booyahs:0,kills:0,placementPoints:0,matchesPlayed:0,starting:0});
      row.total+=num(p);row.kills+=num(drop?.kills?.[code]);row.placementPoints+=Math.max(0,num(p)-num(drop?.kills?.[code]));row.matchesPlayed++;
      if(String(drop?.booyah||'')===String(code)||num(drop?.placements?.[code])===1)row.booyahs++;
    }));return stats;
  }
  function daySnapshot(template,stageKey,day,records,codes,catalog,bonus,expected){
    const drops=Array.from({length:expected},(_,i)=>{
      const item=records.find(x=>num(x.drop)===i+1);return item?makeDropFromLive(item,codes,catalog):emptyDrop(codes);
    });
    const starting=dayStarting(stageKey,day,codes,catalog,bonus);
    const stageLabel=stageKey==='final'?'Final':'Segunda Fase';
    const config={...(template.config||{}),tournamentDays:stageKey==='final'?2:6,v68ChampionRushUnlimited:stageKey==='final'&&day===2,cffFfwsStage:stageKey,quedas:String(expected),tournamentName:`FFWS BR 2026 S2 - ${stageLabel} — Dia ${day}`,startingEnabled:stageKey==='segundaFase'&&day===1,championEnabled:stageKey==='final',cp:stageKey==='final'?'160':String(template.config?.cp||160)};
    return{version:template.version||23,selectedTeams:[...codes],currentInputMode:'detail-pos-kills',drops,startingPoints:starting,placementOverrides:{},config};
  }
  function makeRegisteredDay(template,stageKey,day,records,codes,catalog,bonus,expected){
    const snapshot=daySnapshot(template,stageKey,day,records,codes,catalog,bonus,expected);
    const filled=records.length;return{id:`live-${stageKey}-${day}`,number:day,name:`Dia ${day}`,date:'',activeCodes:[...codes],restingCodes:[],stats:aggregateDay(snapshot.drops,codes,snapshot.startingPoints),filledDrops:filled,totalDrops:expected,killsTracked:true,placementTracked:true,editorSnapshot:snapshot,wikiMatchKey:'M1',wikiHeader:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  }
  function hasDraftData(drop){
    if(!drop)return false;
    return Object.values(drop.points||{}).some(v=>v!==null&&v!==undefined&&String(v)!=='')||Object.values(drop.kills||{}).some(v=>v!==null&&v!==undefined&&String(v)!=='')||Object.values(drop.placements||{}).some(v=>v!==null&&v!==undefined&&String(v)!=='');
  }
  function mergeLocalDraft(imported,current,confirmedCount,currentDay){
    if(!current||current.config?.cffFfwsStage!==imported.config?.cffFfwsStage||num(current?.tournamentModeV1?.draftDayNumber)!==num(currentDay))return imported;
    const old=Array.isArray(current.drops)?current.drops:[];for(let i=0;i<old.length;i++)if(hasDraftData(old[i])&&!hasDraftData(imported.drops[i]))imported.drops[i]=old[i];
    imported.config.quedas=String(imported.drops.length);
    return imported;
  }
  function collectLivePlayers(records){
    const map=new Map();records.forEach(drop=>livePlayerRows(drop).forEach(p=>{
      const name=String(p?.name||'').trim();if(!name)return;const key=norm(name);if(!map.has(key))map.set(key,{name,team:String(p?.team||''),kills:0,damage:0,assists:0,mvp:0,matches:0});const row=map.get(key);row.kills+=num(p.kills);row.damage+=num(p.damage);row.assists+=num(p.assists);row.mvp+=num(p.mvp);row.matches++;
    }));const rows=[...map.values()];const hasMvp=rows.some(x=>x.mvp>0);rows.sort((a,b)=>hasMvp?(b.mvp-a.mvp||b.kills-a.kills||b.damage-a.damage):(b.kills-a.kills||b.damage-a.damage));return rows;
  }
  async function fetchTemplate(){const r=await fetch(PRESETS_URL(),{cache:'no-store'});if(!r.ok)throw new Error('Não foi possível carregar a base FFWS do Camp.');return r.json()}
  function PRESETS_URL(){return 'admin-camp-ao-vivo/data/backup-ffws-br-2026-s2-segunda-fase.json?v=20261001-live-import-v2'}

  async function buildLiveBackup(root,stageKey){
    const meta=STAGE_META[stageKey];if(!meta)throw new Error('Etapa não reconhecida.');
    const records=flattenLiveStage(root?.[stageKey]);if(!records.length&&stageKey!=='final')throw new Error(`Ainda não há quedas confirmadas na ${meta.label}.`);
    const template=await fetchTemplate();const catalog=parseTeamCatalog(template.teams);const bonus=normalizeBonus(root?.[stageKey]);
    const liveNames=[...new Set(records.flatMap(x=>liveTeamRows(x).map(t=>String(t.team||'').trim())).filter(Boolean))];liveNames.forEach(name=>makeTeamCode(name,catalog));
    const codes=liveNames.map(name=>makeTeamCode(name,catalog));
    if(stageKey==='segundaFase'||!codes.length)Object.keys(bonus).forEach(name=>{const code=makeTeamCode(name,catalog);if(!codes.includes(code))codes.push(code)});
    const byDay=new Map();records.forEach(x=>{if(!byDay.has(num(x.day)))byDay.set(num(x.day),[]);byDay.get(num(x.day)).push(x)});byDay.forEach(arr=>arr.sort((a,b)=>num(a.drop)-num(b.drop)));
    let latestDay=Math.max(1,...byDay.keys());let currentDay=latestDay;let currentRecords=byDay.get(currentDay)||[];const expectedCurrent=num(meta.dropsByDay[currentDay]||Math.max(6,...currentRecords.map(x=>num(x.drop))));
    const stageComplete=stageKey==='segundaFase'?records.length>=36:Boolean(root?.final?.champion);
    if(!stageComplete&&currentRecords.length>=expectedCurrent&&currentDay<meta.days){currentDay++;currentRecords=[]}
    const registered=[];for(let day=1;day<currentDay;day++){const recs=byDay.get(day)||[];if(!recs.length)continue;const expected=num(meta.dropsByDay[day]||Math.max(6,...recs.map(x=>num(x.drop))));registered.push(makeRegisteredDay(template,stageKey,day,recs,codes,catalog,bonus,expected))}
    const expected=num(meta.dropsByDay[currentDay]||Math.max(1,...currentRecords.map(x=>num(x.drop)))+(stageKey==='final'&&currentDay===2&&!stageComplete?1:0));
    const current=daySnapshot(template,stageKey,currentDay,currentRecords,codes,catalog,bonus,expected);
    current.teams=catalogText(catalog);current.logos=template.logos||'';current.generatedAt=new Date().toISOString();current.currentInputMode='detail-pos-kills';
    current.config={...current.config,tournamentName:`FFWS BR 2026 S2 - ${meta.label} — Dia ${currentDay}`,emojiRules:stageKey==='segundaFase'?'🌏: 1-2':String(template.config?.emojiRules||''),startingEnabled:stageKey==='segundaFase'&&currentDay===1,championEnabled:stageKey==='final',finalMode:stageKey==='final'?'champion':'classic',cffTournamentPhasesV1:{version:1,activeId:stageKey,phases:[{id:stageKey,name:meta.label,teams:codes.length,advance:0,days:meta.days,firstDrops:6,laterDrops:6,unlimited:stageKey==='final',format:stageKey==='final'?'champion':'classic',cp:160,lastDate:'',completed:false}]} };
    current.tournamentModeV1={version:7,ownerStageId:'',enabled:true,view:'day',name:`FFWS BR 2026 S2 - ${meta.label}`,editingDayId:'',draftDayNumber:currentDay,rosterCodes:[...codes],draftActiveCodes:[...codes],days:registered,config:{unitLabel:'Dia',expectedTeams:codes.length,teamsPerRound:codes.length,advanceCount:stageKey==='segundaFase'?2:1,relegatedCount:0,tieBreakers:['booyahs','kills','placementPoints'],liveOverall:true,dimInactiveLogos:true,autoCloseDay:true,askBackupOnDayEnd:true,wikiMatchKey:'M1',wikiHeader:'',wikiYoutube:'',wikiAutoToggle:false,columns:{total:true,booyahs:true,kills:true,placementPoints:true,drops:true,daysPlayed:false,rests:false,average:false,lastDay:true,dayColumns:false,movement:true},bgRules:stageKey==='segundaFase'?[{key:'up',positions:'1-2',label:'Global Series',color:'#39b85a'}]:[]}};
    return{backup:current,records,currentDay,confirmedCurrent:currentRecords.length,expected,stageKey,stageLabel:meta.label,players:collectLivePlayers(records),updatedAt:num(root?.[stageKey]?.updatedAt)};
  }

  async function fetchLiveRoot(){
    const base=dbBase();if(!base)throw new Error('Firebase não configurado.');
    const r=await fetch(`${base}/${FFWS_ROOT}.json?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`Falha ao ler a tabela pública (${r.status}).`);return r.json();
  }
  function detectStage(){return $('#cff-camp-live-stage')?.value||'final'}
  async function syncFfwsLive(){
    const btn=$('#cff-camp-live-sync');if(btn)btn.disabled=true;setStatus('Buscando a tabela confirmada mais recente…','warn');
    try{
      const [root,current]=await Promise.all([fetchLiveRoot(),Promise.resolve(window.collectBackupData?.(true)||null)]);
      const stageKey=detectStage(root),result=await buildLiveBackup(root,stageKey);
      mergeLocalDraft(result.backup,current,result.confirmedCurrent,result.currentDay);
      const total=result.records.length,label=`FFWS BR 2026 S2 • ${result.stageLabel} • Dia ${result.currentDay}`;
      const preserve=result.confirmedCurrent<result.expected?' A próxima queda continua livre para você atualizar manualmente enquanto ela rola.':'';
      if(!confirm(`${label}\n\n${total} queda(s) confirmada(s) no site • ${result.confirmedCurrent}/${result.expected} no dia atual.\n\nPuxar esses dados para o Camp?${preserve}`))return setStatus('Atualização cancelada.');
      try{localStorage.setItem('cff_camp_before_live_sync_v1',JSON.stringify(current))}catch(_){}
      const oldStage=current?.config?.cffFfwsStage||(/Segunda Fase/i.test(current?.config?.tournamentName||'')?'segundaFase':/Final/i.test(current?.config?.tournamentName||'')?'final':'');
      if(oldStage!==stageKey)window.v37DetachStage?.();
      await window.CFF_CAMP?.applyBackupText?.(JSON.stringify(result.backup),`${label} — dados ao vivo`,false);
      lastLiveImport=result;try{localStorage.setItem(LIVE_META_KEY,JSON.stringify({stageKey:result.stageKey,currentDay:result.currentDay,players:result.players.slice(0,20),updatedAt:Date.now()}))}catch(_){ }
      setStatus(`${label} • ${result.confirmedCurrent}/${result.expected} quedas do dia puxadas. O rascunho não foi publicado.`,'ok');
      toast('Tabela confirmada puxada. Continue a queda atual normalmente.');
    }catch(error){console.error(error);setStatus(error.message||'Falha ao puxar a tabela.','err');toast(error.message||'Falha ao puxar a tabela.','err')}
    finally{if(btn)btn.disabled=false}
  }

  function currentBackup(){try{return window.collectBackupData?.(true)||JSON.parse(localStorage.getItem('ffws_autosave')||'null')}catch(_){return null}}
  function teamNameMap(backup){const map=new Map();parseTeamCatalog(backup?.teams||'').forEach(t=>map.set(String(t.code),t.name));return map}
  function rankCurrentTournament(backup){
    if(!backup)return[];const names=teamNameMap(backup),mode=backup.tournamentModeV1||{},codes=[...new Set([...(mode.rosterCodes||[]),...(backup.selectedTeams||[])].map(String).filter(Boolean))];
    const rows=new Map(codes.map(code=>[code,{code,name:names.get(code)||code,total:0,booyahs:0,kills:0,placementPoints:0,matches:0}]));
    const addStats=(stats={})=>Object.entries(stats).forEach(([code,s])=>{if(!rows.has(code))rows.set(code,{code,name:names.get(code)||code,total:0,booyahs:0,kills:0,placementPoints:0,matches:0});const r=rows.get(code);r.total+=num(s.total);r.booyahs+=num(s.booyahs);r.kills+=num(s.kills);r.placementPoints+=num(s.placementPoints);r.matches+=num(s.matchesPlayed)});
    (mode.days||[]).forEach(day=>addStats(day.stats));
    const topDrops=Array.isArray(backup.drops)?backup.drops:[];const starting=backup.startingPoints||{};
    if(mode.enabled){codes.forEach(code=>{if(!rows.has(code))return;rows.get(code).total+=num(starting[code])});}
    topDrops.forEach(drop=>codes.forEach(code=>{const p=drop?.points?.[code];if(p===null||p===undefined||String(p)==='')return;const r=rows.get(code);if(!r)return;r.total+=num(p);r.kills+=num(drop?.kills?.[code]);r.placementPoints+=Math.max(0,num(p)-num(drop?.kills?.[code]));r.matches++;if(String(drop?.booyah||'')===code||num(drop?.placements?.[code])===1)r.booyahs++}));
    if(!mode.enabled){codes.forEach(code=>{const r=rows.get(code);if(r)r.total+=num(starting[code])})}
    return[...rows.values()].filter(r=>r.matches||r.total).sort((a,b)=>b.total-a.total||b.booyahs-a.booyahs||b.kills-a.kills||b.placementPoints-a.placementPoints||a.name.localeCompare(b.name,'pt-BR'));
  }
  function fallbackMvpNames(backup){
    const score=new Map();(backup?.drops||[]).forEach(drop=>{const name=String(drop?.mvp||'').trim();if(!name)return;const row=score.get(norm(name))||{name,score:0};row.score+=num(drop?.mvppoint)||1;score.set(norm(name),row)});return[...score.values()].sort((a,b)=>b.score-a.score).map(x=>x.name);
  }
  function storedPlayerRanking(){
    if(lastLiveImport?.players?.length)return lastLiveImport.players;
    try{const m=JSON.parse(localStorage.getItem(LIVE_META_KEY)||'null');if(Array.isArray(m?.players))return m.players}catch(_){ }
    return[];
  }
  function today(){return new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10)}

  function openPublishModal(){
    const backup=currentBackup();if(!backup)return toast('Nenhum torneio carregado.','err');const ranking=rankCurrentTournament(backup);if(ranking.length<3)return toast('Ainda não há dados suficientes para montar o TOP 3.','warn');
    const livePlayers=storedPlayerRanking(),fallback=fallbackMvpNames(backup),mvpNames=[...livePlayers.map(x=>x.name),...fallback].filter((x,i,a)=>x&&a.findIndex(y=>norm(y)===norm(x))===i).slice(0,5);
    while(mvpNames.length<5)mvpNames.push('');
    const tournamentName=String(backup?.tournamentModeV1?.name||backup?.config?.tournamentName||'').replace(/\s+—\s+Dia\s+\d+.*$/i,'').trim()||'Torneio';
    const date=String(backup?.config?.date||'')||today();
    openModal('Enviar resultado ao site','O Camp calcula o pódio. Confira os MVPs antes de salvar em TÍTULOS.',`
      <section class="cff-camp-modal-section"><h3>Resultado</h3><div class="cff-camp-publish-grid"><label>Torneio<input id="cff-publish-name" value="${esc(tournamentName)}"></label><label>Data da final<input id="cff-publish-date" type="date" value="${esc(date)}"></label><label>ID / slug<input id="cff-publish-id" value="${esc(slugify(tournamentName+'-'+date))}"></label></div></section>
      <section class="cff-camp-modal-section"><h3>Pódio calculado</h3><div class="cff-camp-publish-grid">${ranking.slice(0,3).map((r,i)=>`<label>${['🥇 TOP 1','🥈 TOP 2','🥉 TOP 3'][i]}<input id="cff-publish-top${i+1}" value="${esc(r.name)}"></label>`).join('')}</div><p class="cff-camp-modal-note">Ordem usada: pontos → Booyahs → abates → pontos de colocação. Você pode corrigir qualquer campo antes de enviar.</p></section>
      <section class="cff-camp-modal-section"><h3>Ranking de MVP</h3><div class="cff-camp-publish-grid is-mvp">${mvpNames.map((name,i)=>`<label>${i+1}º MVP<input id="cff-publish-mvp${i+1}" value="${esc(name)}" placeholder="Jogador"></label>`).join('')}</div><p class="cff-camp-modal-note">Quando a tabela foi puxada da FFWS ao vivo, os jogadores são sugeridos pelos dados oficiais (MVP/abates). Em qualquer torneio, você pode editar manualmente.</p></section>
      <p class="cff-camp-modal-message" id="cff-publish-message"></p><div class="cff-camp-modal-actions"><button class="cff-camp-btn" id="cff-publish-open-admin" type="button">Abrir Títulos</button><button class="cff-camp-btn is-primary" id="cff-publish-confirm" type="button">Salvar no site</button></div>`);
    $('#cff-publish-open-admin')?.addEventListener('click',()=>{try{localStorage.setItem('cff_admin_section_v1','titles')}catch(_){ }location.href='admin.html'});
    $('#cff-publish-confirm')?.addEventListener('click',publishTitleFromModal);
  }

  async function firebase(){
    if(firebasePromise)return firebasePromise;
    firebasePromise=Promise.all([
      import('https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js')
    ]).then(([appMod,authMod,dbMod])=>{
      const app=appMod.getApps().length?appMod.getApp():appMod.initializeApp(window.CFF_CONFIG.firebase);return{app,auth:authMod.getAuth(app),db:dbMod.getDatabase(app),...dbMod};
    });return firebasePromise;
  }
  function publishMessage(text,type=''){const el=$('#cff-publish-message');if(!el)return;el.textContent=text||'';el.className='cff-camp-modal-message '+type}
  async function publishTitleFromModal(){
    const button=$('#cff-publish-confirm');if(button)button.disabled=true;publishMessage('Salvando resultado…');
    try{
      const api=await firebase();const user=api.auth.currentUser;if(!user||String(user.email||'').toLowerCase()!==ADMIN_EMAIL)throw new Error('Sessão administrativa inválida.');
      const name=$('#cff-publish-name').value.trim(),date=$('#cff-publish-date').value,id=slugify($('#cff-publish-id').value.trim()||`${name}-${date}`),winner=$('#cff-publish-top1').value.trim(),runnerUp=$('#cff-publish-top2').value.trim(),third=$('#cff-publish-top3').value.trim(),mvpRanking=[1,2,3,4,5].map(position=>({position,player:$(`#cff-publish-mvp${position}`).value.trim()}));
      if(!name||!date||!id||!winner||!runnerUp||!third||mvpRanking.some(x=>!x.player))throw new Error('Preencha torneio, data, TOP 3 e os cinco MVPs.');
      const target=api.ref(api.db,`adminTitles/${id}`),previous=(await api.get(target)).val()||{};
      await api.set(target,{id,name,date,winner,runnerUp,third,mvp:[mvpRanking[0].player],mvpRanking,createdAt:previous.createdAt||api.serverTimestamp(),updatedAt:api.serverTimestamp()});
      publishMessage('Resultado salvo em TÍTULOS. O site/ranking anual já pode consumir o TOP 3 e os MVPs.','ok');toast('Resultado enviado para Títulos.');
    }catch(error){console.error(error);publishMessage(error.message||'Não foi possível salvar o resultado.','err')}
    finally{if(button)button.disabled=false}
  }

  window.CFF_CAMP_LIVE={buildLiveBackup,mergeLocalDraft,fetchLiveRoot,sync:syncFfwsLive};
  function boot(){injectStyles();buildToolbar();ensureModal();document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#cff-camp-modal')?.hidden)closeModal()})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
