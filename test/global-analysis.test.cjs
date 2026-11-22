'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {test}=require('node:test');
const {JSDOM}=require('jsdom');

const base='../ffws-global-2026/stats/raio-x/';
const summary=require(base+'resumo.json');
const page=new URL(base,'file://'+__filename);
const script=fs.readFileSync(new URL('raio-x.mjs',page),'utf8');
const html=fs.readFileSync(new URL('index.html',page),'utf8');

test('record cohorts require complete rounds with the same number of drops and do not treat missing data as zero',async()=>{
 const {comparison}=await import(base+'raio-x.mjs');
 const phase={rounds:[
  {number:1,day:1,expected:2,drops:{1:'A',2:'B'},players:{a:[[1,4,15,0],[2,2,10,0]],b:[[1,5,14,0],[2,0,null,0]]}},
  {number:2,day:2,expected:1,drops:{1:'A'},players:{a:[[1,30,40,0]],b:[[1,4,10,0]]}}
 ]};
 const records=comparison(phase,'players','kills','rodada',2);
 assert.deepEqual(records.rows.map(row=>row.value),[6,5]);
 assert.equal(records.mean,5.5);
 assert.deepEqual(records.sizes,[2,1]);
 const campaign=comparison(phase,'players','damage','media');
 assert.equal(campaign.observations,5);
 assert.equal(campaign.mean,(15+10+14+40+10)/5);
 assert.equal(campaign.rows.find(row=>row.id==='b').count,2);
});

async function openPage(t,search=''){
 const dom=new JSDOM(html,{url:'https://centralfreefire.com.br/ffws-global-2026/stats/raio-x/'+search,runScripts:'outside-only'});
 t.after(()=>dom.window.close());
 const {window}=dom,{document}=window;
 window.fetch=async url=>({ok:true,json:async()=>String(url).endsWith('/projecao.json')?require(base+'projecao.json'):summary});
 window.loadProjectionModule=()=>import(base+'projecao.mjs');
 window.loadBetweenModule=()=>import(base+'entre-fases.mjs');
 window.eval(script.replace('export function comparison','function comparison').replaceAll('import.meta.url','location.href').replace("import('./projecao.mjs?v=2')",'window.loadProjectionModule()').replace("import('./entre-fases.mjs?v=1')",'window.loadBetweenModule()'));
 await new Promise(resolve=>setImmediate(resolve));
 return {window,document};
}

