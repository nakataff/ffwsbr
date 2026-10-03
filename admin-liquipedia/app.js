
let teamUidSequence = 0;
function newTeamUid(){ teamUidSequence += 1; return `team-${Date.now().toString(36)}-${teamUidSequence.toString(36)}-${Math.random().toString(36).slice(2,7)}`; }
const blankPlayer = () => ({name:'',flag:'br',link:'',team:'',role:''});
const blankTeam = () => ({
  uid:newTeamUid(), name:'', standingTeam:'', prizeTeam:'', groupTeam:'', qual:'invite', qualMethod:'', qualPage:'', qualText:'', qualPlacement:'', prize:'', prizeDate:'', allowIncomplete:false,
  players:[blankPlayer(),blankPlayer(),blankPlayer(),blankPlayer()],
  coach:{name:'',flag:'br',role:'head coach'}, analyst:{name:'',flag:'br',role:'analyst'},
  booyah:'', mp:'', kp:'', pp:'', total:'', bp:'', championActivated:false, finalPlacement:'', finalTiebreaker:'', finalMatches:[],
  groupBooyah:'', groupMp:'', groupKp:'', groupPp:'', groupTotal:'', groupRounds:['','',''], groupFfaGroup:''
});
const defaultInfobox = () => ({"displayTitle": "", "liquipediatier": "", "name": "", "shortname": "", "tickername": "", "series": "", "image": "", "imagedarkmode": "", "icon": "", "icondarkmode": "", "organizer": "", "sponsor": "", "type": "", "country": "", "date": "", "sdate": "", "edate": "", "prizepool": "", "localcurrency": "", "youtube": "", "instagram": "", "facebook": "", "kick": "", "twitter": "", "team_number": "", "previous": "", "next": "", "intro": "", "singleDate": false});
const defaultSettings = () => ({
  teamCount:12, qualifierDates:'', qualifierTeams:'', qualifyTop:'', finalDate:'', finalMatches:'',
  formatPreset:'custom', formatShowSources:'false', formatIncludeTotal:'false', formatIncludeInvited:'false', formatIncludeQualifier:'false', formatTotalTeams:'24', formatInvitedTeams:'12', formatQualifierTeams:'6', pointsShowTb:'false',
  pointsTemplate:'Points12', groupStageText:'To be Determined', finalStandingsEnabled:'true', finalStageText:'To be Determined', standingsTitle:'Finals Standings', standingFormat:'traditional', standingMode:'complete', autoPlacement:'false', headstartEnabled:'false', winnerIndex:'', winnerUid:'', localCurrency:'brl', prizeImport:'false', prizePoolMode:'complete',
  prizePresetsText:'0, 500, 1000, 1500, 2000, 3000, 5000', includeMvp:'false', mvpPrize:'', mvpPlayer:'', mvpFlag:'br', mvpTeam:'',
  prizeQualEnabled:'false', prizeQualCount:'0', prizeQualPage:'', prizeQualName:'', prizeCutAfter:'', prizeSummary:'false', prizeEliminatedDate:'',
  groupStageIncluded:'true', groupStandingsEnabled:'false', groupStageHeading:'Group Stage', groupStandingsType:'overall', groupStandingsTitle:'Group Stage Standings', groupQualifyCount:'12', groupEliminatedCount:'0', groupAdvanceTo:'Finals', groupOverallMode:'complete', groupAutoPlacement:'false', groupFfaRounds:'3', groupFfaImport:'false', groupFfaCumulative:'false', groupFfaGroupsEnabled:'false', groupFfaGroupMode:'manual', groupFfaGroupNames:'A, B, C, D', groupFfaTeamsPerGroup:'6',
  finalTeamCount:'', finalCodeMode:'simple', finalBracketId:'', finalMatchpoint:'', finalKillPoint:'1', finalPlacementPoints:'12,9,8,7,6,5,4,3,2,1,0,0', finalWinnerMatch:'', finalTwitch:'', finalYoutube:'', finalDetailedHeader:'Champion Rush', finalOverviewTitle:'Champion Rush Standings Overview', includePlayerRoles:'false', includeAnalyst:'true'
});
const defaultFormatStages = () => ([]);
const defaultGroupRoundConfigs = () => ([
  {title:'Day 1',started:'true',finished:''},
  {title:'Day 2',started:'',finished:''},
  {title:'Day 3',started:'',finished:''}
]);
const createDefaultState = () => {
  const teams=Array.from({length:12}, blankTeam);
  return {
    settings:defaultSettings(), infobox:defaultInfobox(), formatStages:defaultFormatStages(), groupRoundConfigs:defaultGroupRoundConfigs(), teams, finalDetailedMaps:[],
    prizeOrder:teams.map(t=>t.uid), groupOrder:teams.map(t=>t.uid), finalOrder:teams.map(t=>t.uid), groupFocusedGroups:[], teamDB:[],
    broadcastTalents:[], tournamentPresets:[], projectId:newTeamUid(),
    aliases:{enabled:true, players:{}, teams:{}}
  };
};
let state = createDefaultState();

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const clean = (v) => String(v ?? '').trim();
const val = (v, fallback='') => clean(v) || fallback;
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
const normalizedFlag = (person, fallback='br') => hasOwn(person, 'flag') ? clean(person.flag) : fallback;
const flagAttr = (flag) => `|flag=${clean(flag)}`;
const playerTeamAttr = (team) => clean(team) ? `|team=${clean(team)}` : '';
const playerRoleAttr = (role) => state.settings.includePlayerRoles === 'true' && clean(role) ? `|role=${clean(role)}` : '';
function qualificationDataForTeam(t){
  const preset=qualTemplate(t?.qual);
  return {
    method:clean(t?.qualMethod)||preset.method,
    page:clean(t?.qualPage),
    text:clean(t?.qualText)||preset.text,
    placement:clean(t?.qualPlacement)
  };
}
function qualificationWikiForTeam(t){
  const q=qualificationDataForTeam(t), attrs=[`method=${q.method}`];
  if(q.page) attrs.push(`page=${q.page}`);
  if(q.text) attrs.push(`text=${q.text}`);
  if(q.placement) attrs.push(`placement=${q.placement}`);
  return `{{Qualification|${attrs.join('|')}}}`;
}
const aliasKey = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const sectionImportIds = {infobox:'sectionImportInfobox',about:'sectionImportAbout',prize:'sectionImportPrize',participants:'sectionImportParticipants',groupStage:'sectionImportGroupStage',overall:'sectionImportOverall',broadcast:'sectionImportBroadcast'};
const infoboxFieldOrder = ['liquipediatier','name','shortname','tickername','series','image','imagedarkmode','icon','icondarkmode','organizer','sponsor','type','country','date','sdate','edate','prizepool','localcurrency','youtube','instagram','facebook','kick','twitter','team_number','previous','next'];
function safeClone(value){ return JSON.parse(JSON.stringify(value)); }
function formatStageId(type='stage'){ return `${type}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; }
function stageLabel(type){ return ({qualifier:'Qualifier',group:'Group Stage',point:'Point Rush',final:'Final',custom:'New Stage'})[type] || 'New Stage'; }
function blankFormatStage(type='custom'){
  const base={id:formatStageId(type),type,label:stageLabel(type),startDate:'',endDate:'',dateText:'',singleDay:type==='final',teams:'',matches:'',groups:'',teamsPerGroup:'',qualifyTop:'',advanceTo:'',headstart:false,champion:false,championPoints:'90',championMaxMatches:'8',details:''};
  if(type==='qualifier') Object.assign(base,{teams:'48',qualifyTop:'12',advanceTo:'Final'});
  if(type==='group') Object.assign(base,{teams:'24',groups:'4',teamsPerGroup:'6',qualifyTop:'12',advanceTo:'Final'});
  if(type==='point') Object.assign(base,{teams:'12',matches:'6',headstart:true});
  if(type==='final') Object.assign(base,{teams:'12',matches:'8'});
  return base;
}
function normalizeFormatStage(stage,index=0){
  const type=['qualifier','group','point','final','custom'].includes(stage?.type)?stage.type:'custom';
  return {...blankFormatStage(type),...(stage||{}),id:clean(stage?.id)||formatStageId(type),type,label:clean(stage?.label)||stageLabel(type),headstart:!!stage?.headstart,champion:!!stage?.champion,singleDay:stage?.singleDay===true || (!clean(stage?.endDate) && type==='final')};
}
function englishOrdinal(day){ const n=Number(day); const mod100=n%100; if(mod100>=11&&mod100<=13)return `${n}th`; return `${n}${n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th'}`; }
const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
function isoDateParts(value){ const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m?{y:+m[1],m:+m[2],d:+m[3]}:null; }
function wikiDateText(stage){
  if(clean(stage.dateText)) return clean(stage.dateText);
  const a=isoDateParts(stage.startDate),b=stage.singleDay?null:isoDateParts(stage.endDate); if(!a&&!b) return 'To be Determined'; const first=a||b,second=b||a;
  if(first.y===second.y&&first.m===second.m&&first.d===second.d) return `${monthNames[first.m-1]} ${englishOrdinal(first.d)}, ${first.y}`;
  if(first.y===second.y&&first.m===second.m) return `${monthNames[first.m-1]} ${englishOrdinal(first.d)} - ${englishOrdinal(second.d)}, ${first.y}`;
  if(first.y===second.y) return `${monthNames[first.m-1]} ${englishOrdinal(first.d)} - ${monthNames[second.m-1]} ${englishOrdinal(second.d)}, ${first.y}`;
  return `${monthNames[first.m-1]} ${englishOrdinal(first.d)}, ${first.y} - ${monthNames[second.m-1]} ${englishOrdinal(second.d)}, ${second.y}`;
}
function quotedDestinations(value){
  const parts=clean(value).split(/\s*(?:,|&|\band\b)\s*/i).map(clean).filter(Boolean); return parts.length?parts.map(x=>`''${x}''`).join(' and '):"''Final''";
}
function pointsTemplateWiki(){ const name=val(state.settings.pointsTemplate,'Points12').replace(/^\{\{|\}\}$/g,'').split('|')[0]; return `{{${name}${state.settings.pointsShowTb==='true'?'|showtb=true':''}}}`; }
function aboutWikiLines(){
  const s=state.settings, lines=['==About==','===Format==='];
  const includeTotal=s.formatIncludeTotal==='true' && !!clean(s.formatTotalTeams);
  const includeInvited=s.formatIncludeInvited==='true' && !!clean(s.formatInvitedTeams);
  const includeQualifier=s.formatIncludeQualifier==='true' && !!clean(s.formatQualifierTeams);
  if(includeTotal) lines.push(`* ${clean(s.formatTotalTeams)} Teams`);
  if(includeInvited) lines.push(`${includeTotal?'**':'*'} ${clean(s.formatInvitedTeams)} Invited Teams`);
  if(includeQualifier) lines.push(`${includeTotal?'**':'*'} ${clean(s.formatQualifierTeams)} Qualifier Teams`);
  (state.formatStages||[]).forEach(stage=>{
    const label=val(stage.label,stageLabel(stage.type)); lines.push(`* '''''${label}:''''' ${wikiDateText(stage)}`);
    if(clean(stage.teams) && stage.type!=='group') lines.push(`** ${clean(stage.teams)} teams`);
    if(stage.type==='group'){
      const total=val(stage.teams,'24'),groups=val(stage.groups,'4'),per=val(stage.teamsPerGroup,'6');
      lines.push(`** ''Round Robin Format:'' ${total} teams split into ${groups} groups of ${per} teams`);
      if(clean(stage.qualifyTop)) lines.push(`** {{Bgcolortext|up|Top ${clean(stage.qualifyTop)}}} qualify for ${quotedDestinations(stage.advanceTo)}.`);
    }else if(stage.type==='qualifier'){
      if(clean(stage.qualifyTop)) lines.push(`** {{Bgcolortext|up|Top ${clean(stage.qualifyTop)}}} qualify for ${quotedDestinations(stage.advanceTo)}.`);
    }else if(stage.type==='point'){
      if(clean(stage.matches)) lines.push(`** ${clean(stage.matches)} matches`);
      if(stage.headstart) lines.push('** Teams receive Headstart Points after each day based on their daily standings.');
    }else if(stage.type==='final'){
      if(stage.champion){
        const crp=val(stage.championPoints,'90'), max=clean(stage.championMaxMatches);
        lines.push(`** Champion Rush format is applied. {{ChampionRush|crp=${crp}|maxmatch=${max}|margin-left=2em}}`);
      }else if(clean(stage.matches)) lines.push(`** ${clean(stage.matches)} matches`);
    }else if(clean(stage.matches)) lines.push(`** ${clean(stage.matches)} matches`);
    clean(stage.details).split(/\r?\n/).map(clean).filter(Boolean).forEach(detail=>lines.push(`** ${detail.replace(/^\*+\s*/,'')}`));
  });
  lines.push('<br>'); lines.push(pointsTemplateWiki()); return lines;
}
function getExistingStage(type){ return (state.formatStages||[]).find(s=>s.type===type); }
function presetStage(type,overrides={}){ const old=getExistingStage(type); return normalizeFormatStage({...blankFormatStage(type),...(old||{}),...overrides,id:old?.id||formatStageId(type)}); }
function inferFormatPreset(stages=state.formatStages||[]){
  const key=stages.map(s=>s.type).join('_'); return ({qualifier_final:'qualifier_final',group_final:'group_final',group_point_final:'group_point_final',point_final:'point_final',final:'final_only'})[key]||'custom';
}
function applyFormatPreset(preset){
  const map={
    qualifier_final:()=>[presetStage('qualifier',{advanceTo:'Final'}),presetStage('final',{singleDay:true})],
    group_final:()=>[presetStage('group',{advanceTo:'Final'}),presetStage('final',{singleDay:true})],
    group_point_final:()=>[presetStage('group',{advanceTo:'Point Rush and Final'}),presetStage('point'),presetStage('final',{singleDay:true})],
    point_final:()=>[presetStage('point'),presetStage('final',{singleDay:true})],
    final_only:()=>[presetStage('final',{singleDay:true})]
  };
  if(preset==='custom'){
    state.settings.formatPreset='custom';
    if(!Array.isArray(state.formatStages) || !state.formatStages.length) state.formatStages=[blankFormatStage('custom')];
    renderFormatBuilder(); autoSave(false); return;
  }
  if(map[preset]) state.formatStages=map[preset]();
  state.settings.formatPreset=map[preset]?preset:'custom';
  if(['group_final','group_point_final'].includes(preset)){
    Object.assign(state.settings,{formatIncludeTotal:'true',formatIncludeInvited:'true',formatIncludeQualifier:'true',formatTotalTeams:'24',formatInvitedTeams:'12',formatQualifierTeams:'6'});
  }else if(['point_final','final_only'].includes(preset)){
    Object.assign(state.settings,{formatIncludeTotal:'false',formatIncludeInvited:'true',formatIncludeQualifier:'false',formatInvitedTeams:'12'});
  }else if(preset==='qualifier_final'){
    Object.assign(state.settings,{formatIncludeTotal:'false',formatIncludeInvited:'false',formatIncludeQualifier:'false'});
  }
  state.settings.formatShowSources=[state.settings.formatIncludeTotal,state.settings.formatIncludeInvited,state.settings.formatIncludeQualifier].includes('true')?'true':'false';
  renderFormatBuilder(); autoSave(false);
}
function toggleFormatSources(checked){
  const value=checked?'true':'false';
  Object.assign(state.settings,{formatShowSources:value,formatIncludeTotal:value,formatIncludeInvited:value,formatIncludeQualifier:value});
  renderFormatSourceFields(); updateFormatPreview(); autoSave(false);
}
function toggleFormatSourceItem(key,checked){
  state.settings[key]=checked?'true':'false';
  state.settings.formatShowSources=[state.settings.formatIncludeTotal,state.settings.formatIncludeInvited,state.settings.formatIncludeQualifier].includes('true')?'true':'false';
  renderFormatSourceFields(); updateFormatPreview(); autoSave(false);
}
function renderFormatSourceFields(){
  const map=[['formatIncludeTotal','formatTotalTeams'],['formatIncludeInvited','formatInvitedTeams'],['formatIncludeQualifier','formatQualifierTeams']];
  map.forEach(([checkId,inputId])=>{const check=$(checkId),input=$(inputId),enabled=state.settings[checkId]==='true';if(check)check.checked=enabled;if(input)input.disabled=!enabled;});
}
function typeOptions(selected){ return [['qualifier','Qualifier'],['group','Group Stage'],['point','Point Rush'],['final','Final'],['custom','Personalizada']].map(([v,l])=>`<option value="${v}" ${selected===v?'selected':''}>${l}</option>`).join(''); }
function renderFormatBuilder(){
  const s=state.settings; const preset=$('formatPreset'); if(preset) preset.value=['qualifier_final','group_final','group_point_final','point_final','final_only','custom'].includes(s.formatPreset)?s.formatPreset:inferFormatPreset();
  [['formatTotalTeams','formatTotalTeams'],['formatInvitedTeams','formatInvitedTeams'],['formatQualifierTeams','formatQualifierTeams']].forEach(([id,key])=>{const el=$(id);if(el)el.value=s[key]??'';});
  const tb=$('pointsShowTb'); if(tb)tb.checked=s.pointsShowTb==='true'; renderFormatSourceFields();
  const root=$('formatStages'); if(!root)return; const stages=state.formatStages||[];
  root.innerHTML=stages.length?stages.map((stage,i)=>{
    const common=`<div class="format-stage-grid three"><div><label>Data inicial</label><input type="date" value="${esc(stage.startDate)}" onchange="updateFormatStage(${i},'startDate',this.value)"></div><div><label>Data final</label><input type="date" value="${esc(stage.endDate)}" ${stage.singleDay?'disabled':''} onchange="updateFormatStage(${i},'endDate',this.value)"></div><div><label>Dia único</label><label class="champion-toggle${stage.singleDay?' active':''}"><input type="checkbox" ${stage.singleDay?'checked':''} onchange="updateFormatSingleDay(${i},this.checked)"><span>${stage.singleDay?'Uma única data':'Período com duas datas'}</span></label></div></div><div class="format-stage-grid two"><div><label>Data manual (opcional)</label><input value="${esc(stage.dateText)}" oninput="updateFormatStage(${i},'dateText',this.value)" placeholder="Ex.: January, 2026"></div><div><label>Número de times</label><input type="number" value="${esc(stage.teams)}" oninput="updateFormatStage(${i},'teams',this.value)"></div></div>`;
    let extra='';
    if(stage.type==='qualifier') extra=`<div class="format-stage-extra"><div class="format-stage-grid two"><div><label>Top que classifica</label><input type="number" value="${esc(stage.qualifyTop)}" oninput="updateFormatStage(${i},'qualifyTop',this.value)"></div><div><label>Classifica para</label><input value="${esc(stage.advanceTo)}" oninput="updateFormatStage(${i},'advanceTo',this.value)" placeholder="Final"></div></div></div>`;
    else if(stage.type==='group') extra=`<div class="format-stage-extra"><div class="format-stage-grid"><div><label>Número de grupos</label><input type="number" value="${esc(stage.groups)}" oninput="updateFormatStage(${i},'groups',this.value)"></div><div><label>Times por grupo</label><input type="number" value="${esc(stage.teamsPerGroup)}" oninput="updateFormatStage(${i},'teamsPerGroup',this.value)"></div><div><label>Top que classifica</label><input type="number" value="${esc(stage.qualifyTop)}" oninput="updateFormatStage(${i},'qualifyTop',this.value)"></div><div><label>Classifica para</label><input value="${esc(stage.advanceTo)}" oninput="updateFormatStage(${i},'advanceTo',this.value)" placeholder="Point Rush and Final"></div></div></div>`;
    else if(stage.type==='point') extra=`<div class="format-stage-extra"><div class="format-stage-grid two"><div><label>Número de partidas</label><input type="number" value="${esc(stage.matches)}" oninput="updateFormatStage(${i},'matches',this.value)"></div><div><label>Headstart Points</label><label class="champion-toggle${stage.headstart?' active':''}"><input type="checkbox" ${stage.headstart?'checked':''} onchange="updateFormatStage(${i},'headstart',this.checked)"><span>Times recebem pontos de vantagem</span></label></div></div></div>`;
    else if(stage.type==='final') extra=`<div class="format-stage-extra"><div class="format-stage-grid"><div><label>Número de partidas</label><input type="number" value="${esc(stage.matches)}" oninput="updateFormatStage(${i},'matches',this.value)"></div><div><label>Champion Point</label><label class="champion-toggle${stage.champion?' active':''}"><input type="checkbox" ${stage.champion?'checked':''} onchange="updateFormatStage(${i},'champion',this.checked)"><span>${stage.champion?'Ativado':'Desativado'}</span></label></div><div><label>Pontos para ativar</label><input type="number" value="${esc(stage.championPoints)}" ${stage.champion?'':'disabled'} oninput="updateFormatStage(${i},'championPoints',this.value)"></div><div><label>Máximo de partidas</label><div class="inline-field-actions"><input type="text" inputmode="numeric" value="${esc(stage.championMaxMatches)}" ${stage.champion?'':'disabled'} oninput="updateFormatStage(${i},'championMaxMatches',this.value)" placeholder="8 ou inf"><button type="button" class="tiny" ${stage.champion?'':'disabled'} onclick="updateFormatStage(${i},'championMaxMatches','inf');renderFormatBuilder()">inf</button></div></div></div></div>`;
    else extra=`<div class="format-stage-extra"><label>Detalhes personalizados — uma linha por item</label><textarea oninput="updateFormatStage(${i},'details',this.value)" placeholder="Ex.: Round Robin Format...">${esc(stage.details)}</textarea><div class="format-stage-grid two" style="margin-top:10px"><div><label>Número de partidas (opcional)</label><input type="number" value="${esc(stage.matches)}" oninput="updateFormatStage(${i},'matches',this.value)"></div><div class="hint" style="align-self:end;margin-bottom:10px">Cada linha vira um item iniciado por <span class="kbd">**</span>.</div></div></div>`;
    return `<div class="format-stage-card"><div class="format-stage-head"><div><label>Tipo da fase</label><select onchange="changeFormatStageType(${i},this.value)">${typeOptions(stage.type)}</select></div><div><label>Nome exibido</label><input value="${esc(stage.label)}" oninput="updateFormatStage(${i},'label',this.value)"></div><div class="format-stage-actions"><button class="tiny" onclick="moveFormatStage(${i},-1)" ${i===0?'disabled':''}>↑</button><button class="tiny" onclick="moveFormatStage(${i},1)" ${i===stages.length-1?'disabled':''}>↓</button><button class="tiny red" onclick="removeFormatStage(${i})">Remover</button></div></div><div class="format-stage-body">${common}${extra}${stage.type==='custom'?'':`<details><summary class="hint" style="cursor:pointer">Adicionar observações extras</summary><div style="padding-top:8px"><textarea oninput="updateFormatStage(${i},'details',this.value)" placeholder="Uma observação por linha">${esc(stage.details)}</textarea></div></details>`}</div></div>`;
  }).join(''):`<div class="format-empty">Nenhuma fase adicionada. Use o botão acima para criar a estrutura personalizada.</div>`;
  updateFormatPreview();
}
function updateFormatStage(i,key,value){ if(!state.formatStages?.[i])return; state.formatStages[i][key]=value; if(key==='champion'||key==='headstart'||key==='type')renderFormatBuilder(); else updateFormatPreview(); autoSave(false); }
function updateFormatSingleDay(i,checked){ if(!state.formatStages?.[i])return; state.formatStages[i].singleDay=!!checked; if(checked)state.formatStages[i].endDate=''; renderFormatBuilder(); autoSave(false); }
function changeFormatStageType(i,type){ const old=state.formatStages[i]||{}; state.formatStages[i]=normalizeFormatStage({...blankFormatStage(type),id:old.id,startDate:old.startDate,endDate:old.endDate,dateText:old.dateText,singleDay:old.singleDay,teams:old.teams||blankFormatStage(type).teams,label:stageLabel(type),details:old.details}); state.settings.formatPreset='custom'; renderFormatBuilder(); autoSave(false); }
function addFormatStage(type='custom',focusCustom=false){ state.formatStages=Array.isArray(state.formatStages)?state.formatStages:[]; state.formatStages.push(blankFormatStage(type)); state.settings.formatPreset='custom'; renderFormatBuilder(); autoSave(false); if(focusCustom){const cards=document.querySelectorAll('.format-stage-card');cards[cards.length-1]?.scrollIntoView({behavior:'smooth',block:'center'});} }
function removeFormatStage(i){ state.formatStages.splice(i,1); state.settings.formatPreset='custom'; renderFormatBuilder(); autoSave(false); }
function moveFormatStage(i,dir){ const j=i+dir;if(j<0||j>=state.formatStages.length)return;[state.formatStages[i],state.formatStages[j]]=[state.formatStages[j],state.formatStages[i]];state.settings.formatPreset='custom';renderFormatBuilder();autoSave(false); }
function updateFormatPreview(){ const el=$('formatPreview'); if(el)el.value=aboutWikiLines().join('\n'); }
async function copyFormatPreview(){ const text=aboutWikiLines().join('\n'); if($('formatPreview'))$('formatPreview').value=text; await copyText(text,'Preview do formato copiado.'); }
function parseEnglishDateToken(text,defaultYear){
  const m=clean(text).match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(\d{4}))?$/i); if(!m)return''; const month=monthNames.findIndex(x=>x.toLowerCase()===m[1].toLowerCase())+1,year=Number(m[3]||defaultYear); if(!year)return''; return `${year}-${String(month).padStart(2,'0')}-${String(Number(m[2])).padStart(2,'0')}`;
}
function parseWikiDateText(text){
  const raw=clean(text); let m=raw.match(/^([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?)\s*-\s*(\d{1,2})(?:st|nd|rd|th)?,\s*(\d{4})$/i);
  if(m){const first=parseEnglishDateToken(`${m[1]}, ${m[3]}`),p=isoDateParts(first);return{startDate:first,endDate:p?`${p.y}-${String(p.m).padStart(2,'0')}-${String(Number(m[2])).padStart(2,'0')}`:'',dateText:''};}
  m=raw.match(/^([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?)\s*-\s*([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?),\s*(\d{4})$/i);
  if(m)return{startDate:parseEnglishDateToken(`${m[1]}, ${m[3]}`),endDate:parseEnglishDateToken(`${m[2]}, ${m[3]}`),dateText:''};
  const single=parseEnglishDateToken(raw); if(single)return{startDate:single,endDate:'',dateText:'',singleDay:true}; return{startDate:'',endDate:'',dateText:raw,singleDay:false};
}

function blankBroadcastTalent(position=''){ return {position,b1:'',flag:'br',name:''}; }
function normalizeBroadcastTalent(item,index=0){ const defaults=['Host','Caster','Commentator']; return {...blankBroadcastTalent(defaults[index]||''),...(item||{}),position:clean(item?.position)||defaults[index]||'',b1:clean(item?.b1),flag:hasOwn(item||{},'flag')?clean(item.flag):'br',name:clean(item?.name)}; }
function broadcastWikiLines(){
  const lines=['==Broadcast==','===Talents===',''];
  (state.broadcastTalents||[]).forEach((talent,index)=>{
    const t=normalizeBroadcastTalent(talent,index);
    lines.push('{{BroadcasterCard');
    lines.push(`|position=${t.position}`);
    lines.push(`|b1=${t.b1}      |b1flag=${t.flag}|b1name=${t.name}`);
    lines.push('}}');
  });
  lines.push('');
  lines.push('==Additional Content==');
  lines.push("''No Content Available''");
  lines.push('');
  lines.push('===Streams===');
  lines.push('{{Streams');
  lines.push('|lang1=br|');
  lines.push('}}');
  lines.push('');
  lines.push('===Statistics===');
  lines.push("''No Content Available''");
  lines.push('');
  lines.push('==References==');
  lines.push('{{Reflist}}');
  lines.push('<!---[[Category:PC Emulator Tournaments]]--->');
  return lines;
}
function renderBroadcast(){
  if(!Array.isArray(state.broadcastTalents)) state.broadcastTalents=[];
  const root=$('broadcastTalents'); if(!root)return;
  root.innerHTML=state.broadcastTalents.length?state.broadcastTalents.map((talent,i)=>`<div class="broadcast-row"><div><label>Nome do cargo</label><input value="${esc(talent.position)}" oninput="updateBroadcastTalent(${i},'position',this.value)" placeholder="Ex.: Host & Caster"></div><div><label>Página/ID do talento (b1)</label><input value="${esc(talent.b1)}" oninput="updateBroadcastTalent(${i},'b1',this.value)" placeholder="Nome na Liquipedia"></div><div><label>Flag</label><input value="${esc(hasOwn(talent,'flag')?talent.flag:'br')}" oninput="updateBroadcastTalent(${i},'flag',this.value)" placeholder="br"></div><div><label>Nome exibido (b1name)</label><input value="${esc(talent.name)}" oninput="updateBroadcastTalent(${i},'name',this.value)" placeholder="Opcional"></div><button class="tiny red" onclick="removeBroadcastTalent(${i})">Remover</button></div>`).join(''):'<div class="format-empty">Nenhum cargo adicionado. Clique em “Adicionar cargo”.</div>';
  updateBroadcastPreview();
}
function updateBroadcastTalent(i,key,value){ if(!state.broadcastTalents?.[i])return; state.broadcastTalents[i][key]=value; updateBroadcastPreview(); autoSave(false); }
function addBroadcastTalent(){ state.broadcastTalents=Array.isArray(state.broadcastTalents)?state.broadcastTalents:[]; state.broadcastTalents.push(blankBroadcastTalent('New Position')); renderBroadcast(); autoSave(false); }
function removeBroadcastTalent(i){ state.broadcastTalents.splice(i,1); renderBroadcast(); autoSave(false); }
function updateBroadcastPreview(){ const el=$('broadcastPreview');if(el)el.value=broadcastWikiLines().join('\n'); }
async function copyBroadcastPreview(){ const value=broadcastWikiLines().join('\n');if($('broadcastPreview'))$('broadcastPreview').value=value;await copyText(value,'Broadcast e conteúdo final copiados.'); }

function aliasRegistry(type){
  if(!state.aliases) state.aliases={enabled:true,players:{},teams:{}};
  if(!state.aliases[type]) state.aliases[type]={};
  return state.aliases[type];
}
function registerAlias(type, value){
  const name=clean(value), key=aliasKey(name); if(!name || !key) return;
  const registry=aliasRegistry(type); const current=registry[key];
  if(!current){ registry[key]={canonical:name,variants:[name]}; return; }
  if(!Array.isArray(current.variants)) current.variants=[current.canonical].filter(Boolean);
  if(!current.variants.includes(name)) current.variants.push(name);
  const canonical=clean(current.canonical);
  const hasSpecial=v=>/[^\p{L}\p{N}\s]/u.test(v);
  if(!canonical || (!hasSpecial(canonical) && hasSpecial(name))) current.canonical=name;
}
function aliasSuggestion(type, value){
  if(state.aliases?.enabled === false) return '';
  const entry=aliasRegistry(type)[aliasKey(value)];
  return entry && clean(entry.canonical) && clean(entry.canonical)!==clean(value) ? clean(entry.canonical) : '';
}
function aliasHintHtml(type, value, action){
  const suggestion=aliasSuggestion(type,value);
  const call=action.replace('arguments[0]', `'${encodeURIComponent(suggestion)}'`);
  return suggestion ? `Nome já registrado: <button type="button" onclick="${call}">usar ${esc(suggestion)}</button>` : '';
}
function setAliasHint(id, type, value, action){
  const el=$(id); if(!el) return; const html=aliasHintHtml(type,value,action); el.innerHTML=html; el.classList.toggle('hidden',!html);
}


function focusLabel(text){ return `<label>${esc(text)}</label>`; }
function focusBarHtml(section, columns){
  const selected=focusState[section] || new Set();
  const buttons = columns.map(([key,label])=>`<button type="button" aria-pressed="${selected.has(key)?'true':'false'}" class="focus-chip${selected.has(key) ? ' active' : ''}" onclick="toggleColumnFocus('${section}','${key}')" title="Adicionar ou remover esta coluna do foco">📝 ${esc(label)}</button>`).join('');
  const clear = selected.size ? `<button type="button" class="focus-chip" onclick="clearColumnFocus('${section}')" title="Liberar todas as colunas e a reordenação">✕ Limpar focos</button>` : '';
  return `<span class="focus-bar-title">Foco por coluna (múltiplo):</span>${buttons}${clear}`;
}
function focusAttrs(section, key){ return `data-focus-section="${section}" data-focus-key="${key}"`; }
function saveFocusState(){
  const data = Object.fromEntries(Object.entries(focusState).map(([k,v])=>[k,[...v]]));
  localStorage.setItem('liquipediaTournamentColumnFocus', JSON.stringify(data));
}
function loadFocusState(){
  try{
    const data = JSON.parse(localStorage.getItem('liquipediaTournamentColumnFocus') || '{}');
    Object.keys(focusState).forEach(section => {
      focusState[section].clear();
      (Array.isArray(data[section]) ? data[section] : []).forEach(key => focusState[section].add(String(key)));
    });
  }catch(e){}
}
function focusSectionForScope(scope){ return scope==='final' ? 'overall' : scope; }
function isReorderLocked(scope){ return (focusState[focusSectionForScope(scope)]?.size || 0) > 0; }
function applyReorderLock(scope){
  const locked=isReorderLocked(scope);
  document.querySelectorAll(`.drag-handle[data-reorder-scope="${scope}"]`).forEach(button=>{
    button.disabled=locked;
    button.setAttribute('aria-disabled',locked?'true':'false');
    button.title=locked?'Limpe o foco por coluna para reordenar os times.':'Arrastar para mudar a posição';
  });
}
function normalizedGroupFocusedGroups(){
  const valid=new Set(ffaGroupNames());
  const source=Array.isArray(state.groupFocusedGroups)?state.groupFocusedGroups:[];
  const result=[];
  source.forEach(name=>{name=clean(name);if(valid.has(name)&&!result.includes(name)&&result.length<2)result.push(name);});
  state.groupFocusedGroups=result;
  return result;
}
function activeGroupFocusSet(){
  if(!(state.settings.groupStandingsType==='ffa' && ffaGroupsActive())) return new Set();
  return new Set(normalizedGroupFocusedGroups());
}
function applyGroupFocusRows(){
  const selected=activeGroupFocusSet(), columnLocked=(focusState.group?.size||0)>0;
  document.querySelectorAll('[data-sort-row][data-sort-scope="group"]').forEach(row=>{
    const group=clean(row.dataset.ffaGroup), active=!selected.size||selected.has(group);
    row.classList.toggle('group-row-frozen',!active);
    const handle=row.querySelector('.drag-handle[data-reorder-scope="group"]');
    if(handle){
      const locked=columnLocked||!active;
      handle.disabled=locked;
      handle.setAttribute('aria-disabled',locked?'true':'false');
      handle.title=!active?'Este grupo está congelado pelo foco por grupo.':columnLocked?'Limpe o foco por coluna para reordenar os times.':'Arrastar para mudar a posição';
    }
  });
}
function applyFocusMode(section){
  const selected = focusState[section] || new Set();
  const fields = [...document.querySelectorAll(`[data-focus-section="${section}"][data-focus-key]`)];
  const available = new Set(fields.map(el => el.dataset.focusKey));
  let changed = false;
  [...selected].forEach(key => { if(!available.has(key)){ selected.delete(key); changed = true; } });
  if(changed) saveFocusState();
  const enabled = selected.size > 0;
  const groupFocus=section==='group'?activeGroupFocusSet():new Set();
  fields.forEach(el => {
    const row=section==='group'?el.closest('[data-sort-row][data-sort-scope="group"]'):null;
    const allowedByGroup=!groupFocus.size||groupFocus.has(clean(row?.dataset.ffaGroup));
    const allowedByColumn=!enabled||selected.has(el.dataset.focusKey);
    const allowed=allowedByGroup&&allowedByColumn;
    el.disabled = !allowed;
    const cell = el.closest('.focus-cell');
    if(cell) cell.classList.toggle('focus-locked', !allowed);
  });
  const scope=section==='overall'?'final':section;
  if(['prize','group','final'].includes(scope)) applyReorderLock(scope);
  if(section==='group') applyGroupFocusRows();
}
function applyAllFocusModes(){ Object.keys(focusState).forEach(applyFocusMode); }
function rerenderFocusSection(section){
  if(section === 'prize') renderPrize();
  else if(section === 'participants') renderTeams();
  else if(section === 'group') renderGroupStandings();
  else if(section === 'overall') renderStandings();
}
function toggleColumnFocus(section, key){
  const set = focusState[section];
  if(!set) return;
  if(set.has(key)) set.delete(key); else set.add(key);
  if(section === 'participants' && key === 'playerLink'){
    if(set.has(key)){
      state.teams.forEach((t,i)=>(Array.isArray(t.players)?t.players:[]).forEach((_,j)=>openPlayerLinks.add(`${i}:${j}`)));
    }else{
      [...openPlayerLinks].forEach(token => {
        const [i,j] = token.split(':').map(Number);
        if(!clean(state.teams?.[i]?.players?.[j]?.link)) openPlayerLinks.delete(token);
      });
    }
  }
  saveFocusState();
  rerenderFocusSection(section);
}
function clearColumnFocus(section){
  const set=focusState[section];
  if(!set)return;
  set.clear();
  saveFocusState();
  rerenderFocusSection(section);
}

let selectedDbIndex = -1;
let participantsToolsOpen = false;
let teamRegistryOpen = false;
const openTeamTools = new Set();
const openPlayerLinks = new Set();
const openPlayerTeams = new Set();
const focusState = {prize:new Set(), participants:new Set(), group:new Set(), overall:new Set()};

function groupFocusBarHtml(){
  const names=ffaGroupNames(), selected=activeGroupFocusSet();
  const chips=names.map(name=>`<button type="button" aria-pressed="${selected.has(name)?'true':'false'}" class="focus-chip${selected.has(name)?' active':''}" onclick="toggleGroupFocus('${encodeURIComponent(name)}')" title="Deixar este grupo editável e congelar os demais">Grupo ${esc(name)}</button>`).join('');
  const clear=selected.size?'<button type="button" class="focus-chip" onclick="clearGroupFocus()">✕ Liberar todos</button>':'';
  return `<span class="focus-bar-title">Foco por grupo (até 2 editáveis):</span>${chips}${clear}`;
}
function toggleGroupFocus(encodedName){
  const name=clean(decodeURIComponent(encodedName||''));
  if(!ffaGroupNames().includes(name))return;
  const selected=normalizedGroupFocusedGroups();
  const index=selected.indexOf(name);
  if(index>=0) selected.splice(index,1);
  else{
    if(selected.length>=2) selected.shift();
    selected.push(name);
  }
  state.groupFocusedGroups=selected;
  renderGroupStandings();
  autoSave(false);
}
function clearGroupFocus(){
  state.groupFocusedGroups=[];
  renderGroupStandings();
  autoSave(false);
}

function normalizeRosterTeam(t){
  const base = blankTeam();
  const out = {
    name: clean(t?.name),
    code: clean(t?.code),
    aliases: Array.isArray(t?.aliases) ? t.aliases.map(clean).filter(Boolean).join(', ') : clean(t?.aliases),
    qual: t?.qual === 'qualifier' ? 'qualifier' : 'invite',
    qualMethod: clean(t?.qualMethod), qualPage: clean(t?.qualPage), qualText: clean(t?.qualText), qualPlacement: clean(t?.qualPlacement),
    players: Array.isArray(t?.players) ? t.players.map(p=>({name:clean(p?.name), flag:normalizedFlag(p), link:clean(p?.link), team:clean(p?.team), role:clean(p?.role)})).filter(p=>p.name || hasOwn(p,'flag') || p.link || p.role) : [],
    coach: {name:clean(t?.coach?.name), flag:normalizedFlag(t?.coach), role:clean(t?.coach?.role)||'head coach'},
    analyst: {name:clean(t?.analyst?.name), flag:normalizedFlag(t?.analyst), role:clean(t?.analyst?.role)||'analyst'}
  };
  if(!out.players.length) out.players = base.players;
  return out;
}

function rosterToTeam(roster, oldTeam){
  return {
    ...(oldTeam || blankTeam()),
    name: clean(roster.name),
    qual: roster.qual === 'qualifier' ? 'qualifier' : 'invite',
    qualMethod:clean(roster.qualMethod), qualPage:clean(roster.qualPage), qualText:clean(roster.qualText), qualPlacement:clean(roster.qualPlacement),
    players: Array.isArray(roster.players) ? roster.players.map(p=>({name:clean(p.name), flag:normalizedFlag(p), link:clean(p.link), team:clean(p.team), role:clean(p.role)})) : [],
    coach: {name:clean(roster.coach?.name), flag:normalizedFlag(roster.coach), role:clean(roster.coach?.role)||'head coach'},
    analyst: {name:clean(roster.analyst?.name), flag:normalizedFlag(roster.analyst), role:clean(roster.analyst?.role)||'analyst'}
  };
}

function parseTeamWikiBlock(block){
  block = String(block || '').trim();
  if(!block) return null;
  const t = normalizeRosterTeam({players:[]});
  const nameMatch = block.match(/\{\{Opponent\|([^|}\n]*)/i);
  if(nameMatch) t.name = clean(nameMatch[1]);
  const qBlock = (block.match(/\{\{Qualification\|([\s\S]*?)\}\}/i) || [,''])[1];
  if(qBlock){
    const qGet=key=>clean((qBlock.match(new RegExp('(?:^|\\|)'+key+'=([^|}]*)','i'))||[,''])[1]);
    t.qualMethod=qGet('method'); t.qualPage=qGet('page'); t.qualText=qGet('text'); t.qualPlacement=qGet('placement');
    t.qual=/qual/i.test(`${t.qualMethod} ${t.qualText}`)?'qualifier':'invite';
  }
  const unknownStaff = [];
  const personRe = /\{\{Person\|([^|}]*)((?:\|[^{}]*)*)\}\}/gi;
  let m;
  t.players = [];
  while((m = personRe.exec(block))){
    const name = clean(m[1]);
    const attrs = m[2] || '';
    const flagMatch = attrs.match(/\|flag=([^|}]*)/i);
    const flag = flagMatch ? clean(flagMatch[1]) : '';
    const roleRaw = clean((attrs.match(/\|role=([^|}]*)/i) || [,''])[1]);
    const role = roleRaw.toLowerCase();
    const typedStaff = /\|type=staff/i.test(attrs);
    const knownStaffRole = /^(?:head\s*coach|coach|analyst|analista|manager|assistant\s*coach|assistant|staff)$/i.test(roleRaw);
    const isStaff = typedStaff || knownStaffRole;
    const linkMatch = attrs.match(/\|link=([^|}]*)/i);
    const link = linkMatch ? clean(linkMatch[1]) : '';
    const teamMatch = attrs.match(/\|team=([^|}]*)/i);
    const team = teamMatch ? clean(teamMatch[1]) : '';
    const person = {name, flag, link, team, role:roleRaw};
    if(isStaff){
      if(role.includes('analyst') || role.includes('analista')) t.analyst = person;
      else if(role.includes('coach')) t.coach = person;
      else unknownStaff.push(person);
    } else {
      t.players.push(person);
    }
  }
  if(!clean(t.coach.name) && unknownStaff[0]) t.coach = unknownStaff[0];
  if(!clean(t.analyst.name) && unknownStaff[1]) t.analyst = unknownStaff[1];
  if(!t.players.length) t.players = blankTeam().players;
  return clean(t.name) ? t : null;
}

