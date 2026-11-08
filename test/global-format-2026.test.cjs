const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const read=p=>fs.readFileSync(p,'utf8'),stages=JSON.parse(read('ffws-global-2026/stages.json')),dates=JSON.parse(read('ffws-global-2026/dates.json'));
function ui(runScripts='outside-only'){const names=['formato','classificatoria','segunda-fase','last-chance','final','datas'],dom=new JSDOM(names.map(name=>`<div class="page" id="ffws-global-2026-${name}"><div id="ffws-global-2026-${name}-content"></div></div>`).join(''),{url:'https://centralfreefire.com.br/index.html',runScripts}),w=dom.window;w.navigate=()=>{};let source=read('ffws-global-2026/global.js').replace("  if (document.readyState === 'loading')","  window.__formatTest={state,renderPage,stageFilters,filterStageRows,rowClass,PAGE_IDS,loadGroupsData};\n  if (document.readyState === 'loading')");vm.runInContext(source,dom.getInternalVMContext());const api=w.__formatTest;api.state.loaded=true;api.state.stages=structuredClone(stages);api.state.stages.classificatoria.rounds=[];api.state.dates=structuredClone(dates);api.state.teams=JSON.parse(read('ffws-global-2026/teams.json')).teams;api.state.groups=JSON.parse(read('ffws-global-2026/groups.json'));return {dom,w,api,render(name){api.renderPage('ffws-global-2026-'+name);return w.document.getElementById('ffws-global-2026-'+name+'-content');}};}
test('phase one: image matchups, six rounds and 36 matches per team, 72 matches overall',()=>{const f=stages.format.classificatoria,r=dates.rounds.filter(r=>r.stage==='classificatoria');assert.equal(r.length,12);assert.equal(r.reduce((n,r)=>n+r.matches,0),72);assert.equal(f.matchesPerTeam,36);assert.equal(f.roundsPerTeam,6);assert.deepEqual([...new Set(r.map(r=>r.date))],['2026-11-06','2026-11-07','2026-11-08','2026-11-13','2026-11-14','2026-11-15']);const expected=[['A','B'],['C','D'],['A','C'],['B','D'],['A','D'],['B','C'],['C','D'],['A','B'],['B','D'],['A','C'],['B','C'],['A','D']];assert.deepEqual(r.map(r=>r.groups),expected);for(const g of ['A','B','C','D']){const own=r.filter(r=>r.groups.includes(g));assert.equal(own.length,6);assert.equal(own.reduce((n,r)=>n+r.matches,0),36);}for(let i=0;i<r.length;i+=2){assert.equal(r[i].date,r[i+1].date);assert.equal(r[i].time24,'04:00');assert.equal(r[i+1].time24,'09:00');}assert.equal(f.advance,18);assert.deepEqual(f.lastChancePositions,[19,20]);assert.deepEqual(f.eliminatedPositions,[21,22,23,24]);});
test('qualification balances, dates and Bangkok final follow supplied rules without a match cap',()=>{const f=stages.format;assert.deepEqual(f.classificatoria.pools.map(p=>p.positions),['1º ao 12º','13º e 14º','15º e 16º','17º e 18º']);assert.equal(f.segundaFase.teamCount,18);assert.equal(f.segundaFase.rounds,4);assert.equal(f.segundaFase.advancePerDay*4,8);assert.equal(f.segundaFase.resetEachDay,true);assert.equal(f.lastChance.teamCount,2+10);assert.equal(f.lastChance.totalMatches,10);assert.equal(f.segundaFase.totalAdvance+f.lastChance.advance,f.final.teamCount);assert.equal(f.final.days,1);assert.equal(f.final.championRushPoint,110);assert.equal(f.final.unlimitedMatches,true);assert.equal(f.final.totalMatches,null);assert(f.final.rules.some(r=>r.includes('queda seguinte')));assert.equal(dates.rounds.length,18);assert(dates.rounds.filter(r=>r.stage!=='classificatoria').every(r=>r.time24==='07:00'));assert.deepEqual(dates.rounds.filter(r=>r.stage==='segundaFase').map(r=>r.date),['2026-11-19','2026-11-20','2026-11-21','2026-11-22']);assert.equal(dates.rounds.find(r=>r.stage==='lastChance').date,'2026-11-27');assert.equal(dates.rounds.find(r=>r.stage==='final').date,'2026-11-28');assert.equal(dates.timeZone,'America/Sao_Paulo');assert.equal(dates.event.fixedMatchesBeforeFinal,106);assert.equal(dates.event.matchCount,null);for(const k of Object.keys(f))assert(f[k].rulesConfirmed);});
test('format is readable before results exist, in Portuguese, with native collapsible sections',()=>{const x=ui();try{const root=x.render('formato');assert.equal(root.querySelectorAll('.ffws-global-format-accordion>details').length,4);assert.equal(root.querySelectorAll('.ffws-global-format-accordion>details[open]').length,1);assert(root.textContent.includes('36 quedas por equipe'));assert(root.textContent.includes('19º e 20º'));assert(root.textContent.includes('110'));assert(root.textContent.includes('Sem limite'));assert(root.textContent.includes('Brasília'));assert(!root.textContent.includes('Week 4'));assert(!root.textContent.includes('confirmar'));assert.equal(root.querySelectorAll('.ffws-global-progression article').length,4);for(const name of ['classificatoria','segunda-fase','last-chance','final']){const r=x.render(name);assert(r.querySelector('.ffws-global-format-stats'));assert(r.textContent.includes('Aguardando resultados'));assert(!r.textContent.includes('regras a confirmar'));assert(r.querySelector('a[href="/ffws-global-2026/formato"]'));}}finally{x.w.close();}});
test('calendar renders all 18 sessions with exact group pairings and Brasília offsets',()=>{const x=ui();try{const root=x.render('datas'),rows=root.querySelectorAll('.ffws-global-calendar-row');assert.equal(rows.length,18);const first=root.querySelector('[data-schedule-key="classificatoria-1"]');assert(first.textContent.includes('A × B'));assert(first.textContent.includes('04h00'));assert.equal(first.querySelector('time').getAttribute('datetime'),'2026-11-06T04:00:00-03:00');const final=root.querySelector('[data-schedule-key="final-1"]');assert(final.textContent.includes('110'));assert(final.textContent.includes('sem limite'));assert(final.textContent.includes('07h00'));assert(!root.textContent.includes('a confirmar'));assert(root.textContent.includes('Last Chance'));}finally{x.w.close();}});
test('period filters use 12 rounds, four daily qualifiers and one-day later stages',()=>{const x=ui();try{for(const [stage,total] of [['lastChance',1],['final',1]]){const host=x.w.document.createElement('div');host.innerHTML=x.api.stageFilters(stage);const options=host.querySelector('select').options;assert.equal(options.length,total+1);}const host=x.w.document.createElement('div');host.innerHTML=x.api.stageFilters('segundaFase');assert.equal(host.querySelectorAll('[data-global-stage-multi="period"] input').length,5);assert.deepEqual(Array.from(x.api.state.stageFilter.segundaFase.period),['1']);assert.equal(x.api.rowClass('classificatoria',{position:18}),'ffws-global-pool-band ffws-global-band-pool-4');assert.equal(x.api.rowClass('classificatoria',{position:19}),'ffws-global-pool-band ffws-global-band-repechage');assert.equal(x.api.rowClass('classificatoria',{position:21}),'ffws-global-pool-band ffws-global-band-eliminated');}finally{x.w.close();}});
test('phase one checkboxes accumulate rounds 3 and 4 and combine with map and drop filters',()=>{
 const x=ui('dangerously');
 try{
  x.api.state.stages.classificatoria.rounds=structuredClone(stages.classificatoria.rounds);
  const root=x.render('classificatoria');
  const control=type=>root.querySelector(`[data-global-stage-multi="${type}"] > button`);
  const checkbox=(type,value)=>root.querySelector(`[data-global-stage-multi="${type}"] input[value="${value}"]`);
  const summary=()=>root.querySelector('.ffws-global-filter-summary').textContent;
  const leader=()=>Number(root.querySelector('tbody .ffws-global-points-col').textContent);
  const teams=()=>root.querySelectorAll('tbody tr').length;
  assert.equal(root.querySelectorAll('[data-global-stage-multi="period"] input').length,13);
  assert.equal(leader(),233);

  control('period').click();
  checkbox('period','3').click();
  assert.equal(leader(),111);
  assert.equal(teams(),12);
  assert.equal(control('period').getAttribute('aria-expanded'),'true');
  assert.equal(x.w.document.activeElement,checkbox('period','3'));
  checkbox('period','4').click();
  assert.match(summary(),/Rodadas 3, 4/);
  assert.equal(leader(),121);
  assert.equal(teams(),24);
  assert.equal(checkbox('period','3').checked,true);
  assert.equal(checkbox('period','4').checked,true);
  assert.equal(root.querySelector('.ffws-global-pool-legend'),null);

  control('map').click();
  assert.equal(control('period').getAttribute('aria-expanded'),'false');
  checkbox('map','Purgatório').click();
  assert.match(summary(),/Rodadas 3, 4 • Purgatório/);
  control('drop').click();
  checkbox('drop','1').click();
  assert.match(summary(),/Rodadas 3, 4 • Purgatório • Queda 1/);
  assert.equal(leader(),28);
  assert.equal(teams(),12);
  x.w.document.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Escape'}));
  assert.equal(control('drop').getAttribute('aria-expanded'),'false');
  assert.equal(x.w.document.activeElement,control('drop'));

  x.w.clearFFWSGlobalStageMulti('classificatoria','map');
  x.w.clearFFWSGlobalStageMulti('classificatoria','drop');
  control('period').click();
  checkbox('period','').click();
  assert.equal(summary(),'Classificação geral.');
  assert.equal(leader(),233);
  assert(root.querySelector('.ffws-global-pool-legend'));
 }finally{x.w.close();}
});
test('phase two points never carry into a different day or qualify teams from an accumulated total',()=>{const x=ui();try{x.api.state.stages.segundaFase={rows:[{team:'A',points:9999}],rounds:[{day:1,round:1,drop:1,results:[{team:'A',points:30,kills:10,position:1}]},{day:2,round:2,drop:1,results:[{team:'B',points:15,kills:5,position:1}]}]};let rows=x.api.filterStageRows('segundaFase');assert.equal(rows.length,1);assert.equal(rows[0].team,'A');assert.equal(rows[0].points,30);x.api.state.stageFilter.segundaFase.period=['2'];rows=x.api.filterStageRows('segundaFase');assert.equal(rows.length,1);assert.equal(rows[0].team,'B');assert.equal(rows[0].points,15);x.api.state.stageFilter.segundaFase.period=[];assert.equal(x.api.rowClass('segundaFase',{position:1}),'');const html=x.api.stageFilters('segundaFase');assert(html.includes('sem classificação acumulada'));assert(html.includes('pontos zeram'));}finally{x.w.close();}});
test('new format route resolves clean links and is registered in navigation and the lazy shell',()=>{const c={window:{},URLSearchParams,location:{pathname:'/ffws-global-2026/formato',hash:''}};vm.runInNewContext(read('js/season-routes.js'),c);assert.equal(c.window.CFF_SEASON_ROUTES.pageFromLocation(),'ffws-global-2026-formato');assert.equal(c.window.CFF_SEASON_ROUTES.pathForPage('ffws-global-2026-formato'),'/ffws-global-2026/formato');assert(read('index.html').includes('id="ffws-global-2026-formato-content"'));assert(read('js/shared-navigation.js').includes("['Formato','formato']"));assert(read('js/site-shell-fast.min.js').includes("global:'ffws-global-2026/global.js?v="));assert(read('ffws-global-2026/formato/index.html').includes('#ffws-global-2026-formato'));});

