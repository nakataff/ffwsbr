const BASE='/ffws-global-2026/';
const views={media:'Campanha',evolucao:'Evolução',rodada:'Recordes',projecao:'Projeção da Fase 2'};
const compareLimit=4;
const phaseLabels={classificatoria:'Fase 1',segundaFase:'Fase 2',lastChance:'Repescagem',final:'Grande Final'};
const metrics={
 players:{kills:{column:1,label:'Abates',unit:'abates'},damage:{column:2,label:'Dano',unit:'de dano'},assists:{column:3,label:'Assistências',unit:'assistências'}},
 teams:{points:{column:1,label:'Pontos nas quedas',shortLabel:'Pontos',unit:'pontos'},kills:{column:2,label:'Abates',unit:'abates'},booyahs:{column:3,label:'Booyahs',unit:'Booyahs'}}
};
const number=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
const decimal=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const dateFormat=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeZone:'UTC'});
const sum=values=>values.reduce((total,value)=>total+value,0);
const dropsFor=(round,type,id,column)=>(round[type][id]||[])
 .filter(row=>Number.isFinite(row[column]))
 .map(row=>({number:row[0],label:round.drops[row[0]],value:row[column]}));
const isFullRound=(round,series)=>round.expected>0&&series.length===round.expected&&series.every((drop,i)=>drop.number===i+1);
const normalizeSearch=value=>value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();


