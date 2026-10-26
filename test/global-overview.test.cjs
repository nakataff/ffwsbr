'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const {build}=require('../scripts/build-global-overview.cjs');
const BASE='ffws-global-2026/', read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sources=()=>Object.fromEntries(['stages','dates','teams','groups','players'].map(k=>[k,read(BASE+k+'.json')]));
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r));};
async function ui({search='',overrides={},now='2026-10-20T14:00:00-03:00'}={}) {
  const dom=new JSDOM('<div id="ffws-global-2026-inicio" class="page active"><div id="ffws-global-2026-inicio-content"></div></div>',{url:'https://centralfreefire.com.br/ffws-global-2026/inicio'+search,runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,calls=[];let at=Date.parse(now),interval;
  w.Date.now=()=>at;w.setInterval=fn=>{interval=fn;return 1;};
  w.fetch=async url=>{const p=String(url).split('?')[0].replace(/^\//,'');calls.push(p);return overrides[p]?overrides[p]():{ok:true,json:async()=>read(p)};};
  w.eval(fs.readFileSync(BASE+'inicio.js','utf8'));await settle();
  return {w,calls,$:s=>w.document.querySelector(s),all:s=>[...w.document.querySelectorAll(s)],click:async s=>{w.document.querySelector(s).click();await settle();},change:async(s,v)=>{const e=w.document.querySelector(s);e.value=v;e.dispatchEvent(new w.Event('change',{bubbles:true}));await settle();},tick:time=>{at=Date.parse(time);interval();},close:()=>w.close()};
}
test('compact summaries derive from existing sources and retain all 24 teams and exact rules',()=>{
  const output=build(sources());
  for(const [name,data] of Object.entries(output))assert.deepEqual(JSON.parse(JSON.stringify(data)),read(BASE+name));
  const summary=output['inicio-resumo.json'];assert.equal(summary.teams.length,24);assert.equal(summary.rounds.length,18);
  for(const team of summary.teams)assert(fs.existsSync(team.logo),team.logo);
  assert(summary.format.classificatoria.description.includes('36 quedas'));assert(summary.format.final.description.includes('110'));
  assert(Buffer.byteLength(JSON.stringify(summary))<14000);
});
test('offline results keep independent phase-two days and official Champion Rush final order',()=>{
  const input=sources();
  input.stages.segundaFase.rounds=[{day:1,results:[{team:'LOUD',points:100,kills:10,position:1}]},{day:2,results:[{team:'LOS',points:50,kills:20,position:1}]}];
  input.stages.final={days:[{day:1,matches:[{results:[{team:'LOS',points:150,kills:10,position:2},{team:'LOUD',points:120,kills:20,position:1}]}]}],rows:[{team:'LOUD',position:1,points:120,kills:20,matches:1},{team:'LOS',position:2,points:150,kills:10,matches:1}]};
  const summary=build(input)['inicio-resumo.json'];assert.deepEqual(summary.tables.segundaFase.rows,[]);
  assert.equal(summary.tables.segundaFase.days[0].rows[0].team,'LOUD');assert.equal(summary.tables.segundaFase.days[1].rows[0].team,'LOS');
  assert.equal(summary.tables.segundaFase.days[1].rows[0].points,50);assert.equal(summary.tables.final.rows[0].team,'LOUD');
});
test('MVP aggregates only the same player and team, sorts by kills/damage/assists and caps Top 10',()=>{
  const input=sources();input.players.entries=[...Array.from({length:13},(_,i)=>({name:'P'+i,team:'LOS',stage:'classificatoria',kills:i,damage:100,assists:1})),{name:'P12',team:'LOS',stage:'final',kills:20,damage:100,assists:1},{name:'P12',team:'LOUD',stage:'final',kills:99,damage:100,assists:1}];
  const top=build(input)['inicio-mvp-top10.json'].top10;
  assert.equal(top.geral.length,10);assert.equal(top.geral[0].team,'LOUD');assert.equal(top.geral[0].kills,99);assert.equal(top.geral[1].kills,32);assert.equal(top.final.length,2);assert.equal(top.segundaFase.length,0);
});
test('format comes first, before upcoming fixtures and three tabs; initial visit fetches only 10 KB summary',async()=>{
  const u=await ui();try{
    assert.deepEqual(u.calls,[BASE+'inicio-resumo.json']);
    const children=u.$('.global-start').children;assert(children[1].classList.contains('global-start-format'));assert(children[2].querySelector('#global-start-next'));
    assert.equal(u.all('.global-start-phase').length,4);assert.equal(u.all('.global-start-phase[open]').length,0);
    assert(u.$('.global-start-phase summary').textContent.includes('36 quedas'));
    assert.equal(u.all('.global-start-matchup .global-start-fixture-team').length,12);assert(u.$('#global-start-next-title').textContent.includes('Grupo A × Grupo B'));
    assert(u.$('#global-start-pane').textContent.includes('Aguardando resultados'));assert.equal(u.all('#global-start-pane table').length,0);
    await u.click('[data-global-start-stage="segundaFase"]');assert.equal(u.$('[data-global-start-day]').options.length,4);assert(!u.$('[data-global-start-day]').textContent.includes('Geral'));assert.equal(u.calls.length,1);
  }finally{u.close();}
});
test('tabs load once on demand, support filters, accessible keyboard navigation and shareable deep links',async()=>{
  const u=await ui();try{
    await u.click('[data-global-start-tab="mvp"]');assert(u.$('#global-start-pane').textContent.includes('Top 10 · Geral'));assert(u.$('[data-global-start-mvp-stage="geral"]').getAttribute('aria-pressed')==='true');
    await u.click('[data-global-start-mvp-stage="lastChance"]');assert.equal(new URL(u.w.location.href).searchParams.get('etapa'),'lastChance');
    await u.click('[data-global-start-tab="equipes"]');assert.equal(u.all('.global-start-groups .global-start-group').length,4);assert.equal(u.all('.global-start-roster').length,24);assert.equal(u.all('.global-start-player-flag').length,119);assert.equal(u.all('.global-start-flag-pending').length,1);
    await u.change('[data-global-start-group]','B');assert.equal(u.all('.global-start-roster').length,6);assert(u.$('.global-start-groups').textContent.includes('LOUD'));assert.equal(new URL(u.w.location.href).searchParams.get('grupo'),'B');
    u.$('[data-global-start-tab="equipes"]').dispatchEvent(new u.w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));await settle();assert.equal(u.$('[role=tab][aria-selected=true]').textContent,'Tabela');
    await u.click('[data-global-start-tab="mvp"]');await u.click('[data-global-start-tab="equipes"]');
    assert.deepEqual(u.calls,[BASE+'inicio-resumo.json',BASE+'inicio-mvp-top10.json',BASE+'inicio-elencos.json']);
  }finally{u.close();}
  const direct=await ui({search:'?aba=equipes&grupo=D'});try{assert.equal(direct.all('.global-start-roster').length,6);assert(direct.$('.global-start-groups').textContent.includes('Team Apex Gaming'));}finally{direct.close();}
});
test('fetch failures retry and a delayed MVP response cannot overwrite another tab',async()=>{
  let attempt=0,release;const u=await ui({overrides:{[BASE+'inicio-mvp-top10.json']:()=>{if(++attempt===1)return {ok:false};return new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>read(BASE+'inicio-mvp-top10.json')});});}}});
  try{
    await u.click('[data-global-start-tab="mvp"]');assert(u.$('[data-global-start-retry]'));await u.click('[data-global-start-retry]');assert(release);
    await u.click('[data-global-start-tab="equipes"]');release();await settle();assert(u.$('.global-start-groups'));assert(!u.$('[data-global-start-mvp-stage]'));
    await u.click('[data-global-start-tab="mvp"]');assert(u.$('[data-global-start-mvp-stage]'));assert.equal(attempt,2);
  }finally{u.close();}
  let tries=0;const retry=await ui({overrides:{[BASE+'inicio-resumo.json']:()=>({ok:++tries>1,json:async()=>read(BASE+'inicio-resumo.json')})}});
  try{assert(retry.$('[data-global-start-boot]'));await retry.click('[data-global-start-boot]');assert(retry.$('.global-start-format'));}finally{retry.close();}
});
test('countdown advances locally at Brasília session boundaries without new fetches or an invented live claim',async()=>{
  const u=await ui({now:'2026-11-06T03:59:59-03:00'});try{
    assert(u.$('[role=timer]').textContent.includes('01s'));u.tick('2026-11-06T04:00:00-03:00');assert(!u.$('[role=timer]'));assert(u.$('#global-start-next').textContent.includes('No horário programado'));
    u.tick('2026-11-06T08:30:00-03:00');assert(u.$('#global-start-next-title').textContent.includes('Grupo C × Grupo D'));assert(!u.$('#global-start-next').textContent.includes('AO VIVO'));
    u.w.document.getElementById('ffws-global-2026-inicio').classList.remove('active');const text=u.$('#global-start-next').textContent;u.tick('2026-11-28T07:00:00-03:00');assert.equal(u.$('#global-start-next').textContent,text);
    u.w.document.getElementById('ffws-global-2026-inicio').classList.add('active');u.tick('2026-11-28T07:00:00-03:00');assert.equal(u.$('#global-start-next-title').textContent,'Grande Final');
    u.tick('2026-11-29T00:00:00-03:00');assert(u.$('#global-start-next').textContent.includes('Calendário encerrado'));assert.equal(u.calls.length,1);
  }finally{u.close();}
});
test('start route is registered and loads independently before the full Mundial module',()=>{
  const c={window:{},URLSearchParams,location:{pathname:'/ffws-global-2026/inicio',search:'',hash:''}};vm.runInNewContext(fs.readFileSync('js/season-routes.js','utf8'),c);assert.equal(c.window.CFF_SEASON_ROUTES.pageFromLocation(),'ffws-global-2026-inicio');
  const shell=fs.readFileSync('js/site-shell-fast.min.js','utf8');assert(shell.indexOf("page==='ffws-global-2026-inicio'")<shell.indexOf("page.startsWith('ffws-global-2026-')"));
  assert(fs.readFileSync(BASE+'inicio/index.html','utf8').includes("location.search+'#ffws-global-2026-inicio'"));
});
