/* Tournament presets, searchable rosters and local persistence. */
const EDITOR_LOCAL_KEY='liquipediaTournamentEditor';
let editorSaveTimer=0,editorDependentTimer=0,editorDraft=null,editorDraftIndex=-1;
function localStatus(text){for(const id of ['editorLocalStatus','editorSaveBadge']){const el=$(id);if(el)el.textContent=text;}}
function flushEditorLocal(){
  clearTimeout(editorSaveTimer);editorSaveTimer=0;
  try{recordHistoryChange();localStorage.setItem(EDITOR_LOCAL_KEY,JSON.stringify(state));localStatus('Navegador: salvo às '+new Date().toLocaleTimeString('pt-BR'));return true;}
  catch(error){localStatus('Navegador: não foi possível salvar. Exporte um JSON.');return false;}
}
autoSave=function(render=true){
  localStatus('Navegador: salvando…');clearTimeout(editorSaveTimer);
  editorSaveTimer=setTimeout(flushEditorLocal,250);
  if(render)fillSettingsInputs();
  if(teamRegistryOpen){clearTimeout(editorRegistryTimer);editorRegistryTimer=setTimeout(renderTeamRegistryManager,220);}
};
let editorRegistryTimer=0;
function scheduleDependentTeamRender(){clearTimeout(editorDependentTimer);editorDependentTimer=setTimeout(()=>{renderPrize();renderGroupStandings();renderStandings();},220);}
function flushDependentTeamRender(){if(editorDependentTimer){clearTimeout(editorDependentTimer);editorDependentTimer=0;renderPrize();renderGroupStandings();renderStandings();}}
saveNow=function(){saveCurrentInformation(true);flushEditorLocal();flash('copyStatus','Projeto, times, modelos e aliases salvos no navegador.');};
function saveEditorRecovery(label){
  try{const history=JSON.parse(localStorage.getItem('cff-liquipedia-recovery-v1')||'[]');history.unshift({label,updatedAt:Date.now(),data:safeClone(state)});localStorage.setItem('cff-liquipedia-recovery-v1',JSON.stringify(history.slice(0,5)));}catch(error){localStatus('Não foi possível guardar a cópia de recuperação. Exporte o JSON antes de substituir.');}
}
function editorImportant(reason){flushEditorLocal();window.editorCloud?.checkpoint(reason);}
const originalNormalizeState=normalizeState;
normalizeState=function(obj){
  const next=originalNormalizeState(obj);
  const legacyAnalyst=obj?.settings?.includeAnalyst!=='false';
  next.teams.forEach((team,index)=>{const saved=obj?.teams?.[index];team.includeCoach=staffIncluded(saved,'coach');team.includeAnalyst=hasOwn(saved,'includeAnalyst')?staffIncluded(saved,'analyst'):legacyAnalyst;});
  delete next.settings.includeAnalyst;
  const prize=clean(next.settings.mvpPrize);next.settings.mvpPrize=prize!==''&&Number.isFinite(Number(prize))&&Number(prize)>=0?String(Number(prize)):'';
  next.tournamentPresets=Array.isArray(obj?.tournamentPresets)?obj.tournamentPresets.filter(p=>p&&clean(p.name)&&p.infobox).map(p=>({...p,name:clean(p.name)})):[];
  next.projectId=clean(obj?.projectId)||newTeamUid();
  return next;
};
function applyParticipantStaffState(){
  const focus=focusState.participants;
  document.querySelectorAll('input[data-staff-team][data-staff-role]').forEach(input=>{
    const included=staffIncluded(state.teams[Number(input.dataset.staffTeam)],input.dataset.staffRole);
    input.disabled=!included||(focus.size>0&&!focus.has(input.dataset.focusKey));
    input.classList.toggle('staff-excluded',!included);
  });
}
function setTeamStaffIncluded(index,role,checked){
  const team=state.teams[index];if(!team||!['coach','analyst'].includes(role))return;
  team[role==='coach'?'includeCoach':'includeAnalyst']=!!checked;
  applyParticipantStaffState();refreshTeamCompletion(index);autoSave(false);
}
const originalStaffFocusMode=applyFocusMode;
applyFocusMode=function(section){originalStaffFocusMode(section);if(section==='participants')applyParticipantStaffState();};
const MARINHO_PRESET={id:'liga-marinho-s4',name:'Liga Marinho',infobox:{...defaultInfobox(),displayTitle:'Liga Marinho Season 4',liquipediatier:'5',name:'Liga Marinho Season 4',shortname:'Liga Marinho S4',tickername:'Liga Marinho S4',series:'Liga Marinho',seriesCommented:true,image:'liga marinho_lightmode.png',imagedarkmode:'Liga_marinho_darkmode.png',icon:'Liga_marinho_icon_lightmode.png',icondarkmode:'Liga_marinho_icon_darkmode.png',organizer:'Lidoma',type:'Online',country:'Brazil',sdate:'2026-04-14',edate:'2026-04-24',prizepool:'4000',localcurrency:'brl',youtube:'@OLUANMARINHO',instagram:'oluanmarinho',team_number:'24',previous:'Liga Marinho/Season_3 {{!}} Season 3',next:'Liga Marinho/Season_5 {{!}} Season 5',intro:"<p style=\"max-width:990px; padding-top:15px\">'''Liga Marinho Season 4''' it's an event organized by [[Luan Marinho]]. </p>"},formatStages:[],settings:{localCurrency:'brl'}};
const presetSettingKeys=['localCurrency','qualifierDates','qualifierTeams','qualifyTop','finalDate','finalMatches','formatPreset','formatShowSources','formatIncludeTotal','formatIncludeInvited','formatIncludeQualifier','formatTotalTeams','formatInvitedTeams','formatQualifierTeams','pointsTemplate','pointsShowTb','groupStageIncluded','groupStageText','groupStageHeading','standingFormat','standingMode'];
function renderTournamentPresets(){
  const select=$('editorPresetSelect');if(!select)return;const current=select.value;
  select.innerHTML='<option value="">Selecione um modelo…</option>'+(state.tournamentPresets||[]).map((p,i)=>`<option value="${i}">${esc(p.name)}</option>`).join('');
  if(current!==''&&state.tournamentPresets[Number(current)])select.value=current;
  const series=$('editorSeriesCommented');if(series)series.checked=!!state.infobox.seriesCommented;
}
function saveTournamentPreset(){
  const name=clean($('editorPresetName').value);if(!name){flash('editorPresetStatus','Dê um nome ao modelo.');return;}
  const idx=state.tournamentPresets.findIndex(p=>aliasKey(p.name)===aliasKey(name));
  if(idx>=0&&!confirm(`Atualizar o modelo "${name}" com as configurações atuais?`))return;
  const preset={id:idx>=0?state.tournamentPresets[idx].id:newTeamUid(),name,infobox:safeClone(state.infobox),formatStages:safeClone(state.formatStages),settings:Object.fromEntries(presetSettingKeys.map(key=>[key,state.settings[key]]))};
  if(idx>=0)state.tournamentPresets[idx]=preset;else state.tournamentPresets.push(preset);
  renderTournamentPresets();$('editorPresetSelect').value=String(idx>=0?idx:state.tournamentPresets.length-1);editorImportant('modelo-salvo');flash('editorPresetStatus',`Modelo "${name}" salvo.`);
}
function applyTournamentPreset(){
  const value=$('editorPresetSelect').value;if(value==='')return;
  const p=state.tournamentPresets[Number(value)];if(!p)return;
  saveEditorRecovery('Antes de aplicar modelo');
  state.infobox={...defaultInfobox(),...safeClone(p.infobox)};
  Object.assign(state.settings,Object.fromEntries(Object.entries(p.settings||{}).filter(([key])=>presetSettingKeys.includes(key))));
  state.formatStages=safeClone(p.formatStages||[]);
  // Applying metadata must never truncate a populated roster or results.
  const count=Number(state.infobox.team_number);if([12,18,24].includes(count)&&count>state.settings.teamCount)ensureTeamCount(count);
  renderAll();renderTournamentPresets();$('editorPresetName').value=p.name;editorImportant('modelo-aplicado');flash('editorPresetStatus',`Modelo "${p.name}" aplicado. Times e resultados preservados.`);
}
function deleteTournamentPreset(){
  const value=$('editorPresetSelect').value;if(value==='')return;const p=state.tournamentPresets[Number(value)];
  if(!p||!confirm(`Excluir o modelo "${p.name}"?`))return;
  state.tournamentPresets.splice(Number(value),1);renderTournamentPresets();editorImportant('modelo-excluido');
}
const originalInfoboxLines=infoboxWikiLines;
infoboxWikiLines=function(){return originalInfoboxLines().map(line=>state.infobox.seriesCommented&&line.startsWith('|series=')?`<!--\n${line}-->`:line);};
function mergeInitialMemory(){
  if(state.cffSeedImportedV1)return;
  const seed=window.CFF_LIQUIPEDIA_SEED||{};
  const known=new Set(state.teamDB.map(t=>aliasKey(t.name)));
  (seed.teamDB||[]).forEach(t=>{if(!known.has(aliasKey(t.name))){state.teamDB.push(normalizeRosterTeam(t));known.add(aliasKey(t.name));}});
  for(const type of ['players','teams']){
    const registry=aliasRegistry(type);
    Object.entries(seed.aliases?.[type]||{}).forEach(([key,value])=>{if(!hasOwn(registry,key))registry[key]=safeClone(value);});
  }
  state.teamDB.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));state.cffSeedImportedV1=true;
}
const originalRenderTeamDB=renderTeamDB;
renderTeamDB=function(){originalRenderTeamDB();renderSavedTeams();renderTeamNameList();};
function renderTeamNameList(){const el=$('editorSavedTeamNames');if(el)el.innerHTML=state.teamDB.map(t=>`<option value="${esc(t.code||t.name)}">${esc(t.name)}</option>`).join('');}
function renderSavedTeams(){
  const root=$('editorSavedTeams');if(!root)return;const query=aliasKey($('editorDbSearch')?.value||'');
  const teams=state.teamDB.map((team,index)=>({team,index})).filter(({team})=>!query||teamDbLookupValues(team).some(v=>aliasKey(v).includes(query)));
  root.innerHTML=teams.length?teams.map(({team:t,index})=>`<button class="saved-team-item${index===editorDraftIndex?' active':''}" onclick="openSavedTeam(${index})"><strong>${esc(t.name)}</strong><small>${esc(t.code||'Sem código')} · ${t.players.length} jogadores</small></button>`).join(''):'<div class="hint">Nenhum time encontrado.</div>';
}
const originalLoadTeamDbToEditor=loadTeamDbToEditor;
loadTeamDbToEditor=function(value){if(value==='')return;originalLoadTeamDbToEditor(value);if(state.teamDB[Number(value)])openSavedTeam(Number(value),false);};
function openSavedTeam(index,syncWiki=true){
  if(!state.teamDB[index])return;
  if(editorDraft&&JSON.stringify(editorDraft)!==JSON.stringify(state.teamDB[editorDraftIndex])&&!confirm('Descartar as alterações ainda não salvas desta ficha?'))return;
  editorDraft=safeClone(state.teamDB[index]);editorDraftIndex=index;selectedDbIndex=index;
  if(syncWiki)originalLoadTeamDbToEditor(index);
  $('teamDbSelect').value=String(index);renderSavedTeams();renderRosterEditor();
}
function rosterField(label,key,value){return `<div><label>${esc(label)}</label><input value="${esc(value)}" oninput="updateRosterDraft('${key}',this.value)"></div>`;}
function rosterStaffField(role,team){
  const key=role==='coach'?'includeCoach':'includeAnalyst',title=role==='coach'?'Head Coach':'Analista';
  return `<div><label class="staff-include-label" for="editorRoster${key}">${title} <input id="editorRoster${key}" type="checkbox" ${staffIncluded(team,role)?'checked':''} onchange="updateRosterDraft('${key}',this.checked)"></label><input id="editorRoster${role}Name" value="${esc(team[role].name)}" oninput="updateRosterDraft('${role}.name',this.value)"></div>`;
}
function renderRosterEditor(){
  const root=$('editorRosterEditor');if(!root)return;root.classList.toggle('hidden',!editorDraft);if(!editorDraft){root.innerHTML='';return;}
  const t=editorDraft;
  root.innerHTML=`<div class="roster-editor-head"><strong>Ficha de ${esc(t.name)}</strong><span class="hint">Edite e clique em Salvar ficha</span></div><div class="row3">${rosterField('Nome do time','name',t.name)}${rosterField('Código','code',t.code)}${rosterField('Aliases (separados por vírgula)','aliases',t.aliases)}</div>
  <div class="roster-player-head">Jogadores <button class="tiny" onclick="addRosterDraftPlayer()">+ Jogador</button></div>
  <div class="roster-scroll"><div class="roster-columns"><span>Nome</span><span>Flag</span><span>Link do perfil</span><span>Time opcional</span><span>Role</span><span></span></div>
  ${t.players.map((p,i)=>`<div class="roster-player-row">${['name','flag','link','team','role'].map(key=>`<input aria-label="${key} do jogador ${i+1}" value="${esc(p[key])}" oninput="updateRosterDraft('players.${i}.${key}',this.value)">`).join('')}<button class="tiny red" aria-label="Remover jogador ${i+1}" onclick="removeRosterDraftPlayer(${i})">×</button></div>`).join('')}</div>
  <div class="row">${['coach','analyst'].map(role=>`<div class="row">${rosterStaffField(role,t)}${rosterField('Flag',role+'.flag',t[role].flag)}</div>`).join('')}</div>
  <details><summary>Qualificação e cargos</summary><div class="row3">${rosterField('Qualificação (invite / qualifier)','qual',t.qual)}${rosterField('Method','qualMethod',t.qualMethod)}${rosterField('Page','qualPage',t.qualPage)}${rosterField('Text','qualText',t.qualText)}${rosterField('Placement','qualPlacement',t.qualPlacement)}${rosterField('Role do coach','coach.role',t.coach.role)}${rosterField('Role do analista','analyst.role',t.analyst.role)}</div></details>
  <div class="actions"><button class="green" onclick="saveRosterDraft()">Salvar ficha</button><button onclick="discardRosterDraft()">Descartar edição</button></div><details><summary>Ver código registrado</summary><textarea id="editorRosterWiki" readonly></textarea></details><div class="status" id="editorRosterStatus"></div>`;
  updateRosterPreview();
}
function updateRosterDraft(path,value){const keys=path.split('.');let obj=editorDraft;for(let i=0;i<keys.length-1;i++)obj=obj[keys[i]];obj[keys.at(-1)]=value;updateRosterPreview();}
function updateRosterPreview(){if($('editorRosterWiki')&&editorDraft)$('editorRosterWiki').value=teamToDbWiki(editorDraft);}
function addRosterDraftPlayer(){editorDraft.players.push(blankPlayer());renderRosterEditor();}
function removeRosterDraftPlayer(index){editorDraft.players.splice(index,1);renderRosterEditor();}
function discardRosterDraft(){editorDraft=null;editorDraftIndex=-1;renderRosterEditor();renderSavedTeams();}
function saveRosterDraft(){
  if(!clean(editorDraft?.name)){flash('editorRosterStatus','Preencha o nome do time.');return;}
  if(!state.teamDB[editorDraftIndex])return;
  if(state.teamDB.some((t,i)=>i!==editorDraftIndex&&aliasKey(t.name)===aliasKey(editorDraft.name))){flash('editorRosterStatus','Já existe outro time com esse nome.');return;}
  const saved=normalizeRosterTeam(editorDraft);state.teamDB[editorDraftIndex]=saved;
  state.teamDB.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));editorDraftIndex=state.teamDB.indexOf(saved);selectedDbIndex=editorDraftIndex;editorDraft=safeClone(saved);
  registerAlias('teams',saved.name);saved.players.forEach(p=>registerAlias('players',p.name));
  originalLoadTeamDbToEditor(editorDraftIndex);renderTeamDB();renderRosterEditor();editorImportant('time-editado');flash('editorRosterStatus','Ficha salva no banco.');
}
// Prefix suggestions work with names, abbreviations and saved aliases.
const suggestions=document.createElement('div');suggestions.id='editorSuggestions';suggestions.className='editor-suggestions hidden';suggestions.setAttribute('role','listbox');document.body.append(suggestions);
let suggestionInput=null,suggestionRows=[],suggestionActive=-1;
function closeEditorSuggestions(){suggestions.classList.add('hidden');suggestionInput?.setAttribute('aria-expanded','false');suggestionInput?.removeAttribute('aria-activedescendant');suggestionInput=null;suggestionRows=[];suggestionActive=-1;}
function suggestionTarget(el){return el?.matches('input[id^="teamName"],input[id^="prizeTeam"],input[id^="standingTeam"],#mvpTeam,input[data-focus-key="team"][data-focus-section="group"]');}
function showEditorSuggestions(input){
  const query=aliasKey(input.value);if(query.length<2){closeEditorSuggestions();return;}
  suggestionRows=state.teamDB.map((team,index)=>({team,index})).filter(({team})=>teamDbLookupValues(team).some(v=>aliasKey(v).includes(query))).sort((a,b)=>Number(!teamDbLookupValues(a.team).some(v=>aliasKey(v).startsWith(query)))-Number(!teamDbLookupValues(b.team).some(v=>aliasKey(v).startsWith(query)))).slice(0,8);
  if(!suggestionRows.length){closeEditorSuggestions();return;}suggestionInput=input;suggestionActive=-1;
  suggestions.replaceChildren(...suggestionRows.map(({team,index},n)=>{const btn=document.createElement('button');btn.type='button';btn.id='editorSuggestion'+n;btn.setAttribute('role','option');btn.setAttribute('aria-selected','false');btn.tabIndex=-1;
    const title=document.createElement('strong');title.textContent=team.name;const hint=document.createElement('small');hint.textContent=(team.code?team.code+' · ':'')+team.players.length+' jogadores'+(input.id.startsWith('teamName')?' · puxar elenco':'');btn.append(title,hint);btn.addEventListener('mousedown',e=>e.preventDefault());btn.addEventListener('click',()=>chooseEditorSuggestion(index));return btn;}));
  positionEditorSuggestions(input);
  suggestions.classList.remove('hidden');input.setAttribute('aria-controls',suggestions.id);input.setAttribute('aria-expanded','true');input.setAttribute('aria-autocomplete','list');
}
function positionEditorSuggestions(input){
  const box=input.getBoundingClientRect();suggestions.style.left=Math.max(8,Math.min(box.left,innerWidth-328))+'px';suggestions.style.width=Math.min(Math.max(box.width,300),innerWidth-16)+'px';
  const maxHeight=Math.min(300,Math.max(100,innerHeight-box.bottom-12));suggestions.style.maxHeight=maxHeight+'px';suggestions.style.top=(innerHeight-box.bottom<130?Math.max(8,box.top-Math.min(300,suggestionRows.length*60)):box.bottom+5)+'px';
}
function chooseEditorSuggestion(index){
  const el=suggestionInput,team=state.teamDB[index];if(!el||!team)return;
  if(el.id.startsWith('teamName')){const slot=Number(el.id.slice(8));state.teams[slot]=rosterToTeam(team,state.teams[slot]);renderAll();autoSave(false);$('teamName'+slot)?.focus();}
  else{el.value=team.code||team.name;el.dispatchEvent(new Event('input',{bubbles:true}));el.focus();}
  closeEditorSuggestions();
}
document.addEventListener('input',event=>{if(suggestionTarget(event.target))showEditorSuggestions(event.target);});
document.addEventListener('focusin',event=>{if(suggestionTarget(event.target))showEditorSuggestions(event.target);else if(!suggestions.contains(event.target))closeEditorSuggestions();});
document.addEventListener('keydown',event=>{
  if(suggestions.classList.contains('hidden')||event.target!==suggestionInput)return;
  if(event.key==='Escape'){closeEditorSuggestions();return;}
  if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();suggestionActive=(suggestionActive+(event.key==='ArrowDown'?1:-1)+suggestionRows.length)%suggestionRows.length;[...suggestions.children].forEach((btn,n)=>{btn.classList.toggle('active',n===suggestionActive);btn.setAttribute('aria-selected',String(n===suggestionActive));});suggestionInput.setAttribute('aria-activedescendant','editorSuggestion'+suggestionActive);const selected=suggestions.children[suggestionActive];if(selected.offsetTop<suggestions.scrollTop)suggestions.scrollTop=selected.offsetTop;else if(selected.offsetTop+selected.offsetHeight>suggestions.scrollTop+suggestions.clientHeight)suggestions.scrollTop=selected.offsetTop+selected.offsetHeight-suggestions.clientHeight;}
  if(event.key==='Enter'&&suggestionActive>=0){event.preventDefault();chooseEditorSuggestion(suggestionRows[suggestionActive].index);}
});
document.addEventListener('pointerdown',event=>{if(!suggestions.contains(event.target)&&event.target!==suggestionInput)closeEditorSuggestions();});
window.addEventListener('scroll',()=>{if(suggestionInput)positionEditorSuggestions(suggestionInput);},true);window.addEventListener('resize',()=>{if(suggestionInput)positionEditorSuggestions(suggestionInput);});
// Preserve undo boundaries and flush any pending autosave before leaving.
for(const name of ['undoChange','redoChange']){const old=window[name];window[name]=function(...args){flushEditorLocal();return old(...args);};}
for(const name of ['generateWiki','exportJSON','saveParticipantToDb','saveTeamDbFromText','updateSelectedTeamDbFromText','deleteSelectedTeamDb','clearTeamDatabase']){
  const old=window[name];window[name]=function(...args){flushDependentTeamRender();const result=old(...args);editorImportant(name);if(['deleteSelectedTeamDb','clearTeamDatabase'].includes(name))discardRosterDraft();return result;};
}
const originalImportJSON=importJSON;
importJSON=function(ev){
  const file=ev.target.files?.[0];if(!file)return;
  const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(reader.result);if(!parsed||typeof parsed!=='object'||!parsed.settings||!Array.isArray(parsed.teams))throw Error('schema');saveEditorRecovery('Antes de importar JSON');state=normalizeState(parsed);state.cffSeedImportedV1=true;discardRosterDraft();resetParticipantTransientState();renderAll();renderTournamentPresets();editorImportant('backup-importado');flash('copyStatus','Backup importado com times, modelos e configurações.');}catch(error){alert('JSON inválido ou incompatível. O projeto atual foi preservado.');}ev.target.value='';};reader.readAsText(file);
};
const originalRenderAll=renderAll;
renderAll=function(){originalRenderAll();renderTournamentPresets();};
window.EditorLiquipedia={snapshot:()=>safeClone(state),flush:flushEditorLocal,restore(data){if(!data?.settings||!Array.isArray(data.teams))throw Error('Backup incompatível');saveEditorRecovery('Antes de restaurar');state=normalizeState(data);state.cffSeedImportedV1=true;discardRosterDraft();resetParticipantTransientState();renderAll();initializeHistory();flushEditorLocal();},history(){try{return JSON.parse(localStorage.getItem('cff-liquipedia-recovery-v1')||'[]');}catch(error){return [];}}};
window.addEventListener('pagehide',flushEditorLocal);document.addEventListener('visibilitychange',()=>{if(document.hidden)flushEditorLocal();});window.addEventListener('blur',flushEditorLocal);
// Initialization is local and never overwrites a remote checkpoint.
loadSaved();state=normalizeState(state);mergeInitialMemory();
if(!state.cffPresetsInitializedV1){if(!state.tournamentPresets.some(p=>p.id===MARINHO_PRESET.id))state.tournamentPresets.push(safeClone(MARINHO_PRESET));state.cffPresetsInitializedV1=true;}
const seriesInput=document.querySelector('[data-path="infobox.series"]');if(seriesInput){const label=document.createElement('label');label.className='compact-check';label.innerHTML='<input id="editorSeriesCommented" type="checkbox"> Deixar series em comentário';label.querySelector('input').addEventListener('change',e=>{state.infobox.seriesCommented=e.target.checked;autoSave(false);});seriesInput.parentElement.append(label);}
initializeHistory();loadFocusState();renderAll();loadCollapsedSections();initializeLayoutUi();flushEditorLocal();

const editorHeaderObserver=new ResizeObserver(()=>document.documentElement.style.setProperty('--editor-header-height',document.getElementById('appHeader').offsetHeight+'px'));editorHeaderObserver.observe(document.getElementById('appHeader'));
