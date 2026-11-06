(function(){
'use strict';
if(window.CFF_GLOBAL_CAMP)return;
const C=window.CFF_GLOBAL_CAMP_CORE,$=id=>document.getElementById(id),copy=x=>JSON.parse(JSON.stringify(x));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storage=window.localStorage,version='20261104-camp-history-v5';
const labels={classificatoria:'Classificatória · Fase 1',segundaFase:'Segunda fase · Pools',lastChance:'Repescagem',final:'Grande Final'};
let publishedForReview=null;
let meta,template,state=null,busy=false,preview=null,review=null,selectedStage='classificatoria',previousFocus=null,previousOverflow='',navDefaults=null;
const originalCollect=window.collectBackupData,originalImport=window.importBackup;
function restore(data){state=data?.config?.cffGlobalRound?{key:data.config.cffGlobalRound,archive:copy(data.config.cffGlobalArchive||{}),players:copy(data.config.cffGlobalPlayers||[]),revisions:copy(data.config.cffGlobalRevisions||{}),presentationVersion:Number(data.config.cffGlobalPresentationVersion)||0}:null}
restore(window.__CFF_CAMP_INITIAL_BACKUP__||originalCollect?.(true));
function collect(){const data=originalCollect.apply(this,arguments);if(data?.config&&state)Object.assign(data.config,{cffGlobalRound:state.key,cffGlobalArchive:copy(state.archive),cffGlobalPlayers:copy(state.players),cffGlobalRevisions:copy(state.revisions),cffTournamentModel:'ffws-global-2026',cffGlobalPresentationVersion:state.presentationVersion});return data}
window.collectBackupData=collect;try{collectBackupData=collect}catch(_){}
const wrappedImport=function(){let next;try{next=JSON.parse($('backup-input').value)}catch(_){}const before=state;if(next)restore(next);try{const result=originalImport.apply(this,arguments);render();return result}catch(e){state=before;throw e}};
window.importBackup=wrappedImport;try{importBackup=wrappedImport}catch(_){}
const data=()=>window.collectBackupData(true),persist=()=>window.autoSave?.(true),currentRound=()=>meta.rounds.find(r=>r.key===state?.key);
function message(text,error=false){for(const id of ['cff-global-message','cff-global-send-status']){const el=$(id);if(el){el.textContent=text;el.dataset.error=String(error)}}}
function checkpoint(){storage.setItem('cff_global_before_switch_v1',JSON.stringify({savedAt:Date.now(),backup:data()}))}
function archived(){const records=copy(state?.archive||{});if(state){const current=C.record(data(),state.key,meta);try{records[state.key]=C.validate(current,meta)}catch(_){records[state.key]={...current,complete:false}}}return records}
async function apply(next,label){const before=state;restore(next);try{await window.CFF_CAMP.applyBackupText(JSON.stringify(next),label,false);persist();render()}catch(e){state=before;throw e}}
async function action(fn){if(busy)return;busy=true;toggle(true);try{await fn()}catch(e){message(e.message,true);if(!$('cff-global-review')?.hidden)$('cff-global-review-status').textContent=e.message}finally{busy=false;toggle(false);syncModelUi();const modal=$('cff-global-review');if(modal&&!modal.hidden&&!modal.contains(document.activeElement))$('cff-global-review-confirm').focus()}}
function toggle(value){document.querySelectorAll('#cff-global-camp button,#cff-global-camp select,#cff-global-camp textarea,#cff-global-camp input,#cff-global-send button,#cff-global-review button,#cff-global-review select').forEach(el=>el.disabled=value);}
function show(target){if(!target)return;for(let el=target;el;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true;target.scrollIntoView({block:'start',behavior:'smooth'});}
function roundText(r){return `${r.date.slice(8)}/${r.date.slice(5,7)} · ${r.time24} · ${r.groups?'Grupos '+r.groups.join(' × '):r.label}`}
function fillRounds(key){const select=$('cff-global-round');if(!select)return;select.innerHTML=meta.rounds.filter(r=>r.stage===selectedStage).map(r=>`<option value="${esc(r.key)}">${esc(roundText(r))}</option>`).join('');if(key&&meta.rounds.find(r=>r.key===key)?.stage===selectedStage)select.value=key;}
function syncModelUi(){
 if(!meta||!$('cff-global-camp'))return;
 const round=currentRound(),active=!!round;document.body.classList.toggle('cff-global-model-active',active);
 $('cff-global-custom-settings').hidden=active;
 $('cff-global-stage-cards').querySelectorAll('button').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.globalStage===selectedStage));button.classList.toggle('is-active',button.dataset.globalStage===selectedStage)});
 $('cff-global-load').textContent=active?'Carregar esta rodada':'Carregar modelo e rodada';
 $('cff-global-send').hidden=false;$('cff-global-publish').disabled=busy||!active;
 if(active){
  const nav=$('cff-camp-workflow');const names=['Fases do Mundial','Times da rodada','Dia e horário','Lançar quedas','Resumos e códigos'];
  nav?.querySelectorAll('[data-camp-go] span').forEach((span,i)=>span.textContent=names[i]);
  if(nav?.querySelector('strong'))nav.querySelector('strong').textContent='Mundial · da configuração ao envio';
  if(nav?.querySelector('p'))nav.querySelector('p').textContent='As fases e os times vêm do modelo. Lance as quedas e confira o envio em Resumos e códigos.';
  if($('cff-workflow-status'))$('cff-workflow-status').textContent=`${labels[round.stage]} · ${roundText(round)} · 12 times na rodada. Rascunho local até você confirmar o envio.`;
 }else if(navDefaults){const nav=$('cff-camp-workflow');if(nav?.querySelector('strong'))nav.querySelector('strong').textContent=navDefaults.title;if(nav?.querySelector('p'))nav.querySelector('p').textContent=navDefaults.description;}
}
function render(){
 if(!$('cff-global-current')||!meta)return;
 const round=currentRound();if(round){selectedStage=round.stage;fillRounds(round.key)}
 $('cff-global-current').textContent=round?`${labels[round.stage]} — ${roundText(round)} — ${round.matches?round.matches+' quedas':'Champion Rush 110 · sem limite'}`:'O modelo começa na Classificatória. Escolha a rodada e carregue para preparar os 12 times, as datas e todas as fases.';
 const ids=state?(data().selectedTeams||[]).map(code=>C.team(meta,code)?.id||code):[];
 $('cff-global-teams').innerHTML=ids.map(id=>{const t=C.team(meta,id);return `<span><img src="/${esc(t?.logo||'escudo.webp')}" alt="" width="28" height="28"><b>${esc(t?.name||id)}</b><code>${esc(t?.wikiName||id)}</code></span>`}).join('');
 $('cff-global-players-fields').innerHTML=(state?meta.players.filter(p=>ids.includes(C.team(meta,p.team)?.id)):[]).map(p=>{const row=state.players.find(r=>r.id===p.id)||{};return `<tr data-global-player="${esc(p.id)}"><th scope="row">${esc(p.name)}<small>${esc(p.team)}</small></th>${['kills','damage','assists','matches'].map(k=>`<td><input type="number" min="${k==='matches'?1:0}" step="1" data-stat="${k}" aria-label="${esc(p.name)} — ${k}" value="${esc(row[k]??'')}" placeholder="—"></td>`).join('')}</tr>`}).join('');
 syncModelUi();
}
// Keep presentation and export preferences without importing scores or round identity.
function keepSummarySettings(next,current){
 const source=current?.config||{};
 for(const key of ['tableSpacing','hideLogosSummary','summaryFullTable','showColTotal','showColBooyah','showColKills','showColPlacement','showColStarting','showColMatches','showColLastDrop','showLastDropDetails','summaryColumnOrder','summaryColumnWidths','summaryTableManualWidth','summaryTableStyle','showDropColumns','showGameDetails','headerHeight','emojiVisualEnabled','emojiRules','v68PositionEmojiLegend','v90ChampionShowActivatedLogos','postShowDrop','postShowMap','postShowBooyah','postShowBooyahCount','postShowKills','postShowPoints','postShowMvp','postShowMvpKills','postShowTableLine','cffFinalWikiV1']){
  if(!source.cffGlobalRound&&['emojiVisualEnabled','emojiRules','v68PositionEmojiLegend'].includes(key))continue;
  if(Object.hasOwn(source,key))next.config[key]=copy(source[key]);
 }
 return next;
}
async function openRound(){
 const key=$('cff-global-round').value,records=archived();for(const [k,r]of Object.entries(records))if(r.complete)records[k]=C.validate(r,meta);
 const next=keepSummarySettings(C.backup(template,meta,key,records),data());next.config.cffGlobalRevisions=copy(state?.revisions||{});
 if(!confirm('Carregar esta rodada do Mundial? O campeonato atual será preservado em um backup neste navegador.'))return;
 checkpoint();await apply(next,'Global Finals 2026');message('Modelo carregado: '+labels[currentRound().stage]+'. Lance as quedas; para enviar, vá a Resumos e códigos.');
}
function readPlayers(silent=false){if(!state)throw Error('Carregue uma rodada do Mundial primeiro.');const rows=[];
 for(const tr of $('cff-global-players-fields').querySelectorAll('tr')){const fields=[...tr.querySelectorAll('input')];if(fields.every(el=>el.value===''))continue;const row={id:tr.dataset.globalPlayer};fields.forEach(el=>row[el.dataset.stat]=el.value===''?null:Number(el.value));rows.push(row)}state.players=rows;persist();if(!silent)message('Dados individuais salvos no rascunho. Envie ao site em Resumos e códigos.');
}
async function db(){const [a,b,c]=await Promise.all([import('https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js')]);const app=a.getApps().length?a.getApp():a.initializeApp(window.CFF_CONFIG.firebase),auth=b.getAuth(app);await auth.authStateReady();if(auth.currentUser?.email?.toLowerCase()!=='admin@centralfreefire.com.br')throw Error('Entre com a conta administradora para publicar os dados na home.');return{...c,db:c.getDatabase(app)}}
function fingerprint(){return JSON.stringify(C.record(data(),state.key,meta))}
function buildReview(){
 if(!state)throw Error('Carregue o modelo do Mundial primeiro.');readPlayers(true);
 const result=C.confirmed(data(),state.key,meta),current=result.record,round=currentRound(),records={...state.archive,[state.key]:current};
 const phase=round.stage==='classificatoria'?meta.rounds.filter(r=>r.stage===round.stage&&(r.key===state.key||Number(state.revisions[r.key])>0)).map(r=>records[r.key]).filter(r=>r?.drops?.length):[current];
 review={current,round,hasDraft:result.hasDraft,ranking:C.rank(phase,meta,round.stage==='final'),fingerprint:fingerprint(),expected:Number(state.revisions[state.key]||0),receipt:window.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2)};
 return review;
}
function table(headers,rows){return `<div class="cff-global-review-table"><table><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>'<tr>'+row.map(cell=>'<td>'+esc(cell)+'</td>').join('')+'</tr>').join('')}</tbody></table></div>`}
function renderReviewDrop(){if(!review)return;const index=Number($('cff-global-review-drop').value)||0,d=review.current.drops[index],rows=review.current.participants.map(id=>({id,pos:Number(d.placements[id]),kills:Number(d.kills[id]),points:Number(d.points[id])})).sort((a,b)=>a.pos-b.pos);$('cff-global-review-drop-table').innerHTML=table(['Pos.','Equipe','Abates','Pontos'],rows.map(r=>[r.pos+'º',C.team(meta,r.id)?.name||r.id,r.kills,r.points]));}
function renderPublicationDiff(r){
 const entry=publishedForReview?.[r.current.key];
 if(!entry){$('cff-global-review-changes').textContent=r.expected?'Para comparar com a revisão publicada, use “Puxar resultados publicados” antes de editar.':'Primeira publicação desta rodada.';return;}
 const a=entry.drops||[],b=r.current.drops;
 const same=(x,y)=>!!x&&x.map===y.map&&r.current.participants.every(id=>['points','kills','placements'].every(k=>Number(x[k]?.[id])===Number(y[k]?.[id])));
 const changed=b.flatMap((drop,i)=>a[i]&&!same(a[i],drop)?[i+1]:[]);
 const oldPlayers=new Map((entry.players||[]).map(p=>[p.id,p])),newPlayers=new Map(r.current.players.map(p=>[p.id,p]));
 const playerFields=['matches','kills','damage','assists'];
 const edits=[...new Set([...oldPlayers.keys(),...newPlayers.keys()])].filter(id=>!oldPlayers.has(id)||!newPlayers.has(id)||playerFields.some(k=>oldPlayers.get(id)[k]!==newPlayers.get(id)[k])).length;
 $('cff-global-review-changes').textContent='Comparação com a revisão carregada: '+[
  b.length>a.length?(b.length-a.length)+' queda(s) nova(s)':'',
  changed.length?'quedas alteradas: '+changed.join(', '):'',
  b.length<a.length?(a.length-b.length)+' queda(s) a menos no rascunho':'',
  edits?edits+' registro(s) individual(is) alterado(s)':''
 ].filter(Boolean).join(' · ') + (a.length===b.length&&!changed.length&&!edits?'nenhuma alteração.':'.');
}
function openReview(){
 const r=buildReview(),modal=$('cff-global-review');previousFocus=document.activeElement;previousOverflow=document.body.style.overflow;
 $('cff-global-review-subtitle').textContent=labels[r.round.stage]+' · '+roundText(r.round);
 $('cff-global-review-note').textContent=`Serão enviadas as quedas 1 a ${r.current.drops.length} desta rodada, com substituição dos lançamentos anteriores, sem somar duas vezes.${r.hasDraft?' Há uma queda em rascunho que não será enviada.':''}`;
 renderPublicationDiff(r);
 $('cff-global-review-drop').innerHTML=r.current.drops.map((d,i)=>`<option value="${i}">Queda ${i+1}${d.map?' · '+esc(d.map):''}</option>`).join('');$('cff-global-review-drop').value=String(r.current.drops.length-1);renderReviewDrop();
 $('cff-global-review-ranking-title').textContent=r.round.stage==='classificatoria'?'Classificação geral da Fase 1 após este envio':'Classificação desta rodada após este envio';
 $('cff-global-review-ranking').innerHTML=table(['#','Equipe','Pontos','Abates','Booyahs','Quedas'],r.ranking.map((t,i)=>[i+1+'º',t.name,t.points,t.kills,t.booyahs,t.matches]));
 $('cff-global-review-players').textContent=r.current.players.length?`${r.current.players.length} jogadores com estatísticas individuais informadas.`:'Sem estatísticas individuais neste envio. A classificação dos times será atualizada; os dados dos jogadores continuam aguardando lançamento.';
 $('cff-global-review-status').textContent='Confira os resultados. Nada foi enviado ainda.';modal.hidden=false;document.body.style.overflow='hidden';$('cff-global-review-confirm').focus();
}
function closeReview(force=false){if(busy&&!force)return;$('cff-global-review').hidden=true;document.body.style.overflow=previousOverflow;review=null;previousFocus?.focus?.();}
async function publishConfirmed(){
 if(!review)throw Error('Abra a conferência dos resultados antes de enviar.');
 if(!state||review.current.key!==state.key||review.fingerprint!==fingerprint())throw Error('O rascunho mudou desde a conferência. Feche a janela e confira novamente antes de enviar.');
 const approval=review,api=await db(),target=api.ref(api.db,'ffwsLive/global-2026');
 await api.get(target); // Warm the transaction cache before checking an existing revision.
 const result=await api.runTransaction(target,root=>C.publication(root,approval.current,meta,approval.expected,approval.receipt,approval.ranking),{applyLocally:false});
 if(!result.committed)throw Error('Não foi possível confirmar o envio. Seu rascunho foi preservado.');
 const root=result.snapshot.val();publishedForReview=copy(root.rounds||{});state.archive=root.rounds||{};state.revisions=root.revisions||{};persist();closeReview(true);message('Resultados enviados! A home recebe a tabela e os destaques do Mundial. Atualização em até 90 segundos.');
 const storage=window.CFF_CAMP?.persistence;
 if(storage)void storage.saveRemoteAfterDrop(storage.saveLocalNow('global-publish',true)).then(ok=>{if(!ok)message('Resultados publicados. O rascunho segue neste navegador; confira o aviso em Continuar no celular ou no PC.');});
}
async function pull(){
 const api=await db(),root=(await api.get(api.ref(api.db,'ffwsLive/global-2026'))).val();
 const round=meta.rounds.find(r=>r.key===root?.home?.roundKey&&root?.rounds?.[r.key]?.drops?.length)||meta.rounds.filter(r=>root?.rounds?.[r.key]?.drops?.length).at(-1);
 if(!round)throw Error('Ainda não há rodadas publicadas.');
 if(!confirm('Abrir a rodada publicada de '+roundText(round)+'? As opções da tabela deste navegador serão mantidas. O rascunho atual ficará no backup anterior.'))return;
 checkpoint();const next=keepSummarySettings(C.backup(template,meta,round.key,root.rounds,true),data());
 next.config.cffGlobalRevisions=root.revisions||{};publishedForReview=copy(root.rounds||{});await apply(next,'Mundial publicado');message('Resultados publicados carregados: '+roundText(round)+'.');
}
function previewWiki(){if(!state)throw Error('Carregue uma rodada do Mundial primeiro.');const drops=C.wiki($('cff-global-wiki').value,meta,data().selectedTeams),validated=C.validate({...C.record(data(),state.key,meta),drops,players:[]},meta);preview=validated.drops;$('cff-global-wiki-preview').textContent=C.rank([validated],meta).map((r,i)=>`${i+1}º ${r.name}: ${r.points} pts / ${r.kills} abates`).join('\n');$('cff-global-wiki-apply').hidden=false;message(`${preview.length} queda(s) lida(s). Confira a prévia antes de aplicar. Nenhum dado foi alterado.`)}
async function applyWiki(){if(!preview)throw Error('Faça a prévia primeiro.');if(!confirm('Aplicar estas quedas à rodada atual? O estado anterior será preservado.'))return;checkpoint();const next=data(),round=currentRound();next.drops=preview.map(d=>C.nativeDrop(d,meta));while(next.drops.length<(round.matches||preview.length+1))next.drops.push(C.emptyDrop(next.selectedTeams));next.config.quedas=String(next.drops.length);next.config.cffGlobalPlayers=[];await apply(next,'Wiki do Mundial');preview=null;$('cff-global-wiki-apply').hidden=true;message('Quedas aplicadas. Os dados individuais podem ser informados abaixo; envie em Resumos e códigos.');}
async function customTournament(){if(state){if(!confirm('Criar um campeonato personalizado? O Mundial atual ficará preservado no backup anterior.'))return;checkpoint();await apply(copy(template),'Campeonato personalizado')}const box=$('cff-global-custom-settings');box.hidden=false;box.open=true;show(box);}
function prepareLayout(section){
 const chooser=$('cff-camp-mode-chooser'),setup=$('cff-admin-tournament-setup'),nav=$('cff-camp-workflow'),anchor=chooser||nav||setup||document.querySelector('.cff-camp-command');anchor.before(section);if(nav)navDefaults={title:nav.querySelector('strong')?.textContent||'',description:nav.querySelector('p')?.textContent||''};
 const custom=document.createElement('details');custom.id='cff-global-custom-settings';custom.innerHTML='<summary>Configurar outro campeonato manualmente</summary>';section.after(custom);if(chooser)custom.append(chooser);if(setup)custom.append(setup);
 nav?.addEventListener('click',event=>{if(!state)return;const go=event.target.closest('[data-camp-go]')?.dataset.campGo;if(!['setup','roster','days'].includes(go))return;event.preventDefault();event.stopImmediatePropagation();show(go==='roster'?$('cff-global-teams-detail'):section);},true);
 for(const event of ['cff:camp-interface-change','cff:camp-phases-rendered','v76:tournament-state'])window.addEventListener(event,()=>{syncModelUi();setTimeout(syncModelUi,0)});
 const api=window.CFF_TOURNAMENT_SETUP;if(api){const previous=api.getCurrentSummary;api.getCurrentSummary=function(){return state?{name:labels[currentRound()?.stage]||'Mundial'}:previous.apply(this,arguments)}}
 const summary=$('summary-section');summary.querySelector(':scope>summary').textContent='Resumos e códigos';
 const send=document.createElement('section');send.id='cff-global-send';send.className='cff-global-send';send.innerHTML='<div><strong>Enviar resultados do Mundial</strong><p>Confira a queda e a classificação em uma janela antes de publicar. Salvar o rascunho não envia os resultados ao site.</p></div><button type="button" id="cff-global-publish" class="cff-global-primary">Enviar resultados para o site</button><p id="cff-global-send-status" role="status" aria-live="polite"></p>';summary.querySelector('.collapsible-content').prepend(send);
 const modal=document.createElement('div');modal.id='cff-global-review';modal.className='cff-global-review';modal.hidden=true;modal.innerHTML='<section class="cff-global-review-dialog" role="dialog" aria-modal="true" aria-labelledby="cff-global-review-title" aria-describedby="cff-global-review-note"><header><div><small>CONFERÊNCIA ANTES DO ENVIO</small><h2 id="cff-global-review-title">Confirmar resultados do Mundial</h2><p id="cff-global-review-subtitle"></p></div><button type="button" id="cff-global-review-close" aria-label="Fechar conferência">×</button></header><div class="cff-global-review-body"><p id="cff-global-review-note"></p><p id="cff-global-review-changes"></p><h3>Resultados da queda</h3><label for="cff-global-review-drop">Conferir queda</label><select id="cff-global-review-drop"></select><div id="cff-global-review-drop-table"></div><h3 id="cff-global-review-ranking-title"></h3><div id="cff-global-review-ranking"></div><p id="cff-global-review-players"></p></div><footer><p id="cff-global-review-status" role="status" aria-live="polite"></p><div><button type="button" id="cff-global-review-cancel">Voltar para editar</button><button type="button" id="cff-global-review-confirm" class="cff-global-primary">Confirmar e enviar ao site</button></div></footer></section>';document.body.append(modal);
 modal.addEventListener('click',e=>{if(e.target===modal)closeReview()});for(const id of ['cff-global-review-close','cff-global-review-cancel'])$(id).addEventListener('click',()=>closeReview());
 $('cff-global-review-drop').addEventListener('change',renderReviewDrop);$('cff-global-review-confirm').addEventListener('click',()=>action(publishConfirmed));
 document.addEventListener('keydown',e=>{if(modal.hidden)return;if(e.key==='Escape'){e.preventDefault();closeReview()}if(e.key==='Tab'){const items=[...modal.querySelectorAll('button,select')].filter(el=>!el.disabled),first=items[0],last=items.at(-1);if(!first){e.preventDefault();return}if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
}
function recoverModelIdentity(){
 if(state)return;
 const current=window.__CFF_CAMP_INITIAL_BACKUP__||originalCollect?.(true),cfg=current?.config||{};
 if(!String(cfg.cffFfwsStage||'').startsWith('global-')&&!String(cfg.tournamentName||'').toLowerCase().startsWith(meta.name.toLowerCase()+' — '))return;
 const date=String(cfg.date||cfg.daySettings?.[0]?.date||'').slice(0,10),ids=(current.selectedTeams||[]).map(code=>C.team(meta,code)?.id).sort();
 if(ids.length!==12||new Set(ids).size!==12||ids.some(id=>!id))return;
 const matches=meta.rounds.filter(r=>r.date===date&&(!r.groups||r.groups.flatMap(g=>meta.groups[g]).sort().join('|')===ids.join('|')));
 if(matches.length!==1)return;
 const round=matches[0];let saved=cfg;
 // Older collectors could drop the custom model fields. Recover metadata only;
 // never replace the current drop scores with an older backup.
 try{const history=JSON.parse(storage.getItem('cff_camp_safe_history_v1')||'[]');const found=history.find(item=>item?.backup?.config?.cffGlobalRound===round.key);if(found)saved=found.backup.config}catch(_){}
 restore({config:{...saved,cffGlobalRound:round.key}});
}
function migratePresentation(){
 if(!state)return;
 const input=$('tournament-name'),title=input?.value||'';
 if(title.startsWith(meta.name+' — Fase 1 · ') && / · \d{2}:\d{2}$/.test(title)){
  input.value=title.replace(/ · \d{2}:\d{2}$/,'');
  input.dispatchEvent(new Event('input',{bubbles:true}));
 }
 if(state.presentationVersion<5){
  // Older ready-model imports inherited the Brazil qualifier legend from the browser.
  const visual=$('emoji-visual-enabled');if(visual){visual.checked=false;visual.dispatchEvent(new Event('change',{bubbles:true}));}
  const rules=$('emoji-rules-input');if(rules && /^⬆️?\s*:\s*1-2$/.test(rules.value.trim())){rules.value='';rules.dispatchEvent(new Event('input',{bubbles:true}));}
  state.presentationVersion=5;window.renderSummary?.();persist();
 }
}
async function boot(){try{
 [meta,template]=await Promise.all([`/ffws-global-2026/camp-model.json?v=${version}`,`/camp-ao-vivo/base.json?v=${version}`].map(async url=>{const r=await fetch(url);if(!r.ok)throw Error('Não foi possível carregar o modelo do Mundial.');return r.json()}));
 recoverModelIdentity();
 const descriptions={classificatoria:'24 times · 4 grupos · 6 dias',segundaFase:'4 dias · Top 2 por dia à final',lastChance:'12 times · 10 quedas · Top 4',final:'12 times · Champion Rush 110'};
 const section=document.createElement('section');section.id='cff-global-camp';section.className='cff-global-camp';section.innerHTML=`<header><div><small>1 · MONTAR CAMPEONATO · MODELO PRONTO</small><h2>FFWS Global Finals 2026</h2><p>Classificatória, pools, repescagem e final preparados. Os resultados ficam separados por rodada.</p></div><button type="button" id="cff-global-custom">Campeonato personalizado</button></header><nav id="cff-global-stage-cards" aria-label="Fases do Mundial">${Object.entries(labels).map(([key,label])=>`<button type="button" data-global-stage="${key}" aria-pressed="${key==='classificatoria'}"><strong>${esc(label)}</strong><small>${descriptions[key]}</small></button>`).join('')}</nav><div class="cff-global-actions"><label>Dia e rodada<select id="cff-global-round"></select></label><button type="button" id="cff-global-load" class="cff-global-primary">Carregar modelo e rodada</button></div><p id="cff-global-current"></p><p class="cff-global-route">Para publicar: <button type="button" id="cff-global-go-send">Resumos e códigos → Enviar resultados para o site</button></p><details id="cff-global-teams-detail"><summary>Times da rodada e códigos Wiki</summary><div id="cff-global-teams" class="cff-global-teams"></div></details><details><summary>Formato, pools e classificados</summary><p>Classificatória: 6, 7, 8, 13, 14 e 15/11. Dois confrontos por dia, às 04h e 09h, com seis quedas por confronto. Cada equipe joga 36 quedas.</p><p>Top 18 → segunda fase; 19º–20º → repescagem; 21º–24º eliminados. Segunda fase: 19 a 22/11, às 07h; pontos zerados a cada dia. Dia 1: top 12. Dias 2, 3 e 4: dez restantes + 13º/14º, 15º/16º e 17º/18º, respectivamente. Os dois melhores de cada dia vão à final.</p><p>Repescagem em 27/11 às 07h: dez restantes + 19º e 20º da classificatória; dez quedas, top 4 à final. Grande Final em 28/11 às 07h: Champion Rush 110, sem limite de quedas. Só vale Booyah depois da queda de ativação.</p><p>Os 12 times das etapas seguintes são calculados após a confirmação dos resultados necessários. Todos os horários são de Brasília.</p></details><details><summary>Importar código Wiki da rodada</summary><p>Cole um Match com TeamOpponent e MS (posição e abates). Os 24 códigos do Mundial são reconhecidos; primeiro confira a prévia.</p><textarea id="cff-global-wiki" rows="5" aria-label="Código Wiki da rodada" placeholder="{{Match |opponent1={{TeamOpponent|ag.al|m1={{MS|1|10}}}} ... }}"></textarea><div class="cff-global-actions"><button type="button" id="cff-global-wiki-read">Ler e conferir</button><button type="button" id="cff-global-wiki-apply" hidden>Aplicar quedas</button></div><pre id="cff-global-wiki-preview"></pre></details><details><summary>Abates, dano e assistências dos jogadores</summary><p>Totais desta rodada. Deixe vazio o dado que ainda não tem; o Wiki de times não informa as estatísticas individuais.</p><div class="cff-global-table"><table><thead><tr><th>Jogador</th><th>Abates</th><th>Dano</th><th>Assist.</th><th>Quedas</th></tr></thead><tbody id="cff-global-players-fields"></tbody></table></div><button type="button" id="cff-global-save-players">Salvar individuais no rascunho</button></details><div class="cff-global-actions"><button type="button" id="cff-global-pull">Puxar resultados publicados</button><button type="button" id="cff-global-recover">Baixar backup anterior</button></div><p id="cff-global-message" role="status" aria-live="polite"></p>`;
 prepareLayout(section);fillRounds(state?.key);
 for(const [id,fn]of Object.entries({'cff-global-load':openRound,'cff-global-custom':customTournament,'cff-global-publish':openReview,'cff-global-pull':pull,'cff-global-wiki-read':previewWiki,'cff-global-wiki-apply':applyWiki,'cff-global-save-players':()=>readPlayers()}))$(id).addEventListener('click',()=>action(fn));
 $('cff-global-go-send').addEventListener('click',()=>show($('summary-section')));
 $('cff-global-stage-cards').addEventListener('click',event=>{const stage=event.target.closest('[data-global-stage]')?.dataset.globalStage;if(!stage||busy)return;selectedStage=stage;fillRounds();syncModelUi()});
 $('cff-global-wiki').addEventListener('input',()=>{preview=null;$('cff-global-wiki-apply').hidden=true});$('cff-global-players-fields').addEventListener('change',()=>{try{readPlayers()}catch(e){message(e.message,true)}});
 $('cff-global-recover').addEventListener('click',()=>action(()=>{const raw=storage.getItem('cff_global_before_switch_v1');if(!raw)throw Error('Nenhum backup anterior disponível.');const content=JSON.parse(raw).backup,url=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='camp-antes-do-mundial.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}));
 const previousLogo=window.getLogo,globalLogo=function(name){const t=state&&C.team(meta,name);return t?'/'+t.logo.replace(/^\//,''):previousLogo?.apply(this,arguments)};globalLogo.__cffCampPatched=true;globalLogo.__cffCampOriginal=previousLogo;window.getLogo=globalLogo;try{getLogo=globalLogo}catch(_){}
 migratePresentation();render();window.CFF_GLOBAL_CAMP={getMeta:()=>copy(meta),getRoundKey:()=>state?.key||'',getState:()=>copy(state),openRound,publish:openReview,previewWiki};
}catch(e){console.error('[Modelo Mundial]',e);window.CFF_CAMP?.toast?.(e.message,'err')}}
boot();
})();