export function comparison(phase,type,metric,mode,size){
 const column=metrics[type][metric].column;
 const records=[],campaign=new Map();
 for(const round of phase.rounds){
  for(const id of Object.keys(round[type])){
   const series=dropsFor(round,type,id,column);
   if(!series.length)continue;
   const total=sum(series.map(drop=>drop.value));
   const item={id,round,value:total,series};
   if(isFullRound(round,series))records.push(item);
   if(!campaign.has(id))campaign.set(id,{id,total:0,count:0,series:[]});
   const player=campaign.get(id);
   player.total+=total;
   player.count+=series.length;
   player.series.push({number:round.number,label:'Dia '+round.day,value:total/series.length,count:series.length});
  }
 }
 const sizes=[...new Set(records.map(item=>item.round.expected))].sort((a,b)=>b-a);
 const falls=sizes.includes(size)?size:sizes[0];
 let rows,observations,mean;
 if(mode==='rodada'){
  rows=records.filter(row=>row.round.expected===falls);
  observations=rows.length;
  mean=observations?sum(rows.map(row=>row.value))/observations:null;
 }else{
  rows=[...campaign.values()].map(row=>({...row,value:row.total/row.count}));
  observations=sum(rows.map(row=>row.count));
  mean=observations?sum(rows.map(row=>row.total))/observations:null;
 }
 rows.sort((a,b)=>b.value-a.value||a.id.localeCompare(b.id)||(a.round?.number||0)-(b.round?.number||0));
 rows.forEach((row,i)=>{row.rank=i&&row.value===rows[i-1].value?rows[i-1].rank:i+1;});
 return {rows,observations,mean,sizes,falls,entities:new Set(rows.map(row=>row.id)).size};
}

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const path=value=>value&&!/[:\\]|\.\./.test(value)?'/'+value.replace(/^\//,''):'';
const options=items=>items.map(([value,label])=>`<option value="${esc(value)}">${esc(label)}</option>`).join('');
const bar=(value,max)=>max>0?Math.max(0,Math.min(100,value/max*100)):0;

function boot(data){
 const explorer=document.getElementById('rx-controls');
 const story=document.getElementById('rx-story');
 const announce=document.getElementById('rx-announcement');
 const filterToggle=document.getElementById('rx-filters-toggle');
 const filterFields=document.getElementById('rx-filter-fields');
 const controls=Object.fromEntries([...filterFields.querySelectorAll('select')].map(control=>[control.name,control]));
 const tabs=[...explorer.querySelectorAll('[data-view]')];
 const panel=document.getElementById('rx-panel');
 const state={};
 const catalog=searchCatalog(data);
 const primarySearch=document.getElementById('rx-search');
 let projection,projectionLoad;
 const meta=id=>data[state.tipo][id];
 const team=id=>data.teams[state.tipo==='teams'?id:meta(id).teamId];
 const emblem=(id,className='rx-shield')=>team(id)?.logo?`<span class="${className}"><img src="${esc(path(team(id).logo))}" alt="" loading="lazy"></span>`:'';
 const profile=id=>state.tipo==='teams'?`${BASE}equipe?time=${encodeURIComponent(id)}`:`${BASE}jogador?id=${encodeURIComponent(id)}`;
 const format=(v,isAverage)=>isAverage?decimal.format(v):number.format(v);
 const read=()=>{
  const params=new URLSearchParams(location.search);
  const phase=params.get('fase'),type=params.get('tipo'),view=params.get('visao'),metric=params.get('metrica');
  state.fase=Object.hasOwn(data.phases,phase)?phase:'classificatoria';
  state.tipo=type==='teams'?'teams':'players';
  state.visao=Object.hasOwn(views,view)?view:'media';
  state.metrica=Object.hasOwn(metrics[state.tipo],metric)?metric:Object.keys(metrics[state.tipo])[0];
  state.id=params.get('id')||'';
  state.comparar=params.getAll('comparar');
  state.rodada=Number(params.get('rodada'))||null;
  state.quedas=Number(params.get('quedas'))||null;
  state.projectionDay=Number(params.get('dia'))||null;
 };

 function updateUrl(){
  const next=new URL(location.href);
  for(const key of ['fase','tipo','visao','metrica','id','rodada','quedas']){
   if(state[key]&&(state.visao!=='projecao'||key==='visao')&&!(state.visao!=='rodada'&&['rodada','quedas'].includes(key)))next.searchParams.set(key,state[key]);
   else next.searchParams.delete(key);
  }
  next.searchParams.delete('comparar');
  if(state.visao==='evolucao'){
   for(const id of state.comparar)next.searchParams.append('comparar',id);
  }
  if(state.visao==='projecao'&&state.projectionDay)next.searchParams.set('dia',state.projectionDay);
  else next.searchParams.delete('dia');
  history.replaceState(history.state,'',next);
 }

 function showProjection(focusDay=false){
  if(projection){
   const {renderProjection,results}=projection;
   const day=renderProjection(story,results,data.teams,state.projectionDay,selected=>{
    state.projectionDay=selected;
    updateUrl();
    showProjection(true);
   });
   if(focusDay)story.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
   announce.textContent=day?`Projeção da Fase 2 · Dia ${day}`:'Projeção da Fase 2';
   return;
  }
  story.innerHTML='<div class="rx-empty" data-rx-projection-loading><h1 id="rx-headline">Projeção da Fase 2</h1><p role="status">Carregando as chances de classificação…</p></div>';
  projectionLoad??=Promise.all([
   import('./projecao.mjs?v=1'),
   fetch(new URL('./projecao.json',import.meta.url),{cache:'no-cache'}).then(response=>{
    if(!response.ok)throw Error('Projeções indisponíveis');
    return response.json();
   })
  ]);
  projectionLoad.then(([module,results])=>{
   projection={renderProjection:module.renderProjection,results};
   if(state.visao==='projecao'&&story.querySelector('[data-rx-projection-loading]'))showProjection();
  }).catch(()=>{
   projectionLoad=null;
   if(state.visao!=='projecao'||!story.querySelector('[data-rx-projection-loading]'))return;
   story.innerHTML='<div class="rx-empty"><h1 id="rx-headline">Projeção da Fase 2</h1><p>Não foi possível carregar as projeções.</p><button type="button" class="rx-empty-record">Tentar de novo</button></div>';
   story.querySelector('button').addEventListener('click',()=>showProjection());
  });
 }

 function render(writeUrl=false){
  const isProjection=state.visao==='projecao';
  primarySearch.closest('.rx-search').hidden=isProjection;
  filterToggle.hidden=isProjection;
  filterFields.hidden=isProjection||filterToggle.getAttribute('aria-expanded')!=='true';
  for(const tab of tabs){
   const active=tab.dataset.view===state.visao;
   tab.setAttribute('aria-selected',String(active));
   tab.tabIndex=active?0:-1;
   if(active)panel.setAttribute('aria-labelledby',tab.id);
  }
  if(isProjection){
   if(writeUrl)updateUrl();
   showProjection();
   return;
  }
  const phase=data.phases[state.fase],metric=metrics[state.tipo][state.metrica];
  const byRound=state.visao==='rodada',evolution=state.visao==='evolucao';
  const pool=comparison(phase,state.tipo,state.metrica,state.visao,state.quedas);
  const {rows,observations,mean,falls,entities,sizes}=pool;
  const selected=rows.find(row=>row.id===state.id&&row.round?.number===state.rodada)
   ||rows.find(row=>row.id===state.id)||(!Object.hasOwn(data[state.tipo],state.id)?rows[0]:null);
  state.id=selected?.id||state.id;
  if(byRound){
   state.rodada=selected?.round?.number||null;
   state.quedas=falls||null;
  }

  controls.fase.innerHTML=options(Object.entries(data.phases).map(([id,value])=>[id,phaseLabels[id]||value.name]));
  controls.quedas.innerHTML=options(sizes.map(size=>[size,String(size)]));
  for(const [key,control] of Object.entries(controls))control.value=state[key]??'';
  document.getElementById('rx-size-control').hidden=!byRound||sizes.length<2;
  const candidates=evolution?catalog.filter(entry=>entry.type===state.tipo&&entry.phases.has(state.fase)&&entry.id!==state.id):[];
  const byId=new Map(candidates.map(entry=>[entry.id,entry]));
  if(evolution)state.comparar=[...new Set(state.comparar)].filter(id=>byId.has(id)).slice(0,compareLimit-1);
  const compared=evolution?state.comparar.map((id,index)=>{
   const entry=byId.get(id);
   const name=state.tipo==='players'?`${entry.name} · ${entry.label}`:entry.name;
   return {id,name,row:rows.find(row=>row.id===id),color:`var(--rx-series-${index+1})`};
  }):[];
  const atLimit=compared.length>=compareLimit-1;
  const compareControl=selected&&candidates.length?`<div class="rx-chart-field rx-compare-field"><label for="rx-compare">Comparar com</label><div class="rx-search">
   <input id="rx-compare" type="search" role="combobox" autocomplete="off" aria-autocomplete="list" aria-expanded="false" aria-controls="rx-compare-results" aria-describedby="rx-compare-count" placeholder="${atLimit?'Limite de 4 atingido':state.tipo==='players'?'Buscar jogador':'Buscar equipe'}" ${atLimit?'disabled':''}>
   <div class="rx-suggestions" hidden><ul id="rx-compare-results" role="listbox" aria-label="Opções para comparar"></ul><p hidden>Nenhum participante encontrado nesta fase.</p></div>
  </div><small id="rx-compare-count">${compared.length+1}/${compareLimit}</small></div>`:'';
  const chips=compared.length?`<ul class="rx-compare-chips" aria-label="Participantes adicionados">${compared.map(entry=>`<li><button type="button" data-remove-compare="${esc(entry.id)}" aria-label="Remover ${esc(entry.name)} da comparação" style="--series-color:${entry.color}"><span>${esc(entry.name)}</span><b aria-hidden="true">×</b></button></li>`).join('')}</ul>`:'';
  const metricControl=`<div class="rx-chart-tools"><div class="rx-chart-field"><label for="rx-metric">Métrica</label><select id="rx-metric">${options(Object.entries(metrics[state.tipo]).map(([key,entry])=>[key,entry.label]))}</select></div>${compareControl}</div>`;
  if(writeUrl)updateUrl();
  if(!selected){
   const subject=Object.hasOwn(data[state.tipo],state.id)?meta(state.id).name:'';
   const message=subject
    ? `${subject} ainda não tem dados de ${metric.label.toLowerCase()} neste recorte.`
    : `Ainda não há resultados de ${metric.label.toLowerCase()} para ${views[state.visao]} nesta fase.`;
   const best=byRound?rows[0]:null;
   const recordLink=best?`<button type="button" class="rx-empty-record" data-row="${esc(best.id)}" data-round="${best.round.number}">Ver a melhor marca da fase</button>`:'';
   announce.textContent=message;
   story.innerHTML=`<div class="rx-empty"><h1 id="rx-headline">${esc(subject||phase.name)}</h1><p>${esc(message)}</p>${recordLink}</div>${metricControl}`;
   story.querySelector('#rx-metric').value=state.metrica;
   return;
  }

  const person=meta(selected.id),teamInfo=team(selected.id);
  const pickedScore=format(selected.value,!byRound);
  const ratio=mean>0?selected.value/mean:null;
  const roundDetails=byRound?`Dia ${selected.round.day} · Rodada ${selected.round.number} · ${dateFormat.format(new Date(selected.round.date+'T12:00:00Z'))}`:`${phase.rounds.reduce((total,round)=>total+(round[state.tipo][selected.id]?.length||0),0)} quedas disputadas`;
  const portrait=state.tipo==='players'&&path(person.photo)?`<img class="rx-photo" src="${esc(path(person.photo))}" width="480" height="480" alt="${esc(person.name)}">`:emblem(selected.id,'rx-team-portrait');
  const visible=rows.slice(0,5);
  if(!visible.includes(selected))visible.push(selected);
  const maximum=Math.max(rows[0].value,mean);
  const bestDrop=byRound?selected.series.reduce((top,row)=>row.value>top.value?row:top):null;
  const sampling=byRound
   ? `${observations} desempenhos em rodadas de ${falls} quedas · ${entities} ${state.tipo==='players'?'jogadores':'equipes'}`
   : `${observations} participações em quedas · ${entities} ${state.tipo==='players'?'jogadores':'equipes'}`;
  const comparisonCopy=ratio===null?'':ratio>1
   ? `<p class="rx-insight"><strong>${number.format(ratio)}×</strong> a média da fase.</p>`
   : ratio===1?'<p class="rx-insight">Igual à média da fase.</p>':`<p class="rx-insight"><strong>${number.format((1-ratio)*100)}%</strong> abaixo da média da fase.</p>`;
  const peak=Math.max(...selected.series.map(row=>row.value));
  const summaries=Object.values(metrics[state.tipo]).map(entry=>{
   const series=byRound
    ? dropsFor(selected.round,state.tipo,selected.id,entry.column)
    : phase.rounds.flatMap(round=>dropsFor(round,state.tipo,selected.id,entry.column));
   const available=byRound?isFullRound(selected.round,series):series.length>0;
   const total=available?sum(series.map(drop=>drop.value)):null;
   const meanByDrop=available&&!byRound?`<small>${decimal.format(total/series.length)} por queda</small>`:'';
   return `<div><dt>${entry.shortLabel||entry.label}</dt><dd><strong>${total===null?'—':number.format(total)}</strong>${meanByDrop}</dd></div>`;
  }).join('');
  const headline=`<a href="${profile(selected.id)}">${esc(person.name)}</a>${byRound?` fez <strong>${pickedScore} ${metric.unit}</strong> <span class="rx-measure">em ${falls} quedas</span>`:''}`;
  const rankLabel=byRound?'no recorte':`em ${metric.shortLabel?.toLowerCase()||metric.label.toLowerCase()} por queda`;

  story.innerHTML=`
   <header class="rx-hero">
    <div>
     <p class="rx-kicker">${esc(phase.name)} · ${views[state.visao]}</p>
     <h1 id="rx-headline">${headline}</h1>
     <p class="rx-subtitle">${esc(roundDetails)}${evolution?'':` · <strong>${selected.rank}º ${rankLabel}</strong>`}</p>
     <dl class="rx-metrics" aria-label="${byRound?'Totais da rodada':'Totais e médias da fase'}">${summaries}</dl>
    </div>
    <div class="rx-identity">
     <div class="rx-profile-copy">
      ${state.tipo==='players'?emblem(selected.id):''}
      <a href="${BASE}equipe?time=${encodeURIComponent(state.tipo==='players'?person.teamId:selected.id)}">${esc(teamInfo.name)}</a>
      ${person.role?`<span>${esc(person.role)}</span>`:''}
     </div>
     ${portrait}
    </div>
   </header>
   ${metricControl}${chips}
   ${evolution?evolutionChart(selected,metric,person.name,mean,compared):`
   <div class="rx-panels${byRound?'':' rx-panels-campaign'}">
    <section class="rx-panel" aria-labelledby="rx-ranking-title">
     <h2 id="rx-ranking-title">${byRound?'As melhores marcas':'Melhores médias da fase'}</h2>
     <p>${metric.label} · ${byRound?`Rodadas de ${falls} quedas`:'Média por queda'}</p>
     <ol class="rx-ranking">
      ${visible.map(row=>`<li><button type="button" data-row="${esc(row.id)}" data-round="${row.round?.number||''}" aria-pressed="${row===selected}">
        <span class="rx-bar-label">${emblem(row.id)}<span><strong>${row.rank}º ${esc(meta(row.id).name)}</strong><small>${esc(team(row.id).abbreviation)} · ${row.round?`Dia ${row.round.day} · R${row.round.number}`:`${row.count} quedas`}</small></span><b>${format(row.value,!byRound)}</b></span>
        <span class="rx-bar" aria-hidden="true"><i style="--fill:${bar(row.value,maximum)}%"></i><i class="rx-mean-tick" style="--mark:${bar(mean,maximum)}%"></i></span>
       </button></li>`).join('')}
     </ol>
     <p class="rx-legend"><i aria-hidden="true"></i> Média da fase</p>
    </section>
    <section class="rx-panel" aria-labelledby="rx-context-title">
     <h2 id="rx-context-title">Em relação à média</h2><p>${metric.label} · ${byRound?'Por rodada':'Por queda'}</p>
     <div class="rx-duel">
      <div class="rx-duel-featured"><span>${esc(person.name)}</span><strong>${pickedScore}</strong><span class="rx-bar" aria-hidden="true"><i style="--fill:${bar(selected.value,Math.max(selected.value,mean))}%"></i></span></div>
      <div><span>Média da fase</span><strong>${decimal.format(mean)}</strong><span class="rx-bar" aria-hidden="true"><i style="--fill:${bar(mean,Math.max(selected.value,mean))}%"></i></span></div>
     </div>
     ${comparisonCopy}
     <p class="rx-sample">${sampling}</p>
    </section>
    ${byRound?`<section class="rx-panel" aria-labelledby="rx-detail-title">
     <h2 id="rx-detail-title">Queda a queda</h2>
     <p>${metric.label} · ${esc(person.name)}</p>
     <ol class="rx-series" style="--columns:${Math.min(selected.series.length,6)}">
      ${selected.series.map(row=>`<li class="${row.value===peak?'rx-peak':''}" title="${esc(row.label)}"><strong>${number.format(row.value)}</strong><span class="rx-column" aria-hidden="true"><i style="--fill:${bar(row.value,peak)}%"></i></span><span aria-label="Queda ${row.number}">Q${row.number}</span></li>`).join('')}
     </ol>
     <p class="rx-detail-note"><strong>${number.format(bestDrop.value)} ${metric.unit}</strong> na queda ${bestDrop.number}${bestDrop.label?` · ${esc(bestDrop.label)}`:''}.</p>
    </section>`:''}
   </div>`}
   <footer class="rx-method">
    <p>${byRound?'A média inclui todos os desempenhos completos com o mesmo número de quedas.':'As médias consideram apenas as quedas com dados da métrica selecionada.'}
    ${evolution?'A média da fase inclui todos os participantes da categoria selecionada.':''}
    ${state.tipo==='teams'&&state.metrica==='points'?'Os pontos mostram o placar obtido nas quedas. Penalidades administrativas constam na classificação oficial.':''}</p>
    ${data.updatedAt?`<small>Resultados cadastrados até ${dateFormat.format(new Date(data.updatedAt+'T12:00:00Z'))}.</small>`:''}
  </footer>`;
  story.querySelector('#rx-metric').value=state.metrica;
  const compareInput=story.querySelector('#rx-compare');
  if(compareInput&&!atLimit){
   attachSearch(compareInput,candidates.filter(entry=>!state.comparar.includes(entry.id)),entry=>{
    state.comparar.push(entry.id);
    render(true);
    story.querySelector('#rx-compare:not(:disabled), .rx-compare-chips li:last-child button')?.focus({preventScroll:true});
   });
  }
  if(writeUrl)announce.textContent=`${views[state.visao]} · ${person.name} · ${metric.label}${compared.length?` · Comparação com ${compared.map(entry=>entry.name).join(', ')}`:''}`;
 }

 filterToggle.addEventListener('click',()=>{
  filterFields.hidden=!filterFields.hidden;
  filterToggle.setAttribute('aria-expanded',String(!filterFields.hidden));
 });
 filterFields.addEventListener('change',event=>{
  const key=event.target.name;
  if(!Object.hasOwn(controls,key))return;
  state[key]=key==='quedas'?Number(event.target.value):event.target.value;
  state.rodada=null;
  if(key==='fase'||key==='tipo')state.quedas=null;
  if(key==='tipo'){
   state.id='';
   state.comparar=[];
   state.metrica=Object.keys(metrics[state.tipo])[0];
  }
  render(true);
 });
 story.addEventListener('change',event=>{
  if(event.target.id!=='rx-metric')return;
  state.metrica=event.target.value;
  render(true);
  story.querySelector('#rx-metric').focus({preventScroll:true});
 });
 story.addEventListener('click',event=>{
  const remove=event.target.closest('[data-remove-compare]');
  if(remove){
   state.comparar=state.comparar.filter(id=>id!==remove.dataset.removeCompare);
   render(true);
   story.querySelector('#rx-compare')?.focus({preventScroll:true});
   return;
  }
  const button=event.target.closest('[data-row]');
  if(!button)return;
  state.id=button.dataset.row;
  state.rodada=Number(button.dataset.round)||null;
  render(true);
  story.querySelector('[data-row][aria-pressed="true"]')?.focus({preventScroll:true});
 });
 for(const [index,tab] of tabs.entries()){
  tab.addEventListener('click',()=>{
   state.visao=tab.dataset.view;
   render(true);
  });
  tab.addEventListener('keydown',event=>{
   const next={ArrowLeft:(index+tabs.length-1)%tabs.length,ArrowRight:(index+1)%tabs.length,Home:0,End:tabs.length-1}[event.key];
   if(next===undefined)return;
   event.preventDefault();
   tabs[next].click();
   tabs[next].focus();
  });
 }
 window.addEventListener('popstate',()=>{read();render();});
 read();
 render();
 attachSearch(primarySearch,catalog,({type,id,phases})=>{
  const candidates=[...new Set([state.fase,...phases])].filter(phase=>phases.has(phase));
  const keys=Object.keys(metrics[type]);
  const metric=type===state.tipo?state.metrica:keys[0];
  for(const fase of candidates){
   const phase=data.phases[fase];
   for(const visao of new Set([state.visao,'media'])){
    for(const metrica of new Set([metric,...keys])){
     const pool=comparison(phase,type,metrica,visao,state.quedas);
     let result=pool.rows.find(row=>row.id===id);
     if(!result&&visao==='rodada'){
      for(const size of pool.sizes.filter(size=>size!==pool.falls)){
       result=comparison(phase,type,metrica,visao,size).rows.find(row=>row.id===id);
       if(result)break;
      }
     }
     if(!result)continue;
     if(type!==state.tipo)state.comparar=[];
     Object.assign(state,{fase,tipo:type,visao,metrica,id,rodada:result.round?.number||null,quedas:result.round?.expected||null});
     render(true);
     return;
    }
   }
  }
 });
 explorer.hidden=false;
}

function evolutionChart(selected,metric,name,mean,compared){
 const entries=[{name,row:selected,color:'var(--rx-highlight)'},...compared]
  .filter(entry=>entry.row).map(entry=>({...entry,rounds:new Map(entry.row.series.map(round=>[round.number,round]))}));
 const roundNumbers=[...new Set(entries.flatMap(entry=>[...entry.rounds.keys()]))].sort((a,b)=>a-b);
 const hasMissingRounds=entries.some(entry=>entry.rounds.size<roundNumbers.length);
 const noData=compared.filter(entry=>!entry.row);
 const max=Math.max(selected.value,mean,...entries.flatMap(entry=>entry.row.series.map(round=>round.value)));
 const countLabel=count=>`${count} ${count===1?'queda':'quedas'}`;
 const lane=(entry,number)=>{
  const round=entry.rounds.get(number);
  const detail=round?countLabel(round.count):'Sem registro nesta rodada';
  return `<div class="rx-trend-lane" style="--series-color:${entry.color}"><span class="rx-bar" aria-hidden="true"><i style="--fill:${bar(round?.value??0,max)}%"></i></span><strong class="rx-trend-value" title="${detail}">${round?decimal.format(round.value):'—'}<span class="rx-sr-only"> · ${esc(entry.name)} · ${detail}</span></strong></div>`;
 };
 return `<section class="rx-evolution" aria-labelledby="rx-evolution-title">
  <h2 id="rx-evolution-title">Rodada a rodada</h2>
  <p>${metric.label} por queda</p>
  <div class="rx-trend-legend">
   <p class="rx-legend rx-legend-primary"><i aria-hidden="true"></i> Média de ${esc(name)} · ${decimal.format(selected.value)} por queda</p>
   <p class="rx-legend rx-legend-phase"><i aria-hidden="true"></i> Média da fase · ${decimal.format(mean)} por queda</p>
   ${entries.slice(1).map(entry=>`<p class="rx-legend rx-legend-other" style="--series-color:${entry.color}"><i aria-hidden="true"></i> ${esc(entry.name)} · média de ${decimal.format(entry.row.value)} por queda</p>`).join('')}
  </div>
  ${noData.length?`<p class="rx-compare-note">Sem dados de ${metric.label.toLowerCase()} nesta fase para ${noData.map(entry=>esc(entry.name)).join(', ')}.</p>`:''}
  <div class="rx-trend${entries.length>1?' rx-trend-compare':''}">
   <span class="rx-trend-guide" aria-hidden="true"><i class="rx-mean-tick rx-mean-phase" style="--mark:${bar(mean,max)}%"></i><i class="rx-mean-tick rx-mean-primary" style="--mark:${bar(selected.value,max)}%"></i></span>
   <ol>
    ${roundNumbers.map(number=>{
     const round=entries.find(entry=>entry.rounds.has(number)).rounds.get(number);
     return `<li><span class="rx-trend-label"><strong>Rodada ${number}</strong><small>${esc(round.label)}${entries.length===1?` · ${countLabel(round.count)}`:''}</small></span><div class="rx-trend-lanes">${entries.map(entry=>lane(entry,number)).join('')}</div></li>`;
    }).join('')}
   </ol>
  </div>
  ${hasMissingRounds?'<p class="rx-compare-note">— Sem registro na rodada.</p>':''}
 </section>`;
}

function searchCatalog(data){
 const phasesByEntity=new Map();
 for(const [phase,{rounds}] of Object.entries(data.phases)){
  for(const round of rounds){
   for(const type of ['players','teams']){
    for(const [id,drops] of Object.entries(round[type])){
     if(!drops.some(row=>row.slice(1).some(Number.isFinite)))continue;
     const key=type+':'+id;
     if(!phasesByEntity.has(key))phasesByEntity.set(key,new Set());
     phasesByEntity.get(key).add(phase);
    }
   }
  }
 }
 const catalog=[];
 for(const type of ['players','teams']){
  for(const [id,entity] of Object.entries(data[type])){
   const phases=phasesByEntity.get(type+':'+id);
   if(!phases)continue;
   const team=type==='teams'?entity:data.teams[entity.teamId];
   const terms=type==='teams'?[entity.name,entity.abbreviation,id]:[entity.name];
   catalog.push({type,id,phases,name:entity.name,label:type==='teams'?'Equipe':team?.abbreviation||'Jogador',terms:terms.filter(Boolean).map(normalizeSearch)});
  }
 }
 return catalog;
}

function attachSearch(input,catalog,select){
 const container=input.closest('.rx-search');
 const list=document.getElementById(input.getAttribute('aria-controls'));
 const popup=list.closest('.rx-suggestions');
 const empty=popup.querySelector('p');
 let matches=[],active=-1;

 function close(){
  popup.hidden=true;
  input.setAttribute('aria-expanded','false');
  input.removeAttribute('aria-activedescendant');
  active=-1;
 }
 function complete(index){
  const selected=matches[index];
  if(!selected)return;
  close();
  input.value='';
  select(selected);
 }
 function show(){
  const query=normalizeSearch(input.value);
  if(!query){close();return;}
  matches=catalog.map(entry=>({entry,score:Math.min(...entry.terms.map(term=>term===query?0:term.startsWith(query)?1:term.includes(query)?2:3))}))
   .filter(row=>row.score<3).sort((a,b)=>a.score-b.score||a.entry.name.localeCompare(b.entry.name,'pt-BR'))
   .slice(0,7).map(row=>row.entry);
  list.innerHTML=matches.map((entry,index)=>`<li id="${list.id}-${index}" role="option" aria-selected="false" data-result="${index}"><strong>${esc(entry.name)}</strong><span>${esc(entry.label)}</span></li>`).join('');
  empty.hidden=matches.length>0;
  active=-1;
  input.removeAttribute('aria-activedescendant');
  input.setAttribute('aria-expanded','true');
  popup.hidden=false;
 }

 input.addEventListener('input',show);
 input.addEventListener('focus',show);
 input.addEventListener('keydown',event=>{
  if(event.key==='Escape'||event.key==='Tab'){close();return;}
  if(event.key==='Enter'&&!popup.hidden&&matches.length){
   event.preventDefault();
   complete(Math.max(active,0));
  }
  if(event.key!=='ArrowDown'&&event.key!=='ArrowUp')return;
  if(popup.hidden)show();
  if(!matches.length||popup.hidden)return;
  event.preventDefault();
  const next=event.key==='ArrowDown'?active+1:active<0?matches.length-1:active-1;
  active=(next+matches.length)%matches.length;
  [...list.children].forEach((option,index)=>option.setAttribute('aria-selected',String(index===active)));
  input.setAttribute('aria-activedescendant',list.children[active].id);
  list.children[active].scrollIntoView?.({block:'nearest'});
 });
 list.addEventListener('click',event=>{
  const target=event.target.closest('[data-result]');
  if(target)complete(Number(target.dataset.result));
 });
 list.addEventListener('mousedown',event=>event.preventDefault());
 container.addEventListener('focusout',event=>{
  if(!container.contains(event.relatedTarget))close();
 });
}

if(typeof document!=='undefined'){
 const url=new URL('./resumo.json',import.meta.url);
 fetch(url,{cache:'no-cache'}).then(response=>{
  if(!response.ok)throw Error('Dados indisponíveis');
  return response.json();
 }).then(boot).catch(()=>{
  document.getElementById('rx-story').innerHTML='<div class="rx-empty"><h1 id="rx-headline">Raio-X do Mundial</h1><p>Não foi possível carregar os resultados agora. Recarregue a página para tentar novamente.</p></div>';
 });
}
