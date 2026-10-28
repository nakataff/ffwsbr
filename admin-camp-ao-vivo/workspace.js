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
    if(document.body.classList.contains('v41-complete-mode')&&(go==='roster'||go==='days')){
      reveal(go==='roster'?document.querySelector('.teams-setup'):$('cff-final-schedule'));
    }else if(go==='roster'||go==='days'){
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
  if(modes){
    const chooser=document.createElement('section');chooser.id='cff-camp-mode-chooser';chooser.setAttribute('aria-labelledby','cff-camp-mode-title');chooser.innerHTML='<div class="cff-mode-heading"><span>COMECE AQUI</span><h2 id="cff-camp-mode-title">O que você vai organizar?</h2></div>';nav.before(chooser);chooser.append(modes);
    const descriptions={complete:['Modo completo','Apenas a final','Formato, dias, quedas e horários.'],tournament:['Modo torneio','Classificatória + final','Rodadas, equipes em descanso e classificados.']};
    for(const [mode,[title,subtitle,description]] of Object.entries(descriptions)){const button=modes.querySelector(`[data-v41-mode="${mode}"]`);if(button){button.innerHTML=`<span class="cff-mode-option-title">${title}</span><strong>${subtitle}</strong><small>${description}</small>`;button.setAttribute('aria-pressed',String(button.classList.contains('active')))}}
    const simple=modes.querySelector('[data-v41-mode="simple"]');if(simple){const more=document.createElement('details');more.className='cff-mode-extra';const summary=document.createElement('summary');summary.textContent='Mais opções';more.append(summary,simple);modes.append(more)}
  }
  const command=document.querySelector('.cff-camp-command');
  if(command){
    const details=document.createElement('details');details.id='cff-camp-import-tools';const summary=document.createElement('summary');summary.textContent='Começar com uma base, importar ou trocar campeonato';details.append(summary);nav.before(details);details.append(command);
    const saved=document.querySelector('.v37-stage-wrap'),clear=$('v37-clear-all'),tools=document.createElement('div');tools.className='cff-file-tools';
    if(saved){tools.append(saved);const button=$('v37-stage-button');if(button)button.textContent='Campeonatos salvos neste navegador'}
    if(clear)tools.append(clear);details.append(tools);
  }
  const finalOptions=document.createElement('section');finalOptions.id='cff-final-options';finalOptions.className='cff-setup-section';finalOptions.innerHTML='<header><h3>Formato e Champion Rush</h3><p>Escolha como o campeão será definido.</p></header><div class="cff-final-fields"></div><div id="cff-final-unlimited"></div>';
  const schedule=document.createElement('details');schedule.id='cff-final-schedule';schedule.className='cff-setup-section';schedule.open=true;schedule.innerHTML='<summary>Dias e horários</summary><p class="cff-options-hint">Preencha a data, o horário inicial e a quantidade de quedas de cada dia. O intervalo monta os horários seguintes.</p>';
  const rounds=document.createElement('details');rounds.id='cff-current-round-settings';rounds.className='cff-setup-section';rounds.innerHTML='<summary>Ajustes da rodada aberta</summary><div class="cff-round-fields"></div>';
  const tournamentSteps=document.createElement('section');tournamentSteps.id='cff-tournament-steps';tournamentSteps.className='cff-tournament-steps';tournamentSteps.innerHTML='<article><small>1 · CLASSIFICATÓRIA</small><h3>Organize as rodadas</h3><p>Defina as fases e quantos avançam. Escolha as equipes que jogam e descansam em cada rodada.</p><div><button class="btn-mini" type="button" data-setup-open="roster">Escolher equipes</button><button class="btn-mini cff-primary-action" type="button" data-setup-open="days">Rodadas e descansos</button></div></article><article><small>2 · FINAL</small><h3>Deixe a final preparada</h3><p>Escolha o formato, os dias e as quedas da final. Quando a classificatória terminar, avance com os classificados.</p><button class="btn-mini" type="button" data-setup-open="final">Configurar a final</button></article>';
  const basic=$('cff-admin-basic');basic.after(finalOptions,tournamentSteps,rounds);$('cff-phase-details').after(schedule);
  const group=id=>$(id)?.closest('.form-group'),dateGroup=group('match-date'),dropGroup=group('num-quedas'),dayGroup=group('tournament-days'),pointGroup=group('champion-point'),timePanel=$('auto-time-panel');let formatGroup=group('final-mode');
  const basicGrid=basic.querySelector('.setup-grid');
  if(formatGroup)finalOptions.querySelector('.cff-final-fields').append(formatGroup);if(pointGroup)finalOptions.querySelector('.cff-final-fields').append(pointGroup);
  const unlimited=$('v68-champion-rush-unlimited')?.closest('.v68-champion-toggle');if(unlimited)$('cff-final-unlimited').append(unlimited);
  const indication=$('champion-enabled')?.closest('label');if(indication)indication.classList.add('cff-legacy-indication');
  if(timePanel){schedule.append(timePanel);timePanel.classList.add('open')}
  window.toggleV19TimePanel=function(){schedule.open=!schedule.open;if(schedule.open)reveal(schedule)};
  const importTools=$('cff-camp-import-tools');for(const id of ['cff-final-import','cff-phase-recover'])if($(id)&&importTools)importTools.append($(id));
  const advanced=$('cff-admin-advanced');if(advanced)advanced.querySelector('summary').textContent='Opções extras e código Wiki';
  const finalNote=$('cff-complete-final-note');if(finalNote)finalNote.classList.add('cff-final-note-replaced');
  const basicActions=basic.querySelector('.setup-actions-bar');if(basicActions){
    const oldTournament=basicActions.querySelector('#v76-tournament-button');if(oldTournament)oldTournament.hidden=true;
    const clear=basicActions.querySelector('[onclick="clearTournamentSetupFields()"]');if(clear){const details=document.createElement('details');details.className='cff-reset-fields';const summary=document.createElement('summary');summary.textContent='Limpar campos';details.append(summary,clear);basicActions.prepend(details)}
    const save=basicActions.querySelector('[onclick="quickSaveTopFields()"]');if(save)save.textContent='Salvar configurações';
  }
  function fieldLabel(container,text){const label=container?.querySelector('label');if(label)label.textContent=text}
  fieldLabel(formatGroup,'Formato da final');const championOption=$('final-mode')?.querySelector('option[value="champion"]');if(championOption)championOption.textContent='Champion Rush';
  fieldLabel(pointGroup,'Pontos para ativar o Champion Rush');fieldLabel(dayGroup,'Quantidade de dias');fieldLabel(dropGroup,'Quedas previstas');fieldLabel(dateGroup,'Data de início');
  function syncSetup(){
    if(!formatGroup){formatGroup=group('final-mode');if(formatGroup){finalOptions.querySelector('.cff-final-fields').prepend(formatGroup);fieldLabel(formatGroup,'Formato da final');const option=$('final-mode').querySelector('option[value="champion"]');if(option)option.textContent='Champion Rush'}}
    const complete=document.body.classList.contains('v41-complete-mode'),tournament=document.body.classList.contains('v41-tournament-mode');
    finalOptions.hidden=!complete;tournamentSteps.hidden=!tournament;rounds.hidden=!tournament;schedule.hidden=!(complete||tournament);
    if(dayGroup)dayGroup.hidden=!complete;
    for(const item of [dateGroup,dropGroup])if(item)(tournament?rounds.querySelector('.cff-round-fields'):basicGrid).append(item);
    const phaseDetails=$('cff-phase-details');if(phaseDetails){phaseDetails.hidden=!tournament;phaseDetails.querySelector('summary').textContent='Fases da classificatória e da final'}
    const headline=setup.querySelector('header h2');if(headline)headline.textContent=complete?'1. Configurar a final':tournament?'1. Configurar o torneio':'Configurações';
    if(indication)indication.hidden=complete;
    const champion=$('final-mode')?.value==='champion';if(pointGroup)pointGroup.classList.toggle('cff-rule-inactive',!champion);
    if($('champion-point'))$('champion-point').disabled=complete&&!champion;if($('v68-champion-rush-unlimited'))$('v68-champion-rush-unlimited').disabled=complete&&!champion;
    schedule.querySelector('summary').textContent=complete?'Dias e horários da final':'Horários da rodada aberta';
    for(const button of modes?.querySelectorAll('[data-v41-mode]')||[])button.setAttribute('aria-pressed',String(button.classList.contains('active')));
    const labels=complete?['Final','Equipes','Dias e horários','Lançar quedas','Tabelas e exportar']:['Fases','Equipes','Rodadas e descansos','Lançar quedas','Tabelas e exportar'];
    nav.querySelectorAll('[data-camp-go] span').forEach((span,i)=>span.textContent=labels[i]);
    const add=$('cff-add-phase'),plan=window.CFF_TOURNAMENT_SETUP?.getPlan?.();if(add)add.textContent=plan?.phases?.some(p=>p.advance===0)?'+ Adicionar outra fase':'+ Preparar a final';
  }
  setup.addEventListener('click',event=>{
    const action=event.target.closest('[data-setup-open]')?.dataset.setupOpen;if(!action)return;
    if(action==='final'){
      let plan=window.CFF_TOURNAMENT_SETUP?.getPlan?.(),final=plan?.phases?.find(p=>p.advance===0);
      if(!final){$('cff-add-phase')?.click();plan=window.CFF_TOURNAMENT_SETUP?.getPlan?.();final=plan?.phases?.at(-1)}
      const details=[...setup.querySelectorAll('[data-phase]')].find(el=>el.dataset.phase===final?.id);if(details){$('cff-phase-details').open=true;details.open=true;reveal(details);details.querySelector('[data-field="format"]')?.focus()}
    }else{window.v76TournamentMode?.open?.();decorateTournamentPanel();document.querySelector(`[data-v76-tab="${action}"]`)?.click()}
  });
  window.addEventListener('cff:camp-interface-change',syncSetup);window.addEventListener('cff:camp-phases-rendered',syncSetup);
  window.addEventListener('cff:camp-final-controls-ready',syncSetup);
  document.addEventListener('change',event=>{if(event.target?.id==='final-mode')syncSetup()});syncSetup();
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