test('Raio-X opens in Campanha and keeps player or team when moving between the three views',async t=>{
 const {window,document}=await openPage(t);
 const headline=()=>document.querySelector('h1').textContent;
 const param=key=>new URLSearchParams(window.location.search).get(key);
 const metric=()=>document.getElementById('rx-metric');
 const select=(element,value)=>{element.value=value;element.dispatchEvent(new window.Event('change',{bubbles:true}));};
 const tab=view=>document.querySelector('[data-view="'+view+'"]');
 const keyboard=(element,key)=>element.dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
 const search=document.getElementById('rx-search');
 const type=query=>{search.value=query;search.dispatchEvent(new window.Event('input',{bubbles:true}));};
 const filters=document.getElementById('rx-filter-fields');
 const toggle=document.getElementById('rx-filters-toggle');

 assert.equal(filters.hidden,true);
 assert.equal(tab('media').getAttribute('aria-selected'),'true');
 assert.equal(headline(),'WASSANA');
 assert.match(document.querySelector('.rx-subtitle').textContent,/18 quedas disputadas/);
 assert.match(document.querySelector('.rx-metrics').textContent,/Abates754,17 por queda/);
 assert.equal(document.querySelectorAll('.rx-metrics button').length,0);
 assert.match(document.querySelector('.rx-duel').textContent,/1,90/);
 select(metric(),'damage');
 assert.equal(param('id'),'bru-wassana');
 assert.equal(metric(),document.activeElement);
 select(metric(),'kills');

 keyboard(tab('media'),'ArrowRight');
 assert.equal(tab('evolucao').getAttribute('aria-selected'),'true');
 assert.equal(tab('evolucao'),document.activeElement);
 assert.equal(headline(),'WASSANA');
 assert.match(document.querySelector('.rx-evolution .rx-legend').textContent,/Média de WASSANA · 4,17 por queda/);
 assert.deepEqual([...document.querySelectorAll('.rx-trend-label strong')].map(el=>el.textContent),['Rodada 8','Rodada 10','Rodada 12']);
 assert.deepEqual([...document.querySelectorAll('.rx-trend-value')].map(el=>el.firstChild.textContent),['4,83','5,50','2,17']);
 select(metric(),'assists');
 assert.match(document.querySelector('.rx-evolution p').textContent,/Assistências por queda/);

 type('los');
 assert.match(document.querySelector('[role="option"]').textContent,/LOSEquipe/);
 keyboard(search,'ArrowDown');
 assert.equal(search.getAttribute('aria-activedescendant'),'rx-search-results-0');
 keyboard(search,'Enter');
 assert.equal(param('tipo'),'teams');
 assert.equal(param('id'),'los');
 assert.equal(param('visao'),'evolucao');
 assert.equal(search.getAttribute('aria-expanded'),'false');

 tab('rodada').click();
 assert.match(headline(),/LOS fez 135 pontos em 6 quedas/);
 assert.equal(param('rodada'),'5');
 assert.match(document.querySelector('#rx-detail-title').textContent,/Queda a queda/);
 type('RÍGBY');
 const result=document.querySelector('[role="option"]');
 assert.match(result.textContent,/RIGBY/);
 result.click();
 assert.match(headline(),/RIGBY fez 30 abates em 6 quedas/);
 assert.equal(param('tipo'),'players');
 document.querySelectorAll('.rx-ranking button')[2].click();
 assert.match(window.location.search,/rodada=\d+/);
 assert.equal(document.activeElement.dataset.row,param('id'));

 toggle.click();
 assert.equal(filters.hidden,false);
 assert.equal(toggle.getAttribute('aria-expanded'),'true');
 select(document.querySelector('select[name="tipo"]'),'teams');
 assert.match(headline(),/Buriram United Esports fez 151 pontos em 6 quedas/);
 assert.deepEqual([...document.querySelectorAll('.rx-metrics strong')].map(el=>el.textContent),['151','97','4']);
 select(metric(),'kills');
 assert.match(headline(),/Buriram United Esports fez 97 abates em 6 quedas/);
 assert.equal(param('rodada'),'8');

 select(document.querySelector('select[name="fase"]'),'segundaFase');
 if(!summary.phases.segundaFase.rounds.length){
  assert.match(document.querySelector('.rx-empty').textContent,/ainda não tem dados/);
  type('Rigby');
  keyboard(search,'Enter');
  assert.equal(param('fase'),'classificatoria');
  assert.equal(param('id'),'los-rigby');
 }
 toggle.click();
 assert.equal(filters.hidden,true);
 type('___');
 assert.equal(document.getElementById('rx-search-empty').hidden,false);
 keyboard(search,'Escape');
 assert.equal(search.getAttribute('aria-expanded'),'false');
});

