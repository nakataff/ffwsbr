(()=>{'use strict';
function profilePage(p,h){
 const {BASE,esc,photo,logo,flag,breadcrumb,stageOptions,href}=h,t=p.team,teamUrl=BASE+'equipe?time='+encodeURIComponent(t.id);
 const teammates=(p.peers||[]).map(other=>`<a class="gp-peer" href="${href(other.id)}">${photo(other)}<span class="gp-peer-info"><strong>${esc(other.name)}</strong><small>${flag(other.country)} ${esc(other.role||'Jogador')}</small></span><span class="gp-peer-arrow" aria-hidden="true">↗</span></a>`).join('');
 const fixtures=(p.fixtures||[]).slice().sort((a,b)=>String(a.date+a.time).localeCompare(String(b.date+b.time)));
 const future=fixtures.filter(f=>Date.parse(f.date+'T'+f.time+':00-03:00')>Date.now()),visible=future.length?future.slice(0,3):fixtures.slice(-3);
 const rest=fixtures.filter(f=>!visible.includes(f));
 const renderFixture=f=>`<div class="gp-fixture${future[0]===f?' is-next':''}"><time datetime="${esc(f.date+'T'+f.time)}"><b>${esc(f.date.slice(8,10))}</b><small>${esc(f.date.slice(5,7))}/2026</small></time><span><strong>${esc(f.label||'Confronto')}</strong><small>Grupos ${esc((f.groups||[]).join(' × '))} · ${esc(f.time)} (Brasília)</small></span>${future[0]===f?'<em>PRÓXIMA</em>':''}</div>`;
 return `${breadcrumb(p.name)}<section class="ffws-global-hero gp-hero gp-player-hero">
  <div class="gp-player-hero-grid"><div class="gp-player-hero-copy"><span class="gp-overline">FFWS GLOBAL FINALS 2026</span><div class="gp-hero-eyebrow">PERFIL DO JOGADOR</div><h1>${esc(p.name)}</h1>
   <div class="gp-identity"><span>${flag(p.country)} ${esc(p.role||'Função a confirmar')}</span><span class="gp-group-pill">GRUPO ${esc(t.group||'—')}</span></div>
   <a class="gp-team-identity" href="${teamUrl}">${logo(t)}<span><small>EQUIPE</small><strong>${esc(t.name)}</strong></span><b aria-hidden="true">↗</b></a>
   <p class="gp-hero-note">Estatísticas, recordes e evolução do atleta na edição de 2026.</p>
  </div><div class="gp-hero-art"><img class="gp-hero-watermark" src="${esc(h.safeImage(t.logo)||'/escudo.webp')}" alt="" aria-hidden="true" loading="lazy">${photo(p,true)}<span>${esc(t.abbreviation||t.name)} · FFWS 2026</span></div></div>
  <div class="gp-actions gp-player-actions"><button type="button" class="gp-primary" data-action="card">Criar card</button><button type="button" data-action="compare">Comparar jogadores</button><button type="button" data-action="share">Compartilhar perfil</button>${p.generalId?`<a class="gp-button" href="/jogador.html?id=${encodeURIComponent(p.generalId)}">Perfil completo da carreira ↗</a>`:''}</div><p class="gp-status" data-status role="status"></p></section>
  <section class="gp-performance-band"><div class="gp-band-top"><div><span class="gp-overline">DESEMPENHO INDIVIDUAL</span><h2>Números do Mundial</h2></div><label class="gp-stage">Selecionar etapa<select data-stage>${stageOptions()}</select></label></div><div class="gp-stats" data-stats></div></section>
  <div class="gp-layout"><div><section class="gp-panel gp-player-data-panel"><div class="gp-tabs" role="tablist" aria-label="Dados do jogador">${[['summary','Visão geral'],['evolution','Evolução'],['history','Rodadas e quedas'],['team','Campanha da equipe']].map(([key,text])=>`<button type="button" role="tab" id="gp-tab-${key}" aria-controls="gp-pane" data-tab="${key}" aria-selected="${key==='summary'}" tabindex="${key==='summary'?0:-1}">${text}</button>`).join('')}</div><div id="gp-pane" role="tabpanel" aria-labelledby="gp-tab-summary"></div></section>
  <section class="gp-panel gp-teammates"><div class="gp-section-title"><span class="gp-overline">ELENCO</span><h2>Companheiros no Mundial</h2><p>Os outros quatro jogadores da equipe.</p></div><div class="gp-peers">${teammates}</div></section></div>
  <aside class="gp-profile-sidebar"><section class="gp-panel gp-agenda-panel"><div class="gp-section-title"><span class="gp-overline">FASE 1 · 2026</span><h2>Calendário da equipe</h2><p>${future.length?'Próximas rodadas':'Jogos programados'}</p></div><div class="gp-fixtures">${visible.map(renderFixture).join('')}</div>${rest.length?`<details class="gp-more-fixtures"><summary>Ver mais ${rest.length} rodada${rest.length>1?'s':''}</summary><div class="gp-fixtures">${rest.map(renderFixture).join('')}</div></details>`:''}<p class="gp-subtle">Horário de Brasília. Fases futuras dependem da classificação.</p><a class="gp-inline-link" href="${BASE}datas">Calendário completo →</a></section><section class="gp-panel gp-more-links"><span class="gp-overline">EXPLORAR</span><h2>Mais sobre o Mundial</h2><a href="${teamUrl}">Campanha da ${esc(t.name)} →</a><a href="${BASE}stats">Estatísticas completas →</a><a href="${BASE}jogadores">Todos os jogadores →</a></section></aside></div>
  <p class="gp-subtle gp-profile-source">Dados exclusivos desta edição · atualizado em ${esc(String(p.updatedAt||'').split('-').reverse().join('/')||'—')}. “—” significa dado não disponível, não zero.</p>`;
}
function mainStats(p,stage,h){
 const s=p.stats?.[stage],rank=p.ranks?.[stage],values=[['ABATES',h.fmt(s?.kills),'Eliminações registradas'],['QUEDAS',h.fmt(s?.matches),'Partidas disputadas'],['ABATES / QUEDA',h.avg(s?.average),'Média individual'],['RANKING',rank>0?'#'+h.fmt(rank):'—','Posição em abates']];
 return values.map(([name,num,sub],i)=>`<div class="gp-stat${i===0?' gp-stat-featured':''}"><span>${name}</span><strong>${num}</strong><small>${sub}</small></div>`).join('');
}
function summary(p,stage,h){
 const {esc,fmt,avg,recordLabel,label,empty}=h,s=p.stats?.[stage],highlights=p.highlights?.[stage]||{},drop=highlights.drop,round=highlights.round;
 if(!s)return `<div class="gp-section-title"><span class="gp-overline">VISÃO GERAL</span><h2>${esc(label(stage))}</h2></div>${empty('Ainda não há resultados confirmados nesta etapa.')}`;
 const spots=(type,record,name)=>record?`<article class="gp-record-card"><span class="gp-overline">${name}</span><strong>${fmt(record.kills)} <small>abates</small></strong><p>${esc(recordLabel(record))}${record.map?' · '+esc(record.map):''}</p><button type="button" data-action="highlight-card" data-highlight="${type}">Criar card desta atuação ↗</button></article>`:'';
 const measures=[['DANO TOTAL',fmt(s.damage),s.matches&&s.damage!=null?'Média '+avg(s.damage/s.matches)+' /queda':'Média indisponível'],['ASSISTÊNCIAS',fmt(s.assists),s.matches&&s.assists!=null?'Média '+avg(s.assists/s.matches)+' /queda':'Média indisponível']];
 return `<div class="gp-section-title"><span class="gp-overline">${esc(label(stage)).toUpperCase()}</span><h2>Desempenho individual</h2><p>Dano e assistências registrados no recorte.</p></div><div class="gp-secondary-stats">${measures.map(([title,note,details])=>`<div class="gp-secondary-stat"><small>${title}</small><strong>${note}</strong><span>${details}</span></div>`).join('')}</div>
 <div class="gp-section-title gp-section-split"><div><span class="gp-overline">MELHORES ATUAÇÕES</span><h3>Destaques do jogador</h3></div><button type="button" data-action="go-evolution">Ver evolução →</button></div>
 ${drop||round?`<div class="gp-record-grid">${spots('drop',drop,'MELHOR QUEDA')}${spots('round',round,'MELHOR RODADA')}</div>`:'<p class="gp-subtle">Destaques disponíveis quando houver registros detalhados por queda ou rodada.</p>'}
 <section class="gp-benchmark"><span class="gp-overline">CONTEXTO COMPETITIVO</span><h3>Em relação à média do Mundial</h3><p>Compare abates por queda no mesmo recorte. O índice estático é consultado apenas quando você solicitar.</p><button type="button" data-action="benchmark">Comparar com a média</button><div data-benchmark-result class="gp-benchmark-result" aria-live="polite"></div></section>`;
}
function evolutionData(p,stage,group,metric){
 const grouped=new Map();
 for(const r of p.rounds||[]){
  if(stage!=='geral'&&r.stage!==stage)continue;
  const key=group==='day'?`${r.stage}|${r.date||r.day}`:`${r.stage}|${r.date||r.day}|${r.round||''}`;
  if(!grouped.has(key)){
   const date=r.date?r.date.slice(8,10)+'/'+r.date.slice(5,7):'Dia '+(r.day||'—');
   grouped.set(key,{label:group==='day'?date:(r.round?'R'+r.round+' · '+date:date),date:r.date||'',day:r.day||0,round:r.round||0,matches:0,value:0,known:false});
  }
  const item=grouped.get(key);item.matches+=Number(r.matches)||0;
  if(r[metric]!=null){item.value+=Number(r[metric])||0;item.known=true;}
 }
 return [...grouped.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.day-b.day||a.round-b.round);
}
function evolution(p,stage,h,group='round',metric='kills'){
 const {esc,fmt,empty}=h,rows=evolutionData(p,stage,group,metric),max=Math.max(0,...rows.map(r=>r.known?r.value:0));
 if(!rows.length)return `<div class="gp-section-title"><span class="gp-overline">EVOLUÇÃO</span><h2>Por rodada e dia</h2></div>${empty('Ainda não há rodadas publicadas nesta etapa para montar o gráfico.')}`;
 const label={kills:'Abates',damage:'Dano',assists:'Assistências'}[metric]||'Abates';
 return `<div class="gp-section-title"><span class="gp-overline">ANÁLISE INDIVIDUAL</span><h2>Evolução no Mundial</h2><p>Dados já publicados, sem buscas adicionais.</p></div><div class="gp-chart-options"><label>Métrica<select data-evolution-metric><option value="kills"${metric==='kills'?' selected':''}>Abates</option><option value="damage"${metric==='damage'?' selected':''}>Dano</option><option value="assists"${metric==='assists'?' selected':''}>Assistências</option></select></label><label>Período<select data-evolution-group><option value="round"${group==='round'?' selected':''}>Por rodada</option><option value="day"${group==='day'?' selected':''}>Por dia</option></select></label></div>
 <div class="gp-chart-scroll"><div class="gp-chart" role="img" aria-label="${esc(label)} ${group==='day'?'por dia':'por rodada'}">${rows.map(r=>`<div class="gp-chart-col"><strong>${r.known?fmt(r.value):'—'}</strong><div class="gp-chart-track"><div class="gp-chart-bar${r.known?'':' is-missing'}" style="height:${r.known&&max?Math.max(3,Math.round(r.value/max*100)):0}%"></div></div><span>${esc(r.label)}</span><small>${fmt(r.matches)} quedas</small></div>`).join('')}</div></div><p class="gp-subtle">Colunas representam apenas resultados conhecidos. “—” indica dado ausente; zero registrado continua zero.</p>`;
}
function campaign(p,stage,h){
 const phases=stage==='geral'?[['classificatoria','Fase 1'],['segundaFase','Fase 2'],['lastChance','Repescagem'],['final','Grande Final']]:[[stage,h.label(stage)]];
 return `<div class="gp-section-title"><span class="gp-overline">DESEMPENHO COLETIVO</span><h2>Campanha da ${h.esc(p.team.name)}</h2><p>Os pontos, os Booyahs e as colocações são resultados da equipe.</p></div><div class="gp-team-campaign">${phases.map(([key,label])=>{
  const data=p.campaign?.[key]||{},stats=data.stats;
  return `<article class="gp-team-phase"><span class="gp-overline">${h.esc(label)}</span>${stats?`<div class="gp-team-metrics"><div><strong>${h.fmt(stats.points)}</strong><small>PONTOS</small></div><div><strong>${h.fmt(stats.kills)}</strong><small>ABATES</small></div><div><strong>${h.fmt(stats.booyahs)}</strong><small>BOOYAHS</small></div></div>`:'<p class="gp-subtle">Resultados ainda não disponíveis nesta fase.</p>'}${key==='segundaFase'?`<p class="gp-subtle">A classificação independente de cada dia reinicia os pontos.</p>${(data.days||[]).map(d=>`<div class="gp-team-day"><span>Dia ${h.esc(d.day)}</span><strong>${d.position>0?h.fmt(d.position)+'º':'—'} · ${h.fmt(d.points)} pontos</strong></div>`).join('')}`:data.position>0?`<p class="gp-team-position">Colocação: <strong>${h.fmt(data.position)}º</strong></p>`:''}</article>`;
 }).join('')}</div><a class="gp-inline-link" href="${h.BASE}equipe?time=${encodeURIComponent(p.teamId)}">Ver desempenho completo da equipe →</a>`;
}
async function benchmark(p,stage,indexLoader,node,h){
 const s=p.stats?.[stage];if(!s){node.textContent='Sem dados nesta etapa.';return;}
 node.textContent='Calculando a média do Mundial…';
 try{
  const index=await indexLoader();if(!node.isConnected)return;
  const values=(index.players||[]).map(v=>v.stats?.[stage]).filter(v=>Number(v?.matches)>0&&v.kills!=null);
  const k=values.reduce((n,v)=>n+Number(v.kills),0),m=values.reduce((n,v)=>n+Number(v.matches),0);
  if(!m||!s.matches||s.kills==null){node.textContent='Dados insuficientes para comparar nesta etapa.';return;}
  const own=s.kills/s.matches,mean=k/m,diff=own-mean,formatted=(diff>0?'+':'')+h.avg(diff);
  node.innerHTML=`<div class="gp-benchmark-values"><div><small>${h.esc(p.name)}</small><strong>${h.avg(own)}</strong><span>abates / queda</span></div><div><small>Média de ${values.length} participantes</small><strong>${h.avg(mean)}</strong><span>abates / queda</span></div><div class="${diff>=0?'is-above':'is-below'}"><small>Diferença</small><strong>${formatted}</strong><span>abates / queda</span></div></div><p class="gp-subtle">Média ponderada pelos jogos registrados dos atletas na etapa selecionada.</p>`;
 }catch{if(node.isConnected)node.textContent='Não foi possível calcular a comparação agora.';}
}
window.CFFWorldPlayerUI=Object.freeze({profilePage,mainStats,summary,evolution,campaign,benchmark});
})();