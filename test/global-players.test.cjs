const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),{JSDOM}=require('jsdom'),{build}=require('../scripts/build-global-players.cjs');
const read=p=>JSON.parse(fs.readFileSync(p)),BASE='ffws-global-2026/';
function sources(){return{...Object.fromEntries(['stages','dates','teams','groups','players'].map(k=>[k,read(BASE+k+'.json')])),identities:read(BASE+'player-identities.json'),routes:read('player-data/routes.json').routes}}
const input=sources(),generated=build(input),pending=build({...input,players:{...input.players,entries:[]}}),getProfile=id=>read(BASE+'player-data/'+id+'.json');
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r))};
async function ui(page='jogador',query='?id=loud-trap',files={}){const d=new JSDOM(`<main id="global-players-root" data-page="${page}"></main>`,{url:'https://centralfreefire.com.br/'+BASE+page+query,runScripts:'outside-only',pretendToBeVisual:true}),w=d.window,calls=[];w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};w.fetch=async url=>{const p=String(url).split('?')[0].replace(/^\//,'');calls.push(p);const value=files[p]??generated[p];if(typeof value==='function')return value();return{ok:!!value,json:async()=>value}};if(page==='jogador')w.eval(fs.readFileSync(BASE+'player-profile-ui.js','utf8'));w.eval(fs.readFileSync(BASE+'jogadores.js','utf8'));await settle();return{w,calls,$:s=>w.document.querySelector(s),all:s=>[...w.document.querySelectorAll(s)],click:async s=>{w.document.querySelector(s).click();await settle()},change:async(s,value,event='change')=>{const e=w.document.querySelector(s);e.value=value;e.dispatchEvent(new w.Event(event,{bubbles:true}));await settle()},close:()=>w.close()}}
test('all 120 edition IDs are unique, profiles are small and pending results never become zero; explicit normal links separate homonyms',()=>{const s=generated[BASE+'jogadores-resumo.json'];assert.equal(s.players.length,120);assert.equal(new Set(s.players.map(p=>p.id)).size,120);assert(Buffer.byteLength(JSON.stringify(s))<55000);for(const p of s.players){const full=generated[BASE+'player-data/'+p.id+'.json'];assert.equal(full.peers.length,4);assert.equal(full.fixtures.length,6);const waiting=pending[BASE+'player-data/'+p.id+'.json'];assert.equal(waiting.stats.geral,null);assert.equal(waiting.ranks.geral,undefined);assert.equal(waiting.historyFile,null);assert(Buffer.byteLength(JSON.stringify(full))<4500)}assert.equal(s.players.find(p=>p.id==='loud-nickz7').generalId,'nickz');assert.equal(s.players.find(p=>p.id==='lyon-joker').generalId,'joker');assert(!s.players.some(p=>p.generalId==='joker-coach'));assert.equal(s.players.find(p=>p.id==='stellar-esport-ericka').country,'do')});
test('results isolate player AND team, preserve zero, derive per-stage highlights and reject duplicate games and staff links',()=>{const i=sources();i.players.entries=[{name:'Trap',team:'LOUD',stage:'classificatoria',round:1,day:1,drop:1,kills:0,damage:0,assists:0},{name:'Trap',team:'LOUD',stage:'classificatoria',round:1,day:1,drop:2,kills:7},{name:'Trap',team:'LOUD',stage:'final',day:1,drop:1,kills:2},{name:'Trap',team:'LOS',stage:'final',kills:999}];let o=build(i),p=o[BASE+'player-data/loud-trap.json'];assert.equal(p.stats.geral.kills,9);assert.equal(p.stats.classificatoria.matches,2);assert.equal(p.stats.classificatoria.damage,null);assert.equal(p.highlights.final.drop.kills,2);assert.equal(p.highlights.classificatoria.drop.kills,7);assert.equal(p.ranks.geral,1);assert(o[p.historyFile]);i.players.entries.push({...i.players.entries[0]});assert.throws(()=>build(i),/Duplicate game/);i.players.entries=[];i.identities.players.find(p=>p.id==='lyon-joker').generalId='joker-coach';assert.throws(()=>build(i),/Invalid.*general/)});
test('aggregated entries are not treated as one-game records and phase-two team standings stay daily',()=>{const i=sources();i.players.entries=[{name:'Trap',team:'LOUD',stage:'segundaFase',day:1,matches:6,kills:24,damage:0,assists:0}];i.stages.segundaFase.rounds=[{day:1,results:[{team:'LOUD',points:10,kills:2,position:1}]},{day:2,results:[{team:'LOS',points:99,kills:20,position:1},{team:'LOUD',points:9,kills:1,position:2}]}];const p=build(i)[BASE+'player-data/loud-trap.json'];assert.equal(p.highlights.segundaFase.drop,null);assert.equal(p.stats.segundaFase.average,4);assert.equal(p.stats.segundaFase.damage,0);assert.equal(p.campaign.segundaFase.position,null);assert.deepEqual(p.campaign.segundaFase.days.map(d=>d.position),[1,2])});
test('directory fetches one compact index, filters locally, preserves input focus and paginates without more requests',async()=>{const u=await ui('jogadores','');try{assert.equal(u.all('.gp-card').length,24);assert.equal(u.calls.length,1);await u.click('[data-action=more]');assert.equal(u.all('.gp-card').length,48);const input=u.$('[data-filter=q]');input.focus();await u.change('[data-filter=q]','TRAP','input');assert.equal(u.all('.gp-card').length,1);assert.equal(u.w.document.activeElement,input);assert.equal(u.$('.gp-card').getAttribute('href'),'/ffws-global-2026/jogador?id=loud-trap');await u.click('[data-action=clear]');await u.change('[data-filter=country]','br');assert(u.all('.gp-card').length>=15);await u.change('[data-filter=team]','loud');assert.equal(u.all('.gp-card').length,5);assert.equal(u.calls.length,1)}finally{u.close()}});
test('direct edition profile initially loads only its own summary; history, stages, peers and team page remain isolated',async()=>{const u=await ui('jogador','?id=loud-trap',{[BASE+'player-data/loud-trap.json']:pending[BASE+'player-data/loud-trap.json']});try{assert.equal(u.$('h1').textContent,'Trap');assert.deepEqual(u.calls,[BASE+'player-data/loud-trap.json']);assert.equal(u.all('.gp-peer').length,4);assert.equal(u.all('.gp-stat strong').length,4);assert(u.all('.gp-stat strong').every(n=>n.textContent==='—'));assert(u.$('[data-action=card]').disabled);assert(u.$('a[href="/jogador.html?id=trap"]'));await u.click('[data-tab=history]');assert.equal(u.calls.length,1);assert(u.$('#gp-pane').textContent.includes('Ainda não há registros'));await u.change('[data-stage]','segundaFase');await u.click('[data-tab=team]');assert(u.$('#gp-pane').textContent.includes('classificação independente'));assert.equal(u.calls.length,1);u.$('[data-tab=team]').dispatchEvent(new u.w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));await settle();assert.equal(u.w.document.activeElement.dataset.tab,'summary')}finally{u.close()}});
test('detail records load only on demand and a slow response cannot overwrite a different tab',async()=>{let release;const p=getProfile('loud-trap');p.historyFile=BASE+'player-details/loud-trap.json';const u=await ui('jogador','?id=loud-trap',{[BASE+'player-data/loud-trap.json']:p,[p.historyFile]:()=>new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>({entries:[]})})})});try{assert.equal(u.calls.length,1);await u.click('[data-tab=history]');assert(release);assert.equal(u.calls.length,2);await u.click('[data-tab=team]');release();await settle();assert(u.$('#gp-pane').textContent.includes('Fase 1'));assert(!u.$('#gp-pane').textContent.includes('Nenhum registro nesta etapa'))}finally{u.close()}});
test('comparison loads its index and selected profile only by click; search is local and missing stats stay neutral',async()=>{const u=await ui('jogador','?id=loud-trap',{[BASE+'player-data/loud-trap.json']:pending[BASE+'player-data/loud-trap.json'],[BASE+'player-data/los-yago.json']:pending[BASE+'player-data/los-yago.json']});try{await u.click('[data-action=compare]');assert(u.$('dialog').open);assert(u.calls.includes(BASE+'jogadores-resumo.json'));const before=u.calls.length;await u.change('[data-compare-search]','Yago','input');assert.equal(u.$('[data-compare-pick]').options.length,1);assert(u.$('[data-compare-result]').textContent.includes('Yago'));assert(u.$('[data-compare-card]').disabled);assert(u.calls.length<=before+1);assert(!u.calls.some(p=>p.endsWith('players.json')))}finally{u.close()}});
test('invalid IDs cannot fetch arbitrary paths and failed initial reads remain retryable',async()=>{const missing=await ui('jogador','?id=../../bad');try{assert.equal(missing.calls.length,0);assert(missing.$('h1').textContent.includes('Não foi possível'))}finally{missing.close()}let calls=0;const u=await ui('jogador','?id=loud-trap',{[BASE+'player-data/loud-trap.json']:()=>({ok:++calls>1,json:async()=>getProfile('loud-trap')})});try{assert(u.$('[data-action=retry]'));await u.click('[data-action=retry]');assert.equal(u.$('h1').textContent,'Trap');assert.equal(calls,2)}finally{u.close()}});
test('both new routes use real standalone HTML and existing roster links target edition identities',()=>{for(const name of ['jogador','jogadores']){const html=fs.readFileSync(BASE+name+'/index.html','utf8');assert(html.includes('global-players-root'));assert(!html.includes('location.replace'));assert(!html.includes('player-page.min.js'))}assert(fs.readFileSync(BASE+'equipes.js','utf8').includes('gteam-world-player'));assert(fs.readFileSync('js/site-shell-fast.min.js','utf8').includes("page==='ffws-global-2026-jogadores'"))});
test('official portraits use thumbnails in the directory and larger images in the edition profile',async()=>{
 const expected=BASE+'photos/',dir=await ui('jogadores','?time=loud'),profile=await ui();
 try{
  assert.equal(dir.$('a[href$="id=loud-trap"] [data-person-photo]').getAttribute('src'),'/'+expected+'160/loud-trap.webp');
  assert.equal(profile.$('.gp-hero [data-person-photo]').getAttribute('src'),'/'+expected+'480/loud-trap.webp');
  const index=generated[BASE+'jogadores-resumo.json'];
  const joker=index.players.find(p=>p.id==='lyon-joker');
  assert.equal(joker.photo,expected+'160/lyon-joker.webp');
  assert(!index.players.some(p=>p.photoLarge||p.photo.includes('/staff/')||p.photo.includes('/pending/')));
 }finally{dir.close();profile.close()}
});