function teamToDbWiki(t){
  const r = normalizeRosterTeam(t);
  const lines = [];
  lines.push(`|{{Opponent|${val(r.name,'') }|qualification=${qualificationWikiForTeam(r)}`);
  lines.push('  |players={{Persons');
  (Array.isArray(r.players) ? r.players : []).forEach(p => {
    if(clean(p.name)) lines.push(`    |{{Person|${clean(p.name)}${flagAttr(p.flag)}${clean(p.link) ? `|link=${clean(p.link)}` : ''}${playerTeamAttr(p.team)}${playerRoleAttr(p.role)}}}`);
  });
  if(clean(r.coach.name) || clean(r.analyst.name)) lines.push('    ');
  if(clean(r.coach.name)) lines.push(`    |{{Person|${clean(r.coach.name)}${flagAttr(r.coach.flag)}|role=${clean(r.coach.role)||'head coach'}|type=staff}}`);
  if(clean(r.analyst.name)) lines.push(`    |{{Person|${clean(r.analyst.name)}${flagAttr(r.analyst.flag)}|role=${clean(r.analyst.role)||'analyst'}|type=staff}}`);
  lines.push('  }}');
  lines.push('}}');
  return lines.join('\n');
}

function saveOrUpdateTeamDb(roster){
  roster = normalizeRosterTeam(roster);
  if(!clean(roster.name)) return -1;
  if(!Array.isArray(state.teamDB)) state.teamDB = [];
  const idx = state.teamDB.findIndex(x => aliasKey(x.name) === aliasKey(roster.name));
  if(idx >= 0){
    const previous=state.teamDB[idx];
    if(!clean(roster.code)) roster.code=clean(previous.code);
    if(!clean(roster.aliases)) roster.aliases=clean(previous.aliases);
    state.teamDB[idx] = roster; selectedDbIndex = idx;
  } else { state.teamDB.push(roster); selectedDbIndex = state.teamDB.length - 1; }
  state.teamDB.sort((a,b)=>clean(a.name).localeCompare(clean(b.name), 'pt-BR', {sensitivity:'base'}));
  selectedDbIndex = state.teamDB.findIndex(x => aliasKey(x.name) === aliasKey(roster.name));
  return selectedDbIndex;
}

function splitTeamDbAliases(value){ return (Array.isArray(value)?value:clean(value).split(/[,;\n]+/)).map(clean).filter(Boolean); }
function teamDbLookupValues(team){ return [team?.name,team?.code,...splitTeamDbAliases(team?.aliases)].map(clean).filter(Boolean); }
function findTeamDbMatchIndex(value){
  const key=aliasKey(value); if(!key) return -1;
  return (Array.isArray(state.teamDB)?state.teamDB:[]).findIndex(team=>teamDbLookupValues(team).some(v=>aliasKey(v)===key));
}
function findTeamDbMatch(value){ const index=findTeamDbMatchIndex(value); return index>=0?{index,team:state.teamDB[index]}:null; }
function teamDbOptions(selectedIndex=''){
  const list = Array.isArray(state.teamDB) ? state.teamDB : [];
  if(!list.length) return '<option value="">Nenhum time salvo</option>';
  return '<option value="">Selecionar time salvo...</option>' + list.map((t,i)=>`<option value="${i}" ${String(selectedIndex)===String(i)?'selected':''}>${esc(t.name)}${clean(t.code)?` · ${esc(t.code)}`:''}</option>`).join('');
}
function participantDbMatchHintHtml(i,value){
  const match=findTeamDbMatch(value); if(!match) return '';
  const aliases=splitTeamDbAliases(match.team.aliases), meta=[clean(match.team.code),...aliases].filter(Boolean).join(' · ');
  return `Encontrado no banco: <strong>${esc(match.team.name)}</strong>${meta?` <span class="db-mini">(${esc(meta)})</span>`:''}<button type="button" class="tiny green" onclick="pullMatchingDbTeamIntoSlot(${i})">Puxar time</button>`;
}
function updateParticipantDbMatchHint(i,value){ const el=$('dbMatchTeam'+i); if(!el)return; const html=participantDbMatchHintHtml(i,value); el.innerHTML=html; el.classList.toggle('hidden',!html); }

function setPath(path, value){
  const parts = path.split('.'); let cur = state;
  for(let i=0;i<parts.length-1;i++) cur = cur[parts[i]];
  cur[parts.at(-1)] = value;
}
function bindInput(el){ setPath(el.dataset.path, el.value); autoSave(false); }
function updateInfoboxDateMode(){
  const single=state.infobox?.singleDate===true;
  const check=$('ibox_singleDate'); if(check) check.checked=single;
  const one=$('ibox_singleDateField'),start=$('ibox_startDateField'),end=$('ibox_endDateField');
  if(one) one.classList.toggle('hidden',!single);
  if(start) start.classList.toggle('hidden',single);
  if(end) end.classList.toggle('hidden',single);
}
function setInfoboxSingleDate(checked){
  if(!state.infobox) state.infobox=defaultInfobox();
  state.infobox.singleDate=!!checked;
  if(checked && !clean(state.infobox.date)) state.infobox.date=clean(state.infobox.sdate)||clean(state.infobox.edate);
  if(!checked && !clean(state.infobox.sdate) && clean(state.infobox.date)) state.infobox.sdate=clean(state.infobox.date);
  fillSettingsInputs(); updateInfoboxDateMode(); autoSave(false);
  flash('copyStatus',checked?'Infobox configurada para data única: será gerado |date=.':'Infobox configurada para período: serão gerados |sdate= e |edate=.');
}

function ensureTeamCount(n){
  n = [12,18,24].includes(+n) ? +n : 12;
  state.settings.teamCount = n;
  while(state.teams.length < n) state.teams.push(blankTeam());
  if(state.teams.length > n) state.teams = state.teams.slice(0,n);
  const qualified=Math.max(0,Math.min(n,Number(state.settings.groupQualifyCount)||0));
  state.settings.groupQualifyCount=String(qualified);
  state.settings.groupEliminatedCount=String(Math.max(0,n-qualified));
  if(clean(state.settings.finalTeamCount)) state.settings.finalTeamCount=String(Math.max(1,Math.min(n,Number(state.settings.finalTeamCount)||n)));
  state.settings.prizeQualCount=String(Math.max(0,Math.min(n,Number(state.settings.prizeQualCount)||0)));
  syncOrderArrays();
}
function setTeamCount(n){ const old=state.settings.teamCount; ensureTeamCount(n); if(!clean(state.infobox?.team_number)||String(state.infobox.team_number)===String(old)) state.infobox.team_number=String(n); renderAll(); autoSave(); }

function getPrizePresets(){
  const raw = state.settings.prizePresetsText || '0';
  const list = raw.split(',').map(x=>clean(x)).filter(Boolean);
  return [...new Set(list.length ? list : ['0'])];
}

function effectiveStandingTeam(t){ return val(t.standingTeam, t.name); }
function effectivePrizeTeam(t){ return val(t.prizeTeam, effectiveStandingTeam(t)); }
function effectiveGroupTeam(t){ return val(t.groupTeam, val(t.prizeTeam,t.name)); }
function finalStandingCount(){
  const requested=Number(state.settings.finalTeamCount);
  return Number.isInteger(requested)&&requested>0 ? Math.min(requested,state.teams.length) : state.teams.length;
}
function classificationCounts(){
  const total=state.teams.length;
  let qualified=Math.max(0,Math.min(total,Number(state.settings.groupQualifyCount)||0));
  let eliminated=Math.max(0,Math.min(total-qualified,Number(state.settings.groupEliminatedCount)||0));
  if(qualified+eliminated<total) eliminated=total-qualified;
  return {qualified,eliminated,total};
}

function normalizedOrderList(order){
  const valid=new Set(state.teams.map(t=>t.uid)), seen=new Set(), result=[];
  (Array.isArray(order)?order:[]).forEach(uid=>{uid=clean(uid);if(valid.has(uid)&&!seen.has(uid)){seen.add(uid);result.push(uid);}});
  state.teams.forEach(t=>{if(!seen.has(t.uid)){seen.add(t.uid);result.push(t.uid);}});
  return result;
}
function syncOrderArrays(){
  if(!Array.isArray(state.teams)) state.teams=[];
  const seen=new Set();
  state.teams.forEach(t=>{let uid=clean(t.uid);if(!uid||seen.has(uid))uid=newTeamUid();t.uid=uid;seen.add(uid);});
  state.prizeOrder=normalizedOrderList(state.prizeOrder);
  state.groupOrder=normalizedOrderList(state.groupOrder);
  state.finalOrder=normalizedOrderList(state.finalOrder);
}
function orderForScope(scope){
  if(scope==='group')return state.groupOrder;
  if(scope==='final')return state.finalOrder;
  return state.prizeOrder;
}
function orderedEntries(scope){
  syncOrderArrays();
  const order=orderForScope(scope);
  const byUid=new Map(state.teams.map((t,index)=>[t.uid,{team:t,teamIndex:index}]));
  return order.map((uid,orderIndex)=>({...byUid.get(uid),uid,orderIndex})).filter(x=>x.team);
}
function orderedPrizeEntries(){return orderedEntries('prize');}
function orderedGroupEntries(){return orderedEntries('group');}
function orderedFinalEntries(){return orderedEntries('final');}
function orderedPrizeTeams(){return orderedPrizeEntries().map(x=>x.team);}
function orderedGroupTeams(){return orderedGroupEntries().map(x=>x.team);}
function orderedFinalTeams(){return orderedFinalEntries().map(x=>x.team);}
function reorderHandleHtml(scope,index,label){
  const locked=isReorderLocked(scope), title=locked?'Limpe o foco por coluna para reordenar os times.':'Arrastar para mudar a posição';
  return `<button type="button" class="drag-handle" data-reorder-scope="${scope}" title="${title}" aria-label="Mover ${esc(label)}" aria-disabled="${locked?'true':'false'}" ${locked?'disabled':''} onpointerdown="startRowReorder(event,'${scope}',${index})" onkeydown="handleReorderKey(event,'${scope}',${index})">☰</button>`;
}
function adjustedMovedIndex(current,from,to){
  current=Number(current);
  if(!Number.isInteger(current))return current;
  if(current===from)return to;
  if(from<to && current>from && current<=to)return current-1;
  if(to<from && current>=to && current<from)return current+1;
  return current;
}
function renderOrderedScope(scope){
  if(scope==='group')renderGroupStandings();
  else if(scope==='final')renderStandings();
  else renderPrize();
}
function visibleOrderLength(scope){ return scope==='final' ? finalStandingCount() : orderForScope(scope).length; }
function moveOrderedRow(scope,from,to){
  syncOrderArrays();
  if(isReorderLocked(scope)){flash('copyStatus','Limpe o foco por coluna antes de reordenar os times.');renderOrderedScope(scope);return;}
  const order=orderForScope(scope);
  from=Number(from);to=Number(to);
  const visibleLength=visibleOrderLength(scope);
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=visibleLength||to>=visibleLength||from===to)return;
  const [uid]=order.splice(from,1);order.splice(to,0,uid);
  if(scope==='group') syncMovedFfaGroupFromRowPosition(uid,from,to);
  if(scope==='final') syncLegacyWinnerIndex();
  renderOrderedScope(scope);
  autoSave(false);
  flash('copyStatus',`Linha movida para a posição ${to+1}.`);
}
function handleReorderKey(event,scope,index){
  if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
  event.preventDefault();
  if(isReorderLocked(scope)){flash('copyStatus','Limpe o foco por coluna antes de reordenar os times.');return;}
  const length=visibleOrderLength(scope);
  const to=event.key==='Home'?0:event.key==='End'?length-1:event.key==='ArrowUp'?Math.max(0,index-1):Math.min(length-1,index+1);
  moveOrderedRow(scope,index,to);
  requestAnimationFrame(()=>{const handle=document.querySelector(`[data-sort-scope="${scope}"][data-sort-index="${to}"] .drag-handle`);if(handle)handle.focus();});
}
let activeRowSort=null;
function startRowReorder(event,scope,index){
  if(isReorderLocked(scope)){flash('copyStatus','Limpe o foco por coluna antes de reordenar os times.');return;}
  if(event.pointerType==='mouse'&&event.button!==0)return;
  const row=event.currentTarget.closest('[data-sort-row]');
  if(!row)return;
  activeRowSort={scope,from:Number(index),to:Number(index),row,container:row.parentElement,handle:event.currentTarget,pointerId:event.pointerId};
  row.classList.add('sorting-active');document.body.classList.add('row-reordering');
  try{event.currentTarget.setPointerCapture(event.pointerId);}catch(e){}
  event.preventDefault();
}
function moveActiveRow(event){
  if(!activeRowSort)return;
  event.preventDefault();
  const target=document.elementFromPoint(event.clientX,event.clientY)?.closest(`[data-sort-row][data-sort-scope="${activeRowSort.scope}"]`);
  if(!target||target===activeRowSort.row||target.parentElement!==activeRowSort.container)return;
  const rect=target.getBoundingClientRect();
  activeRowSort.container.insertBefore(activeRowSort.row,event.clientY<rect.top+rect.height/2?target:target.nextSibling);
  const rows=[...activeRowSort.container.querySelectorAll(`[data-sort-row][data-sort-scope="${activeRowSort.scope}"]`)];
  activeRowSort.to=rows.indexOf(activeRowSort.row);
}
function finishActiveRow(){
  if(!activeRowSort)return;
  const {scope,from,to,row,handle,pointerId}=activeRowSort;
  row.classList.remove('sorting-active');document.body.classList.remove('row-reordering');
  try{handle.releasePointerCapture(pointerId);}catch(e){}
  activeRowSort=null;
  if(from!==to)moveOrderedRow(scope,from,to);else renderOrderedScope(scope);
}
window.addEventListener('pointermove',moveActiveRow,{passive:false});
window.addEventListener('pointerup',finishActiveRow);
window.addEventListener('pointercancel',finishActiveRow);