test('home debut countdown uses Brasília, ticks locally, pauses hidden pages and never invents a live status',()=>{
 const dom=new JSDOM(read('index.html'),{url:'https://centralfreefire.com.br/index.html',runScripts:'outside-only'}),w=dom.window;let at=Date.parse('2026-11-05T04:00:00-03:00'),interval=null;w.Date.now=()=>at;w.matchMedia=()=>({matches:false,addEventListener(){}});w.setInterval=fn=>{interval=fn;return 1;};w.clearInterval=()=>{interval=null;};let hidden=false;Object.defineProperty(w.document,'hidden',{get:()=>hidden});w.document.getElementById('home').classList.add('active');
 try{vm.runInContext(read('js/home-global-finals.js'),dom.getInternalVMContext());const box=w.document.querySelector('.home-global-countdown'),values=()=>[...box.querySelectorAll('[data-countdown-unit]')].map(e=>e.textContent);assert.equal(Date.parse(box.dataset.start),Date.parse(dates.rounds[0].date+'T'+dates.rounds[0].time24+':00-03:00'));assert.deepEqual(values(),['01','00','00','00']);at+=1000;interval();assert.deepEqual(values(),['00','23','59','59']);assert.equal(box.querySelector('a').href,'https://www.youtube.com/@ffesportsbr/live');assert.equal(box.querySelector('[role=timer]').getAttribute('aria-live'),'off');hidden=true;w.document.dispatchEvent(new w.Event('visibilitychange'));assert.equal(interval,null);hidden=false;at=Date.parse(box.dataset.start)+60000;w.document.dispatchEvent(new w.Event('visibilitychange'));assert.deepEqual(values(),['00','00','00','00']);assert.equal(interval,null);assert(box.classList.contains('has-started'));assert(box.textContent.includes('TRANSMISSÃO OFICIAL'));assert(!box.textContent.includes('AO VIVO'));assert.equal(w.document.querySelectorAll('.home-global-team').length,24);
 }finally{w.close();}
});
test('featured Mundial menu expands in both sidebars without navigating and highlights the active route',()=>{
 const dom=new JSDOM('<main id="main-content"></main><div id="sidebar-panel"><nav class="sidebar-nav"></nav></div><nav id="cff-public-sidebar-nav"></nav>',{url:'https://centralfreefire.com.br/index.html#home',runScripts:'outside-only'}),w=dom.window;
 let destination='',closes=0;w.navigate=page=>{destination=page;};w.closeSidebar=()=>{closes++;};
 try{
  vm.runInContext(read('js/season-routes.js'),dom.getInternalVMContext());vm.runInContext(read('js/shared-navigation.js'),dom.getInternalVMContext());w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  for(const root of w.document.querySelectorAll('.cff-unified-menu')){
   const featured=root.querySelector('[data-cff-featured]'),international=root.querySelector('[data-cff-group=global26]'),br=root.querySelector('[data-cff-group=brasil]');
   assert.equal(featured.tagName,'DETAILS');
   assert(featured.compareDocumentPosition(br)&w.Node.DOCUMENT_POSITION_FOLLOWING);
   assert.deepEqual([...featured.querySelectorAll('a')].map(a=>a.href),[...international.querySelectorAll('a')].map(a=>a.href));
   assert.equal(featured.open,false);featured.querySelector('summary').click();assert.equal(featured.open,true);
   assert.equal(destination,'');assert.equal(closes,0);
   featured.querySelector('summary').click();assert.equal(featured.open,false);
  }
  w.CFFNavigation.setActive('ffws-global-2026-datas');
  const featured=w.document.querySelector('[data-cff-featured]');
  assert(featured.open);assert(featured.classList.contains('active'));
  assert.equal(featured.querySelector('[aria-current=page]').getAttribute('href'),'/ffws-global-2026/datas');
  assert(!w.document.querySelector('[data-cff-group=internacional]').open);
  featured.querySelector('[data-cff-route=ffws-global-2026-inicio]').click();assert.equal(destination,'ffws-global-2026-inicio');
  w.CFFNavigation.setActive('home');assert(!featured.classList.contains('active'));
 }finally{w.close();}
});

