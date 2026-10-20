const root=document.getElementById('annual-ranking');
const VERSION='20261020-annual-editor-v1';
const params=new URLSearchParams(location.search);
const YEARS=[2026,2025];
const state={year:YEARS.includes(Number(params.get('ano')))?Number(params.get('ano')):2026,view:params.get('visao')==='competicoes'?'competicoes':'total',search:(params.get('busca')||'').slice(0,80)};
let data=null,requestId=0,opener=null;
const cache=new Map();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const query=s=>root.querySelector(s),fmt=v=>Number(v||0).toLocaleString('pt-BR');
const competitionCount=n=>`${n} ${n===1?'competição':'competições'}`;
const events=()=>data.events.filter(e=>e.status==='finished');
const result=(row,id)=>row.results.find(r=>r.event===id);
const pointsFor=(event,pos)=>data.pointsByEvent?.[event.id]?.[pos-1]??data.basePoints[pos-1]*event.weight;
const filtered=()=>data.rows.filter(r=>norm(r.team).includes(norm(state.search)));
function logo(src){return src&&!/[:\\]|^\/\//.test(src)&&!src.split('/').includes('..')?'/'+src.replace(/^\//,''):'/escudo.webp';}
function image(row){return `<img src="${esc(logo(row.logo))}" alt="" width="36" height="36" loading="lazy" decoding="async" data-team-logo="${esc(row.team)}" data-annual-logo>`;}
function sourceLink(event){try{const u=new URL(event.source,location.origin);return u.origin===location.origin||u.protocol==='https:'?esc(u.href):'#';}catch(_){return '#';}}
function url(view=state.view){const u=new URL('/ranking-anual.html',location.origin);u.searchParams.set('ano',String(state.year));u.searchParams.set('visao',view);if(state.search)u.searchParams.set('busca',state.search);return u.href;}
function yearPicker(){return `<label class="annual-year">Temporada<select data-annual-year aria-label="Ano do ranking">${YEARS.map(y=>`<option value="${y}" ${y===state.year?'selected':''}>Brasil ${y}</option>`).join('')}</select></label>`;}
function layout(){
  const pending=data.events.filter(e=>e.status!=='finished');
  root.innerHTML=`<header class="annual-hero"><div><span class="annual-kicker">HISTÓRICO · METODOLOGIA CFF V${data.methodVersion}</span><h1>Ranking anual <span>${data.year}</span></h1><p>As equipes do Brasil, campeonato por campeonato.</p><div class="annual-meta"><span>Brasil</span><span>${data.rows.length} equipes</span><span>${events().length} competições concluídas</span><span class="annual-partial">${data.partial?'Parcial do ano':'Ano encerrado'}</span></div></div><div class="annual-hero-controls">${yearPicker()}<div class="annual-actions"><button type="button" class="annual-primary" data-annual-share>↗ Criar card</button><button type="button" data-annual-link>Copiar link</button></div></div></header><p class="annual-feedback" role="status" aria-live="polite"></p><section class="annual-podium" aria-label="Líderes do ano">${data.rows.slice(0,3).map(r=>`<article class="annual-podium-item annual-podium-${r.rank}"><span class="annual-medal">${r.rank}º</span>${image(r)}<div><strong>${esc(r.team)}</strong><small>${competitionCount(r.results.length)} disputadas</small></div><b>${fmt(r.total)}<small>pontos CFF</small></b></article>`).join('')}</section><section class="annual-panel" aria-labelledby="annual-table-title"><div class="annual-toolbar"><div><h2 id="annual-table-title">Classificação ${data.year}</h2><p id="annual-count" role="status" aria-live="polite"></p></div><div class="annual-view" role="group" aria-label="Visualização do ranking"><button type="button" data-annual-view="total">Só total</button><button type="button" data-annual-view="competicoes">Por competição</button></div></div><div class="annual-tools"><label class="annual-search">Buscar equipe<input type="search" maxlength="80" value="${esc(state.search)}" placeholder="Ex.: LOUD, Fluxo, LOS…" data-annual-search></label><p>Toque no nome da equipe para ver a campanha completa.</p></div><div class="annual-table-wrap" id="annual-table"></div><p class="annual-footnote">— Não disputou · Cada torneio conta uma vez · As posições empatadas são mantidas</p></section>${pending.length?`<aside class="annual-upcoming"><span>Próxima competição</span><strong>${esc(pending[0].name)}</strong><small>Peso ×${pending[0].weight} · entra no cálculo após o encerramento</small><a href="${sourceLink(pending[0])}">Acompanhar o torneio →</a></aside>`:''}<details class="annual-method annual-panel"><summary><span>Como calculamos o ranking</span><span aria-hidden="true">⌄</span></summary><div><p><strong>Pontos CFF = pontos base da colocação × peso do campeonato, salvo quando houver um valor específico definido para a competição.</strong> O total anual soma as competições disputadas pela equipe.</p><p><strong>Pontuação atual:</strong> ${data.basePoints[0]}, ${data.basePoints[1]} e ${data.basePoints[2]} pontos base para 1º, 2º e 3º. As faixas de colocação e os pesos abaixo determinam o valor de cada resultado e podem ser atualizados entre versões da metodologia.</p><div class="annual-weights">${data.events.map(e=>`<a href="${sourceLink(e)}"><span>${esc(e.name)}</span><strong>×${e.weight}</strong><small>${e.status==='finished'?'Concluído':'Ainda não contabilizado'}${data.pointsByEvent?.[e.id]?' · Pontos personalizados':''}</small></a>`).join('')}</div><div class="annual-base"><h3>Pontuação atual por competição</h3><table><thead><tr><th>Colocação</th><th>Base</th>${data.events.map(e=>`<th>${esc(e.label)}</th>`).join('')}</tr></thead><tbody>${[[1,1],[2,2],[3,3],[4,4],[5,6],[7,8],[9,10],[11,12],[13,18],[19,24]].map(([a,b])=>`<tr><td>${a===b?a+'º':a+'º–'+b+'º'}</td><td>${data.basePoints[a-1]}</td>${data.events.map(e=>`<td>${fmt(pointsFor(e,a))}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>Consideramos a classificação final oficial de cada torneio. No Champion Rush, o campeão mantém o 1º lugar mesmo que outra equipe tenha mais pontos de partida. As fases anteriores só definem a colocação de quem foi eliminado antes da final.</p><p><strong>Desempate:</strong> melhor colocação no Global Finals, depois na EWC e, em seguida, mais títulos de WB no ano. Persistindo a igualdade, as equipes dividem a posição.</p><p>Variações como LOUD/LOUD Snickers e LOS/MIBR LOS são somadas. Resultados pertencem à equipe que os conquistou; uma transferência de jogadores não transfere os pontos para outra organização.</p><p class="annual-footnote">Metodologia própria da Central Free Fire · versão ${data.methodVersion} · atualizado em ${data.updatedAt.split('-').reverse().join('/')}</p></div></details><dialog class="annual-dialog" aria-labelledby="annual-campaign-title"><div id="annual-campaign"></div><button type="button" class="annual-close" data-annual-close aria-label="Fechar campanha">×</button></dialog>`;
  render(false);
}
function render(sync=true){
  const rows=filtered(),detail=state.view==='competicoes';
  query('#annual-table').classList.toggle('annual-odd-events',events().length%2===1);
  root.querySelectorAll('[data-annual-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.annualView===state.view)));
  query('#annual-count').textContent=`${rows.length} de ${data.rows.length} equipes${state.search?' · resultados da busca':''}`;
  query('[data-annual-share]').disabled=!rows.length;
  query('#annual-table').innerHTML=rows.length?`<table class="annual-table ${detail?'annual-detailed':'annual-total'}"><caption class="annual-sr">Ranking anual CFF ${data.year} · Brasil · ${detail?'Pontos por competição':'Pontuação total'}</caption><thead><tr><th scope="col">#</th><th scope="col">Equipe</th>${detail?events().map(e=>`<th scope="col">${esc(e.label)}<small>Peso ×${e.weight}</small></th>`).join(''):''}<th scope="col">Total CFF</th></tr></thead><tbody>${rows.map(row=>`<tr><td class="annual-rank">${row.rank}º</td><th scope="row"><button type="button" class="annual-team" data-annual-team="${esc(row.team)}" aria-label="Ver campanha de ${esc(row.team)}">${image(row)}<span>${esc(row.team)}<small>${competitionCount(row.results.length)}</small></span><span class="annual-open" aria-hidden="true">↗</span></button></th>${detail?events().map(e=>{const r=result(row,e.id);return `<td class="annual-event"><span class="annual-mobile-label">${esc(e.label)} · ×${e.weight}</span><strong>${r?fmt(r.points):'—'}</strong><small>${r?r.position+'º lugar':'Não disputou'}</small></td>`;}).join(''):''}<td class="annual-total-value"><strong>${fmt(row.total)}</strong><small class="annual-mobile-label">pontos CFF</small></td></tr>`).join('')}</tbody></table>`:'<p class="annual-empty">Nenhuma equipe encontrada. <button type="button" data-annual-clear>Limpar busca</button></p>';
  if(sync)history.replaceState(history.state,'',url());
}
function campaign(team,button){
  const row=data.rows.find(r=>r.team===team);if(!row)return;
  opener=button;
  query('#annual-campaign').innerHTML=`<div class="annual-campaign-head">${image(row)}<div><span class="annual-kicker">${row.rank}º NO RANKING · ${data.year}</span><h2 id="annual-campaign-title">${esc(row.team)}</h2><p>${fmt(row.total)} pontos CFF</p></div></div><div class="annual-campaign-events">${events().map(e=>{const r=result(row,e.id);return `<article><div><strong>${esc(e.name)}</strong><small>${r?r.position+'º lugar · '+(data.pointsByEvent?.[e.id]?'pontuação personalizada da competição':data.basePoints[r.position-1]+' pontos base × peso '+e.weight):'Não disputou esta competição'}</small></div><b>${r?fmt(r.points):'—'}</b></article>`;}).join('')}</div><p class="annual-footnote">${row.results.map(r=>r.points).join(' + ')} = ${row.total} pontos CFF</p>`;
  query('dialog').showModal();
}
function closeCampaign(){query('dialog').close();opener?.focus();}
function cardPayload(){
  const rows=filtered().map(r=>({rank:r.rank,name:r.team,team:r.team,logo:window.cffCareerTeamIdentity?.(r.team)?.logo||r.logo,points:r.total,annualValues:events().map(e=>result(r,e.id)?.points??null)}));
  const make=view=>({id:`ranking-brasil-${data.year}-${view}`,kind:'teams',mode:'annual',title:'Ranking anual CFF',event:`Brasil ${data.year}`,stage:`${view==='competicoes'?'Por competição':'Pontuação total'} · ${data.partial?'Parcial do ano':'Ano encerrado'} · Método v${data.methodVersion}`,updatedAt:data.updatedAt,metric:'points',url:url(view),annualColumns:view==='competicoes'?events().map(e=>e.label):[],rows});
  return {views:['total','competicoes'].map(id=>({id,...make(id)})),viewId:`ranking-brasil-${data.year}-${state.view}`};
}
async function share(button){
  button.disabled=true;const id=requestId;
  try{const payload=cardPayload();const {openRankingCard}=await import('/js/ranking-share-cards.mjs?v=20261020-cards-v6');if(id!==requestId||!data)return;await openRankingCard(payload);}
  catch(error){if(id===requestId&&query('.annual-feedback'))query('.annual-feedback').textContent=error.message||'Não foi possível abrir o editor. Tente novamente.';}
  finally{if(button.isConnected&&data)button.disabled=!filtered().length;}
}
async function boot(year=state.year){
  if(!YEARS.includes(year))return;
  const id=++requestId,focusYear=document.activeElement?.hasAttribute('data-annual-year');
  state.year=year;data=null;opener=null;
  history.replaceState(history.state,'',url());
  document.title=`Ranking anual · Brasil ${year} | Central Free Fire`;
  root.setAttribute('aria-busy','true');
  root.innerHTML=`<div class="annual-loading">${yearPicker()}<p class="annual-empty" role="status">Carregando o ranking de ${year}…</p></div>`;
  if(focusYear)query('[data-annual-year]').focus();
  try{
    if(!cache.has(year))cache.set(year,(async()=>{
      const r=await fetch(`/ranking-data/brasil-${year}.json?v=${VERSION}`,{cache:'no-cache'});if(!r.ok)throw Error();
      const value=await r.json();if(value.year!==year||!Array.isArray(value.rows)||!Array.isArray(value.events))throw Error();return value;
    })().catch(error=>{cache.delete(year);throw error;}));
    const value=await cache.get(year);if(id!==requestId)return;
    data=value;layout();if(focusYear)query('[data-annual-year]').focus();
  }catch(_){
    if(id!==requestId)return;
    root.innerHTML=`<div class="annual-loading">${yearPicker()}<p class="annual-empty" role="status">Não foi possível carregar o ranking de ${year}. <button type="button" data-annual-retry>Tentar novamente</button></p></div>`;
    if(focusYear)query('[data-annual-year]').focus();
  }finally{if(id===requestId)root.removeAttribute('aria-busy');}
}
if(root){
  root.addEventListener('click',async event=>{
    const b=event.target.closest('button');
    if(b?.hasAttribute('data-annual-retry')){boot();return;}
    if(!data)return;
    if(b?.dataset.annualView){state.view=b.dataset.annualView;render();}
    else if(b?.dataset.annualTeam)campaign(b.dataset.annualTeam,b);
    else if(b?.hasAttribute('data-annual-close'))closeCampaign();
    else if(b?.hasAttribute('data-annual-share'))share(b);
    else if(b?.hasAttribute('data-annual-link')){try{await navigator.clipboard.writeText(url());query('.annual-feedback').textContent='Link copiado! A visualização e a busca acompanham o link.';}catch(_){query('.annual-feedback').textContent='Copie o endereço da página na barra do navegador.';}}
    else if(b?.hasAttribute('data-annual-clear')){state.search='';query('[data-annual-search]').value='';render();}
    if(event.target===query('dialog'))closeCampaign();
  });
  root.addEventListener('change',event=>{if(event.target.matches('[data-annual-year]'))boot(Number(event.target.value));});
  root.addEventListener('input',event=>{if(event.target.matches('[data-annual-search]')){state.search=event.target.value;render();}});
  root.addEventListener('error',event=>{const img=event.target;if(img.matches?.('[data-annual-logo]')){delete img.dataset.annualLogo;img.src='/escudo.webp';}},true);
  boot();
}