function toNumber(v){
  const n = Number(String(v ?? '').replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
}
function calculatePlacementPoints(t){
  const total = toNumber(t.total);
  const kp = toNumber(t.kp) ?? 0;
  if(total === null) return '';
  return String(total - kp);
}
function updateAutoPP(i){
  if(state.settings.autoPlacement === 'true' && state.teams[i]){
    state.teams[i].pp = calculatePlacementPoints(state.teams[i]);
    const el = $('autoPp' + i);
    if(el) el.value = state.teams[i].pp;
  }
}
function refreshAllAutoPP(){
  if(state.settings.autoPlacement === 'true') state.teams.forEach((_,i)=>updateAutoPP(i));
}
function calculateGroupPlacementPoints(t){
  const total = toNumber(t.groupTotal);
  const kp = toNumber(t.groupKp) ?? 0;
  if(total === null) return '';
  return String(total - kp);
}
function updateGroupAutoPP(i){
  if(state.settings.groupAutoPlacement === 'true' && state.teams[i]){
    state.teams[i].groupPp = calculateGroupPlacementPoints(state.teams[i]);
    const el = $('groupAutoPp' + i);
    if(el) el.value = state.teams[i].groupPp;
  }
}
function refreshAllGroupAutoPP(){
  if(state.settings.groupAutoPlacement === 'true') state.teams.forEach((_,i)=>updateGroupAutoPP(i));
}

function fillSettingsInputs(){
  const s = state.settings;
  ['teamCount','standingFormat','standingMode','pointsTemplate','standingsTitle','groupStageText','finalStandingsEnabled','finalStageText','localCurrency','prizePoolMode','prizePresets','includeMvp','mvpTeam','mvpPlayer','mvpFlag','mvpPrize','prizeImport','prizeQualEnabled','prizeQualCount','prizeQualPage','prizeQualName','prizeCutAfter','prizeSummary','prizeEliminatedDate','groupStageIncluded','groupStandingsEnabled','groupStageHeading','groupStandingsType','groupStandingsTitle','groupQualifyCount','groupEliminatedCount','groupAdvanceTo','groupOverallMode','groupFfaRounds','groupFfaImport','groupFfaGroupMode','groupFfaGroupNames','groupFfaTeamsPerGroup','finalTeamCount','finalCodeMode','finalMatchpoint','finalBracketId','finalYoutube','finalTwitch'].forEach(id=>{
    const el = $(id); if(!el) return;
    if(id === 'prizePresets') el.value = s.prizePresetsText ?? '';
    else el.value = s[id] ?? '';
  });
  document.querySelectorAll('[data-path^="infobox."]').forEach(el=>{
    const key=el.dataset.path.split('.')[1]; el.value=state.infobox?.[key] ?? '';
  });
  const autoCheck = $('autoPlacementCheck'); if(autoCheck) autoCheck.checked = s.autoPlacement === 'true';
  const groupAutoCheck = $('groupAutoPlacementCheck'); if(groupAutoCheck) groupAutoCheck.checked = s.groupAutoPlacement === 'true';
  const groupFfaCumulativeCheck = $('groupFfaCumulativeCheck'); if(groupFfaCumulativeCheck) groupFfaCumulativeCheck.checked = s.groupFfaCumulative === 'true';
  const groupFfaGroupsEnabledCheck = $('groupFfaGroupsEnabledCheck'); if(groupFfaGroupsEnabledCheck) groupFfaGroupsEnabledCheck.checked = s.groupFfaGroupsEnabled === 'true';
  const headstartCheck = $('headstartCheck'); if(headstartCheck) headstartCheck.checked = s.headstartEnabled === 'true';
  const aliasesEnabled=$('aliasesEnabled'); if(aliasesEnabled) aliasesEnabled.checked=state.aliases?.enabled !== false;
  const includePlayerRolesCheck=$('includePlayerRolesCheck'); if(includePlayerRolesCheck) includePlayerRolesCheck.checked=s.includePlayerRoles === 'true';
  const analyst=$('includeAnalystCheck');if(analyst)analyst.checked=s.includeAnalyst!=='false';
  updateInfoboxDateMode();
  $('teamCountBadge').textContent = s.teamCount;
}

function renderPrize(){
  const bar = $('prizeFocusBar'); if(bar) bar.innerHTML = focusBarHtml('prize', [['team','Time'],['preset','Valor rápido'],['value','Valor editável'],['date','Data']]);
  const rows = $('prizeRows'); const presets = getPrizePresets();
  const {qualified}=classificationCounts();
  rows.innerHTML = orderedPrizeEntries().map(({team:t,teamIndex:i,orderIndex})=>{
    const hasPreset = presets.includes(String(t.prize ?? ''));
    const options = presets.map(p=>`<option value="${esc(p)}" ${String(t.prize)==String(p)?'selected':''}>R$ ${esc(p)}</option>`).join('') + `<option value="custom" ${hasPreset?'':'selected'}>Personalizado</option>`;
    const status=orderIndex<qualified?'<span class="classification-badge up">FINAL</span>':'<span class="classification-badge down">ELIMINADO</span>';
    return `<div class="prize-line sortable-row" data-sort-row data-sort-scope="prize" data-sort-index="${orderIndex}">
      <div><div class="team-number">${orderIndex+1}</div>${status}</div>
      <div class="sortable-team-cell">${reorderHandleHtml('prize',orderIndex,effectivePrizeTeam(t)||`time ${orderIndex+1}`)}<div class="focus-cell">${focusLabel('Time no Prize Pool','prize','team')}<input id="prizeTeam${i}" ${focusAttrs('prize','team')} value="${esc(effectivePrizeTeam(t))}" oninput="updatePrizeTeamAliasInput(${i},this.value)"><div id="aliasPrizeTeam${i}" class="alias-suggestion hidden"></div></div></div>
      <div class="focus-cell">${focusLabel('Valor rápido','prize','preset')}<select ${focusAttrs('prize','preset')} onchange="choosePrize(${i},this.value)">${options}</select></div>
      <div class="focus-cell">${focusLabel('Valor editável','prize','value')}<input ${focusAttrs('prize','value')} value="${esc(t.prize)}" oninput="updateTeam(${i},'prize',this.value)"></div>
      <div class="focus-cell">${focusLabel('Data / eliminação','prize','date')}<input ${focusAttrs('prize','date')} type="date" value="${esc(t.prizeDate||'')}" oninput="updateTeam(${i},'prizeDate',this.value)"></div>
    </div>`;
  }).join('');
  applyFocusMode('prize');
}

function teamCompletion(t){
  const players=Array.isArray(t?.players)?t.players:[];
  const missing=[];
  if(!clean(t?.name)) missing.push('time');
  if(!players.length || players.some(p=>!clean(p?.name))) missing.push('jogadores');
  if(!clean(t?.coach?.name)) missing.push('coach');
  if(state.settings.includeAnalyst!=='false' && !clean(t?.analyst?.name)) missing.push('analyst');
  const empty=!clean(t?.name) && !players.some(p=>clean(p?.name)) && !clean(t?.coach?.name) && !clean(t?.analyst?.name);
  if(!missing.length) return {className:'team-complete',label:'COMPLETO',statusClass:'complete',missing:[]};
  if(t?.allowIncomplete) return {className:'team-accepted',label:'OK INCOMPLETO',statusClass:'accepted',missing};
  return {className:empty?'team-empty':'team-incomplete',label:empty?'NÃO PREENCHIDO':'INCOMPLETO',statusClass:empty?'empty':'incomplete',missing};
}
function refreshTeamCompletion(i){
  const card=$('participantTeamCard'+i), badge=$('teamStatus'+i); if(!card||!badge) return;
  const status=teamCompletion(state.teams[i]);
  card.classList.remove('team-empty','team-incomplete','team-complete','team-accepted'); card.classList.add(status.className);
  badge.className='team-status '+status.statusClass; badge.textContent=status.label;
}
function renderTeams(){
  const bar = $('participantsFocusBar'); if(bar) bar.innerHTML = focusBarHtml('participants', [['teamName','Time'],['playerName','Jogadores'],['playerLink','Links'],['playerTeam','Team opcional'],['playerRole','Roles'],['playerFlag','Flags dos jogadores'],['coachName','Coach'],['coachFlag','Flag coach'],...(state.settings.includeAnalyst!=='false'?[['analystName','Analyst'],['analystFlag','Flag analyst']]:[])]);
  const root = $('teamsContainer');
  root.innerHTML = state.teams.map((t,i)=>{
    const players = Array.isArray(t.players) ? t.players : [];
    const toolsOpen = openTeamTools.has(i) ? ' open' : '';
    const status=teamCompletion(t);
    return `<div class="team-card ${status.className}" id="participantTeamCard${i}">
      <div class="team-head">
        <div class="team-number">${i+1}</div>
        <div class="focus-cell">${focusLabel('Nome/código do time depois de Opponent','participants','teamName')}<input id="teamName${i}" ${focusAttrs('participants','teamName')} value="${esc(t.name)}" oninput="updateTeamAliasInput(${i},'name',this.value)"><div id="aliasTeamName${i}" class="alias-suggestion hidden"></div><div id="dbMatchTeam${i}" class="db-match-suggestion${participantDbMatchHintHtml(i,t.name)?'':' hidden'}">${participantDbMatchHintHtml(i,t.name)}</div></div>
        <div class="team-head-actions"><span id="teamStatus${i}" class="team-status ${status.statusClass}">${esc(status.label)}</span><button tabindex="-1" class="tiny gear-btn" title="Opções deste time" onclick="toggleTeamTools(${i})">⚙</button></div>
      </div>
      <div class="team-body">
        <div id="teamTools${i}" class="team-tool-panel${toolsOpen}">
          <div class="option-card">
            <div class="option-card-title">Banco de dados</div>
            <div class="db-card-controls">
              <div><label>Time salvo</label><select id="teamDbSlot${i}">${teamDbOptions(findTeamDbMatchIndex(t.name))}</select></div>
              <button class="tiny green" onclick="pullDbTeamIntoSlot(${i})">Puxar time</button>
              <button class="tiny" onclick="saveParticipantToDb(${i})">Salvar time</button>
            </div>
          </div>
          <div class="option-card">
            <div class="option-card-title">Configurações deste time</div>
            <div class="team-settings-grid">
              <div><label>Qualificação</label><select onchange="setTeamQualificationPreset(${i},this.value)"><option value="invite" ${t.qual==='invite'?'selected':''}>Invited</option><option value="qualifier" ${t.qual==='qualifier'?'selected':''}>Qualifier</option></select></div>
              <div><label>Flag dos participantes</label><div class="inline-field-actions"><input id="teamFlagInput${i}" placeholder="Ex.: pt"><button class="tiny green" onclick="applyTeamParticipantFlag(${i})">Aplicar</button><button class="tiny red" onclick="clearTeamParticipantFlags(${i})">Apagar</button></div></div>
            </div>
            <details class="staff-details" style="margin-top:10px"><summary tabindex="-1">Qualificação personalizada</summary><div class="staff-content"><div class="row4">
              <div><label>Method</label><input value="${esc(t.qualMethod||'')}" oninput="updateTeam(${i},'qualMethod',this.value)" placeholder="qual"></div>
              <div><label>Page</label><input value="${esc(t.qualPage||'')}" oninput="updateTeam(${i},'qualPage',this.value)"></div>
              <div><label>Text</label><input value="${esc(t.qualText||'')}" oninput="updateTeam(${i},'qualText',this.value)"></div>
              <div><label>Placement</label><input value="${esc(t.qualPlacement||'')}" oninput="updateTeam(${i},'qualPlacement',this.value)"></div>
            </div></div></details>
            <div class="actions" style="margin-top:10px"><button class="tiny primary" onclick="copyParticipantTeam(${i})">Copiar código deste time</button></div>
          </div>
          <div class="option-card">
            <div class="option-card-title">Ações deste slot</div>
            <label class="compact-check"><input type="checkbox" ${t.allowIncomplete?'checked':''} onchange="setIncompleteOk(${i},this.checked)"><span>Aceitar elenco incompleto</span></label>
            <div class="danger-actions" style="margin-top:10px">
              <button class="tiny" onclick="clearParticipantTeam(${i})">Limpar só Participantes</button>
              <button class="tiny red" onclick="clearTeamEverywhere(${i})">Limpar em todas as seções</button>
            </div>
            <div class="hint">“Só Participantes” preserva pontuação, Prize Pool, Group Stage e Final. “Todas as seções” zera completamente este slot.</div>
          </div>
          <div class="option-card team-import-card">
            <div class="option-card-title">Colar apenas este time</div>
            <textarea id="teamWikiPaste${i}" placeholder="Cole aqui um bloco |{{Opponent|...}} com jogadores, staff e qualificação"></textarea>
            <div class="actions" style="margin-top:8px"><button class="tiny green" onclick="importParticipantTeamIntoSlot(${i})">Ler e preencher este slot</button><button class="tiny" onclick="$('teamWikiPaste${i}').value=''">Limpar caixa</button></div>
            <div class="hint">Se houver roles nos jogadores, o sistema pergunta antes de importá-las. As roles de staff são importadas automaticamente.</div>
          </div>
        </div>
        <div class="actions" style="justify-content:space-between"><div class="small-title" style="margin:0">Jogadores <span class="pill">${players.length}</span></div><button tabindex="-1" class="tiny green" onclick="addPlayer(${i})">+ Adicionar jogador</button></div>
        ${players.length ? players.map((p,j)=>{
          const key=`${i}:${j}`, linkOpen=openPlayerLinks.has(key), teamOpen=openPlayerTeams.has(key), hasLink=!!clean(p.link), hasTeam=!!clean(p.team);
          return `<div class="player-line${linkOpen?' link-open':''}${teamOpen?' team-open':''}">
          <div class="focus-cell">${focusLabel(`Jogador ${j+1}`,'participants','playerName')}<input id="playerName${i}_${j}" ${focusAttrs('participants','playerName')} value="${esc(p.name)}" oninput="updatePlayerAliasInput(${i},${j},this.value)"><div id="aliasPlayer${i}_${j}" class="alias-suggestion hidden"></div></div>
          <div class="player-link-field focus-cell">${focusLabel('Link do perfil','participants','playerLink')}<input ${focusAttrs('participants','playerLink')} value="${esc(p.link||'')}" oninput="updatePlayer(${i},${j},'link',this.value)" placeholder="Ex.: name (portuguese player)"></div>
          <div class="player-team-field focus-cell">${focusLabel('👕 Team','participants','playerTeam')}<input id="playerTeam${i}_${j}" ${focusAttrs('participants','playerTeam')} value="${esc(p.team||'')}" oninput="updatePlayerTeamAliasInput(${i},${j},this.value)" placeholder="Ex.: loud"><div id="aliasPlayerTeam${i}_${j}" class="alias-suggestion hidden"></div></div>
          <div class="focus-cell">${focusLabel('Role','participants','playerRole')}<input ${focusAttrs('participants','playerRole')} value="${esc(p.role||'')}" oninput="updatePlayer(${i},${j},'role',this.value)" placeholder="rusher"></div>
          <div class="focus-cell">${focusLabel('Flag','participants','playerFlag')}<input ${focusAttrs('participants','playerFlag')} value="${esc(hasOwn(p,'flag')?p.flag:'br')}" oninput="updatePlayer(${i},${j},'flag',this.value)"></div>
          <button tabindex="-1" class="tiny link-toggle${linkOpen||hasLink?' active':''} player-actions-button" title="Link do perfil" onclick="togglePlayerLink(${i},${j})">🔗</button>
          <button tabindex="-1" class="tiny team-toggle${teamOpen||hasTeam?' active':''} player-actions-button" title="Team opcional" onclick="togglePlayerTeam(${i},${j})">👕</button>
          <button tabindex="-1" class="tiny red player-actions-button" title="Remover jogador" onclick="removePlayer(${i},${j})">−</button>
        </div>`;
        }).join('') : `<div class="hint">Nenhum jogador neste time. Clique em adicionar jogador para criar uma linha.</div>`}
        <details class="staff-details"><summary tabindex="-1">Staff — head coach${state.settings.includeAnalyst!=='false'?' e analista':''}</summary><div class="staff-content"><div class="staff-line">
          <div class="focus-cell">${focusLabel('Head coach','participants','coachName')}<input id="coachName${i}" ${focusAttrs('participants','coachName')} value="${esc(t.coach?.name)}" oninput="updateStaffAliasInput(${i},'coach',this.value)"><div id="aliasCoach${i}" class="alias-suggestion hidden"></div></div>
          <div class="focus-cell">${focusLabel('Flag','participants','coachFlag')}<input ${focusAttrs('participants','coachFlag')} value="${esc(hasOwn(t.coach,'flag')?t.coach.flag:'br')}" oninput="updateStaff(${i},'coach','flag',this.value)"></div>
${state.settings.includeAnalyst!=='false'?`          <div class="focus-cell">${focusLabel('Analyst','participants','analystName')}<input id="analystName${i}" ${focusAttrs('participants','analystName')} value="${esc(t.analyst?.name)}" oninput="updateStaffAliasInput(${i},'analyst',this.value)"><div id="aliasAnalyst${i}" class="alias-suggestion hidden"></div></div>
          <div class="focus-cell">${focusLabel('Flag','participants','analystFlag')}<input ${focusAttrs('participants','analystFlag')} value="${esc(hasOwn(t.analyst,'flag')?t.analyst.flag:'br')}" oninput="updateStaff(${i},'analyst','flag',this.value)"></div>`:''}
        </div></div></details>
      </div>
    </div>`;
  }).join('');
  if([...focusState.participants].some(key=>['coachName','coachFlag','analystName','analystFlag'].includes(key))) root.querySelectorAll('.staff-details').forEach(el=>{el.open=true;});
  applyFocusMode('participants');
}

function normalizeRoundBoolean(value){ return value==='true'?'true':value==='false'?'false':''; }
function ensureGroupRoundCapacity(count){
  count=Math.max(1,Math.min(24,Number(count)||1));
  state.settings.groupFfaRounds=String(count);
  if(!Array.isArray(state.groupRoundConfigs)) state.groupRoundConfigs=[];
  while(state.groupRoundConfigs.length<count) state.groupRoundConfigs.push({title:`Day ${state.groupRoundConfigs.length+1}`,started:'',finished:''});
  state.groupRoundConfigs=state.groupRoundConfigs.slice(0,count).map((r,i)=>({title:clean(r?.title)||`Day ${i+1}`,started:normalizeRoundBoolean(r?.started),finished:normalizeRoundBoolean(r?.finished)}));
  state.teams.forEach(t=>{ if(!Array.isArray(t.groupRounds)) t.groupRounds=[]; while(t.groupRounds.length<count)t.groupRounds.push(''); t.groupRounds=t.groupRounds.slice(0,count); });
}
function setGroupStageIncluded(value){ state.settings.groupStageIncluded=value==='false'?'false':'true'; generateWiki(false); autoSave(false); }
function setGroupStandingsEnabled(value){ state.settings.groupStandingsEnabled=value==='true'?'true':'false'; renderGroupStandings(); autoSave(false); }
function setGroupStandingsType(value){ state.settings.groupStandingsType=value==='ffa'?'ffa':'overall'; renderGroupStandings(); autoSave(false); }
function setGroupFfaCumulative(checked){
  state.settings.groupFfaCumulative=checked?'true':'false';
  renderGroupStandings();
  autoSave(false);
}
function ffaGroupNames(){
  const source=clean(state.settings.groupFfaGroupNames)||'A, B, C, D';
  const seen=new Set(), names=[];
  source.split(/[,;\n]+/).map(clean).filter(Boolean).forEach(name=>{const key=name.toLowerCase();if(!seen.has(key)){seen.add(key);names.push(name);}});
  return names.length?names:['A','B','C','D'];
}
function ffaTeamsPerGroup(){ return Math.max(1,Math.min(24,Number(state.settings.groupFfaTeamsPerGroup)||6)); }
function ffaGroupsActive(){ return state.settings.groupStandingsType==='ffa' && state.settings.groupFfaGroupsEnabled==='true'; }
function groupNameForOrderIndex(orderIndex){
  if(!ffaGroupsActive()) return '';
  const names=ffaGroupNames(), index=Math.floor(Number(orderIndex)/ffaTeamsPerGroup());
  return names[index]||'';
}
function groupNameForEntry(team,orderIndex){
  if(!ffaGroupsActive()) return '';
  const assigned=clean(team?.groupFfaGroup), names=ffaGroupNames();
  return names.includes(assigned)?assigned:groupNameForOrderIndex(orderIndex);
}
function assignMissingFfaGroupsFromOrder(){
  const names=ffaGroupNames(), per=ffaTeamsPerGroup();
  orderedGroupEntries().forEach(({team,orderIndex})=>{
    if(!names.includes(clean(team.groupFfaGroup))) team.groupFfaGroup=names[Math.floor(orderIndex/per)]||'';
  });
}
function syncGroupOrderFromFfaAssignments(movedUid=''){
  syncOrderArrays();
  const names=ffaGroupNames(), entries=orderedGroupEntries();
  const buckets=new Map(names.map(name=>[name,[]])), unassigned=[];
  entries.forEach(({team})=>{
    if(team.uid===movedUid) return;
    const group=clean(team.groupFfaGroup);
    if(buckets.has(group)) buckets.get(group).push(team.uid); else unassigned.push(team.uid);
  });
  if(movedUid){
    const moved=state.teams.find(team=>team.uid===movedUid);
    if(moved){
      const group=clean(moved.groupFfaGroup);
      if(buckets.has(group)) buckets.get(group).push(moved.uid); else unassigned.push(moved.uid);
    }
  }
  state.groupOrder=names.flatMap(name=>buckets.get(name)).concat(unassigned);
}
function syncMovedFfaGroupFromRowPosition(uid,from,to){
  if(!ffaGroupsActive()) return;
  const order=state.groupOrder, moved=state.teams.find(team=>team.uid===uid); if(!moved)return;
  const byUid=new Map(state.teams.map(team=>[team.uid,team]));
  const validGroup=team=>{const name=clean(team?.groupFfaGroup);return ffaGroupNames().includes(name)?name:'';};
  const previous=validGroup(byUid.get(order[to-1]));
  const next=validGroup(byUid.get(order[to+1]));
  let target='';
  if(to>from) target=previous||next;
  else if(to<from) target=next||previous;
  else target=validGroup(moved);
  if(target) moved.groupFfaGroup=target;
}
function setGroupFfaGroupsEnabled(checked){
  state.settings.groupFfaGroupsEnabled=checked?'true':'false';
  if(checked){assignMissingFfaGroupsFromOrder();syncGroupOrderFromFfaAssignments();}
  renderGroupStandings(); autoSave(false);
}
function setGroupFfaGroupMode(){
  state.settings.groupFfaGroupMode='manual';
  assignMissingFfaGroupsFromOrder();
  syncGroupOrderFromFfaAssignments();
  renderGroupStandings(); autoSave(false);
}
function setGroupFfaGroupNames(value){
  const oldNames=ffaGroupNames();
  state.settings.groupFfaGroupNames=value;
  const newNames=ffaGroupNames();
  state.teams.forEach(team=>{
    const oldIndex=oldNames.indexOf(clean(team.groupFfaGroup));
    if(oldIndex>=0) team.groupFfaGroup=newNames[oldIndex]||'';
    else if(!newNames.includes(clean(team.groupFfaGroup))) team.groupFfaGroup='';
  });
  assignMissingFfaGroupsFromOrder();
  syncGroupOrderFromFfaAssignments();
  normalizedGroupFocusedGroups();
  renderGroupStandings(); autoSave(false);
}
function setGroupFfaTeamsPerGroup(value){
  state.settings.groupFfaTeamsPerGroup=String(Math.max(1,Math.min(24,Number(value)||6)));
  assignMissingFfaGroupsFromOrder();
  renderGroupStandings(); autoSave(false);
}
let draggedFfaGroupUid='';
function startFfaGroupDrag(event,uid){ draggedFfaGroupUid=uid; event.dataTransfer.effectAllowed='move'; event.dataTransfer.setData('text/plain',uid); event.currentTarget.classList.add('dragging'); }
function finishFfaGroupDrag(event){ event.currentTarget.classList.remove('dragging'); document.querySelectorAll('.ffa-group-column.drag-over').forEach(el=>el.classList.remove('drag-over')); }
function allowFfaGroupDrop(event){ event.preventDefault(); event.dataTransfer.dropEffect='move'; event.currentTarget.classList.add('drag-over'); }
function leaveFfaGroupDrop(event){ if(!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.classList.remove('drag-over'); }
function assignFfaTeamGroup(uid,groupIndex){
  const team=state.teams.find(t=>t.uid===uid); if(!team)return;
  team.groupFfaGroup=groupIndex>=0?(ffaGroupNames()[groupIndex]||''):'';
  syncGroupOrderFromFfaAssignments(uid);
  renderGroupStandings(); autoSave(false);
}
function dropFfaGroupTeam(event,groupIndex){
  event.preventDefault(); const uid=event.dataTransfer.getData('text/plain')||draggedFfaGroupUid; draggedFfaGroupUid=''; assignFfaTeamGroup(uid,groupIndex);
}
function moveFfaTeamGroup(uid,direction){
  const team=state.teams.find(t=>t.uid===uid); if(!team)return;
  const names=ffaGroupNames(), current=names.indexOf(clean(team.groupFfaGroup));
  const next=Math.max(0,Math.min(names.length-1,(current<0?0:current)+Number(direction)));
  assignFfaTeamGroup(uid,next);
}
function ffaGroupDistribution(){
  assignMissingFfaGroupsFromOrder();
  const entries=orderedGroupEntries(), names=ffaGroupNames(), per=ffaTeamsPerGroup();
  const groups=names.map((name,index)=>({name,index,entries:[]})), unassigned=[];
  entries.forEach(entry=>{
    const name=groupNameForEntry(entry.team,entry.orderIndex);
    const group=groups.find(g=>g.name===name); if(group)group.entries.push(entry); else unassigned.push(entry);
  });
  return {groups,unassigned,entries,per,capacity:names.length*per};
}
function renderFfaGroupOrganizer(){
  const root=$('groupOrganizerWrap'), disclosure=$('groupOrganizerDisclosure'); if(!root)return;
  const active=ffaGroupsActive(); if(disclosure)disclosure.classList.toggle('hidden',!active); if(!active){root.innerHTML='';return;}
  const {groups,unassigned,entries,per,capacity}=ffaGroupDistribution();
  const countWarning=capacity!==entries.length;
  const balanceWarning=groups.some(g=>g.entries.length!==per)||unassigned.length>0;
  const statusClass=countWarning||balanceWarning?' warn':'';
  const status=countWarning?`A configuração comporta ${capacity} times, mas existem ${entries.length}. Ajuste os grupos ou “Times por grupo”.`:balanceWarning?'Existem grupos com quantidade diferente do esperado. Mova as equipes até todos ficarem equilibrados.':'Todos os grupos estão equilibrados.';
  const cols=groups.map(g=>{
    const bad=g.entries.length!==per, chips=g.entries.map(({team})=>`<div class="ffa-group-team" draggable="true" ondragstart="startFfaGroupDrag(event,'${team.uid}')" ondragend="finishFfaGroupDrag(event)"><button type="button" class="ffa-group-move tiny" onclick="moveFfaTeamGroup('${team.uid}',-1)" title="Mover para o grupo anterior">←</button><div class="ffa-group-team-name" title="${esc(effectiveGroupTeam(team))}">${esc(effectiveGroupTeam(team)||'Time sem nome')}</div><button type="button" class="ffa-group-move tiny" onclick="moveFfaTeamGroup('${team.uid}',1)" title="Mover para o próximo grupo">→</button></div>`).join('');
    return `<div class="ffa-group-column${bad?' unbalanced':''}" ondragover="allowFfaGroupDrop(event)" ondragleave="leaveFfaGroupDrop(event)" ondrop="dropFfaGroupTeam(event,${g.index})"><div class="ffa-group-column-head"><span>Group ${esc(g.name)}</span><span class="ffa-group-count">${g.entries.length}/${per}</span></div><div class="ffa-group-team-list">${chips||'<div class="hint">Arraste uma equipe para cá.</div>'}</div></div>`;
  }).join('');
  const missing=unassigned.length?`<div class="ffa-group-column unassigned" ondragover="allowFfaGroupDrop(event)" ondragleave="leaveFfaGroupDrop(event)" ondrop="dropFfaGroupTeam(event,-1)"><div class="ffa-group-column-head"><span>SEM GRUPO</span><span class="ffa-group-count">${unassigned.length}</span></div><div class="ffa-group-team-list">${unassigned.map(({team})=>`<div class="ffa-group-team" draggable="true" ondragstart="startFfaGroupDrag(event,'${team.uid}')" ondragend="finishFfaGroupDrag(event)"><span></span><div class="ffa-group-team-name">${esc(effectiveGroupTeam(team)||'Time sem nome')}</div><button type="button" class="ffa-group-move tiny" onclick="assignFfaTeamGroup('${team.uid}',0)">→</button></div>`).join('')}</div></div>`:'';
  const content=`<div class="group-organizer-columns" style="--ffa-group-columns:${Math.max(1,groups.length+(unassigned.length?1:0))}">${cols}${missing}</div>`;
  root.innerHTML=`<div class="group-organizer-head"><div><div class="hint" style="margin:0">Arraste as equipes entre as colunas. A tabela abaixo seguirá automaticamente esta mesma sequência.</div></div><span class="pill">${groups.length} grupos · ${per} por grupo</span></div>${content}<div class="group-balance-status${statusClass}">${status}</div>`;
}
function groupedFfaOutput(){
  const distribution=ffaGroupDistribution();
  if(!ffaGroupsActive()) return [{name:'',entries:distribution.entries}];
  const result=distribution.groups.map(g=>({name:g.name,entries:g.entries}));
  if(distribution.unassigned.length) result.push({name:'',entries:distribution.unassigned,unassigned:true});
  return result;
}
function groupRoundDailyValue(team,roundIndex){
  const raw=clean(team?.groupRounds?.[roundIndex]);
  if(state.settings.groupFfaCumulative!=='true' || !raw) return raw;
  const current=toNumber(raw);
  if(current===null) return raw;
  let previous=0;
  for(let i=roundIndex-1;i>=0;i--){
    const candidate=clean(team?.groupRounds?.[i]);
    if(!candidate) continue;
    const parsed=toNumber(candidate);
    if(parsed!==null){ previous=parsed; break; }
  }
  return String(current-previous);
}
function groupScoreData(team){
  const ffa=state.settings.groupStandingsType==='ffa';
  if(ffa){
    const rounds=Math.max(1,Math.min(24,Number(state.settings.groupFfaRounds)||3));
    const values=Array.from({length:rounds},(_,i)=>groupRoundDailyValue(team,i));
    const numbers=values.map(toNumber);
    const hasScore=numbers.some(n=>n!==null);
    return {total:hasScore?numbers.reduce((sum,n)=>sum+(n??0),0):null,rounds:values,kp:null,pp:null,booyah:0};
  }
  const totalMode=state.settings.groupOverallMode==='total';
  const pp=state.settings.groupAutoPlacement==='true'?calculateGroupPlacementPoints(team):clean(team.groupPp);
  const ppNumber=toNumber(pp),kpNumber=toNumber(team.groupKp),savedTotal=toNumber(team.groupTotal);
  let total=null;
  if(totalMode||state.settings.groupAutoPlacement==='true') total=savedTotal;
  else if(ppNumber!==null||kpNumber!==null) total=(ppNumber??0)+(kpNumber??0);
  return {total,rounds:[],kp:kpNumber,pp:ppNumber,booyah:toNumber(team.groupBooyah)??0};
}
function rankedGroupEntries(){
  const ffa=state.settings.groupStandingsType==='ffa';
  return orderedGroupEntries().map(entry=>({...entry,score:groupScoreData(entry.team)})).sort((a,b)=>{
    const at=a.score.total,bt=b.score.total;
    if(at!==bt){if(at===null)return 1;if(bt===null)return -1;return bt-at;}
    if(ffa){
      const max=Math.max(a.score.rounds.length,b.score.rounds.length);
      for(let i=max-1;i>=0;i--){
        const av=toNumber(a.score.rounds[i])??-Infinity,bv=toNumber(b.score.rounds[i])??-Infinity;
        if(av!==bv)return bv-av;
      }
    }else{
      if(a.score.booyah!==b.score.booyah)return b.score.booyah-a.score.booyah;
      const ak=a.score.kp??-Infinity,bk=b.score.kp??-Infinity;
      if(ak!==bk)return bk-ak;
    }
    return a.orderIndex-b.orderIndex;
  });
}
function groupScoreDisplay(value){
  if(value===null||value===undefined||value==='')return '—';
  const number=toNumber(value);
  return number===null?esc(value):String(Number.isInteger(number)?number:Number(number.toFixed(2)));
}
function renderGroupLiveStandings(){
  const root=$('groupLiveStandings'), disclosure=$('groupLiveStandingsDisclosure');
  if(!root)return;
  const enabled=state.settings.groupStandingsEnabled==='true';
  if(disclosure)disclosure.classList.toggle('hidden',!enabled);
  if(!enabled){root.innerHTML='';return;}
  const ffa=state.settings.groupStandingsType==='ffa', ranked=rankedGroupEntries(), qualified=classificationCounts().qualified;
  let headers='<th>Pos.</th><th>Time</th><th>Grupo</th>';
  if(ffa){
    const rounds=Math.max(1,Math.min(24,Number(state.settings.groupFfaRounds)||3));
    for(let i=0;i<rounds;i++)headers+=`<th>${esc(clean(state.groupRoundConfigs?.[i]?.title)||`R${i+1}`)}</th>`;
  }else if(state.settings.groupOverallMode==='total') headers+='<th>Booyah</th><th>MP</th>';
  else headers+='<th>Booyah</th><th>PP</th><th>KP</th>';
  headers+='<th>Total</th>';
  const rows=ranked.map((entry,index)=>{
    const t=entry.team,group=clean(t.groupFfaGroup),up=index<qualified;
    let metrics='';
    if(ffa) metrics=entry.score.rounds.map(value=>`<td>${groupScoreDisplay(value)}</td>`).join('');
    else if(state.settings.groupOverallMode==='total') metrics=`<td>${groupScoreDisplay(t.groupBooyah)}</td><td>${groupScoreDisplay(t.groupMp)}</td>`;
    else metrics=`<td>${groupScoreDisplay(t.groupBooyah)}</td><td>${groupScoreDisplay(entry.score.pp)}</td><td>${groupScoreDisplay(t.groupKp)}</td>`;
    return `<tr class="${up?'live-qualified':''}"><td><span class="group-live-rank${up?' up':''}">${index+1}</span></td><td>${esc(effectiveGroupTeam(t)||`Time ${index+1}`)}</td><td>${group?`Group ${esc(group)}`:'—'}</td>${metrics}<td class="group-live-total">${groupScoreDisplay(entry.score.total)}</td></tr>`;
  }).join('');
  const mode=ffa?(state.settings.groupFfaCumulative==='true'?'rounds acumulados convertidos em pontos do dia':'soma dos rounds'):(state.settings.groupOverallMode==='total'?'pontos totais':'PP + KP');
  root.innerHTML=`<div class="group-live-wrap"><div class="group-live-meta"><span class="hint" style="margin:0">Atualização automática pela ${mode}.</span><span class="pill">Top ${qualified} → ${esc(val(state.settings.groupAdvanceTo,'Finals'))}</span></div><table class="group-live-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function refreshGroupDailyPreview(teamIndex,startRound=0){
  if(state.settings.groupFfaCumulative!=='true') return;
  const team=state.teams[teamIndex];
  const rounds=Math.max(1,Math.min(24,Number(state.settings.groupFfaRounds)||3));
  for(let r=Math.max(0,startRound);r<rounds;r++){
    const el=$(`groupDailyResult${teamIndex}_${r}`);
    if(!el) continue;
    const value=groupRoundDailyValue(team,r);
    const numeric=toNumber(value);
    el.textContent=`Pontos do dia: ${value || '—'}`;
    el.classList.toggle('warn',numeric!==null && numeric<0);
  }
}
function toggleGroupStandingsTools(){
  const panel=$('groupOverallTools');
  if(!panel || state.settings.groupStandingsType==='ffa') return;
  panel.classList.toggle('open');
}
function fillAllGroupMP(){
  const input=$('fillAllGroupMpValue');
  const value=input?input.value:'';
  state.teams.forEach(t=>{t.groupMp=value;});
  renderGroupStandings();
  autoSave(false);
  flash('copyStatus',`MP da Fase de Grupos preenchido com ${value || 'vazio'} em todos os times.`);
}
function setGroupRoundCount(value){ ensureGroupRoundCapacity(value); renderGroupStandings(); autoSave(false); }
function setGroupCounts(which,value){
  const total=state.teams.length, n=Math.max(0,Math.min(total,Number(value)||0));
  if(which==='qualified'){ state.settings.groupQualifyCount=String(n); state.settings.groupEliminatedCount=String(total-n); }
  else { state.settings.groupEliminatedCount=String(n); state.settings.groupQualifyCount=String(total-n); }
  const finalInput=$('finalTeamCount'); if(finalInput&&!clean(state.settings.finalTeamCount)) finalInput.placeholder=`Padrão: ${state.settings.groupQualifyCount}`;
  renderGroupStandings(); renderPrize(); autoSave(false);
}
function updateGroupRoundConfig(i,key,value){
  ensureGroupRoundCapacity(state.settings.groupFfaRounds);
  if(!state.groupRoundConfigs[i]) return;
  state.groupRoundConfigs[i][key]=key==='title'?value:normalizeRoundBoolean(value);
  autoSave(false);
}
function updateGroupTeam(i,value){ state.teams[i].groupTeam=value; renderGroupLiveStandings(); autoSave(false); }
function updateGroupField(i,key,value){ state.teams[i][key]=value; renderGroupLiveStandings(); autoSave(false); }
function updateGroupRound(i,r,value){ ensureGroupRoundCapacity(state.settings.groupFfaRounds); state.teams[i].groupRounds[r]=value; refreshGroupDailyPreview(i,r); renderGroupLiveStandings(); autoSave(false); }
function syncGroupFromTeams(){ const rows=orderedGroupTeams(); rows.forEach((t,i)=>{t.groupTeam=state.teams[i]?.name||'';}); renderGroupStandings(); autoSave(false); flash('copyStatus','Group Stage preenchido com os participantes.'); }
function syncGroupFromPrize(){ const groups=orderedGroupTeams(),prizes=orderedPrizeTeams(); groups.forEach((t,i)=>{t.groupTeam=prizes[i]?effectivePrizeTeam(prizes[i]):'';}); renderGroupStandings(); autoSave(false); flash('copyStatus','Group Stage preenchido pela ordem atual do Prize Pool.'); }
function syncPrizeFromGroup(){ const prizes=orderedPrizeTeams(),groups=orderedGroupTeams(); prizes.forEach((t,i)=>{t.prizeTeam=groups[i]?effectiveGroupTeam(groups[i]):'';}); renderPrize(); autoSave(false); flash('copyStatus','Prize Pool preenchido pela ordem atual do Group Stage.'); }
function setPrizeQualificationCount(value){ state.settings.prizeQualCount=String(Math.max(0,Math.min(state.teams.length,Number(value)||0))); renderPrize(); autoSave(false); }
function applyEliminatedDate(){
  const {qualified}=classificationCounts(), date=clean(state.settings.prizeEliminatedDate);
  orderedPrizeTeams().forEach((t,i)=>{ if(i>=qualified)t.prizeDate=date; });
  renderPrize(); autoSave(false); flash('copyStatus',date?'Data aplicada aos times eliminados.':'Datas dos eliminados foram limpas.');
}
function setFinalTeamCount(value){
  const raw=clean(value); state.settings.finalTeamCount=raw?String(Math.max(1,Math.min(state.teams.length,Number(raw)||1))):'';
  const winnerUid=championWinnerUid();
  if(winnerUid && !orderedFinalTeams().slice(0,finalStandingCount()).some(t=>t.uid===winnerUid)){
    state.settings.winnerUid=''; state.settings.winnerIndex='';
  } else syncLegacyWinnerIndex();
  renderStandings(); autoSave(false);
}
function syncFinalistsFromGroup(){
  const fallback=Number(state.settings.groupQualifyCount)||state.teams.length;
  const count=clean(state.settings.finalTeamCount)?finalStandingCount():Math.min(fallback,state.teams.length);
  const ranked=rankedGroupEntries();
  const rankedUids=ranked.map(entry=>entry.uid), rankedSet=new Set(rankedUids);
  state.settings.finalTeamCount=String(count);
  state.finalOrder=[...rankedUids,...state.finalOrder.filter(uid=>!rankedSet.has(uid))];
  ranked.slice(0,count).forEach(({team})=>{team.standingTeam=effectiveGroupTeam(team);});
  state.teams.forEach(t=>{t.championActivated=false;});
  state.settings.winnerUid='';
  state.settings.winnerIndex='';
  renderStandings(); fillSettingsInputs(); autoSave(false);
  flash('copyStatus',`${count} classificados puxados do Group Stage pela soma de pontos da tabela geral.`);
}
function syncFinalistsFromPrize(){
  const fallback=Number(state.settings.groupQualifyCount)||state.teams.length;
  const count=clean(state.settings.finalTeamCount)?finalStandingCount():Math.min(fallback,state.teams.length);
  const prizes=orderedPrizeTeams();
  state.settings.finalTeamCount=String(count);
  state.finalOrder=[...state.prizeOrder];
  const finals=orderedFinalTeams();
  for(let i=0;i<count;i++) finals[i].standingTeam=prizes[i]?effectivePrizeTeam(prizes[i]):'';
  state.teams.forEach(t=>{t.championActivated=false;});
  state.settings.winnerUid='';
  state.settings.winnerIndex='';
  renderStandings(); fillSettingsInputs(); autoSave(false); flash('copyStatus',`${count} classificados puxados da ordem atual do Prize Pool para a Grand Finals.`);
}
function renderGroupRoundConfigs(){
  ensureGroupRoundCapacity(state.settings.groupFfaRounds);
  const root=$('groupRoundConfigs'); if(!root)return;
  root.innerHTML=state.groupRoundConfigs.map((r,i)=>`<div class="group-round-config"><div class="team-number">R${i+1}</div><div><label>Título</label><input value="${esc(r.title)}" oninput="updateGroupRoundConfig(${i},'title',this.value)"></div><div><label>started</label><select onchange="updateGroupRoundConfig(${i},'started',this.value)"><option value="" ${r.started===''?'selected':''}>vazio</option><option value="true" ${r.started==='true'?'selected':''}>true</option><option value="false" ${r.started==='false'?'selected':''}>false</option></select></div><div><label>finished</label><select onchange="updateGroupRoundConfig(${i},'finished',this.value)"><option value="" ${r.finished===''?'selected':''}>vazio</option><option value="true" ${r.finished==='true'?'selected':''}>true</option><option value="false" ${r.finished==='false'?'selected':''}>false</option></select></div></div>`).join('');
}
function renderGroupStandings(){
  ensureGroupRoundCapacity(state.settings.groupFfaRounds);
  const enabled=state.settings.groupStandingsEnabled==='true', ffa=state.settings.groupStandingsType==='ffa';
  const roundBox=$('groupRoundConfigsWrap'), roundsBox=$('groupFfaRoundsBox'), importBox=$('groupFfaImportBox'), cumulativeBox=$('groupFfaCumulativeBox'), groupsEnabledBox=$('groupFfaGroupsEnabledBox'), groupNamesBox=$('groupFfaGroupNamesBox'), teamsPerGroupBox=$('groupFfaTeamsPerGroupBox'), overallBox=$('groupOverallModeBox'), groupTools=$('groupOverallTools'), overallDisclosure=$('groupOverallSettingsDisclosure'), ffaDisclosure=$('groupFfaSettingsDisclosure');
  [roundBox,roundsBox,importBox,cumulativeBox,groupsEnabledBox].forEach(el=>{if(el)el.classList.toggle('hidden',!ffa);});
  [groupNamesBox,teamsPerGroupBox].forEach(el=>{if(el)el.classList.toggle('hidden',!ffa||state.settings.groupFfaGroupsEnabled!=='true');}); if(overallBox)overallBox.classList.toggle('hidden',ffa);
  if(overallDisclosure)overallDisclosure.classList.toggle('hidden',ffa); if(ffaDisclosure)ffaDisclosure.classList.toggle('hidden',!ffa);
  if(groupTools){ groupTools.classList.toggle('hidden',ffa); if(ffa) groupTools.classList.remove('open'); }
  renderGroupRoundConfigs();
  renderFfaGroupOrganizer();
  const totalMode=state.settings.groupOverallMode==='total', groupAutoPlacement=!ffa && !totalMode && state.settings.groupAutoPlacement==='true', rounds=Number(state.settings.groupFfaRounds)||3;
  const columns=[['team','Time']];
  if(ffa){
    for(let r=0;r<rounds;r++) columns.push([`round${r}`, clean(state.groupRoundConfigs?.[r]?.title)||`R${r+1}`]);
  }else{
    columns.push(['booyah','Booyah'],['mp','MP']);
    if(totalMode) columns.push(['total','Pontos totais']);
    else if(groupAutoPlacement) columns.push(['kp','Pontos por kill'],['total','Total para cálculo'],['pp','PP automático']);
    else columns.push(['pp','PP'],['kp','KP']);
  }
  const groupBar=$('groupGroupFocusBar'), groupFocusVisible=enabled&&ffa&&ffaGroupsActive();
  if(groupBar){groupBar.innerHTML=groupFocusVisible?groupFocusBarHtml():'';groupBar.classList.toggle('hidden',!groupFocusVisible);}
  const bar=$('groupFocusBar');
  if(bar){ bar.innerHTML=focusBarHtml('group',columns); bar.classList.toggle('hidden',!enabled); }
  const root=$('groupStandingsRows'); if(!root)return;
  if(!enabled){root.innerHTML='<div class="format-empty">Ative “Gerar classificação?” para montar a tabela do Group Stage.</div>';renderGroupLiveStandings();applyFocusMode('group');return;}
  root.innerHTML=orderedGroupEntries().map(({team:t,teamIndex:i,orderIndex})=>{
    const rowGroup=groupNameForEntry(t,orderIndex), grouped=ffa&&ffaGroupsActive();
    const groupBadge=grouped?`<div class="row-group-badge${rowGroup?'':' missing'}">${rowGroup?`G. ${esc(rowGroup)}`:'SEM'}</div>`:'';
    const teamCell=`<div class="sortable-team-cell${grouped?' grouped':''}">${reorderHandleHtml('group',orderIndex,effectiveGroupTeam(t)||`time ${orderIndex+1}`)}${groupBadge}<div class="focus-cell">${focusLabel('Time')}<input ${focusAttrs('group','team')} value="${esc(effectiveGroupTeam(t))}" oninput="updateGroupTeam(${i},this.value)"></div></div>`;
    const cells=[`<div class="team-number">${orderIndex+1}</div>`,teamCell];
    if(ffa){
      const cumulative=state.settings.groupFfaCumulative==='true';
      for(let r=0;r<rounds;r++){
        const roundTitle=clean(state.groupRoundConfigs?.[r]?.title)||`R${r+1}`;
        const daily=groupRoundDailyValue(t,r);
        cells.push(`<div class="focus-cell">${focusLabel(cumulative?`${roundTitle} — acumulado`:roundTitle)}<input ${focusAttrs('group',`round${r}`)} value="${esc(t.groupRounds?.[r]||'')}" oninput="updateGroupRound(${i},${r},this.value)">${cumulative?`<div id="groupDailyResult${i}_${r}" class="round-daily-result${toNumber(daily)!==null&&toNumber(daily)<0?' warn':''}">Pontos do dia: ${esc(daily||'—')}</div>`:''}</div>`);
      }
    }else{
      cells.push(`<div class="focus-cell">${focusLabel('Booyah')}<input ${focusAttrs('group','booyah')} value="${esc(t.groupBooyah||'0')}" oninput="updateGroupField(${i},'groupBooyah',this.value)"></div>`);
      cells.push(`<div class="focus-cell">${focusLabel('MP')}<input ${focusAttrs('group','mp')} value="${esc(t.groupMp||'')}" oninput="updateGroupField(${i},'groupMp',this.value)"></div>`);
      if(totalMode) cells.push(`<div class="focus-cell">${focusLabel('Total')}<input ${focusAttrs('group','total')} value="${esc(t.groupTotal||'')}" oninput="updateGroupField(${i},'groupTotal',this.value)"></div>`);
      else if(groupAutoPlacement){
        const groupPpValue=calculateGroupPlacementPoints(t);
        cells.push(`<div class="focus-cell">${focusLabel('Pontos por kill (KP)')}<input ${focusAttrs('group','kp')} value="${esc(t.groupKp||'')}" oninput="updateGroupField(${i},'groupKp',this.value); updateGroupAutoPP(${i})"></div>`);
        cells.push(`<div class="focus-cell">${focusLabel('Total para cálculo')}<input ${focusAttrs('group','total')} value="${esc(t.groupTotal||'')}" oninput="updateGroupField(${i},'groupTotal',this.value); updateGroupAutoPP(${i})"></div>`);
        cells.push(`<div class="focus-cell">${focusLabel('Pontos (PP automático)')}<input ${focusAttrs('group','pp')} id="groupAutoPp${i}" value="${esc(groupPpValue)}" readonly></div>`);
      }else {cells.push(`<div class="focus-cell">${focusLabel('PP')}<input ${focusAttrs('group','pp')} value="${esc(t.groupPp||'')}" oninput="updateGroupField(${i},'groupPp',this.value)"></div>`);cells.push(`<div class="focus-cell">${focusLabel('KP')}<input ${focusAttrs('group','kp')} value="${esc(t.groupKp||'')}" oninput="updateGroupField(${i},'groupKp',this.value)"></div>`);}
    }
    const metrics=cells.length-2, min=300+metrics*105;
    return `<div class="group-standings-line sortable-row${groupAutoPlacement?' auto-pp':''}" data-sort-row data-sort-scope="group" data-sort-index="${orderIndex}" data-ffa-group="${esc(rowGroup)}" style="--group-metric-count:${metrics};--group-min-width:${min}px">${cells.join('')}</div>`;
  }).join('');
  renderGroupLiveStandings();
  applyFocusMode('group');
}

function renderStandings(){
  const root = $('standingsRows');
  const totalMode = state.settings.standingMode === 'total';
  const champion = state.settings.standingFormat === 'champion';
  const headstart = state.settings.headstartEnabled === 'true';
  const autoPlacement = !totalMode && state.settings.autoPlacement === 'true';
  const columns = [['team','Time']];
  if(champion) columns.push(['winner','Vencedor'],['activated','Ativado']);
  columns.push(['booyah','Booyah'],['mp','MP']);
  if(totalMode) columns.push(['total','Pontos totais']);
  else if(autoPlacement) columns.push(['kp','Pontos por kill'],['total','Total para cálculo'],['pp','PP automático']);
  else columns.push(['pp','Pontos'],['kp','Pontos por kill']);
  if(headstart) columns.push(['bp','Headstart']);
  const bar = $('overallFocusBar'); if(bar) bar.innerHTML = focusBarHtml('overall', columns);
  root.innerHTML = orderedFinalEntries().slice(0,finalStandingCount()).map(({team:t,teamIndex:i,orderIndex})=>{
    const cells = [];
    cells.push(`<div class="team-number">${orderIndex+1}</div>`);
    cells.push(`<div class="sortable-team-cell">${reorderHandleHtml('final',orderIndex,effectiveStandingTeam(t)||`time ${orderIndex+1}`)}<div class="focus-cell">${focusLabel('Time')}<input id="standingTeam${i}" ${focusAttrs('overall','team')} value="${esc(effectiveStandingTeam(t))}" oninput="updateStandingTeamAliasInput(${i},this.value)"><div id="aliasStandingTeam${i}" class="alias-suggestion hidden"></div></div></div>`);
    if(champion){
      const teamLabel=esc(effectiveStandingTeam(t) || `time ${orderIndex+1}`);
      cells.push(`<div class="focus-cell">${focusLabel('VENCEDOR')}<div class="winner-radio"><input ${focusAttrs('overall','winner')} type="radio" name="overallWinner" ${championWinnerUid()===t.uid?'checked':''} onchange="setOverallWinner(${i})" aria-label="Marcar ${teamLabel} como vencedor pelo Champion Point"></div></div>`);
      cells.push(`<div class="focus-cell">${focusLabel('ATIVADO')}<div class="champion-activated"><input ${focusAttrs('overall','activated')} type="checkbox" ${t.championActivated?'checked':''} onchange="setChampionActivated(${i},this.checked)" aria-label="Marcar ${teamLabel} como time que atingiu o Champion Point"></div></div>`);
    }
    cells.push(`<div class="focus-cell">${focusLabel('Booyah')}<input ${focusAttrs('overall','booyah')} value="${esc(t.booyah)}" oninput="updateTeam(${i},'booyah',this.value)"></div>`);
    cells.push(`<div class="focus-cell">${focusLabel('MP')}<input ${focusAttrs('overall','mp')} value="${esc(t.mp)}" oninput="updateTeam(${i},'mp',this.value)"></div>`);
    if(totalMode){
      cells.push(`<div class="focus-cell">${focusLabel('Pontos totais')}<input ${focusAttrs('overall','total')} value="${esc(t.total)}" oninput="updateTeam(${i},'total',this.value)"></div>`);
    }else if(autoPlacement){
      const ppValue = calculatePlacementPoints(t);
      cells.push(`<div class="focus-cell">${focusLabel('Pontos por kill (KP)')}<input ${focusAttrs('overall','kp')} value="${esc(t.kp)}" oninput="updateTeam(${i},'kp',this.value); updateAutoPP(${i})"></div>`);
      cells.push(`<div class="focus-cell">${focusLabel('Total para cálculo')}<input ${focusAttrs('overall','total')} value="${esc(t.total)}" oninput="updateTeam(${i},'total',this.value); updateAutoPP(${i})"></div>`);
      cells.push(`<div class="focus-cell">${focusLabel('Pontos (PP automático)')}<input ${focusAttrs('overall','pp')} id="autoPp${i}" value="${esc(ppValue)}" readonly></div>`);
    }else{
      cells.push(`<div class="focus-cell">${focusLabel('Pontos (PP)')}<input ${focusAttrs('overall','pp')} value="${esc(t.pp)}" oninput="updateTeam(${i},'pp',this.value)"></div>`);
      cells.push(`<div class="focus-cell">${focusLabel('Pontos por kill (KP)')}<input ${focusAttrs('overall','kp')} value="${esc(t.kp)}" oninput="updateTeam(${i},'kp',this.value)"></div>`);
    }
    if(headstart){
      cells.push(`<div class="focus-cell">${focusLabel('Headstart (BP)')}<input ${focusAttrs('overall','bp')} value="${esc(t.bp)}" oninput="updateTeam(${i},'bp',this.value)"></div>`);
    }
    const metricCount = cells.length - 2;
    const championClass=champion?' champion-mode':'';
    const championVars=champion?`;--metric-count-rest:${Math.max(0,metricCount-2)}`:'';
    return `<div class="standings-line sortable-row${autoPlacement?' auto-pp':''}${totalMode?' total':''}${championClass}" data-sort-row data-sort-scope="final" data-sort-index="${orderIndex}" style="--metric-count:${metricCount}${championVars}">${cells.join('')}</div>`;
  }).join('');
  applyFocusMode('overall');
}


function renderTeamDB(){
  const list = Array.isArray(state.teamDB) ? state.teamDB : [];
  const count = $('teamDbCount'); if(count) count.textContent = list.length;
  const sel = $('teamDbSelect');
  if(sel){
    const current = String(selectedDbIndex ?? '');
    sel.innerHTML = teamDbOptions();
    if(list.length && list[selectedDbIndex]) sel.value = String(selectedDbIndex);
    else sel.value = '';
  }
}

function loadTeamDbToEditor(value){
  const idx = Number(value);
  if(!Number.isInteger(idx) || !state.teamDB?.[idx]) return;
  selectedDbIndex = idx;
  const team=state.teamDB[idx];
  const area = $('teamDbText'); if(area) area.value = teamToDbWiki(team);
  const code=$('teamDbCode'); if(code) code.value=clean(team.code);
  const aliases=$('teamDbAliases'); if(aliases) aliases.value=clean(team.aliases);
}
function loadSelectedTeamDbToEditor(){
  const sel = $('teamDbSelect');
  const idx = Number(sel?.value || -1);
  if(!Number.isInteger(idx) || !state.teamDB?.[idx]){ flash('teamDbStatus','Selecione um time salvo primeiro.'); return; }
  loadTeamDbToEditor(idx);
  flash('teamDbStatus','Time carregado para edição.');
}
function clearTeamDbEditor(){ const area=$('teamDbText'); if(area) area.value=''; const code=$('teamDbCode');if(code)code.value='';const aliases=$('teamDbAliases');if(aliases)aliases.value=''; }
function saveTeamDbFromText(){
  const parsed = parseTeamWikiBlock($('teamDbText')?.value || '');
  if(!parsed){ flash('teamDbStatus','Não consegui detectar o nome do time no texto.'); return; }
  parsed.code=clean($('teamDbCode')?.value); parsed.aliases=clean($('teamDbAliases')?.value);
  saveOrUpdateTeamDb(parsed); registerAlias('teams',parsed.name); (parsed.players||[]).forEach(p=>{registerAlias('players',p.name);registerAlias('teams',p.team);});
  renderTeamDB(); loadTeamDbToEditor(selectedDbIndex); renderTeams(); autoSave(false);
  flash('teamDbStatus', `Time "${parsed.name}" salvo no banco${clean(parsed.code)?` com código ${clean(parsed.code)}`:''}.`);
}
function updateSelectedTeamDbFromText(){
  const sel = $('teamDbSelect');
  const idx = Number(sel?.value || -1);
  if(!Number.isInteger(idx) || !state.teamDB?.[idx]){ flash('teamDbStatus','Selecione um time para atualizar.'); return; }
  const parsed = parseTeamWikiBlock($('teamDbText')?.value || '');
  if(!parsed){ flash('teamDbStatus','Não consegui detectar o nome do time no texto.'); return; }
  parsed.code=clean($('teamDbCode')?.value); parsed.aliases=clean($('teamDbAliases')?.value);
  state.teamDB[idx] = normalizeRosterTeam(parsed);
  selectedDbIndex = idx;
  state.teamDB.sort((a,b)=>clean(a.name).localeCompare(clean(b.name), 'pt-BR', {sensitivity:'base'}));
  selectedDbIndex = state.teamDB.findIndex(x => aliasKey(x.name) === aliasKey(parsed.name));
  renderTeamDB(); loadTeamDbToEditor(selectedDbIndex); renderTeams(); autoSave(false);
  flash('teamDbStatus', `Time "${parsed.name}" atualizado.`);
}
function deleteSelectedTeamDb(){
  const sel = $('teamDbSelect');
  const idx = Number(sel?.value || -1);
  if(!Number.isInteger(idx) || !state.teamDB?.[idx]){ flash('teamDbStatus','Selecione um time para excluir.'); return; }
  const name = state.teamDB[idx].name;
  if(!confirm(`Excluir "${name}" do banco de dados?`)) return;
  state.teamDB.splice(idx,1);
  selectedDbIndex = Math.max(0, idx-1);
  renderTeamDB(); renderTeams(); autoSave(false);
  flash('teamDbStatus', `Time "${name}" excluído.`);
}
function clearTeamDatabase(){
  if(!confirm('Excluir todos os times salvos no banco de dados?')) return;
  state.teamDB = [];
  selectedDbIndex = 0;
  renderTeamDB(); renderTeams(); autoSave(false);
  flash('teamDbStatus','Banco de dados de times excluído.');
}
function copySelectedTeamDbWiki(){
  const sel = $('teamDbSelect');
  const idx = Number(sel?.value || -1);
  if(!Number.isInteger(idx) || !state.teamDB?.[idx]){ flash('teamDbStatus','Selecione um time salvo primeiro.'); return; }
  const text = teamToDbWiki(state.teamDB[idx]);
  $('teamDbText').value = text;
  $('output').value = text;
  copyText(text, 'Wiki do time copiado. O texto também apareceu na caixa de texto gerado.');
}
function pullDbTeamIntoSlot(i){
  const sel = $('teamDbSlot' + i);
  const idx = Number(sel?.value || -1);
  if(!Number.isInteger(idx) || !state.teamDB?.[idx]){ flash('copyStatus','Selecione um time salvo no slot antes de puxar.'); return; }
  const dbTeam=state.teamDB[idx];
  state.teams[i] = rosterToTeam(dbTeam, state.teams[i]);
  renderAll(); autoSave(false);
  flash('copyStatus', `Time "${dbTeam.name}" puxado para o slot ${i+1}.`);
}
function pullMatchingDbTeamIntoSlot(i){
  const current=state.teams[i]; if(!current)return;
  const match=findTeamDbMatch(current.name);
  if(!match){ flash('copyStatus',`Nenhum time do banco corresponde a "${clean(current.name)||`slot ${i+1}`}".`); return; }
  state.teams[i]=rosterToTeam(match.team,current);
  renderAll();autoSave(false);
  flash('copyStatus',`Time "${match.team.name}" reconhecido e puxado para o slot ${i+1}.`);
}
function pullMatchingDbTeams(){
  let pulled=0,notFound=0,empty=0;
  state.teams.forEach((current,i)=>{
    const typed=clean(current?.name); if(!typed){empty++;return;}
    const match=findTeamDbMatch(typed); if(!match){notFound++;return;}
    state.teams[i]=rosterToTeam(match.team,current); pulled++;
  });
  renderAll();autoSave(false);
  if(pulled) flash('copyStatus',`${pulled} time${pulled===1?'':'s'} puxado${pulled===1?'':'s'} automaticamente do banco${notFound?`; ${notFound} sem correspondência`:''}.`);
  else flash('copyStatus',notFound?'Nenhum participante preenchido corresponde aos nomes, códigos ou aliases do banco.':'Preencha os nomes/códigos dos participantes antes de puxar do banco.');
}
function saveParticipantToDb(i){
  const roster = normalizeRosterTeam(state.teams[i]);
  if(!clean(roster.name)){ flash('copyStatus','Preencha o nome do time antes de salvar no banco.'); return; }
  saveOrUpdateTeamDb(roster); registerAlias('teams',roster.name); (roster.players||[]).forEach(p=>{registerAlias('players',p.name);registerAlias('teams',p.team);});
  renderTeamDB(); renderTeams(); autoSave(false);
  flash('copyStatus', `Time "${roster.name}" salvo no banco de dados.`);
}

function registryNormalizeName(value){ return clean(value).toLocaleLowerCase('pt-BR'); }
function registeredTeamNames(){
  const seen=new Set(), names=[];
  state.teams.forEach(t=>[t.name,t.prizeTeam,t.groupTeam,t.standingTeam].forEach(value=>{
    const name=clean(value), key=registryNormalizeName(name);
    if(name&&!seen.has(key)){seen.add(key);names.push(name);}
  }));
  return names.sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true,sensitivity:'base'}));
}
function registryOrderPosition(scope,uid){
  const order=scope==='prize'?state.prizeOrder:scope==='group'?state.groupOrder:state.finalOrder;
  const index=(Array.isArray(order)?order:[]).indexOf(uid);
  return index>=0?index+1:'—';
}
function toggleTeamRegistry(forceOpen){
  teamRegistryOpen=typeof forceOpen==='boolean'?forceOpen:!teamRegistryOpen;
  const panel=$('teamRegistryPanel'),button=$('teamRegistryToggleBtn');
  if(panel)panel.classList.toggle('hidden',!teamRegistryOpen);
  if(button)button.classList.toggle('active',teamRegistryOpen);
  if(teamRegistryOpen){renderTeamRegistryManager();requestAnimationFrame(()=>panel?.scrollIntoView({behavior:'smooth',block:'start'}));}
}
function renderTeamRegistryManager(){
  const root=$('registeredTeamRows'), select=$('registryOldTeam'); if(!root||!select)return;
  const previous=select.value, replacement=$('registryNewTeam')?.value||'';
  const names=registeredTeamNames();
  select.innerHTML=names.length?names.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join(''):'<option value="">Nenhum time registrado</option>';
  if(names.some(name=>name===previous))select.value=previous;
  if($('registryNewTeam'))$('registryNewTeam').value=replacement;
  const groupEntries=orderedGroupEntries();
  const groupIndexByUid=new Map(groupEntries.map(entry=>[entry.uid,entry.orderIndex]));
  const head=`<div class="registry-row registry-head"><div>Slot</div><div>Participantes</div><div>Prize Pool</div><div>Group Stage</div><div>Final</div><div>Grupo FFA</div><div>Ação</div></div>`;
  const rows=state.teams.map((t,i)=>{
    const groupOrderIndex=groupIndexByUid.get(t.uid);
    const groupName=groupNameForEntry(t,Number.isInteger(groupOrderIndex)?groupOrderIndex:i);
    const field=(label,key,value,position,placeholder='')=>`<div><label class="registry-field-label"><span>${label}</span><span class="registry-position">#${position}</span></label><input value="${esc(value)}" placeholder="${esc(placeholder)}" onchange="updateRegisteredTeamField('${t.uid}','${key}',this.value)"></div>`;
    return `<div class="registry-row"><div class="registry-slot">${i+1}</div>${field('Participantes','name',t.name,i+1,'nome do time')}${field('Prize','prizeTeam',t.prizeTeam,registryOrderPosition('prize',t.uid),t.name||'herda Participantes')}${field('Grupo','groupTeam',t.groupTeam,registryOrderPosition('group',t.uid),t.name||'herda Participantes')}${field('Final','standingTeam',t.standingTeam,registryOrderPosition('final',t.uid),t.name||'herda Participantes')}<div><label>Grupo atual</label><div class="registry-group-cell${groupName?'':' registry-empty'}">${groupName?`Group ${esc(groupName)}`:'—'}</div></div><button class="tiny" onclick="syncRegisteredTeamRow('${t.uid}')">Sincronizar linha</button></div>`;
  }).join('');
  root.innerHTML=head+rows;
}
function updateRegisteredTeamField(uid,key,value){
  if(!['name','prizeTeam','groupTeam','standingTeam'].includes(key))return;
  const team=state.teams.find(t=>t.uid===uid); if(!team)return;
  team[key]=value;
  if(key==='name'){renderTeams();renderPrize();renderGroupStandings();renderStandings();}
  else if(key==='prizeTeam')renderPrize();
  else if(key==='groupTeam')renderGroupStandings();
  else {renderStandings();renderPrize();}
  autoSave(false);
}
function syncRegisteredTeamRow(uid){
  const team=state.teams.find(t=>t.uid===uid); if(!team)return;
  const name=clean(team.name);
  if(!name){flash('copyStatus','Preencha o nome em Participantes antes de sincronizar esta linha.');return;}
  team.prizeTeam=name;team.groupTeam=name;team.standingTeam=name;
  renderAll();autoSave(false);flash('copyStatus',`“${name}” sincronizado no Prize Pool, Group Stage e Final.`);
}
function syncAllRegisteredTeamsFromParticipants(){
  if(!confirm('Usar o nome de Participantes em todas as outras seções para todos os times?'))return;
  state.teams.forEach(t=>{const name=clean(t.name);t.prizeTeam=name;t.groupTeam=name;t.standingTeam=name;});
  renderAll();autoSave(false);flash('copyStatus','Todos os nomes foram sincronizados a partir de Participantes.');
}
function replaceRegisteredTeamEverywhere(){
  const oldName=clean($('registryOldTeam')?.value), newName=clean($('registryNewTeam')?.value);
  if(!oldName||!newName){flash('copyStatus','Escolha o time antigo e informe o novo nome.');return;}
  const fields=[];
  if($('registryLocParticipants')?.checked)fields.push('name');
  if($('registryLocPrize')?.checked)fields.push('prizeTeam');
  if($('registryLocGroup')?.checked)fields.push('groupTeam');
  if($('registryLocOverall')?.checked)fields.push('standingTeam');
  if(!fields.length){flash('copyStatus','Marque ao menos um lugar para fazer a troca.');return;}
  const target=registryNormalizeName(oldName); let changes=0;
  state.teams.forEach(team=>fields.forEach(field=>{if(registryNormalizeName(team[field])===target){team[field]=newName;changes++;}}));
  if(!changes){flash('copyStatus',`Nenhum registro exato de “${oldName}” foi encontrado nos lugares marcados.`);return;}
  renderAll();autoSave(false);flash('copyStatus',`${changes} registro(s) de “${oldName}” trocado(s) por “${newName}”.`);
}
function resetParticipantTransientState(){openTeamTools.clear();openPlayerLinks.clear();openPlayerTeams.clear();}
function sortParticipants(mode){
  const decorated=state.teams.map((team,index)=>({team,index}));
  const alpha=(a,b)=>{const an=clean(a.team.name),bn=clean(b.team.name);if(!an&&bn)return 1;if(an&&!bn)return-1;return an.localeCompare(bn,'pt-BR',{numeric:true,sensitivity:'base'})||a.index-b.index;};
  if(mode==='qualification')decorated.sort((a,b)=>(a.team.qual==='qualifier'?1:0)-(b.team.qual==='qualifier'?1:0)||a.index-b.index);
  else if(mode==='alphabetical')decorated.sort(alpha);
  else if(mode==='groups'){
    const groupEntries=orderedGroupEntries(), orderPos=new Map(groupEntries.map((entry,index)=>[entry.uid,index])), names=ffaGroupNames();
    decorated.sort((a,b)=>{
      const ai=orderPos.has(a.team.uid)?orderPos.get(a.team.uid):9999, bi=orderPos.has(b.team.uid)?orderPos.get(b.team.uid):9999;
      if(ffaGroupsActive()){
        const ag=groupNameForEntry(a.team,ai),bg=groupNameForEntry(b.team,bi), ar=names.indexOf(ag),br=names.indexOf(bg);
        const rankA=ar>=0?ar:999,rankB=br>=0?br:999;
        if(rankA!==rankB)return rankA-rankB;
      }
      return ai-bi||alpha(a,b);
    });
  }else return;
  state.teams=decorated.map(item=>item.team);
  resetParticipantTransientState();
  renderTeams();renderTeamRegistryManager();autoSave(false);
  const labels={qualification:'Invited antes de Qualifier',alphabetical:'ordem alfabética',groups:'ordem dos grupos'};
  flash('copyStatus',`Participantes ordenados por ${labels[mode]}.`);
}

