const fmt=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2,minimumFractionDigits:2});
const num=v=>fmt.format(v),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
const mapName=name=>/^(nova terra|nexterra)$/i.test(name)?'Nexterra':name||'Mapa não informado';
const delta=(a,b)=>a===0?null:100*(b/a-1);
const signed=v=>(v>0?'+':'')+num(v);

export function phaseTeam(data,phase,id){
 const rows=[],opponents=[],maps=new Map(),daily=[];
 for(const round of data.phases[phase]?.rounds||[]){
  const team=round.teams[id]||[];
  if(!round.expected||team.length!==round.expected||team.some((r,i)=>r[0]!==i+1||!r.slice(1).every(Number.isFinite)))continue;
  daily.push({day:round.day,points:team.reduce((sum,r)=>sum+r[1],0),matches:team.length});
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
 const stats=items=>({matches:items.length,points:mean(items.map(r=>r[1])),kills:mean(items.map(r=>r[2])),placement:mean(items.map(r=>r[1]-r[2])),booyahs:items.reduce((sum,r)=>sum+r[3],0)});
 return {...stats(rows),opponentRank:mean(opponents),maps:Object.fromEntries([...maps].map(([map,values])=>[map,stats(values)])),daily};
}

export function comparePhases(data,id){
 const first=phaseTeam(data,'classificatoria',id),second=phaseTeam(data,'segundaFase',id);
 if(!first||!second)return null;
 const metrics=Object.fromEntries(['points','kills','placement'].map(key=>[key,{first:first[key],second:second[key],change:second[key]-first[key],percent:delta(first[key],second[key])}]));
 const maps=[...new Set([...Object.keys(first.maps),...Object.keys(second.maps)])].map(map=>({map,first:first.maps[map]||null,second:second.maps[map]||null}));
 maps.sort((a,b)=>(b.second?.points??-1)-(a.second?.points??-1)||a.map.localeCompare(b.map));
 const reliable=maps.filter(m=>m.second?.matches>=2),best=(reliable.length?reliable:maps.filter(m=>m.second))[0];
 return {first,second,metrics,maps,best};
}

export function renderBetweenPhases(container,data,requestedId,onSelect){
 const teams=Object.keys(data.teams).filter(id=>phaseTeam(data,'segundaFase',id)).sort((a,b)=>data.teams[a].name.localeCompare(data.teams[b].name,'pt-BR'));
 const id=teams.includes(requestedId)?requestedId:teams.includes('los')?'los':teams[0];
 const result=id&&comparePhases(data,id);
 if(!result){container.innerHTML='<div class="rx-empty"><h1>Entre fases</h1><p>A comparação aparece quando uma equipe tiver rodadas completas nas duas fases.</p></div>';return;}
 const {first,second,metrics,maps,best}=result,team=data.teams[id];
 const trend=metrics.points.change>0?'aumentou':metrics.points.change<0?'caiu':'se manteve';
 const league=Object.keys(data.teams).map(t=>phaseTeam(data,'segundaFase',t)).filter(Boolean);
 const leagueMean=league.reduce((sum,t)=>sum+t.points*t.matches,0)/league.reduce((sum,t)=>sum+t.matches,0);
 const logo=team.logo&&!/[:\\]|\.\./.test(team.logo)?'/'+team.logo.replace(/^\//,''):'';
 container.innerHTML=`<header class="rx-between-header"><p class="rx-kicker">Equipes · Fase 1 × Fase 2</p><h1 id="rx-headline">Como o time mudou</h1><p>Compare a produção por queda nas duas fases, mesmo com quantidades diferentes de jogos.</p></header>
  <label class="rx-between-picker" for="rx-between-team">Equipe<select id="rx-between-team">${teams.map(key=>`<option value="${esc(key)}" ${key===id?'selected':''}>${esc(data.teams[key].name)}</option>`).join('')}</select></label>
  <section class="rx-between-team"><div>${logo?`<img src="${esc(logo)}" width="52" height="52" alt="">`:''}<h2>${esc(team.name)}</h2></div><p>Fase 1: <b>${first.matches} quedas</b> · Fase 2: <b>${second.matches} quedas</b></p>
   <p>A produção de pontos <strong>${trend}${metrics.points.percent!=null&&metrics.points.percent!==0?' '+num(Math.abs(metrics.points.percent))+'%':''}</strong>. ${metrics.kills.change<0&&metrics.placement.change>0?'A colocação melhorou, enquanto os abates caíram.':metrics.kills.change>0&&metrics.placement.change<0?'Os abates cresceram, enquanto os pontos de colocação caíram.':'Veja o que explica a mudança abaixo.'}</p></section>
  <div class="rx-between-metrics">${[['points','Pontos por queda'],['kills','Abates por queda'],['placement','Pts de colocação / queda']].map(([key,label])=>{
   const m=metrics[key],max=Math.max(m.first,m.second),percent=m.percent;
   return `<section><h3>${label}</h3><div class="rx-between-bars">${[['Fase 1',m.first],['Fase 2',m.second]].map(([phase,value],i)=>`<div><span>${phase}</span><i style="--bar:${max?value/max*100:0}%;--bar-color:${i?'var(--rx-highlight)':'var(--rx-bar)'}" aria-hidden="true"></i><b>${num(value)}</b></div>`).join('')}</div><p class="${m.change>0?'is-up':m.change<0?'is-down':''}">${signed(m.change)} por queda${percent!=null?' · '+signed(percent)+'%':''}</p></section>`;
  }).join('')}</div>
  <p class="rx-between-context">Média da Fase 2: <b>${num(leagueMean)} pontos por queda</b>. ${esc(team.name)} está ${num(Math.abs(100*(second.points/leagueMean-1)))}% ${second.points>=leagueMean?'acima':'abaixo'} dessa média.<br>Booyahs: ${first.booyahs} em ${first.matches} quedas (${num(100*first.booyahs/first.matches)}%) na Fase 1; ${second.booyahs} em ${second.matches} (${num(100*second.booyahs/second.matches)}%) na Fase 2.</p>
  <div class="rx-between-insights"><section><h3>Força dos adversários</h3>${first.opponentRank!=null&&second.opponentRank!=null?`<p><b>${num(first.opponentRank)}º → ${num(second.opponentRank)}º</b></p><p>${Math.abs(first.opponentRank-second.opponentRank)<.01?'Nível médio semelhante.':second.opponentRank<first.opponentRank?'Adversários mais fortes na Fase 2.':'Adversários menos fortes na Fase 2.'} Posição média dos 11 oponentes pela tabela final da Fase 1; número menor indica adversários mais fortes.</p>`:'<p>Classificação de referência indisponível.</p>'}</section>
   <section><h3>Melhor mapa observado na Fase 2</h3><p><b>${esc(best.map)} · ${num(best.second.points)} pts/queda</b></p><p>${best.second.matches} queda${best.second.matches===1?'':'s'}${best.first?` · Fase 1: ${num(best.first.points)} pts/queda em ${best.first.matches} quedas`:''}.${best.second.matches<2?' Amostra curta; uma única queda não define especialidade.':' Destaque entre mapas com pelo menos duas quedas.'}</p></section></div>
  <details class="rx-between-maps"><summary>Comparar os mapas</summary><table><caption class="rx-sr-only">Pontos por queda e tamanho da amostra de cada mapa</caption><thead><tr><th scope="col">Mapa</th><th scope="col">Fase 1</th><th scope="col">Fase 2</th><th scope="col">Variação</th></tr></thead><tbody>${maps.map(m=>`<tr><th scope="row">${esc(m.map)}</th>${[m.first,m.second].map(s=>`<td>${s?`<b>${num(s.points)}</b><small>${s.matches} ${s.matches===1?'queda':'quedas'}</small>`:'—'}</td>`).join('')}<td>${m.first&&m.second&&delta(m.first.points,m.second.points)!=null?signed(delta(m.first.points,m.second.points))+'%':'—'}</td></tr>`).join('')}</tbody></table><p>Pontos por queda. Os mapas têm amostras diferentes; confira a quantidade de jogos ao comparar.</p></details>
  <p class="rx-between-note">Dados coletivos das rodadas completas. Os classificados saem mais cedo da Fase 2; esta comparação descreve desempenho, não é uma classificação acumulada da fase. Pontos obtidos nas quedas, sem penalidades administrativas. Dano e assistências não entram aqui enquanto a cobertura individual estiver incompleta.</p>`;
 container.querySelector('#rx-between-team').addEventListener('change',event=>onSelect(event.target.value));
 return id;
}