test('phase-one participants follow the official four groups, with readable native team-page links and no guessed later qualifiers',()=>{
 const x=ui();try{
  const root=x.render('classificatoria'),groups=JSON.parse(read('ffws-global-2026/groups.json')).groups;assert.equal(root.querySelectorAll('.global-knockout-group').length,4);assert.equal(root.querySelectorAll('.global-knockout-team').length,24);
  for(const group of root.querySelectorAll('.global-knockout-group')){const key=group.querySelector('h3').textContent.slice(-1);const links=[...group.querySelectorAll('.global-knockout-team')];assert.equal(links.length,6);assert.deepEqual(links.map(link=>new URL(link.href).searchParams.get('time')),groups[key]);for(const link of links){assert.equal(new URL(link.href).pathname,'/ffws-global-2026/equipe');assert(link.querySelector('img'));assert(!link.hasAttribute('onclick'));}}
  assert(root.textContent.includes('Toque em uma equipe'));assert(!root.querySelector('.global-participants-grid'));
  for(const stage of ['segunda-fase','last-chance','final']){const later=x.render(stage);assert(!later.querySelector('.global-knockout-team'));assert(!later.textContent.includes('Ver os 24 participantes'));}
 }finally{x.w.close()}
});
test('groups load once from a static file and a failed or incomplete map cannot invent group membership or block the page',async()=>{
 const x=ui();try{
  let calls=0;x.api.state.groups=null;x.w.fetch=async()=>{calls++;return{ok:true,json:async()=>JSON.parse(read('ffws-global-2026/groups.json'))}};await Promise.all([x.api.loadGroupsData(),x.api.loadGroupsData()]);await x.api.loadGroupsData();assert.equal(calls,1);assert.equal(x.render('classificatoria').querySelectorAll('.global-knockout-team').length,24);
  x.api.state.groups=null;x.w.fetch=async()=>({ok:false});await x.api.loadGroupsData();let root=x.render('classificatoria');assert(root.textContent.includes('Aguardando resultados'));assert(root.textContent.includes('Não foi possível mostrar os grupos'));assert(!root.querySelector('.global-knockout-team'));assert(root.querySelector('a[href="/ffws-global-2026/equipes"]'));
  x.api.state.groups={groups:{A:['loud','loud']}};root=x.render('classificatoria');assert(!root.querySelector('.global-knockout-group'));
 }finally{x.w.close()}
});


