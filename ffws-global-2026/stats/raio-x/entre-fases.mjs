const fmt=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2,minimumFractionDigits:2});
const num=v=>fmt.format(v),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
const mapName=name=>/^(nova terra|nexterra)$/i.test(name)?'Nexterra':name||'Mapa não informado';
const delta=(a,b)=>a===0?null:100*(b/a-1);
const signed=v=>(v>0?'+':'')+num(v);
const falls=n=>`${n} ${n===1?'queda':'quedas'}`;
const percent=(n,total)=>total?100*n/total:null;
const stats=items=>{
 const wins=items.reduce((sum,r)=>sum+r[3],0),without=items.filter(r=>r[3]===0);
 return {matches:items.length,totalPoints:items.reduce((sum,r)=>sum+r[1],0),points:mean(items.map(r=>r[1])),kills:mean(items.map(r=>r[2])),placement:mean(items.map(r=>r[1]-r[2])),
  booyahs:wins,booyahRate:percent(wins,items.length),top3:items.filter(r=>r[1]-r[2]>=8).length,zeroPoints:items.filter(r=>r[1]===0).length,
  withoutBooyah:{matches:without.length,points:mean(without.map(r=>r[1])),totalPoints:without.reduce((sum,r)=>sum+r[1],0)}};
};

export function phaseTeam(data,phase,id,day=null){
 const rows=[],opponents=[],maps=new Map(),daily=[],starts=[],ends=[];
 for(const round of data.phases[phase]?.rounds||[]){
  if(day!=null&&round.day!==day)continue;
  const team=round.teams[id]||[];
  if(!round.expected||team.length!==round.expected||team.some((r,i)=>r[0]!==i+1||!r.slice(1).every(Number.isFinite)))continue;
  daily.push({day:round.day,points:team.reduce((sum,r)=>sum+r[1],0),matches:team.length});
  if(team.length===6){starts.push(...team.slice(0,3));ends.push(...team.slice(3));}
  for(const row of team){
   rows.push(row);
   const map=mapName(round.drops[row[0]]);
   if(!maps.has(map))maps.set(map,[]);maps.get(map).push(row);
   const peers=Object.entries(round.teams).filter(([peer,values])=>peer!==id&&values.some(r=>r[0]===row[0]&&Number.isFinite(r[1])))
    .map(([peer])=>data.phaseOneRanks?.[peer]);
   if(peers.length===11&&peers.every(Number.isFinite))opponents.push(...peers);
  }
 }
 if(!rows.length)return null;
 return {...stats(rows),opponentRank:mean(opponents),maps:Object.fromEntries([...maps].map(([map,values])=>[map,stats(values)])),daily,
  halves:starts.length?{start:stats(starts),end:stats(ends)}:null};
}

export function comparePhases(data,id,day=null){
 const first=phaseTeam(data,'classificatoria',id),second=phaseTeam(data,'segundaFase',id,day);
 if(!first||!second)return null;
 const metrics=Object.fromEntries(['points','kills','placement','booyahRate'].map(key=>[key,{first:first[key],second:second[key],change:second[key]-first[key],percent:delta(first[key],second[key])}]));
 const maps=[...new Set([...Object.keys(first.maps),...Object.keys(second.maps)])].map(map=>({map,first:first.maps[map]||null,second:second.maps[map]||null}));
 maps.sort((a,b)=>(b.second?.points??-1)-(a.second?.points??-1)||a.map.localeCompare(b.map));
 const reliable=maps.filter(m=>m.second?.matches>=2),best=(reliable.length?reliable:maps.filter(m=>m.second))[0];
 return {first,second,metrics,maps,best};
}

function metricCard(label,m,secondLabel,{rate=false,caption=''}={}){
 const max=Math.max(m.first,m.second);
 return `<section><h3>${label}</h3><div class="rx-between-bars">${[['Fase 1',m.first],[secondLabel,m.second]].map(([phase,value],i)=>`<div><span>${phase}</span><i style="--bar:${max?value/max*100:0}%;--bar-color:${i?'var(--rx-highlight)':'var(--rx-bar)'}" aria-hidden="true"></i><b>${num(value)}${rate?'%':''}</b></div>`).join('')}</div><p class="${m.change>0?'is-up':m.change<0?'is-down':''}">${signed(m.change)} ${rate?'p.p.':'por queda'}${!rate&&m.percent!=null?' · '+signed(m.percent)+'%':''}</p>${caption?`<small>${caption}</small>`:''}</section>`;
}
function changeStory(metrics){
 const {kills,placement}=metrics;
 const describe=(metric,label)=>`${label} ${metric.change>0?'cresceram':metric.change<0?'caíram':'se mantiveram'}${metric.percent!=null&&metric.change!==0?' '+num(Math.abs(metric.percent))+'%':''}`;
 return describe(kills,'Os abates')+' e '+describe(placement,'os pontos de colocação')+'.';
}

