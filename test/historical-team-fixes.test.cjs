const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const tick=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setTimeout(r,0));};

test('W7M historical participation matches both recorded 2025 finals without absorbing Fluxo W7M',()=>{
 const teams=read('team-data/historical-teams.json').teams,w7m=teams.find(t=>t.name==='W7M ESPORTS'),fluxo=teams.find(t=>t.name==='FLUXO W7M');assert(w7m&&fluxo);assert(w7m.aliases.includes('W7M'));assert(!w7m.aliases.includes('FLUXO W7M'));assert.notEqual(w7m.logo,fluxo.logo);
 for(const name of ['wb-2025-s1','wb-2025-s2']){const source=read('novos-torneios/'+name+'.json'),cols=source.final.cols,row=source.final.rows.find(r=>r[cols.indexOf('team')]==='W7M ESPORTS'),entries=w7m.participations.filter(p=>p.event===source.name);assert.equal(entries.length,1);assert.equal(entries[0].position,row[cols.indexOf('pos')]);assert.equal(entries[0].date,source.endDate);assert.equal(entries[0].source,'novos-torneios/'+name+'.json');}
 assert.equal(w7m.lastParticipation.event,'WB 2025 S2');assert.equal(w7m.lastParticipation.position,11);
});

test('profile trail and tenure links open the normal historical team page',async()=>{
 const c=await import('../js/career-client.mjs');assert.equal(c.teamHref('VIRTUS PRO'),'/equipe-historica.html?time=VIRTUS%20PRO');
 const tenure={id:'t',teamId:'vp',teamName:'VIRTUS PRO',role:'player',status:'ended',order:1,start:{},end:{}};
 for(const html of [c.careerTrail({tenures:[tenure],current:[]}),c.tenureCards([tenure],{admin:true})]){assert(html.includes('href="/equipe-historica.html?time=VIRTUS%20PRO"'));assert(!html.includes('/carreira.html?team='));}
});

test('the live logo sheet updates historical and player trail images in the background and preserves player photos and Fluxo',async()=>{
 const dom=new JSDOM('<img id="historical" data-team-logo="W7M ESPORTS" src="escudo.webp"><div class="career-trail-logo"><img id="trail" data-team-logo="W7M" src="escudo.webp"></div><img id="fluxo" data-team-logo="FLUXO W7M" src="Fluxo 2.webp"><img id="player" src="cauan7.webp">',{url:'https://centralfreefire.com.br/jogador.html?id=cauan7',runScripts:'outside-only'}),w=dom.window;let primary,secondary;
 const first=new Promise(r=>primary=r),second=new Promise(r=>secondary=r),map=read('team-data/logo-map.json');w.CFF_CONFIG={sheets:{logosEquipes:'https://primary.test',logosOutrasEquipes:'https://secondary.test'}};
 w.fetch=async url=>{if(String(url).startsWith('team-data/'))return {ok:true,json:async()=>map};return {ok:true,text:async()=>String(url).startsWith('https://primary.test')?first:second};};
 try{
  w.eval(fs.readFileSync('js/team-logo-resolver.min.js','utf8'));w.eval(fs.readFileSync('js/year-ranking-logo-sheet.js','utf8'));await tick();
  assert.equal(w.document.querySelector('#historical').getAttribute('src'),map.logos['W7M ESPORTS']);assert.equal(w.document.querySelector('#trail').getAttribute('src'),map.logos['W7M ESPORTS']);
  primary('equipe\tlogo\nW7M ESPORTS\thttps://i.postimg.cc/test/new-w7m.webp');await tick();assert.equal(w.document.querySelector('#historical').src,'https://i.postimg.cc/test/new-w7m.webp');assert.equal(w.document.querySelector('#trail').src,'https://i.postimg.cc/test/new-w7m.webp');assert.equal(w.cffResolveTeamLogo('W7M ESPORTS','old.webp'),'https://i.postimg.cc/test/new-w7m.webp');
  secondary('equipe\tlogo\nW7M\thttps://i.postimg.cc/test/secondary-w7m.webp');await tick();assert.equal(w.document.querySelector('#historical').src,'https://i.postimg.cc/test/new-w7m.webp');assert.equal(w.document.querySelector('#trail').src,'https://i.postimg.cc/test/new-w7m.webp');assert(w.document.querySelector('#fluxo').src.endsWith('/Fluxo%202.webp'));assert(w.document.querySelector('#player').src.endsWith('/cauan7.webp'));
  const late=w.document.createElement('img');late.dataset.teamLogo='W7M ESPORTS';late.src='escudo.webp';w.document.body.append(late);w.cffPatchYearTeamLogos();assert.equal(late.src,'https://i.postimg.cc/test/new-w7m.webp');
 }finally{w.close();}
});

