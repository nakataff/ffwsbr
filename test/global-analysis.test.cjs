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
 window.fetch=async()=>({ok:true,json:async()=>summary});
 window.eval(script.replace('export function comparison','function comparison').replace('import.meta.url','location.href'));
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
 assert.equal(search.getAttribute('aria-activedescendant'),'rx-result-0');
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

test('Evolução compares each round on the same scale and preserves the second participant when the metric changes',async t=>{
 const {window,document}=await openPage(t,'?visao=evolucao&id=loud-trap');
 const get=id=>document.getElementById(id);
 const select=(id,value)=>{
  get(id).value=value;
  get(id).dispatchEvent(new window.Event('change',{bubbles:true}));
 };
 const param=key=>new URLSearchParams(window.location.search).get(key);
 const legend=selector=>document.querySelector(selector).textContent;
 assert.match(legend('.rx-legend-primary'),/Média de Trap · 2,39 por queda/);
 assert.match(legend('.rx-legend-phase'),/Média da fase · 1,90 por queda/);
 assert.equal(document.querySelectorAll('.rx-trend-guide i').length,2);
 assert.equal(get('rx-compare').querySelector('[value="loud-trap"]'),null);
 assert.equal(get('rx-compare').querySelector('[value="loud"]'),null);
 select('rx-compare','los-rigby');
 assert.equal(param('comparar'),'los-rigby');
 assert.equal(document.activeElement,get('rx-compare'));
 assert.match(legend('.rx-legend-other'),/RIGBY · LOS · média de 3,56 por queda/);
 const rounds=[...document.querySelectorAll('.rx-trend li')];
 assert.deepEqual(rounds.map(row=>row.querySelector('.rx-trend-label strong').textContent),
  ['Rodada 1','Rodada 2','Rodada 4','Rodada 5','Rodada 6','Rodada 7','Rodada 8','Rodada 9','Rodada 11','Rodada 12']);
 assert.equal(rounds[1].querySelector('.rx-trend-value').firstChild.textContent,'—');
 assert.equal(rounds[1].querySelector('.rx-trend-other').title,'6 quedas');
 assert.equal(rounds[0].querySelector('.rx-trend-value').firstChild.textContent,'3,50');
 select('rx-metric','damage');
 assert.equal(get('rx-compare').value,'los-rigby');
 assert.match(legend('.rx-legend-phase'),/1\.295,48 por queda/);
 const shared=await openPage(t,window.location.search);
 assert.equal(shared.document.getElementById('rx-compare').value,'los-rigby');
 select('rx-compare','');
 assert.equal(param('comparar'),null);
 assert.equal(document.querySelector('.rx-trend-other'),null);

 const teams=await openPage(t,'?visao=evolucao&tipo=teams&id=loud&comparar=los');
 assert.match(teams.document.querySelector('.rx-legend-phase').textContent,/12,33 por queda/);
 assert.equal(teams.document.getElementById('rx-compare').value,'los');
 assert.match(teams.document.querySelector('.rx-legend-other').textContent,/LOS · média de 17,67 por queda/);
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
