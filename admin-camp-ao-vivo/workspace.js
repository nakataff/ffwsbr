(function(){
  'use strict';
  if(window.CFF_CAMP_WORKSPACE)return;
  const $=id=>document.getElementById(id);
  const setup=$('cff-admin-tournament-setup'),launch=document.querySelector('.drop-section');
  if(!setup||!launch)return;
  launch.id='cff-camp-launch';
  const nav=document.createElement('nav');nav.id='cff-camp-workflow';nav.setAttribute('aria-label','Etapas do campeonato');
  nav.innerHTML='<div><strong>Seu campeonato, por etapas</strong><p>Configure uma vez. Durante os jogos, vá direto para Lançar quedas.</p></div><div class="cff-workflow-links"><button type="button" data-camp-go="setup">1 <span>Campeonato</span></button><button type="button" data-camp-go="roster">2 <span>Times</span></button><button type="button" data-camp-go="days">3 <span>Dias e descansos</span></button><button type="button" data-camp-go="launch">4 <span>Lançar quedas</span></button><button type="button" data-camp-go="summary">5 <span>Tabelas e exportar</span></button></div><p id="cff-workflow-status"></p>';
  setup.before(nav);
  // Reuse original nodes: the existing score handlers remain responsible for data.
  function reveal(target){
    if(!target)return;
    for(let node=target;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
    target.scrollIntoView({behavior:'smooth',block:'start'});target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
  }
  nav.addEventListener('click',event=>{
    const button=event.target.closest('[data-camp-go]');if(!button)return;
    if(document.body.classList.contains('cff-camp-focus'))$('cff-camp-focus')?.click();
    if(document.body.classList.contains('cff-camp-launch-focus'))$('cff-camp-launch-focus')?.click();
    const go=button.dataset.campGo;
    if(go==='roster'||go==='days'){
      window.v76TournamentMode?.open?.();decorateTournamentPanel();
      document.querySelector(`[data-v76-tab="${go}"]`)?.click();document.querySelector(`[data-v76-tab="${go}"]`)?.focus();
    }else{
      if(go==='summary'&&document.body.classList.contains('v41-simple-mode'))window.v41SetInterfaceMode?.('complete');
      reveal(go==='setup'?setup:go==='launch'?launch:$('summary-section'));
    }
    nav.querySelectorAll('[data-camp-go]').forEach(item=>item.setAttribute('aria-current',item===button?'step':'false'));
  });
  for(const selector of ['.teams-setup','.emoji-setup']){const section=document.querySelector(selector);if(section)section.open=false}
  const teams=document.querySelector('.teams-setup>summary');if(teams)teams.textContent='Banco de times e logos · adicionar ou editar cadastro';
  const actions=document.querySelector('.setup-actions-bar');if(actions)$('cff-admin-basic').append(actions);
  const modes=document.querySelector('.v41-mode-switch');
  if(modes){const details=document.createElement('details');details.className='cff-interface-options';const summary=document.createElement('summary');summary.textContent='Modo da interface: simples, completo ou torneio';details.append(summary,modes);$('cff-admin-advanced')?.append(details)}
  const command=document.querySelector('.cff-camp-command');
  if(command){
    const details=document.createElement('details');details.id='cff-camp-import-tools';const summary=document.createElement('summary');summary.textContent='Começar com uma base, importar ou trocar campeonato';details.append(summary);nav.before(details);details.append(command);
    const saved=document.querySelector('.v37-stage-wrap'),clear=$('v37-clear-all'),tools=document.createElement('div');tools.className='cff-file-tools';
    if(saved){tools.append(saved);const button=$('v37-stage-button');if(button)button.textContent='Campeonatos salvos neste navegador'}
    if(clear)tools.append(clear);details.append(tools);
  }
  const settings=$('drop-settings-panel'),trigger=document.querySelector('[onclick="toggleDropSettingsPanel()"]');
  if(settings){
    const heading=settings.querySelector('h4');if(heading)heading.textContent='Opções do lançamento';
    if(trigger){trigger.textContent='Ajustar lançamento';trigger.setAttribute('aria-controls',settings.id)}
    const close=document.createElement('button');close.type='button';close.className='btn-mini cff-settings-close';close.textContent='Fechar opções';close.addEventListener('click',()=>{window.toggleDropSettingsPanel?.(false);trigger?.focus()});settings.prepend(close);
    const descriptions={entry:'Como preencher e identificar pendências. Os campos mantêm verde, amarelo ou vermelho; a eliminação muda apenas o cabeçalho e a logo.',visual:'Personalize o visual sem alterar os resultados.',tools:'Escolha quais ferramentas e botões ficam visíveis.',clear:'Ações que removem dados. Confira o campeonato e baixe um backup antes de usar.'};
    for(const [key,text] of Object.entries(descriptions)){const group=$('cff-launch-group-'+key);if(!group)continue;const hint=document.createElement('p');hint.className='cff-options-hint';hint.textContent=text;group.querySelector('.cff-launch-options')?.prepend(hint)}
    const sync=()=>trigger?.setAttribute('aria-expanded',String(settings.classList.contains('open')));new MutationObserver(sync).observe(settings,{attributes:true,attributeFilter:['class']});sync();
    settings.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();window.toggleDropSettingsPanel?.(false);trigger?.focus()}});
  }
  const legend=document.createElement('p');legend.className='cff-entry-legend';legend.innerHTML='<span><i class="empty"></i>Vermelho: vazio</span><span><i class="partial"></i>Amarelo: incompleto</span><span><i class="complete"></i>Verde: preenchido</span><span>× Cabeçalho sem cor: equipe eliminada</span>';$('teams-inputs-container')?.before(legend);
  function decorateTournamentPanel(){
    const panel=$('v76-tournament-panel');if(!panel||panel.dataset.cffOrganized)return;panel.dataset.cffOrganized='1';
    const title=panel.querySelector('.v76-dialog-head h3');if(title)title.textContent='Times, dias e tabela geral';$('v76-close-panel')?.setAttribute('aria-label','Fechar configuração do torneio');
    const grid=panel.querySelector('.v76-top-grid');if(grid){const details=document.createElement('details');details.className='cff-mode-advanced';const summary=document.createElement('summary');summary.textContent='Configuração geral: nome, times por rodada e classificação';grid.before(details);details.append(summary,grid)}
    const labels={roster:['Times do campeonato','Selecione o elenco completo. Os participantes e descansos de cada dia são organizados na próxima aba.'],days:['Dias e descansos','Confira quem joga, registre os resultados do dia e prepare o próximo. O código Wiki é opcional.'],general:['Tabela geral','Ajuste colunas, desempates e cores da classificação acumulada.']};
    for(const [key,[label,hint]] of Object.entries(labels)){
      const tab=panel.querySelector(`[data-v76-tab="${key}"]`),body=panel.querySelector(`[data-v76-panel="${key}"]`);
      if(tab){tab.textContent=label;tab.setAttribute('aria-controls','cff-mode-tab-'+key)}
      if(body){body.id='cff-mode-tab-'+key;const note=document.createElement('p');note.className='cff-options-hint';note.textContent=hint;body.prepend(note)}
    }
    const wiki=$('v90-tournament-wiki-key')?.closest('.v76-box');if(wiki){const details=document.createElement('details');details.className='cff-mode-advanced';const summary=document.createElement('summary');summary.textContent='Código Wiki deste dia (opcional)';wiki.before(details);details.append(summary,wiki)}
    const tabs=panel.querySelector('.v76-tabs'),syncTabs=()=>tabs?.querySelectorAll('[data-v76-tab]').forEach(tab=>tab.setAttribute('aria-current',tab.classList.contains('active')?'page':'false'));tabs?.addEventListener('click',syncTabs);syncTabs();
  }
  document.addEventListener('click',event=>{if(event.target.closest('#v76-tournament-button,[data-admin-tab]'))decorateTournamentPanel()});
  function refreshStatus(event){
    const state=event?.detail||window.v76TournamentMode?.getState?.(),current=window.CFF_TOURNAMENT_SETUP?.getCurrentSummary?.();
    $('cff-workflow-status').textContent=`${current?.name||'Fase atual'} · ${state?.rosterCodes?.length||0} times no campeonato · ${state?.days?.length||0} dia(s) registrado(s). Auto-save neste navegador; use Baixar backup para guardar uma cópia.`;
  }
  window.addEventListener('v76:tournament-state',refreshStatus);window.addEventListener('cff:camp-phases-rendered',refreshStatus);decorateTournamentPanel();refreshStatus();
  window.CFF_CAMP_WORKSPACE={refreshStatus};
})();
