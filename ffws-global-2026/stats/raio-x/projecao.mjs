const formatNumber=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1});
const formatDate=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'UTC'});
const number=value=>formatNumber.format(value);
const date=value=>formatDate.format(new Date(value+'T12:00:00Z'));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

export function renderProjection(container,projection,teams,requestedDay,onSelect){
 const {days,finalists,strengthOf,runs,qualificationSlots}=projection;
 const selected=days.find(day=>day.day===requestedDay)||days.find(day=>day.forecast.length&&!day.result.length)||days.at(-1);
 if(!selected){
  container.innerHTML='<div class="rx-empty"><h1>Projeção da Fase 2</h1><p>O calendário da fase ainda não está disponível.</p></div>';
  return;
 }
 const name=id=>teams[id]?.name||id;
 const teamLink=id=>{
  const raw=teams[id]?.logo||'';
  const logo=raw&&!/[:\\]/.test(raw)&&!raw.includes('..')?'/'+raw.replace(/^\/+/, ''):'';
  return `<a class="rx-projection-team" href="/ffws-global-2026/equipe?time=${encodeURIComponent(id)}">
   ${logo?`<img src="${esc(logo)}" width="24" height="24" alt="" loading="lazy">`:''}<strong>${esc(name(id))}</strong>
  </a>`;
 };
 const {day,forecast,result,newcomers}=selected;
 const official=new Map(result.map(row=>[row.id,row]));
 const decided=result.length>0;
 const favorites=forecast.slice(0,2).filter(row=>official.get(row.id)?.rank<=2).length;
 const error=decided?forecast.reduce((sum,row)=>sum+Math.abs(row.points-official.get(row.id).points),0)/forecast.length:0;
 const ready=forecast.length>0;
 const published=selected.basis==='published';
 const reviewed=days.filter(item=>item.result.length&&item.basis==='published');
 const hits=reviewed.reduce((sum,item)=>sum+item.forecast.slice(0,2).filter(row=>item.result.some(real=>real.id===row.id&&real.rank<=2)).length,0);
 const changeLabel=value=>`${value>0?'+':''}${number(value)} p.p.`;
 const verdict=row=>official.get(row.id)?.rank<=2?'Acertou a vaga':'Não classificou';
 const review=decided?`<section class="rx-projection-review" aria-label="Conferência da previsão">
  <h3>${published?'Previsão antes das quedas':'Simulação retrospectiva'}</h3>
  <p><strong>${favorites} de 2 favoritos se classificaram</strong>${published?'':' · não conta no placar de acertos'}</p>
  <div class="rx-projection-picks">${forecast.slice(0,2).map((row,i)=>`<article class="${official.get(row.id)?.rank<=2?'is-hit':'is-miss'}">
   <small>${i+1}º favorito · ${number(row.probability)}% de chance</small>${teamLink(row.id)}
   <b>${verdict(row)}</b><span>Terminou em ${official.get(row.id)?.rank}º · ${number(official.get(row.id)?.points)} pts</span>
  </article>`).join('')}</div>
  <p class="rx-projection-actual"><b>Quem classificou:</b> ${result.slice(0,2).map(row=>esc(name(row.id))).join(' e ')}.</p>
  <small>Erro médio dos pontos projetados: ${number(error)} pts por equipe.${selected.model===1?' Previsão do modelo original, preservada.':''}</small>
 </section>`:'';
 const stateLabel=item=>item.result.length?'Resultado':item.started?'Em andamento':item.forecast.length?'Projeção':'Lobby pendente';
 const headings=days.map(item=>`<button type="button" data-projection-day="${item.day}" aria-pressed="${item===selected}"><strong>Dia ${item.day}</strong><span>${stateLabel(item)}</span></button>`).join('');
 const news=day>1?newcomers:[];
 const rows=forecast.map((row,index)=>{
  const real=official.get(row.id);
  const rank=strengthOf[row.id]?.rank;
  const form=selected.form?.[row.id];
  return `<tr class="${real?.rank<=2?'is-finalist':index<2?'is-favorite':''}">
   <th scope="row">${teamLink(row.id)}<small>${index+1}º favorito${news.includes(row.id)?' · Estreia':form?.days?` · F2: ${number(form.points)} pts/dia`:`${rank?' · '+rank+'º na Fase 1':''}`}</small></th>
   <td><strong>${number(row.probability)}%</strong>${form?.change!=null?`<small class="rx-projection-change ${form.change>0?'is-up':form.change<0?'is-down':''}">${changeLabel(form.change)}</small>`:''}</td>
   <td><strong>${number(row.points)}</strong><small>${number(row.low)}–${number(row.high)}</small></td>
   ${decided?`<td><strong>${number(real.points)}</strong><small>${real.rank}º no dia</small></td>`:''}
  </tr>`;
 }).join('');

 container.innerHTML=`
  <header class="rx-projection-header">
   <p class="rx-kicker">Knockout · Fase 2</p>
   <h1 id="rx-headline">Projeção da Fase 2</h1>
   <p>Chance de ficar no top 2 do dia e garantir vaga direta na Grande Final.</p>
  </header>
  <div class="rx-projection-days" role="group" aria-label="Dia da Fase 2">${headings}</div>
  <div class="rx-projection-grid">
   <section aria-labelledby="rx-projection-day-title">
    <div class="rx-projection-day-heading"><h2 id="rx-projection-day-title">Dia ${day}</h2><p>${date(selected.date)} · ${esc(selected.time)} de Brasília · ${selected.matches} quedas</p></div>
    ${ready?`
     ${decided?review:
      `<p class="rx-projection-cutoff">${selected.started?'Estimativa baseada nos dados anteriores a este dia. ':''}Corte projetado para a 2ª vaga <strong>${number(selected.cutoff)} pontos</strong></p>`}
     <table class="rx-projection-table">
      <caption class="rx-sr-only">Chances de classificação e pontos projetados no Dia ${day}</caption>
      <thead><tr><th scope="col">Equipe</th><th scope="col">Chance${decided?'<small>antes do dia</small>':''}</th><th scope="col">Pts proj.</th>${decided?'<th scope="col">Pts reais</th>':''}</tr></thead>
      <tbody>${rows}</tbody>
     </table>
     <p class="rx-projection-range">A faixa abaixo dos pontos contém 80% dos resultados simulados. A variação em pontos percentuais compara com o dia anterior; resultados e mudanças no lobby influenciam a chance.</p>
     <section class="rx-projection-history" aria-labelledby="rx-history-title"><h3 id="rx-history-title">Evolução das chances</h3>
      <label for="rx-projection-team">Equipe<select id="rx-projection-team">${forecast.map(row=>`<option value="${esc(row.id)}">${esc(name(row.id))}</option>`).join('')}</select></label>
      <div data-projection-history></div>
     </section>`:
     `<div class="rx-projection-pending">
      <p>${day>1?`A projeção abre após o resultado completo do Dia ${day-1}, quando o lobby estiver definido.`:'A projeção abre assim que a classificação da Fase 1 e o lobby estiverem confirmados.'}</p>
      ${news.length?`<h3>Estreiam neste dia</h3><ul>${news.map(id=>`<li>${teamLink(id)}</li>`).join('')}</ul>`:''}
     </div>`}
   </section>
   <aside class="rx-projection-finalists" aria-labelledby="rx-projection-finalists-title">
    <h2 id="rx-projection-finalists-title">Classificados para a Grande Final</h2>
    <p class="rx-projection-slots"><strong>${finalists.length} / ${qualificationSlots}</strong> vagas diretas pela Fase 2</p>
    ${reviewed.length?`<p class="rx-projection-score"><b>${hits} de ${reviewed.length*2} vagas previstas</b><small>Nos ${reviewed.length} dias com previsão publicada.</small></p>`:''}
    ${finalists.length?`<ol>${finalists.map(row=>{const predicted=days.find(d=>d.day===row.day);const index=predicted?.forecast.findIndex(f=>f.id===row.id);const chance=predicted?.forecast[index]?.probability;return `<li>${teamLink(row.id)}<small>Dia ${row.day} · ${row.rank}º · ${number(row.points)} pts</small><small>${predicted?.basis==='published'?`${index+1}º favorito · ${number(chance)}% · ${index<2?'Previsto no Top 2':'Fora do Top 2 previsto'}`:'Sem previsão anterior publicada'}</small></li>`;}).join('')}</ol>`:'<p>Os classificados aparecem aqui ao fim de cada dia.</p>'}
   </aside>
  </div>
  <details class="rx-projection-method">
   <summary>Como calculamos</summary>
   <div>
    <p>Simulamos ${number(runs)} disputas de seis quedas por dia. Cada queda distribui pontos de colocação e abates. A frequência de top 2 vira a chance de vaga. Os pontos projetados são a média das simulações e o corte é a mediana do placar do segundo colocado.</p>
    <p>Usamos pontos de colocação, abates e Booyahs da Fase 1. Ajustamos as médias pela força dos 11 adversários de cada queda, medida pela posição deles na classificação geral da Fase 1. A estimativa de abates dá 20% de peso a um índice de desempenho dos jogadores, com 50% de dano, 25% de abates e 25% de assistências, normalizados pela média do torneio. Amostras individuais pequenas têm influência reduzida.</p>
    <p>No modelo atualizado, a Fase 2 recebe 55% do peso após um dia completo da equipe, 65% após dois e 75% após três; o restante vem da Fase 1. Os pesos são normalizados por equipe, para que as 36 quedas da Fase 1 não abafem a forma recente. Dentro da Fase 2, cada dia mais antigo perde 25% de peso. Estreantes usam somente a Fase 1 até disputarem um dia completo. São escolhas de modelagem, não taxas de acerto comprovadas.</p>
    <p>Os placares reais começam do zero em cada rodada. Saem os dois classificados e entram dois times conforme o calendário. Uma chance pode subir com a saída de adversários fortes, mesmo depois de um resultado abaixo do esperado.</p>
    <p>As projeções são atualizadas quando os resultados são publicados. Se havia uma previsão publicada antes das quedas, ela é preservada para a comparação. Quando não há previsão salva para o lobby oficial, a análise é identificada como retrospectiva.</p>
    ${ready?`<details><summary>Força dos adversários na Fase 1</summary><ul class="rx-projection-opponents">
     ${forecast.map(row=>`<li><span>${esc(name(row.id))}</span><strong>${strengthOf[row.id]?.opponentRank!=null?`${number(strengthOf[row.id].opponentRank)}º`:'—'}</strong></li>`).join('')}
     </ul><p>Posição média dos adversários que a equipe enfrentou. Quanto menor o número, mais fortes os adversários pela tabela geral.</p></details>`:''}
   </div>
  </details>`;
 container.querySelector('.rx-projection-days').addEventListener('click',event=>{
  const button=event.target.closest('[data-projection-day]');
  if(button&&Number(button.dataset.projectionDay)!==day)onSelect(Number(button.dataset.projectionDay));
 });
 const selector=container.querySelector('#rx-projection-team');
 if(selector){
  const showHistory=()=>{
   const id=selector.value,form=selected.form?.[id];
   const history=days.filter(item=>item.day<=day).flatMap(item=>{
    const prediction=item.forecast.find(row=>row.id===id);if(!prediction)return [];
    const actual=item.result.find(row=>row.id===id);
    return `<tr><th scope="row">Dia ${item.day}</th><td>${number(prediction.probability)}%</td><td>${number(prediction.points)}</td><td>${actual?`${actual.rank}º · ${number(actual.points)} pts`:'A disputar'}</td></tr>`;
   }).join('');
   container.querySelector('[data-projection-history]').innerHTML=`<p>${form?.days?`Média na Fase 2: <b>${number(form.points)} pts/dia</b>. Último dia: ${number(form.lastPoints)} pts (${form.lastRank}º).${form.phaseTwoWeight!=null?` A fase atual tem <b>${number(form.phaseTwoWeight)}% do peso</b> nesta projeção.`:''}`:'Estreia na Fase 2: projeção baseada na Fase 1.'}</p>
    <table><caption class="rx-sr-only">Histórico de ${esc(name(id))}</caption><thead><tr><th scope="col">Dia</th><th scope="col">Chance antes</th><th scope="col">Pts proj.</th><th scope="col">Resultado</th></tr></thead><tbody>${history}</tbody></table>
    <small>As previsões dos dias já iniciados são mantidas como foram publicadas.${selected.model>=2?' O modelo atualizado é usado nas novas projeções.':''}</small>`;
  };
  selector.addEventListener('change',showHistory);showHistory();
 }
 return day;
}