function renderAll(){
  ensureTeamCount(state.settings.teamCount);
  fillSettingsInputs();
  renderFormatBuilder();
  renderPrize();
  renderTeamDB();
  renderTeams();
  renderGroupStandings();
  renderStandings();
  renderBroadcast();
  renderAliasPanel();
  renderTeamRegistryManager();
  const participantsPanel = $('participantsTools');
  if(participantsPanel) participantsPanel.classList.toggle('open', participantsToolsOpen);
  applyAllFocusModes();
}
function updateTeam(i, key, value){
  state.teams[i][key] = value;
  if(key === 'name') scheduleDependentTeamRender();
  refreshTeamCompletion(i); autoSave(false);
}
function updatePrizeTeam(i, value){ state.teams[i].prizeTeam = value; autoSave(false); }
function updateStandingTeam(i, value){ state.teams[i].standingTeam = value; scheduleDependentTeamRender(); autoSave(false); }
function updatePlayer(i,j,key,value){ if(!Array.isArray(state.teams[i].players)) state.teams[i].players=[]; if(!state.teams[i].players[j]) state.teams[i].players[j]=blankPlayer(); state.teams[i].players[j][key]=value; refreshTeamCompletion(i); autoSave(false); }
function updateTeamAliasInput(i,field,value){ updateTeam(i,field,value); setAliasHint('aliasTeamName'+i,'teams',value,`applyTeamAlias(${i},'${field}',decodeURIComponent(arguments[0]))`); if(field==='name')updateParticipantDbMatchHint(i,value); }
function updatePrizeTeamAliasInput(i,value){ updatePrizeTeam(i,value); setAliasHint('aliasPrizeTeam'+i,'teams',value,`applyPrizeTeamAlias(${i},decodeURIComponent(arguments[0]))`); }
function updateStandingTeamAliasInput(i,value){ updateStandingTeam(i,value); setAliasHint('aliasStandingTeam'+i,'teams',value,`applyStandingTeamAlias(${i},decodeURIComponent(arguments[0]))`); }
function updatePlayerAliasInput(i,j,value){ updatePlayer(i,j,'name',value); setAliasHint(`aliasPlayer${i}_${j}`,'players',value,`applyPlayerAlias(${i},${j},decodeURIComponent(arguments[0]))`); }
function updatePlayerTeamAliasInput(i,j,value){ updatePlayer(i,j,'team',value); setAliasHint(`aliasPlayerTeam${i}_${j}`,'teams',value,`applyPlayerTeamAlias(${i},${j},decodeURIComponent(arguments[0]))`); }
function updateStaffAliasInput(i,role,value){ updateStaff(i,role,'name',value); const cap=role==='coach'?'Coach':'Analyst'; setAliasHint(`alias${cap}${i}`,'players',value,`applyStaffAlias(${i},'${role}',decodeURIComponent(arguments[0]))`); }
function applyTeamAlias(i,field,value){ state.teams[i][field]=value; renderAll(); autoSave(false); }
function applyPrizeTeamAlias(i,value){ state.teams[i].prizeTeam=value; renderPrize(); autoSave(false); }
function applyStandingTeamAlias(i,value){ state.teams[i].standingTeam=value; renderStandings(); renderPrize(); autoSave(false); }
function applyPlayerAlias(i,j,value){ state.teams[i].players[j].name=value; renderTeams(); autoSave(false); }
function applyPlayerTeamAlias(i,j,value){ state.teams[i].players[j].team=value; openPlayerTeams.add(`${i}:${j}`); renderTeams(); autoSave(false); }
function applyStaffAlias(i,role,value){ state.teams[i][role].name=value; renderTeams(); autoSave(false); }
function togglePlayerLink(i,j){ const key=`${i}:${j}`; if(openPlayerLinks.has(key)) openPlayerLinks.delete(key); else openPlayerLinks.add(key); renderTeams(); }
function togglePlayerTeam(i,j){ const key=`${i}:${j}`; if(openPlayerTeams.has(key)) openPlayerTeams.delete(key); else openPlayerTeams.add(key); renderTeams(); }

