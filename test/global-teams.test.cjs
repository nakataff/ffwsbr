'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom'),{build}=require('../scripts/build-global-overview.cjs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),base='ffws-global-2026/';
const sources=()=>Object.fromEntries(['stages','dates','teams','groups','players'].map(k=>[k,read(base+k+'.json')]));
const settle=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));};
async function ui({search='',page='equipes',fail=false,snapshot}={}){
 const dom=new JSDOM(['equipes','equipe'].map(p=>`<div class="page ${p===page?'active':''}" id="ffws-global-2026-${p}"><div id="ffws-global-2026-${p}-content"></div></div>`).join(''),{url:'https://centralfreefire.com.br/ffws-global-2026/'+page+search,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,calls=[];
 w.navigate=id=>{w.document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));w.history.replaceState(null,'','/ffws-global-2026/'+id.replace('ffws-global-2026-','')+w.location.search);w.CFFGlobalTeams?.boot();};
 w.fetch=async url=>{calls.push(url);return {ok:!fail||calls.length>1,json:async()=>snapshot||read(base+'equipes-resumo.json')};};
 w.eval(fs.readFileSync(base+'equipes.js','utf8'));await settle();
 return {w,calls,$:s=>w.document.querySelector(s),all:s=>[...w.document.querySelectorAll(s)],click:async s=>{w.document.querySelector(s).click();await settle();},change:async(s,v,event='change')=>{const e=w.document.querySelector(s);e.value=v;e.dispatchEvent(new w.Event(event,{bubbles:true}));await settle();},visit:async id=>{w.history.replaceState(null,'','/ffws-global-2026/equipe?time='+id);w.navigate('ffws-global-2026-equipe');await settle();},close:()=>w.close()};
}
test('supplied rosters cover all 24 teams and 120 players without guessed staff or statistics',()=>{
 const s=read(base+'equipes-resumo.json');assert.equal(s.teams.length,24);assert.equal(s.teams.flatMap(t=>t.players).length,120);assert(s.teams.every(t=>t.players.length===5));
 assert.deepEqual(s.teams.find(t=>t.id==='lyon').players.map(p=>p.name),['Haax','SoyDella','Gamezking','Joacozd','Joker']);
 assert(s.teams.every(t=>t.fixtures.length===6));assert(s.teams.every(t=>Object.values(t.statsByStage).every(v=>v===null)));assert(s.teams.flatMap(t=>t.players).every(p=>p.type==='player'&&p.statsByStage.geral===null));
 assert.equal(s.teams.find(t=>t.id==='btr').players[2].name,'C1b3nk');assert(Buffer.byteLength(JSON.stringify(s))<50000);
});
test('snapshot stats isolate name AND team, include real zero, and preserve independent daily phase-two tables',()=>{
 const i=sources(),team=i.teams.teams.find(t=>t.id==='btr');
 i.players.entries=[{name:'Fellow',team:team.name,stage:'classificatoria',kills:0,matches:2},{name:'Fellow',team:team.name,stage:'final',kills:7,matches:1},{name:'Fellow',team:'LOUD',stage:'final',kills:999}];
 i.stages.segundaFase.rounds=[{day:1,results:[{team:team.name,kills:3,points:12,position:1}]},{day:2,results:[{team:team.name,kills:4,points:10,position:2}]}];
 const o=build(i),t=o['equipes-resumo.json'].teams.find(t=>t.id==='btr');
 assert.equal(t.players[0].statsByStage.classificatoria.kills,0);assert.equal(t.players[0].statsByStage.geral.kills,7);assert.equal(t.players[0].statsByStage.geral.matches,3);assert.equal(t.statsByStage.segundaFase.kills,7);assert.equal(t.statsByStage.segundaFase.matches,2);assert.deepEqual(o['inicio-resumo.json'].tables.segundaFase.rows,[]);
});
test('directory uses native team-page links, searchable players and group filters without extra reads',async()=>{
 const u=await ui();try{
  assert.equal(u.all('[data-gteam]').length,24);assert.equal(u.calls.length,1);assert(u.$('[data-gteams-count]').textContent.includes('24 de 24'));
  await u.change('[data-gteams-group]','B');assert.equal(u.all('[data-gteam]').length,6);
  await u.change('[data-gteams-group]','');await u.change('[data-gteams-search]','Fellow','input');assert.equal(u.all('[data-gteam]').length,1);
  const card=u.$('[data-gteam="btr"]');assert.equal(card.tagName,'ARTICLE');assert.equal(card.querySelector('a').getAttribute('href'),'/ffws-global-2026/equipe?time=btr');
  await u.visit('btr');assert(u.$('.gteam-profile'));assert(!u.$('dialog'));assert.equal(u.all('.gteam-roster>div').length,5);assert.equal(u.$('.gteam-profile h1').textContent,'Bigetron by Vitality');assert.equal(u.all('.gteam-profile-schedule>div').length,6);assert.equal(u.all('.gteam-profile-peers a').length,5);assert.equal(u.calls.length,1);
  await u.click('[data-gteam-section="staff"]');assert(u.$('.gteam-profile').textContent.includes('Comissão técnica a confirmar'));assert.equal(u.$('[data-gteam-section="staff"]').getAttribute('aria-pressed'),'true');
  await u.change('[data-gteam-stage]','segundaFase');assert(u.$('.gteam-profile').textContent.includes('independente a cada dia'));assert.equal(u.calls.length,1);
  await u.w.CFFGlobalTeams.boot();assert.equal(u.calls.length,1);
  u.w.navigate('ffws-global-2026-equipes');await settle();assert(u.$('.page.active .gteams-grid'));assert.equal(u.calls.length,1);
 }finally{u.close();}
});
test('direct team page has its own heading, title, navigation, placeholders and no floating window',async()=>{
 const u=await ui({page:'equipe',search:'?time=loud'});try{assert(u.$('.gteam-profile'));assert.equal(u.$('h1').textContent,'LOUD');assert(u.w.document.title.startsWith('LOUD · Mundial 2026'));assert.equal(u.all('.gteam-roster>div').length,5);assert(u.$('.gteam-profile').textContent.includes('Nickz7'));assert(u.$('.gteam-profile').textContent.includes('—'));assert(!u.$('dialog'));assert.equal(u.all('[data-gteam]').length,0);assert(u.$('.gteam-breadcrumb a[href="/ffws-global-2026/equipes"]'));assert.equal(u.calls.length,1);}finally{u.close();}
 const missing=await ui({page:'equipe',search:'?time=unknown'});try{assert(missing.$('h1').textContent.includes('Equipe não encontrada'));assert(!missing.$('.gteam-profile'));}finally{missing.close();}

});
test('share copies the dedicated page, HTML is escaped, and filters retain keyboard focus',async()=>{
 const snapshot=read(base+'equipes-resumo.json');snapshot.teams.find(t=>t.id==='btr').players[0].name='<img src=x onerror=alert(1)>';
 const u=await ui({page:'equipe',search:'?time=btr',snapshot});try{assert(!u.$('img[src="x"]'));assert(u.$('.gteam-profile').textContent.includes('<img src=x'));let copied='';Object.defineProperty(u.w.navigator,'clipboard',{value:{writeText:async x=>copied=x}});await u.click('[data-gteam-share]');assert.equal(copied,'https://centralfreefire.com.br/ffws-global-2026/equipe?time=btr');assert(u.$('[data-gteam-share-status]').textContent.includes('copiado'));await u.click('[data-gteam-section="staff"]');assert.equal(u.w.document.activeElement.dataset.gteamSection,'staff');await u.change('[data-gteam-stage]','final');assert(u.w.document.activeElement.matches('[data-gteam-stage]'));assert.equal(u.calls.length,1);}finally{u.close();}
});
test('failed snapshot retries and the full Mundial module does not fetch or overwrite these pages',async()=>{
 const u=await ui({fail:true});try{assert(u.$('[data-gteams-retry]'));await u.click('[data-gteams-retry]');assert.equal(u.all('[data-gteam]').length,24);u.w.FFWS_GLOBAL_2026_CONFIG={};u.w.eval(fs.readFileSync(base+'global.js','utf8'));await settle();assert.equal(u.calls.length,2);assert(u.$('.gteams-grid'));await u.visit('btr');assert(u.$('.gteam-profile'));assert.equal(u.calls.length,2);}finally{u.close();}
 const shell=fs.readFileSync('js/site-shell-fast.min.js','utf8');assert(shell.indexOf("page==='ffws-global-2026-equipe'")<shell.indexOf("page.startsWith('ffws-global-2026-')"));
 const html=fs.readFileSync('index.html','utf8'),links=[...html.matchAll(/<a class="home-global-team(?: [^"]*)?"[^>]*>/g)];assert.equal(links.length,24);for(const [tag] of links){assert(tag.includes('equipe?time='));assert(!tag.includes('onclick='));}
});
test('separate route and refresh entry retain the team ID and old shared links remain compatible',()=>{
 const c={window:{},URLSearchParams,location:{pathname:'/ffws-global-2026/equipe/',search:'?time=btr',hash:''}};require('node:vm').runInNewContext(fs.readFileSync('js/season-routes.js','utf8'),c);assert.equal(c.window.CFF_SEASON_ROUTES.pageFromLocation(),'ffws-global-2026-equipe');assert.equal(c.window.CFF_SEASON_ROUTES.pathForPage('ffws-global-2026-equipe'),'/ffws-global-2026/equipe');
 const entry=fs.readFileSync(base+'equipe/index.html','utf8');let url='';require('node:vm').runInNewContext(entry.match(/<script>(.*?)<\/script>/s)[1],{location:{search:'?time=btr',replace:x=>url=x}});assert.equal(url,'/index.html?time=btr#ffws-global-2026-equipe');
 const old=fs.readFileSync(base+'equipes/index.html','utf8');require('node:vm').runInNewContext(old.match(/<script>(.*?)<\/script>/s)[1],{URLSearchParams,location:{search:'?time=btr',replace:x=>url=x}});assert.equal(url,'/index.html?time=btr#ffws-global-2026-equipe');
});

