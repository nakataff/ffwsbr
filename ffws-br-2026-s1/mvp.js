/* MVP da S1: resumo por dia, independente dos módulos antigos da temporada. */
(() => {
  'use strict';
  const root=document.getElementById('cff-s1-mvp-root');
  if(!root)return;
  const url='/ffws-br-2026-s1/mvp-resumo.json?v=20261106-mvp-rankings-v1';
  const size=10,fmt=value=>value.toLocaleString('pt-BR');
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state={stage:'0',team:'',role:'',rookie:'',day:'',sort:'kills',direction:-1,page:0,details:false};
  const labels={classificatoria:'Classificatória',final:'Final'};
  const roles={RUSH:'Rush',GRAN:'Granadeiro',SUP:'Suporte','3':'3º homem'};
  const fields={kills:['Abates','K',r=>r.kills],damage:['Dano','Dano',r=>r.damage],assists:['Assistências','Ast',r=>r.assists],average:['Abates por queda','K/Q',r=>r.kills/r.matches]};
  let data,pending;
  const phaseName=index=>labels[data.stages[index]]||data.stages[index];
  function select(key,label,options){
    return `<label>${label}<select data-s1-mvp-filter="${key}">${options.map(([value,name])=>`<option value="${esc(value)}"${String(value)===state[key]?' selected':''}>${esc(name)}</option>`).join('')}</select></label>`;
  }
  function header(key,extra=''){
    const [label,short]=fields[key],active=key===state.sort;
    return `<th scope="col" ${extra}${active?' aria-sort="'+(state.direction<0?'descending':'ascending')+'"':''}><button type="button" class="cff-mvp-sort" aria-label="Ordenar por ${label}" data-mvp-column="${key}"><b class="cff-mvp-long">${key==='average'?'K/Q':label}</b><b class="cff-mvp-short">${short}</b><span aria-hidden="true">${active?(state.direction<0?'↓':'↑'):'↕'}</span></button></th>`;
  }
  function render(){
    const phaseRows=data.days.filter(r=>state.stage===''||String(r[0])===state.stage),sums=new Map();
    const dayKeys=[...new Set(phaseRows.map(([phase,day])=>phase+':'+day))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    const days=dayKeys.map(key=>{const [phase,day]=key.split(':');return [key,`${state.stage===''?phaseName(phase)+' · ':''}Dia ${day}`];});
    for(const [phase,day,id,kills,damage,assists,matches,mvps] of phaseRows){
      const [name,team,role,rookie]=data.roster[id];
      if((state.day&&state.day!==phase+':'+day)||(state.team&&state.team!==String(team))||
         (state.role&&state.role!==role)||(state.rookie&&state.rookie!==String(rookie)))continue;
      const row=sums.get(id)||{name,team,kills:0,damage:0,assists:0,matches:0,mvps:0};
      row.kills+=kills;row.damage+=damage;row.assists+=assists;row.matches+=matches;row.mvps+=mvps;sums.set(id,row);
    }
    const metric=fields[state.sort][2];
    const rows=[...sums.values()].sort((a,b)=>state.direction*(metric(a)-metric(b))||b.kills-a.kills||b.damage-a.damage||a.name.localeCompare(b.name,'pt-BR'));
    const start=state.page*size,end=Math.min(start+size,rows.length);
    const shown=rows.slice(start,end).map((r,i)=>{
      const [team,abbr,logo]=data.teams[r.team],rank=start+i+1;
      const link='/jogador.html?'+new URLSearchParams({jogador:r.name,time:team});
      return `<tr class="ffws-s2-mvp-main-row"><td class="ffws-s2-mvp-rank-col">${rank}º</td><td class="team-col ffws-s2-mvp-player-col"><a class="ffws-s2-inline-link" href="${esc(link)}">${esc(r.name)}</a></td><td><span class="ffws-s2-team-cell" title="${esc(team)}"><img src="/${esc(logo)}" alt="${esc(abbr)}" loading="lazy" width="28" height="28"><span class="ffws-s2-team-name">${esc(abbr)}</span></span></td><td>${r.kills}</td><td>${fmt(r.damage)}</td><td>${r.assists}</td><td>${r.matches}</td><td class="hide-mobile">${r.mvps}</td><td class="hide-mobile">${(r.kills/r.matches).toFixed(2)}</td></tr><tr class="ffws-s2-mvp-details-row"><td colspan="9"><div class="ffws-s2-mvp-details-grid"><div><span>Posição</span><strong>${rank}º</strong></div><div><span>MVP da queda</span><strong>${r.mvps}</strong></div><div><span>Abates por queda</span><strong>${(r.kills/r.matches).toFixed(2)}</strong></div></div></td></tr>`;
    }).join('');
    root.innerHTML=`<div class="ffws-s2-shell"><header class="ffws-s2-hero"><div class="ffws-s2-kicker">FFWS BRASIL 2026 SPLIT 1</div><h1>Ranking MVP</h1><p>Classificação individual da WB 2026 S1</p></header>
    <section class="ffws-s2-panel ffws-s2-mvp-panel${state.details?' show-details':''}"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Classificação Geral de Jogadores</h2><p>Filtre o ranking e toque nas setas das colunas para ordenar.</p></div><span class="ffws-s2-badge">${rows.length} jogadores</span></div>
    <div class="cff-s1-mvp-filters">${select('stage','Etapa',[['','Geral'],...data.stages.map((_,i)=>[i,phaseName(i)])])}${select('team','Equipe',[['','Todas'],...data.teams.map(([name],i)=>[i,name]).sort((a,b)=>a[1].localeCompare(b[1],'pt-BR'))])}${select('role','Posição',[['','Todas'],...Object.entries(roles).filter(([role])=>data.roster.some(p=>p[2]===role))])}${select('rookie','Novatos',[['','Todos'],['1','Apenas novatos'],['0','Sem novatos']])}${select('day','Dia',[['','Todos'],...days])}</div>
    <div class="ffws-s2-mvp-mobile-tools"><button type="button" class="ffws-s2-mvp-details-toggle" data-s1-mvp-details aria-expanded="${state.details}">${state.details?'Ocultar detalhes':'Dados completos'}</button></div>
    <div class="ffws-s2-table-wrap"><table class="ffws-s2-table ffws-s2-mvp-table" data-mvp-table><thead><tr><th class="ffws-s2-mvp-rank-col">#</th><th class="team-col"><span class="ffws-s2-desktop">Jogador</span><span class="ffws-s2-mobile">J</span></th><th><span class="ffws-s2-desktop">Equipe</span><span class="ffws-s2-mobile">E</span></th>${header('kills')}${header('damage')}${header('assists')}<th>Q</th><th class="hide-mobile">MVP</th>${header('average','class="hide-mobile"')}</tr></thead><tbody>${shown||'<tr><td colspan="9">Nenhum resultado para este recorte.</td></tr>'}</tbody></table></div>
    ${rows.length>size?`<div class="ffws-s2-mvp-pager"><button type="button" aria-label="Página anterior" data-s1-mvp-page="-1"${start?'':' disabled'}>‹</button><span>${start+1}–${end} de ${rows.length}</span><button type="button" aria-label="Próxima página" data-s1-mvp-page="1"${end<rows.length?'':' disabled'}>›</button></div>`:''}
    </div></section></div>`;
  }
  function rerender(selector){render();root.querySelector(selector)?.focus({preventScroll:true});}
  root.addEventListener('change',event=>{
    const key=event.target.dataset.s1MvpFilter;if(!key)return;
    state[key]=event.target.value;if(key==='stage')state.day='';
    state.page=0;rerender(`[data-s1-mvp-filter="${key}"]`);
  });
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    const key=button.dataset.mvpColumn,step=button.dataset.s1MvpPage;
    if(key){state.direction=state.sort===key?-state.direction:-1;state.sort=key;state.page=0;rerender(`[data-mvp-column="${key}"]`);}
    else if(step){state.page+=Number(step);rerender(`[data-s1-mvp-page="${step}"]`);}
    else if(button.hasAttribute('data-s1-mvp-details')){state.details=!state.details;rerender('[data-s1-mvp-details]');}
  });
  window.cffS1MvpBoot=async()=>{
    if(!data){
      pending ||= fetch(url,{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('Ranking indisponível');return r.json();})
        .then(value=>{if(value.version!==1||!Array.isArray(value.days))throw Error('Ranking inválido');return value;}).finally(()=>{pending=null;});
      data=await pending;
    }
    render();return true;
  };
})();
