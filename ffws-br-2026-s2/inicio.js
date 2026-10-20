(() => {
'use strict';
if(window.CFFS2Inicio)return;
const root=document.getElementById('ffws-br-s2-inicio-content');
if(!root)return;
const VERSION='20261019-inicio-compact-v1';
const BASE='/ffws-br-2026-s2/';
const files={
  summary:BASE+'career-summary.json?v=20261011',
  mvp:BASE+'inicio-mvp-top10.json?v='+VERSION,
  squads:BASE+'inicio-elencos.json?v='+VERSION
};
const cache=new Map();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number(v)||0;
const fmt=v=>num(v).toLocaleString('pt-BR');
const links={classificatoria:'/ffws-br-s2/classificatoria',segundaFase:'/ffws-br-s2/segunda-fase',final:'/ffws-br-s2/final',mvp:'/ffws-br-s2/mvp',equipes:'/ffws-br-s2/equipes'};
const stages=[
 {id:'classificatoria',name:'Classificatória',short:'Classificatória'},
 {id:'segundaFase',name:'Segunda fase',short:'2ª fase'},
 {id:'final',name:'Grande Final',short:'Final'}
];
const state={tab:'tabela',stage:'final',mvpStage:'geral',team:''};
let requestId=0,initialized=false;
const query=selector=>root.querySelector(selector);
function get(key){
 if(!cache.has(key)){
   cache.set(key,fetch(files[key],{cache:'default'}).then(r=>{
      if(!r.ok)throw Error('Dados temporariamente indisponíveis');
      return r.json();
   }).catch(e=>{cache.delete(key);throw e;}));
 }
 return cache.get(key);
}
function buttons(items,current,attribute){
 return items.map(x=>'<button type="button" data-s2-'+attribute+'="'+esc(x.id)+'" class="'+(x.id===current?'is-active':'')+'" aria-pressed="'+String(x.id===current)+'">'+esc(x.short||x.name)+'</button>').join('');
}
function link(url,text){return '<a class="s2-start-complete" href="'+esc(url)+'">'+esc(text)+' <span aria-hidden="true">→</span></a>';}
function nameLink(name,team){
 return '<a href="/jogador.html?jogador='+encodeURIComponent(name)+'&time='+encodeURIComponent(team)+'">'+esc(name)+'</a>';
}
function eventLink(team){
 return '<a href="/equipe.html?time='+encodeURIComponent(team)+'">'+esc(team)+'</a>';
}
function formatSections(summary){
 const info=summary?.format||{},blocks=[
  ['01','Classificatória',info.classificatoria?.description||'14 equipes • 14 rodadas • 12 avançam.'],
  ['02','Segunda fase',info.segundaFase?.description||'12 equipes • bônus da classificatória • duas vagas no Mundial.'],
  ['03','Grande Final',info.final?.description||'Champion Rush • Match Point 160 • disputa pelo título.']
 ];
 const world=summary?.final?.worldQualifiedFromStage2||[];
 const champion=summary?.final?.champion||'A definir';
 return '<section class="s2-start-format" aria-label="Formato da competição">'+
 '<div class="s2-start-format-head"><h2>Como funciona a WB 2026 S2?</h2><p>Três etapas até a decisão do título brasileiro.</p></div>'+
 '<div class="s2-start-format-grid">'+blocks.map(([number,title,description])=>'<article><span class="s2-start-step">'+number+'</span><h3>'+esc(title)+'</h3><p>'+esc(description)+'</p></article>').join('')+'</div>'+
 '<div class="s2-start-results"><span><small>CAMPEÃO</small><strong>🏆 '+esc(champion)+'</strong></span>'+
 '<span><small>CLASSIFICADOS PELA 2ª FASE</small><strong>🌎 '+esc(world.join(' • ')||'Consultar resultado')+'</strong></span></div></section>';
}
function skeleton(){
 root.innerHTML='<div class="s2-start"><section class="s2-start-hero"><p class="s2-start-kicker">FREE FIRE • BRASIL • TEMPORADA 2026</p><div class="s2-start-hero-title"><div><h1>WB 2026 S2</h1><p>Acompanhe o formato, as classificações, os destaques individuais e os elencos desta edição.</p></div><span class="s2-start-status">ENCERRADO</span></div></section><div class="s2-start-loading">Preparando o resumo do torneio…</div></div>';
}
function layout(summary){
 root.innerHTML='<div class="s2-start">'+
 '<section class="s2-start-hero"><p class="s2-start-kicker">FREE FIRE • BRASIL • TEMPORADA 2026</p><div class="s2-start-hero-title"><div><h1>WB 2026 S2</h1><p>Resultados, jogadores e estatísticas essenciais, sem precisar abrir todas as páginas.</p></div><span class="s2-start-status">ENCERRADO</span></div></section>'+
 formatSections(summary)+
 '<section class="s2-start-data" aria-label="Dados da competição"><div class="s2-start-data-head"><h2>Explore o torneio</h2><p>Resumo rápido · consulte as páginas completas para análises detalhadas.</p></div>'+
 '<div role="tablist" class="s2-start-tabs" aria-label="Informações do torneio">'+[
  ['tabela','Tabela'],['mvp','Ranking MVP'],['equipes','Equipes']
 ].map(([id,title])=>'<button type="button" role="tab" data-s2-tab="'+id+'" aria-selected="'+String(id===state.tab)+'">'+title+'</button>').join('')+
 '</div><div id="s2-start-pane" role="tabpanel" aria-live="polite"></div></section></div>';
}
function stageTable(summary){
 const item=stages.find(x=>x.id===state.stage)||stages[2];
 const rows=Array.isArray(summary?.[item.id]?.rows)?summary[item.id].rows.filter(r=>Number.isFinite(Number(r.points))&&num(r.matches)>0):[];
 const leader=rows.slice().sort((a,b)=>num(a.position)-num(b.position));
 const th='<thead><tr><th>#</th><th>Equipe</th><th>Pontos</th><th>Abates</th><th>Booyahs</th></tr></thead>';
 const body=leader.length?'<tbody>'+leader.map((row,index)=>{
  const highlighted=index<3?' s2-start-top3':'';
  return '<tr class="'+highlighted+'"><td class="s2-start-rank">'+esc(row.position||index+1)+'º</td><td>'+eventLink(row.team)+'</td><td class="s2-start-number">'+fmt(row.points)+'</td><td class="s2-start-number">'+fmt(row.kills)+'</td><td class="s2-start-number">'+fmt(row.booyahs)+'</td></tr>';
 }).join('')+'</tbody>':'<tbody><tr><td colspan="5" class="s2-start-empty">Resumo não disponível nesta etapa. Confira a página completa.</td></tr></tbody>';
 return '<div class="s2-start-subtabs" aria-label="Etapa da tabela">'+buttons(stages,state.stage,'stage')+'</div>'+
 '<div class="s2-start-table-wrap"><table class="s2-start-table">'+th+body+'</table></div>'+
 '<div class="s2-start-under"><small>'+esc(item.name)+' · '+rows.length+' equipes</small>'+link(links[item.id],'Ver tabela completa')+'</div>';
}
function mvpTable(data){
 const available=data?.coverage?.[state.mvpStage]||'indisponivel';
 const partial=available==='parcial';
 const entries=Array.isArray(data?.top10?.[state.mvpStage])?data.top10[state.mvpStage].slice(0,10):[];
 const list=[{id:'geral',short:'Geral'},...stages];
 const top='<div class="s2-start-subtabs" aria-label="Etapa do MVP">'+buttons(list,state.mvpStage,'mvp-stage')+'</div>';
 const banner=partial?'<p class="s2-start-notice">Dados parciais: o Top 10 mostrado inclui somente a classificatória. A 2ª fase e a final ainda não constam no resumo individual leve; não é o ranking geral definitivo.</p>':'';
 if(!entries.length) return top+'<div class="s2-start-empty">O resumo individual desta etapa ainda não está consolidado neste arquivo compacto. Acesse o ranking completo para consultar os dados disponíveis.</div>'+link(links.mvp,'Abrir Ranking MVP completo');
 return top+banner+'<div class="s2-start-table-wrap"><table class="s2-start-table"><thead><tr><th>#</th><th>Jogador</th><th>Equipe</th><th>Abates</th><th>K/Q</th></tr></thead><tbody>'+
 entries.map((row,index)=>'<tr><td class="s2-start-rank">'+(index+1)+'º</td><td class="s2-start-player">'+nameLink(row.name,row.team)+'</td><td>'+esc(row.team)+'</td><td class="s2-start-number">'+fmt(row.kills)+'</td><td class="s2-start-number">'+(num(row.matches)?(num(row.kills)/num(row.matches)).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'—')+'</td></tr>').join('')+
 '</tbody></table></div><div class="s2-start-under"><small>Exibindo apenas Top 10 · '+esc(data.updatedAt||'')+'</small>'+link(links.mvp,'Ver Ranking MVP completo')+'</div>';
}
function squadView(data){
 const teams=Array.isArray(data?.teams)?data.teams:[];
 if(!teams.length)return '<div class="s2-start-empty">Elencos indisponíveis.</div>'+link(links.equipes,'Ver equipes completas');
 if(!teams.some(t=>t.name===state.team))state.team=teams[0].name;
 const team=teams.find(t=>t.name===state.team)||teams[0];
 const selector='<label class="s2-start-team-filter">Escolher equipe <select data-s2-team aria-label="Selecionar equipe">'+teams.map(t=>'<option value="'+esc(t.name)+'"'+(t.name===state.team?' selected':'')+'>'+esc(t.name)+'</option>').join('')+'</select></label>';
 const players=(team.players||[]);
 const pList='<div class="s2-start-roster">'+players.map(row=>
  '<div class="s2-start-roster-player"><div><strong>'+nameLink(row.name,team.name)+'</strong><small>'+esc(row.role||'Jogador')+(row.status==='Saiu'?' · Saiu durante a temporada':'')+'</small></div><span>'+ (num(row.matches)>0?'Participou da classificatória':'Elenco registrado')+'</span></div>'
 ).join('')+'</div>';
 return selector+'<div class="s2-start-team-head"><h3>'+esc(team.name)+'</h3><span>'+players.length+' jogadores registrados</span></div>'+
 pList+'<p class="s2-start-caption">Participações verificadas com os dados individuais da classificatória. Outros nomes constam nos elencos registrados; as demais fases ainda não estão consolidadas neste resumo.</p>'+
 '<div class="s2-start-under">'+link('/equipe.html?time='+encodeURIComponent(team.name),'Perfil da equipe')+link(links.equipes,'Ver todas as equipes')+'</div>';
}
async function renderPane(){
 const pane=query('#s2-start-pane');
 if(!pane)return;
 const seq=++requestId;
 pane.innerHTML='<div class="s2-start-loading">Carregando resumo…</div>';
 try{
  const key=state.tab==='tabela'?'summary':state.tab==='mvp'?'mvp':'squads';
  const data=await get(key);
  if(seq!==requestId)return;
  pane.innerHTML=state.tab==='tabela'?stageTable(data):state.tab==='mvp'?mvpTable(data):squadView(data);
 }catch(error){
  if(seq!==requestId)return;
  pane.innerHTML='<div class="s2-start-empty">Não foi possível carregar o resumo. Verifique a conexão e tente novamente.</div><button type="button" data-s2-retry>Tentar novamente</button>';
 }
}
async function boot(){
 if(initialized)return;
 initialized=true;skeleton();
 try{const summary=await get('summary');layout(summary);renderPane();}
 catch(error){root.innerHTML='<div class="s2-start"><div class="s2-start-empty">Não foi possível carregar os dados resumidos da WB 2026 S2. Atualize a página para tentar novamente.</div></div>';}
}
root.addEventListener('click',event=>{
 const btn=event.target.closest('button');
 if(!btn)return;
 if(btn.dataset.s2Tab){state.tab=btn.dataset.s2Tab;root.querySelectorAll('[data-s2-tab]').forEach(n=>n.setAttribute('aria-selected',String(n===btn)));renderPane();}
 else if(btn.dataset.s2Stage){state.stage=btn.dataset.s2Stage;renderPane();}
 else if(btn.dataset.s2MvpStage){state.mvpStage=btn.dataset.s2MvpStage;renderPane();}
 else if(btn.matches('[data-s2-retry]')){initialized=false;boot();}
});
root.addEventListener('change',event=>{if(event.target.matches('[data-s2-team]')){state.team=event.target.value;renderPane();}});
window.CFFS2Inicio={boot};
boot();
})();