function updateStaff(i,role,key,value){ if(!state.teams[i][role]) state.teams[i][role]={name:'',flag:'br'}; state.teams[i][role][key]=value; refreshTeamCompletion(i); autoSave(false); }
function choosePrize(i,value){ if(value !== 'custom') state.teams[i].prize = value; renderPrize(); autoSave(); }
function clearTeam(i){ const uid=state.teams[i]?.uid||newTeamUid(); state.teams[i] = {...blankTeam(),uid}; renderAll(); autoSave(); }
function clearParticipantTeam(i){
  const t=state.teams[i]; if(!t)return;
  if(!confirm(`Limpar somente os dados de Participantes do slot ${i+1}? Prize Pool, Group Stage, Final e pontuações serão preservados.`))return;
  Object.assign(t,{name:'',qual:'invite',qualMethod:'',qualPage:'',qualText:'',qualPlacement:'',allowIncomplete:false,players:[blankPlayer(),blankPlayer(),blankPlayer(),blankPlayer()],coach:{name:'',flag:'br',role:'head coach'},analyst:{name:'',flag:'br',role:'analyst'}});
  resetParticipantTransientState();renderTeams();renderTeamRegistryManager();autoSave(false);flash('copyStatus',`Participantes do slot ${i+1} foram limpos sem alterar as outras seções.`);
}
function clearTeamEverywhere(i){
  const name=clean(state.teams[i]?.name)||`slot ${i+1}`;
  if(!confirm(`Limpar “${name}” completamente em Participantes, Prize Pool, Group Stage, Final e pontuações?`))return;
  clearTeam(i);flash('copyStatus',`O ${name} foi limpo em todas as seções.`);
}
function setIncompleteOk(i,checked){state.teams[i].allowIncomplete=!!checked;renderTeams();autoSave(false);}
function toggleIncompleteOk(i){setIncompleteOk(i,!state.teams[i].allowIncomplete);}
function toggleParticipantsTools(){
  participantsToolsOpen = !participantsToolsOpen;
  const panel = $('participantsTools');
  if(panel) panel.classList.toggle('open', participantsToolsOpen);
}
function setIncludePlayerRoles(checked){
  state.settings.includePlayerRoles=checked?'true':'false';
  fillSettingsInputs();
  autoSave(false);
  flash('copyStatus',checked?'Roles dos jogadores serão incluídas no código wiki.':'Roles dos jogadores foram desativadas no código wiki. Staff continua com role normalmente.');
}
function toggleTeamTools(i){
  if(openTeamTools.has(i)) openTeamTools.delete(i); else openTeamTools.add(i);
  const panel = $('teamTools' + i);
  if(panel) panel.classList.toggle('open', openTeamTools.has(i));
}
function setTeamQualificationPreset(i,value){
  const t=state.teams[i]; if(!t) return;
  t.qual=value==='qualifier'?'qualifier':'invite';
  t.qualMethod=''; t.qualPage=''; t.qualText=''; t.qualPlacement='';
  renderTeams(); autoSave(false);
}
function importParticipantTeamIntoSlot(i){
  const box=$('teamWikiPaste'+i), raw=box?.value||'';
  const parsed=parseTeamWikiBlock(raw);
  if(!parsed){ flash('copyStatus','Não consegui identificar um bloco {{Opponent|...}} válido.'); return; }
  const hasPlayerRoles=(parsed.players||[]).some(p=>clean(p.role));
  let importPlayerRoles=true;
  if(hasPlayerRoles){
    importPlayerRoles=confirm('Este time possui roles nos jogadores. Deseja importar e ativar essas roles no código wiki?\n\nAs roles de coach/analyst serão importadas automaticamente, mesmo com a opção dos jogadores desativada.');
  }
  if(importPlayerRoles && hasPlayerRoles) state.settings.includePlayerRoles='true';
  if(!importPlayerRoles) parsed.players=(parsed.players||[]).map(p=>({...p,role:''}));
  const old=state.teams[i]||blankTeam();
  state.teams[i]=rosterToTeam(parsed,old);
  openTeamTools.add(i);
  (state.teams[i].players||[]).forEach((p,j)=>{
    const key=`${i}:${j}`;
    if(clean(p.link)) openPlayerLinks.add(key);
    if(clean(p.team)) openPlayerTeams.add(key);
    registerAlias('players',p.name); registerAlias('teams',p.team);
  });
  registerAlias('teams',state.teams[i].name);
  registerAlias('players',state.teams[i].coach?.name);
  registerAlias('players',state.teams[i].analyst?.name);
  renderAll(); autoSave(false);
  flash('copyStatus',`Time "${state.teams[i].name}" preenchido no slot ${i+1}${hasPlayerRoles?(importPlayerRoles?' com roles dos jogadores.':' sem roles dos jogadores.') : '.'}`);
}
function setAllQual(q){
  state.teams.forEach(t=>t.qual=q);
  renderTeams();
  autoSave(false);
  flash('copyStatus', q === 'qualifier' ? 'Todos os times definidos como Qualifier.' : 'Todos os times definidos como Invited.');
}
function setTeamParticipantFlagValue(t, flag){
  if(!t) return;
  const value = clean(flag);
  if(!Array.isArray(t.players)) t.players = [];
  t.players.forEach(p => { p.flag = value; });
  if(!t.coach) t.coach = {name:'',flag:value}; else t.coach.flag = value;
  if(!t.analyst) t.analyst = {name:'',flag:value}; else t.analyst.flag = value;
}
function applyTeamParticipantFlag(i){
  const input = $('teamFlagInput' + i);
  const value = input ? input.value : '';
  setTeamParticipantFlagValue(state.teams[i], value);
  renderTeams();
  autoSave(false);
  flash('copyStatus', `Flag "${clean(value)}" aplicada aos participantes do time ${i+1}.`);
}
function applyAllParticipantFlags(){
  const input = $('allParticipantFlagInput');
  const value = input ? input.value : '';
  state.teams.forEach(t => setTeamParticipantFlagValue(t, value));
  renderTeams();
  autoSave(false);
  flash('copyStatus', `Flag "${clean(value)}" aplicada aos participantes de todos os times.`);
}
function clearTeamParticipantFlags(i){
  setTeamParticipantFlagValue(state.teams[i], '');
  renderTeams();
  autoSave(false);
  flash('copyStatus', `Flags dos participantes do time ${i+1} apagadas. O código continuará com |flag=.`);
}
function clearAllParticipantFlags(){
  state.teams.forEach(t => setTeamParticipantFlagValue(t, ''));
  renderTeams();
  autoSave(false);
  flash('copyStatus','Todas as flags foram apagadas. O código continuará com |flag=.');
}
function addPlayer(i){ if(!Array.isArray(state.teams[i].players)) state.teams[i].players=[]; state.teams[i].players.push(blankPlayer()); renderTeams(); autoSave(false); }
function removePlayer(i,j){
  if(!Array.isArray(state.teams[i].players)) return;
  state.teams[i].players.splice(j,1);
  const rebuilt = new Set();
  openPlayerLinks.forEach(key => {
    const [teamIndex, playerIndex] = key.split(':').map(Number);
    if(teamIndex !== i) rebuilt.add(key);
    else if(playerIndex < j) rebuilt.add(key);
    else if(playerIndex > j) rebuilt.add(`${teamIndex}:${playerIndex-1}`);
  });
  openPlayerLinks.clear(); rebuilt.forEach(key => openPlayerLinks.add(key));
  const rebuiltTeams=new Set(); openPlayerTeams.forEach(key=>{ const [ti,pi]=key.split(':').map(Number); if(ti!==i) rebuiltTeams.add(key); else if(pi<j) rebuiltTeams.add(key); else if(pi>j) rebuiltTeams.add(`${ti}:${pi-1}`); });
  openPlayerTeams.clear(); rebuiltTeams.forEach(key=>openPlayerTeams.add(key));
  renderTeams(); autoSave(false);
}
function syncPrizeFromTeams(){
  orderedPrizeTeams().forEach((t,i) => { t.prizeTeam = state.teams[i]?.name || ''; });
  renderPrize(); autoSave(false);
  flash('copyStatus','Prize Pool preenchido com os times dos participantes.');
}
function syncPrizeFromStandings(){
  const finals=orderedFinalTeams();
  orderedPrizeTeams().forEach((t,i) => { t.prizeTeam = finals[i] ? effectiveStandingTeam(finals[i]) : ''; });
  renderPrize(); autoSave(false);
  flash('copyStatus','Prize Pool preenchido pela ordem da Final.');
}
function syncStandingsFromTeams(){
  state.teams.forEach(t => { t.standingTeam = t.name; });
  renderStandings(); renderPrize(); autoSave(false);
  flash('copyStatus','Final preenchida com os times dos participantes.');
}
function syncTeamsFromPrize(){
  const prizes=orderedPrizeTeams();
  state.teams.forEach((t,i) => {
    const source=prizes[i]||t;
    const prizeName = clean(source.prizeTeam) || clean(source.standingTeam) || clean(source.name);
    if(prizeName) t.name = prizeName;
  });
  renderAll(); autoSave(false);
  flash('copyStatus','Participantes preenchidos com a ordem atual do Prize Pool.');
}

function setFinalCodeMode(value){ state.settings.finalCodeMode=value==='dual'?'dual':'simple'; fillSettingsInputs(); generateWiki(false); autoSave(false); }
function setStandingFormat(format){
  const next = format === 'champion' ? 'champion' : 'traditional';
  const currentTitle = clean(state.settings.standingsTitle);
  const legacyDefaults = new Set(['Overall Standings','Grand Finals Overall Standings','Champion Rush Overall Standings']);
  if(!currentTitle || legacyDefaults.has(currentTitle)) state.settings.standingsTitle = 'Finals Standings';
  state.settings.standingFormat = next;
  renderStandings(); fillSettingsInputs(); autoSave(false);
}
function setHeadstartEnabled(checked){
  state.settings.headstartEnabled = checked ? 'true' : 'false';
  renderStandings(); fillSettingsInputs(); autoSave(false);
}
function championWinnerUid(){
  const saved=clean(state.settings.winnerUid);
  if(saved && state.teams.some(t=>t.uid===saved)) return saved;
  const legacy=Number(state.settings.winnerIndex);
  if(Number.isInteger(legacy) && legacy>=0){
    const team=orderedFinalTeams()[legacy];
    if(team){ state.settings.winnerUid=team.uid; return team.uid; }
  }
  return '';
}
function syncLegacyWinnerIndex(){
  const uid=championWinnerUid();
  const index=uid?orderedFinalTeams().findIndex(t=>t.uid===uid):-1;
  state.settings.winnerIndex=index>=0?String(index):'';
}
function setOverallWinner(teamIndex){
  const team=state.teams[Number(teamIndex)];
  if(!team)return;
  state.settings.winnerUid=team.uid;
  syncLegacyWinnerIndex();
  renderStandings();
  autoSave(false);
}
function setChampionActivated(teamIndex,checked){
  if(!state.teams[teamIndex])return;
  state.teams[teamIndex].championActivated=!!checked;
  autoSave(false);
}

function toggleOverallTools(){
  const panel = $('overallTools');
  if(!panel) return;
  panel.classList.toggle('open');
}
function setAutoPlacementFromTools(checked){
  state.settings.autoPlacement = checked ? 'true' : 'false';
  if(checked) refreshAllAutoPP();
  renderStandings();
  fillSettingsInputs();
  autoSave(false);
  flash('copyStatus', checked ? 'Cálculo de placement points ativado.' : 'Cálculo de placement points desativado.');
}
function setGroupAutoPlacementFromTools(checked){
  state.settings.groupAutoPlacement = checked ? 'true' : 'false';
  if(checked) refreshAllGroupAutoPP();
  renderGroupStandings();
  fillSettingsInputs();
  autoSave(false);
  flash('copyStatus', checked ? 'Cálculo automático de PP ativado na Fase de Grupos.' : 'Cálculo automático de PP desativado na Fase de Grupos.');
}
function fillAllMP(){
  const input = $('fillAllMpValue');
  const value = input ? input.value : '';
  state.teams.forEach(t => { t.mp = value; });
  renderStandings();
  autoSave(false);
  flash('copyStatus', `MP preenchido com ${value || 'vazio'} em todos os times.`);
}

function qualTemplate(q){ return q === 'qualifier' ? {method:'qual.', text:'Qualifier'} : {method:'invite', text:'Invited'}; }
function participantsHeading(){ return Number(state.settings.teamCount) > 12 ? '==Participants==' : '==Final Participants=='; }
function hasPrizeValue(v){ const x = clean(v); return x !== '' && x !== '0'; }
function paddedOpponentName(name){
  const teamNames = orderedPrizeTeams().map(t => clean(effectivePrizeTeam(t))).filter(Boolean);
  const maxLen = Math.max(0, ...teamNames.map(n => n.length));
  const base = clean(name);
  return base + ' '.repeat(Math.max(0, maxLen - base.length));
}
function prizePoolHeaderLine(){
  const s=state.settings, attrs=[];
  if(clean(s.prizeCutAfter)) attrs.push(`cutafter=${clean(s.prizeCutAfter)}`);
  if(clean(s.prizeSummary)) attrs.push(`prizesummary=${clean(s.prizeSummary)}`);
  attrs.push(`localcurrency=${val(s.localCurrency,'brl')}`);
  attrs.push(`import=${val(s.prizeImport,'false')}`);
  return `{{TeamPrizePool|${attrs.join('|')}`;
}
function prizeQualificationLines(){
  const s=state.settings;
  if(s.prizePoolMode==='values_only' || s.prizeQualEnabled!=='true') return [];
  const lines=[];
  if(clean(s.prizeQualPage)) lines.push(`|qualifies1=${clean(s.prizeQualPage)}${clean(s.prizeQualName)?` |qualifies1name=${clean(s.prizeQualName)}`:''}`);
  return lines;
}
function prizeSlotLine(t,index){
  const provisional = state.settings.prizePoolMode === 'values_only';
  const team = provisional ? '' : paddedOpponentName(effectivePrizeTeam(t));
  const parts=['{{Slot'];
  if(hasPrizeValue(t.prize)) parts.push(`localprize=${clean(t.prize)}`);
  const qualCount=Math.max(0,Math.min(state.teams.length,Number(state.settings.prizeQualCount)||0));
  if(!provisional && state.settings.prizeQualEnabled==='true' && index<qualCount) parts.push('qualified1=y');
  parts.push(`{{Opponent|${team}${team?' ':''}}}`);
  if(!provisional && clean(t.prizeDate)) parts.push(`date=${clean(t.prizeDate)}`);
  return `|${parts.join('|')} }}`;
}