test('Evolução searches and compares up to four participants round by round',async t=>{
 const {window,document}=await openPage(t,'?visao=evolucao&id=loud-trap');
 const get=id=>document.getElementById(id);
 const select=(id,value)=>{
  get(id).value=value;
  get(id).dispatchEvent(new window.Event('change',{bubbles:true}));
 };
 const param=key=>new URLSearchParams(window.location.search).get(key);
 const participants=()=>new URLSearchParams(window.location.search).getAll('comparar');
 const legend=selector=>document.querySelector(selector).textContent;
 const search=query=>{
  get('rx-compare').value=query;
  get('rx-compare').dispatchEvent(new window.Event('input',{bubbles:true}));
 };
 const add=query=>{
  search(query);
  get('rx-compare').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
 };
 assert.match(legend('.rx-legend-primary'),/Média de Trap · 2,39 por queda/);
 assert.match(legend('.rx-legend-phase'),/Média da fase · 1,90 por queda/);
 assert.equal(document.querySelectorAll('.rx-trend-guide i').length,2);
 search('Trap');
 assert.equal(get('rx-compare-results').children.length,0);
 add('RÍGBY');
 assert.equal(param('comparar'),'los-rigby');
 assert.equal(document.activeElement,get('rx-compare'));
 assert.match(legend('.rx-legend-other'),/RIGBY · LOS · média de 3,56 por queda/);
 const rounds=[...document.querySelectorAll('.rx-trend li')];
 assert.deepEqual(rounds.map(row=>row.querySelector('.rx-trend-label strong').textContent),
  ['Rodada 1','Rodada 2','Rodada 4','Rodada 5','Rodada 6','Rodada 7','Rodada 8','Rodada 9','Rodada 11','Rodada 12']);
 assert.equal(rounds[1].querySelector('.rx-trend-value').firstChild.textContent,'—');
 assert.equal(rounds[1].querySelectorAll('.rx-trend-value')[1].title,'6 quedas');
 assert.equal(rounds[0].querySelector('.rx-trend-value').firstChild.textContent,'3,50');
 select('rx-metric','damage');
 assert.equal(param('comparar'),'los-rigby');
 assert.match(legend('.rx-legend-phase'),/1\.295,48 por queda/);
 search('Rigby');
 assert.equal(get('rx-compare-results').children.length,0);
 add('Wassana');
 search('BuTziN');
 get('rx-compare-results').querySelector('[role="option"]').click();
 assert.equal(participants().length,3);
 assert.equal(get('rx-compare').disabled,true);
 assert.equal(document.querySelectorAll('.rx-trend li:first-child .rx-trend-lane').length,4);
 const shared=await openPage(t,window.location.search+'&comparar=loud-trap&comparar=los-rigby&comparar=los-raone7');
 assert.deepEqual([...shared.document.querySelectorAll('[data-remove-compare]')].map(button=>button.dataset.removeCompare),participants());
 assert.equal(shared.document.getElementById('rx-compare').disabled,true);
 document.querySelector('[data-remove-compare="los-rigby"]').click();
 assert.ok(!participants().includes('los-rigby'));
 assert.equal(get('rx-compare').disabled,false);
 assert.equal(document.activeElement,get('rx-compare'));

 const teams=await openPage(t,'?visao=evolucao&tipo=teams&id=loud&comparar=los');
 assert.match(teams.document.querySelector('.rx-legend-phase').textContent,/12,33 por queda/);
 assert.ok(teams.document.querySelector('[data-remove-compare="los"]'));
 assert.match(teams.document.querySelector('.rx-legend-other').textContent,/LOS · média de 17,67 por queda/);
 const teamSearch=teams.document.getElementById('rx-compare');
 teamSearch.value='BRU';
 teamSearch.dispatchEvent(new teams.window.Event('input',{bubbles:true}));
 assert.match(teams.document.querySelector('#rx-compare-results [role="option"]').textContent,/Buriram United Esports/);
});

test('links to specific records still open Recordes and metric changes preserve the round',async t=>{
 const {window,document}=await openPage(t,'?fase=classificatoria&tipo=players&visao=rodada&metrica=kills&id=bru-wassana&rodada=10&quedas=6');
 const headline=document.getElementById('rx-headline');
 assert.match(headline.textContent,/WASSANA fez 33 abates em 6 quedas/);
 assert.match(document.querySelector('.rx-duel').textContent,/11,57/);
 assert.match(document.querySelector('.rx-sample').textContent,/543 desempenhos.*105 jogadores/);
 assert.deepEqual([...document.querySelectorAll('.rx-series strong')].map(row=>row.textContent),['2','12','1','7','9','2']);
 const select=document.getElementById('rx-metric');
 select.value='damage';
 select.dispatchEvent(new window.Event('change',{bubbles:true}));
 assert.match(document.getElementById('rx-headline').textContent,/WASSANA fez 14[.]582 de dano em 6 quedas/);
 assert.equal(new URLSearchParams(window.location.search).get('rodada'),'10');
});

