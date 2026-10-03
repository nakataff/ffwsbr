(function(){
  'use strict';
  const style=document.createElement('style');
  style.textContent=`
    .cff-public-wiki-only,.wiki-import-section,.code-actions-grid,#v41-simple-code,#v43-wiki-scope-box,#champion-output-gear,#champion-output-settings{display:none!important}

    body #cff-public-tournament{margin:16px 0;padding:20px;border:1px solid #30445e;border-radius:14px;background:#101b29}
    #cff-public-tournament h3{margin:0;color:#f2f6fc;font-size:1.12rem}#cff-public-tournament h4{margin:18px 0 10px;font-size:.85rem;color:#72caff}
    #cff-public-tournament p{margin:6px 0 16px;color:#aebed0;font-size:.8rem;line-height:1.5}
    body #cff-public-tournament .setup-grid,body #cff-public-tournament .cff-public-rules,body #cff-public-tournament .cff-tournament-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important;align-items:start;margin:0}
    #cff-public-tournament .form-group,#cff-public-tournament .cff-tournament-grid>div{min-width:0;width:auto;box-sizing:border-box;padding:12px;border:1px solid #27384e;border-radius:10px;background:#131f2e}
    body #cff-public-tournament .form-group:not(.cff-public-wiki-only){display:flex!important;flex-direction:column}
    #cff-public-tournament label{min-height:0!important;margin:0 0 7px;font-size:.73rem;text-transform:none!important;color:#c8dcf1}
    #cff-public-tournament input:not([type=checkbox]):not([type=radio]),#cff-public-tournament select{width:100%!important;min-width:0!important;max-width:100%;box-sizing:border-box}
    #cff-public-tournament .hint{max-width:none;font-size:.73rem;line-height:1.45;color:#aebed0}
    body #cff-public-tournament .switch,body #v76-tournament-panel .switch{display:flex!important;align-items:center!important;justify-content:flex-start!important;flex-direction:row!important;gap:9px!important;max-width:100%;margin:0;text-transform:none;line-height:1.5}
    body #cff-public-tournament input[type=checkbox],body #v76-tournament-panel input[type=checkbox]{width:16px!important;min-width:16px!important;max-width:16px!important;height:16px!important;flex:0 0 16px;margin:0;padding:0}
    #cff-public-tournament details{margin-top:14px;border:1px solid #27384e;border-radius:10px;padding:12px}#cff-public-tournament summary{cursor:pointer;color:#c4d8ed;font-size:.8rem;font-weight:800}#cff-public-tournament details[open] summary{margin-bottom:12px}
    #cff-public-tournament .v76-switch-row{margin:0 0 12px;padding:10px;background:#131f2e;border-color:#27384e}#cff-public-tournament .v76-switch-row>.hint{display:none}
    .cff-tournament-steps{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.cff-tournament-steps button{flex:1;min-width:140px;padding:11px!important}
    #cff-public-tournament-status{display:block;margin-top:12px;color:#b7c8db;font-size:.78rem;line-height:1.5}
    body #v77-tournament-home,body #v41-simple-teams,body #v76-tournament-button,body #v76-open-from-table{display:none!important}
    body #auto-time-panel{position:static!important;width:100%!important;min-width:0!important;max-width:none!important;margin:12px 0 0;box-sizing:border-box}
    #auto-time-panel .v19-time-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}#auto-time-panel .v20-days-note{display:none}
    #auto-time-panel .v19-day-row,#auto-time-panel .v19-day-head{grid-template-columns:48px 110px minmax(130px,1fr) 110px 80px!important}
    body #v76-tournament-panel{box-sizing:border-box;padding:20px}#v76-tournament-panel .v76-dialog{max-width:960px;min-width:0}
    #v76-tournament-panel .v76-dialog-body{padding:18px}#v76-tournament-panel .v76-day-current{grid-template-columns:80px minmax(0,1fr) 170px}
    #v76-tournament-panel input:not([type=checkbox]),#v76-tournament-panel select{min-width:0;width:100%;box-sizing:border-box}
    #v76-tournament-panel .v76-roster-team{display:flex;align-items:center;gap:9px;justify-content:flex-start;font-size:.82rem;min-width:0;text-transform:none}
    #v76-tournament-panel .v76-roster-team span{overflow-wrap:anywhere}#v76-tournament-panel .v76-roster-team small{margin-left:auto}
    #cff-public-new-team{margin:0 0 16px;padding:12px;border:1px solid #30445e;border-radius:10px}#cff-public-new-team summary{cursor:pointer;font-weight:800;color:#78caff}
    #cff-public-new-team .v41-simple-add-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}#cff-public-new-team .v41-simple-add-grid>button{grid-column:1/-1;width:auto;padding:10px}
    #cff-public-day-teams{margin-top:12px}#cff-public-day-teams summary{cursor:pointer;color:#78caff;font-weight:800}#cff-public-day-team-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin-top:10px}
    #cff-public-day-team-list label{display:flex;align-items:center;gap:8px;padding:9px;border:1px solid #343b47;border-radius:8px;margin:0;font-size:.8rem;text-transform:none}
    @media(max-width:1000px){body #cff-public-tournament .setup-grid,body #cff-public-tournament .cff-public-rules,body #cff-public-tournament .cff-tournament-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
    @media(max-width:600px){body #cff-public-tournament{padding:12px}body #cff-public-tournament .setup-grid,body #cff-public-tournament .cff-public-rules,body #cff-public-tournament .cff-tournament-grid{grid-template-columns:minmax(0,1fr)!important}
    body #v76-tournament-panel{padding:8px}#v76-tournament-panel .v76-dialog-body{padding:12px}#v76-tournament-panel .v76-day-current,#v76-tournament-panel .v76-participation,#v76-tournament-panel .v76-general-grid{grid-template-columns:minmax(0,1fr)}
    #auto-time-panel .v19-time-grid,#auto-time-panel .v19-day-row{grid-template-columns:minmax(0,1fr)!important}#auto-time-panel .v19-day-head{display:none!important}#cff-public-new-team .v41-simple-add-grid{grid-template-columns:minmax(0,1fr)}
    #v76-tournament-panel .v76-day-item{grid-template-columns:minmax(0,1fr)}#v76-tournament-panel .v76-roster-tools{grid-template-columns:minmax(0,1fr)}}
  `;document.head.appendChild(style);
  function setText(el,text){if(el&&el.textContent!==text)el.textContent=text;}

  const byId=id=>document.getElementById(id);
  const api=()=>window.v76TournamentMode;
  let dayListKey='';
  const importedRosterTeams=new Map();
  function openTournament(tab){
    api()?.open?.();document.querySelector('[data-v76-tab="'+tab+'"]')?.click();
    setText(document.querySelector('#v76-tournament-panel .v76-dialog-head h3'),{roster:'Times do campeonato',days:'Dias e participantes',general:'Tabela geral'}[tab]);
    setupTeamWindow();
  }
  function setupTeamWindow(){
    const panel=document.querySelector('[data-v76-panel="roster"]');
    const add=document.querySelector('.v41-simple-add-grid');
    if(panel&&add&&!byId('cff-public-new-team')){
      const box=document.createElement('details');box.id='cff-public-new-team';box.innerHTML='<summary>+ Adicionar um novo time</summary>';
      panel.prepend(box);box.append(add);const status=byId('v41-simple-team-status');if(status)box.append(status);
      setText(byId('v41-team-code')?.previousElementSibling,'Código (opcional)');
      byId('v41-team-code').placeholder='Preenchido automaticamente';
      const fillCode=()=>{
        const name=byId('v41-team-name')?.value.trim(),code=byId('v41-team-code');
        if(name&&code&&!code.value.trim())code.value=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'time-'+Date.now();
      };
      byId('v41-add-team')?.addEventListener('click',fillCode,true);
      add.addEventListener('keydown',event=>{if(event.key==='Enter')fillCode();},true);
      byId('v41-add-team')?.addEventListener('click',()=>{
        if(byId('v41-team-name')?.value)return;
        byId('v76-add-current-teams')?.click();api()?.refresh?.();dayListKey='';schedule();
      });
    }
    const participation=byId('v76-current-participation');
    if(participation&&!byId('cff-public-day-teams')){
      const box=document.createElement('details');box.id='cff-public-day-teams';box.innerHTML='<summary>Escolher os times que jogam neste dia</summary><div id="cff-public-day-team-list"></div>';
      participation.after(box);
      box.addEventListener('change',event=>{
        if(!event.target.matches('[data-cff-day-team]'))return;
        const selected=[...box.querySelectorAll('input:checked')].map(input=>input.value);
        api()?.setDraftActiveCodes?.(selected,{capture:true});dayListKey='';schedule();
      });
    }
    const state=api()?.getState?.();const list=byId('cff-public-day-team-list');
    const roster=byId('v76-roster-list');
    if(roster&&!byId('cff-public-use-roster')){
      const actions=document.createElement('div');actions.className='v76-actions';actions.style.marginTop='12px';
      const button=document.createElement('button');button.id='cff-public-use-roster';button.type='button';button.className='btn-save';button.style.cssText='width:auto;padding:10px 14px';button.textContent='Usar estes times e definir descansos';
      actions.append(button);roster.parentElement.append(actions);
      button.addEventListener('click',()=>{api()?.useFullRoster?.({capture:true});dayListKey='';openTournament('days');byId('cff-public-day-teams').open=true;});
    }
    if(state&&roster){
      (state.rosterCodes||[]).forEach(code=>{if(!importedRosterTeams.has(code))importedRosterTeams.set(code,api()?.getTeamByCode?.(code)||{name:code});});
      const existing=new Set([...roster.querySelectorAll('input')].map(input=>input.value)),query=(byId('v76-roster-search')?.value||'').trim().toLowerCase();
      importedRosterTeams.forEach((team,code)=>{
        if(existing.has(code)||![team.name,team.abbr,code].some(value=>String(value||'').toLowerCase().includes(query)))return;
        const label=document.createElement('label'),input=document.createElement('input'),name=document.createElement('span');label.className='v76-roster-team';input.type='checkbox';input.value=code;input.checked=state.rosterCodes.includes(code);name.textContent=team.name||code;label.append(input,name);roster.prepend(label);
      });
    }
    if(state&&list){
      const active=new Set(api()?.getCurrentActiveCodes?.()||[]);
      const key=JSON.stringify([state.rosterCodes,[...active]]);
      if(key!==dayListKey){
        dayListKey=key;list.replaceChildren();
        (state.rosterCodes||[]).forEach(code=>{const label=document.createElement('label'),input=document.createElement('input'),name=document.createElement('span');input.type='checkbox';input.value=code;input.checked=active.has(code);input.dataset.cffDayTeam='';name.textContent=api()?.getTeamByCode?.(code)?.name||code;label.append(input,name);list.append(label)});
      }
    }
  }
  function tournamentGuide(){
    const grid=document.querySelector('.setup-grid'),host=document.querySelector('.setup-actions-bar');if(!grid||!host)return;
    let card=byId('cff-public-tournament');
    if(!card){
      card=document.createElement('section');card.id='cff-public-tournament';
      card.innerHTML='<h3>Configurações do campeonato</h3><p>Defina os dias e os times. Depois lance as quedas e registre o resultado de cada dia.</p><div id="cff-public-basic"></div><h4>Times e descansos</h4><div id="cff-public-tournament-switch"></div><div class="cff-tournament-grid" id="cff-public-team-settings"></div><div class="cff-tournament-steps"><button type="button" class="btn-mini" data-cff-tournament-tab="roster">👥 Adicionar / escolher times</button><button type="button" class="btn-mini" data-cff-tournament-tab="days">📅 Dias e participantes</button><button type="button" class="btn-mini" data-cff-tournament-tab="general">🏆 Tabela geral</button></div><span id="cff-public-tournament-status"></span><details id="cff-public-advanced"><summary>Regras da final e opções avançadas</summary><div class="cff-public-rules" id="cff-public-rule-settings"></div></details>';
      grid.before(card);byId('cff-public-basic').append(grid);
      for(const group of [...grid.children]){
        if(!group.querySelector('#tournament-name,#match-date,#num-quedas,#tournament-days'))byId('cff-public-rule-settings').append(group);
      }
      const time=byId('auto-time-panel');if(time)byId('cff-public-basic').append(time);
      card.addEventListener('click',event=>{const button=event.target.closest('[data-cff-tournament-tab]');if(button)openTournament(button.dataset.cffTournamentTab)});
    }
    // Move the original controls once; their existing listeners and backup IDs stay intact.
    const target=byId('cff-public-team-settings');
    for(const id of ['v76-expected-teams','v76-teams-per-round']){
      const input=byId(id);if(input&&input.parentElement.parentElement!==target){
        const group=input.parentElement;target.append(group);
        input.addEventListener('change',()=>{
          const total=Math.max(1,Number(byId('v76-expected-teams').value)||1),playing=byId('v76-teams-per-round');
          if(Number(playing.value)>total){playing.value=total;playing.dispatchEvent(new Event('change',{bubbles:true}));}
        });
      }
    }
    if(!byId('cff-public-rest-count')&&byId('v76-expected-teams')){
      const group=document.createElement('div');group.innerHTML='<label for="cff-public-rest-count">Descansam por dia</label><input type="number" id="cff-public-rest-count" min="0"><div class="hint">Total de times menos os que jogam.</div>';target.append(group);
      byId('cff-public-rest-count').addEventListener('change',event=>{
        const total=Math.max(1,Number(byId('v76-expected-teams').value)||1);
        const rest=Math.min(total-1,Math.max(0,Number(event.target.value)||0));
        const playing=byId('v76-teams-per-round');playing.value=total-rest;playing.dispatchEvent(new Event('change',{bubbles:true}));
      });
    }
    const switchRow=document.querySelector('#v76-tournament-panel .v76-switch-row');if(switchRow)byId('cff-public-tournament-switch').append(switchRow);
    const otherGrid=document.querySelector('#v76-tournament-panel .v76-top-grid');
    if(otherGrid){for(const group of [...otherGrid.children]){group.classList.add('form-group');byId('cff-public-rule-settings').append(group)}otherGrid.remove();}
    const state=api()?.getState?.();if(!state)return;
    const rest=byId('cff-public-rest-count');
    if(rest){rest.max=Math.max(0,state.config.expectedTeams-1);if(document.activeElement!==rest)rest.value=Math.max(0,state.config.expectedTeams-state.config.teamsPerRound);}
    setText(byId('v76-expected-teams')?.previousElementSibling,'Total de times');setText(byId('v76-teams-per-round')?.previousElementSibling,'Jogam por dia');
    const playing=byId('v76-teams-per-round');if(playing)playing.max=state.config.expectedTeams;
    setText(byId('cff-public-tournament-status'),`${state.rosterCodes?.length||0} de ${state.config.expectedTeams} times escolhidos • ${api()?.getCurrentActiveCodes?.().length||0} jogando agora • ${state.days?.length||0} dia(s) registrado(s).`);
    setupTeamWindow();
  }
  function polish(){
    tournamentGuide();
    document.querySelectorAll('#auto-time-panel .hint,#auto-time-panel .v19-day-help,#auto-time-panel .v22-day-help').forEach(el=>{setText(el,'Defina as quedas, a data e o horário inicial de cada dia. O intervalo é aplicado automaticamente.');});
    setText(document.getElementById('v41-mode-help'),document.body.classList.contains('v41-simple-mode')?'Times, lançamento de quedas e tabela.':document.body.classList.contains('v41-tournament-mode')?'Elenco, dias e classificação geral.':'Configuração, lançamento de quedas, tabelas e backups.');
    for(const id of ['game-detail-mode','match-key','matchlist-id','default-abbr','match-extra']){
      document.getElementById(id)?.closest('.form-group')?.classList.add('cff-public-wiki-only');
    }
    document.querySelectorAll('.match-bg-config').forEach(el=>el.classList.add('cff-public-wiki-only'));
    document.getElementById('v90-tournament-wiki-key')?.closest('.v76-box')?.classList.add('cff-public-wiki-only');
    const help=document.getElementById('final-mode-help');
    setText(help,document.getElementById('final-mode')?.value==='champion'?'Após atingir a pontuação mínima, o time precisa vencer uma queda para ser campeão.':'O campeão é definido pela pontuação total e pelos critérios de desempate.');
    setText(document.getElementById('tournament-days')?.closest('.form-group')?.querySelector('.hint'),'Defina quantos dias o campeonato terá. Você pode acompanhar a tabela do dia e a geral.');
    setText(document.getElementById('starting-enabled')?.closest('.form-group')?.querySelector('label'),'Bônus iniciais');
    document.querySelectorAll('.hint,.v76-status').forEach(el=>{
      if(el.children.length>0&&!el.matches('.hint'))return;
      const text=el.textContent;
      if(text.includes('Isso não entra no código Wiki do dia.'))setText(el,'Exemplo: 1º–12º classificados e 13º–14º rebaixados. Personalize as marcações na tabela geral.');
    });
    const warning=document.querySelector('#map-warning span');
    if(warning&&/wiki/i.test(warning.textContent))setText(warning,'⚠️ Selecione o mapa desta queda, se quiser exibi-lo na tabela.');
    document.getElementById('drop-opt-simple-kills-row')?.setAttribute('title','Exibe e soma os abates na tabela.');
    setText(document.querySelector('[data-v76-tab="roster"]'),'1. Times');setText(document.querySelector('[data-v76-tab="days"]'),'2. Dias e descansos');
    byId('v76-close-panel')?.setAttribute('aria-label','Fechar configurações');
  }
  let timer=0;
  const schedule=()=>{if(timer)return;timer=setTimeout(()=>{timer=0;polish();},80);};
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('change',schedule,{passive:true});polish();
})();
