const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{execFileSync}=require('node:child_process'),{JSDOM}=require('jsdom');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),tick=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setTimeout(r,0));};
const index=read('team-data/historical-index.json');
test('compiled team views stay current, share exactly one set of titles and exclude tenth place from championships',()=>{
 execFileSync('python3',['scripts/build-team-views.py','--check']);
 const entry=index.teams.find(t=>t.name==='LOUD SNICKERS'),historical=read('team-data/historical/'+entry.file),normal=read('team-data/history/loud-snickers.json');
 assert.equal(read('team-data/history/fluxo-w7m.json').titles.filter(t=>/Global Finals 2024/.test(t.event)).length,1);assert.deepEqual(historical.collectiveTitles,normal.titles);assert.equal(normal.titles.length,21);assert(!normal.titles.some(t=>t.event==='Goat League Season 1'));assert.equal(historical.participations.find(p=>p.event==='FFWS BR 2026 S1').position,1);
 assert.equal(historical.participations.filter(p=>p.event==='FFWS BR 2026 S1').length,1);assert(historical.staff.some(p=>p.id==='joker-coach'));assert(!normal.history.players.some(p=>p.id==='frois'));assert(normal.history.staff.some(p=>p.id==='frois'));
 assert(fs.statSync('team-data/historical-index.json').size<65000);assert(!fs.readFileSync('team-data/historical-index.json','utf8').includes('collectiveTitles'));
});
test('a historical profile fetches a small directory and just that team, with no full registry or title-sheet reads',async()=>{
 const dom=new JSDOM('<main id="historical-team-profile"></main>',{url:'https://centralfreefire.com.br/equipe-historica.html?time=W7M',runScripts:'outside-only'}),w=dom.window,calls=[];
 w.fetch=async url=>{const path=String(url).split('?')[0];calls.push(path);return {ok:true,json:async()=>read(path)};};
 try{w.eval(fs.readFileSync('js/historical-teams.min.js','utf8'));await tick();assert.equal(calls.length,3);assert.equal(calls[0],'team-data/historical-index.json');assert(calls[1].startsWith('team-data/historical/w7m-esports-'));assert(calls.some(p=>p.includes('team-data/competition-periods.json')));assert(!calls.some(p=>p.includes('workers.dev')||p.includes('historical-teams.json')));assert(w.document.body.textContent.includes('FFWS BR 2025 S1'));assert(w.document.body.textContent.includes('FFWS BR 2025 S2'));}finally{w.close();}
});
test('old current-team URLs redirect before downloading historical records, without merging W7M and Fluxo',async()=>{
 const redirects=[],calls=[],profile={innerHTML:''},context={document:{getElementById:id=>id==='historical-team-profile'?profile:null},location:{search:'?time=LOUD%20SNICKERS',hash:'',replace:path=>redirects.push(path)},URLSearchParams,fetch:async url=>{calls.push(String(url));return {ok:true,json:async()=>index};}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('js/historical-teams.min.js','utf8'),context);await tick();assert.deepEqual(redirects,['/equipe/loud-snickers']);assert.equal(calls.length,1);assert.equal(profile.innerHTML,'');
 const {teamHref}=await import('../js/career-client.mjs');assert.equal(teamHref('LOUD'),'/equipe/loud-snickers');assert.equal(teamHref('FLUXO W7M'),'/equipe/fluxo-w7m');assert.equal(teamHref('W7M ESPORTS'),'/equipe-historica.html?time=W7M%20ESPORTS');
});
