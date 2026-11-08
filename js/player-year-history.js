/* Annual player kill history uses only already-associated editions.
 * Copa's small existing player snapshot is loaded only when the section is opened.
 * Unknown is NOT zero; no guessing from team lineups or event standings.
 */
(()=>{'use strict';
 const LBFF_YEAR=Object.freeze({1:2020,2:2020,3:2020,4:2021,5:2021,6:2021,7:2022,8:2022,9:2023});
 const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const compact=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
 const numeric=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
 const formatted=value=>Number(value).toLocaleString('pt-BR');
 function yearFor(edition){
  const explicit=numeric(edition.year);
  if(explicit>=2010&&explicit<=2100)return explicit;
  const name=String(edition.edition||edition.name||''),date=String(edition.date||edition.startDate||'');
  const match=(name+' '+date).match(/20\d{2}/);
  if(match)return Number(match[0]);
  const lbff=name.match(/\bLBFF\s*([1-9])\b/i);
  if(lbff)return LBFF_YEAR[Number(lbff[1])]||null;
  return null;
 }
 function recordFor(edition){
  const name=String(edition.edition||edition.name||'').trim();
  if(!name||/n[aã]o iniciad|sem participa[cç][aã]o|a iniciar|n[aã]o disputad/i.test(String(edition.status||'')))return null;
  const kills=numeric(edition.kills),matches=numeric(edition.matches);
  // A genuine 0-kill event has at least one match. A placeholder 0/0 is unknown.
  const known=kills!==null&&(kills>0||(matches!==null&&matches>0));
  return {name,year:yearFor(edition),kills:known?kills:null,matches,team:edition.team||'',key:compact(name)};
 }
 function collect(p){
  const results=[],seen=new Map();
  function add(item){
   const row=recordFor(item);if(!row)return;
   const key=(row.year||'?')+':'+row.key;
   if(seen.has(key)){
    const previous=results[seen.get(key)];
    if(previous.kills===null&&row.kills!==null)results[seen.get(key)]=row;
    return;
   }
   seen.set(key,results.length);results.push(row);
  }
  (Array.isArray(p?.editions)?p.editions:[]).forEach(add);
  if(p?.global2026){
   const s=p.global2026.stats?.geral||null;
   add({edition:'FFWS Global Finals 2026',year:2026,team:p.global2026.team?.name,
     kills:s?.kills,matches:s?.matches,status:'Participação no Mundial 2026'});
  }
  if(window.CFF_COPA_2026_BRIDGE?.eligible(p)){
   const c=p.copa2026?.stats?.geral||null;
   add({edition:'Copa FF 2026',year:2026,team:p.copa2026?.team||'',
     kills:c?.kills,matches:c?.matches,status:'Participação na Copa FF 2026'});
  }
  return results.sort((a,b)=>(b.year||0)-(a.year||0)||a.name.localeCompare(b.name,'pt-BR'));
 }
 function content(p){
  const rows=collect(p),years=new Map();
  rows.forEach(r=>{const key=r.year==null?'Ano não informado':String(r.year);if(!years.has(key))years.set(key,[]);years.get(key).push(r)});
  return years.size?[...years].map(([year,entries])=>{
    const confirmed=entries.filter(r=>r.kills!==null),unknown=entries.length-confirmed.length;
    const total=confirmed.reduce((sum,r)=>sum+r.kills,0);
    const summary=confirmed.length?formatted(total)+' abates registrados'+(unknown?' · '+unknown+' sem registro':''):'Abates não informados';
    return '<section class="player-year-group"><div class="player-year-head"><h3>'+escapeHTML(year)+'</h3><span>'+escapeHTML(summary)+'</span></div><div class="player-year-rows">'+entries.map(row=>
      '<div class="player-year-row"><div class="player-year-edition"><strong>'+escapeHTML(row.name)+'</strong>'+
      (row.team?'<small>'+escapeHTML(row.team)+'</small>':'')+'</div><div class="player-year-kills'+(row.kills===null?' is-unknown':'')+'"><b title="'+(row.kills===null?'Abates não disponíveis':'Abates registrados')+'">'+(row.kills===null?'?':formatted(row.kills))+'</b><small>ABATES</small></div></div>'
    ).join('')+'</div></section>';
  }).join(''):'<p class="season-empty">Ainda não há competições registradas para este jogador.</p>';
 }
 function markup(p){
  const count=collect(p).length;
  if(!count)return '';
  return '<details class="profile-section player-year-history-details" data-player-year-history>'+
    '<summary class="profile-history-summary"><div><h2>Histórico por ano</h2><p>'+count+' competiç'+(count===1?'ão':'ões')+' · abates por edição e totais registrados por ano</p></div><span class="profile-history-action"><span class="when-closed">Expandir</span><span class="when-open">Recolher</span><b aria-hidden="true">⌄</b></span></summary>'+
    '<p class="player-year-help">O símbolo <strong>?</strong> indica que a participação está registrada, mas os abates não foram informados. Não significa zero.</p>'+
    '<div class="player-year-history-content" data-player-year-content>'+content(p)+'</div></details>';
 }
 function attach(p){
  const details=document.querySelector('[data-player-year-history]');
  if(!details)return;
  let requested=false;
  details.addEventListener('toggle',async()=>{
   if(!details.open||requested||!window.CFF_COPA_2026_BRIDGE?.eligible(p))return;
   requested=true;
   const output=details.querySelector('[data-player-year-content]');
   try{
    const response=await window.CFF_COPA_2026_BRIDGE.load(p);
    if(response?.generalId===p.id&&response?.eventId==='copa-ff-2026')p.copa2026=response;
    if(output?.isConnected)output.innerHTML=content(p);
   }catch{requested=false;}
  });
 }
 window.CFF_PLAYER_YEAR_HISTORY=Object.freeze({collect,content,markup,attach});
})();