test('compact cards show qualified teams, per-player local flags and independent roster/staff tabs',async()=>{
 const u=await ui();try{
  const btr=u.$('[data-gteam="btr"]');assert.equal(btr.tagName,'ARTICLE');assert(btr.querySelector('.gteam-status').textContent.includes('Classificado'));assert(btr.querySelector('.gteam-qualifier').textContent.includes('1º'));assert.equal(btr.querySelectorAll('.gteam-card-roster li').length,5);
  for(const img of btr.querySelectorAll('[data-player-flag]')){assert.equal(img.getAttribute('src'),'/flag/id.webp');assert.equal(img.getAttribute('alt'),'Indonésia');}
  const onic=u.$('[data-gteam="onic"]');assert.equal(onic.querySelectorAll('img[src="/flag/th.webp"]').length,1);assert.equal(onic.querySelectorAll('img[src="/flag/id.webp"]').length,4);
  await u.click('[data-gteam="btr"] [data-gteam-card-tab="staff"]');assert(btr.querySelector('[data-gteam-card-panel]').textContent.includes('Comissão técnica a confirmar'));assert.equal(btr.querySelector('[data-gteam-card-tab="staff"]').getAttribute('aria-selected'),'true');assert.equal(onic.querySelector('[data-gteam-card-tab="players"]').getAttribute('aria-selected'),'true');
  btr.querySelector('[data-gteam-card-tab="staff"]').dispatchEvent(new u.w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));assert.equal(u.w.document.activeElement.dataset.gteamCardTab,'players');assert.equal(btr.querySelectorAll('[data-player-flag]').length,5);
  await u.click('[data-gteam="btr"] [data-gteam-fold]');assert.equal(btr.querySelector('[data-gteam-fold]').getAttribute('aria-expanded'),'false');assert(btr.querySelector('#gteam-content-btr').hidden);
  await u.change('[data-gteams-search]','Fellow','input');assert.equal(u.all('[data-gteam]').length,1);assert(u.$('#gteam-content-btr').hidden);await u.click('[data-gteam="btr"] [data-gteam-fold]');assert(!u.$('#gteam-content-btr').hidden);assert.equal(u.calls.length,1);assert(!u.$('dialog'));
  assert.equal(u.$('[data-gteam="btr"] .gteam-card-footer a').getAttribute('href'),'/ffws-global-2026/equipe?time=btr');
 }finally{u.close();}
});
test('flags use individual countries, valid local assets and a neutral fallback, never organization logos',async()=>{
 const input=read(base+'players.json');assert.equal(input.players.filter(p=>p.country).length,119);assert.deepEqual(input.players.filter(p=>!p.country).map(p=>p.name),['Ericka']);for(const p of input.players.filter(p=>p.country)){const asset=fs.readFileSync('flag/'+p.country+'.webp');assert.equal(asset.toString('ascii',8,12),'WEBP');}
 const snapshot=read(base+'equipes-resumo.json'),btr=snapshot.teams.find(t=>t.id==='btr');btr.players[0].country='../../bad';
 const u=await ui({snapshot});try{
  const card=u.$('[data-gteam="btr"]');assert(!card.querySelector('img[src*="bad"]'));assert(card.querySelector('.gteam-flag-missing'));const flag=card.querySelector('[data-player-flag]');flag.dispatchEvent(new u.w.Event('error'));assert.equal(card.querySelectorAll('[data-player-flag]').length,3);assert(!card.querySelector('.gteam-card-roster img[src$="escudo.webp"]'));assert.equal(u.calls.length,1);
  await u.visit('btr');assert.equal(u.all('.gteam-profile .gteam-person-name [data-player-flag]').length,4);
 }finally{u.close();}
});

test('new mixed-nationality rosters preserve each person’s country and unknown Ericka stays neutral',async()=>{
 const input=read(base+'players.json'),country=(team,name)=>input.players.find(p=>p.team===team&&p.name===name)?.country;
 for(const [team,name,flag] of [['LYON','Haax','br'],['LYON','SoyDella','ar'],['LYON','Joker','cl'],['Blue Cheese','Stu','pe'],['GunDynasty','David444','do'],['Stellar Esport','Lotex','ni'],['Stellar Esport','Lins7','br'],['Stellar Esport','Salami','us']])assert.equal(country(team,name),flag);
 assert(input.players.filter(p=>p.team==='ParadoX Gaming').every(p=>p.country==='za'));
 const u=await ui({page:'equipe',search:'?time=stellar-esport'});try{assert.equal(u.all('.gteam-person-name [data-player-flag]').length,4);assert(u.$('.gteam-person-name .gteam-flag-missing'));assert(!u.$('.gteam-profile img[src="/flag/.webp"]'));assert(u.$('.gteam-person-name img[src="/flag/ni.webp"]'));assert.equal(u.calls.length,1)}finally{u.close()}
});
