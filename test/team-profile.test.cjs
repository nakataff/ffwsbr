const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=require('../js/team-profile-model.js');
const read=p=>JSON.parse(fs.readFileSync(p));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('campaign averages exclude bonus and compare the same played stages',()=>{
 const data={classificatoria:{rows:[{team:'A',points:100,kills:50,booyahs:2,matches:10},{team:'B',points:80,kills:40,booyahs:1,matches:10}]},segundaFase:{rows:[{team:'A',points:70,bonus:50,kills:10,booyahs:1,matches:2},{team:'B',points:62,bonus:42,kills:8,booyahs:0,matches:2}]},final:{rows:[{team:'A',points:0,matches:0}]}};
 const x=model.campaign(data,'A');assert.equal(x.totals.points,120);assert.equal(x.totals.matches,12);assert.equal(x.rates.points,10);assert.equal(x.benchmark.points,220/24);assert.equal(x.rounds.length,2);assert.equal(model.campaign(data,'missing').rates.points,null);
});
test('Fluxo championship is persisted once, dated, linked and featured ahead of other trophies',()=>{
 const d=read('team-data/history/fluxo-w7m.json'),titles=model.titles(d.titles);
 assert.equal(titles[0].event,'FFWS BR 2026 S2');assert.equal(titles[0].date,'2026-10-11');assert.equal(d.titles.filter(t=>t.event===titles[0].event).length,1);assert(fs.existsSync(titles[0].url.slice(1)+'/index.html'));assert(fs.existsSync(titles[0].logo));assert.equal(d.results[0].place,'1º');assert.equal(model.titles([...d.titles,titles[0]]).length,d.titles.length);
});
function environment(query='fluxo-w7m',overrides={}){
 const nodes=new Map(),seasonButtons=new Map(),root={style:{setProperty(){}}};
 const element=id=>{if(nodes.has(id))return nodes.get(id);const e={id,dataset:{},hidden:false,events:{},style:{setProperty(){}},classList:{toggle(){},add(){},remove(){}},attributes:{},addEventListener(name,fn){this.events[name]=fn},setAttribute(k,v){this.attributes[k]=v},getAttribute(k){return this.attributes[k]},removeAttribute(k){delete this.attributes[k]},focus(){},getBoundingClientRect(){return {height:104}},scrollIntoView(options){this.scrollOptions=options}};let html='';Object.defineProperty(e,'innerHTML',{get(){return html},set(value){html=value;for(const match of value.matchAll(/id="([^"]+)"/g))element(match[1]);for(const match of value.matchAll(/data-team-season="([^"]+)"[^>]*aria-selected="([^"]+)"/g)){const b=element('season-'+match[1]);b.dataset.teamSeason=match[1];b.attributes['aria-selected']=match[2];seasonButtons.set(match[1],b)}}});nodes.set(id,e);return e};
 const page=element('team-page-root');page.style=root.style;
 const doc={readyState:'loading',documentElement:{},head:{appendChild(){}},body:{classList:{add(){},remove(){}}},addEventListener(){},getElementById:element,querySelector(sel){const hit=sel.match(/data-team-season="([^"\]]+)"/);return hit?seasonButtons.get(hit[1]):null},querySelectorAll(sel){return sel==='[data-team-season]'?[...seasonButtons.values()]:[]},createElement(){return element('canonical')}};
 const c={document:doc,window:{cffLoadPlayerPhotoMap:()=>new Promise(()=>{}),cffLoadTeamLogoMap:()=>new Promise(()=>{}),dispatchEvent(){},addEventListener(){}},location:{search:'?time='+query,pathname:'/equipe/'+query,origin:'https://centralfreefire.com.br'},history:{calls:[],replaceState(...args){this.calls.push(args)}},URLSearchParams,CustomEvent:class{},IntersectionObserver:class{observe(){}disconnect(){}},setTimeout,console,fetch:async url=>{const path=String(url).split('?')[0];if(overrides[path])return overrides[path]();return{ok:true,json:async()=>read(path)}}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('js/tournament-logos.js','utf8'),c);vm.runInContext(fs.readFileSync('js/team-profile-model.js','utf8'),c);
 let src=fs.readFileSync('js/team-page-fast.min.js','utf8');src=src.replace("document.readyState==='loading'?",'window.qa={init,state,selectSeason,renderTitles,renderCurrentRoster,s2Outcome,titleCard};\ndocument.readyState===\'loading\'?');vm.runInContext(src,c);
 return {qa:c.window.qa,nodes,seasonButtons,page,c};
}
test('profile renders before pending photo/logo maps and separates roster, results and trophies',async()=>{
 const e=environment();await e.qa.init();await tick();
 assert(e.page.innerHTML.includes('cff-profile-nav'),e.page.innerHTML.slice(0,1000));assert(e.page.innerHTML.includes('cff-profile-history'));
 assert(e.nodes.get('cff-current-roster').innerHTML.includes('Elenco atual'));assert(e.nodes.get('cff-season-panel').innerHTML.includes('Pontos por queda'));
 assert(e.nodes.get('cff-team-highlights').innerHTML.includes('FFWS BR 2026 S2'));assert(e.nodes.get('cff-team-titles-mount').innerHTML.includes('11/10/2026'));assert(e.nodes.get('cff-team-results-mount').innerHTML.includes('FFWS BR 2026 S2'));
 e.qa.state.titleYear='2024';e.qa.renderTitles(e.qa.state.historyData);assert(!e.nodes.get('cff-team-titles-mount').innerHTML.includes('FFWS BR 2026 S2'));assert(e.nodes.get('cff-team-highlights').innerHTML.includes('FFWS BR 2026 S2'));
 const p=e.qa.state.current.players.bops||Object.values(e.qa.state.current.players)[0];p.currentRoster.left=true;e.qa.renderCurrentRoster();const html=e.nodes.get('cff-current-roster').innerHTML;assert(!html.includes('<h3>'+p.name+'</h3>'));assert(html.includes('Saídas registradas'));
 assert(!e.qa.titleCard({event:'Unsafe',url:'javascript:alert(1)'}).includes('href='));
});
test('all 14 current team routes and their historical competitions render without errors',async()=>{
 for(const t of read('ffws-br-2026-s2/teams.json').teams){const slug=model.norm(t.name)==='loudsnickers'?'loud-snickers':t.name.toLowerCase().replace(/ /g,'-');const e=environment(slug);await e.qa.init();assert(!e.page.innerHTML.includes('Equipe não encontrada'),t.name+' '+e.page.innerHTML.slice(0,700));assert(e.nodes.get('cff-current-roster').innerHTML.includes('Elenco atual'),t.name);for(const key of ['s1','ewc','s2']){await e.qa.selectSeason(key);assert(!e.nodes.get('cff-season-panel').innerHTML.includes('Não foi possível'),t.name+': '+key)}await tick();}
});
test('late season responses do not replace a newly selected season',async()=>{
 let resolve;const e=environment('fluxo-w7m',{'team-data/seasons/fluxo-w7m.json':()=>new Promise(r=>resolve=()=>r({ok:true,json:async()=>read('team-data/seasons/fluxo-w7m.json')}))});await e.qa.init();const pending=e.qa.selectSeason('s1');await e.qa.selectSeason('s2');resolve();await pending;assert(e.nodes.get('cff-season-panel').innerHTML.includes('WB 2026 S2'));assert(!e.nodes.get('cff-season-panel').innerHTML.includes('<h2>WB 2026 S1</h2>'));
 // A manually selected LAFF tab also invalidates the pending main competition response.
 e.qa.state.seasonData=null;const second=e.qa.selectSeason('ewc');e.seasonButtons.get('ewc').setAttribute('aria-selected','false');e.nodes.get('cff-season-panel').innerHTML='LAFF selected';resolve();await second;assert.equal(e.nodes.get('cff-season-panel').innerHTML,'LAFF selected');
});

test('profile anchors and highlights remain on the team page even with base href pointing to the home',async()=>{
 const e=environment();await e.qa.init();await tick();
 const links=[...e.page.innerHTML.matchAll(/href="([^"]+)" data-profile-section="([^"]+)"/g)];assert.equal(links.length,5);
 for(const [,href,section] of links){
  const resolved=new URL(href,'https://centralfreefire.com.br/');assert.equal(resolved.pathname,'/equipe/fluxo-w7m');assert.equal(resolved.hash,'#cff-profile-'+section);
  let prevented=false;const click={button:0,target:{closest(){return{dataset:{profileSection:section}}}},preventDefault(){prevented=true}};e.page.events.click(click);assert(prevented);assert.equal(e.c.history.calls.at(-1)[2],'/equipe/fluxo-w7m#cff-profile-'+section);assert.equal(e.nodes.get('cff-profile-'+section).scrollOptions.block,'start');
 }
 const highlight=e.nodes.get('cff-team-highlights').innerHTML;assert(highlight.includes('href="/equipe/fluxo-w7m#cff-profile-titles" data-profile-jump="titles"'));
 let prevented=false;e.page.events.click({button:0,target:{closest(){return{dataset:{profileJump:'titles'}}}},preventDefault(){prevented=true}});assert(prevented);assert.equal(e.c.history.calls.at(-1)[2],'/equipe/fluxo-w7m#cff-profile-titles');
 const count=e.c.history.calls.length;e.page.events.click({button:0,ctrlKey:true,target:{closest(){return{dataset:{profileSection:'roster'}}}},preventDefault(){assert.fail('Modified clicks must keep normal link behavior')}});assert.equal(e.c.history.calls.length,count);
});
test('team trophies use the shared global logo and preserve the Brazilian tournament logo',async()=>{
 const e=environment();await e.qa.init();await tick();
 assert(e.qa.titleCard({event:'Free Fire World Series - Global Finals 2024',logo:'trofeu.webp'}).includes('/ffws-global-2026/Free_Fire_World_Series_2021_icon_allmode.png'));
 assert(e.qa.titleCard({event:'FFWS BR 2026 S2',logo:'wb.webp'}).includes('src="wb.webp"'));
});
