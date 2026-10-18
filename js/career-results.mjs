import {esc,ROLES,teamHref,periodLabel} from './career-client.mjs?v=20261018-career-organized-v1';

const BASE='/career-data/results/',requests=new Map(),mounted=new WeakMap();
const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const staffRole=role=>role&&role!=='player';
async function json(path){
 if(requests.has(path))return requests.get(path);
 const pending=(async()=>{const response=await fetch(BASE+path,{cache:path==='manifest.json'?'no-cache':'force-cache',signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('Resultados indisponíveis');return response.json();})();
 requests.set(path,pending);
 try{return await pending;}catch(error){requests.delete(path);throw error;}
}
function dateBounds(value){
 const s=String(value||'');if(!/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(s))return null;
 if(s.length===4)return [s+'-01-01',s+'-12-31'];
 if(s.length===7){const [y,m]=s.split('-').map(Number);return [s+'-01',s+'-'+String(new Date(Date.UTC(y,m,0)).getUTCDate()).padStart(2,'0')];}
 return [s,s];
}
export function participationPeriod(tenure,event){
 const start=dateBounds(tenure.start?.date),end=dateBounds(tenure.end?.date),first=event.startDate,last=event.endDate;
 const partial=!!((start&&first&&start[0]>first)||(end&&last&&end[1]<last));
 const outside=!!((start&&last&&start[0]>last)||(end&&first&&end[1]<first));
 const final=event.finalDate;
 const leftBeforeFinal=!!(end&&final&&end[1]<final),joinedAfterFinal=!!(start&&final&&start[0]>final);
 return {partial,outside,awardEligible:!outside&&!leftBeforeFinal&&!joinedAfterFinal&&(!partial||!!final),
  label:outside?'Datas do vínculo fora do período da edição':partial?'Participação parcial':start||end?'Período do vínculo registrado':'Participação registrada nesta edição'};
}
export function linkCoachResults(person,manifest,snapshots){
 const records=new Map();
 for(const tenure of person.tenures||[]){
  if(tenure.deleted||!staffRole(tenure.role))continue;
  const teamId=manifest.aliases[key(tenure.teamId)]||manifest.aliases[key(tenure.teamName)];
  for(const competition of tenure.competitions||[]){
   const id=(teamId||key(tenure.teamId||tenure.teamName))+':'+competition.id;
   const event=snapshots.get(teamId)?.editions?.find(e=>e.id===competition.id);
   if(/^ffwsbr2024s[12]$/.test(competition.id)&&(tenure.competitions||[]).some(c=>c.id==='ffwsbr2024'))continue;
   let record=records.get(id);
   if(!record){record={id,teamId,team:tenure.teamName,teamPageName:tenure.teamPageName||tenure.teamName,
    competition,event,year:event?.year||Number(competition.name?.match(/\b20\d{2}\b/)?.[0])||null,tenures:[],periods:[]};records.set(id,record);}
   record.tenures.push(tenure);record.periods.push(participationPeriod(tenure,event||{}));
  }
 }
 return [...records.values()].sort((a,b)=>(b.year||0)-(a.year||0)||String(b.event?.startDate||'').localeCompare(a.event?.startDate||'')||b.competition.id.localeCompare(a.competition.id,undefined,{numeric:true})||a.team.localeCompare(b.team));
}
const finalStage=record=>record.event?.stages?.find(s=>s.isFinal);
export function coachSummary(records){
 const eligible=r=>r.periods.some(p=>p.awardEligible);
 return {editions:new Set(records.map(r=>r.competition.id)).size,
  finals:new Set(records.filter(r=>eligible(r)&&finalStage(r)?.finished).map(r=>r.competition.id)).size,
  titles:new Set(records.filter(r=>eligible(r)&&r.event?.stages?.some(s=>s.finished&&s.champion)).map(r=>r.competition.id)).size,
  international:new Set(records.filter(r=>['MUNDIAL','EWC'].includes(r.competition.family)).map(r=>r.competition.id)).size};
}
function resultLabel(record){
 const stages=record.event?.stages||[],stage=finalStage(record)||stages.at(-1);
 if(!stage)return 'Resultado ainda não cadastrado';
 if(stage.champion&&stage.finished)return 'Campeão · '+stage.label;
 return (stage.position?stage.position+'º · ':'')+stage.label+(stage.finished?'':' · Parcial');
}
function stageTable(stages){
 const n=value=>Number.isFinite(value)?value.toLocaleString('pt-BR'):'—';
 return `<div class="career-results-table-wrap"><table><caption>Resultados da equipe por fase</caption><thead><tr><th scope="col">Fase</th><th scope="col">Posição</th><th scope="col">Pontos</th><th scope="col">Abates</th><th scope="col">Booyahs</th><th scope="col">Quedas</th></tr></thead><tbody>${stages.map(s=>`<tr><th scope="row">${esc(s.label)}${s.finished?'':' <small>(parcial)</small>'}</th><td>${s.champion&&s.finished?'🏆 ':''}${n(s.position)}${s.position?'º':''}</td><td>${n(s.points)}</td><td>${n(s.kills)}</td><td>${n(s.booyahs)}</td><td>${n(s.matches)}</td></tr>`).join('')}</tbody></table></div>`;
}
function rosterHtml(event){
 const label=r=>ROLES[r]||({'head coach':'Treinador principal',coach:'Treinador',Coach:'Treinador',Analyst:'Analista',analyst:'Analista',Analst:'Analista',analst:'Analista',Manager:'Manager',manager:'Manager','assistant coach':'Auxiliar técnico'})[r]||r||'Comissão';
 const group=(title,people)=>people?.length?`<div><h4>${title}</h4><ul>${people.map(p=>`<li><strong>${esc(p.name)}</strong><small>${esc(label(p.role))}</small></li>`).join('')}</ul></div>`:'';
 return event?.players?.length||event?.staff?.length?`<details class="career-results-roster"><summary>Elenco registrado nesta edição</summary><div>${group('Jogadores',event.players)}${group('Comissão',event.staff)}</div><p class="career-pro-muted">Lista histórica da edição. Pode incluir mudanças durante o torneio.</p></details>`:'<p class="career-pro-muted">Elenco desta edição ainda não cadastrado.</p>';
}
function recordHtml(record){
 const event=record.event,partial=record.periods.some(p=>p.partial||p.outside),roles=[...new Set(record.tenures.map(t=>ROLES[t.role]||t.role))];
 const periods=record.tenures.map((t,i)=>{
  const dates=[t.start?.date&&periodLabel({date:t.start.date}),t.end?.date&&periodLabel({date:t.end.date})].filter(Boolean).join(' → ');
  return `<p class="career-results-period${partial?' is-partial':''}">${esc(record.periods[i].label)}${dates?' · '+esc(dates):''}</p>`;
 }).join('');
 return `<details class="career-results-edition"><summary><span><strong>${esc(record.competition.name)}</strong><small>${esc(record.team)} · ${esc(roles.join(' / '))}</small></span><span class="career-results-placement">${esc(resultLabel(record))}${partial?'<small>Período parcial · ver detalhes</small>':''}</span></summary><div class="career-results-edition-body">${periods}${partial?'<p class="career-pro-muted">As posições abaixo são da equipe no torneio completo. O resumo considera finais e títulos apenas quando o vínculo permite atribuí-los.</p>':''}${event?.stages?.length?stageTable(event.stages):'<p class="career-pro-muted">Participação vinculada no cadastro. O resultado da equipe ainda não está disponível.</p>'}${rosterHtml(event)}<a class="career-results-team-link" href="${teamHref(record.teamPageName)}">Ver histórico de ${esc(record.team)} ↗</a>${event?.updatedAt?`<small class="career-pro-muted">Base atualizada em ${esc(event.updatedAt.split('-').reverse().join('/'))}</small>`:''}</div></details>`;
}
function evolutionHtml(records){
 const teams=new Map();
 for(const r of [...records].reverse()){if(!teams.has(r.team))teams.set(r.team,[]);teams.get(r.team).push(r);}
 return `<details class="career-results-evolution"><summary>Evolução por equipe <small>${teams.size} equipe(s)</small></summary>${[...teams].map(([team,rows])=>`<div><h4>${esc(team)}</h4><ol>${rows.map(r=>`<li><span>${esc(r.competition.name)}</span><strong>${esc(resultLabel(r))}</strong></li>`).join('')}</ol></div>`).join('')}</details>`;
}
async function loadRecords(person){
 const manifest=await json('manifest.json'),ids=new Set();
 for(const t of person.tenures||[])if(!t.deleted&&staffRole(t.role)&&t.competitions?.length){const id=manifest.aliases[key(t.teamId)]||manifest.aliases[key(t.teamName)];if(id&&manifest.teams[id])ids.add(id);}
 const snapshots=new Map(),queue=[...ids];let failed=0;
 // Keep parallel downloads bounded even for long careers.
 await Promise.all(Array.from({length:Math.min(3,queue.length)},async()=>{while(queue.length){const id=queue.shift(),file=manifest.teams[id];try{if(!/^[a-z0-9]+-[a-f0-9]{12}\.json$/.test(file))throw Error('Arquivo inválido');snapshots.set(id,await json(file));}catch{failed++;}}}));
 return {records:linkCoachResults(person,manifest,snapshots),failed};
}
export async function mountCoachResults(panel,person,{awards=false}={}){
 if(mounted.has(panel))return mounted.get(panel);
 const body=panel.querySelector('[data-career-results-body]');
 const job=(async()=>{
  body.innerHTML='<p role="status">Carregando resultados das equipes deste perfil…</p>';
  try{
   const {records:allRecords,failed}=await loadRecords(person);
   const records=awards?allRecords.filter(r=>r.periods.some(p=>p.awardEligible)&&r.event?.stages?.some(s=>s.finished&&(s.champion||s.isFinal))):allRecords;if(!panel.isConnected)return;
   const metrics=coachSummary(records);
   const select=(name,title,values)=>`<label>${title}<select data-results-filter="${name}"><option value="">Todos</option>${values.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></label>`;
   body.innerHTML=`<div class="career-results-metrics"><div><strong>${metrics.editions}</strong><span>Edições vinculadas</span></div><div><strong>${metrics.finals}</strong><span>Finais registradas</span></div><div><strong>${metrics.titles}</strong><span>Títulos da equipe</span></div><div><strong>${metrics.international}</strong><span>Internacionais</span></div></div><p class="career-pro-muted">Resultados das equipes nas edições vinculadas à atuação na comissão. Campos sem dados aparecem como “—”.${failed?' Parte dos resultados não pôde ser carregada. Os totais de finais e títulos estão incompletos.':''}</p>${records.length?`<div class="career-results-filters">${select('year','Ano',[...new Set(records.map(r=>r.year).filter(Boolean))].sort((a,b)=>b-a).map(y=>[y,y]))}${select('team','Equipe',[...new Set(records.map(r=>r.team))].sort().map(t=>[t,t]))}${select('family','Competição',[...new Set(records.map(r=>r.competition.family))].sort().map(f=>[f,({FFWS_BR:'FFWS BR',MUNDIAL:'Mundial'})[f]||f]))}</div><p class="career-results-count" aria-live="polite"></p><div data-results-list></div><div data-results-evolution></div>`:`<p class="career-pro-muted">${awards?'Nenhuma final ou título confirmado nas participações registradas.':'Nenhuma competição vinculada às passagens na comissão. O administrador pode selecioná-las ao editar cada passagem.'}</p>`}`;
   if(!records.length)return;
   const render=()=>{
    const filters=Object.fromEntries([...body.querySelectorAll('[data-results-filter]')].map(s=>[s.dataset.resultsFilter,s.value]));
    const shown=records.filter(r=>(!filters.year||String(r.year)===filters.year)&&(!filters.team||r.team===filters.team)&&(!filters.family||r.competition.family===filters.family));
    body.querySelector('.career-results-count').textContent=shown.length+' registro(s) neste filtro';
    body.querySelector('[data-results-list]').innerHTML=shown.map(recordHtml).join('')||'<p class="career-pro-muted">Nenhum resultado neste filtro.</p>';
    body.querySelector('[data-results-evolution]').innerHTML=shown.length?evolutionHtml(shown):'';
   };
   body.onchange=event=>{if(event.target.matches('[data-results-filter]'))render();};render();
   if(failed){const retry=document.createElement('button');retry.type='button';retry.textContent='Recarregar resultados indisponíveis';retry.addEventListener('click',()=>{mounted.delete(panel);mountCoachResults(panel,person);},{once:true});body.append(retry);}
  }catch{
   if(!panel.isConnected)return;
   body.innerHTML='<p role="status">Não foi possível carregar os resultados agora.</p><button type="button">Tentar novamente</button>';
   body.querySelector('button').addEventListener('click',()=>{mounted.delete(panel);mountCoachResults(panel,person);},{once:true});
  }
 })();mounted.set(panel,job);return job;
}