test('Frois resolves the existing Mundial Apex asset in his trail and passage using only the selected profile and static logo map',async()=>{
 const client=await import('../js/career-client.mjs'),map=read('team-data/logo-map.json'),calls=[],
 dom=new JSDOM('<main id="person"></main>',{url:'https://centralfreefire.com.br/carreira.html?id=frois',runScripts:'outside-only'}),w=dom.window;
 const tenure={id:'manual-apex',teamId:'teamapexgaming',teamName:'Team Apex Gaming',teamPageName:'Team Apex Gaming',logo:'escudo.webp',role:'coach',status:'active',order:1,start:{date:'2026-08-28',edition:'FFMIC 2026 Fall'},end:{},competitions:[]};
 const person={id:'frois',name:'Frois',kind:'staff',country:'br',photo:'silhueta.webp',availability:'active',current:[tenure],tenures:[tenure]};
 Object.assign(w,{esc:client.esc,ROLES:client.ROLES,STATUSES:client.STATUSES,tenureCards:client.tenureCards,careerTrail:client.careerTrail,personHref:client.personHref,teamHref:client.teamHref,periodLabel:client.periodLabel,
  readCareer:async(kind,query)=>{calls.push({kind,query});return {person};},fetch:async url=>{calls.push({url:String(url)});return {ok:true,json:async()=>map};}});
 try{
  w.eval(fs.readFileSync('js/team-logo-resolver.min.js','utf8'));
  w.eval(fs.readFileSync('js/career-public.js','utf8').replace(/^import .*\n/gm,'').replace(/^export /gm,''));
  await w.mountPersonCareer(w.document.querySelector('#person'),{id:'frois'},{standalone:true});
  const images=[...w.document.querySelectorAll('.career-trail img,.career-pro-team-logo img')];assert.equal(images.length,2);assert(images.every(img=>img.getAttribute('src')==='home-assets/teams/global/tag.webp'));
  assert.equal(w.cffResolveTeamLogo('TAG','escudo.webp'),'home-assets/teams/global/tag.webp');assert.equal(w.cffResolveTeamLogo('Team Apex Gaming','custom-team.webp'),'custom-team.webp');
  assert.equal(w.document.querySelector('.career-pro-portrait img').getAttribute('src'),'silhueta.webp');assert.equal(person.country,'br');assert.equal(person.tenures[0].start.date,'2026-08-28');
  assert.equal(calls.filter(c=>c.kind==='person').length,1);assert.equal(calls.filter(c=>c.url).length,1);assert(calls.find(c=>c.url).url.startsWith('team-data/logo-map.json'));
  assert.equal(fs.readFileSync(map.logos['TEAM APEX GAMING']).toString('ascii',8,12),'WEBP');
 }finally{w.close();}
});

test('historical W7M profile and directory show the corrected logo and both 2025 editions',async()=>{
 const data=read('team-data/historical-teams.json'),dom=new JSDOM('<main id="historical-team-profile"></main><main id="historical-teams-directory"></main>',{url:'https://centralfreefire.com.br/equipe-historica.html?time=W7M',runScripts:'outside-only'}),w=dom.window,calls=[];w.fetch=async url=>{calls.push(String(url));return {ok:true,json:async()=>data};};
 try{w.eval(fs.readFileSync('js/historical-teams.min.js','utf8'));await tick();const profile=w.document.querySelector('#historical-team-profile');assert.match(profile.textContent,/WB 2025 S1/);assert.match(profile.textContent,/WB 2025 S2/);assert.match(profile.textContent,/10º/);assert.match(profile.textContent,/11º/);assert.equal(profile.querySelector('.historical-team-logo').dataset.teamLogo,'W7M ESPORTS');assert(profile.querySelector('.historical-team-logo').src.endsWith('/w7m.webp'));assert.equal(calls.length,3);assert(calls.some(call=>call.includes('team-data/competition-periods.json')));assert(w.document.querySelector('#historical-team-grid [data-team-logo="W7M ESPORTS"]'));}finally{w.close();}
});