test('Garena days 1 and 2 show published individual totals and the original drop number within round 2',async()=>{
 const u=await ui('jogador','?id=fx-butzin');
 try{const profile=getProfile('fx-butzin');assert.deepEqual(profile.stats.geral,{matches:12,kills:55,damage:22658,assists:42,average:55/12});
 await u.click('[data-tab=history]');assert.match(u.$('#gp-pane').textContent,/Rodada 2 · Queda 1/);assert(!u.$('#gp-pane').textContent.includes('Queda 7'));}
 finally{u.close()}
});

test('TheGod profile has a larger athlete hero, team watermark, accessible tabs and richer metrics',async()=>{
 const u=await ui('jogador','?id=team-flash-thegod');
 try{
  assert(u.$('.gp-profile-view .gp-player-hero'));
  assert.equal(u.$('h1').textContent,'TheGod');
  assert.match(u.$('.gp-team-identity').textContent,/Team Flash/);
  assert.match(u.$('.gp-hero-watermark').getAttribute('src'),/team-flash/);
  assert.match(u.$('.gp-hero [data-person-photo]').getAttribute('src'),/\/480\//);
  assert.equal(u.all('.gp-stat strong').length,4);
  assert.equal(u.$('.gp-stat-featured strong').textContent,'33');
  assert.equal(u.all('.gp-secondary-stat').length,2);
  assert.equal(u.$('.gp-secondary-stat strong').textContent,'27.120');
  assert.equal(u.all('.gp-record-card').length,2);
  assert.equal(u.all('[data-tab]').length,4);
  assert.equal(u.all('.gp-peer').length,4);
  assert(u.$('[data-action=highlight-card]'));
  assert.deepEqual(u.calls,[BASE+'player-data/team-flash-thegod.json'],'profile remains a single small static request');
 }finally{u.close();}
});
test('evolution charts use existing stage rounds and change metrics locally without extra requests',async()=>{
 const u=await ui('jogador','?id=team-flash-thegod');
 try{
  await u.click('[data-action=go-evolution]');
  assert.equal(u.$('[data-tab=evolution]').getAttribute('aria-selected'),'true');
  assert(u.all('.gp-chart-col').length>=2);
  assert(u.$('.gp-chart').getAttribute('aria-label').includes('Abates'));
  await u.change('[data-evolution-metric]','damage');
  assert(u.$('.gp-chart').getAttribute('aria-label').includes('Dano'));
  await u.change('[data-evolution-group]','day');
  assert(u.$('.gp-chart').getAttribute('aria-label').includes('por dia'));
  assert.deepEqual(u.calls,[BASE+'player-data/team-flash-thegod.json']);
  await u.change('[data-stage]','final');
  assert.match(u.$('#gp-pane').textContent,/Ainda não há rodadas/);
 }finally{u.close();}
});
test('Mundial average comparison fetches index only on demand and honors stage',async()=>{
 const u=await ui('jogador','?id=team-flash-thegod');
 try{
  assert.equal(u.calls.length,1);
  await u.click('[data-action=benchmark]');
  assert.equal(u.calls.length,2);
  assert.equal(u.calls[1],BASE+'jogadores-resumo.json');
  assert.equal(u.all('.gp-benchmark-values>div').length,3);
  assert.match(u.$('.gp-benchmark-result').textContent,/abates \/ queda/);
  assert(!u.$('.gp-benchmark-result').textContent.includes('NaN'));
  await u.change('[data-stage]','final');
  assert(!u.$('[data-action=benchmark]'),'no comparison button when stage has no stats');
 }finally{u.close();}
});
test('all 120 published Mundial profiles share the same responsive UI with missing values as dashes',async()=>{
 const u=await ui('jogador','?id=loud-trap',{[BASE+'player-data/loud-trap.json']:pending[BASE+'player-data/loud-trap.json']});
 try{
  assert(u.$('.gp-player-hero'));
  assert(u.$('[data-action=card]').disabled);
  assert.equal(u.all('.gp-stat strong').length,4);
  assert(u.all('.gp-stat strong').every(x=>x.textContent==='—'));
  assert.match(u.$('#gp-pane').textContent,/Ainda não há resultados/);
  await u.click('[data-tab=team]');
  assert.match(u.$('#gp-pane').textContent,/resultados da equipe/i);
 }finally{u.close();}
});
