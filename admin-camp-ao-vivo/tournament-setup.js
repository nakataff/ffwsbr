(function(){
  'use strict';
  if(window.CFF_TOURNAMENT_SETUP)return;
  const $=id=>document.getElementById(id),api=()=>window.v76TournamentMode;
  const clone=x=>JSON.parse(JSON.stringify(x)),number=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const notify=(text,tone='ok')=>window.CFF_CAMP?.toast?.(text,tone);
  const originalCollect=window.collectBackupData;
  let importing=false,syncing=false,lastDayKey='',plan;
  const phase=()=>plan.phases.find(p=>p.id===plan.activeId)||plan.phases[0];
  function makePhase(name='Fase 1',teams=18,advance=12){return{id:'phase-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),name,teams,advance,days:1,firstDrops:6,laterDrops:6,unlimited:false,format:'classic',cp:160,lastDate:'',completed:false,eliminated:[]}}
  function derive(data){
    const p=data?.config?.cffTournamentPhasesV1;
    if(p?.version===1&&Array.isArray(p.phases)&&p.phases.length&&p.phases.some(x=>x.id===p.activeId))return clone(p);
    const state=data?.tournamentModeV1,final=/final/i.test(state?.name||data?.config?.tournamentName||'');
    const item=makePhase(final?'Final':'Fase 1',state?.config?.expectedTeams||data?.selectedTeams?.length||18,final?0:12);
    item.days=final?2:number(data?.config?.tournamentDays,1);item.format=final?'champion':'classic';item.unlimited=final;item.firstDrops=number(data?.config?.quedas,6);
    return{version:1,activeId:item.id,phases:[item]};
  }
  plan=derive(window.__CFF_CAMP_INITIAL_BACKUP__||originalCollect?.(true));
  let liveStage=(window.__CFF_CAMP_INITIAL_BACKUP__||originalCollect?.(true))?.config?.cffFfwsStage||'';
  function persist(){window.autoSave?.(true)}
  function collect(){return window.collectBackupData(true)}
  function checkpoint(data){try{localStorage.setItem('cff_camp_before_phase_change_v1',JSON.stringify({savedAt:Date.now(),backup:data}))}catch(e){throw new Error('Não foi possível preservar o backup anterior. Exporte o JSON antes de trocar de fase.')}}
  const wrappedCollect=function(){const data=originalCollect.apply(this,arguments);if(data){data.config=data.config||{};data.config.cffTournamentPhasesV1=clone(plan);data.config.cffFfwsStage=liveStage}return data};
  window.collectBackupData=wrappedCollect;try{collectBackupData=wrappedCollect}catch(_){}
  const originalImport=window.importBackup;
  const wrappedImport=function(){let data;try{data=JSON.parse($('backup-input').value)}catch(_){}
    const before=plan;if(data){plan=derive(data);liveStage=data.config?.cffFfwsStage||''}importing=true;
    try{const result=originalImport.apply(this,arguments);lastDayKey='';renderPhases();setTimeout(syncDay,300);return result}catch(e){plan=before;throw e}finally{importing=false}
  };
  window.importBackup=wrappedImport;try{importBackup=wrappedImport}catch(_){}
  function stripped(data){const copy=clone(data);delete copy.config.cffTournamentPhasesV1;(copy.tournamentModeV1?.days||[]).forEach(d=>{if(d.editorSnapshot?.config)delete d.editorSnapshot.config.cffTournamentPhasesV1});return copy}
  function hasScore(drop){return Object.values(drop?.points||{}).some(v=>v!==null&&v!==undefined&&v!=='')}
  function rank(data,rule=phase()){
    const mode=data.tournamentModeV1||{},codes=[...new Set([...(mode.rosterCodes||[]),...(data.selectedTeams||[])])];
    const rows=new Map(codes.map(code=>[code,{code,total:0,booyahs:0,kills:0,placementPoints:0,matches:0}]));
    const add=(code,stats)=>{if(!rows.has(code))return;const r=rows.get(code);for(const k of ['total','booyahs','kills','placementPoints'])r[k]+=number(stats[k]);r.matches+=number(stats.matchesPlayed)};
    (mode.days||[]).filter(d=>d.id!==mode.editingDayId).forEach(d=>Object.entries(d.stats||{}).forEach(([code,s])=>add(code,s)));
    codes.forEach(code=>add(code,{total:data.config?.startingEnabled?number(data.startingPoints?.[code]):0}));
    (data.drops||[]).forEach(d=>codes.forEach(code=>{const p=d.points?.[code];if(p===null||p===undefined||p==='')return;const k=number(d.kills?.[code]);add(code,{total:number(p),kills:k,placementPoints:number(p)-k,booyahs:d.booyah===code?1:0,matchesPlayed:1})}));
    const keys=mode.config?.tieBreakers||['booyahs','kills','placementPoints'];const winner=getWinner(allDays(data),rule);
    return[...rows.values()].sort((a,b)=>{if(winner&&(a.code===winner||b.code===winner))return a.code===winner?-1:1;let diff=b.total-a.total;for(const key of keys)if(!diff)diff=number(b[key])-number(a[key]);return diff||a.code.localeCompare(b.code)});
  }
  function allDays(data){const m=data.tournamentModeV1||{};return [...(m.days||[]).filter(d=>d.id!==m.editingDayId),{number:m.days?.find(d=>d.id===m.editingDayId)?.number||m.draftDayNumber||1,editorSnapshot:data}].sort((a,b)=>a.number-b.number)}
  function getWinner(days,rule=phase()){
    if(rule?.format!=='champion')return null;const cp=number(rule.cp,160),totals={};
    for(const day of [...(days||[])].sort((a,b)=>a.number-b.number)){
      const snapshot=day.editorSnapshot;if(!snapshot)continue;
      if(snapshot.config?.startingEnabled)Object.entries(snapshot.startingPoints||{}).forEach(([c,v])=>totals[c]=(totals[c]||0)+number(v));
      for(const drop of snapshot.drops||[]){if(!hasScore(drop))continue;if(drop.booyah&&(totals[drop.booyah]||0)>=cp)return drop.booyah;Object.entries(drop.points||{}).forEach(([c,v])=>totals[c]=(totals[c]||0)+number(v))}
    }return null;
  }
  function emptyDrop(codes){const dict=()=>Object.fromEntries(codes.map(c=>[c,null]));return{map:'',date:'',booyah:'',inputMode:'detail-pos-kills',points:dict(),kills:dict(),placements:dict(),top12:Object.fromEntries(codes.map(c=>[c,false])),unknownKills:{},estimatedKills:{},mvp:'',mvppoint:''}}
  function configured(data,p){
    const mode=data.tournamentModeV1||{};data.config={...data.config,championEnabled:p.format==='champion',cp:String(p.cp),finalMode:p.format,tournamentDays:p.days,v68ChampionRushUnlimited:p.format==='champion'&&p.unlimited&&number(mode.draftDayNumber,1)>1,cffTournamentPhasesV1:clone(plan)};
    data.tournamentModeV1={...mode,enabled:true,config:{...mode.config,expectedTeams:p.teams,advanceCount:p.advance,teamsPerRound:Math.min(number(mode.config?.teamsPerRound,p.teams)||p.teams,p.teams)}};
    return data;
  }
  async function applyPhase(){
    try{const p=phase(),data=collect();checkpoint(data);configured(data,p);await window.CFF_CAMP.applyBackupText(JSON.stringify(data),p.name,false);notify('Configurações da fase aplicadas.')}catch(e){notify(e.message,'err')}
  }
  async function openPhase(id,advancers){
    const source=phase(),target=plan.phases.find(p=>p.id===id);if(!target||target.id===source.id)return;
    const data=collect();checkpoint(data);source.snapshot=stripped(data);plan.activeId=target.id;
    let next=target.snapshot?clone(target.snapshot):clone(data);
    if(!target.snapshot){
      const codes=advancers||rank(data).slice(0,target.teams).map(r=>r.code);next.selectedTeams=codes;next.startingPoints=Object.fromEntries(codes.map(c=>[c,0]));next.placementOverrides={};next.drops=Array.from({length:target.firstDrops},()=>emptyDrop(codes));
      next.config={...next.config,quedas:String(target.firstDrops),tournamentName:(data.tournamentModeV1?.name||data.config.tournamentName||'Torneio').replace(/\s*[—-]\s*(Final|Fase\s*\d+).*$/i,'')+' — '+target.name+' — Dia 1',date:'',startingEnabled:false};
      next.tournamentModeV1={...next.tournamentModeV1,name:next.config.tournamentName.replace(/ — Dia 1$/,''),days:[],editingDayId:'',draftDayNumber:1,rosterCodes:codes,draftActiveCodes:codes,view:'day',config:{...next.tournamentModeV1?.config,teamsPerRound:Math.min(codes.length,target.teams),bgRules:[]}};
      delete next.config.cffFfwsStage;
    }
    configured(next,target);await window.CFF_CAMP.applyBackupText(JSON.stringify(next),target.name,false);persist();renderPhases();
  }
  async function advance(){
    try{
      const p=phase(),data=collect(),rows=rank(data);if(!p.advance||p.advance>=p.teams)throw new Error('Informe quantos times passam para a próxima fase.');
      if(rows.length!==p.teams||rows.some(r=>!r.matches))throw new Error('Escolha todos os times da fase e preencha os resultados antes de avançar.');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(p.lastDate))throw new Error('Informe o último dia desta fase para datar os eliminados.');
      const next=plan.phases[plan.phases.indexOf(p)+1];if(!next)throw new Error('Adicione a próxima fase antes de avançar.');
      if(next.teams!==p.advance)throw new Error('O número de times da próxima fase deve ser igual ao número de classificados.');
      if(!confirm(`Encerrar ${p.name} e levar os ${p.advance} primeiros para ${next.name}? A fase atual ficará salva.`))return;
      checkpoint(data);p.eliminated=rows.slice(p.advance).map(r=>r.code);p.completed=true;await openPhase(next.id,rows.slice(0,p.advance).map(r=>r.code));notify('Fase salva. Classificados carregados na próxima fase.');
    }catch(e){notify(e.message,'err')}
  }
  function prizeCode(){
    const current=collect(),last=plan.phases.at(-1),target=last.id!==plan.activeId&&last.snapshot?last:phase(),data=target.id===plan.activeId?current:target.snapshot,seen=new Set(),out=[];
    function slot(code,date){if(seen.has(code))return;seen.add(code);out.push(`|{{Slot|${date?'':'localprize=0|'}{{Opponent|${code}}}${date?'|date='+date:''} }}`)}
    rank(data,target).forEach(r=>slot(r.code,''));
    [...plan.phases].reverse().filter(p=>p.completed&&p.id!==target.id).forEach(p=>(p.eliminated||[]).forEach(c=>slot(c,p.lastDate)));
    return out.join('\n');
  }
  const originalPrize=window.generatePrizepool;
  const wrappedPrize=function(){if(!plan.phases.some(p=>p.completed))return originalPrize.apply(this,arguments);const out=prizeCode(),field=$('prizepool-code');field.value=out;field.select();document.execCommand('copy');notify('Prizepool gerado com as datas dos eliminados.');return out};
  window.generatePrizepool=wrappedPrize;try{generatePrizepool=wrappedPrize}catch(_){}
  function syncDay(){
    if(importing||syncing)return;const state=api()?.getState?.(),p=phase();if(!state?.enabled||!p)return;
    const day=number(state.draftDayNumber,1),key=p.id+':'+day;if(key===lastDayKey)return;lastDayKey=key;syncing=true;
    try{
      const unlimited=p.format==='champion'&&p.unlimited&&day>1,box=$('v68-champion-rush-unlimited');
      if(box&&box.checked!==unlimited){box.checked=unlimited;box.dispatchEvent(new Event('change',{bubbles:true}))}
      const expected=day===1?p.firstDrops:p.laterDrops,filled=(collect().drops||[]).some(hasScore),input=$('num-quedas');
      if(!filled&&input&&number(input.value)!==expected){input.value=String(expected);window.applySetup?.(true)}
      $('cff-phase-current').textContent=`${p.name} • Dia ${day}/${p.days} • ${unlimited?'Quedas sem limite':expected+' quedas'}`;
      persist();
    }finally{syncing=false}
  }
  function renderPhases(){
    const host=$('cff-phase-list');if(!host)return;
    host.innerHTML=plan.phases.map((p,i)=>`<article class="cff-phase ${p.id===plan.activeId?'active':''}" data-phase="${esc(p.id)}"><header><strong>${i+1}. ${esc(p.name)} ${p.completed?'✓':''}</strong>${p.id===plan.activeId?'<span>EM EDIÇÃO</span>':`<button type="button" class="btn-mini" data-phase-open="${esc(p.id)}">${p.snapshot?'Abrir fase salva':'Abrir fase'}</button>`}</header><div class="cff-phase-fields">${field('Nome','name',p.name,'text')}${field('Times','teams',p.teams)}${field('Passam','advance',p.advance)}${field('Dias','days',p.days)}${field('Quedas no Dia 1','firstDrops',p.firstDrops)}${field('Quedas nos demais dias','laterDrops',p.laterDrops)}${field('Último dia da fase','lastDate',p.lastDate,'date')}<label>Formato<select data-field="format"><option value="classic" ${p.format==='classic'?'selected':''}>Clássico</option><option value="champion" ${p.format==='champion'?'selected':''}>Champion Point</option></select></label>${field('Champion Point','cp',p.cp)}<label class="cff-phase-check"><input type="checkbox" data-field="unlimited" ${p.unlimited?'checked':''}>Sem limite após o Dia 1</label></div>${p.id===plan.activeId?'<div class="cff-phase-actions"><button class="btn-mini" type="button" data-phase-apply>Aplicar configurações</button><button class="btn-mini" type="button" data-phase-advance>Encerrar e avançar →</button></div>':''}</article>`).join('');
    function field(label,key,value,type='number'){return `<label>${label}<input data-field="${key}" type="${type}" ${type==='number'?`min="${key==='advance'?0:1}" step="1"`:''} value="${esc(value)}"></label>`}
  }
  function setup(){
    const grid=document.querySelector('.setup-grid');if(!grid)return;
    const card=document.createElement('section');card.id='cff-admin-tournament-setup';card.innerHTML='<header><div><h2>Campeonato e fases</h2><p id="cff-phase-current"></p></div><button class="btn-mini" type="button" id="cff-final-import">↻ Carregar Final FFWS</button></header><div id="cff-admin-basic"></div><div class="cff-phase-actions"><button type="button" class="btn-mini" data-admin-tab="roster">👥 Escolher times</button><button type="button" class="btn-mini" data-admin-tab="days">📅 Dias e descansos</button><button type="button" class="btn-mini" data-admin-tab="general">🏆 Tabela geral</button></div><details id="cff-phase-details" open><summary>Fases e classificados</summary><div id="cff-phase-list"></div><button class="btn-mini" type="button" id="cff-add-phase">+ Adicionar fase</button><p class="cff-phase-hint">Encerrar e avançar salva os resultados e leva os classificados para a próxima fase. A data do último dia entra no Prizepool dos eliminados.</p></details><button class="btn-mini" type="button" id="cff-phase-recover">Baixar backup anterior</button><details id="cff-admin-advanced"><summary>Horários, pontuação e código Wiki</summary><div class="cff-admin-rules" id="cff-admin-rule-settings"></div></details>';
    grid.before(card);$('cff-admin-basic').append(grid);for(const group of [...grid.children])if(!group.querySelector('#tournament-name,#match-date,#num-quedas,#tournament-days'))$('cff-admin-rule-settings').append(group);
    const time=$('auto-time-panel');if(time)$('cff-admin-rule-settings').append(time);
    card.addEventListener('click',async e=>{
      const tab=e.target.closest('[data-admin-tab]');if(tab){api()?.open?.();document.querySelector(`[data-v76-tab="${tab.dataset.adminTab}"]`)?.click()}
      const open=e.target.closest('[data-phase-open]');if(open){if(confirm('Abrir esta fase? A fase atual ficará salva.'))try{await openPhase(open.dataset.phaseOpen)}catch(err){notify(err.message,'err')}}
      if(e.target.closest('[data-phase-apply]'))applyPhase();if(e.target.closest('[data-phase-advance]'))advance();
    });
    card.addEventListener('change',e=>{const key=e.target.dataset.field,p=plan.phases.find(p=>p.id===e.target.closest('[data-phase]')?.dataset.phase);if(!key||!p)return;
      const input=e.target;p[key]=input.type==='checkbox'?input.checked:input.type==='number'?Math.max(key==='advance'?0:1,Math.trunc(number(input.value,1))):input.value;
      if(input.type==='number')input.value=p[key];persist();lastDayKey='';
    });
    $('cff-add-phase').addEventListener('click',()=>{const current=plan.phases.at(-1),next=makePhase('Final',current.advance||12,0);next.days=2;plan.phases.push(next);persist();renderPhases()});
    $('cff-final-import').addEventListener('click',()=>{$('cff-camp-live-stage').value='final';window.CFF_CAMP_LIVE.sync()});
    $('cff-phase-recover').addEventListener('click',()=>{
      const raw=localStorage.getItem('cff_camp_before_phase_change_v1')||localStorage.getItem('cff_camp_before_live_sync_v1');
      if(!raw)return notify('Nenhuma troca de fase realizada ainda.','warn');
      const parsed=JSON.parse(raw),data=parsed.backup||parsed,url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='backup-anterior-camp.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    renderPhases();syncDay();
  }
  const style=document.createElement('style');style.textContent=`
    #cff-admin-tournament-setup{margin:16px 0;padding:18px;border:1px solid #294054;border-radius:16px;background:#0c1620;color:#ddecf6;min-width:0}#cff-admin-tournament-setup>header{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:16px}#cff-admin-tournament-setup h2{margin:0;font-size:1.05rem}#cff-phase-current{margin:6px 0 0;color:#8fd3ee;font-size:.8rem}#cff-admin-tournament-setup .setup-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;align-items:start;gap:14px;margin:0}#cff-admin-tournament-setup .form-group{min-width:0;width:auto!important;grid-column:auto!important}#cff-admin-tournament-setup label{display:flex;flex-direction:column;gap:6px;color:#a8bed4;font:700 .73rem/1.35 system-ui}#cff-admin-tournament-setup input,#cff-admin-tournament-setup select{width:100%;min-width:0;box-sizing:border-box;min-height:38px;font-size:.85rem;padding:8px;border:1px solid #294054;background:#08121c;color:#fff;border-radius:8px}#cff-admin-tournament-setup input[type=checkbox]{width:16px;min-height:16px;height:16px;flex-shrink:0}#cff-admin-tournament-setup summary{font-size:.84rem;font-weight:800;cursor:pointer;padding:14px 0}#cff-admin-tournament-setup details{border-top:1px solid #263747;margin-top:14px}.cff-phase{padding:14px;border:1px solid #2b3d4f;border-radius:12px;margin-bottom:12px}.cff-phase.active{border-color:#247fab}.cff-phase header{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}.cff-phase header span{font-size:.6rem;color:#6ddeae}.cff-phase-fields,.cff-admin-rules{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}#cff-admin-tournament-setup .cff-phase-check{flex-direction:row;align-items:center}.cff-phase-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.cff-phase-hint{font-size:.75rem;color:#8ba4b9;line-height:1.5}.cff-admin-rules{grid-template-columns:repeat(3,minmax(0,1fr))}.cff-admin-rules #auto-time-panel{grid-column:1/-1;width:100%}#cff-admin-tournament-setup .hint{font-size:.68rem;line-height:1.4;margin-top:6px}.cff-camp-integrations label{color:#a8bed4;font-size:.7rem}.cff-camp-integrations select{display:block;margin-top:4px}
    @media(max-width:1100px){.cff-phase-fields{grid-template-columns:repeat(3,minmax(0,1fr))}#cff-admin-tournament-setup .setup-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:650px){#cff-admin-tournament-setup{padding:12px}.cff-phase-fields,.cff-admin-rules{grid-template-columns:repeat(2,minmax(0,1fr))}.cff-phase header{flex-wrap:wrap}#cff-admin-tournament-setup .setup-grid{grid-template-columns:1fr!important}.cff-admin-rules #auto-time-panel .v22-day-top-grid{grid-template-columns:1fr!important}}`;
  document.head.append(style);
  window.CFF_TOURNAMENT_SETUP={getPlan:()=>clone(plan),rank,prizeCode,getWinner,isLastDay:day=>day>=phase().days,applyPhase,openPhase,advance};
  window.addEventListener('v76:tournament-state',()=>{if(!importing)setTimeout(syncDay,0)});
  const reset=api()?.resetForNewTournament;
  if(reset)api().resetForNewTournament=function(){const p=makePhase();plan={version:1,activeId:p.id,phases:[p]};liveStage='';lastDayKey='';const result=reset.apply(this,arguments);renderPhases();return result};
  setup();
  const initial=collect();
  if(/FFWS.*Segunda Fase/i.test(initial.tournamentModeV1?.name||initial.config?.tournamentName||'')&&!initial.config?.cffFfwsStage&&!localStorage.getItem('cff_ffws_final_migrated_20261005')){
    (async()=>{try{
      checkpoint(window.__CFF_CAMP_INITIAL_BACKUP__||initial);
      const root=await window.CFF_CAMP_LIVE.fetchLiveRoot(),result=await window.CFF_CAMP_LIVE.buildLiveBackup(root,'final');
      window.v37DetachStage?.();
      await window.CFF_CAMP.applyBackupText(JSON.stringify(result.backup),'Final FFWS',false);
      localStorage.setItem('cff_ffws_final_migrated_20261005','1');
      notify('Final FFWS carregada. A Segunda Fase foi preservada no backup anterior.');
    }catch(e){notify('Use Carregar Final FFWS para atualizar. Seu campeonato foi preservado.','warn')}})();
  }
})();
