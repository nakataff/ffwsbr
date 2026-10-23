/* Mundial participants: one static, offline-generated snapshot; no database or polling. */
(() => {
  'use strict';
  if (window.CFFGlobalTeams) return;
  const root=document.getElementById('ffws-global-2026-equipes-content');
  if(!root)return;
  const VERSION='20261023-global-teams-v1', PAGE='ffws-global-2026-equipes';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const stages=[['geral','Geral'],['classificatoria','Fase 1'],['segundaFase','Fase 2'],['lastChance','Repescagem'],['final','Final']];
  let data,request,search='',group='',selected,trigger,section='players',stage='geral',dialog;
  const active=()=>document.getElementById(PAGE)?.classList.contains('active');
  const path=t=>'/ffws-global-2026/equipes?time='+encodeURIComponent(t.id);
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
  function draw(){
    root.innerHTML=`<div class="ffws-global-shell gteams"><section class="ffws-global-hero"><div class="ffws-global-brand"><img src="/ffws-global-2026/Free_Fire_World_Series_2021_icon_allmode.png" width="86" height="67" alt="FFWS"><div class="ffws-global-kicker">FFWS GLOBAL FINALS 2026</div></div><h1>Os protagonistas do Mundial</h1><p>24 equipes, um título. Conheça os elencos que vão disputar Bangkok.</p><div class="ffws-global-event-meta"><span>6 a 28 de novembro</span><span>Bangkok, Tailândia</span><span>${data.teams.filter(t=>t.players.some(p=>p.type!=='staff')).length} elencos cadastrados</span></div></section><section class="ffws-global-panel"><div class="ffws-global-panel-inner"><div class="gteams-toolbar"><label>Buscar equipe ou jogador<input type="search" data-gteams-search placeholder="Time, jogador ou região…" maxlength="100"></label><label>Grupo<select data-gteams-group><option value="">Todos os grupos</option>${['A','B','C','D'].map(g=>`<option value="${g}">Grupo ${g}</option>`).join('')}</select></label></div><div class="gteams-caption"><span data-gteams-count role="status"></span><small>Atualizado em ${date(data.updatedAt.slice(0,10))} · toque para ver os detalhes</small></div><div class="gteams-grid" data-gteams-grid></div></div></section><p class="gteams-note">Elencos e comissão são adicionados conforme as confirmações. Estatísticas exclusivas deste Mundial; dados ainda não lançados aparecem como “—”.</p><nav class="gteams-links" aria-label="Mais sobre o Mundial"><a href="/ffws-global-2026/inicio">Início do Mundial</a><a href="/ffws-global-2026/formato">Formato</a><a href="/ffws-global-2026/datas">Calendário completo</a></nav></div>`;
    root.querySelector('[data-gteams-search]').value=search;
    root.querySelector('[data-gteams-group]').value=group;
    cards();
    const id=new URLSearchParams(location.search).get('time');
    const t=data.teams.find(t=>t.id===id);if(t&&active())open(t);
  }
  function detail(){
    const t=selected,s=stage==='geral'?stats(t):t.statsByStage[stage];
    const members=t.players.filter(p=>(p.type==='staff')===(section==='staff'));
    const byStat=[...members].sort((a,b)=>(b.statsByStage?.[stage]?.kills||0)-(a.statsByStage?.[stage]?.kills||0));
    dialog.innerHTML=`<div class="gteam-modal-top"><span class="gteam-group">Grupo ${esc(t.group)} · ${esc(t.region)}</span><button type="button" data-gteam-close aria-label="Fechar detalhes">×</button></div><header class="gteam-modal-brand">${image(t)}<div><h2 id="gteam-dialog-title">${esc(t.name)}</h2><p>${esc(t.qualification?.placement)}º · ${esc(t.qualification?.competition)}</p></div></header><div class="gteam-modal-body"><div class="gteam-overview">${[['Abates',s?.kills],['Quedas',s?.matches],['Booyahs',s?.booyahs]].map(([label,value])=>`<div><strong>${value??'—'}</strong><small>${label}</small></div>`).join('')}</div><label class="gteam-stage">Estatísticas<select data-gteam-stage>${stages.map(([key,label])=>`<option value="${key}" ${key===stage?'selected':''}>${label}</option>`).join('')}</select></label><p class="gteam-hint">${stage==='segundaFase'?'Totais descritivos da fase. A classificação é independente a cada dia.':!s?'Os dados de desempenho aparecem quando os resultados forem cadastrados.':'Desempenho neste Mundial.'}</p><div class="gteam-sections" aria-label="Elenco e comissão"><button type="button" data-gteam-section="players" aria-pressed="${section==='players'}">Jogadores <span>${t.players.filter(p=>p.type!=='staff').length}</span></button><button type="button" data-gteam-section="staff" aria-pressed="${section==='staff'}">Comissão <span>${t.players.filter(p=>p.type==='staff').length}</span></button></div>${members.length?`<div class="gteam-roster-heading"><span>${section==='staff'?'Nome e função':'Jogador'}</span><span>Abates / quedas</span></div><div class="gteam-roster">${byStat.map(p=>{const s=p.statsByStage?.[stage];return `<div><span class="gteam-initial" aria-hidden="true">${esc(p.name.slice(0,1))}</span><div><strong>${esc(p.name)}</strong><small>${esc(p.role||(section==='staff'?'Comissão técnica':'Jogador'))}</small></div><span class="gteam-player-stats">${section==='staff'?'—':s?`${s.kills} <small>/ ${s.matches}</small>`:'—'}</span></div>`;}).join('')}</div>`:`<p class="gteam-empty">${section==='staff'?'Comissão técnica a confirmar.':'Elenco ainda não confirmado. Em breve, os jogadores aparecem aqui.'}</p>`}<details class="gteam-schedule"><summary>Agenda da Fase 1 <span>${t.fixtures.length} rodadas</span></summary>${t.fixtures.map(f=>`<p><strong>${date(f.date)} · ${esc(f.time)}</strong><span>Grupos ${esc(f.groups.join(' × '))}</span></p>`).join('')}<small>Horário de Brasília · 6 quedas por rodada</small></details><div class="gteam-modal-actions"><button type="button" data-gteam-share>Compartilhar equipe</button><a href="/ffws-global-2026/datas">Ver calendário</a></div><p data-gteam-share-status role="status" class="gteam-hint"></p></div>`;
    repairImages(dialog);
  }
  function open(t){
    trigger=document.activeElement;selected=t;section='players';stage='geral';
    if(!dialog){dialog=document.createElement('dialog');dialog.className='gteam-dialog';dialog.setAttribute('aria-labelledby','gteam-dialog-title');document.body.append(dialog);
      dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}if(e.target.closest('[data-gteam-close]'))close();const tab=e.target.closest('[data-gteam-section]');if(tab){section=tab.dataset.gteamSection;detail();dialog.querySelector(`[data-gteam-section="${section}"]`).focus();}if(e.target.closest('[data-gteam-share]'))share();});
      dialog.addEventListener('change',e=>{if(e.target.matches('[data-gteam-stage]')){stage=e.target.value;detail();dialog.querySelector('[data-gteam-stage]').focus();}});
      dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    }
    detail();if(!dialog.open)dialog.showModal();
    const url=new URL(location.href);url.searchParams.set('time',t.id);history.replaceState(null,'',url);
    dialog.querySelector('[data-gteam-close]').focus();
  }
  function close(clear=true){if(!dialog?.open)return;dialog.close();selected=null;if(clear){const url=new URL(location.href);url.searchParams.delete('time');history.replaceState(null,'',url);}if(trigger?.isConnected&&active())trigger.focus();}
  async function share(){
    const t=selected,url=new URL(path(t),location.origin).href,target=dialog.querySelector('[data-gteam-share-status]');
    try{if(navigator.share)await navigator.share({title:t.name+' · Mundial 2026',text:'Veja o elenco e acompanhe '+t.name+' na Central Free Fire.',url});else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);target.textContent='Link da equipe copiado!';}else{target.textContent=url;}}
    catch(e){if(e.name!=='AbortError')target.textContent='Copie o link: '+url;}
  }
  async function boot(){
    if(data){if(!root.querySelector('[data-gteams-grid]'))draw();else {const t=data.teams.find(t=>t.id===new URLSearchParams(location.search).get('time'));if(t&&active()&&!dialog?.open)open(t);}return;}
    if(request)return request;
    root.innerHTML='<p class="gteam-empty" role="status">Carregando equipes do Mundial…</p>';
    request=fetch('/ffws-global-2026/equipes-resumo.json?v='+VERSION,{cache:'default'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{if(!Array.isArray(d.teams)||d.teams.length!==24)throw Error();data=d;draw();}).catch(()=>{root.innerHTML='<div class="gteam-empty"><p>Não foi possível carregar as equipes agora.</p><button type="button" data-gteams-retry>Tentar novamente</button></div>';}).finally(()=>{request=null;});return request;
  }
  root.addEventListener('click',e=>{const link=e.target.closest('[data-gteam]');if(link&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();open(data.teams.find(t=>t.id===link.dataset.gteam));}if(e.target.closest('[data-gteams-retry]'))boot();});
  root.addEventListener('input',e=>{if(e.target.matches('[data-gteams-search]')){search=e.target.value;cards();}});
  root.addEventListener('change',e=>{if(e.target.matches('[data-gteams-group]')){group=e.target.value;cards();}});
  const pageObserver=new MutationObserver(()=>{if(!active())close(false);});
  if(document.getElementById(PAGE))pageObserver.observe(document.getElementById(PAGE),{attributes:true,attributeFilter:['class']});
  window.CFFGlobalTeams={boot};boot();
})();