test('the Phase 2 forecast balances two slots, freezes a published day and refits only with completed results',async t=>{
 const {build}=require('../scripts/build-global-projection.cjs');
 const forecast=require(base+'projecao.json');
 const overview=require('../ffws-global-2026/inicio-resumo.json');
 const data={teams:require('../ffws-global-2026/teams.json'),dates:require('../ffws-global-2026/dates.json')};

 // These are the pre-tournament published inputs even after the season advances.
 const initial=structuredClone(summary),tables=structuredClone(overview);
 initial.phases.segundaFase.rounds=[];
 tables.tables.segundaFase.days.forEach(day=>{day.rows=[];});
 const baseModel=build({data,overview:tables,analysis:initial});
 const first=baseModel.days[0];
 assert.equal(first.forecast.length,12);
 assert.ok(Math.abs(first.forecast.reduce((total,row)=>total+row.probability,0)-200)<.1);
 assert.ok(first.forecast.every(row=>row.low<row.points&&row.points<row.high));
 assert.deepEqual(baseModel.days.map(day=>day.forecast.length),[12,0,0,0]);

 const finishDay=(day,ids)=>{
  const ordered=ids.map((id,index)=>({id,points:132-index*6}));
  const round={day,expected:6,players:{},teams:Object.fromEntries(ordered.map(({id,points},i)=>[
   id,Array.from({length:6},(_,index)=>[index+1,points/6,Math.max(0,points/6-(i===0?12:6)),i===0?1:0])
  ]))};
  const rows=ordered.map(({id,points},index)=>({team:initial.teams[id].name,position:index+1,points,matches:6}));
  initial.phases.segundaFase.rounds[day-1]=round;
  tables.tables.segundaFase.days[day-1].rows=rows;
 };
 const initialIds=first.forecast.map(row=>row.id).reverse();
 finishDay(1,initialIds);
 initial.phases.segundaFase.rounds[0].teams[initialIds[0]].pop();
 const partial=build({data,overview:tables,analysis:initial,previous:baseModel});
 assert.deepEqual(partial.days[0].forecast,first.forecast);
 assert.equal(partial.days[0].started,true);
 assert.equal(partial.finalists.length,0);
 assert.equal(partial.days[1].forecast.length,0);

 finishDay(1,initialIds);
 const second=build({data,overview:tables,analysis:initial,previous:baseModel});
 assert.deepEqual(second.days[0].forecast,first.forecast);
 assert.equal(second.days[0].basis,'published');
 assert.deepEqual(second.finalists.map(row=>row.id),initialIds.slice(0,2));
 assert.deepEqual(second.days[1].forecast.map(row=>row.id).sort(),[...initialIds.slice(2),'resurrection-esports','gundynasty'].sort());
 assert.deepEqual(second.days.slice(2).map(day=>day.forecast.length),[0,0]);
 for(let day=2;day<=4;day++){
  const fixture=baseModel.days[day-1];
  const previous=initial.phases.segundaFase.rounds[day-2];
  finishDay(day,[...fixture.newcomers,...Object.keys(previous.teams).slice(2)]);
 }
 const finished=build({data,overview:tables,analysis:initial,previous:second});
 assert.equal(new Set(finished.finalists.map(row=>row.id)).size,8);
 assert.deepEqual(finished.days[1].forecast,second.days[1].forecast);
 assert.equal(finished.days[2].basis,'retrospective');
 assert.equal(finished.days[3].result.length,12);
 assert.deepEqual(build({data,overview:tables,analysis:initial,previous:finished}),finished);
 assert.ok(forecast.days[0].forecast.length===12);

 const {renderProjection}=await import(base+'projecao.mjs');
 const {window,document}=await openPage(t,'?visao=projecao&dia=2');
 assert.equal(document.querySelector('[data-view="projecao"]').getAttribute('aria-selected'),'true');
 assert.equal(document.getElementById('rx-search').closest('.rx-search').hidden,true);
 assert.equal(document.getElementById('rx-projection-day-title').textContent,'Dia 2');
 document.querySelector('[data-projection-day="1"]').click();
 assert.equal(new URL(window.location.href).searchParams.get('dia'),'1');
 assert.equal(document.querySelectorAll('.rx-projection-table tbody tr').length,12);
 document.querySelector('[data-view="media"]').click();
 assert.equal(document.getElementById('rx-search').closest('.rx-search').hidden,false);
 const container=document.createElement('div');
 renderProjection(container,baseModel,initial.teams,2,()=>{});
 assert.match(container.textContent,/Lobby pendente/);
 assert.match(container.textContent,/Resurrection Esports/);
 assert.equal(container.querySelector('table'),null);
 renderProjection(container,finished,initial.teams,1,()=>{});
 assert.match(container.textContent,/0 de 2 favoritos se classificaram/);
 assert.equal(container.querySelectorAll('.rx-projection-table tbody tr').length,12);
 assert.equal(container.querySelectorAll('.rx-projection-finalists li').length,8);
 renderProjection(container,finished,initial.teams,3,()=>{});
 assert.match(container.textContent,/Simulação retrospectiva/);
});

