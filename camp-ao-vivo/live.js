(function(){
  'use strict';

  if(window.__CFF_CAMP_INTEGRATIONS_V1__) return;
  window.__CFF_CAMP_INTEGRATIONS_V1__=true;

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
    final:{label:'Final',days:2,dropsByDay:{1:6,2:10},starting:false}
  };

  let lastLiveImport=null;

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
    const config={...(template.config||{}),quedas:String(expected),tournamentName:`FFWS BR 2026 S2 - ${stageLabel} — Dia ${day}`,startingEnabled:stageKey==='segundaFase'&&day===1,championEnabled:stageKey==='final',cp:stageKey==='final'?'160':String(template.config?.cp||160)};
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
    if(!current||num(current?.tournamentModeV1?.draftDayNumber)!==num(currentDay))return imported;
    const old=Array.isArray(current.drops)?current.drops:[];for(let i=confirmedCount;i<imported.drops.length;i++)if(hasDraftData(old[i]))imported.drops[i]=old[i];
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
    const records=flattenLiveStage(root?.[stageKey]);if(!records.length)throw new Error(`Ainda não há quedas confirmadas na ${meta.label}.`);
    const template=await fetchTemplate();const catalog=parseTeamCatalog(template.teams);const bonus=normalizeBonus(root?.[stageKey]);
    const liveNames=[...new Set(records.flatMap(x=>liveTeamRows(x).map(t=>String(t.team||'').trim())).filter(Boolean))];liveNames.forEach(name=>makeTeamCode(name,catalog));
    const codes=liveNames.map(name=>makeTeamCode(name,catalog));
    if(stageKey==='segundaFase')Object.keys(bonus).forEach(name=>{const code=makeTeamCode(name,catalog);if(!codes.includes(code))codes.push(code)});
    const byDay=new Map();records.forEach(x=>{if(!byDay.has(num(x.day)))byDay.set(num(x.day),[]);byDay.get(num(x.day)).push(x)});byDay.forEach(arr=>arr.sort((a,b)=>num(a.drop)-num(b.drop)));
    let latestDay=Math.max(...byDay.keys());let currentDay=latestDay;let currentRecords=byDay.get(currentDay)||[];const expectedCurrent=num(meta.dropsByDay[currentDay]||Math.max(6,...currentRecords.map(x=>num(x.drop))));
    const stageComplete=stageKey==='segundaFase'?records.length>=36:(records.length>=16||Boolean(root?.final?.champion));
    if(!stageComplete&&currentRecords.length>=expectedCurrent&&currentDay<meta.days){currentDay++;currentRecords=[]}
    const registered=[];for(let day=1;day<currentDay;day++){const recs=byDay.get(day)||[];if(!recs.length)continue;const expected=num(meta.dropsByDay[day]||Math.max(6,...recs.map(x=>num(x.drop))));registered.push(makeRegisteredDay(template,stageKey,day,recs,codes,catalog,bonus,expected))}
    const expected=num(meta.dropsByDay[currentDay]||Math.max(6,...currentRecords.map(x=>num(x.drop)),6));
    const current=daySnapshot(template,stageKey,currentDay,currentRecords,codes,catalog,bonus,expected);
    current.teams=catalogText(catalog);current.logos=template.logos||'';current.generatedAt=new Date().toISOString();current.currentInputMode='detail-pos-kills';
    current.config={...current.config,tournamentName:`FFWS BR 2026 S2 - ${meta.label} — Dia ${currentDay}`,emojiRules:stageKey==='segundaFase'?'🌏: 1-2':String(template.config?.emojiRules||''),startingEnabled:stageKey==='segundaFase'&&currentDay===1,championEnabled:stageKey==='final',finalMode:stageKey==='final'?'champion':'classic'};
    current.tournamentModeV1={version:7,ownerStageId:'',enabled:true,view:'day',name:`FFWS BR 2026 S2 - ${meta.label}`,editingDayId:'',draftDayNumber:currentDay,rosterCodes:[...codes],draftActiveCodes:[...codes],days:registered,config:{unitLabel:'Dia',expectedTeams:codes.length,teamsPerRound:codes.length,advanceCount:stageKey==='segundaFase'?2:1,relegatedCount:0,tieBreakers:['booyahs','kills','placementPoints'],liveOverall:true,dimInactiveLogos:true,autoCloseDay:true,askBackupOnDayEnd:true,wikiMatchKey:'M1',wikiHeader:'',wikiYoutube:'',wikiAutoToggle:false,columns:{total:true,booyahs:true,kills:true,placementPoints:true,drops:true,daysPlayed:false,rests:false,average:false,lastDay:true,dayColumns:false,movement:true},bgRules:stageKey==='segundaFase'?[{key:'up',positions:'1-2',label:'Global Series',color:'#39b85a'}]:[]}};
    return{backup:current,records,currentDay,confirmedCurrent:currentRecords.length,expected,stageKey,stageLabel:meta.label,players:collectLivePlayers(records),updatedAt:num(root?.[stageKey]?.updatedAt)};
  }

  async function fetchLiveRoot(){
    const base=dbBase();if(!base)throw new Error('Firebase não configurado.');
    const r=await fetch(`${base}/${FFWS_ROOT}.json?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`Falha ao ler a tabela pública (${r.status}).`);return r.json();
  }
  function detectStage(root){const finalCount=flattenLiveStage(root?.final).length;return finalCount?'final':'segundaFase'}
  async function syncFfwsLive(){
    const btn=$('#cff-camp-live-sync');if(btn)btn.disabled=true;setStatus('Buscando a tabela confirmada mais recente…','warn');
    try{
      const [root,current]=await Promise.all([fetchLiveRoot(),Promise.resolve(window.collectBackupData?.(true)||null)]);
      const stageKey=detectStage(root),result=await buildLiveBackup(root,stageKey);
      mergeLocalDraft(result.backup,current,result.confirmedCurrent,result.currentDay);
      const total=result.records.length,label=`FFWS BR 2026 S2 • ${result.stageLabel} • Dia ${result.currentDay}`;
      const preserve=result.confirmedCurrent<result.expected?' A próxima queda continua livre para você atualizar manualmente enquanto ela rola.':'';
      if(!confirm(`${label}\n\n${total} queda(s) confirmada(s) no site • ${result.confirmedCurrent}/${result.expected} no dia atual.\n\nPuxar esses dados para o Camp?${preserve}`))return setStatus('Atualização cancelada.');
      window.CFF_CAMP?.persistence?.saveLocalNow?.('before-live-import',true);
      await window.CFF_CAMP?.applyBackupText?.(JSON.stringify(result.backup),`${label} — dados ao vivo`,false);
      lastLiveImport=result;try{localStorage.setItem(LIVE_META_KEY,JSON.stringify({stageKey:result.stageKey,currentDay:result.currentDay,players:result.players.slice(0,20),updatedAt:Date.now()}))}catch(_){ }
      setStatus(`${label} • ${result.confirmedCurrent}/${result.expected} quedas do dia puxadas. O rascunho não foi publicado.`,'ok');
      toast('Tabela confirmada puxada. Continue a queda atual normalmente.');
    }catch(error){console.error(error);setStatus(error.message||'Falha ao puxar a tabela.','err');toast(error.message||'Falha ao puxar a tabela.','err')}
    finally{if(btn)btn.disabled=false}
  }

  function boot(){
    const command=$('.cff-camp-command');if(!command)return;
    const row=document.createElement('div');row.className='cff-camp-public-live';
    const status=document.createElement('small');status.id='cff-camp-integration-status';status.textContent='Puxe as quedas confirmadas da FFWS e continue sua tabela ao vivo.';
    const button=document.createElement('button');button.id='cff-camp-live-sync';button.type='button';button.className='cff-camp-btn is-primary';button.textContent='↻ FFWS confirmada';button.addEventListener('click',syncFfwsLive);row.append(status,button);command.append(row);
    const style=document.createElement('style');style.textContent='.cff-camp-public-live{grid-column:1/-1;width:100%;display:flex;gap:12px;align-items:center;justify-content:space-between;border-top:1px solid #29405a;padding-top:12px;margin-top:4px}.cff-camp-public-live small{color:#88a3bd;line-height:1.5;font-size:.75rem;min-width:0}.cff-camp-public-live button{flex-shrink:0}@media(max-width:600px){.cff-camp-public-live{align-items:stretch;flex-direction:column}}';document.head.append(style);
  }
  boot();
})();
