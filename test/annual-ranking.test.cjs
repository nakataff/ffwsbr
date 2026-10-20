'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom'),{build,FILES}=require('../scripts/build-annual-ranking.cjs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),tick=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
const inputs=()=>FILES.map(read);
async function ui({search='',failure=false}={}){
  const dom=new JSDOM('<main id="annual-ranking"></main>',{url:'https://centralfreefire.com.br/ranking-anual.html'+search,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,calls=[],copies=[],cards=[];let fail=failure;
  w.fetch=async url=>{calls.push(String(url));if(fail){fail=false;return {ok:false};}return {ok:true,json:async()=>read('ranking-data/brasil-2026.json')};};
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async value=>copies.push(value)}});
  w.openTestCard=async payload=>cards.push(payload);
  w.eval(fs.readFileSync('js/annual-ranking.mjs','utf8').replace("await import('/js/ranking-share-cards.mjs?v=20261020-cards-v4')",'{openRankingCard:window.openTestCard}'));
  await tick();
  return {w,calls,copies,cards,$:s=>w.document.querySelector(s),all:s=>[...w.document.querySelectorAll(s)],click:async s=>{w.document.querySelector(s).click();await tick();},search:async value=>{const e=w.document.querySelector('[data-annual-search]');e.value=value;e.dispatchEvent(new w.Event('input',{bubbles:true}));await tick();},close:()=>w.close()};
}
test('year ranking matches all 27 reviewed totals, merges sponsor aliases and omits the upcoming Global',()=>{
  const generated=build(inputs()),stored=read('ranking-data/brasil-2026.json');const {sources,...body}=stored;assert.deepEqual(body,generated);assert.equal(generated.rows.length,27);
  const expected={'LOUD':920,'FLUXO W7M':790,'LOS':565,'RUSH GAMING':405,'TEAM SOLID':335,'INFLUENCE RAGE':285,'ALPHA7':225,'RISE GAMING':218,'INTZ':215,'E1 SPORTS':130,'LINE 10':80,'SX TET':75,'CPT VOX':75,'VIRTUS PRO':70,'CIVIS':56,'LOOPS':56,'AXS FUSION':49,'AFROGAMES':45,'ALFA 34':35,'VASCO ESPORTS':32,'ANGELS OUTPLAY':28,'ANTISOCIAL TEAM':8,'XLD GAMING':8,'INCO GAMING':4,'DR3 PIT':4,'MG7 ESPORTS':4,'SIX EIGHT':4};
  for(const r of generated.rows){assert.equal(r.total,expected[r.team],r.team);assert.equal(r.total,r.results.reduce((s,x)=>s+x.points,0));assert(!r.results.some(x=>x.event==='global'));assert(fs.existsSync(r.logo),r.logo);}
  assert.equal(generated.rows.filter(r=>r.results.some(x=>x.event==='copa')).length,24);assert.equal(generated.rows.filter(r=>r.results.some(x=>x.event==='s1')).length,16);assert.equal(generated.rows.filter(r=>r.results.some(x=>x.event==='s2')).length,14);assert.equal(generated.rows.filter(r=>r.results.some(x=>x.event==='ewc')).length,3);
  assert.equal(generated.events.find(e=>e.id==='global').weight,7);assert.equal(generated.partial,true);assert(fs.statSync('ranking-data/brasil-2026.json').size<9000);
});
test('Champion Rush uses official places, equal unresolved scores share a rank, duplicates fail generation',()=>{
  const data=build(inputs()),team=n=>data.rows.find(r=>r.team===n);
  assert.equal(team('LOUD').results.find(x=>x.event==='s1').position,1);assert.equal(team('LOUD').results.find(x=>x.event==='s1').points,300);
  assert.equal(team('CPT VOX').rank,team('SX TET').rank);assert.equal(team('LOOPS').rank,team('CIVIS').rank);
  const src=inputs();src[0].copa.standings[1].team='FLUXO W7M';assert.throws(()=>build(src),/duplicada/);
});
test('one static fetch supports both complete views, search and the team calculation dialog',async()=>{
  const u=await ui();try{
    assert.equal(u.calls.length,1);assert.equal(u.all('.annual-table tbody tr').length,27);assert.equal(u.all('.annual-event').length,0);
    await u.click('[data-annual-view="competicoes"]');assert.equal(u.all('.annual-event').length,27*4);assert.equal(u.calls.length,1);
    await u.search('loud');assert.equal(u.all('.annual-table tbody tr').length,1);assert(u.$('.annual-table').textContent.includes('325'));assert.equal(new URL(u.w.location.href).searchParams.get('busca'),'loud');
    const b=u.$('[data-annual-team="LOUD"]');b.focus();await u.click('[data-annual-team="LOUD"]');assert(u.$('dialog').open);assert(u.$('#annual-campaign').textContent.includes('55 + 300 + 240 + 325 = 920'));assert(u.$('#annual-campaign').textContent.includes('65 pontos base × peso 5'));
    await u.click('[data-annual-close]');assert(!u.$('dialog').open);assert.equal(u.w.document.activeElement,b);assert.equal(u.calls.length,1);
    await u.search('sem resultado');assert(u.$('.annual-empty'));assert(u.$('[data-annual-share]').disabled);await u.click('[data-annual-clear]');assert.equal(u.all('.annual-table tbody tr').length,27);
  }finally{u.close();}
});
test('deep links restore the view and search; sharing freezes visible rows without fetching or renumbering',async()=>{
  const u=await ui({search:'?ano=2026&visao=competicoes&busca=SX'});try{
    assert.equal(u.all('.annual-table tbody tr').length,1);assert(u.$('.annual-detailed'));await u.click('[data-annual-link]');const url=new URL(u.copies[0]);assert.equal(url.searchParams.get('visao'),'competicoes');assert.equal(url.searchParams.get('busca'),'SX');
    await u.click('[data-annual-share]');const p=u.cards[0],selected=p.views.find(v=>v.id===p.viewId);assert(selected);assert.equal(selected.annualColumns.length,4);assert.equal(selected.rows[0].rank,12);assert.equal(selected.rows[0].points,75);assert.deepEqual(Array.from(selected.rows[0].annualValues),[null,null,75,null]);assert.equal(u.calls.length,1);
  }finally{u.close();}
});
test('a failed static download can be retried without account or database calls',async()=>{
  const u=await ui({failure:true});try{assert(u.$('[data-annual-retry]'));await u.click('[data-annual-retry]');assert.equal(u.all('.annual-table tbody tr').length,27);assert.equal(u.calls.length,2);assert(u.calls.every(x=>x.startsWith('/ranking-data/')));}finally{u.close();}
});
test('Histórico contains the annual page on home and standalone menus, with its group expanded',()=>{
  const dom=new JSDOM('<nav id="cff-public-sidebar-nav"></nav>',{url:'https://centralfreefire.com.br/ranking-anual.html',runScripts:'outside-only'});try{
    vm.runInContext(fs.readFileSync('js/shared-navigation.js','utf8'),dom.getInternalVMContext());dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    const link=dom.window.document.querySelector('[data-cff-group="historico"] a[href="/ranking-anual.html"]');assert(link);assert.equal(link.getAttribute('aria-current'),'page');assert(link.closest('details').open);
  }finally{dom.window.close();}
});
