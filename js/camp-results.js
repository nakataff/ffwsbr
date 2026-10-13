import {teamLogo,shortTeamName,streamUrl} from './camp-notification-content.js?v=20261010-results-v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountResults(root,{catalog,request,app}){
 let stopped=false,seq=0,data,view=new URLSearchParams(location.search).get('day')?'drop':'overall';const ids=Object.keys(catalog),query=new URLSearchParams(location.search);
 let tournament=ids.includes(query.get('tournament'))?query.get('tournament'):ids[0];
 root.innerHTML='<section class="cff-results"><div class="cff-results-heading"><div><h3>Quedas e classificação</h3><p>Escolha uma queda oficial ou publicada para ver os resultados e o acumulado.</p></div><button type="button" class="cff-account-button" data-refresh>Atualizar</button></div><div class="cff-results-selectors"><label>Torneio<select data-tournament>'+ids.map(id=>'<option value="'+esc(id)+'">'+esc(catalog[id].name)+'</option>').join('')+'</select></label><label>Escolher queda disponível<select data-match aria-label="Escolher queda disponível"><option value="">Carregando quedas…</option></select></label></div><div data-results-status role="status"></div><div data-results-body></div></section>';
 const tournamentSelect=root.querySelector('[data-tournament]'),matchSelect=root.querySelector('[data-match]'),status=root.querySelector('[data-results-status]'),body=root.querySelector('[data-results-body]'),refresh=root.querySelector('[data-refresh]');
 if(tournament)tournamentSelect.value=tournament;
 function summary(s){return (s.status==='official'?'Oficial':'Parcial')+' - Q'+s.drop+' • '+[...s.rows].sort((a,b)=>b.points-a.points).map(r=>shortTeamName(r.team,r.teamId)+': '+r.points+' pts').join(' • ');}
 function rowName(r,full=false){const logo=teamLogo(r.team,r.teamId,data.teams?.[r.teamId]?.logo);return '<span class="cff-result-team">'+(logo?'<img loading="lazy" src="'+esc(logo)+'" alt="">':'')+'<span title="'+esc(r.team)+'">'+esc(full?r.team:shortTeamName(r.team,r.teamId))+'</span></span>';}
 function render(){
  const s=data?.selected;if(!s){body.innerHTML='<p class="cff-profile-muted">Esta queda ainda não tem resultados disponíveis. Quedas oficiais do Admin Dados aparecem automaticamente; tabelas parciais podem ser publicadas pelo Camp ao vivo.</p>';return;}
  const finished=data.tournamentState?.finished===true,champ=data.tournamentState?.champion;
  const finalView=finished&&s.day===data.tournamentState.closingMatch?.day&&s.drop===data.tournamentState.closingMatch?.drop;
  const isDrop=view==='drop',totals=view==='day'?data.dayTotals:data.overall;
  const rowMap=new Map(s.rows.map(r=>[r.teamId,r]));
  const rows=isDrop?s.participants.map(id=>rowMap.get(id)||{teamId:id,team:data.teams?.[id]?.name||id,position:null,kills:null,points:null}).sort((a,b)=>(a.position??999)-(b.position??999)):totals?.rows||[];
  const overallPartial=totals?.status!=='official',partial=isDrop?s.status!=='official':overallPartial;
  const when=s.at?new Date(s.at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
  const watch=streamUrl(data.streamUrl);
  body.innerHTML=(finished?'<section class="cff-tournament-finished"><span>Torneio encerrado</span><h3>'+esc(catalog[tournament]?.name||'Resultado final')+'</h3>'+(champ?'<div>'+rowName(champ,true)+'<strong>CAMPEÃO</strong></div>':'')+'<p>Confira a classificação acumulada e reveja todas as quedas.</p></section>':'')+'<div class="cff-results-caption"> <span class="cff-result-label '+(partial?'':'official')+'">'+(partial?'PARCIAL':'OFICIAL')+'</span><strong>'+(view==='overall'&&finalView?'Classificação final · até ':'')+'DIA '+s.day+' / QUEDA '+s.drop+(s.map?' · '+esc(s.map):'')+'</strong><small>Atualizado '+esc(when)+' · revisão '+s.revision+'</small></div><details class="cff-result-summary"><summary>Resumo da queda</summary><p>'+esc(summary(s))+'</p><button type="button" class="cff-account-button" data-copy-summary>Copiar resumo</button></details><div class="cff-results-tabs" role="tablist" aria-label="Tabela de resultados">'+[['overall',finalView?'Classificação final':'Classificação geral'],['day','No dia'],['drop','Nesta queda']].map(([v,label])=>'<button type="button" role="tab" aria-selected="'+(view===v)+'" data-table="'+v+'">'+label+'</button>').join('')+'</div><div class="cff-results-table-wrap"><table class="cff-results-table"><thead><tr><th>'+(isDrop?'POS':'#')+'</th><th>TIME</th>'+(isDrop?'':'<th>B!</th>')+'<th>K</th><th>PTS</th></tr></thead><tbody>'+rows.map(r=>'<tr class="'+(r.points===null||(!isDrop&&!r.matches)?'is-pending':'')+'"><td>'+(isDrop?(r.position??'—'):r.rank)+'</td><td>'+rowName(r)+'</td>'+(isDrop?'':'<td>'+r.booyahs+'</td>')+'<td>'+(r.kills??'—')+'</td><td><strong>'+(r.points??'—')+'</strong></td></tr>').join('')+'</tbody></table></div><p class="cff-notify-help">'+(isDrop&&!s.complete?'Há times ainda sem resultado preenchido. ':'')+(partial?'Pontuação parcial, sujeita a correção. Só vira oficial após T1 + P1.':'Resultado confirmado pelo T1 + P1.')+' '+(view==='overall'?'Geral acumulada até esta queda.':view==='day'?'Acumulado deste dia até esta queda.':'K = abates.')+'</p>'+(watch?'<a class="cff-account-button" href="'+esc(watch)+'" target="_blank" rel="noopener">Assistir à transmissão ↗</a>':'');
 }
 async function load(day,drop){
  if(!tournament){status.textContent='Nenhum torneio foi habilitado ainda.';refresh.disabled=true;return;}
  const current=++seq;refresh.disabled=true;status.textContent='Carregando resultados…';
  try{const result=await request('results',{tournamentId:tournament,...(day?{day,drop}:{})},app);if(stopped||current!==seq||!root.isConnected)return;data=result;
   const available=[...(data.matches||[])].reverse(),latest=available[0];matchSelect.disabled=!latest;
   matchSelect.innerHTML='<option value="">'+(latest?'Mais recente · Dia '+latest.day+' · Queda '+latest.drop:'Nenhuma queda publicada')+'</option>'+available.map(s=>'<option value="'+s.day+':'+s.drop+'">Dia '+s.day+' · Queda '+s.drop+(s.map?' · '+esc(s.map):'')+'</option>').join('');
   if(day&&Array.from(matchSelect.options).some(o=>o.value===day+':'+drop))matchSelect.value=day+':'+drop;
   if(data.tournamentState?.finished&&data.overall?.rows){const championId=data.tournamentState.champion?.teamId;if(championId&&data.overall.rows.some(r=>r.teamId===championId)&&data.selected?.day===data.tournamentState.closingMatch?.day&&data.selected?.drop===data.tournamentState.closingMatch?.drop){data.overall.rows.sort((a,b)=>Number(b.teamId===championId)-Number(a.teamId===championId)||a.rank-b.rank);data.overall.rows.forEach((r,i)=>r.rank=i+1);}}
   root.dataset.finished=String(data.tournamentState?.finished===true);root.dispatchEvent(new CustomEvent('cff:results-state',{bubbles:true,detail:{finished:data.tournamentState?.finished===true,tournament}}));
   status.textContent=data.officialSyncUnavailable?'Não foi possível atualizar os dados oficiais agora. Exibindo os resultados já disponíveis.':'';render();
  }catch(e){if(!stopped&&current===seq)status.textContent=e.message;}finally{if(!stopped&&current===seq)refresh.disabled=false;}
 }
 const selection=()=>{const [d,q]=matchSelect.value.split(':').map(Number);load(d,q);};
 tournamentSelect.onchange=()=>{tournament=tournamentSelect.value;matchSelect.value='';load();};matchSelect.onchange=selection;refresh.onclick=selection;
 root.addEventListener('click',async e=>{const tab=e.target.closest('[data-table]');if(tab){view=tab.dataset.table;render();}if(e.target.closest('[data-copy-summary]'))try{await navigator.clipboard.writeText(summary(data.selected));status.textContent='Resumo copiado.';}catch{status.textContent='Não foi possível copiar o resumo.';}});
 load(Number(query.get('day')),Number(query.get('drop')));
 return()=>{stopped=true;seq++;};
}