function participantTeamWiki(t){
  const lines = [];
  lines.push(`|{{Opponent|${val(t?.name,'')}|qualification=${qualificationWikiForTeam(t)}`);
  lines.push('  |players={{Persons');
  const players = Array.isArray(t?.players) ? t.players : [];
  players.forEach(p => lines.push(`    |{{Person|${val(p?.name,'')}${flagAttr(hasOwn(p,'flag') ? p.flag : 'br')}${clean(p?.link) ? `|link=${clean(p.link)}` : ''}${playerTeamAttr(p?.team)}${playerRoleAttr(p?.role)}}}`));
  lines.push('    ');
  lines.push(`    |{{Person|${val(t?.coach?.name,'')}${flagAttr(hasOwn(t?.coach,'flag') ? t.coach.flag : 'br')}|role=${clean(t?.coach?.role)||'head coach'}|type=staff}}`);
  if(state.settings.includeAnalyst!=='false') lines.push(`    |{{Person|${val(t?.analyst?.name,'')}${flagAttr(hasOwn(t?.analyst,'flag') ? t.analyst.flag : 'br')}|role=${clean(t?.analyst?.role)||'analyst'}|type=staff}}`);
  lines.push('  }}');
  lines.push('}}');
  return lines.join('\n');
}

async function copyParticipantTeam(i){
  const t = state.teams[i];
  if(!t){ flash('copyStatus','Time não encontrado.'); return; }
  const text = participantTeamWiki(t);
  $('output').value = text;
  await copyText(text, `Código do time ${i+1}${clean(t.name) ? ` (${clean(t.name)})` : ''} copiado.`);
}

function paddedStandingTeam(name){
  const names = orderedFinalTeams().slice(0,finalStandingCount()).map(t=>clean(effectiveStandingTeam(t))).filter(Boolean);
  const maxLen = Math.max(0, ...names.map(n=>n.length));
  const base = clean(name);
  return base + ' '.repeat(Math.max(0,maxLen-base.length));
}
function groupBgValue(){
  const {qualified,eliminated}=classificationCounts(), parts=[];
  if(qualified>0) parts.push(`1-${qualified}=up`);
  if(eliminated>0) parts.push(`${qualified+1}-${qualified+eliminated}=down`);
  return parts.join(',');
}
function groupLegendLines(){
  return ['{{Legend |title=Positions |down=1|up=1',`|uptitle=Qualified for '''${val(state.settings.groupAdvanceTo,'Finals')}'''`,'}}','{{VerticalMargin}}'];
}
function paddedGroupTeam(name){
  const names=orderedGroupTeams().map(t=>clean(effectiveGroupTeam(t))).filter(Boolean), max=Math.max(8,...names.map(x=>x.length)), base=clean(name);
  return base+' '.repeat(Math.max(0,max-base.length));
}
function paddedFfaRoundValue(value){
  const base=clean(value);
  return base.padEnd(4,' ');
}
function groupStandingsWikiLines(){
  const s=state.settings;
  if(s.groupStandingsEnabled!=='true') return [`:${val(s.groupStageText,'To be Determined')}`];
  const lines=[...groupLegendLines()], bg=groupBgValue();
  if(s.groupStandingsType==='ffa'){
    const rounds=Math.max(1,Math.min(24,Number(s.groupFfaRounds)||3)); ensureGroupRoundCapacity(rounds);
    lines.push(`{{FfaStandings|title=${val(s.groupStandingsTitle,'Group Stage Standings')}|import=${val(s.groupFfaImport,'false')}${bg?`|bg=${bg}`:''}`);
    lines.push(`|rounds=${rounds}`);
    state.groupRoundConfigs.slice(0,rounds).forEach((r,i)=>lines.push(` |round${i+1}={{Round|title=${val(r.title,`Day ${i+1}`)} |started=${r.started||''}|finished=${r.finished||''}}}`));
    groupedFfaOutput().forEach(group=>{
      if(ffaGroupsActive()) lines.push(group.unassigned?'<!--Sem grupo-->':`<!--Group ${group.name}-->`);
      group.entries.forEach(({team:t})=>{
        const attrs=Array.from({length:rounds},(_,i)=>`|r${i+1}=${paddedFfaRoundValue(groupRoundDailyValue(t,i))}`).join('');
        lines.push(`|{{TeamOpponent|${paddedGroupTeam(effectiveGroupTeam(t))}${attrs}}}`);
      });
    });
    lines.push('}}'); return lines;
  }
  const totalMode=s.groupOverallMode==='total', attrs=[`title=${val(s.groupStandingsTitle,'Group Stage Overall Standings')}`];
  if(totalMode) attrs.push('total-only=true','showmatches=true'); attrs.push('finished=true'); if(bg)attrs.push(`bg=${bg}`);
  lines.push(`{{OverallStandingsTable|${attrs.join('|')}`);
  orderedGroupTeams().forEach(t=>{
    const team=paddedGroupTeam(effectiveGroupTeam(t)), common=`|mp=${val(t.groupMp,' ')}|booyah=${val(t.groupBooyah,'0')}`;
    if(totalMode) lines.push(`|{{TeamOpponent|${team}${common}|total=${val(t.groupTotal,'  ')}}}`);
    else { const groupPpOut=s.groupAutoPlacement==='true'?calculateGroupPlacementPoints(t):t.groupPp; lines.push(`|{{TeamOpponent|${team}${common}|pp=${val(groupPpOut,'  ')}|kp=${val(t.groupKp,'  ')}}}`); }
  });
  lines.push('}}'); return lines;
}
function groupStageResultLines(){ if(state.settings.groupStageIncluded==='false') return []; return [`===${val(state.settings.groupStageHeading,'Group Stage')}===`,...groupStandingsWikiLines()]; }

function championBackgroundValue(){
  const count=finalStandingCount();
  const winnerUid=championWinnerUid();
  const statuses=orderedFinalTeams().slice(0,count).map(t=>t.uid===winnerUid?'up':t.championActivated?'stay':'');
  const segments=[];
  let start=-1,current='';
  const flush=end=>{
    if(start<0||!current)return;
    const first=start+1,last=end+1;
    segments.push(`${first===last?first:`${first}-${last}`}=${current}`);
  };
  for(let i=0;i<=statuses.length;i++){
    const status=i<statuses.length?statuses[i]:'';
    if(status===current)continue;
    flush(i-1);
    current=status;
    start=status?i:-1;
  }
  return segments.join(',');
}
function parseChampionBackground(value,count){
  const statuses=Array(Math.max(0,Number(count)||0)).fill('');
  String(value||'').replace(/<!--[\s\S]*?-->/g,'').split(',').forEach(part=>{
    const match=part.trim().match(/^(\d+)(?:-(\d+))?\s*=\s*(up|stay)$/i);
    if(!match)return;
    let first=Math.max(1,Number(match[1])),last=Math.max(first,Number(match[2]||match[1]));
    last=Math.min(statuses.length,last);
    for(let pos=first;pos<=last;pos++)statuses[pos-1]=match[3].toLowerCase();
  });
  return {winnerIndex:statuses.indexOf('up'),activatedIndexes:statuses.map((status,i)=>status==='stay'?i:-1).filter(i=>i>=0)};
}
function overallWikiLines(){
  const s = state.settings;
  const champion = s.standingFormat === 'champion';
  const totalMode = s.standingMode === 'total';
  const headstart = s.headstartEnabled === 'true';
  const lines = [];
  if(champion){
    lines.push('{{Legend|up=y|uptitle=Won through Match Point|stay=y|staytitle=Met Match Point Threshold}}');
    lines.push('{{VerticalMargin}}');
  }
  const championBg=champion?championBackgroundValue():'';
  lines.push(`{{FfaStandings|title=${val(s.standingsTitle,'Finals Standings')}${championBg?`|bg=${championBg}`:''}`);
  lines.push('|round1={{Round|title=Matches <br>Played|started=true|finished=true}}');
  lines.push('|round2={{Round|title=Booyah|started=true|finished=true}}');
  if(totalMode){
    lines.push('|round3={{Round|title=Total <br>Points|started=true|finished=true}}');
    if(headstart) lines.push('|round4={{Round|title=Headstart <br>Points|started=true|finished=true}}');
  }else{
    lines.push('|round3={{Round|title=Place <br>Points|started=true|finished=true}}');
    lines.push('|round4={{Round|title=Kill <br>Points|started=true|finished=true}}');
    if(headstart) lines.push('|round5={{Round|title=Headstart <br>Points|started=true|finished=true}}');
  }
  orderedFinalTeams().slice(0,finalStandingCount()).forEach(t=>{
    const team = paddedStandingTeam(effectiveStandingTeam(t));
    if(totalMode){
      const bp = headstart ? `|r4=${val(t.bp,'  ')}` : '';
      lines.push(`|{{TeamOpponent|${team}|r1=${val(t.mp,' ')}|r2=${val(t.booyah,'0')}|r3=${val(t.total,'  ')}${bp}}}`);
    }else{
      const ppOut = s.autoPlacement === 'true' ? calculatePlacementPoints(t) : t.pp;
      const bp = headstart ? `|r5=${val(t.bp,'  ')}` : '';
      lines.push(`|{{TeamOpponent|${team}|r1=${val(t.mp,' ')}|r2=${val(t.booyah,'0')}|r3=${val(ppOut,'  ')}|r4=${val(t.kp,'  ')}${bp}}}`);
    }
  });
  lines.push('}}');
  return lines;
}

function finalPlacementPointArray(){
  const defaults=[12,9,8,7,6,5,4,3,2,1,0,0];
  const raw=clean(state.settings.finalPlacementPoints).split(',').map(x=>Number(clean(x)));
  return defaults.map((d,i)=>Number.isFinite(raw[i])?raw[i]:d);
}
function finalDetailedMatchCount(){
  let max=0;
  (state.finalDetailedMaps||[]).forEach(m=>{max=Math.max(max,Number(m.match)||0);});
  state.teams.forEach(t=>(t.finalMatches||[]).forEach(m=>{max=Math.max(max,Number(m.match)||0);}));
  return max||Number(orderedFinalTeams()[0]?.mp)||0;
}
function dualFinalWikiLines(){
  const s=state.settings,teams=orderedFinalTeams().slice(0,finalStandingCount()),winnerUid=championWinnerUid();
  const lines=[];
  lines.push('{{box|start}}{{Tabs dynamic|name1=Overview Standings|icon1=matchpagelink|name2=Detailed Standings|icon2=standings|hide-showall=true|This=2}}<!--');
  lines.push('Overview');
  lines.push('-->{{Tabs dynamic/tab|1}}');
  lines.push(`{{FfaStandings|title=${val(s.finalOverviewTitle,'Champion Rush Standings Overview')}|import=false|tiebreakers=["manual","points"]`);
  lines.push('|round1={{Round|title=Match Played\t\t\t\t\t\t\t\t\t\t|started=true|finished=true}}');
  lines.push('|round2={{Round|title=[[File:Free Fire Booyah! allmode.png|55px]]\t\t|started=true|finished=true}}');
  lines.push('|round3={{Round|title=Place Points\t\t\t\t\t\t\t\t\t\t|started=true|finished=true}}');
  lines.push('|round4={{Round|title=Kill Points\t\t\t\t\t\t\t\t\t\t|started=true|finished=true}}');
  teams.forEach((t,index)=>{
    const name=paddedStandingTeam(effectiveStandingTeam(t));
    const starting=clean(t.bp)!==''?`|startingpoints=${clean(t.bp)}`:'';
    const tie=clean(t.finalTiebreaker)||String(teams.length-index);
    lines.push(`|{{TeamOpponent|${name}|r1=${val(t.mp,' ')}\t|r2=${val(t.booyah,'0')}\t|r3=${val(t.pp,'  ')}\t|r4=${val(t.kp,'  ')}${starting}\t|tiebreaker=${tie}}}`);
  });
  lines.push('}}');
  lines.push('<!--');
  lines.push('Detailed');
  lines.push('-->{{Tabs dynamic/tab|2}}');
  lines.push(`{{Bracket|Bracket/2|id=${val(s.finalBracketId,'finalcr')}`);
  lines.push(`|R1M1header=${val(s.finalDetailedHeader,'Champion Rush')}`);
  const matchpoint=clean(s.finalMatchpoint);
  lines.push(`|R1M1={{Match|finished=true${matchpoint?`|matchpoint=${matchpoint}`:''}|showgamedetails=true`);
  const pp=finalPlacementPointArray(),kill=val(s.finalKillPoint,'1');
  lines.push(`    |p_kill=${kill} ${pp.map((v,i)=>`|p${i+1}=${scoreText(v)}`).join(' ')}`);
  lines.push(`    |twitch=${clean(s.finalTwitch)}|youtube=${clean(s.finalYoutube)}`);
  const winner=teams.find(t=>t.uid===winnerUid);
  let winnerMatch=Number(s.finalWinnerMatch)||0;
  if(!winnerMatch && winner){
    const wins=(winner.finalMatches||[]).filter(m=>Number(m.placement)===1);
    if(wins.length)winnerMatch=wins[wins.length-1].match;
  }
  if(winner) lines.push(`    |comment='''Note:''' {{Team|${clean(effectiveStandingTeam(winner))}}} won through Champion Rush${winnerMatch?` after Booyah at Match ${winnerMatch}`:''}.`);
  const mapByMatch=new Map((state.finalDetailedMaps||[]).map(m=>[Number(m.match),m]));
  const count=finalDetailedMatchCount();
  for(let n=1;n<=count;n++){
    const m=mapByMatch.get(n)||{date:'',map:'',mvp:'',vod:''};
    lines.push(`    |map${n}={{Map|date=${clean(m.date)}|finished=true|map=${clean(m.map)}${clean(m.mvp)?`\t|mvp=${clean(m.mvp)}`:''}\t|vod=${clean(m.vod)}}}`);
  }
  lines.push('');
  teams.forEach((t,index)=>{
    let placement=clean(t.finalPlacement);
    if(t.uid===winnerUid)placement='1';
    else if(placement==='1')placement='';
    const placementAttr=placement?`|placement=${placement}`:'';
    lines.push(`    |opponent${index+1}={{TeamOpponent|${clean(effectiveStandingTeam(t))}${placementAttr}`);
    const matches=[...(t.finalMatches||[])].sort((a,b)=>Number(a.match)-Number(b.match));
    for(let j=0;j<matches.length;j+=6){
      const chunk=matches.slice(j,j+6).map(m=>`|m${m.match}={{MS|${clean(m.placement)}|${clean(m.kills)}}}`).join('\t');
      lines.push(`        ${chunk}`);
    }
    lines.push('        }}');
    lines.push('');
  });
  lines.push('}}');
  lines.push('}}');
  lines.push('{{Tabs dynamic/end}}');
  lines.push('{{box|end}}');
  return lines;
}

function grandFinalResultLines(){
  if(state.settings.finalStandingsEnabled==='false') return [`:${val(state.settings.finalStageText,'To be Determined')}`];
  if(state.settings.finalCodeMode==='dual') return dualFinalWikiLines();
  return overallWikiLines();
}

function generatedIntro(){
  const i=state.infobox||{}; const name=val(i.name,i.displayTitle); const organizer=val(i.organizer,'');
  return `<p style="max-width:990px; padding-top:15px">'''${name}''' it's an event organized by ${organizer}. </p>`;
}
function infoboxWikiLines(){
  const i=state.infobox||{}; const lines=[], single=i.singleDate===true;
  lines.push(`{{DISPLAYTITLE:${val(i.displayTitle,i.name)}}}`); lines.push('{{Infobox league');
  infoboxFieldOrder.forEach(key=>{
    if(key==='imagedarkmode'||key==='icondarkmode')return;
    if(key==='date'&&!single)return;
    if((key==='sdate'||key==='edate')&&single)return;
    let value=i[key]??'';
    if(key==='date'&&single&&!clean(value)) value=clean(i.sdate)||clean(i.edate);
    if(key==='team_number'&&!clean(value)) value=state.settings.teamCount;
    if(key==='localcurrency'&&!clean(value)) value=state.settings.localCurrency;
    if(key==='image'){ lines.push(`|image=${value}          |imagedarkmode=${i.imagedarkmode??''}`); return; }
    if(key==='icon'){ lines.push(`|icon=${value}            |icondarkmode=${i.icondarkmode??''}`); return; }
    lines.push(`|${key}=${value}`);
  });
  lines.push('}}'); lines.push(clean(i.intro)||generatedIntro()); return lines;
}
function smartInfobox(force=false){
  const i=state.infobox||(state.infobox=defaultInfobox()); const title=clean(i.name)||clean(i.displayTitle); if(!title) return;
  const seasonMatch=title.match(/\b((?:Season|Split|Stage|Etapa|Série|Serie)\s*[A-Za-z0-9.-]+)\b/i);
  const yearMatch=title.match(/\b(20\d{2}(?:\s*(?:S\d+|Split\s*\d+))?)\b/i);
  const short=seasonMatch?.[1]||yearMatch?.[1]||'';
  let organizer=title; if(short) organizer=clean(title.slice(0,title.toLowerCase().indexOf(short.toLowerCase()))); organizer=organizer.replace(/[\-–—:]+$/,'').trim();
  const set=(key,value)=>{ if(force||!clean(i[key])) i[key]=value; };
  set('displayTitle',title); set('tickername',title); if(short) set('shortname',short); if(organizer) set('organizer',organizer);
  set('team_number',String(state.settings.teamCount)); set('localcurrency',state.settings.localCurrency||'brl');
  fillSettingsInputs(); autoSave(false); flash('copyStatus',`Campeonato reconhecido como "${title}".`);
}
function generateWiki(showStatus=false){
  const s = state.settings;
  const legacyQ=(state.formatStages||[]).find(x=>x.type==='qualifier'),legacyF=(state.formatStages||[]).find(x=>x.type==='final');
  if(legacyQ){s.qualifierDates=wikiDateText(legacyQ);s.qualifierTeams=legacyQ.teams;s.qualifyTop=legacyQ.qualifyTop;} if(legacyF){s.finalDate=wikiDateText(legacyF);s.finalMatches=legacyF.matches;}
  const lines = [];
  lines.push(...infoboxWikiLines());
  lines.push('');
  lines.push(...aboutWikiLines());
  lines.push('');
  lines.push('==Prize Pool==');
  lines.push(prizePoolHeaderLine());
  lines.push(...prizeQualificationLines());
  orderedPrizeTeams().forEach((t,i)=> lines.push(prizeSlotLine(t,i)));
  if(s.prizePoolMode!=='values_only' && s.includeMvp !== 'false'){
    lines.push('|adjacentContent=');
    lines.push(`{{AwardPrizePool |localcurrency=${val(s.localCurrency,'brl')}`);
    lines.push(`|{{Slot |award=MVP${clean(s.mvpPrize)?`|localprize=${clean(s.mvpPrize)}`:''}|{{Opponent|${val(s.mvpPlayer,'tbd')}|flag=${val(s.mvpFlag,'br')}|team=${val(s.mvpTeam,'')} }} }}`);
    lines.push('}}');
  }
  lines.push('}}');
  lines.push('');
  lines.push(participantsHeading());
  lines.push('{{TeamParticipants');
  state.teams.forEach(t => lines.push(participantTeamWiki(t)));
  lines.push('}}');
  lines.push('');
  lines.push('==Results==');
  lines.push(...groupStageResultLines());
  lines.push('');
  lines.push('===Grand Finals===');
  lines.push(...grandFinalResultLines());
  lines.push('');
  lines.push(...broadcastWikiLines());
  $('output').value = lines.join('\n');
  if(showStatus) flash('copyStatus','Texto wiki completo gerado, começando pela Infobox da liga.');
  return $('output').value;
}

async function copyOutput(){
  const text = generateWiki(false);
  $('output').value = text;
  await copyText(text, 'Resultado completo copiado. O texto completo também apareceu na caixa acima de Importar wiki.');
}

async function copyText(text, okMessage){
  try{
    await navigator.clipboard.writeText(text);
    flash('copyStatus', okMessage || 'Copiado para a área de transferência.');
  }
  catch(e){
    const out = $('output');
    const old = out.value;
    out.value = text;
    out.focus();
    out.select();
    document.execCommand('copy');
    out.value = old;
    flash('copyStatus', okMessage || 'Copiado usando seleção automática.');
  }
}

function sectionBetween(text, startMarker, endMarker){
  const start = text.indexOf(startMarker);
  if(start === -1) return '';
  const end = endMarker ? text.indexOf(endMarker, start + startMarker.length) : -1;
  return text.slice(start, end === -1 ? text.length : end).trim();
}

async function copySection(section){
  const text = generateWiki(false);
  const pHeading = participantsHeading();
  const map = {
    infobox:{label:'Infobox', value:sectionBetween(text, '{{DISPLAYTITLE:', '==About==')},
    about:{label:'About/Formato', value:sectionBetween(text, '==About==', '==Prize Pool==')},
    prize:{label:'Prize Pool', value:sectionBetween(text, '==Prize Pool==', pHeading)},
    participants:{label:'Participantes', value:sectionBetween(text, pHeading, '==Results==')},
    results:{label:'Results', value:sectionBetween(text, '==Results==', '==Broadcast==')},
    groupStage:{label:'Group Stage', value:groupStageResultLines().join('\n')},
    grandFinals:{label:'Grand Finals', value:sectionBetween(text, '===Grand Finals===', '==Broadcast==')},
    broadcast:{label:'Broadcast e conteúdo final', value:sectionBetween(text, '==Broadcast==', null)}
  };
  const item = map[section];
  if(!item || !item.value){ flash('copyStatus','Não consegui encontrar essa seção no texto gerado.'); return; }
  $('output').value = item.value;
  await copyText(item.value, `${item.label} copiado. A seção também apareceu na caixa de texto acima de Importar wiki.`);
}

function downloadWiki(){
  const text = $('output').value || generateWiki(false);
  const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (aliasKey(state.infobox?.name) || 'torneio-liquipedia') + '.txt'; a.click(); URL.revokeObjectURL(a.href);
}