test('recent phase-two form has explicit per-team weights and changes strength without any future-day input',()=>{
 const {learn,phaseTwoShare}=require('../scripts/build-global-projection.cjs');
 assert.deepEqual([0,1,2,3,4].map(phaseTwoShare),[0,.55,.65,.75,.75]);
 const ranks=new Map(Array.from({length:24},(_,i)=>['team'+i,i+1]));
 const ids=[...ranks.keys()];
 const batch=(day,value,phaseTwo=false)=>({phaseTwo,weight:1,round:{day,players:{}},drops:Array.from({length:phaseTwo?6:36},(_,i)=>Object.fromEntries(ids.map(id=>[id,[i+1,id==='team0'?value:10,id==='team0'?value/2:5,0]])))});
 const analysis={players:{}};
 const prior=batch(1,10);
 const original=learn(analysis,[prior],ranks).skills;
 const poor=learn(analysis,[prior,batch(1,2,true)],ranks).skills;
 const strong=learn(analysis,[prior,batch(1,26,true)],ranks).skills;
 assert(poor.get('team0').offense<original.get('team0').offense);
 assert(poor.get('team0').placement<original.get('team0').placement);
 assert(strong.get('team0').offense>original.get('team0').offense);
 assert(strong.get('team0').placement>original.get('team0').placement);
 // A new entrant has no phase-two games; its rating stays based on phase one.
 const phaseTwo=batch(1,2,true);for(const drop of phaseTwo.drops)delete drop.team23;
 const newcomer=learn(analysis,[prior,phaseTwo],ranks).skills.get('team23');
 assert.equal(newcomer.placement,original.get('team23').placement);
});

test('published forecasts are immutable; review identifies every pick and trajectory keeps the pre-day snapshot',async t=>{
 const projection=structuredClone(require(base+'projecao.json'));projection.days[3].result=[];projection.finalists=projection.finalists.filter(f=>f.day<4);const {renderProjection}=await import(base+'projecao.mjs');
 const dom=new JSDOM('<main></main>',{runScripts:'outside-only'});t.after(()=>dom.window.close());
 const container=dom.window.document.querySelector('main');
 for(const [day,hits] of [[1,0],[2,1],[3,0]]){
  renderProjection(container,projection,summary.teams,day,()=>{});
  assert.match(container.querySelector('.rx-projection-review').textContent,new RegExp(hits+' de 2 favoritos'));
  assert.equal(container.querySelectorAll('.rx-projection-picks article.is-hit').length,hits);
  assert.equal(container.querySelectorAll('.rx-projection-picks article.is-miss').length,2-hits);
  for(const row of projection.days[day-1].forecast.slice(0,2))assert(container.querySelector('.rx-projection-picks').textContent.includes(summary.teams[row.id].name));
 }
 renderProjection(container,projection,summary.teams,4,()=>{});
 assert.match(container.querySelector('.rx-projection-score').textContent,/1 de 6 vagas previstas/);
 const select=container.querySelector('#rx-projection-team');select.value='bru';select.dispatchEvent(new dom.window.Event('change'));
 const history=container.querySelector('[data-projection-history]');
 assert.match(history.textContent,/66 pts\/dia/);assert.match(history.textContent,/75% do peso/);
 assert.equal(history.querySelectorAll('tbody tr').length,4);
 assert.deepEqual([...history.querySelectorAll('tbody tr td:last-child')].map(td=>td.textContent),['9º · 62 pts','9º · 48 pts','4º · 88 pts','A disputar']);
 assert.equal(projection.days[3].model,2);
 assert(projection.days.slice(0,3).every(d=>d.model===1));
 assert.equal(projection.days[3].form['team-inf'].phaseTwoWeight,0);
 assert.equal(projection.days[3].form.bru.phaseTwoWeight,75);
});

test('Entre fases deep link reuses the existing summary, switches teams and keeps a shareable URL',async t=>{
 const {window,document}=await openPage(t,'?visao=fases&id=los');
 for(let i=0;i<30&&!document.querySelector('#rx-between-team');i++)await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(document.querySelector('[data-view="fases"]').getAttribute('aria-selected'),'true');
 assert.equal(document.querySelector('#rx-between-team').value,'los');
 assert(document.querySelector('.rx-search').hidden);assert.match(document.querySelector('h2').textContent,/LOS/);
 const select=document.querySelector('#rx-between-team');select.value='gundynasty';select.dispatchEvent(new window.Event('change'));
 assert.equal(new URL(window.location.href).searchParams.get('id'),'gundynasty');
 assert.equal(document.activeElement.id,'rx-between-team');assert.match(document.querySelector('h2').textContent,/GunDynasty/);
 document.querySelector('[data-view="media"]').click();assert.equal(document.querySelector('.rx-search').hidden,false);
});
