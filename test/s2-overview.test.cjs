'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const {JSDOM} = require('jsdom');
const {aggregate, mergeSources, buildSummaries} = require('../scripts/build-s2-overview.cjs');
const read = p => JSON.parse(fs.readFileSync(p));
const BASE = 'ffws-br-2026-s2/';
const tick = () => new Promise(resolve => setImmediate(resolve));
async function settle() {for (let i = 0; i < 8; i++) await tick();}
async function ui(overrides = {}, search = '') {
  const dom = new JSDOM('<main><div id="ffws-br-s2-inicio-content"></div></main>', {url:'https://centralfreefire.com.br/ffws-br-s2/inicio'+search, runScripts:'outside-only'});
  const w = dom.window, calls = [];
  w.fetch = async url => {const p = String(url).split('?')[0].replace(/^\//, ''); calls.push(p); return overrides[p] ? overrides[p]() : {ok:true, json:async () => read(p)};};
  w.__cards=[];w.openTestCard=async payload=>{w.__cards.push(payload);};
  w.eval(fs.readFileSync(BASE + 'inicio.js', 'utf8').replace("await import('/js/ranking-share-cards.mjs?v=20261020-cards-v2')","{openRankingCard:window.openTestCard}"));
  await settle();
  return {w, dom, calls, $:s => w.document.querySelector(s), click:async s => {w.document.querySelector(s).click(); await settle();}, close:() => dom.window.close()};
}
test('all four static Top 10 recuts are complete and agree with the full MVP leaders', () => {
  const d = read(BASE + 'inicio-mvp-top10.json');
  for (const stage of ['geral','classificatoria','segundaFase','final']) {
    assert.equal(d.coverage[stage], 'completo'); assert.equal(d.top10[stage].length, 10);
    assert.equal(new Set(d.top10[stage].map(r => r.name + '__' + r.team)).size, 10);
    for (let i=1;i<10;i++) assert(d.top10[stage][i-1].kills >= d.top10[stage][i].kills);
  }
  for (const [stage, name, kills] of [['geral','Yago',359],['classificatoria','Yago',264],['segundaFase','Lyon',84],['final','MT7',42]]) {
    assert.equal(d.top10[stage][0].name,name); assert.equal(d.top10[stage][0].kills,kills);
  }
  assert.deepEqual(d.drops, {classificatoria:84, segundaFase:36, final:13});
  assert(fs.statSync(BASE+'inicio-mvp-top10.json').size < 8000);
});
test('rosters retain former players, distinguish registration from play, and keep existing assets', () => {
  const d = read(BASE + 'inicio-elencos.json'); assert.equal(d.teams.length,14);
  const stark=d.teams.find(t=>t.name==='LOOPS').players.find(p=>p.name==='Stark'); assert.equal(stark.status,'Saiu'); assert(stark.matches>0);
  const reserve=d.teams.find(t=>t.name==='CIVIS').players.find(p=>p.name==='LukaSZ'); assert.equal(reserve.matches,0);
  for (const team of d.teams) {assert(fs.existsSync(team.logo)); for (const p of team.players) {
    assert(fs.existsSync(p.photo), p.photo); assert.equal(p.matches,Object.values(p.matchesByStage).reduce((a,b)=>a+b,0));
  }}
  const yago=d.teams.find(t=>t.name==='LOS').players.find(p=>p.name==='Yago'); assert.deepEqual(yago.matchesByStage,{classificatoria:72,segundaFase:36,final:13});
});
test('first load uses one small static JSON; tab and stage switches reuse their files', async () => {
  const u=await ui(); try {
    assert.deepEqual(u.calls,[BASE+'inicio-resumo.json']); assert(u.$('table').textContent.includes('FLUXO W7M'));
    assert.equal(u.$('details').open,false);
    for(const stage of ['classificatoria','segundaFase','final']) {await u.click(`[data-s2-stage="${stage}"]`); assert(u.$('table tbody tr'));}
    await u.click('[data-s2-tab="mvp"]'); assert.equal(u.$('[data-s2-mvp-stage="geral"]').getAttribute('aria-pressed'),'true');
    for(const [stage,leader] of [['geral','Yago'],['classificatoria','Yago'],['segundaFase','Lyon'],['final','MT7']]) {
      await u.click(`[data-s2-mvp-stage="${stage}"]`); assert.equal(u.w.document.querySelectorAll('table tbody tr').length,10); assert(u.$('table tbody tr').textContent.includes(leader));
    }
    await u.click('[data-s2-tab="equipes"]'); const select=u.$('[data-s2-team]'); select.value='LOS'; select.dispatchEvent(new u.w.Event('change',{bubbles:true})); await settle();
    assert(u.$('.s2-start-roster').textContent.includes('Yago')); assert(u.$('.s2-start-roster').textContent.includes('2ª fase: 36 Q'));
    await u.click('[data-s2-tab="tabela"]'); await u.click('[data-s2-tab="mvp"]');
    assert.equal(u.$('[data-s2-mvp-stage="final"]').getAttribute('aria-pressed'),'true');
    assert.deepEqual(u.calls,[BASE+'inicio-resumo.json',BASE+'inicio-mvp-top10.json',BASE+'inicio-elencos.json']);
  } finally {u.close();}
});
test('a failed tab retries that file and a late response never replaces a different tab', async () => {
  let calls=0,release;
  const u=await ui({[BASE+'inicio-mvp-top10.json']:()=>{calls++; if(calls===1)return {ok:false}; return new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>read(BASE+'inicio-mvp-top10.json')});});}});
  try {
    await u.click('[data-s2-tab="mvp"]'); assert(u.$('[data-s2-retry]'));
    await u.click('[data-s2-retry]'); assert(release);
    await u.click('[data-s2-tab="equipes"]'); release(); await settle();
    assert(u.$('[data-s2-team]')); assert.equal(u.$('table'),null);
    await u.click('[data-s2-tab="mvp"]'); assert.equal(u.w.document.querySelectorAll('table tbody tr').length,10); assert.equal(calls,2);
  } finally {u.close();}
});
test('initial load retry, keyboard tabs and image fallbacks remain usable', async () => {
  let tries=0;
  const u=await ui({[BASE+'inicio-resumo.json']:()=>({ok:++tries>1,json:async()=>read(BASE+'inicio-resumo.json')})});
  try {
    assert(u.$('[data-s2-boot-retry]')); await u.click('[data-s2-boot-retry]');
    const tab=u.$('[data-s2-tab="tabela"]');tab.focus(); tab.dispatchEvent(new u.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})); await settle();
    assert.equal(u.w.document.activeElement.dataset.s2Tab,'mvp'); assert.equal(u.$('#s2-start-pane').getAttribute('aria-labelledby'),'s2-start-tab-mvp');
    const img=u.$('img'); img.dispatchEvent(new u.w.Event('error')); assert(img.src.endsWith('/escudo.webp')); assert.equal(img.dataset.s2Fallback,undefined);
    assert.equal(u.$('#s2-start-pane').getAttribute('aria-busy'),null);
  } finally {u.close();}
});
test('aggregation follows full MVP tie breaks and keeps same names on different teams separate', () => {
  const rows=aggregate([{name:'Same',team:'A',kills:1,damage:10,assists:2},{name:'Sáme',team:'A',kills:2,damage:10,assists:3},{name:'Same',team:'B',kills:3,damage:21,assists:0},{name:'Other',team:'B',kills:3,damage:20,assists:6}]);
  assert.equal(rows.length,3); assert.equal(rows[0].team,'B'); assert.equal(rows[1].name,'Other'); assert.equal(rows[2].matches,2); assert.equal(rows[2].assists,5);
});
test('generator uses the actual provider for aliases and replaces previously stored drops once', async () => {
  const players={players:[{name:'Official',team:'A',aliases:['ALIAS']}],entries:[{name:'Old',team:'A',stage:'final',day:1,drop:1,kills:99}]};
  const live={final:{drops:{1:{1:{day:1,drop:1,map:'Bermuda',players:[{name:'ALIAS',team:'A',kills:3}]}}}}};
  const merged=await mergeSources(players,live,{rows:[{canonicalName:'Official',team:'A',aliases:['ALIAS']}]});
  assert.equal(merged.entries.length,1); assert.equal(merged.entries[0].name,'Official'); assert.equal(merged.entries[0].kills,3);
});
test('generator refuses incomplete exports and duplicate player drops before producing summaries', () => {
  const args={players:read(BASE+'players.json'),teams:read(BASE+'teams.json'),summary:read(BASE+'career-summary.json'),dates:read(BASE+'dates.json'),photos:read('player-data/photo-map.json'),live:{}};
  assert.throws(()=>buildSummaries(args),/Etapa incompleta: segundaFase/);
  args.players.entries.push({...args.players.entries[0]}); assert.throws(()=>buildSummaries(args),/duplicado/);
});
test('direct tournament link has a hosting entry and preserves query parameters on redirect', () => {
  const vm=require('node:vm'),html=fs.readFileSync('ffws-br-s2/inicio/index.html','utf8');let redirect='';
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{location:{search:'?source=shared',replace:url=>redirect=url}});
  assert.equal(redirect,'/index.html?source=shared#ffws-br-s2-inicio');
  const context={window:{},location:{search:'?source=shared',pathname:'/index.html',hash:'#ffws-br-s2-inicio'},URLSearchParams};
  vm.runInNewContext(fs.readFileSync('js/season-routes.js','utf8'),context);
  assert.equal(context.window.CFF_SEASON_ROUTES.pageFromLocation(),'ffws-br-s2-inicio');
  assert.equal(context.window.CFF_SEASON_ROUTES.pathForPage('ffws-br-s2-inicio'),'/ffws-br-s2/inicio');
});

test('shared link restores its MVP stage and shares the already loaded snapshot without new data reads', async () => {
 const u=await ui({},'?aba=mvp&etapa=segundaFase');try {
  assert.equal(u.$('[data-s2-tab="mvp"]').getAttribute('aria-selected'),'true');assert(u.$('table tbody tr').textContent.includes('Lyon'));
  await u.click('[data-s2-share]');const card=u.w.__cards[0];assert.equal(card.rows.length,10);assert.equal(card.rows[0].kills,84);assert.equal(card.stage,'Segunda fase');assert.equal(new URL(card.url).searchParams.get('etapa'),'segundaFase');
  assert.deepEqual(u.calls,[BASE+'inicio-resumo.json',BASE+'inicio-mvp-top10.json']);
  await u.click('[data-s2-mvp-stage="final"]');await u.click('[data-s2-share]');assert.equal(u.w.__cards[1].rows[0].name,'MT7');assert.equal(u.w.__cards[0].rows[0].name,'Lyon');
 }finally{u.close();}
});
