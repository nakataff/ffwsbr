/* Mundial participants: one static, offline-generated snapshot; no database or polling. */
(() => {
  'use strict';
  if (window.CFFGlobalTeams) return;
  const DIRECTORY='ffws-global-2026-equipes', TEAM='ffws-global-2026-equipe';
  const roots={[DIRECTORY]:document.getElementById(DIRECTORY+'-content'),[TEAM]:document.getElementById(TEAM+'-content')};
  if(!roots[DIRECTORY]||!roots[TEAM])return;
  let root=roots[DIRECTORY];
  const VERSION='20261023-global-team-pages-v1';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const stages=[['geral','Geral'],['classificatoria','Fase 1'],['segundaFase','Fase 2'],['lastChance','Repescagem'],['final','Final']];
  let data,request,search='',group='',selected,section='players',stage='geral';
  const activePage=()=>[TEAM,DIRECTORY].find(id=>document.getElementById(id)?.classList.contains('active'));
  const path=t=>'/ffws-global-2026/equipe?time='+encodeURIComponent(t.id);
  const date=v=>v.split('-').slice(1).reverse().join('/');
  function image(t){return `<img src="/${esc(String(t.logo||'escudo.webp').replace(/^\//,''))}" data-cff-global-team-logo="${esc(t.name)}" data-team-logo="${esc(t.name)}" data-team-date="2026-11-06" alt="" width="64" height="64" loading="lazy" decoding="async">`;}
  function repairImages(scope){scope.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.src='/escudo.webp';},{once:true}));window.cffRefreshGlobalTeamLogos?.();}
  function stats(t){const rows=Object.values(t.statsByStage||{}).filter(Boolean);return rows.length?rows.reduce((s,r)=>({kills:s.kills+r.kills,matches:s.matches+r.matches,booyahs:s.booyahs+r.booyahs}),{kills:0,matches:0,booyahs:0}):null;}
  function cards(){
    const teams=data.teams.filter(t=>(!group||t.group===group)&&norm([t.name,t.abbreviation,t.region,...t.players.map(p=>p.name)].join(' ')).includes(norm(search)));
    root.querySelector('[data-gteams-count]').textContent=teams.length+' de '+data.teams.length+' equipes';
    root.querySelector('[data-gteams-grid]').innerHTML=teams.length?teams.map(t=>{
      const roster=t.players.filter(p=>p.type!=='staff'),s=stats(t);
      return `<a class="gteam-card" href="${path(t)}" data-gteam="${esc(t.id)}"><div class="gteam-card-top"><span class="gteam-group">Grupo ${esc(t.group)}</span><span class="gteam-status${roster.length?' is-ready':''}">${roster.length?'Elenco cadastrado':'Elenco a confirmar'}</span></div><div class="gteam-card-brand">${image(t)}<div><h2>${esc(t.name)}</h2><small>${esc(t.region)}</small></div></div><p class="gteam-qualification"><b>${esc(t.qualification?.placement)}º</b> ${esc(t.qualification?.competition||'Classificado')}</p><p class="gteam-names">${roster.length?roster.map(p=>esc(p.name)).join(' · '):'Acompanhe as próximas confirmações'}</p><div class="gteam-card-footer"><span>${s?s.kills+' abates · '+s.matches+' quedas':roster.length+' jogadores'}</span><strong>Ver equipe <span aria-hidden="true">↗</span></strong></div></a>`;
    }).join(''):'<p class="gteam-empty">Nenhuma equipe encontrada. Tente outro nome ou grupo.</p>';
    repairImages(root);
  }
  function directory(){
    document.title='Equipes · FFWS Global Finals 2026 | Central Free Fire';
    root.innerHTML=`<div class="ffws-global-shell gteams"><section class="ffws-global-hero"><div class="ffws-global-brand"><img src="/ffws-global-2026/Free_Fire_World_Series_2021_icon_allmode.png" width="86" height="67" alt="FFWS"><div class="ffws-global-kicker">FFWS GLOBAL FINALS 2026</div></div><h1>Os protagonistas do Mundial</h1><p>24 equipes, um título. Conheça os elencos que vão disputar Bangkok.</p><div class="ffws-global-event-meta"><span>6 a 28 de novembro</span><span>Bangkok, Tailândia</span><span>${data.teams.filter(t=>t.players.some(p=>p.type!=='staff')).length} elencos cadastrados</span></div></section><section class="ffws-global-panel"><div class="ffws-global-panel-inner"><div class="gteams-toolbar"><label>Buscar equipe ou jogador<input type="search" data-gteams-search placeholder="Time, jogador ou região…" maxlength="100"></label><label>Grupo<select data-gteams-group><option value="">Todos os grupos</option>${['A','B','C','D'].map(g=>`<option value="${g}">Grupo ${g}</option>`).join('')}</select></label></div><div class="gteams-caption"><span data-gteams-count role="status"></span><small>Atualizado em ${date(data.updatedAt.slice(0,10))} · escolha uma equipe para visitar sua página</small></div><div class="gteams-grid" data-gteams-grid></div></div></section><p class="gteams-note">Elencos e comissão são adicionados conforme as confirmações. Estatísticas exclusivas deste Mundial; dados ainda não lançados aparecem como “—”.</p><nav class="gteams-links" aria-label="Mais sobre o Mundial"><a href="/ffws-global-2026/inicio">Início do Mundial</a><a href="/ffws-global-2026/formato">Formato</a><a href="/ffws-global-2026/datas">Calendário completo</a></nav></div>`;
    root.querySelector('[data-gteams-search]').value=search;
    root.querySelector('[data-gteams-group]').value=group;
    cards();
  }
  function detail(){
    const t=selected,s=stage==='geral'?stats(t):t.statsByStage[stage];
    const members=t.players.filter(p=>(p.type==='staff')===(section==='staff'));
    const byStat=[...members].sort((a,b)=>(b.statsByStage?.[stage]?.kills||0)-(a.statsByStage?.[stage]?.kills||0));
    const peers=data.teams.filter(p=>p.group===t.group&&p.id!==t.id);
    document.title=t.name+' · Mundial 2026 | Central Free Fire';
    root.innerHTML=`<div class="ffws-global-shell gteams gteam-profile"><nav class="gteam-breadcrumb" aria-label="Localização"><a href="/ffws-global-2026/inicio">Mundial 2026</a><span aria-hidden="true">/</span><a href="/ffws-global-2026/equipes">Equipes</a><span aria-hidden="true">/</span><span>${esc(t.abbreviation)}</span></nav><section class="ffws-global-hero gteam-profile-hero"><div class="gteam-profile-brand">${image(t)}<div><div class="ffws-global-kicker">FFWS GLOBAL FINALS 2026</div><h1>${esc(t.name)}</h1><p>${esc(t.region)} · Grupo ${esc(t.group)}</p></div></div><div class="gteam-profile-footer"><span class="gteam-qualification"><b>${esc(t.qualification?.placement)}º</b> ${esc(t.qualification?.competition)} · classificação para o Mundial</span><button type="button" data-gteam-share>Compartilhar equipe ↗</button></div><p data-gteam-share-status role="status" class="gteam-hint"></p></section><section class="ffws-global-panel"><div class="ffws-global-panel-inner"><div class="gteam-profile-stage"><div><h2>Desempenho no Mundial</h2><p>Estatísticas exclusivas da edição 2026</p></div><label class="gteam-stage">Etapa<select data-gteam-stage>${stages.map(([key,label])=>`<option value="${key}" ${key===stage?'selected':''}>${label}</option>`).join('')}</select></label></div><div class="gteam-overview">${[['Abates',s?.kills],['Quedas',s?.matches],['Abates / queda',s?.matches?(s.kills/s.matches).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):null],['Booyahs',s?.booyahs]].map(([label,value])=>`<div><strong>${value??'—'}</strong><small>${label}</small></div>`).join('')}</div><p class="gteam-hint">${stage==='segundaFase'?'Totais descritivos da fase. A classificação é independente a cada dia.':!s?'Os dados de desempenho aparecem quando os resultados forem cadastrados.':'Desempenho neste Mundial.'}</p></div></section><div class="gteam-profile-columns"><section class="ffws-global-panel"><div class="ffws-global-panel-inner"><div class="gteam-profile-section-title"><h2>Elenco</h2><small>${t.players.filter(p=>p.type!=='staff').length?'Cadastro da edição':'Aguardando confirmação'}</small></div><div class="gteam-sections" aria-label="Elenco e comissão"><button type="button" data-gteam-section="players" aria-pressed="${section==='players'}">Jogadores <span>${t.players.filter(p=>p.type!=='staff').length}</span></button><button type="button" data-gteam-section="staff" aria-pressed="${section==='staff'}">Comissão <span>${t.players.filter(p=>p.type==='staff').length}</span></button></div>${members.length?`<div class="gteam-roster-heading"><span>${section==='staff'?'Nome e função':'Jogador'}</span><span>Abates / quedas</span></div><div class="gteam-roster">${byStat.map(p=>{const s=p.statsByStage?.[stage];return `<div><span class="gteam-initial" aria-hidden="true">${esc(p.name.slice(0,1))}</span><div><strong>${esc(p.name)}</strong><small>${esc(p.role||(section==='staff'?'Comissão técnica':'Jogador'))}</small></div><span class="gteam-player-stats">${section==='staff'?'—':s?`${s.kills} <small>/ ${s.matches}</small>`:'—'}</span></div>`;}).join('')}</div>`:`<p class="gteam-empty">${section==='staff'?'Comissão técnica a confirmar.':'Elenco ainda não confirmado. Em breve, os jogadores aparecem aqui.'}</p>`}</div></section><aside class="gteam-profile-aside"><section class="ffws-global-panel"><div class="ffws-global-panel-inner"><div class="gteam-profile-section-title"><h2>Agenda da Fase 1</h2><small>${t.fixtures.length} rodadas</small></div><div class="gteam-profile-schedule">${t.fixtures.map(f=>`<div><time datetime="${esc(f.date)}T${esc(f.time)}:00-03:00"><strong>${date(f.date)}</strong><span>${esc(f.time)}</span></time><span>Grupos ${esc(f.groups.join(' × '))}<small>6 quedas</small></span></div>`).join('')}</div><p class="gteam-hint">Horário de Brasília</p><a class="gteam-profile-link" href="/ffws-global-2026/datas">Ver calendário completo →</a></div></section><section class="ffws-global-panel"><div class="ffws-global-panel-inner"><h2>Também no grupo ${esc(t.group)}</h2><div class="gteam-profile-peers">${peers.map(p=>`<a href="${path(p)}">${image(p)}<span>${esc(p.name)}</span><span aria-hidden="true">↗</span></a>`).join('')}</div></div></section></aside></div><p class="gteams-note">Elencos e estatísticas são atualizados conforme as confirmações. Atualizado em ${date(data.updatedAt.slice(0,10))}.</p><nav class="gteams-links" aria-label="Mais sobre o Mundial"><a href="/ffws-global-2026/equipes">← Todas as equipes</a><a href="/ffws-global-2026/formato">Formato do Mundial</a><a href="/ffws-global-2026/inicio">Início do Mundial</a></nav></div>`;
    repairImages(root);
  }
  function render(){
    const page=activePage();if(!page)return;root=roots[page];
    if(page===DIRECTORY){directory();return;}
    const id=new URLSearchParams(location.search).get('time'),t=data.teams.find(t=>t.id===id);
    if(!t){document.title='Equipe não encontrada · Mundial 2026 | Central Free Fire';root.innerHTML='<div class="ffws-global-shell"><section class="ffws-global-panel"><div class="gteam-empty"><h1>Equipe não encontrada</h1><p>Escolha uma das equipes participantes do Mundial.</p><a class="gteam-profile-link" href="/ffws-global-2026/equipes">Ver todas as equipes →</a></div></section></div>';return;}
    if(selected?.id!==t.id){section='players';stage='geral';}selected=t;detail();
  }
  async function share(){
    const t=selected,url=new URL(path(t),location.origin).href,target=root.querySelector('[data-gteam-share-status]');
    try{if(navigator.share)await navigator.share({title:t.name+' · Mundial 2026',text:'Veja o elenco e acompanhe '+t.name+' na Central Free Fire.',url});else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);target.textContent='Link da equipe copiado!';}else target.textContent=url;}
    catch(e){if(e.name!=='AbortError')target.textContent='Copie o link: '+url;}
  }
  async function boot(){
    const page=activePage();if(!page)return;
    if(data){render();return;}
    roots[page].innerHTML='<p class="gteam-empty" role="status">Carregando equipes do Mundial…</p>';
    if(!request)request=fetch('/ffws-global-2026/equipes-resumo.json?v='+VERSION,{cache:'default'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{if(!Array.isArray(d.teams)||d.teams.length!==24)throw Error();data=d;}).finally(()=>{request=null;});
    try{await request;render();}catch{const current=activePage();if(current)roots[current].innerHTML='<div class="gteam-empty"><p>Não foi possível carregar as equipes agora.</p><button type="button" data-gteams-retry>Tentar novamente</button></div>';}
  }
  for(const host of Object.values(roots)){
    host.addEventListener('click',e=>{if(e.target.closest('[data-gteams-retry]'))boot();const tab=e.target.closest('[data-gteam-section]');if(tab){section=tab.dataset.gteamSection;detail();root.querySelector(`[data-gteam-section="${section}"]`).focus();}if(e.target.closest('[data-gteam-share]'))share();});
    host.addEventListener('input',e=>{if(e.target.matches('[data-gteams-search]')){search=e.target.value;cards();}});
    host.addEventListener('change',e=>{if(e.target.matches('[data-gteams-group]')){group=e.target.value;cards();}if(e.target.matches('[data-gteam-stage]')){stage=e.target.value;detail();root.querySelector('[data-gteam-stage]').focus();}});
  }
  window.CFFGlobalTeams={boot};boot();
})();
