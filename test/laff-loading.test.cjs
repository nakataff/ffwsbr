'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM,VirtualConsole}=require('jsdom');
const read=p=>fs.readFileSync(p,'utf8'),wait=ms=>new Promise(r=>setTimeout(r,ms));
async function editor({fail=false,failKills=false,shell=false,page="classificatoria"}={}) {
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(['classificatoria','equipes','mvp','stats','datas','selecoes','team-profile','player-profile'].map(id=>`<div class="page ${id===page?'active':''}" id="laff-${id}"><div id="laff-${id}-content"></div></div>`).join(''),{url:'https://centralfreefire.com.br/index.html#laff-'+page,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window,calls=[],scripts=[];let offline=fail,killsOffline=failKills;
 w.scrollTo=()=>{};w.alert=()=>{};w.navigate=id=>w.document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));
 w.loadMercado=()=>{throw Error('Historical LAFF must not load the live market')};w.loadTeamLogos=()=>{throw Error('LAFF must not wait for a Google Sheet')};
 w.fetch=async url=>{const path=decodeURI(new URL(String(url),w.location.href).pathname).slice(1);calls.push(path);if((offline&&path==='dados laff/classificacao.json')||(killsOffline&&path==='dados laff/abates.json'))return{ok:false,status:503};assert(/^(dados laff\/|team-data\/logo-map.json|player-data\/photo-map.json)/.test(path),'unexpected dependency '+path);const text=read(path);return{ok:true,text:async()=>text,json:async()=>JSON.parse(text)};};
 // Deliberately load after DOMContentLoaded: this is how the real lazy shell runs.
 await wait(0);
 if(shell){
  const append=w.document.head.appendChild.bind(w.document.head);
  w.document.head.appendChild=node=>{const result=append(node);if(node.tagName==='SCRIPT'){
   const path=new URL(node.src).pathname.slice(1);scripts.push(path);
   if(!['js/team-logo-resolver.min.js','js/player-photo-resolver.min.js','js/laff-pages.js','js/laff.min.js'].includes(path)){node.onerror?.();return result;}
   w.eval(read(path));node.onload?.();
  }return result;};
  w.eval(read('js/site-shell-fast.min.js'));await w.cffEnsureRoute('laff-'+page);
 }else{w.eval(read('js/player-photo-resolver.min.js'));w.eval(read('js/team-logo-resolver.min.js'));w.eval(read('js/laff-pages.js'));w.eval(read('js/laff.min.js'));}
 return {w,calls,scripts,errors,online:()=>{offline=false;killsOffline=false},close:()=>w.close()};
}
test('LAFF loads lazily after DOM ready, with official standings and no legacy/Sheets/market dependency',async()=>{
 const f=await editor({shell:true});try{
  await wait(950);const d=f.w.document;
  assert.equal(d.querySelectorAll('.laff-classificacao-table tbody tr').length,24);assert(d.querySelector('#laff-classificatoria-content').textContent.includes('KABUM! FDS'));
  const row=[...d.querySelectorAll('.laff-classificacao-table tbody tr')].find(r=>r.textContent.includes('KABUM! FDS'));assert(row.textContent.includes('208'));assert(row.querySelector('img').src.includes('kabum-fds.webp'));
  assert.deepEqual(f.scripts,['js/team-logo-resolver.min.js','js/player-photo-resolver.min.js','js/laff-pages.js','js/laff.min.js']);assert.equal(f.calls.filter(p=>p==='dados laff/classificacao.json').length,1);
  const count=f.calls.length;await f.w.cffEnsureRoute('laff-equipes');await f.w.cffEnsureRoute('laff-classificatoria');await f.w.loadLAFFData();assert.equal(f.calls.length,count);assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('phase switches retain official rows and reuse previously loaded stages',async()=>{
 const f=await editor();try{
  await f.w.loadLAFFData();await wait(950);
  f.w.cffSetLAFFTablePhase('repescagem');await wait(30);let rows=f.w.document.querySelectorAll('.laff-classificacao-table tbody tr');assert.equal(rows.length,12);assert([...rows].some(r=>r.textContent.includes('KABUM! FDS')&&r.textContent.includes('48')));
  f.w.cffSetLAFFTablePhase('final');await wait(30);rows=f.w.document.querySelectorAll('.laff-classificacao-table tbody tr');assert.equal(rows.length,12);assert(rows[0].textContent.includes('CPT VOX'));assert(rows[0].textContent.includes('200'));
  f.w.cffSetLAFFTablePhase('repescagem');await wait(30);assert.equal(f.calls.filter(p=>p==='dados laff/repescagem.json').length,1);assert.equal(f.calls.filter(p=>p==='dados laff/final.json').length,1);assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('an unavailable classification shows recovery, and a retry loads real results instead of invented zeroes',async()=>{
 const f=await editor({fail:true});try{
  await assert.rejects(f.w.loadLAFFData());await wait(950);const root=f.w.document.getElementById('laff-classificatoria-content');assert(root.textContent.includes('Não foi possível carregar'));assert.equal(root.querySelectorAll('tbody tr').length,0);
  f.online();root.querySelector('button[onclick]').click();await wait(60);assert.equal(root.querySelectorAll('tbody tr').length,24);assert(root.textContent.includes('309'));
 }finally{f.close();}
});
test('statistics open directly without legacy modules, filter every phase and paginate locally',async()=>{
 const f=await editor({shell:true,page:'stats'});try{
  await wait(60);const root=f.w.document.getElementById('laff-stats-content');assert.equal(root.querySelectorAll('[data-laff-ranking-card]').length,3);assert(root.textContent.includes('309'));
  const stage=root.querySelector('#laff-stats-stage');stage.value='final';stage.dispatchEvent(new f.w.Event('change',{bubbles:true}));await wait(30);assert(root.textContent.includes('CPT VOX'));assert(root.textContent.includes('200'));assert.equal(root.querySelector('[data-laff-ranking-card]').dataset.total,'12');
  const calls=f.calls.length;root.querySelector('[data-laff-stats-view=averages]').click();await wait(30);assert(root.textContent.includes('15,38'));assert.equal(f.calls.length,calls);
  const card=root.querySelector('[data-laff-ranking-card]');card.querySelector('[data-laff-page-step="1"]').click();assert.equal(card.dataset.page,'1');assert.equal(card.querySelector('[data-laff-page-label]').textContent,'5–8');assert.equal(f.calls.length,calls);assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('native LAFF hash navigation updates the active page, and dates link to the chosen results',async()=>{
 const f=await editor({shell:true});try{
  await wait(950);f.w.location.hash='#laff-stats';await wait(40);assert.equal(f.w.document.querySelector('.page.active').id,'laff-stats');assert(f.w.document.querySelector('#laff-stats-stage'));
  f.w.location.hash='#laff-datas';await wait(40);const root=f.w.document.getElementById('laff-datas-content');assert(root.textContent.includes('Torneio encerrado'));assert(root.textContent.includes('24 equipes'));assert(!root.textContent.includes('Confirmação gradual'));
  root.querySelector('[data-laff-open-stage=final]').click();await wait(50);assert.equal(f.w.document.querySelector('.page.active').id,'laff-classificatoria');assert(f.w.document.getElementById('laff-classificatoria-content').textContent.includes('200'));assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('team rosters retain homonymous players and stage results are shown without individual drop data',async()=>{
 const f=await editor({shell:true,page:'equipes'});try{
  const players=f.w.getLAFFPlayers();assert.equal(players.length,110);assert.equal(players.filter(p=>p.name.toLowerCase()==='biel7').length,2);
  for(const name of ['RS TET','GOD E-SPORTS'])assert(f.w.getLAFFTeams().find(t=>t.name===name).players.some(p=>p.name==='biel7'));
  const opened=[];f.w.openPlayerProfile=(name,team)=>opened.push([name,team]);await f.w.openLAFFPlayerProfile('biel7','RS TET');await f.w.openLAFFPlayerProfile('biel7','GOD E-SPORTS');assert.deepEqual(opened,[['biel7','RS TET'],['biel7','GOD E-SPORTS']]);
  assert.equal(f.w.getLAFFTeams().find(t=>t.name==='KABUM! FDS').grupo,'A');
  f.w.cffGetTeamMercadoDepartures=()=>[{jogador:'Saída atual que não pertence a esta edição'}];
  await f.w.openLAFFTeamProfile('KABUM! FDS');await wait(50);const root=f.w.document.getElementById('laff-team-profile-content');assert(root.textContent.includes('Elenco na LAFF'));const stages=root.querySelectorAll('.laff-team-stage');assert.equal(stages.length,3);assert(stages[0].textContent.includes('208'));assert(stages[1].textContent.includes('48'));assert(stages[2].textContent.includes('Não participou'));assert(!root.textContent.includes('Sem informação.'));assert(!root.textContent.includes('Histórico de jogadores'));assert(!root.textContent.includes('Saída atual'));assert(!root.textContent.includes('Em breve'));assert(!root.textContent.includes('RSUHER'));assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('MVP phase and position filters, team-scoped player links and selections share one static kills response',async()=>{
 const f=await editor({shell:true,page:'mvp'});try{
  await wait(250);let root=f.w.document.getElementById('laff-mvp-content');assert(root.querySelector('.laff-kills-table'));assert(root.querySelector('.laff-rk-stage'));assert.equal(f.calls.filter(p=>p==='dados laff/jogadores.json').length,1);
  const select=root.querySelector('.laff-rk-stage');select.value='final';select.dispatchEvent(new f.w.Event('change',{bubbles:true}));await wait(40);assert.equal(root.querySelectorAll('tbody tr').length,53);
  const position=root.querySelector('.laff-rk-position');position.value='rush';position.dispatchEvent(new f.w.Event('change',{bubbles:true}));await wait(40);assert(root.querySelectorAll('tbody tr').length>0);assert(root.querySelectorAll('tbody tr').length<53);
  const opened=[];f.w.openLAFFPlayerProfile=(name,team)=>opened.push({name,team});const player=root.querySelector('.laff-player-link');player.click();assert.equal(opened[0].team,player.dataset.team);
  f.w.location.hash='#laff-selecoes';await wait(80);root=f.w.document.getElementById('laff-selecoes-content');assert(root.querySelector('h1'));assert.equal(root.querySelectorAll('.laff-selection-stage').length,3);assert.equal(root.querySelectorAll('.laff-selection-player').length,15);assert.equal(f.calls.filter(p=>p==='dados laff/abates.json').length,1);assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('failed MVP and selection requests recover on demand without a permanent empty cache or polling',async()=>{
 for(const page of ['mvp','selecoes']){
  const f=await editor({shell:true,page,failKills:true});try{
   await wait(250);let root=f.w.document.getElementById('laff-'+page+'-content');assert(root.textContent.includes('Não foi possível carregar'));
   const calls=f.calls.length;await wait(250);assert.equal(f.calls.length,calls,'a failed request must wait for the user to retry');
   f.online();[...root.querySelectorAll('button')].find(b=>b.textContent.includes('Tentar novamente')).click();await wait(200);
   assert(root.querySelector(page==='mvp'?'.laff-kills-table':'.laff-selection-stage'));assert(!root.textContent.includes('Não foi possível carregar'));assert.deepEqual(f.errors,[]);
  }finally{f.close();}
 }
});
test('LAFF selections and rosters reuse existing portraits with one static map and keep homonyms separate',async()=>{
 const f=await editor({shell:true,page:'selecoes'});try{
  await wait(120);const d=f.w.document;
  const portraits=[...d.querySelectorAll('.laff-selection-player img')];
  assert(portraits.some(img=>img.alt==='IsackSR'&&img.getAttribute('src')==='player-photos/s2/isacksr.webp'));
  assert(portraits.some(img=>img.alt==='Trevor9'&&img.getAttribute('src')==='player-photos/s2/trevor9.webp'));
  const files=JSON.parse(read('player-data/photo-map.json')).photos;
  for(const p of f.w.getLAFFPlayers()){
   const k=f.w.cffNormalizePlayerPhotoKey(p.name),expected=files[k];
   if(expected&&k!=='biel7'){assert.equal(f.w.CFF_LAFF_VIEWS.photo(p.name,p.team,p.photo),expected);assert(/^https:\/\//.test(expected)||fs.existsSync(expected),'missing portrait '+expected);}
  }
  await f.w.openLAFFTeamProfile('CPT VOX');await wait(40);
  const images=d.querySelectorAll('#laff-team-profile-content .laff-player-photo');
  assert([...images].some(img=>img.alt==='Ângelo7'&&img.getAttribute('src')==='player-photos/s2/angelo7.webp'));
  assert([...images].some(img=>img.alt==='bad9'&&img.getAttribute('src')==='player-photos/s2/bad9.webp'));
  for(const team of ['RS TET','GOD E-SPORTS'])assert.equal(f.w.CFF_LAFF_VIEWS.photo('biel7',team),'silhueta.webp');
  assert.equal(f.w.CFF_LAFF_VIEWS.photo('biel7','GOD E-SPORTS','specific-person.webp'),'specific-person.webp');
  assert.equal(f.w.CFF_LAFF_VIEWS.photo('Jogador sem foto','CPT VOX'),'silhueta.webp');
  assert.equal(f.w.CFF_LAFF_VIEWS.photo('Ângelo7','CPT VOX','tournament-photo.webp'),'tournament-photo.webp');
  await f.w.cffEnsureRoute('laff-selecoes');await wait(40);
  assert.equal(f.calls.filter(p=>p==='player-data/photo-map.json').length,1);
  assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
