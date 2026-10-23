(() => {
  'use strict';
  if (window.CFFGlobalInicio) return;
  const root=document.getElementById('ffws-global-2026-inicio-content');
  if (!root) return;
  const VERSION = '20261023-global-teams-v1', BASE='/ffws-global-2026/';
  const stages=[['classificatoria','Fase 1'],['segundaFase','Fase 2'],['lastChance','Repescagem'],['final','Grande Final']];
  const tabs=[['tabela','Tabela'],['mvp','Ranking MVP'],['equipes','Equipes']];
  const paths={classificatoria:'classificatoria',segundaFase:'segunda-fase',lastChance:'last-chance',final:'final'};
  const files={summary:'inicio-resumo.json',mvp:'inicio-mvp-top10.json',squads:'inicio-elencos.json'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>Number(v)||0, fmt=v=>num(v).toLocaleString('pt-BR');
  const params=new URLSearchParams(location.search), validStage=k=>stages.some(s=>s[0]===k);
  const state={tab:tabs.some(t=>t[0]===params.get('aba'))?params.get('aba'):'tabela',stage:validStage(params.get('etapa'))?params.get('etapa'):'classificatoria',mvpStage:validStage(params.get('etapa'))?params.get('etapa'):'geral',day:params.get('dia')||'',group:['A','B','C','D'].includes(params.get('grupo'))?params.get('grupo'):''};
  const cache=new Map();
  let summary=null, initialized=false, request=0, timer=null, fixtureKey='';
  const query=s=>root.querySelector(s);
  function get(key) {
    if (!cache.has(key)) cache.set(key,fetch(BASE+files[key]+'?v='+VERSION,{cache:'default'}).then(r=>{if(!r.ok)throw Error('Arquivo indisponível');return r.json();}).catch(e=>{cache.delete(key);throw e;}));
    return cache.get(key);
  }
  function asset(value) {
    const src=String(value||'');
    return src&&!/[:\\]|^\/\//.test(src)&&!src.split('/').includes('..')?'/'+src.replace(/^\//,''):'/escudo.webp';
  }
  function image(team) {return `<img data-team-logo="${esc(team.name)}" data-team-date="2026-11-06" src="${esc(asset(team.logo))}" alt="" width="28" height="28" loading="lazy" decoding="async" data-global-start-fallback>`;}
  function meta(name) {return summary.teams.find(t=>t.name===name||t.id===name||t.abbreviation===name)||{name,abbreviation:name};}
  function teamName(team) {return `<span class="global-start-team">${image(team)}<span><span class="global-start-full">${esc(team.name)}</span><span class="global-start-short">${esc(team.abbreviation)}</span></span></span>`;}
  function link(path,label) {return `<a class="global-start-link" href="${BASE+path}">${esc(label)} <span aria-hidden="true">→</span></a>`;}
  const date=v=>String(v||'').split('-').slice(1).reverse().join('/');
  const buttons=(items,current,attr)=>items.map(([id,label])=>`<button type="button" data-global-start-${attr}="${id}" aria-pressed="${id===current}" class="ffws-global-stage-tab ${id===current?'active':''}">${esc(label)}</button>`).join('');
  function empty(title,text) {return `<div class="ffws-global-empty"><div><strong>${esc(title)}</strong>${esc(text)}</div></div>`;}
  function format() {
    const briefs={classificatoria:'24 equipes · 4 grupos · 36 quedas por equipe',segundaFase:'Top 2 por dia → 8 vagas na final',lastChance:'12 equipes · 10 quedas → 4 vagas',final:'12 equipes · Champion Rush · 110 pontos'};
    return `<section class="ffws-global-panel global-start-format" aria-labelledby="global-start-format-title"><div class="ffws-global-panel-inner"><div class="ffws-global-panel-head"><div><h2 id="global-start-format-title">Como funciona o Mundial</h2><p>Da fase de grupos ao título. Toque em uma etapa para ver as regras.</p></div><span class="ffws-global-badge">4 etapas</span></div><div class="global-start-format-grid">${stages.map(([key,label],i)=>{const f=summary.format[key];return `<details class="global-start-phase"><summary><span class="ffws-global-format-step">${i+1}</span><span><strong>${label}</strong><small>${esc(f.dateLabel)}</small><span class="global-start-brief">${briefs[key]}</span></span><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m5 7 5 5 5-5"/></svg></summary><div class="global-start-rules"><p>${esc(f.description)}</p><ul>${f.rules.map(r=>`<li>${esc(r)}</li>`).join('')}</ul>${key==='classificatoria'?`<div class="global-start-pools">${f.pools.map(p=>`<p><strong>${esc(p.positions)}</strong><span>${esc(p.entry)}</span></p>`).join('')}</div>`:''}${key==='segundaFase'?`<ol class="global-start-pools">${f.matchdays.map(d=>`<li><strong>${esc(d.dateLabel)}</strong> ${esc(d.entrants)}</li>`).join('')}</ol>`:''}<p class="global-start-time">${esc(f.timeLabel)}</p>${link(paths[key],'Ver etapa')}</div></details>`;}).join('')}</div><div class="global-start-under"><small>Todos os horários são de Brasília (UTC−3).</small>${link('formato','Formato completo')}</div></div></section>`;
  }
  function layout() {
    root.innerHTML=`<div class="ffws-global-shell global-start"><section class="ffws-global-hero global-start-hero"><div class="ffws-global-brand"><img src="${BASE}Free_Fire_World_Series_2021_icon_allmode.png" width="86" height="67" alt="Free Fire World Series"><div class="ffws-global-kicker">FFWS GLOBAL FINALS 2026</div></div><h1>Início do Mundial</h1><p>6 a 28 de novembro · Bangkok, Tailândia · 24 equipes</p></section>${format()}<section class="ffws-global-panel" aria-labelledby="global-start-next-title"><div class="ffws-global-panel-inner" id="global-start-next"></div></section><section class="ffws-global-panel"><div class="global-start-tabs" role="tablist" aria-label="Informações do Mundial">${tabs.map(([id,label])=>`<button type="button" role="tab" id="global-start-tab-${id}" data-global-start-tab="${id}" aria-controls="global-start-pane" aria-selected="${id===state.tab}" tabindex="${id===state.tab?0:-1}">${label}</button>`).join('')}</div><div id="global-start-pane" class="ffws-global-panel-inner" role="tabpanel" aria-labelledby="global-start-tab-${state.tab}" aria-live="polite" tabindex="0"></div></section><nav class="global-start-shortcuts" aria-label="Mais sobre o Mundial">${link('datas','Calendário completo')}${link('stats','Estatísticas gerais')}${link('equipes','Todos os elencos')}</nav></div>`;
    tick();
  }
  const startOf=r=>Date.parse(r.date+'T'+r.time24+':00-03:00');
  function endOf(r,i) {
    if (r.stage==='final') return Date.parse(r.date+'T23:59:59-03:00')+1000;
    return Math.min(startOf(r)+(r.stage==='lastChance'?7.5:4.5)*3600000,summary.rounds[i+1]?startOf(summary.rounds[i+1]):Infinity);
  }
  function groupMembers(group) {return summary.teams.filter(t=>t.group===group);}
  function groupCard(group,upcoming=false,squads=[]) {
    return `<article class="global-start-group"><h3>Grupo ${esc(group)}</h3><div>${groupMembers(group).map(t=>{
      if(upcoming) return `<a class="global-start-fixture-team" href="${BASE}equipes?time=${esc(t.id)}">${teamName(t)}</a>`;
      const players=squads.find(s=>s.id===t.id)?.players||[];
      return `<details class="global-start-roster"><summary>${teamName(t)}<span aria-hidden="true">⌄</span></summary><div>${players.length?players.map(p=>`<p><strong>${esc(p.name)}</strong><small>${esc(({RUSH:'Rush',SUP:'Suporte',GRAN:'Granadeiro','3':'3º homem'})[p.role]||p.role||'Jogador')}${p.captain?' · Capitão':''}</small></p>`).join(''):'<p class="global-start-muted">Elenco ainda não cadastrado para este Mundial.</p>'}<a class="global-start-link" href="${BASE}equipes?time=${esc(t.id)}">Ver equipe e estatísticas ↗</a></div></details>`;
    }).join('')}</div></article>`;
  }
  function tick() {
    if (!summary || document.hidden || !document.getElementById('ffws-global-2026-inicio')?.classList.contains('active')) return;
    const now=Date.now(),i=summary.rounds.findIndex((r,index)=>now<endOf(r,index)),r=summary.rounds[i],started=r&&now>=startOf(r);
    const key=(r?.key||'ended')+(started?'-started':'');
    if (key!==fixtureKey) {
      fixtureKey=key;
      const el=query('#global-start-next');
      if (!r) {el.innerHTML=`<h2 id="global-start-next-title">Calendário encerrado</h2><p class="global-start-muted">Confira os resultados e a classificação nas abas abaixo.</p>${link('datas','Ver calendário')}`;return;}
      el.innerHTML=`<div class="ffws-global-panel-head"><div><div class="ffws-global-kicker">${started?'No horário programado':'Próximos jogos'}</div><h2 id="global-start-next-title">${r.groups?'Grupo '+r.groups.join(' × Grupo '):stages.find(s=>s[0]===r.stage)?.[1]}</h2><p>${esc(r.label)} · ${date(r.date)} · ${esc(r.time24)} (Brasília)</p></div><span class="ffws-global-badge">${r.matches?r.matches+' quedas':'Champion Rush'}</span></div>${started?'<p class="global-start-muted">Rodada no horário previsto. A duração é estimada; confirme a transmissão no canal oficial.</p>':'<p class="global-start-countdown" role="timer" aria-label="Contagem para a próxima rodada"></p>'}${r.groups?`<div class="global-start-matchup">${r.groups.map(g=>groupCard(g,true)).join('')}</div>`:'<p class="global-start-muted">Os participantes serão definidos pelos resultados das etapas anteriores.</p>'}<div class="global-start-under"><a class="global-start-link global-start-watch" href="https://www.youtube.com/@ffesportsbr/live" target="_blank" rel="noopener noreferrer">▶ Assistir no FF Esports Brasil</a>${link('datas','Calendário e confrontos')}</div><div class="global-start-next-rounds">${summary.rounds.slice(i+1,i+4).map(next=>`<a href="${BASE}datas"><span>${next.groups?'Grupos '+next.groups.join(' × '):stages.find(s=>s[0]===next.stage)?.[1]}</span><small>${date(next.date)} · ${next.time24}</small></a>`).join('')}</div>`;
    }
    if (r&&!started) {
      const total=Math.max(0,Math.floor((startOf(r)-now)/1000)),days=Math.floor(total/86400),hours=Math.floor(total%86400/3600),minutes=Math.floor(total%3600/60),seconds=total%60;
      query('[role="timer"]').textContent=`${days}d ${String(hours).padStart(2,'0')}h ${String(minutes).padStart(2,'0')}m ${String(seconds).padStart(2,'0')}s para começar`;
    }
  }
  function filters(isMvp=false) {return `<div class="ffws-global-stage-tabs global-start-filters" role="group" aria-label="${isMvp?'Etapa do MVP':'Etapa da tabela'}">${buttons(isMvp?[['geral','Geral'],...stages]:stages,isMvp?state.mvpStage:state.stage,isMvp?'mvp-stage':'stage')}</div>`;}
  function table() {
    const phase=summary.tables[state.stage],days=phase.days||[],reset=state.stage==='segundaFase';
    if (!days.some(d=>String(d.day)===state.day)) state.day=reset?String(days.filter(d=>d.rows.length).at(-1)?.day||days[0]?.day||1):'';
    const rows=(state.day?days.find(d=>String(d.day)===state.day)?.rows:phase.rows)||[];
    const label=stages.find(s=>s[0]===state.stage)[1];
    const options=days.length>1?`<label class="global-start-day">${reset?'Dia da disputa':'Recorte'}<select data-global-start-day>${reset?'':'<option value="">Geral da fase</option>'}${days.map(d=>`<option value="${d.day}" ${String(d.day)===state.day?'selected':''}>Dia ${d.day} · ${date(d.date)}</option>`).join('')}</select></label>`:'';
    const legend=state.stage==='classificatoria'?'1º–18º: Fase 2 · 19º–20º: Repescagem · 21º–24º: Eliminados':state.stage==='segundaFase'?'1º e 2º do dia: Grande Final · Pontuação zerada a cada dia':state.stage==='lastChance'?'1º–4º: Grande Final · Demais: Eliminados':'Champion Rush: ativação em 110 pontos; um Booyah elegível define o campeão';
    return filters()+`<div class="ffws-global-panel-head"><h2>${label}</h2>${options}</div>${reset?'<p class="global-start-muted">Cada dia tem uma classificação independente. Os dois melhores avançam à final.</p>':''}${rows.length?`<div class="ffws-global-table-wrap"><table class="ffws-global-table global-start-table"><caption class="global-start-sr">Classificação · ${label}${state.day?' · Dia '+state.day:''}</caption><thead><tr><th scope="col">#</th><th scope="col" class="team-col">Equipe</th><th scope="col">PTS</th><th scope="col">K</th><th scope="col" class="hide-mobile">B!</th><th scope="col">Q</th></tr></thead><tbody>${rows.map(r=>{
      const p=num(r.position),zone=state.stage==='classificatoria'?(p<=18?'advance':p<=20?'world':'eliminated'):state.stage==='segundaFase'?(p<=2?'final':''):state.stage==='lastChance'?(p<=4?'final':'eliminated'):p===1?'champion':'';
      return `<tr class="ffws-global-row-${zone}"><td class="ffws-global-rank">${p}º</td><td class="team-col">${teamName(meta(r.team))}</td><td class="global-start-points">${fmt(r.points)}</td><td>${fmt(r.kills)}</td><td class="hide-mobile">${fmt(r.booyahs)}</td><td>${fmt(r.matches)}</td></tr>`;
    }).join('')}</tbody></table></div>`:empty('Aguardando resultados','A classificação deste recorte aparece após o cadastro das partidas.')}<p class="global-start-legend">${legend}</p><div class="global-start-under"><small>PTS: pontos · K: abates · B!: Booyahs · Q: quedas</small>${link(paths[state.stage],'Ver tabela completa')}</div>`;
  }
  function mvp(data) {
    const rows=data.top10[state.mvpStage]||[],label=state.mvpStage==='geral'?'Geral':stages.find(s=>s[0]===state.mvpStage)[1];
    return filters(true)+`<div class="ffws-global-panel-head"><div><h2>Top 10 · ${label}</h2><p>${state.mvpStage==='geral'?'Todas as etapas do Mundial somadas.':'Desempenho somente nesta etapa.'}</p></div></div>${rows.length?`<div class="ffws-global-table-wrap"><table class="ffws-global-table global-start-table global-start-mvp"><caption class="global-start-sr">Top 10 de abates · ${label}</caption><thead><tr><th scope="col">#</th><th scope="col" class="team-col">Jogador</th><th scope="col">Equipe</th><th scope="col">K</th><th scope="col">Q</th><th scope="col" class="hide-mobile">Dano</th><th scope="col" class="hide-mobile">Assist.</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td class="ffws-global-rank">${i+1}º</td><td class="team-col">${esc(r.name)}</td><td>${image(meta(r.team))}<span class="global-start-sr">${esc(r.team)}</span></td><td class="global-start-points">${fmt(r.kills)}</td><td>${fmt(r.matches)}</td><td class="hide-mobile">${fmt(r.damage)}</td><td class="hide-mobile">${fmt(r.assists)}</td></tr>`).join('')}</tbody></table></div>`:empty('O ranking começa com as partidas','Os dez jogadores com mais abates aparecem aqui quando houver dados cadastrados.')}<div class="global-start-under"><small>K: abates · Q: quedas</small>${link('mvp','Ver Ranking MVP completo')}</div>`;
  }
  function squads(data) {
    return `<div class="ffws-global-panel-head"><div><h2>Grupos e equipes</h2><p>24 equipes · toque em um time para ver seu elenco.</p></div><label class="global-start-day">Grupo<select data-global-start-group><option value="">Todos os grupos</option>${['A','B','C','D'].map(g=>`<option ${g===state.group?'selected':''}>${g}</option>`).join('')}</select></label></div><div class="global-start-groups">${(state.group?[state.group]:['A','B','C','D']).map(g=>groupCard(g,false,data.teams)).join('')}</div><div class="global-start-under"><small>Jogadores e comissão aparecem conforme o cadastro desta edição.</small>${link('equipes','Ver todas as equipes')}</div>`;
  }
  function updateUrl() {
    const u=new URL(location.href);
    for (const key of ['aba','etapa','dia','grupo']) u.searchParams.delete(key);
    u.searchParams.set('aba',state.tab);
    if(state.tab==='tabela'){u.searchParams.set('etapa',state.stage);if(state.day)u.searchParams.set('dia',state.day);}
    if(state.tab==='mvp')u.searchParams.set('etapa',state.mvpStage);
    if(state.tab==='equipes'&&state.group)u.searchParams.set('grupo',state.group);
    history.replaceState(history.state,'',u.pathname+u.search+u.hash);
  }
  async function pane(sync=true) {
    const id=++request,tab=state.tab,el=query('#global-start-pane');
    el.setAttribute('aria-labelledby','global-start-tab-'+tab);
    el.setAttribute('aria-busy','true');
    root.querySelectorAll('[data-global-start-tab]').forEach(b=>{const active=b.dataset.globalStartTab===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
    try {
      if(tab!=='tabela')el.innerHTML='<p class="global-start-muted">Carregando…</p>';
      const html=tab==='tabela'?table():tab==='mvp'?mvp(await get('mvp')):squads(await get('squads'));
      if(id!==request)return;
      el.innerHTML=html;
      if(sync)updateUrl();
    } catch (_) {
      if(id===request)el.innerHTML=empty('Não foi possível carregar este conteúdo','Tente novamente para abrir esta aba.')+'<button type="button" class="ffws-global-stage-tab" data-global-start-retry>Tentar novamente</button>';
    } finally {if(id===request)el.removeAttribute('aria-busy');}
  }
  async function boot() {
    if(initialized){tick();return;}
    initialized=true;
    root.innerHTML='<div class="ffws-global-empty">Carregando o Mundial…</div>';
    try {summary=await get('summary');layout();await pane(false);if(!timer)timer=setInterval(tick,1000);}
    catch(_){initialized=false;root.innerHTML=empty('Não foi possível abrir o Mundial','Tente novamente em instantes.')+'<button type="button" class="ffws-global-stage-tab" data-global-start-boot>Tentar novamente</button>';}
  }
  root.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b)return;
    if(b.dataset.globalStartTab){state.tab=b.dataset.globalStartTab;pane();}
    else if(b.dataset.globalStartStage){state.stage=b.dataset.globalStartStage;state.day='';pane();}
    else if(b.dataset.globalStartMvpStage){state.mvpStage=b.dataset.globalStartMvpStage;pane();}
    else if(b.hasAttribute('data-global-start-retry'))pane();
    else if(b.hasAttribute('data-global-start-boot'))boot();
  });
  root.addEventListener('change',event=>{
    if(event.target.matches('[data-global-start-day]')){state.day=event.target.value;pane();}
    if(event.target.matches('[data-global-start-group]')){state.group=event.target.value;pane();}
  });
  root.addEventListener('keydown',event=>{
    const b=event.target.closest('[data-global-start-tab]');if(!b||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const current=tabs.findIndex(t=>t[0]===b.dataset.globalStartTab),i=event.key==='Home'?0:event.key==='End'?2:(current+(event.key==='ArrowRight'?1:-1)+3)%3;
    state.tab=tabs[i][0];pane();query('[data-global-start-tab="'+state.tab+'"]').focus();
  });
  root.addEventListener('error',event=>{const img=event.target;if(img.matches?.('[data-global-start-fallback]')){delete img.dataset.globalStartFallback;img.src='/escudo.webp';}},true);
  document.addEventListener('visibilitychange',tick);
  window.CFFGlobalInicio={boot};
  boot();
})();