export function renderBetweenPhases(container,data,requestedId,onSelect,requestedDay=null){
 const detailsOpen=container.querySelector('#rx-between-details')?.open,mapsOpen=container.querySelector('.rx-between-maps')?.open;
 const teams=Object.keys(data.teams).filter(id=>phaseTeam(data,'segundaFase',id)).sort((a,b)=>data.teams[a].name.localeCompare(data.teams[b].name,'pt-BR'));
 const id=teams.includes(requestedId)?requestedId:teams.includes('los')?'los':teams[0];
 const campaign=id&&phaseTeam(data,'segundaFase',id);
 const days=[...new Set(campaign?.daily.map(d=>d.day)||[])].sort((a,b)=>a-b);
 const day=days.includes(requestedDay)?requestedDay:null;
 const result=id&&comparePhases(data,id,day);
 if(!result){container.innerHTML='<div class="rx-empty"><h1>Entre fases</h1><p>A comparação aparece quando uma equipe tiver rodadas completas nas duas fases.</p></div>';return;}
 const {first,second,metrics,maps,best}=result,team=data.teams[id];
 const trend=metrics.points.change>0?'aumentou':metrics.points.change<0?'caiu':'se manteve';
 const secondLabel=day?'Dia '+day:'Fase 2',period=day?'Dia '+day+' da Fase 2':'Fase 2 inteira';
 const league=Object.keys(data.teams).map(t=>phaseTeam(data,'segundaFase',t,day)).filter(Boolean);
 const leagueMean=league.reduce((sum,t)=>sum+t.totalPoints,0)/league.reduce((sum,t)=>sum+t.matches,0);
 const ownChange=second.points===campaign.points?0:delta(campaign.points,second.points);
 const leagueChange=leagueMean?100*(second.points/leagueMean-1):0;
 const logo=team.logo&&!/[:\\]|\.\./.test(team.logo)?'/'+team.logo.replace(/^\//,''):'';
 const halves=second.halves;
 container.innerHTML=`<header class="rx-between-header"><p class="rx-kicker">Equipes · Fase 1 × Fase 2</p><h1 id="rx-headline">Como o time mudou</h1><p>Compare a produção por queda nas duas fases ou escolha um dia específico da Fase 2.</p></header>
  <div class="rx-between-filters"><label class="rx-between-picker" for="rx-between-team">Equipe<select id="rx-between-team">${teams.map(key=>`<option value="${esc(key)}" ${key===id?'selected':''}>${esc(data.teams[key].name)}</option>`).join('')}</select></label>
  <label class="rx-between-picker" for="rx-between-day">Recorte<select id="rx-between-day"><option value="all">Fase 2 inteira</option>${days.map(d=>`<option value="${d}" ${d===day?'selected':''}>Dia ${d}</option>`).join('')}</select></label></div>
  <section class="rx-between-team"><div>${logo?`<img src="${esc(logo)}" width="52" height="52" alt="">`:''}<h2>${esc(team.name)}</h2></div><p>Fase 1: <b>${falls(first.matches)}</b> · ${period}: <b>${falls(second.matches)}</b> · <b>${second.totalPoints} pontos no recorte</b></p>
   <p>Em relação à Fase 1, a produção de pontos <strong>${trend}${metrics.points.percent!=null&&metrics.points.percent!==0?' '+num(Math.abs(metrics.points.percent))+'%':''}</strong>. ${changeStory(metrics)}</p></section>
  <div class="rx-between-metrics">${[['points','Pontos por queda'],['kills','Abates por queda'],['placement','Pts de colocação / queda']].map(([key,label])=>metricCard(label,metrics[key],secondLabel)).join('')}${metricCard('Booyahs',metrics.booyahRate,secondLabel,{rate:true,caption:`Fase 1: ${first.booyahs} em ${falls(first.matches)} · ${secondLabel}: ${second.booyahs} em ${falls(second.matches)}`})}</div>
  <p class="rx-between-context">${day?'Média do lobby do Dia '+day:'Média da Fase 2'}: <b>${num(leagueMean)} pontos por queda</b> · ${league.length} equipes. ${esc(team.name)} está ${num(Math.abs(leagueChange))}% ${second.points>=leagueMean?'acima':'abaixo'} dessa média.${day?`<br>Média do time na Fase 2 inteira: <b>${num(campaign.points)} pts/queda</b>. Neste dia, ${ownChange===0?'o rendimento foi igual':num(Math.abs(ownChange))+'% '+(ownChange>0?'acima':'abaixo')+' dessa média'}.`:''}</p>
  <details class="rx-between-details" id="rx-between-details"><summary>Ver detalhes</summary>
  ${halves?`<section class="rx-between-split"><h3>Começo × fim ${day?'do dia':'dos dias'}</h3><p>Média das três primeiras e das três últimas quedas ${day?'do Dia '+day:'de cada dia disputado'}, dentro do recorte.</p><div class="rx-between-bars">${[['Primeiras 3',halves.start],['Últimas 3',halves.end]].map(([label,s],i)=>`<div><span>${label}</span><i style="--bar:${Math.max(halves.start.points,halves.end.points)?s.points/Math.max(halves.start.points,halves.end.points)*100:0}%;--bar-color:${i?'var(--rx-highlight)':'var(--rx-bar)'}" aria-hidden="true"></i><b>${num(s.points)}</b></div>`).join('')}</div><p>${halves.start.matches} quedas em cada metade · pontos por queda. ${halves.end.points===halves.start.points?'Mesmo rendimento nas duas metades.':halves.end.points>halves.start.points?'O time terminou melhor do que começou.':'O rendimento caiu na segunda metade.'}</p></section>`:''}
  <div class="rx-between-insights"><section><h3>Regularidade</h3>${[['Fase 1',first],[period,second]].map(([label,s])=>`<p><b>${label}</b><br>Top 3: ${s.top3}/${s.matches} (${num(percent(s.top3,s.matches))}%) · Quedas zeradas: ${s.zeroPoints}/${s.matches} (${num(percent(s.zeroPoints,s.matches))}%)</p>`).join('')}<p>Top 3 é colocação entre os três primeiros; queda zerada é uma partida sem pontos.</p></section>
   <section><h3>Pontos sem Booyah</h3>${[['Fase 1',first.withoutBooyah],[period,second.withoutBooyah]].map(([label,s])=>`<p><b>${label}</b><br>${s.matches?`${num(s.points)} pts/queda sem vitória · ${s.totalPoints} pontos em ${falls(s.matches)}`:'Não houve quedas sem vitória neste recorte.'}</p>`).join('')}<p>Considera somente as quedas em que a equipe não fez Booyah.</p></section>
   <section><h3>Força dos adversários</h3>${first.opponentRank!=null&&second.opponentRank!=null?`<p><b>${num(first.opponentRank)}º → ${num(second.opponentRank)}º</b></p><p>${Math.abs(first.opponentRank-second.opponentRank)<.01?'Nível médio semelhante.':second.opponentRank<first.opponentRank?'Adversários mais fortes neste recorte da Fase 2.':'Adversários menos fortes neste recorte da Fase 2.'} Posição média dos 11 oponentes pela tabela final da Fase 1; número menor indica adversários mais fortes.</p>`:'<p>Classificação de referência indisponível.</p>'}</section>
   <section><h3>Melhor mapa observado · ${period}</h3><p><b>${esc(best.map)} · ${num(best.second.points)} pts/queda</b></p><p>${falls(best.second.matches)}${best.first?` · Fase 1: ${num(best.first.points)} pts/queda em ${falls(best.first.matches)}`:''}.${best.second.matches<2?' Amostra curta; uma única queda não define especialidade.':' Destaque entre mapas com pelo menos duas quedas.'}</p></section></div>
  <details class="rx-between-maps"><summary>Comparar os mapas</summary><table><caption class="rx-sr-only">Pontos por queda e tamanho da amostra de cada mapa</caption><thead><tr><th scope="col">Mapa</th><th scope="col">Fase 1</th><th scope="col">${secondLabel}</th><th scope="col">Variação</th></tr></thead><tbody>${maps.map(m=>`<tr><th scope="row">${esc(m.map)}</th>${[m.first,m.second].map(s=>`<td>${s?`<b>${num(s.points)}</b><small>${falls(s.matches)}</small>`:'—'}</td>`).join('')}<td>${m.first&&m.second&&delta(m.first.points,m.second.points)!=null?signed(delta(m.first.points,m.second.points))+'%':'—'}</td></tr>`).join('')}</tbody></table><p>Pontos por queda. Os mapas têm amostras diferentes; confira a quantidade de jogos ao comparar.</p></details>
  </details><p class="rx-between-note">Dados coletivos das rodadas completas. Os classificados saem mais cedo da Fase 2; esta comparação descreve desempenho, não é uma classificação acumulada da fase. Pontos obtidos nas quedas, sem penalidades administrativas. Dano e assistências não entram aqui enquanto a cobertura individual estiver incompleta.</p>`;
 const details=container.querySelector('#rx-between-details');if(detailsOpen)details.open=true;
 if(mapsOpen)container.querySelector('.rx-between-maps').open=true;
 container.querySelector('#rx-between-team').addEventListener('change',event=>onSelect(event.target.value,day,'rx-between-team'));
 container.querySelector('#rx-between-day').addEventListener('change',event=>onSelect(id,event.target.value==='all'?null:Number(event.target.value),'rx-between-day'));
 return {id,day};
}
