const BASE='/ffws-global-2026/';
const phaseLabels={classificatoria:'Fase 1',segundaFase:'Fase 2',lastChance:'Repescagem',final:'Grande Final'};
const metrics={
 players:{kills:{column:1,label:'Abates',unit:'abates'},damage:{column:2,label:'Dano',unit:'de dano'},assists:{column:3,label:'Assistências',unit:'assistências'}},
 teams:{points:{column:1,label:'Pontos nas quedas',unit:'pontos'},kills:{column:2,label:'Abates',unit:'abates'},booyahs:{column:3,label:'Booyahs',unit:'Booyahs'}}
};
const number=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
const decimal=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const dateFormat=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeZone:'UTC'});
const sum=values=>values.reduce((total,value)=>total+value,0);

export function comparison(phase,type,metric,mode,size){
 const column=metrics[type][metric].column;
 const records=[],campaign=new Map();
 for(const round of phase.rounds){
  for(const [id,drops] of Object.entries(round[type])){
   const series=drops.filter(row=>Number.isFinite(row[column])).map(row=>({number:row[0],label:round.drops[row[0]],value:row[column]}));
   if(!series.length)continue;
   const total=sum(series.map(drop=>drop.value));
   const item={id,round,value:total,series};
   const complete=round.expected>0&&series.length===round.expected&&series.every((drop,i)=>drop.number===i+1);
   if(complete)records.push(item);
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
 const form=document.getElementById('rx-controls');
 const story=document.getElementById('rx-story');
 const announce=document.getElementById('rx-announcement');
 const controls=Object.fromEntries(['fase','tipo','visao','metrica','id','quedas'].map(key=>[key,form.elements.namedItem(key)]));
 const presets=[...document.querySelectorAll('[data-preset]')];
 const state={};
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
  state.visao=view==='media'?'media':'rodada';
  state.metrica=Object.hasOwn(metrics[state.tipo],metric)?metric:Object.keys(metrics[state.tipo])[0];
  state.id=params.get('id')||'';
  state.rodada=Number(params.get('rodada'))||null;
  state.quedas=Number(params.get('quedas'))||null;
 };

 function updateUrl(){
  const next=new URL(location.href);
  for(const key of ['fase','tipo','visao','metrica','id','rodada','quedas']){
   if(state[key]&&!(state.visao==='media'&&['rodada','quedas'].includes(key)))next.searchParams.set(key,state[key]);
   else next.searchParams.delete(key);
  }
  history.replaceState(history.state,'',next);
 }

 function render(writeUrl=false){
  const phase=data.phases[state.fase],metric=metrics[state.tipo][state.metrica];
  const byRound=state.visao==='rodada';
  const pool=comparison(phase,state.tipo,state.metrica,state.visao,state.quedas);
  const {rows,observations,mean,falls,entities,sizes}=pool;
  const selected=rows.find(row=>row.id===state.id&&row.round?.number===state.rodada)
   ||rows.find(row=>row.id===state.id)||rows[0];
  const ids=[...new Set(rows.map(row=>row.id))].sort((a,b)=>meta(a).name.localeCompare(meta(b).name,'pt-BR'));
  state.id=selected?.id||'';
  state.rodada=selected?.round?.number||null;
  state.quedas=byRound?(falls||null):null;

  controls.fase.innerHTML=options(Object.entries(data.phases).map(([id,value])=>[id,phaseLabels[id]||value.name]));
  controls.metrica.innerHTML=options(Object.entries(metrics[state.tipo]).map(([id,value])=>[id,value.label]));
  controls.id.innerHTML=options(ids.length?ids.map(id=>[id,state.tipo==='players'?`${meta(id).name} · ${team(id).abbreviation}`:meta(id).name]):[['','Sem resultados']]);
  controls.quedas.innerHTML=options(sizes.map(size=>[size,String(size)]));
  for(const [key,control] of Object.entries(controls))control.value=state[key]??'';
  controls.id.disabled=!ids.length;
  document.getElementById('rx-entity-label').textContent=state.tipo==='teams'?'Equipe':'Jogador';
  document.getElementById('rx-size-control').hidden=!byRound||sizes.length<2;
  presets.forEach(button=>button.setAttribute('aria-pressed',String(!!selected&&byRound&&button.dataset.preset===state.tipo+':'+state.metrica&&selected===rows[0])));
  if(writeUrl)updateUrl();
  if(!selected){
   announce.textContent=phase.name+' sem resultados para essa comparação.';
   story.innerHTML=`<div class="rx-empty"><h1 id="rx-headline">${esc(phase.name)}</h1><p>${byRound?'Ainda não há rodadas completas com essa métrica.':'Ainda não há resultados cadastrados para essa métrica.'}</p></div>`;
   return;
  }

  const person=meta(selected.id),teamInfo=team(selected.id);
  const pickedScore=format(selected.value,!byRound);
  const ratio=mean>0?selected.value/mean:null;
  const roundDetails=byRound?`Dia ${selected.round.day} · Rodada ${selected.round.number} · ${dateFormat.format(new Date(selected.round.date+'T12:00:00Z'))}`:`${selected.count} quedas com dados da métrica`;
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

  story.innerHTML=`
   <header class="rx-hero">
    <div>
     <p class="rx-kicker">${esc(phase.name)} · ${byRound?'Por rodada':'Por queda'}</p>
     <h1 id="rx-headline"><a href="${profile(selected.id)}">${esc(person.name)}</a> ${byRound?'fez':'tem média de'} <strong>${pickedScore} ${metric.unit}</strong> ${byRound?`<span class="rx-measure">em ${falls} quedas</span>`:'por queda'}</h1>
     <p class="rx-subtitle">${esc(roundDetails)} <span aria-hidden="true">·</span> <strong>${selected.rank}º no recorte</strong></p>
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
   <div class="rx-panels">
    <section class="rx-panel" aria-labelledby="rx-ranking-title">
     <h2 id="rx-ranking-title">As melhores marcas</h2>
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
    <section class="rx-panel" aria-labelledby="rx-detail-title">
     <h2 id="rx-detail-title">${byRound?'Queda a queda':'Rodada a rodada'}</h2>
     <p>${metric.label}${byRound?'':' por queda'} · ${esc(person.name)}</p>
     <ol class="rx-series" style="--columns:${Math.min(selected.series.length,6)}">
      ${selected.series.map(row=>`<li class="${row.value===peak?'rx-peak':''}" title="${esc(row.label)}${row.count?` · ${row.count} quedas`:''}"><strong>${format(row.value,!byRound)}</strong><span class="rx-column" aria-hidden="true"><i style="--fill:${bar(row.value,peak)}%"></i></span><span aria-label="${byRound?'Queda':'Rodada'} ${row.number}">${byRound?'Q':'R'}${row.number}</span></li>`).join('')}
     </ol>
     ${bestDrop?`<p class="rx-detail-note"><strong>${number.format(bestDrop.value)} ${metric.unit}</strong> na queda ${bestDrop.number}${bestDrop.label?` · ${esc(bestDrop.label)}`:''}.</p>`:'<p class="rx-detail-note">Cada barra mostra a média nas quedas disputadas naquela rodada.</p>'}
    </section>
   </div>
   <footer class="rx-method">
    <p>${byRound?'A média inclui todos os desempenhos completos com o mesmo número de quedas.':'A média da fase é ponderada pela quantidade de quedas com dados de cada participante.'}
    ${state.tipo==='teams'&&state.metrica==='points'?'Os pontos mostram o placar obtido nas quedas. Penalidades administrativas constam na classificação oficial.':''}</p>
    ${data.updatedAt?`<small>Resultados cadastrados até ${dateFormat.format(new Date(data.updatedAt+'T12:00:00Z'))}.</small>`:''}
   </footer>`;
  if(writeUrl)announce.textContent=document.getElementById('rx-headline').textContent;
 }

 form.addEventListener('change',event=>{
  const key=event.target.name;
  if(!Object.hasOwn(controls,key))return;
  state[key]=key==='quedas'?Number(event.target.value):event.target.value;
  state.rodada=null;
  if(key==='tipo'){
   state.metrica=Object.keys(metrics[state.tipo])[0];
   state.id='';
  }
  if(key==='fase')state.quedas=null;
  render(true);
 });
 story.addEventListener('click',event=>{
  const button=event.target.closest('[data-row]');
  if(!button)return;
  state.id=button.dataset.row;
  state.rodada=Number(button.dataset.round)||null;
  render(true);
  story.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
 });
 for(const button of presets){
  button.addEventListener('click',()=>{
   [state.tipo,state.metrica]=button.dataset.preset.split(':');
   Object.assign(state,{visao:'rodada',id:'',rodada:null,quedas:null});
   render(true);
  });
 }
 window.addEventListener('popstate',()=>{read();render();});
 read();
 render();
 form.hidden=false;
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
