'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom'),{build}=require('../scripts/build-global-overview.cjs');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),base='ffws-global-2026/';
const sources=()=>Object.fromEntries(['stages','dates','teams','groups','players'].map(k=>[k,read(base+k+'.json')]));
const settle=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));};
async function ui({search='',fail=false,snapshot}={}){
 const dom=new JSDOM('<div class="page active" id="ffws-global-2026-equipes"><div id="ffws-global-2026-equipes-content"></div></div>',{url:'https://centralfreefire.com.br/ffws-global-2026/equipes'+search,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,calls=[];
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 w.fetch=async url=>{calls.push(url);return {ok:!fail||calls.length>1,json:async()=>snapshot||read(base+'equipes-resumo.json')};};
 w.eval(fs.readFileSync(base+'equipes.js','utf8'));await settle();
 return {w,calls,$:s=>w.document.querySelector(s),all:s=>[...w.document.querySelectorAll(s)],click:async s=>{w.document.querySelector(s).click();await settle();},change:async(s,v,event='change')=>{const e=w.document.querySelector(s);e.value=v;e.dispatchEvent(new w.Event(event,{bubbles:true}));await settle();},close:()=>w.close()};
}
test('supplied rosters preserve eight teams, 40 players and pending LYON/LOUD without guessed coaches',()=>{
 const s=read(base+'equipes-resumo.json');assert.equal(s.teams.length,24);assert.equal(s.teams.flatMap(t=>t.players).length,40);assert.equal(s.teams.filter(t=>t.players.length).length,8);
 for(const id of ['lyon','loud'])assert.equal(s.teams.find(t=>t.id===id).players.length,0);
 assert(s.teams.every(t=>t.fixtures.length===6));assert(s.teams.every(t=>Object.values(t.statsByStage).every(v=>v===null)));assert(s.teams.flatMap(t=>t.players).every(p=>p.type==='player'&&p.statsByStage.geral===null));
 assert.equal(s.teams.find(t=>t.id==='btr').players[2].name,'C1b3nk');assert(Buffer.byteLength(JSON.stringify(s))<32000);
});
test('snapshot stats isolate name AND team, include real zero, and preserve independent daily phase-two tables',()=>{
 const i=sources(),team=i.teams.teams.find(t=>t.id==='btr');
 i.players.entries=[{name:'Fellow',team:team.name,stage:'classificatoria',kills:0,matches:2},{name:'Fellow',team:team.name,stage:'final',kills:7,matches:1},{name:'Fellow',team:'LOUD',stage:'final',kills:999}];
 i.stages.segundaFase.rounds=[{day:1,results:[{team:team.name,kills:3,points:12,position:1}]},{day:2,results:[{team:team.name,kills:4,points:10,position:2}]}];
 const o=build(i),t=o['equipes-resumo.json'].teams.find(t=>t.id==='btr');
 assert.equal(t.players[0].statsByStage.classificatoria.kills,0);assert.equal(t.players[0].statsByStage.geral.kills,7);assert.equal(t.players[0].statsByStage.geral.matches,3);assert.equal(t.statsByStage.segundaFase.kills,7);assert.equal(t.statsByStage.segundaFase.matches,2);assert.deepEqual(o['inicio-resumo.json'].tables.segundaFase.rows,[]);
});
test('one static fetch supports filters, searchable players, accessible native modal and direct deep links',async()=>{
 const u=await ui();try{
  assert.equal(u.all('[data-gteam]').length,24);assert.equal(u.calls.length,1);assert(u.$('[data-gteams-count]').textContent.includes('24 de 24'));
  await u.change('[data-gteams-group]','B');assert.equal(u.all('[data-gteam]').length,6);
  await u.change('[data-gteams-group]','');await u.change('[data-gteams-search]','Fellow','input');assert.equal(u.all('[data-gteam]').length,1);
  u.$('[data-gteam="btr"]').focus();await u.click('[data-gteam="btr"]');assert(u.$('dialog').open);assert.equal(u.all('.gteam-roster>div').length,5);assert(u.$('dialog').textContent.includes('Fellow'));assert.equal(new URL(u.w.location.href).searchParams.get('time'),'btr');
  await u.click('[data-gteam-section="staff"]');assert(u.$('dialog').textContent.includes('Comissão técnica a confirmar'));assert.equal(u.$('[data-gteam-section="staff"]').getAttribute('aria-pressed'),'true');
  await u.change('[data-gteam-stage]','segundaFase');assert(u.$('dialog').textContent.includes('independente a cada dia'));
  u.$('dialog').dispatchEvent(new u.w.Event('cancel',{cancelable:true}));assert(!u.$('dialog').open);assert.equal(new URL(u.w.location.href).searchParams.get('time'),null);assert.equal(u.w.document.activeElement.dataset.gteam,'btr');
  await u.w.CFFGlobalTeams.boot();assert.equal(u.calls.length,1);
 }finally{u.close();}
 const direct=await ui({search:'?time=loud'});try{assert(direct.$('dialog').open);assert(direct.$('dialog').textContent.includes('Elenco ainda não confirmado'));assert(direct.$('dialog').textContent.includes('—'));}finally{direct.close();}
});
test('share copies exact public link, HTML is escaped, and leaving the page closes the modal',async()=>{
 const snapshot=read(base+'equipes-resumo.json');snapshot.teams.find(t=>t.id==='btr').players[0].name='<img src=x onerror=alert(1)>';
 const u=await ui({search:'?time=btr',snapshot});try{assert(!u.$('dialog img[src="x"]'));assert(u.$('dialog').textContent.includes('<img src=x'));let copied='';Object.defineProperty(u.w.navigator,'clipboard',{value:{writeText:async x=>copied=x}});await u.click('[data-gteam-share]');assert.equal(copied,'https://centralfreefire.com.br/ffws-global-2026/equipes?time=btr');assert(u.$('[data-gteam-share-status]').textContent.includes('copiado'));u.$('#ffws-global-2026-equipes').classList.remove('active');await settle();assert(!u.$('dialog').open);assert.equal(u.calls.length,1);}finally{u.close();}
});
test('failed snapshot offers retry and full Mundial module never overwrites teams or starts its loaders',async()=>{
 const u=await ui({fail:true});try{assert(u.$('[data-gteams-retry]'));await u.click('[data-gteams-retry]');assert.equal(u.all('[data-gteam]').length,24);u.w.FFWS_GLOBAL_2026_CONFIG={};u.w.eval(fs.readFileSync(base+'global.js','utf8'));await settle();assert.equal(u.calls.length,2);assert(u.$('.gteams-grid'));}finally{u.close();}
 const shell=fs.readFileSync('js/site-shell-fast.min.js','utf8');assert(shell.indexOf("page==='ffws-global-2026-equipes'")<shell.indexOf("page.startsWith('ffws-global-2026-')"));
 const html=fs.readFileSync('index.html','utf8'),links=[...html.matchAll(/<a class="home-global-team(?: [^"]*)?"[^>]*>/g)];assert.equal(links.length,24);for(const [tag] of links){assert(tag.includes('equipes?time='));assert(!tag.includes('onclick='));}
});
