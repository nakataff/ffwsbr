/* LAFF views reuse the existing static stage cache. No live API or polling. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),V='20261029-laff-pages-v2';
 const phases={classificatoria:'Classificatória',repescagem:'Repescagem',final:'Final'};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const key=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const number=v=>Number(v)||0,fmt=(v,d=0)=>number(v).toLocaleString('pt-BR',{maximumFractionDigits:d,minimumFractionDigits:d});
 const current=id=>document.querySelector('.page.active')?.id===id;
 let stage='classificatoria',view='totals',statsRequest=0,teamRequest=0,killsPromise=null;
 const routes=[['classificatoria','Tabelas'],['mvp','MVP'],['equipes','Equipes'],['datas','Datas'],['selecoes','Seleções'],['stats','Estatísticas']];
 function header(title,subtitle=''){
  return `<div class="laff-hero"><div class="laff-hero-main"><img src="laff.webp" alt="Logo LAFF"><div><div class="laff-kicker">Liga Ascensão de Free Fire</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div></div><div class="laff-hero-badges"><span>LAFF 2026 S1</span><span>Torneio encerrado</span></div></div><nav class="laff-view-links" aria-label="Páginas da LAFF">${routes.map(([id,label])=>`<a href="#laff-${id}" ${current('laff-'+id)?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
 }
 function controls(){return `<div class="laff-view-controls"><label for="laff-stats-stage">Etapa<select id="laff-stats-stage">${Object.entries(phases).map(([id,label])=>`<option value="${id}" ${stage===id?'selected':''}>${label}</option>`).join('')}</select></label><div class="laff-phase-tabs" role="group" aria-label="Exibir estatísticas">${[['totals','Totais'],['averages','Médias']].map(([id,label])=>`<button type="button" class="laff-phase-tab ${view===id?'is-active':''}" data-laff-stats-view="${id}" aria-pressed="${view===id}">${label}</button>`).join('')}</div></div>`}
 const metric=(label,value)=>`<div class="card laff-stat-card"><h3>${esc(label)}</h3><div class="value">${esc(value)}</div></div>`;
 function card(rows,title,unit,score,display){
  const ordered=[...rows].sort((a,b)=>score(b)-score(a)||number(a.rank)-number(b.rank)||a.team.localeCompare(b.team,'pt-BR')),pages=[];
  for(let i=0;i<ordered.length;i+=4)pages.push(ordered.slice(i,i+4));
  return `<article class="laff-stats-ranking-card" data-laff-ranking-card data-page="0" data-total="${ordered.length}"><h3>${title}</h3><div class="laff-stats-ranking-head"><span>Equipe</span><span>${unit}</span></div><div class="laff-stats-ranking-pages">${pages.map((page,index)=>`<div class="laff-stats-ranking-page ${index?'is-hidden':''}" data-laff-page="${index}">${page.map((row,i)=>`<button type="button" class="laff-stats-ranking-row" data-rank="${index*4+i+1}" data-laff-team="${esc(row.team)}"><span class="laff-stats-rank">${index*4+i+1}º</span><img src="${esc(row.logo||window.cffResolveTeamLogo?.(row.team)||'escudo.webp')}" alt="" loading="lazy" data-team-logo="${esc(row.team)}"><strong>${esc(row.team)}</strong><em>${esc(display(row))}</em></button>`).join('')}</div>`).join('')}</div>${pages.length>1?`<div class="laff-stats-ranking-nav"><button type="button" disabled data-laff-page-step="-1" aria-label="Página anterior">‹</button><span data-laff-page-label>1–${Math.min(4,ordered.length)}</span><button type="button" data-laff-page-step="1" aria-label="Próxima página">›</button></div>`:''}</article>`;
 }
 async function renderStats(){
  const root=$('laff-stats-content'),request=++statsRequest;if(!root||!current('laff-stats'))return;
  root.innerHTML=header('Estatísticas gerais','Compare as equipes por etapa, com totais ou médias.')+controls()+'<div class="laff-panel" role="status">Carregando estatísticas…</div>';
  try{
   const rows=await window.cffGetLAFFStageRows(stage);
   if(request!==statsRequest||!current('laff-stats'))return;
   const counts=[...new Set(rows.map(r=>number(r.quedas)))].sort((a,b)=>a-b),matches=counts.length===1?fmt(counts[0]):counts.length?fmt(counts[0])+'–'+fmt(counts.at(-1)):'—';
   const avg=r=>number(r.quedas)?number(r.pontos)/number(r.quedas):0,kills=r=>number(r.quedas)?number(r.kills)/number(r.quedas):0,rate=r=>number(r.quedas)?number(r.booyah)*100/number(r.quedas):0;
   root.innerHTML=header('Estatísticas gerais','Compare as equipes por etapa, com totais ou médias.')+controls()+`<section class="laff-panel"><div class="grid-cards laff-stats-grid">${metric('Equipes na etapa',rows.length)}${metric('Quedas por equipe',matches)}${metric('Abates na etapa',fmt(rows.reduce((n,r)=>n+number(r.kills),0)))}${metric('Booyahs na etapa',fmt(rows.reduce((n,r)=>n+number(r.booyah),0)))}</div></section><div class="laff-stats-available"><strong>Etapa</strong><span>${phases[stage]}</span><small>${rows.length} equipes com dados</small></div><section class="laff-stats-block"><div class="laff-stats-ranking-grid">${view==='totals'?card(rows,'Pontos','PTS',r=>number(r.pontos),r=>fmt(r.pontos))+card(rows,'Abates','K',r=>number(r.kills),r=>fmt(r.kills))+card(rows,'Booyahs','B!',r=>number(r.booyah),r=>fmt(r.booyah)):card(rows,'Pontos por queda','PTS/Q',avg,r=>fmt(avg(r),2))+card(rows,'Abates por queda','K/Q',kills,r=>fmt(kills(r),2))+card(rows,'Aproveitamento de Booyah','B!/Q',rate,r=>fmt(rate(r),1)+'%')}</div></section>`;
  }catch(error){if(request===statsRequest&&current('laff-stats'))root.innerHTML=header('Estatísticas gerais')+controls()+'<section class="laff-panel" role="status">Não foi possível carregar esta etapa. <button type="button" class="btn-mini" data-laff-stats-retry>Tentar novamente</button></section>'}
 }
 function renderDates(){
  const root=$('laff-datas-content');if(!root)return;
  root.innerHTML=header('Datas e formato','LAFF 2026 Split 1 · competição encerrada')+`<section class="laff-panel"><div class="laff-format-grid"><div class="laff-format-card"><strong>Período da competição</strong><span>12 a 28 de junho de 2026</span></div><div class="laff-format-card"><strong>Equipes participantes</strong><span>24 equipes</span></div><div class="laff-format-card"><strong>Vagas na WB 2026 S2</strong><span>CPT VOX e SX GG</span></div></div></section><section class="laff-panel"><div class="laff-section-head"><h2>Etapas da competição</h2></div><div class="laff-format-grid">${[['classificatoria','24 equipes · 18 quedas por equipe','Top 6 para a final; 7º ao 18º para a repescagem'],['repescagem','12 equipes · 6 quedas por equipe','Top 6 para a final'],['final','12 equipes · 13 quedas disputadas','CPT VOX campeã; top 2 para a WB S2']].map(([id,description,result])=>`<div class="laff-format-card"><strong>${phases[id]}</strong><span>${description}</span><small>${result}</small><button type="button" class="btn-mini" data-laff-open-stage="${id}">Ver resultados</button></div>`).join('')}</div><p class="laff-view-note">O período geral está registrado no site. Horários e datas de cada rodada não estão disponíveis nesta base.</p></section>`;
 }
 async function renderTeam(team){
  const root=$('laff-team-profile-content'),request=++teamRequest;if(!root)return;
  root.dataset.laffTeam=team.name;
  root.querySelectorAll('.laff-profile-section').forEach(section=>{if(/Desempenho|Galeria de troféus/.test(section.querySelector('h2')?.textContent||''))section.remove()});
  root.querySelector('[data-laff-team-results]')?.remove();
  const section=document.createElement('section');section.className='laff-panel laff-profile-section';section.dataset.laffTeamResults='';section.innerHTML='<h2>Campanha na LAFF</h2><p role="status">Carregando resultados por etapa…</p>';root.querySelector('.laff-main-link')?.before(section);
  const results=await Promise.allSettled(Object.keys(phases).map(id=>window.cffGetLAFFStageRows(id)));
  if(request!==teamRequest||!current('laff-team-profile')||root.dataset.laffTeam!==team.name)return;
  section.innerHTML='<h2>Campanha na LAFF</h2><div class="laff-team-stage-grid">'+Object.entries(phases).map(([id,label],i)=>{
   const result=results[i],row=result.status==='fulfilled'?result.value.find(r=>key(r.team)===key(team.name)):null;
   return `<article class="laff-team-stage"><h3>${label}</h3>${result.status==='rejected'?'<p>Não foi possível carregar esta etapa.</p>':row?`<strong>${row.rank}º lugar</strong><dl><div><dt>Pontos</dt><dd>${fmt(row.pontos)}</dd></div><div><dt>Abates</dt><dd>${fmt(row.kills)}</dd></div><div><dt>Booyahs</dt><dd>${fmt(row.booyah)}</dd></div><div><dt>Quedas</dt><dd>${fmt(row.quedas)}</dd></div></dl>`:'<p>Não participou desta etapa.</p>'}</article>`;
  }).join('')+'</div>'+(results.some(r=>r.status==='rejected')?'<button type="button" class="btn-mini" data-laff-team-retry>Tentar novamente</button>':'');
 }
 // Resolve portraits from the shared static map; never guess between same-name people.
 function photo(name,team='',explicit=''){
  const valid=url=>url&&!/(^|\/)silhueta\.webp(?:[?#]|$)/.test(url);
  if(valid(explicit))return explicit;
  const matches=(window.getLAFFPlayers?.()||[]).filter(p=>key(p.name)===key(name));
  if(new Set(matches.map(p=>key(p.team))).size>1)return 'silhueta.webp';
  const mapped=window.cffResolvePlayerPhoto?.(name);
  if(valid(mapped))return mapped;
  try{const old=typeof playerPhotos!=='undefined'?playerPhotos:window.playerPhotos;
   const found=Object.keys(old||{}).find(n=>key(n)===key(name));
   if(found&&valid(old[found]))return old[found];
  }catch(_){}
  return 'silhueta.webp';
 }
 function readKills(){
  if(!killsPromise)killsPromise=fetch('dados laff/abates.json?v='+V,{cache:'default'}).then(r=>{if(!r.ok)throw Error('Abates indisponíveis');return r.text()}).catch(error=>{killsPromise=null;throw error});return killsPromise;
 }
 document.addEventListener('change',e=>{if(e.target.id==='laff-stats-stage'&&phases[e.target.value]){stage=e.target.value;renderStats()}});
 document.addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.dataset.laffStatsView){view=button.dataset.laffStatsView;renderStats()}
  if(button.hasAttribute('data-laff-stats-retry'))renderStats();
  if(button.dataset.laffTeam)window.openLAFFTeamProfile?.(button.dataset.laffTeam);
  if(button.dataset.laffPageStep)window.cffMoveLAFFStatsPage?.(button,Number(button.dataset.laffPageStep));
  if(button.dataset.laffOpenStage){window.navigate('laff-classificatoria');await window.cffEnsureRoute('laff-classificatoria');window.cffSetLAFFTablePhase(button.dataset.laffOpenStage)}
  if(button.hasAttribute('data-laff-team-retry')){const name=$('laff-team-profile-content')?.dataset.laffTeam,team=window.getLAFFTeams?.().find(t=>t.name===name);if(team)renderTeam(team)}
 });
 const css=document.createElement('link');css.rel='stylesheet';css.href='css/laff-pages.css?v='+V;document.head.appendChild(css);
 window.CFF_LAFF_VIEWS={header,renderStats,renderDates,renderTeam,readKills,photo};
})();
