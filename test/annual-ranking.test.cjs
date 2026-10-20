'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom'),{build,FILES,YEAR_FILES}=require('../scripts/build-annual-ranking.cjs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),tick=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
const inputs=()=>FILES.map(read);
async function ui({search='',failure=false,delayed=false}={}){
  const dom=new JSDOM('<main id="annual-ranking"></main>',{url:'https://centralfreefire.com.br/ranking-anual.html'+search,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,calls=[],copies=[],cards=[],pending=[];let fail=failure;
  w.fetch=async url=>{calls.push(String(url));if(fail){fail=false;return {ok:false};}const year=Number(String(url).match(/brasil-(202[56])/)[1]);if(delayed)await new Promise(resolve=>pending.push({year,resolve}));return {ok:true,json:async()=>read(`ranking-data/brasil-${year}.json`)};};
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async value=>copies.push(value)}});
  w.openTestCard=async payload=>cards.push(payload);
  w.eval(fs.readFileSync('js/annual-ranking.mjs','utf8').replace("await import('/js/ranking-share-cards.mjs?v=20261020-cards-v6')",'{openRankingCard:window.openTestCard}'));
  await tick();
  return {w,calls,copies,cards,pending,year:async value=>{const e=w.document.querySelector('[data-annual-year]');e.value=String(value);e.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();},$:s=>w.document.querySelector(s),all:s=>[...w.document.querySelectorAll(s)],click:async s=>{w.document.querySelector(s).click();await tick();},search:async value=>{const e=w.document.querySelector('[data-annual-search]');e.value=value;e.dispatchEvent(new w.Event('input',{bubbles:true}));await tick();},close:()=>w.close()};
}
test('year ranking matches all 27 reviewed totals, merges sponsor aliases and omits the upcoming Global',()=>{
  const generated=build(inputs()),stored=read('ranking-data/brasil-2026.json');const {sources,...body}=stored;assert.deepEqual(body,generated);assert.equal(generated.rows.length,27);
  const expected={'LOUD':1705,'FLUXO W7M':1190,'LOS':775,'RUSH GAMING':735,'TEAM SOLID':390,'INFLUENCE RAGE':285,'ALPHA7':225,'RISE GAMING':218,'INTZ':215,'E1 SPORTS':130,'LINE 10':150,'SX TET':75,'CPT VOX':75,'VIRTUS PRO':70,'CIVIS':56,'LOOPS':56,'AXS FUSION':49,'AFROGAMES':45,'ALFA 34':35,'VASCO ESPORTS':32,'ANGELS OUTPLAY':28,'ANTISOCIAL TEAM':8,'XLD GAMING':8,'INCO GAMING':4,'DR3 PIT':4,'MG7 ESPORTS':4,'SIX EIGHT':4};
  for(const r of generated.rows){if(read('ranking-data/brasil-2026-source.json').methodVersion===2)assert.equal(r.total,expected[r.team],r.team);assert.equal(r.total,r.results.reduce((s,x)=>s+x.points,0));for(const x of r.results)assert.equal(x.points,generated.basePoints[x.position-1]*generated.events.find(e=>e.id===x.event).weight);assert(!r.results.some(x=>x.event==='global'));assert(fs.existsSync(r.logo),r.logo);}
  assert.equal(generated.rows.filter(r=>r.results.some(x=>x.event==='copa')).length,24);assert.equal(generated.rows.filter(r=>r.results.some(x=>x.event==='s1')).length,16);assert.equal(generated.rows.filter(r=>r.results.some(x=>x.event==='s2')).length,14);assert.equal(generated.rows.filter(r=>r.results.some(x=>x.event==='ewc')).length,3);
  assert.equal(generated.events.find(e=>e.id==='global').weight,7);assert.equal(generated.partial,true);assert(fs.statSync('ranking-data/brasil-2026.json').size<9000);
});
test('Champion Rush uses official places, equal unresolved scores share a rank, duplicates fail generation',()=>{
  const data=build(inputs()),team=n=>data.rows.find(r=>r.team===n);
  assert.equal(team('LOUD').results.find(x=>x.event==='s1').position,1);assert.equal(team('LOUD').results.find(x=>x.event==='s1').points,data.basePoints[0]*data.events.find(x=>x.id==='s1').weight);
  assert.equal(team('CPT VOX').rank,team('SX TET').rank);assert.equal(team('LOOPS').rank,team('CIVIS').rank);
  const src=inputs();src[0].copa.standings[1].team='FLUXO W7M';assert.throws(()=>build(src),/duplicada/);
});
test('one static fetch supports both complete views, search and the team calculation dialog',async()=>{
  const u=await ui();try{
    assert.equal(u.calls.length,1);assert.equal(u.all('.annual-table tbody tr').length,27);assert.equal(u.all('.annual-event').length,0);
    await u.click('[data-annual-view="competicoes"]');assert.equal(u.all('.annual-event').length,27*4);assert.equal(u.calls.length,1);
    await u.search('loud');assert.equal(u.all('.annual-table tbody tr').length,1);assert(u.$('.annual-table').textContent.includes('600'));assert.equal(new URL(u.w.location.href).searchParams.get('busca'),'loud');
    const b=u.$('[data-annual-team="LOUD"]');b.focus();await u.click('[data-annual-team="LOUD"]');assert(u.$('dialog').open);const loud=read('ranking-data/brasil-2026.json').rows.find(r=>r.team==='LOUD');assert(u.$('#annual-campaign').textContent.includes(loud.results.map(r=>r.points).join(' + ')+' = '+loud.total));assert(u.$('#annual-campaign').textContent.includes(read('ranking-data/brasil-2026.json').basePoints[2]+' pontos base × peso '+read('ranking-data/brasil-2026-source.json').weights.ewc));
    await u.click('[data-annual-close]');assert(!u.$('dialog').open);assert.equal(u.w.document.activeElement,b);assert.equal(u.calls.length,1);
    await u.search('sem resultado');assert(u.$('.annual-empty'));assert(u.$('[data-annual-share]').disabled);await u.click('[data-annual-clear]');assert.equal(u.all('.annual-table tbody tr').length,27);
  }finally{u.close();}
});
test('deep links restore the view and search; sharing freezes visible rows without fetching or renumbering',async()=>{
  const u=await ui({search:'?ano=2026&visao=competicoes&busca=SX'});try{
    assert.equal(u.all('.annual-table tbody tr').length,1);assert(u.$('.annual-detailed'));await u.click('[data-annual-link]');const url=new URL(u.copies[0]);assert.equal(url.searchParams.get('visao'),'competicoes');assert.equal(url.searchParams.get('busca'),'SX');
    await u.click('[data-annual-share]');const p=u.cards[0],selected=p.views.find(v=>v.id===p.viewId);assert(selected);assert.equal(selected.annualColumns.length,4);assert.equal(selected.rows[0].rank,read('ranking-data/brasil-2026.json').rows.find(r=>r.team==='SX TET').rank);const sx=read('ranking-data/brasil-2026.json').rows.find(r=>r.team==='SX TET');assert.equal(selected.rows[0].points,sx.total);assert.deepEqual(Array.from(selected.rows[0].annualValues),[null,null,sx.results.find(r=>r.event==='s2').points,null]);assert.equal(u.calls.length,1);
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

test('2025 includes every closed BR event, with Fluxo and W7M separate and the four correct EWC representatives',()=>{
  const generated=build(YEAR_FILES[2025].map(read)),{sources,...stored}=read('ranking-data/brasil-2025.json');assert.deepEqual(generated,stored);
  assert.equal(generated.partial,false);assert.equal(generated.rows.length,20);assert.equal(generated.events.length,5);
  const totals={'FLUXO':2425,'LOS':988,'TEAM SOLID':895,'PAIN GAMING':565,'E1 SPORTS':555,'LOUD':390,'ALFA 34':550};
  if(read('ranking-data/brasil-2025-source.json').methodVersion===2)for(const [name,total] of Object.entries(totals))assert.equal(generated.rows.find(r=>r.team===name).total,total,name);
  const team=n=>generated.rows.find(r=>r.team===n),position=(n,id)=>team(n).results.find(r=>r.event===id)?.position;
  assert.equal(position('FLUXO','s1'),2);assert.equal(position('W7M ESPORTS','s1'),10);assert.equal(position('W7M ESPORTS','s2'),11);assert(!team('FLUXO W7M'));
  assert.equal(position('PAIN GAMING','ewc'),8);assert.equal(position('ALFA 34','ewc'),17);assert.equal(position('TEAM SOLID','ewc'),undefined);
  assert.deepEqual(generated.rows.filter(r=>r.results.some(x=>x.event==='ewc')).map(r=>r.team).sort(),['ALFA 34','FLUXO','LOS','PAIN GAMING']);
  assert.equal(position('FLUXO','global'),2);assert.equal(position('TEAM SOLID','global'),5);assert.equal(position('E1 SPORTS','global'),12);
  assert.equal(team('FLUXO').results.length,5);assert.equal(team('SAVEX GAMING').results.length,2);assert.equal(team('RUSH GAMING').results.length,1);
  for(const r of generated.rows){assert.equal(r.total,r.results.reduce((s,x)=>s+x.points,0));assert(fs.existsSync(r.logo));}
  assert(fs.statSync('ranking-data/brasil-2025.json').size<7000);
});
test('future Global counts BR teams in the final, repescagem and first-phase eliminations, and rejects incomplete results',()=>{
  const src=inputs(),g=src[4],names=src[7].teams.map(t=>t.name),loud='LOUD',los='LOS',fluxo='FLUXO W7M';
  const order=names.filter(n=>n!==los);order.splice(20,0,los);
  const row=(team,i)=>({team,position:i+1});
  const direct=[fluxo,...order.slice(0,18).filter(n=>![loud,fluxo].includes(n))].slice(0,8);
  const last=order.slice(0,20).filter(n=>!direct.includes(n));last.splice(last.indexOf(loud),1);last.splice(4,0,loud);
  g.finished=true;g.classificatoria={finished:true,rows:order.map(row)};g.lastChance={finished:true,rows:last.map(row)};g.final={finished:true,rows:[...direct,...last.slice(0,4)].map(row)};
  const result=build(src),global=n=>result.rows.find(r=>r.team===n).results.find(r=>r.event==='global');
  assert.equal(result.partial,false);assert.equal(global(fluxo).position,1);assert.equal(global(fluxo).points,result.basePoints[0]*result.events.find(e=>e.id==='global').weight);
  assert.equal(global(loud).position,13);assert.equal(global(loud).points,result.basePoints[12]*result.events.find(e=>e.id==='global').weight);assert.equal(global(los).position,21);assert.equal(global(los).points,result.basePoints[20]*result.events.find(e=>e.id==='global').weight);
  assert.equal(result.rows.filter(r=>r.results.some(x=>x.event==='global')).length,3);
  const missing=structuredClone(src);missing[4].lastChance.rows.pop();assert.throws(()=>build(missing),/repescagem incompleta/);
  const wrong=structuredClone(src);wrong[4].final.rows[1].team=loud;assert.throws(()=>build(wrong),/inconsistente/);
  const early=structuredClone(src);early[4].final.finished=false;assert.throws(()=>build(early),/não encerradas/);
});
test('year selection loads only the chosen static file, caches each year and preserves year in links and cards',async()=>{
  const u=await ui({search:'?ano=2025&visao=competicoes'});try{
    assert.equal(u.calls.length,1);assert(u.calls[0].includes('brasil-2025'));assert(u.$('h1').textContent.includes('2025'));assert(u.w.document.title.includes('2025'));assert(!u.$('.annual-upcoming'));assert.equal(u.all('.annual-event').length,20*5);assert(u.$('.annual-odd-events'));
    await u.click('[data-annual-share]');const p=u.cards[0],v=p.views.find(v=>v.id===p.viewId);assert.equal(v.annualColumns.length,5);assert(new URL(v.url).searchParams.get('ano')==='2025');assert.equal(v.rows[0].points,read('ranking-data/brasil-2025.json').rows[0].total);
    await u.year(2026);assert(u.$('.annual-upcoming'));assert.equal(u.calls.length,2);assert.equal(new URL(u.w.location.href).searchParams.get('ano'),'2026');
    await u.year(2025);assert.equal(u.calls.length,2);assert(u.$('h1').textContent.includes('2025'));assert(u.$('.annual-detailed'));
    await u.click('[data-annual-link]');assert.equal(new URL(u.copies[0]).searchParams.get('ano'),'2025');
  }finally{u.close();}
});
test('rapid year switches cannot display a stale response and reuse in-flight downloads',async()=>{
  const u=await ui({delayed:true});try{
    assert.equal(u.pending[0].year,2026);await u.year(2025);assert.equal(u.pending.length,2);
    u.pending.find(p=>p.year===2025).resolve();await tick();assert(u.$('h1').textContent.includes('2025'));
    u.pending.find(p=>p.year===2026).resolve();await tick();assert(u.$('h1').textContent.includes('2025'));
    await u.year(2026);assert.equal(u.calls.length,2);assert(u.$('h1').textContent.includes('2026'));assert.equal(u.$('#annual-ranking').getAttribute('aria-busy'),null);
  }finally{u.close();}
});

test('annual methodology exposes its source configuration and retains v2 podium regression when unchanged',()=>{
  for(const year of [2025,2026]){
    const d=read(`ranking-data/brasil-${year}.json`),src=read(`ranking-data/brasil-${year}-source.json`);assert.equal(d.methodVersion,src.methodVersion);assert.deepEqual(d.basePoints,src.basePoints);
    const copa=d.events.find(e=>e.id==='copa'),wb=d.events.find(e=>e.id==='s1');
    if(d.methodVersion===2)for(const p of [1,2,3])assert(d.basePoints[p-1]*copa.weight>d.basePoints[7]*wb.weight);
    assert.deepEqual(d.events.map(e=>[e.id,e.weight]),[['copa',src.weights.copa],['s1',src.weights.s1],['s2',src.weights.s2],['ewc',src.weights.ewc],['global',src.weights.global]]);
  }
});
