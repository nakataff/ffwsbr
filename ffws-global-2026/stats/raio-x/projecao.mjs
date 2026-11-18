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
 const stateLabel=item=>item.result.length?'Resultado':item.started?'Em andamento':item.forecast.length?'Projeção':'Lobby pendente';
 const headings=days.map(item=>`<button type="button" data-projection-day="${item.day}" aria-pressed="${item===selected}"><strong>Dia ${item.day}</strong><span>${stateLabel(item)}</span></button>`).join('');
 const news=day>1?newcomers:[];
 const rows=forecast.map((row,index)=>{
  const real=official.get(row.id);
  const rank=strengthOf[row.id]?.rank;
  return `<tr class="${real?.rank<=2?'is-finalist':index<2?'is-favorite':''}">
   <th scope="row">${teamLink(row.id)}<small>${rank?`${rank}º na Fase 1`:''}${news.includes(row.id)?' · Estreia':''}</small></th>
   <td><strong>${number(row.probability)}%</strong></td>
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
     ${decided?`<div class="rx-projection-review"><p><strong>${published?'Previsão publicada × resultado oficial':'Simulação retrospectiva × resultado oficial'}</strong></p>
      <p>${favorites} de 2 favoritos se classificaram · erro médio de ${number(error)} pontos por equipe.</p></div>`:
      `<p class="rx-projection-cutoff">${selected.started?'Estimativa baseada nos dados anteriores a este dia. ':''}Corte projetado para a 2ª vaga <strong>${number(selected.cutoff)} pontos</strong></p>`}
     <table class="rx-projection-table">
      <caption class="rx-sr-only">Chances de classificação e pontos projetados no Dia ${day}</caption>
      <thead><tr><th scope="col">Equipe</th><th scope="col">Top 2</th><th scope="col">Pts proj.</th>${decided?'<th scope="col">Pts reais</th>':''}</tr></thead>
      <tbody>${rows}</tbody>
     </table>
     <p class="rx-projection-range">A faixa abaixo dos pontos contém 80% dos resultados simulados. As chances são por dia.</p>`:
     `<div class="rx-projection-pending">
      <p>${day>1?`A projeção abre após o resultado completo do Dia ${day-1}, quando o lobby estiver definido.`:'A projeção abre assim que a classificação da Fase 1 e o lobby estiverem confirmados.'}</p>
      ${news.length?`<h3>Estreiam neste dia</h3><ul>${news.map(id=>`<li>${teamLink(id)}</li>`).join('')}</ul>`:''}
     </div>`}
   </section>
   <aside class="rx-projection-finalists" aria-labelledby="rx-projection-finalists-title">
    <h2 id="rx-projection-finalists-title">Classificados para a Grande Final</h2>
    <p class="rx-projection-slots"><strong>${finalists.length} / ${qualificationSlots}</strong> vagas diretas pela Fase 2</p>
    ${finalists.length?`<ol>${finalists.map(row=>`<li>${teamLink(row.id)}<small>Dia ${row.day} · ${row.rank}º · ${number(row.points)} pts</small></li>`).join('')}</ol>`:'<p>Os classificados aparecem aqui ao fim de cada dia.</p>'}
   </aside>
  </div>
  <details class="rx-projection-method">
   <summary>Como calculamos</summary>
   <div>
    <p>Simulamos ${number(runs)} disputas de seis quedas por dia. Cada queda distribui pontos de colocação e abates. A frequência de top 2 vira a chance de vaga. Os pontos projetados são a média das simulações e o corte é a mediana do placar do segundo colocado.</p>
    <p>Usamos pontos de colocação, abates e Booyahs da Fase 1. Ajustamos as médias pela força dos 11 adversários de cada queda, medida pela posição deles na classificação geral da Fase 1. A estimativa de abates dá 20% de peso a um índice de desempenho dos jogadores, com 50% de dano, 25% de abates e 25% de assistências, normalizados pela média do torneio. Amostras individuais pequenas têm influência reduzida.</p>
    <p>As quedas completas do último dia da Fase 2 pesam 2,4 vezes uma queda da Fase 1 no modelo. Esse peso cai em 25% a cada dia anterior. Os placares reais começam do zero em cada rodada. Saem os dois classificados e entram dois times conforme o calendário.</p>
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
 return day;
}
