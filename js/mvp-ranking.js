/* A single MVP table and filter controller for all three 2026 editions. */
(() => {
  'use strict';
  if(window.CFFMvpRanking)return;
  const editions={
    s1:{path:'ffws-br-2026-s1',prefix:'ffws-s2',kicker:'FFWS BRASIL 2026 SPLIT 1',title:'WB 2026 S1',filters:['stage','team','role','rookie','day'],initial:['0'],date:'2026-03-21'},
    s2:{path:'ffws-br-2026-s2',prefix:'ffws-s2',kicker:'FFWS BRASIL 2026 SPLIT 2',title:'WB 2026 S2',filters:['stage','team','role','country','rookie','day'],date:'2026-08-01'},
    global:{path:'ffws-global-2026',prefix:'ffws-global',kicker:'FFWS GLOBAL FINALS 2026',title:'FFWS Global Finals 2026',filters:['stage','day','round','team','role','country'],date:'2026-11-06'}
  };
  const names={stage:'Etapa',team:'Equipe',role:'Posição',country:'País',rookie:'Novatos',day:'Dia',round:'Rodada'};
  const phases={classificatoria:'Classificatória',segundaFase:'Segunda fase',lastChance:'Repescagem',final:'Final'};
  const worldPhases={classificatoria:'Knockout · Fase 1',segundaFase:'Knockout · Fase 2',lastChance:'Repescagem',final:'Grande Final'};
  const metrics={kills:['Abates','K',r=>r.kills],damage:['Dano','Dano',r=>r.damage],assists:['Assistências','Ast',r=>r.assists],average:['Abates por queda','K/Q',r=>r.kills/r.matches]};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const format=new Intl.NumberFormat('pt-BR'),countries=typeof Intl.DisplayNames==='function'?new Intl.DisplayNames(['pt-BR'],{type:'region'}):null;
  const pages=new WeakMap(),cache=new Map(),pageSize=10;
  const shortDate=date=>String(date||'').slice(5).split('-').reverse().join('/');
  const asset=value=>{
    const path=String(value||'').replace(/^\//,'');
    return path&&!/[:\\]/.test(path)&&!path.split('/').includes('..')?'/'+path:'/escudo.webp';
  };
  function load(key,config){
    if(!cache.has(key))cache.set(key,fetch('/'+config.path+'/mvp-resumo.json?v=20261106-shared-mvp-v1',{cache:'default'})
      .then(r=>{if(!r.ok)throw Error('Ranking indisponível');return r.json();})
      .then(data=>{if(data.version!==2||data.edition!==key||!Array.isArray(data.rows))throw Error('Ranking inválido');return data;})
      .catch(error=>{cache.delete(key);throw error;}));
    return cache.get(key);
  }
  function setup(key,config,data){
    const phaseName=i=>(key==='global'?worldPhases:phases)[data.stages[i]]||data.stages[i];
    const stageOf=stage=>data.stages.indexOf(stage);
    const dayName=(stage,day)=>{
      if(key==='s2')return 'Dia '+(day+({segundaFase:14,final:20}[data.stages[stage]]||0));
      if(key==='s1')return phaseName(stage)+' · Dia '+day;
      return 'Dia '+day+' · '+shortDate(data.periods.find(p=>p.stage===data.stages[stage]&&p.day===day)?.date);
    };
    const dayKeys=new Map(),roundKeys=new Map();
    for(const [stage,day,round] of data.rows){dayKeys.set(stage+':'+day,[stage,day]);roundKeys.set(stage+':'+round,[stage,round]);}
    const options={
      stage:data.stages.map((_,i)=>[String(i),phaseName(i)]),
      team:data.teams.map(([name],i)=>[String(i),name]).sort((a,b)=>a[1].localeCompare(b[1],'pt-BR')),
      role:Object.entries({RUSH:'Rush',SUP:key==='global'?'Suporte / Sniper':'Suporte',GRAN:'Granadeiro','3':'3º homem'}).filter(([value])=>data.players.some(p=>p[2]===value)),
      rookie:[['1','Apenas novatos'],['0','Sem novatos']],
      country:[...new Set(data.players.map(p=>p[4]).filter(v=>/^[a-z]{2}$/.test(v)))].map(v=>[v,countries?.of(v.toUpperCase())||v.toUpperCase()]).sort((a,b)=>a[1].localeCompare(b[1],'pt-BR')),
      day:[...dayKeys.entries()].sort((a,b)=>a[1][0]-b[1][0]||a[1][1]-b[1][1]).map(([id,[stage,day]])=>[id,dayName(stage,day)]),
      round:data.periods.filter(p=>roundKeys.has(stageOf(p.stage)+':'+p.round)).map(p=>{
        const label=p.stage==='classificatoria'?'Rodada '+(p.session||p.round)+(p.groups?.length?' · '+p.groups.join(' × '):''):worldPhases[p.stage]+' · Dia '+p.day;
        return [stageOf(p.stage)+':'+p.round,label+' · '+shortDate(p.date)];
      })
    };
    const filters=Object.fromEntries(config.filters.map(name=>[name,new Set(name==='stage'?config.initial:[])]));
    return {config,data,options,filters,sort:'kills',direction:-1,page:0,details:false};
  }
  function rowsOf(s){
    const totals=new Map(),{data,filters}=s;
    const allows=(key,value)=>!filters[key]?.size||filters[key].has(String(value));
    for(const [stage,day,round,id,kills,damage,assists,matches,mvps,best] of data.rows){
      const [name,team,role,rookie,country,profile]=data.players[id];
      if(!allows('stage',stage)||!allows('day',stage+':'+day)||!allows('round',stage+':'+round)||!allows('team',team)||
         !allows('role',role)||!allows('rookie',rookie)||!allows('country',country))continue;
      const row=totals.get(id)||{name,team,profile,kills:0,damage:0,assists:0,matches:0,mvps:0,best:null};
      row.kills+=kills;row.damage+=damage;row.assists+=assists;row.matches+=matches;row.mvps+=mvps;
      if(best!==null)row.best=Math.max(row.best??0,best);
      totals.set(id,row);
    }
    const value=metrics[s.sort][2];
    return [...totals.values()].sort((a,b)=>s.direction*(value(a)-value(b))||b.kills-a.kills||b.damage-a.damage||b.assists-a.assists||a.name.localeCompare(b.name,'pt-BR'));
  }
  function header(s,key,extra=''){
    const [label,short]=metrics[key],active=key===s.sort;
    return `<th scope="col"${extra?' class="'+extra+'"':''}${active?' aria-sort="'+(s.direction<0?'descending':'ascending')+'"':''}><button type="button" class="cff-mvp-sort" aria-label="Ordenar por ${label}" data-mvp-column="${key}"><b class="cff-mvp-long">${key==='average'?'K/Q':label}</b><b class="cff-mvp-short">${short}</b><span aria-hidden="true">${active?(s.direction<0?'↓':'↑'):'↕'}</span></button></th>`;
  }
  function render(root,s){
    const {config:c}=s,p=c.prefix,rows=rowsOf(s),id=c.path+'-mvp';
    const max=Math.max(0,Math.ceil(rows.length/pageSize)-1);
    s.page=Math.max(0,Math.min(max,s.page));
    const start=s.page*pageSize,end=Math.min(start+pageSize,rows.length);
    const filters=c.filters.map(key=>{
      const sel=s.filters[key],opts=s.options[key],first=[...sel][0];
      const label=!opts.length?'Sem dados':sel.size===1?opts.find(([v])=>v===first)?.[1]||first:sel.size?sel.size+' selecionados':'Todos';
      return `<div class="${p}-filter"><span id="${id}-label-${key}">${names[key]}</span><button type="button" data-mvp-filter="${key}" aria-haspopup="dialog" aria-controls="${id}-dialog" aria-labelledby="${id}-label-${key} ${id}-value-${key}"${opts.length?'':' disabled'}><b id="${id}-value-${key}">${esc(label)}</b><span aria-hidden="true">⌄</span></button></div>`;
    }).join('');
    const tableRows=rows.slice(start,end).map((r,i)=>{
      const [team,abbr,logo]=s.data.teams[r.team],rank=start+i+1,average=(r.kills/r.matches).toFixed(2);
      const playerUrl=s.data.edition==='global'?'/ffws-global-2026/jogador?id='+encodeURIComponent(r.profile):'/jogador.html?'+new URLSearchParams({jogador:r.name,time:team});
      return `<tr class="${p}-mvp-main-row"><td class="${p}-rank ${p}-mvp-rank-col">${rank}º</td><td class="team-col ${p}-mvp-player-col"><a class="${p}-inline-link" href="${esc(playerUrl)}">${esc(r.name)}</a></td><td><span class="${p}-team-cell" title="${esc(team)}"><img src="${esc(asset(logo))}" data-team-logo="${esc(team)}" data-team-date="${c.date}" alt="${esc(abbr)}" loading="lazy" width="28" height="28"><span class="${p}-team-name">${esc(abbr)}</span></span></td><td>${r.kills}</td><td>${format.format(r.damage)}</td><td>${r.assists}</td><td>${r.matches}</td><td class="hide-mobile">${r.mvps}</td><td class="hide-mobile">${average}</td></tr>
      <tr class="${p}-mvp-details-row"><td colspan="9"><div class="${p}-mvp-details-grid">${[['Posição',rank+'º'],['MVP da queda',r.mvps],['Abates por queda',average],['Recorde em queda',r.best??'—']].map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('')}</div></td></tr>`;
    }).join('');
    root.innerHTML=`<div class="${p}-shell"><section class="${p}-hero">${s.data.edition==='global'?'<div class="ffws-global-brand"><img src="/ffws-global-2026/Free_Fire_World_Series_2021_icon_allmode.png" width="86" height="67" alt=""><div class="ffws-global-kicker">'+c.kicker+'</div></div>':'<div class="ffws-s2-kicker">'+c.kicker+'</div>'}<h1>Ranking MVP</h1><p>Classificação individual da ${c.title}</p>${s.data.edition==='global'?'<a class="ffws-global-pred-link" href="/interacoes.html#palpites">🎯 Fazer meus palpites ↗</a>':''}</section>
    <section class="${p}-panel ${p}-mvp-panel${s.details?' show-details':''}"><div class="${p}-panel-inner">
      <div class="${p}-panel-head"><div><h2>Classificação Geral de Jogadores</h2><p>Filtre o ranking e toque nas setas das colunas para ordenar.</p></div><span class="${p}-badge" aria-live="polite">${rows.length} jogadores</span></div>
      <div class="${p}-filters cff-mvp-filters">${filters}</div>
      <dialog class="cff-mvp-filter-dialog" id="${id}-dialog" aria-labelledby="${id}-dialog-title"><form>
        <div class="cff-mvp-filter-heading"><h3 id="${id}-dialog-title"></h3><button type="button" data-mvp-close aria-label="Fechar sem aplicar">×</button></div>
        <p>Selecione uma ou mais opções. Sem seleção, o filtro mostra tudo.</p><div class="cff-mvp-filter-options"></div>
        <div class="cff-mvp-filter-actions"><button type="button" data-mvp-clear>Limpar seleção</button><button type="submit">Aplicar</button></div>
      </form></dialog>
      <div class="${p}-mvp-mobile-tools ${p}-mvp-tools"><button type="button" class="${p}-mvp-details-toggle" data-mvp-details aria-expanded="${s.details}">${s.details?'Ocultar detalhes':'Dados completos'}</button></div>
      <div class="${p}-table-wrap"><table class="${p}-table ${p}-mvp-table" data-mvp-table><thead><tr>
        <th class="${p}-mvp-rank-col">#</th><th class="team-col ${p}-mvp-player-col"><span class="${p}-desktop">Jogador</span><span class="${p}-mobile">J</span></th><th><span class="${p}-desktop">Equipe</span><span class="${p}-mobile">E</span></th>
        ${header(s,'kills')}${header(s,'damage')}${header(s,'assists')}<th>Q</th><th class="hide-mobile">MVP</th>${header(s,'average','hide-mobile')}</tr></thead>
        <tbody>${tableRows||'<tr><td colspan="9">Nenhum resultado para este recorte.</td></tr>'}</tbody></table></div>
      ${max?`<div class="${p}-mvp-pager"><button type="button" aria-label="Top 10 anterior" data-mvp-page="-1"${start?'':' disabled'}>‹</button><span>Top ${start+1}–${end} de ${rows.length}</span><button type="button" aria-label="Próximo Top 10" data-mvp-page="1"${s.page<max?'':' disabled'}>›</button></div>`:''}
    </div></section></div>`;
  }
  function bind(root,s){
    const refresh=selector=>{render(root,s);root.querySelector(selector)?.focus({preventScroll:true});};
    root.addEventListener('click',event=>{
      const dialog=root.querySelector('dialog'),button=event.target.closest('button');
      if(event.target===dialog){dialog.close();return;}
      if(!button||button.disabled)return;
      const {mvpFilter:key,mvpColumn:sort,mvpPage:step}=button.dataset;
      if(key){
        dialog.dataset.filter=key;dialog.querySelector('h3').textContent=names[key];
        const list=dialog.querySelector('.cff-mvp-filter-options');
        list.innerHTML=s.options[key].map(([v,label])=>`<label><input type="checkbox" value="${esc(v)}"${s.filters[key].has(v)?' checked':''}><span>${esc(label)}</span></label>`).join('');
        dialog.showModal();list.scrollTop=0;dialog.querySelector('[data-mvp-close]').focus();
      }else if(button.hasAttribute('data-mvp-close'))dialog.close();
      else if(button.hasAttribute('data-mvp-clear'))dialog.querySelectorAll('input:checked').forEach(input=>{input.checked=false;});
      else if(sort){s.direction=s.sort===sort?-s.direction:-1;s.sort=sort;s.page=0;refresh(`[data-mvp-column="${sort}"]`);}
      else if(step){s.page+=Number(step);refresh(`[data-mvp-page="${step}"]:not(:disabled)`);}
      else if(button.hasAttribute('data-mvp-details')){s.details=!s.details;refresh('[data-mvp-details]');}
    });
    root.addEventListener('submit',event=>{
      const dialog=event.target.closest('dialog');if(!dialog)return;
      event.preventDefault();const key=dialog.dataset.filter;
      s.filters[key]=new Set([...dialog.querySelectorAll('input:checked')].map(input=>input.value));
      if(key==='stage'&&s.filters.stage.size){
        for(const period of ['day','round'])for(const id of s.filters[period]||[])if(!s.filters.stage.has(id.split(':')[0]))s.filters[period].delete(id);
      }
      s.page=0;dialog.close();refresh(`[data-mvp-filter="${key}"]`);
    });
    root.addEventListener('error',event=>{
      if(event.target.matches?.('img[data-team-logo]')&&event.target.getAttribute('src')!=='/escudo.webp')event.target.src='/escudo.webp';
    },true);
    const page=root.closest('.page');
    if(page)new MutationObserver(()=>{const dialog=root.querySelector('dialog[open]');if(dialog&&!page.classList.contains('active'))dialog.close();}).observe(page,{attributes:true,attributeFilter:['class']});
  }
  async function boot(root,key){
    if(!root||!editions[key])return false;
    if(pages.has(root))return pages.get(root);
    const config=editions[key];
    root.textContent='Carregando ranking…';
    const request=load(key,config).then(data=>{const state=setup(key,config,data);render(root,state);bind(root,state);return true;})
      .catch(()=>{pages.delete(root);root.textContent='Não foi possível carregar o ranking. ';const retry=document.createElement('button');retry.type='button';retry.textContent='Tentar novamente';retry.onclick=()=>boot(root,key);root.append(retry);return false;});
    pages.set(root,request);return request;
  }
  window.CFFMvpRanking={boot};
})();
