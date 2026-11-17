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

test('Raio-X shows the published WASSANA comparison and navigates stories from controls and rankings',async t=>{
 const dom=new JSDOM(html,{url:'https://centralfreefire.com.br/ffws-global-2026/stats/raio-x/',runScripts:'outside-only'});
 t.after(()=>dom.window.close());
 const {window}=dom,{document}=window;
 window.fetch=async()=>({ok:true,json:async()=>summary});
 window.eval(script.replace('export function comparison','function comparison').replace('import.meta.url','location.href'));
 await new Promise(resolve=>setImmediate(resolve));
 const headline=()=>document.querySelector('h1').textContent;
 const control=key=>document.querySelector('select[name="'+key+'"]');
 const select=(key,value)=>{control(key).value=value;control(key).dispatchEvent(new window.Event('change',{bubbles:true}));};
 const chip=key=>document.querySelector('[data-metric="'+key+'"]');
 const param=key=>new URLSearchParams(window.location.search).get(key);
 const search=document.getElementById('rx-search');
 const type=query=>{search.value=query;search.dispatchEvent(new window.Event('input',{bubbles:true}));};
 const press=key=>search.dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
 const filters=document.getElementById('rx-filter-fields');
 const toggle=document.getElementById('rx-filters-toggle');
 assert.equal(filters.hidden,true);

 assert.match(headline(),/WASSANA fez 33 abates em 6 quedas/);
 assert.match(document.querySelector('.rx-duel').textContent,/11,57/);
 assert.match(document.querySelector('.rx-sample').textContent,/543 desempenhos.*105 jogadores/);
 assert.deepEqual([...document.querySelectorAll('.rx-series strong')].map(row=>row.textContent),['2','12','1','7','9','2']);
 assert.equal(chip('kills').getAttribute('aria-pressed'),'true');
 chip('damage').click();
 assert.match(headline(),/WASSANA fez 14\.582 de dano em 6 quedas/);
 assert.equal(param('rodada'),'10');
 assert.equal(param('metrica'),'damage');
 assert.equal(chip('damage'),document.activeElement);
 document.querySelector('[data-preset="players:damage"]').click();
 assert.match(headline(),/de dano em 6 quedas/);
 document.querySelector('[data-preset="teams:points"]').click();
 assert.match(headline(),/Buriram United Esports fez 151 pontos em 6 quedas/);
 assert.deepEqual([...document.querySelectorAll('.rx-metrics button strong')].map(el=>el.textContent),['151','97','4']);
 chip('kills').click();
 assert.match(headline(),/Buriram United Esports fez 97 abates em 6 quedas/);
 assert.equal(param('rodada'),'8');
 type('los');
 assert.match(document.querySelector('[role="option"]').textContent,/LOSEquipe/);
 press('ArrowDown');
 assert.equal(search.getAttribute('aria-activedescendant'),'rx-result-0');
 press('Enter');
 assert.equal(param('tipo'),'teams');
 assert.equal(param('id'),'los');
 assert.equal(search.getAttribute('aria-expanded'),'false');
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
 select('visao','media');
 assert.match(headline(),/por queda/);
 assert.match(document.querySelector('#rx-detail-title').textContent,/Rodada a rodada/);
 select('fase','segundaFase');
 if(!summary.phases.segundaFase.rounds.length){
  assert.match(document.querySelector('.rx-empty').textContent,/Ainda não há resultados cadastrados/);
  type('Rigby');
  press('Enter');
  assert.equal(param('fase'),'classificatoria');
  assert.equal(param('id'),'los-rigby');
  assert.match(headline(),/RIGBY.*por queda/);
 }
 toggle.click();
 assert.equal(filters.hidden,true);
 type('___');
 assert.equal(document.getElementById('rx-search-empty').hidden,false);
 press('Escape');
 assert.equal(search.getAttribute('aria-expanded'),'false');
});
