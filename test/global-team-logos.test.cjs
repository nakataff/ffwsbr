const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function image(src,team){return {dataset:team?{cffGlobalTeamLogo:team}:{},src,hidden:false,getAttribute(key){return this[key]||''},closest(){return {querySelector(){return {hidden:false}}}}}}
function homeCard(name,short){const monogram={textContent:short,hidden:false},caption={textContent:'Logo pendente'},box={image:null,querySelector(){return this.image},prepend(x){this.image=x}};return {box,monogram,caption,querySelector(sel){return sel==='strong'?{textContent:name}:sel==='.home-global-monogram'?monogram:sel==='.home-global-team-image'?box:sel==='small'?caption:null}};}
function environment(){
 const lyon=image('lyon.webp','LYON'),gow=image('escudo.webp','GOW'),player=image('lyon.webp'),card=homeCard('P Esports','P');
 let finishSecondary;
 const secondary=new Promise(resolve=>finishSecondary=resolve),events=[];
 const c={window:{CFF_CONFIG:{sheets:{logosEquipes:'https://primary',logosOutrasEquipes:'https://secondary'}},addEventListener(){}},document:{documentElement:{},querySelectorAll(sel){return sel==='img[data-cff-global-team-logo]'?[lyon,gow]:sel==='#home-global-classified .home-global-team'?[card]:[]},createElement(){return image('')},dispatchEvent(e){events.push(e.type)},addEventListener(){}},MutationObserver:class{observe(){}},CustomEvent:class{constructor(type){this.type=type}},setTimeout,clearTimeout,fetch:async url=>{
 if(url.startsWith('team-data/'))return {ok:true,json:async()=>({logos:{LYON:'lyon.webp'},aliases:{}})};
 if(url.startsWith('https://secondary')){await secondary;return {ok:true,text:async()=> 'Equipe\tLogo\nLYON\thttps://photos/player-lyon.webp\nGOW\thttps://wrong/secondary.webp'}}
 return {ok:true,text:async()=> 'Equipe\tLogo\nLYON\thttps://photos/player-lyon.webp\nGOW\thttps://updated/gow.webp\nP Esports\thttps://i.postimg.cc/XX60XGKy/P-ESPORTS.webp'};
 }};
 vm.createContext(c);vm.runInContext(fs.readFileSync('js/global-team-logos.js','utf8'),c);
 vm.runInContext(fs.readFileSync('js/year-ranking-logo-sheet.js','utf8'),c);
 return {c,lyon,gow,player,card,finishSecondary,events};
}
test('logos appear immediately, including LYON, before sheets respond',async()=>{
 const e=environment();assert.equal(e.lyon.src,'home-assets/teams/global/lyon.webp');assert.equal(e.card.box.image.src,'home-assets/teams/global/p-esports.webp');assert.equal(e.card.caption.textContent,'P');assert(e.card.monogram.hidden);assert.equal(e.player.src,'lyon.webp');
 await new Promise(r=>setTimeout(r,0));assert.equal(e.gow.src,'https://updated/gow.webp');
 e.finishSecondary();await e.c.window.cffReloadYearSheetLogos();assert.equal(e.lyon.src,'home-assets/teams/global/lyon.webp');assert.equal(e.gow.src,'https://updated/gow.webp');assert.equal(e.player.src,'lyon.webp');
});
test('all 24 canonical assets exist, have WebP signatures and stay under 250 KB together',()=>{
 const teams=JSON.parse(fs.readFileSync('ffws-global-2026/teams.json')).teams;assert.equal(teams.length,24);let total=0;const paths=new Set();
 for(const t of teams){assert.equal(t.logoPending,false);assert(t.logo.startsWith('home-assets/teams/global/'));paths.add(t.logo);const data=fs.readFileSync(t.logo);assert.equal(data.toString('ascii',8,12),'WEBP');total+=data.length}
 assert.equal(paths.size,24);assert(total<250000);
 const html=fs.readFileSync('index.html','utf8');assert(!html.includes('Logo pendente'));assert.equal((html.match(/data-cff-global-team-logo=/g)||[]).length,24);
});
test('Mundial render ignores stale pending flags and never selects the player photo',()=>{
 const roots=new Map(),doc={readyState:'loading',addEventListener(){},getElementById(id){if(!roots.has(id))roots.set(id,{innerHTML:'',dataset:{},classList:{contains(){return false}},querySelector(){return null},querySelectorAll(){return []}});return roots.get(id)},querySelector(){return null},querySelectorAll(){return []}};
 const c={document:doc,window:{addEventListener(){},cffFindLiveTeamLogo(){return 'lyon.webp'}},location:{hash:'',pathname:'/index.html'},console,setTimeout,clearTimeout,URL,URLSearchParams};vm.createContext(c);vm.runInContext(fs.readFileSync('js/global-team-logos.js','utf8'),c);
 let src=fs.readFileSync('ffws-global-2026/global.js','utf8');src=src.replace("  if (document.readyState === 'loading')","  window.__qa={state,renderPage,logo};\n  if (document.readyState === 'loading')");vm.runInContext(src,c);
 const qa=c.window.__qa;qa.state.loaded=true;qa.state.teams=JSON.parse(fs.readFileSync('ffws-global-2026/teams.json')).teams.map(t=>({...t,logoPending:true}));
 qa.renderPage('ffws-global-2026-equipes');const html=roots.get('ffws-global-2026-equipes-content').innerHTML;
 assert(!html.includes('Logo a cadastrar'));assert.equal(qa.logo('LYON'),'home-assets/teams/global/lyon.webp');assert.equal(qa.logo('Lyon'),'home-assets/teams/global/lyon.webp');
});