function flash(id,msg){ const el=$(id); if(!el) return; el.textContent=msg; setTimeout(()=>{ if(el.textContent===msg) el.textContent=''; }, 3000); }
const HISTORY_LIMIT=100;
let historyUndoStack=[],historyRedoStack=[],historyCurrentSerialized='',historyApplying=false,historyGroupKey='',historyGroupTime=0;
function historySerialize(){return JSON.stringify(state);}
function initializeHistory(){historyUndoStack=[];historyRedoStack=[];historyCurrentSerialized=historySerialize();historyApplying=false;historyGroupKey='';historyGroupTime=0;updateHistoryButtons();}
function historyActiveInputKey(){
  const el=document.activeElement;if(!el||!['INPUT','TEXTAREA'].includes(el.tagName))return '';
  if(['checkbox','radio','file','button','submit'].includes(String(el.type||'').toLowerCase()))return '';
  return el.id||el.dataset.path||`${el.tagName}:${el.name||el.placeholder||''}`;
}
function updateHistoryButtons(){const undo=$('undoBtn'),redo=$('redoBtn');if(undo)undo.disabled=!historyUndoStack.length;if(redo)redo.disabled=!historyRedoStack.length;}
function recordHistoryChange(){
  if(historyApplying)return;
  const current=historySerialize();
  if(!historyCurrentSerialized){historyCurrentSerialized=current;updateHistoryButtons();return;}
  if(current===historyCurrentSerialized)return;
  const key=historyActiveInputKey(),now=Date.now(),coalesce=!!key&&key===historyGroupKey&&(now-historyGroupTime)<900;
  if(!coalesce){historyUndoStack.push(historyCurrentSerialized);if(historyUndoStack.length>HISTORY_LIMIT)historyUndoStack.shift();}
  historyCurrentSerialized=current;historyRedoStack=[];historyGroupKey=key;historyGroupTime=now;updateHistoryButtons();
}
function restoreHistorySnapshot(serialized){
  historyApplying=true;
  try{state=normalizeState(JSON.parse(serialized));resetParticipantTransientState();renderAll();localStorage.setItem('liquipediaTournamentEditor',serialized);historyCurrentSerialized=serialized;}
  finally{historyApplying=false;historyGroupKey='';historyGroupTime=0;updateHistoryButtons();}
}
function undoChange(){
  if(!historyUndoStack.length)return;
  historyRedoStack.push(historyCurrentSerialized);
  const target=historyUndoStack.pop();restoreHistorySnapshot(target);flash('copyStatus','Última alteração desfeita.');
}
function redoChange(){
  if(!historyRedoStack.length)return;
  historyUndoStack.push(historyCurrentSerialized);
  const target=historyRedoStack.pop();restoreHistorySnapshot(target);flash('copyStatus','Alteração refeita.');
}
function autoSave(render=true){recordHistoryChange();localStorage.setItem('liquipediaTournamentEditor', JSON.stringify(state));if(render)fillSettingsInputs();if(teamRegistryOpen)renderTeamRegistryManager();}
function saveNow(){ saveCurrentInformation(true); autoSave(false); flash('copyStatus','Projeto, banco de dados e aliases salvos no navegador.'); }
function loadSaved(){
  try{ const raw=localStorage.getItem('liquipediaTournamentEditor'); if(raw){ state = normalizeState(JSON.parse(raw)); } }catch(e){}
}
function normalizeState(obj){
  const base=createDefaultState();
  const out={...base,...(obj||{}),settings:{...base.settings,...(obj?.settings||{})},infobox:{...base.infobox,...(obj?.infobox||{})}};
  if(obj?.infobox){
    if(hasOwn(obj.infobox,'imagedarkmode')) out.infobox.imagedarkmode=clean(obj.infobox.imagedarkmode);
    else if(hasOwn(obj.infobox,'imagedark')) out.infobox.imagedarkmode=clean(obj.infobox.imagedark);
    if(!hasOwn(obj.infobox,'icondarkmode') && hasOwn(obj.infobox,'icondark')) out.infobox.icondarkmode=clean(obj.infobox.icondark);
  }
  delete out.infobox.imagedark;
  delete out.infobox.icondark;
  out.infobox.singleDate=obj?.infobox?.singleDate===true || (!!clean(obj?.infobox?.date) && !clean(obj?.infobox?.sdate) && !clean(obj?.infobox?.edate));
  out.infobox.date=clean(out.infobox.date);
  if(Array.isArray(obj?.formatStages)) out.formatStages=obj.formatStages.map(normalizeFormatStage);
  else {
    const q=normalizeFormatStage({...blankFormatStage('qualifier'),...parseWikiDateText(out.settings.qualifierDates),teams:out.settings.qualifierTeams,qualifyTop:out.settings.qualifyTop,advanceTo:'Final'});
    const f=normalizeFormatStage({...blankFormatStage('final'),...parseWikiDateText(out.settings.finalDate),teams:String(out.settings.teamCount||12),matches:out.settings.finalMatches});
    out.formatStages=[q,f];
  }
  out.settings.teamCount=[12,18,24].includes(+out.settings.teamCount)?+out.settings.teamCount:12;
  out.settings.standingFormat=out.settings.standingFormat==='champion'?'champion':'traditional'; out.settings.standingMode=out.settings.standingMode==='total'?'total':'complete';
  out.settings.finalStandingsEnabled=out.settings.finalStandingsEnabled==='false'?'false':'true'; out.settings.finalStageText=clean(out.settings.finalStageText)||'To be Determined'; out.settings.finalCodeMode=out.settings.finalCodeMode==='dual'?'dual':'simple'; out.settings.finalMatchpoint=clean(out.settings.finalMatchpoint); out.settings.finalBracketId=clean(out.settings.finalBracketId); out.settings.finalKillPoint=clean(out.settings.finalKillPoint)||'1'; out.settings.finalPlacementPoints=clean(out.settings.finalPlacementPoints)||'12,9,8,7,6,5,4,3,2,1,0,0'; out.settings.finalWinnerMatch=clean(out.settings.finalWinnerMatch); out.settings.finalTwitch=clean(out.settings.finalTwitch); out.settings.finalYoutube=clean(out.settings.finalYoutube); out.settings.finalDetailedHeader=clean(out.settings.finalDetailedHeader)||'Champion Rush'; out.settings.finalOverviewTitle=clean(out.settings.finalOverviewTitle)||'Champion Rush Standings Overview';
  out.settings.prizePoolMode=out.settings.prizePoolMode==='values_only'?'values_only':'complete';
  out.settings.headstartEnabled=out.settings.headstartEnabled==='true'?'true':'false'; out.settings.winnerIndex=/^\d+$/.test(String(out.settings.winnerIndex??''))?String(out.settings.winnerIndex):''; out.settings.winnerUid=clean(out.settings.winnerUid);
  out.settings.groupStageIncluded=out.settings.groupStageIncluded==='false'?'false':'true'; out.settings.groupStandingsEnabled=out.settings.groupStandingsEnabled==='true'?'true':'false'; out.settings.groupStandingsType=out.settings.groupStandingsType==='ffa'?'ffa':'overall'; out.settings.groupOverallMode=out.settings.groupOverallMode==='total'?'total':'complete'; out.settings.groupAutoPlacement=out.settings.groupAutoPlacement==='true'?'true':'false'; out.settings.groupFfaImport=out.settings.groupFfaImport==='true'?'true':'false'; out.settings.groupFfaCumulative=out.settings.groupFfaCumulative==='true'?'true':'false'; out.settings.groupFfaGroupsEnabled=out.settings.groupFfaGroupsEnabled==='true'?'true':'false'; out.settings.groupFfaGroupMode='manual'; out.settings.groupFfaGroupNames=clean(out.settings.groupFfaGroupNames)||'A, B, C, D'; out.settings.groupFfaTeamsPerGroup=String(Math.max(1,Math.min(24,Number(out.settings.groupFfaTeamsPerGroup)||6))); out.settings.includePlayerRoles=out.settings.includePlayerRoles==='true'?'true':'false';
  out.settings.prizeQualEnabled=out.settings.prizeQualEnabled==='true'?'true':'false'; out.settings.prizeSummary=['true','false',''].includes(String(out.settings.prizeSummary))?String(out.settings.prizeSummary):'false';
  out.settings.groupFfaRounds=String(Math.max(1,Math.min(24,Number(out.settings.groupFfaRounds)||3))); out.settings.groupQualifyCount=String(Math.max(0,Math.min(out.settings.teamCount,Number(out.settings.groupQualifyCount)||0))); out.settings.groupEliminatedCount=String(Math.max(0,out.settings.teamCount-Number(out.settings.groupQualifyCount)));
  out.settings.finalTeamCount=clean(out.settings.finalTeamCount)?String(Math.max(1,Math.min(out.settings.teamCount,Number(out.settings.finalTeamCount)||out.settings.teamCount))):''; out.settings.prizeQualCount=String(Math.max(0,Math.min(out.settings.teamCount,Number(out.settings.prizeQualCount)||0)));
  const validFocusedGroups=new Set((clean(out.settings.groupFfaGroupNames)||'A, B, C, D').split(',').map(clean).filter(Boolean)); out.groupFocusedGroups=(Array.isArray(obj?.groupFocusedGroups)?obj.groupFocusedGroups:[]).map(clean).filter((name,index,list)=>validFocusedGroups.has(name)&&list.indexOf(name)===index).slice(0,2);
  out.settings.formatShowSources=out.settings.formatShowSources==='true'?'true':'false';
  const legacySources=out.settings.formatShowSources==='true';
  out.settings.formatIncludeTotal=(obj?.settings&&hasOwn(obj.settings,'formatIncludeTotal')?obj.settings.formatIncludeTotal:(legacySources&&clean(out.settings.formatTotalTeams)?'true':'false'))==='true'?'true':'false';
  out.settings.formatIncludeInvited=(obj?.settings&&hasOwn(obj.settings,'formatIncludeInvited')?obj.settings.formatIncludeInvited:(legacySources&&clean(out.settings.formatInvitedTeams)?'true':'false'))==='true'?'true':'false';
  out.settings.formatIncludeQualifier=(obj?.settings&&hasOwn(obj.settings,'formatIncludeQualifier')?obj.settings.formatIncludeQualifier:(legacySources&&clean(out.settings.formatQualifierTeams)?'true':'false'))==='true'?'true':'false';
  out.settings.formatShowSources=[out.settings.formatIncludeTotal,out.settings.formatIncludeInvited,out.settings.formatIncludeQualifier].includes('true')?'true':'false';
  out.settings.pointsShowTb=out.settings.pointsShowTb==='true'?'true':'false';
  const savedPreset=obj?.settings?.formatPreset; out.settings.formatPreset=['qualifier_final','group_final','group_point_final','point_final','final_only','custom'].includes(savedPreset)?savedPreset:inferFormatPreset(out.formatStages);
  if(['Overall Standings','Grand Finals Overall Standings','Champion Rush Overall Standings'].includes(clean(out.settings.standingsTitle))) out.settings.standingsTitle='Finals Standings';
  out.groupRoundConfigs=Array.isArray(obj?.groupRoundConfigs)?obj.groupRoundConfigs.map((r,i)=>({title:clean(r?.title)||`Day ${i+1}`,started:normalizeRoundBoolean(r?.started),finished:normalizeRoundBoolean(r?.finished)})):defaultGroupRoundConfigs();
  const roundCount=Number(out.settings.groupFfaRounds)||3; while(out.groupRoundConfigs.length<roundCount)out.groupRoundConfigs.push({title:`Day ${out.groupRoundConfigs.length+1}`,started:'',finished:''}); out.groupRoundConfigs=out.groupRoundConfigs.slice(0,roundCount);
  out.teams=Array.isArray(obj?.teams)?obj.teams.map(t=>{const team={...blankTeam(),...t,allowIncomplete:!!t?.allowIncomplete,players:Array.isArray(t?.players)?t.players.map(p=>({name:clean(p?.name),flag:normalizedFlag(p),link:clean(p?.link),team:clean(p?.team),role:clean(p?.role)})):blankTeam().players,coach:{name:clean(t?.coach?.name),flag:normalizedFlag(t?.coach),role:clean(t?.coach?.role)||'head coach'},analyst:{name:clean(t?.analyst?.name),flag:normalizedFlag(t?.analyst),role:clean(t?.analyst?.role)||'analyst'}};team.championActivated=t?.championActivated===true||String(t?.championActivated)==='true';team.finalPlacement=clean(t?.finalPlacement);team.finalTiebreaker=clean(t?.finalTiebreaker);team.finalMatches=Array.isArray(t?.finalMatches)?t.finalMatches.map(m=>({match:Number(m?.match)||0,placement:clean(m?.placement),kills:clean(m?.kills)})).filter(m=>m.match>0):[];team.groupRounds=Array.isArray(t?.groupRounds)?t.groupRounds.map(clean):[];while(team.groupRounds.length<roundCount)team.groupRounds.push('');team.groupRounds=team.groupRounds.slice(0,roundCount);team.groupFfaGroup=clean(t?.groupFfaGroup);return team;}):base.teams;
  out.finalDetailedMaps=Array.isArray(obj?.finalDetailedMaps)?obj.finalDetailedMaps.map((m,i)=>({match:Number(m?.match)||i+1,date:clean(m?.date),map:clean(m?.map),mvp:clean(m?.mvp),vod:clean(m?.vod)})).filter(m=>m.match>0):[];
  out.teamDB=Array.isArray(obj?.teamDB)?obj.teamDB.map(normalizeRosterTeam).filter(t=>clean(t.name)):[];
  out.broadcastTalents=Array.isArray(obj?.broadcastTalents)?obj.broadcastTalents.map(normalizeBroadcastTalent):base.broadcastTalents.map(normalizeBroadcastTalent);
  out.aliases={enabled:obj?.aliases?.enabled!==false,players:{...(obj?.aliases?.players||{})},teams:{...(obj?.aliases?.teams||{})}};
  while(out.teams.length<out.settings.teamCount) out.teams.push(blankTeam());
  out.teams=out.teams.slice(0,out.settings.teamCount);
  const usedUids=new Set();
  out.teams.forEach(t=>{let uid=clean(t.uid);if(!uid||usedUids.has(uid))uid=newTeamUid();t.uid=uid;usedUids.add(uid);});
  const normalizeSavedOrder=raw=>{const valid=new Set(out.teams.map(t=>t.uid)),seen=new Set(),result=[];(Array.isArray(raw)?raw:[]).forEach(uid=>{uid=clean(uid);if(valid.has(uid)&&!seen.has(uid)){seen.add(uid);result.push(uid);}});out.teams.forEach(t=>{if(!seen.has(t.uid)){seen.add(t.uid);result.push(t.uid);}});return result;};
  out.prizeOrder=normalizeSavedOrder(obj?.prizeOrder);
  out.groupOrder=normalizeSavedOrder(obj?.groupOrder);
  out.finalOrder=normalizeSavedOrder(obj?.finalOrder);
  const validWinnerUid=out.settings.winnerUid && out.teams.some(t=>t.uid===out.settings.winnerUid);
  if(!validWinnerUid){
    const legacyIndex=Number(out.settings.winnerIndex);
    out.settings.winnerUid=Number.isInteger(legacyIndex)&&legacyIndex>=0&&legacyIndex<out.finalOrder.length?out.finalOrder[legacyIndex]:'';
  }
  const normalizedWinnerIndex=out.settings.winnerUid?out.finalOrder.indexOf(out.settings.winnerUid):-1;
  out.settings.winnerIndex=normalizedWinnerIndex>=0?String(normalizedWinnerIndex):'';
  return out;
}
function clearAll(){
  if(!confirm('Zerar o torneio atual? O banco de times e os aliases serão preservados.')) return;
  const savedDb=Array.isArray(state.teamDB)?state.teamDB:[]; const savedAliases=safeClone(state.aliases||{enabled:true,players:{},teams:{}});
  saveEditorRecovery('Antes de zerar'); const presets=safeClone(state.tournamentPresets||[]);
  state=createDefaultState(); state.tournamentPresets=presets; state.cffPresetsInitializedV1=true; state.cffSeedImportedV1=true; state.teamDB=savedDb; state.aliases=savedAliases; resetParticipantTransientState();discardRosterDraft(); renderAll(); $('editorPresetName').value=''; $('output').value=''; autoSave(false);
}
function exportJSON(){
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='backup-torneio-liquipedia.json'; a.click(); URL.revokeObjectURL(a.href);
}
function importJSON(ev){
  const file = ev.target.files?.[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => { try{ state = normalizeState(JSON.parse(reader.result)); renderAll(); autoSave(false); flash('copyStatus','Backup JSON importado.'); }catch(e){ alert('JSON inválido.'); } };
  reader.readAsText(file);
}

function lineAfterLabel(wiki, label){ const line=wiki.split(/\r?\n/).find(l=>l.toLowerCase().includes(label.toLowerCase()+':')); if(!line) return ''; return line.replace(/^\*+\s*/,'').replace(/'/g,'').replace(new RegExp(label+':','i'),'').trim(); }
function parseNumber(pattern,wiki){ const m=wiki.match(pattern); return m?clean(m[1]):''; }
function countWanted(n){ return n<=12?12:n<=18?18:24; }
function parseInfoboxInto(target,wiki){
  target.infobox={...(target.infobox||defaultInfobox())}; const display=wiki.match(/\{\{DISPLAYTITLE:([^}\n]+)\}\}/i); if(display) target.infobox.displayTitle=clean(display[1]);
  const infoboxSource=(wiki.match(/\{\{Infobox league([\s\S]*?)(?:\n\}\}|$)/i)||[])[1]||wiki;
  const readInfoboxParam=(key,aliases=[])=>{
    for(const name of [key,...aliases]){
      const safe=String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const m=infoboxSource.match(new RegExp('(?:^|[\\r\\n]|\\s)\\|'+safe+'\\s*=\\s*([^\\r\\n]*?)(?=\\s+\\|[A-Za-z_][A-Za-z0-9_]*\\s*=|$)','mi'));
      if(m)return clean(m[1]);
    }
    return null;
  };
  infoboxFieldOrder.forEach(key=>{ const value=readInfoboxParam(key,key==='imagedarkmode'?['imagedark']:key==='icondarkmode'?['icondark']:[]); if(value!==null) target.infobox[key]=value; });
  const hasSingleDate=readInfoboxParam('date')!==null; target.infobox.singleDate=hasSingleDate;
  if(hasSingleDate){ target.infobox.sdate=''; target.infobox.edate=''; }
  const imageDarkAlias=readInfoboxParam('imagedarkmode',['imagedark']); if(imageDarkAlias!==null) target.infobox.imagedarkmode=imageDarkAlias;
  const iconDarkAlias=readInfoboxParam('icondarkmode',['icondark']); if(iconDarkAlias!==null) target.infobox.icondarkmode=iconDarkAlias;
  delete target.infobox.imagedark; delete target.infobox.icondark;
  const intro=wiki.match(/<p\s+style="max-width:990px;\s*padding-top:15px">([\s\S]*?)<\/p>/i); if(intro) target.infobox.intro=`<p style="max-width:990px; padding-top:15px">${clean(intro[1])}</p>`;
  const tc=Number(target.infobox.team_number); if(tc>0) target.settings.teamCount=countWanted(tc);
  if(clean(target.infobox.localcurrency)) target.settings.localCurrency=target.infobox.localcurrency;
}
function parseAboutInto(target,wiki){
  const s=target.settings; const lines=wiki.split(/\r?\n/); const stages=[]; let current=null;
  const total=wiki.match(/^\*\s*(\d+)\s+Teams\s*$/mi), invited=wiki.match(/^\*{1,2}\s*(\d+)\s+Invited Teams\s*$/mi), qualified=wiki.match(/^\*{1,2}\s*(\d+)\s+Qualifier Teams\s*$/mi);
  if(total||invited||qualified){s.formatIncludeTotal=total?'true':'false';s.formatIncludeInvited=invited?'true':'false';s.formatIncludeQualifier=qualified?'true':'false';s.formatShowSources='true';s.formatTotalTeams=total?clean(total[1]):'';s.formatInvitedTeams=invited?clean(invited[1]):'';s.formatQualifierTeams=qualified?clean(qualified[1]):'';}else{Object.assign(s,{formatShowSources:'false',formatIncludeTotal:'false',formatIncludeInvited:'false',formatIncludeQualifier:'false',formatTotalTeams:'',formatInvitedTeams:'',formatQualifierTeams:''});}
  lines.forEach(line=>{
    const phase=line.match(/^\*\s*'{3,5}\s*([^']+?):\s*'{3,5}\s*(.*)$/i);
    if(phase){
      const label=clean(phase[1]),low=label.toLowerCase(); let type=low.includes('qualifier')?'qualifier':low.includes('group')?'group':low.includes('point rush')?'point':low.includes('final')?'final':'custom';
      current=normalizeFormatStage({...blankFormatStage(type),label,...parseWikiDateText(clean(phase[2])),teams:'',matches:'',groups:'',teamsPerGroup:'',qualifyTop:'',advanceTo:'',headstart:false,champion:false,championPoints:'',championMaxMatches:'',details:''}); stages.push(current); return;
    }
    if(!current||!/^\*\*/.test(line.trim()))return; const detail=line.replace(/^\s*\*\*\s*/,'').trim(); let x;
    if((x=detail.match(/^(\d+)\s+teams\.?$/i))) current.teams=clean(x[1]);
    else if((x=detail.match(/^(\d+)\s+matches\.?$/i))) current.matches=clean(x[1]);
    else if((x=detail.match(/Round Robin Format:.*?(\d+)\s+teams\s+split into\s+(\d+)\s+groups of\s+(\d+)\s+teams/i))){current.teams=clean(x[1]);current.groups=clean(x[2]);current.teamsPerGroup=clean(x[3]);}
    else if((x=detail.match(/Top\s*(\d+).*?qualify for\s+(.+?)\.?$/i))){current.qualifyTop=clean(x[1]);current.advanceTo=clean(x[2]).replace(/''/g,'').replace(/\.$/,'');}
    else if(/Headstart Points/i.test(detail)) current.headstart=true;
    else if((x=detail.match(/Champion Rush format is applied\.\s*\{\{ChampionRush\|([^}]*)\}\}/i))){current.champion=true;const attrs=x[1];current.championPoints=clean((attrs.match(/(?:^|\|)crp=([^|}]*)/i)||[,'90'])[1]);current.championMaxMatches=clean((attrs.match(/(?:^|\|)maxmatch=([^|}]*)/i)||[,''])[1]);}
    else current.details=clean([current.details,detail].filter(Boolean).join('\n'));
  });
  if(stages.length) target.formatStages=stages;
  const points=wiki.match(/\{\{(Points\d+)(?:\|([^}]*))?\}\}/i); if(points){s.pointsTemplate=points[1];s.pointsShowTb=/showtb\s*=\s*true/i.test(points[2]||'')?'true':'false';}
  s.formatShowSources=[s.formatIncludeTotal,s.formatIncludeInvited,s.formatIncludeQualifier].includes('true')?'true':'false';
  s.formatPreset=inferFormatPreset(target.formatStages||[]);
  const legacyQ=(target.formatStages||[]).find(x=>x.type==='qualifier'),legacyF=(target.formatStages||[]).find(x=>x.type==='final');
  if(legacyQ){s.qualifierDates=wikiDateText(legacyQ);s.qualifierTeams=legacyQ.teams;s.qualifyTop=legacyQ.qualifyTop;} if(legacyF){s.finalDate=wikiDateText(legacyF);s.finalMatches=legacyF.matches;}
}
function parseBroadcastTalents(wiki){
  const talents=[]; const re=/\{\{BroadcasterCard([\s\S]*?)\}\}/gi; let m;
  while((m=re.exec(wiki))){
    const block=m[1]||'', get=key=>clean((block.match(new RegExp('(?:^|\\|)'+key+'=([^|\\n\\r}]*)','i'))||[,''])[1]);
    talents.push(normalizeBroadcastTalent({position:get('position'),b1:get('b1'),flag:get('b1flag'),name:get('b1name')},talents.length));
  }
  return talents;
}
function parsePrizeRows(wiki){
  const currency=wiki.match(/TeamPrizePool[^\n}]*\|localcurrency=([^\s|}]+)/i), imp=wiki.match(/TeamPrizePool[^\n}]*\|import=([^\s|}]+)/i);
  const cut=wiki.match(/TeamPrizePool[^\n}]*\|cutafter=([^\s|}]+)/i), summary=wiki.match(/TeamPrizePool[^\n}]*\|prizesummary=([^\s|}]+)/i);
  const qualifies=wiki.match(/\|qualifies1=([^|\n}]+)(?:\s*\|qualifies1name=([^|\n}]+))?/i);
  const mvp=wiki.match(/award=MVP[^\n]*?\{\{Opponent\|([^|}]*)\|flag=([^|}]*)\|team=\s*([^|}]*)/i);
  const mvpPrize=wiki.match(/award=MVP[^\n]*?\|localprize=([^|}\s]+)/i);
  const rows=[];
  wiki.split(/\r?\n/).forEach(line=>{
    if(!/\{\{Slot\|/i.test(line)||!/\{\{Opponent\|/i.test(line)||/award=MVP/i.test(line))return;
    const name=(line.match(/\{\{Opponent\|([^|}]*)/i)||[])[1]; if(name===undefined)return;
    rows.push({name:clean(name),prize:clean((line.match(/\|localprize=([^|}]*)/i)||[])[1]),date:clean((line.match(/\|date=([^|}\s]*)/i)||[])[1]),qualified:/\|qualified1\s*=\s*y/i.test(line)});
  });
  return {rows,currency:currency?clean(currency[1]):'',importValue:imp?clean(imp[1]):'',cutAfter:cut?clean(cut[1]):'',prizeSummary:summary?clean(summary[1]):'',qualifies,mvp,mvpPrize:mvpPrize?clean(mvpPrize[1]):'',qualifiedCount:rows.filter(r=>r.qualified).length};
}

function parseParticipantTeams(wiki){
  const lines=wiki.split(/\r?\n/),blocks=[]; let cur=null,depth=0;
  lines.forEach(line=>{ const trimmed=line.trim(); if(/^\|\{\{Opponent\|/i.test(trimmed)){ if(cur) blocks.push(cur.join('\n')); cur=[line]; depth=(line.match(/\{\{/g)||[]).length-(line.match(/\}\}/g)||[]).length; } else if(cur){ cur.push(line); depth+=(line.match(/\{\{/g)||[]).length-(line.match(/\}\}/g)||[]).length; if(depth<=0){ blocks.push(cur.join('\n')); cur=null; depth=0; } } }); if(cur) blocks.push(cur.join('\n'));
  return blocks.map(block=>parseTeamWikiBlock(block)).filter(Boolean);
}
function parseGroupStandingsInto(target,wiki){
  const s=target.settings, stage=(wiki.match(/===\s*([^=\n]+?)\s*===/)||[])[1]; if(stage)s.groupStageHeading=clean(stage);
  const hasTable=/\{\{(?:FfaStandings|OverallStandingsTable)/i.test(wiki);
  if(!hasTable){ s.groupStandingsEnabled='false'; const text=wiki.match(/===\s*[^=\n]+?\s*===\s*\n?:([^\n]+)/i); if(text)s.groupStageText=clean(text[1]); return; }
  const ffa=/\{\{FfaStandings/i.test(wiki); s.groupStandingsEnabled='true'; s.groupStandingsType=ffa?'ffa':'overall';
  const title=wiki.match(/\{\{(?:FfaStandings|OverallStandingsTable)\|title=([^|}\n]+)/i); if(title)s.groupStandingsTitle=clean(title[1]);
  const bg=wiki.match(/\|bg=([^\n}]+)/i); if(bg){ const up=bg[1].match(/1-(\d+)=up/i), down=bg[1].match(/(\d+)-(\d+)=down/i); if(up)s.groupQualifyCount=clean(up[1]); if(down)s.groupEliminatedCount=String(Number(down[2])-Number(down[1])+1); }
  const dest=wiki.match(/uptitle=Qualified for\s*'''([^']+)'''/i); if(dest)s.groupAdvanceTo=clean(dest[1]);
  if(ffa){
    const rounds=Number((wiki.match(/\|rounds=(\d+)/i)||[])[1])||3; s.groupFfaRounds=String(rounds); s.groupFfaImport=clean((wiki.match(/FfaStandings[^\n}]*\|import=([^|}\n]+)/i)||[])[1])||'false'; s.groupFfaCumulative='false';
    target.groupRoundConfigs=[]; for(let i=1;i<=rounds;i++){const re=new RegExp('\\|round'+i+'=\\{\\{Round\\|title=([^|}]*)\\s*\\|started=([^|}]*)\\|finished=([^|}]*)\\}\\}','i'),m=wiki.match(re);target.groupRoundConfigs.push({title:clean(m?.[1])||`Day ${i}`,started:normalizeRoundBoolean(clean(m?.[2])),finished:normalizeRoundBoolean(clean(m?.[3]))});}
    const rows=[], importedGroups=[]; let currentGroup='';
    wiki.split(/\r?\n/).forEach(line=>{
      const groupMatch=line.match(/<!--\s*Group\s+(.+?)\s*-->/i); if(groupMatch){currentGroup=clean(groupMatch[1]);if(currentGroup&&!importedGroups.includes(currentGroup))importedGroups.push(currentGroup);return;}
      if(/<!--\s*Sem grupo\s*-->/i.test(line)){currentGroup='';return;}
      const m=line.match(/\|\{\{TeamOpponent\|([^|}\n]+)((?:\|r\d+=[^|}\n]*)+)\s*\}\}/i); if(!m)return;
      const vals=[];for(let i=1;i<=rounds;i++)vals.push(clean((m[2].match(new RegExp('\\|r'+i+'=([^|}]*)','i'))||[])[1]));rows.push({name:clean(m[1]),rounds:vals,group:currentGroup});
    });
    if(importedGroups.length){s.groupFfaGroupsEnabled='true';s.groupFfaGroupMode='manual';s.groupFfaGroupNames=importedGroups.join(', ');const counts=importedGroups.map(name=>rows.filter(r=>r.group===name).length);s.groupFfaTeamsPerGroup=String(Math.max(1,...counts));}
    ensureImportCapacity(target,rows.length); rows.forEach((r,i)=>{const t=target.teams[i];t.groupTeam=r.name;t.groupRounds=r.rounds;t.groupFfaGroup=r.group||'';if(!t.name&&r.name)t.name=r.name;}); target.groupOrder=target.teams.map(t=>t.uid);
  }else{
    s.groupOverallMode=/total-only\s*=\s*true/i.test(wiki)?'total':'complete'; const rows=parseStandingRows(wiki); ensureImportCapacity(target,rows.length); rows.forEach((r,i)=>{const t=target.teams[i];t.groupTeam=r.name;t.groupMp=r.mp;t.groupBooyah=r.booyah;t.groupPp=r.pp;t.groupKp=r.kp;t.groupTotal=r.total;if(!t.name&&r.name)t.name=r.name;}); target.groupOrder=target.teams.map(t=>t.uid);
  }
}
function scoreText(value){
  const n=Number(value);
  if(!Number.isFinite(n)) return '';
  return Number.isInteger(n)?String(n):String(Number(n.toFixed(3)));
}
function normalizeTeamCompare(value){ return clean(value).toLowerCase().replace(/\s+/g,' '); }
function parseMatchBracketStandings(wiki){
  const text=String(wiki||'');
  if(!/\{\{\s*Match\b/i.test(text) || !/\|\s*opponent\d+\s*=\s*\{\{\s*TeamOpponent\b/i.test(text)) return null;

  const placementPoints={};
  const placementRe=/\|\s*p(\d+)\s*=\s*(-?\d+(?:\.\d+)?)/gi;
  let pm;
  while((pm=placementRe.exec(text))) placementPoints[Number(pm[1])]=Number(pm[2]);
  const killPointMatch=text.match(/\|\s*p_kill\s*=\s*(-?\d+(?:\.\d+)?)/i);
  const killPoint=killPointMatch?Number(killPointMatch[1]):1;
  const matchpointMatch=text.match(/\|\s*matchpoint\s*=\s*([^|}\n\r]+)/i);
  const matchpoint=matchpointMatch?Number(clean(matchpointMatch[1])):NaN;
  const bracketId=clean((text.match(/\{\{\s*Bracket\s*\|\s*Bracket\/2\s*\|\s*id\s*=\s*([^|}\n\r]+)/i)||[])[1]);
  const headerMatch=text.match(/\|\s*R\d+M\d+header\s*=\s*([^\n|}]+)/i);
  const twitch=clean((text.match(/\|\s*twitch\s*=\s*([^|}\n\r]*)/i)||[])[1]);
  const youtube=clean((text.match(/\|\s*youtube\s*=\s*([^|}\n\r]*)/i)||[])[1]);
  const dualTabs=/\{\{\s*Tabs dynamic\b/i.test(text) && /Overview\s*Standings/i.test(text) && /Detailed\s*Standings/i.test(text);

  const maps=[];
  text.split(/\r?\n/).forEach(line=>{
    const mm=line.match(/^\s*\|\s*map(\d+)\s*=\s*\{\{\s*Map\s*\|(.*)\}\}\s*$/i);
    if(!mm)return;
    const body=mm[2]||'';
    const get=key=>clean((body.match(new RegExp('(?:^|\\|)\\s*'+key+'\\s*=\\s*([^|]*)','i'))||[])[1]);
    maps.push({match:Number(mm[1]),date:get('date'),map:get('map'),mvp:get('mvp'),vod:get('vod')});
  });
  maps.sort((a,b)=>a.match-b.match);

  const lines=text.split(/\r?\n/), blocks=[];
  let current=null;
  const flush=()=>{ if(current){ blocks.push(current); current=null; } };
  lines.forEach(line=>{
    const start=line.match(/^\s*\|\s*opponent(\d+)\s*=\s*\{\{\s*TeamOpponent\s*\|\s*([^|}\n]*)/i);
    if(start){
      flush();
      current={opponent:Number(start[1]),name:clean(start[2]),lines:[line]};
    }else if(current){
      current.lines.push(line);
    }
  });
  flush();
  if(!blocks.length) return null;

  const detailedRows=blocks.map(block=>{
    const body=block.lines.join('\n');
    const startingMatch=body.match(/\|\s*startingpoints\s*=\s*(-?\d+(?:\.\d+)?)/i);
    const startingpoints=startingMatch?Number(startingMatch[1]):0;
    const placementOverride=clean((body.match(/\|\s*placement\s*=\s*(\d+)/i)||[])[1]);
    let pp=0,kp=0,booyah=0,played=0,killsRaw=0;
    const finalMatches=[];
    const msRe=/\|\s*m(\d+)\s*=\s*\{\{\s*MS\s*\|\s*(-?\d+)\s*\|\s*(-?\d+(?:\.\d+)?)(?:\|[^}]*)?\}\}/gi;
    let ms;
    while((ms=msRe.exec(body))){
      const matchNumber=Number(ms[1]),placement=Number(ms[2]),kills=Number(ms[3]);
      if(!Number.isFinite(placement)||!Number.isFinite(kills)) continue;
      played++;
      if(placement===1) booyah++;
      pp+=Number(placementPoints[placement]||0);
      killsRaw+=kills;
      kp+=kills*killPoint;
      finalMatches.push({match:matchNumber,placement:scoreText(placement),kills:scoreText(kills)});
    }
    finalMatches.sort((a,b)=>a.match-b.match);
    const total=pp+kp+startingpoints;
    return {
      name:block.name,
      opponent:block.opponent,
      mp:scoreText(played),
      booyah:scoreText(booyah),
      pp:scoreText(pp),
      kp:scoreText(kp),
      total:scoreText(total),
      bp:startingMatch?scoreText(startingpoints):'',
      finalPlacement:placementOverride,
      finalTiebreaker:'',
      finalMatches,
      _score:total,
      _kills:killsRaw,
      _startingValue:startingpoints,
      _startingExplicit:!!startingMatch
    };
  }).filter(r=>r.name);
  if(!detailedRows.length) return null;

  const overview=parseFinalFfaStandings(text);
  const overviewRows=dualTabs && overview.rows.length ? overview.rows : [];
  const detailedByName=new Map(detailedRows.map(r=>[normalizeTeamCompare(r.name),r]));
  let rows;
  if(overviewRows.length){
    const used=new Set();
    rows=overviewRows.map(o=>{
      const key=normalizeTeamCompare(o.name),d=detailedByName.get(key);
      if(d)used.add(key);
      return d?{...d,...o,finalPlacement:d.finalPlacement,finalTiebreaker:o.finalTiebreaker||d.finalTiebreaker,finalMatches:d.finalMatches,_score:d._score,_kills:d._kills,_startingValue:d._startingValue,_startingExplicit:d._startingExplicit}:{...o,finalPlacement:'',finalMatches:[],_score:Number(o.total)||0,_kills:Number(o.kp)||0,_startingValue:0,_startingExplicit:clean(o.bp)!==''};
    });
    detailedRows.forEach(d=>{const key=normalizeTeamCompare(d.name);if(!used.has(key))rows.push(d);});
  }else rows=[...detailedRows];

  const bgMatch=text.match(/\|\s*bg\s*=\s*([^\n}]*\btrophy\b[^\n}]*)/i);
  const bgValue=bgMatch?clean(bgMatch[1]):'';
  let trophyRank=-1;
  if(bgValue){
    bgValue.split(',').some(part=>{
      const m=part.trim().match(/^(\d+)(?:-(\d+))?\s*=\s*trophy$/i);
      if(!m)return false;
      trophyRank=Math.max(1,Number(m[1]));
      return true;
    });
  }

  const byPoints=[...detailedRows].sort((a,b)=>
    (b._score-a._score) ||
    (Number(b.booyah||0)-Number(a.booyah||0)) ||
    (b._kills-a._kills) ||
    (Number(b.pp||0)-Number(a.pp||0)) ||
    (a.opponent-b.opponent)
  );

  const explicitWinner=detailedRows.find(r=>clean(r.finalPlacement)==='1')||null;
  const commentWinnerMatch=text.match(/\{\{\s*Team\s*\|\s*([^|}\n]+)[^}]*\}\}\s*won\s+through\s+Champion\s+Rush/i);
  const commentWinner=commentWinnerMatch?normalizeTeamCompare(commentWinnerMatch[1]):'';
  let winner=explicitWinner;
  if(!winner && commentWinner) winner=detailedRows.find(r=>normalizeTeamCompare(r.name)===commentWinner)||null;
  if(!winner && trophyRank>0 && trophyRank<=byPoints.length) winner=byPoints[trophyRank-1];

  if(!overviewRows.length){
    const explicit=detailedRows.filter(r=>Number(r.finalPlacement)>0).sort((a,b)=>Number(a.finalPlacement)-Number(b.finalPlacement));
    if(explicit.length){
      const explicitSet=new Set(explicit);
      const rest=byPoints.filter(r=>!explicitSet.has(r));
      const placed=[];
      explicit.forEach(r=>{placed[Math.max(0,Number(r.finalPlacement)-1)]=r;});
      let ri=0;
      for(let i=0;i<detailedRows.length;i++) if(!placed[i]) placed[i]=rest[ri++];
      rows=placed.filter(Boolean);
    }else rows=byPoints;
  }
  if(winner){ const winnerKey=normalizeTeamCompare(winner.name), mergedWinner=rows.find(r=>normalizeTeamCompare(r.name)===winnerKey)||winner; rows=[mergedWinner,...rows.filter(r=>normalizeTeamCompare(r.name)!==winnerKey)]; }

  let winnerMatch=Number(clean((text.match(/after\s+Booyah\s+at\s+Match\s+(\d+)/i)||[])[1]))||0;
  if(!winnerMatch && winner && Number.isFinite(matchpoint)){
    let cumulative=winner._startingValue||0;
    for(const m of winner.finalMatches||[]){
      if(Number(m.placement)===1 && cumulative>=matchpoint){ winnerMatch=m.match; break; }
      cumulative+=Number(placementPoints[Number(m.placement)]||0)+Number(m.kills||0)*killPoint;
    }
  }
  if(!winnerMatch && winner){
    const wins=(winner.finalMatches||[]).filter(m=>Number(m.placement)===1);
    if(wins.length)winnerMatch=wins[wins.length-1].match;
  }

  const activatedNames=[];
  if(Number.isFinite(matchpoint) && matchpoint>0 && winnerMatch>0){
    detailedRows.forEach(r=>{
      let cumulative=r._startingValue||0;
      (r.finalMatches||[]).filter(m=>m.match<winnerMatch).forEach(m=>{
        cumulative+=Number(placementPoints[Number(m.placement)]||0)+Number(m.kills||0)*killPoint;
      });
      if(cumulative>=matchpoint) activatedNames.push(r.name);
    });
  }

  const finalRows=rows.map(r=>({
    name:r.name,mp:r.mp,booyah:r.booyah,pp:r.pp,kp:r.kp,total:r.total,bp:r.bp,
    finalPlacement:clean(r.finalPlacement),finalTiebreaker:clean(r.finalTiebreaker),finalMatches:Array.isArray(r.finalMatches)?r.finalMatches:[]
  }));
  const winnerIndex=winner?finalRows.findIndex(r=>normalizeTeamCompare(r.name)===normalizeTeamCompare(winner.name)):-1;
  const championRush=!!winner || trophyRank>0 || /Champion\s+Rush/i.test(text) || /\|\s*matchpoint\s*=/i.test(text);
  const hasHeadstart=finalRows.some(r=>clean(r.bp)!=='' && Number(r.bp)!==0);

  const maxPlacement=Math.max(12,...Object.keys(placementPoints).map(Number).filter(Number.isFinite));
  const pointValues=[];
  for(let i=1;i<=maxPlacement;i++) pointValues.push(scoreText(Number(placementPoints[i]||0)));
  return {
    rows:finalRows,
    winnerIndex,
    winnerName:winner?winner.name:'',
    winnerMatch:winnerMatch?String(winnerMatch):'',
    activatedNames,
    trophyRank,
    championRush,
    headstart:hasHeadstart,
    title:clean(headerMatch?.[1]),
    dualTabs,
    bracketId,
    matchpoint:Number.isFinite(matchpoint)?scoreText(matchpoint):'',
    killPoint:scoreText(killPoint),
    placementPoints:pointValues.join(','),
    maps,
    twitch,
    youtube,
    overviewTitle:clean((text.match(/\{\{FfaStandings\|title=([^|}\n]+)/i)||[])[1])
  };
}

function parseStandingRows(wiki){
  const rows=[]; const re=/\|\{\{TeamOpponent\|([^|}\n]*)((?:\|[^{}\n]*)*)\}\}/gi; let m;
  while((m=re.exec(wiki))){ const attrs=m[2]||'', get=key=>clean((attrs.match(new RegExp('\\|'+key+'=([^|}]*)','i'))||[,''])[1]); rows.push({name:clean(m[1]),mp:get('mp'),booyah:get('booyah')||'0',pp:get('pp'),kp:get('kp'),total:get('total'),bp:get('bp')}); }
  return rows;
}
function parseFinalFfaStandings(wiki){
  const roundTitles={};
  for(let i=1;i<=12;i++){
    const m=wiki.match(new RegExp('\\|round'+i+'=\\{\\{Round\\|title=([^|}]*)','i'));
    if(m) roundTitles[i]=clean(m[1]).replace(/<br\s*\/?\s*>/gi,' ').replace(/\[\[File:[^\]]+\]\]/gi,'Booyah').replace(/\s+/g,' ').trim().toLowerCase();
  }
  const findRound=(patterns)=>{
    for(const [index,title] of Object.entries(roundTitles)) if(patterns.some(re=>re.test(title))) return Number(index);
    return 0;
  };
  const mpRound=findRound([/match(?:es)?\s*played/,/^matches?$/]);
  const booyahRound=findRound([/booyah/]);
  const ppRound=findRound([/place(?:ment)?\s*points?/,/^pp$/]);
  const kpRound=findRound([/kill\s*points?/,/^kp$/]);
  const totalRound=findRound([/total\s*points?/]);
  const bpRound=findRound([/headstart/,/bonus\s*points?/]);
  const totalMode=!!totalRound && !ppRound && !kpRound;
  const rows=[];
  wiki.split(/\r?\n/).forEach(line=>{
    if(!/\{\{\s*TeamOpponent\s*\|/i.test(line)||!/\|\s*r\d+\s*=/i.test(line))return;
    const name=clean((line.match(/\{\{\s*TeamOpponent\s*\|\s*([^|}\n]*)/i)||[])[1]);
    if(!name)return;
    const get=key=>clean((line.match(new RegExp('\\|\\s*'+key+'\\s*=\\s*([^|}\\n]*)','i'))||[])[1]);
    const getRound=index=>index?get('r'+index):'';
    const bp=get('startingpoints')||getRound(bpRound);
    const pp=totalMode?'':getRound(ppRound||3),kp=totalMode?'':getRound(kpRound||4),totalRaw=totalMode?getRound(totalRound||3):'';
    const computedTotal=!totalMode && (clean(pp)!==''||clean(kp)!=='') ? scoreText((Number(pp)||0)+(Number(kp)||0)+(Number(bp)||0)) : totalRaw;
    rows.push({
      name,
      mp:getRound(mpRound||1),
      booyah:getRound(booyahRound||2)||'0',
      pp,
      kp,
      total:computedTotal,
      bp,
      finalTiebreaker:get('tiebreaker')
    });
  });
  return {rows,totalMode,headstart:rows.some(r=>clean(r.bp)!==''),title:clean((wiki.match(/\{\{FfaStandings\|title=([^|}\n]+)/i)||[])[1])};
}

function ensureImportCapacity(target, amount){ const wanted=countWanted(Math.max(amount,target.settings.teamCount||12)); target.settings.teamCount=wanted; while(target.teams.length<wanted) target.teams.push(blankTeam()); target.teams=target.teams.slice(0,wanted); }
function resetImportedSection(target,section){
  if(section==='infobox') target.infobox=Object.fromEntries(Object.keys(defaultInfobox()).map(k=>[k,'']));
  if(section==='about'){ Object.assign(target.settings,{qualifierDates:'',qualifierTeams:'',qualifyTop:'',finalDate:'',finalMatches:'',formatPreset:'custom',formatShowSources:'false',formatIncludeTotal:'false',formatIncludeInvited:'false',formatIncludeQualifier:'false',formatTotalTeams:'',formatInvitedTeams:'',formatQualifierTeams:'',pointsTemplate:'',pointsShowTb:'false',groupStageText:'',standingsTitle:'Finals Standings'}); target.formatStages=[]; }
  if(section==='broadcast') target.broadcastTalents=[];
  if(section==='prize'){ Object.assign(target.settings,{localCurrency:'brl',prizeImport:'false',prizePoolMode:'complete',includeMvp:'false',mvpPrize:'',mvpPlayer:'',mvpFlag:'br',mvpTeam:'',prizeQualEnabled:'false',prizeQualCount:'0',prizeQualPage:'',prizeQualName:'',prizeCutAfter:'',prizeSummary:'false',prizeEliminatedDate:''}); target.teams.forEach(t=>{t.prize='0';t.prizeTeam='';t.prizeDate='';}); target.prizeOrder=target.teams.map(t=>t.uid); }
  if(section==='participants') target.teams=target.teams.map(t=>({...t,name:'',qual:'invite',qualMethod:'',qualPage:'',qualText:'',qualPlacement:'',players:[blankPlayer(),blankPlayer(),blankPlayer(),blankPlayer()],coach:{name:'',flag:'br',role:'head coach'},analyst:{name:'',flag:'br',role:'analyst'},allowIncomplete:false}));
  if(section==='groupStage'){ Object.assign(target.settings,{groupStageIncluded:'true',groupStandingsEnabled:'false',groupStageHeading:'Group Stage',groupStandingsType:'overall',groupStandingsTitle:'Group Stage Standings',groupQualifyCount:String(Math.min(12,target.settings.teamCount)),groupEliminatedCount:String(Math.max(0,target.settings.teamCount-12)),groupAdvanceTo:'Finals',groupOverallMode:'complete',groupAutoPlacement:'false',groupFfaRounds:'3',groupFfaImport:'false',groupFfaCumulative:'false',groupFfaGroupsEnabled:'false',groupFfaGroupMode:'manual',groupFfaGroupNames:'A, B, C, D',groupFfaTeamsPerGroup:'6'}); target.groupRoundConfigs=defaultGroupRoundConfigs(); target.groupFocusedGroups=[]; target.teams.forEach(t=>Object.assign(t,{groupTeam:'',groupBooyah:'0',groupMp:'',groupKp:'',groupPp:'',groupTotal:'',groupRounds:['','',''],groupFfaGroup:''})); target.groupOrder=target.teams.map(t=>t.uid); }
  if(section==='overall'){ Object.assign(target.settings,{finalStandingsEnabled:'true',finalStageText:'To be Determined',winnerIndex:'',winnerUid:'',autoPlacement:'false',headstartEnabled:'false',finalTeamCount:'',finalCodeMode:'simple',finalBracketId:'',finalMatchpoint:'',finalKillPoint:'1',finalPlacementPoints:'12,9,8,7,6,5,4,3,2,1,0,0',finalWinnerMatch:'',finalTwitch:'',finalYoutube:'',finalDetailedHeader:'Champion Rush',finalOverviewTitle:'Champion Rush Standings Overview'}); target.finalDetailedMaps=[]; target.teams.forEach(t=>Object.assign(t,{standingTeam:'',booyah:'0',mp:'',kp:'',pp:'',total:'',bp:'',championActivated:false,finalPlacement:'',finalTiebreaker:'',finalMatches:[]})); target.finalOrder=target.teams.map(t=>t.uid); }
}
function applyWikiImport(wiki,sections,replace=false){
  const target=normalizeState(safeClone(state)); if(replace) sections.forEach(s=>resetImportedSection(target,s));
  if(sections.includes('infobox')) parseInfoboxInto(target,wiki);
  if(sections.includes('about')) parseAboutInto(target,wiki);
  if(sections.includes('prize')){ const data=parsePrizeRows(wiki); target.settings.prizePoolMode=data.rows.length&&data.rows.every(r=>!clean(r.name))?'values_only':'complete'; if(data.currency) target.settings.localCurrency=data.currency; if(data.importValue) target.settings.prizeImport=data.importValue; if(data.cutAfter)target.settings.prizeCutAfter=data.cutAfter;if(data.prizeSummary!=='')target.settings.prizeSummary=data.prizeSummary;if(data.qualifies){target.settings.prizeQualEnabled='true';target.settings.prizeQualPage=clean(data.qualifies[1]);target.settings.prizeQualName=clean(data.qualifies[2]);target.settings.prizeQualCount=String(data.qualifiedCount);} if(data.mvp){target.settings.includeMvp='true';target.settings.mvpPlayer=clean(data.mvp[1])||'tbd';target.settings.mvpFlag=clean(data.mvp[2])||'br';target.settings.mvpTeam=clean(data.mvp[3]);target.settings.mvpPrize=clean(data.mvpPrize);} else if(/TeamPrizePool/i.test(wiki)) target.settings.includeMvp='false'; ensureImportCapacity(target,data.rows.length); data.rows.forEach((p,i)=>{ if(target.teams[i]){target.teams[i].prizeTeam=p.name;if(!target.teams[i].name&&p.name)target.teams[i].name=p.name;target.teams[i].prize=p.prize;target.teams[i].prizeDate=p.date;} }); target.prizeOrder=target.teams.map(t=>t.uid); }
  if(sections.includes('participants')){ const teams=parseParticipantTeams(wiki); ensureImportCapacity(target,teams.length); teams.forEach((r,i)=>{target.teams[i]=rosterToTeam(r,target.teams[i]);}); if(teams.some(t=>(t.players||[]).some(p=>clean(p.role)))) target.settings.includePlayerRoles='true'; else if(replace) target.settings.includePlayerRoles='false'; }
  if(sections.includes('groupStage')){ const resultSlice=sectionBetween(wiki,'==Results==','===Grand Finals==='); if(resultSlice && !/===\s*[^=\n]+\s*===/i.test(resultSlice)){ target.settings.groupStageIncluded='false'; target.settings.groupStandingsEnabled='false'; } else { target.settings.groupStageIncluded='true'; const groupSource=resultSlice||wiki; parseGroupStandingsInto(target,groupSource); } }
  if(sections.includes('broadcast')){ const talents=parseBroadcastTalents(wiki); if(talents.length || /==Broadcast==/i.test(wiki)) target.broadcastTalents=talents; }
  if(sections.includes('overall')){
    const s=target.settings;
    const overallSource=sectionBetween(wiki,'===Grand Finals===','==Broadcast==')||wiki;
    const isFinalFfa=/\{\{FfaStandings\|/i.test(overallSource);
    const isFinalOverall=/\{\{OverallStandingsTable\|/i.test(overallSource);
    const parsedMatchBracket=parseMatchBracketStandings(overallSource);
    const isFinalMatchBracket=!!parsedMatchBracket;
    const finalHasTable=isFinalFfa||isFinalOverall||isFinalMatchBracket;
    const finalPlaceholder=overallSource.match(/^\s*===\s*Grand Finals\s*===\s*\n?\s*:\s*([^\n]+)/im)||overallSource.match(/^\s*:\s*([^\n]+)/m);
    s.finalStandingsEnabled=finalHasTable?'true':'false';
    if(!finalHasTable){ if(finalPlaceholder)s.finalStageText=clean(finalPlaceholder[1])||'To be Determined'; return; }
    const title=overallSource.match(/\{\{(?:FfaStandings|OverallStandingsTable)\|title=([^|}\n]+)/i);
    if(title)s.standingsTitle=clean(title[1]);
    let rows=[];
    if(isFinalMatchBracket){
      rows=parsedMatchBracket.rows;
      s.standingMode='complete';
      s.headstartEnabled=parsedMatchBracket.headstart?'true':'false';
      s.finalCodeMode=parsedMatchBracket.dualTabs?'dual':'simple';
      s.finalBracketId=parsedMatchBracket.bracketId||s.finalBracketId;
      s.finalMatchpoint=parsedMatchBracket.matchpoint||s.finalMatchpoint;
      s.finalKillPoint=parsedMatchBracket.killPoint||s.finalKillPoint;
      s.finalPlacementPoints=parsedMatchBracket.placementPoints||s.finalPlacementPoints;
      s.finalWinnerMatch=parsedMatchBracket.winnerMatch||'';
      s.finalTwitch=parsedMatchBracket.twitch||'';
      s.finalYoutube=parsedMatchBracket.youtube||'';
      s.finalDetailedHeader=parsedMatchBracket.title||'Champion Rush';
      s.finalOverviewTitle=parsedMatchBracket.overviewTitle||'Champion Rush Standings Overview';
      target.finalDetailedMaps=parsedMatchBracket.maps||[];
      const finalFormatStage=(target.formatStages||[]).find(stage=>stage.type==='final');
      if(finalFormatStage){
        if(parsedMatchBracket.matchpoint){ finalFormatStage.champion=true; finalFormatStage.championPoints=parsedMatchBracket.matchpoint; }
        const detailedCount=Math.max(0,...(parsedMatchBracket.maps||[]).map(m=>Number(m.match)||0),...parsedMatchBracket.rows.map(r=>Number(r.mp)||0));
        if(detailedCount) finalFormatStage.matches=String(detailedCount);
      }
      if(parsedMatchBracket.title && /champion\s*rush/i.test(parsedMatchBracket.title)) s.standingsTitle='Finals Standings';
    }else if(isFinalFfa){
      const parsed=parseFinalFfaStandings(overallSource);
      rows=parsed.rows;
      s.standingMode=parsed.totalMode?'total':'complete';
      s.headstartEnabled=parsed.headstart?'true':'false';
    }else{
      s.standingMode=/total-only\s*=\s*true/i.test(overallSource)?'total':'complete';
      s.headstartEnabled=/\{\{TeamOpponent\|[^\n}]*\|bp=/i.test(overallSource)?'true':'false';
      rows=parseStandingRows(overallSource);
    }
    const bg=overallSource.match(/(?:^|\n)\s*\|bg=([^\n}]+)/i)||overallSource.match(/\{\{FfaStandings\|[^\n}]*\|bg=([^|}\n]+)/i);
    s.standingFormat=isFinalMatchBracket
      ? (parsedMatchBracket.championRush?'champion':'traditional')
      : ((bg&&/(?:^|,)\s*\d+(?:-\d+)?\s*=\s*(?:up|stay)/i.test(bg[1]))||/Won through Match Point|Met Match Point Threshold/i.test(overallSource)||/Champion Rush/i.test(s.standingsTitle||'')?'champion':'traditional');
    s.finalTeamCount=String(rows.length||target.settings.teamCount);
    ensureImportCapacity(target,Math.max(rows.length,target.settings.teamCount));
    target.teams.forEach(t=>{t.championActivated=false;});
    rows.forEach((r,i)=>{if(target.teams[i]){target.teams[i].standingTeam=r.name;if(!target.teams[i].name&&r.name)target.teams[i].name=r.name;Object.assign(target.teams[i],r);}});
    s.winnerIndex=''; s.winnerUid='';
    if(isFinalMatchBracket){
      if(parsedMatchBracket.winnerIndex>=0 && target.teams[parsedMatchBracket.winnerIndex]){
        s.winnerIndex=String(parsedMatchBracket.winnerIndex);
        s.winnerUid=target.teams[parsedMatchBracket.winnerIndex].uid;
      }
      const activatedSet=new Set((parsedMatchBracket.activatedNames||[]).map(normalizeTeamCompare));
      target.teams.forEach(t=>{ if(activatedSet.has(normalizeTeamCompare(effectiveStandingTeam(t)))) t.championActivated=true; });
    }else if(bg){
      const parsedBg=parseChampionBackground(bg[1],rows.length);
      if(parsedBg.winnerIndex>=0 && target.teams[parsedBg.winnerIndex]){
        s.winnerIndex=String(parsedBg.winnerIndex);
        s.winnerUid=target.teams[parsedBg.winnerIndex].uid;
      }
      parsedBg.activatedIndexes.forEach(index=>{if(target.teams[index])target.teams[index].championActivated=true;});
    }
    target.finalOrder=target.teams.map(t=>t.uid);
  }
  state=normalizeState(target); renderAll(); generateWiki(false); autoSave(false); return state.settings.teamCount;
}
function importWiki(){
  const wiki=$('importText').value;
  if(!clean(wiki)){flash('importStatus','Cole um texto wiki primeiro.');return;}
  const matchBracket=parseMatchBracketStandings(wiki);
  const count=applyWikiImport(wiki,['infobox','about','prize','participants','groupStage','overall','broadcast'],true);
  if(matchBracket?.winnerIndex>=0) syncPrizeFromStandings();
  flash('importStatus',matchBracket?.winnerIndex>=0
    ? `Código importado. Champion Rush reconhecido: ${matchBracket.winnerName} foi colocado em 1º e o Prize Pool acompanhou a ordem da Final.`
    : `Código identificado e importado. Estrutura ajustada para ${count} times.`);
}
function importWikiSection(section){
  const id=sectionImportIds[section],wiki=$(id)?.value||'';
  if(!clean(wiki)){flash('copyStatus','Cole o código da seção primeiro.');return;}
  const matchBracket=section==='overall'?parseMatchBracketStandings(wiki):null;
  applyWikiImport(wiki,[section],false);
  if(matchBracket?.winnerIndex>=0){
    syncPrizeFromStandings();
    flash('copyStatus',`Final lida. Champion Rush reconhecido: ${matchBracket.winnerName} foi colocado em 1º; os demais seguiram a pontuação e o Prize Pool foi atualizado na mesma ordem.`);
  }else{
    flash('copyStatus',`Seção ${section} lida e preenchida sem apagar as outras.`);
  }
}
function clearSectionImport(section){ const el=$(sectionImportIds[section]); if(el) el.value=''; }


function clearSection(section){
  const sectionLabel=section==='overall'?'Final':section==='groupStage'?'Group Stage':section;
  if(!confirm(`Zerar somente a seção "${sectionLabel}"?`)) return;
  if(section==='aliases'){ state.aliases={enabled:true,players:{},teams:{}}; renderAliasPanel(); autoSave(false); flash('aliasStatus','Aliases zerados.'); return; }
  const next=normalizeState(safeClone(state)); resetImportedSection(next,section); state=normalizeState(next); renderAll(); generateWiki(false); autoSave(false); flash('copyStatus',`Seção ${sectionLabel} zerada.`);
}
function toggleAliases(checked){ state.aliases.enabled=!!checked; autoSave(false); flash('aliasStatus',checked?'Sugestões de aliases ativadas.':'Sugestões de aliases desativadas.'); }
function renderAliasPanel(){
  const p=$('playerAliasCount'),t=$('teamAliasCount'); if(p)p.textContent=Object.keys(state.aliases?.players||{}).length; if(t)t.textContent=Object.keys(state.aliases?.teams||{}).length;
  const chk=$('aliasesEnabled'); if(chk)chk.checked=state.aliases?.enabled!==false;
}
function saveCurrentInformation(silent=false){
  state.teams.forEach(t=>{ [t.name,t.standingTeam,t.prizeTeam].forEach(v=>registerAlias('teams',v)); (t.players||[]).forEach(p=>{registerAlias('players',p.name);registerAlias('teams',p.team);}); registerAlias('players',t.coach?.name);registerAlias('players',t.analyst?.name); });
  (state.teamDB||[]).forEach(t=>{registerAlias('teams',t.name);(t.players||[]).forEach(p=>{registerAlias('players',p.name);registerAlias('teams',p.team);});registerAlias('players',t.coach?.name);registerAlias('players',t.analyst?.name);});
  renderAliasPanel(); autoSave(false); if(!silent)flash('aliasStatus','Informações atuais registradas. Novas variações serão sugeridas automaticamente.');
}

const layoutUiStorageKey='liquipediaTournamentSidebarOpenV1';
function toggleSidebar(forceOpen){
  const layout=document.getElementById('appLayout'),btn=document.getElementById('sidebarToggleBtn');
  if(!layout)return;
  const open=typeof forceOpen==='boolean'?forceOpen:layout.classList.contains('sidebar-hidden');
  layout.classList.toggle('sidebar-hidden',!open);
  if(btn){btn.classList.toggle('active',open);btn.setAttribute('aria-expanded',open?'true':'false');btn.innerHTML=open?'✕ Menu':'☰ Menu';btn.title=open?'Esconder o menu lateral':'Abrir o menu lateral';}
  try{localStorage.setItem(layoutUiStorageKey,open?'true':'false');}catch(e){}
}
function loadSidebarState(){
  let open=false;
  try{open=localStorage.getItem(layoutUiStorageKey)==='true';}catch(e){}
  toggleSidebar(open);
}
function jumpToTop(){window.scrollTo({top:0,behavior:'smooth'});}
function jumpToSection(id,openSidebar=false){
  if(openSidebar)toggleSidebar(true);
  const target=document.getElementById(id);if(!target)return;
  if(target.classList.contains('collapsed')){target.classList.remove('collapsed');updateCollapseButtons();saveCollapsedSections();}
  window.setTimeout(()=>target.scrollIntoView({behavior:'smooth',block:'start'}),openSidebar?80:0);
}
function closeSectionMenus(except){
  document.querySelectorAll('.section-menu[open]').forEach(menu=>{if(menu!==except)menu.open=false;});
}
function initializeSectionMenus(){
  document.querySelectorAll('.section-menu').forEach(menu=>menu.addEventListener('toggle',()=>{if(menu.open)closeSectionMenus(menu);}));
  document.addEventListener('click',event=>{if(!event.target.closest('.section-menu'))closeSectionMenus();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeSectionMenus();});
}
function initializeSectionShortcuts(){
  const buttons=[...document.querySelectorAll('[data-jump-target]')];
  if(!buttons.length||!('IntersectionObserver' in window))return;
  const map=new Map(buttons.map(btn=>[btn.dataset.jumpTarget,btn]));
  const observer=new IntersectionObserver(entries=>{
    const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
    if(!visible)return;
    buttons.forEach(btn=>btn.classList.toggle('active',btn===map.get(visible.target.id)));
  },{rootMargin:'-125px 0px -68% 0px',threshold:[0,.08,.2,.45]});
  map.forEach((btn,id)=>{const section=document.getElementById(id);if(section)observer.observe(section);});
}
function initializeLayoutUi(){loadSidebarState();initializeSectionMenus();initializeSectionShortcuts();}

function toggleSection(id){
  const card = $(id);
  if(!card) return;
  card.classList.toggle('collapsed');
  updateCollapseButtons();
  saveCollapsedSections();
}
function updateCollapseButtons(){
  document.querySelectorAll('.card[id]').forEach(card=>{
    const collapsed=card.classList.contains('collapsed');
    card.querySelectorAll('.collapse-btn').forEach(btn=>{btn.textContent=collapsed?'▼':'▲';btn.title=collapsed?'Expandir seção':'Recolher seção';});
    card.querySelectorAll('.collapse-btn-bottom').forEach(btn=>{btn.textContent=collapsed?'▼ Expandir Participantes':'▲ Recolher Participantes';});
  });
}
function saveCollapsedSections(){
  const ids = [...document.querySelectorAll('.card[id].collapsed')].map(el=>el.id);
  localStorage.setItem('liquipediaTournamentCollapsedSections', JSON.stringify(ids));
}
function loadCollapsedSections(){
  try{
    const ids = JSON.parse(localStorage.getItem('liquipediaTournamentCollapsedSections') || '[]');
    ids.forEach(id => { const el = $(id); if(el) el.classList.add('collapsed'); });
  }catch(e){}
  updateCollapseButtons();
}