test('Global Finals share studio previews the image BEFORE settings on mobile and keeps action buttons after',()=>{
 const css=read('css/global-stats-share.css'),markup=read('js/global-stats-share.js');
 const media=css.slice(css.indexOf('@media(max-width:780px)'));
 assert.match(media,/\.cff-stats-share-result\s*\{\s*display:contents\s*\}/,'preview/result children must take part in mobile flex ordering');
 for(const [selector,order] of [
  ['.cff-stats-share-preview',-3],['.cff-stats-share-result>[data-share-status]',-2],
  ['.cff-stats-share-controls',0],['.cff-stats-share-actions',1]
 ]){
  const cssSelector=selector.replace(/[.*+?^$()|[\]{}]/g,'\\$&');
  const pattern=new RegExp(cssSelector+'\\s*\\{[^}]*order:\\s*'+order+'\\b');
  assert.match(media,pattern,'Incorrect mobile ordering: '+selector);
 }
 assert.match(media,/height:min\(38dvh,335px\)/,'Preview height must fit within small viewports');
 assert.match(markup,/cff-stats-share-preview"><canvas/);
 assert.match(markup,/data-share-action="save"/);
 assert.match(markup,/data-share-action="share"/);
 const global=read('ffws-global-2026/global.js'),shell=read('js/site-shell-fast.min.js'),html=read('index.html');
 assert.match(global,/global-stats-share\.css\?v=20261108-mobile-preview-first-v3/);
 assert.match(shell,/global\.js\?v=20261108-story-all-models-v7/);
 assert.match(html,/site-shell-fast\.min\.js\?v=20261108-story-all-models-v7/);
});

test('Stories have dedicated responsive positions for rankings, stats, records and comparison',()=>{
 const source=read('js/global-stats-share.js');
 assert.match(source,/const story=state\.format==='stories'/);
 assert.match(source,/const storyHeroEnd=Math\.max\(/);
 assert.match(source,/const panelTop=story\?clamp\(/);
 assert.match(source,/const storyFit=\(count,maximum,gap\)=>/);
 assert.match(source,/const fit=story\?storyFit\(items\.length/);
 assert.match(source,/if\(story&&facts\.length\)/);
 assert.match(source,/Full-width panels stack the teams vertically/);
 assert.match(source,/const portraitSize=heroVisible\?\(story\?/);
 assert.match(source,/const panelBottom=footerY-\(story\?78:34\)/);
 assert(!source.includes('storyRanking'),'old ranking-only layout must not control Story geometry');
 const global=read('ffws-global-2026/global.js');
 assert.match(global,/global-stats-share\.js\?v=20261108-story-all-models-v7/);
});
