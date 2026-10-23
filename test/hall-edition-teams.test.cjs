const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));
async function setup({historic=read('lbffData.json'),current=read(fs.existsSync('ffws-br-2026-s2/hall-player-stats.json')?'ffws-br-2026-s2/hall-player-stats.json':'ffws-br-2026-s2/player-stats.json'),editions=read('player-data/edition-teams.json')}={}){
 const html=fs.readFileSync('index.html','utf8'),mode=html.match(/<select id="hist-edition-team-mode"[\s\S]*?<\/select>/)[0],heading=html.match(/<span class="full-name-desktop" id="hist-edition-team-heading">[\s\S]*?<\/span>/)[0];
 const dom=new JSDOM(mode+heading+'<div id="edition-filters"></div><table id="table-history"><tbody></tbody></table><table id="table-edition-history"><tbody></tbody></table>',{url:'https://centralfreefire.com.br/index.html#hall-da-fama',runScripts:'outside-only'}),w=dom.window,calls=[];
 const data={'lbffData.json':historic,'ffws-br-2026-s2/hall-player-stats.json':current,'team-data/player-team-career.json':{teams:{}},'team-data/logo-map.json':read('team-data/logo-map.json'),'player-data/edition-teams.json':editions,'team-aliases.json':read('team-aliases.json')};
 w.fetch=async url=>{calls.push(String(url));const path=String(url).split('?')[0];assert(path in data,'only existing static sources may load: '+url);return {ok:true,json:async()=>data[path]};};
 w.eval(fs.readFileSync('js/hall-fame-lite.min.js','utf8'));await w.cffHallLiteBoot();
 const select=(...wanted)=>{for(const button of [...w.document.querySelectorAll('#edition-filters .day-chip.active')])w.toggleEdition(button.textContent);for(const ed of wanted)w.toggleEdition(ed);};
 const row=name=>[...w.document.querySelectorAll('#table-edition-history tbody tr')].find(r=>r.querySelector('.hall-player-link')?.textContent===name);
 return{w,calls,select,row,close:()=>w.close()};
}

test('edition ranking shows the recorded team for a current player and a retired player',async()=>{
 const h=await setup();try{
  h.select('LBFF 1');h.w.setHallEditionPlayerSearch('Kroonos');const old=h.row('Kroonos');assert(old);assert.equal(old.cells[2].textContent,'Keyd');assert.equal(old.cells[2].querySelector('img').getAttribute('src'),'keyd.webp');assert(!old.cells[2].textContent.includes('Inativo'));
  h.select('LBFF 3');h.w.setHallEditionPlayerSearch('Cauan7');const cauan=h.row('Cauan7');assert.equal(cauan.cells[2].textContent,'SS ESPORTS');assert.equal(cauan.cells[3].textContent,'138');assert.equal(cauan.cells[2].querySelector('img').getAttribute('src'),read('team-data/logo-map.json').logos['SS ESPORTS']);
  h.select('WB 2025 S2');assert.equal(h.row('Cauan7').cells[2].textContent,'W7M ESPORTS');assert.equal(h.row('Cauan7').cells[2].querySelector('img').getAttribute('src'),read('team-data/logo-map.json').logos['W7M ESPORTS']);
  h.select('WB 2026 S1');assert.equal(h.row('Cauan7').cells[2].textContent,'VIRTUS PRO');
  assert.equal(h.calls.length,6,'switching editions and searching only use cached static data');
 }finally{h.close();}
});

test('combined editions show each historical team once, preserve totals and retain the current profile link',async()=>{
 const h=await setup();try{
  h.select('WB 2025 S2','LBFF 3','LBFF 4','LBFF 5');h.w.setHallEditionPlayerSearch('Cauan7');const r=h.row('Cauan7');
  assert.deepEqual([...r.cells[2].querySelectorAll('img')].map(img=>img.alt),['SS ESPORTS','LOUD','W7M ESPORTS']);
  assert.equal(r.cells[3].textContent,String(88+138+99+93));assert.equal(r.cells[4].textContent,String(68+84+80+81));
  const loud=r.cells[2].querySelector('img[alt="LOUD"]').parentElement;assert(loud.title.includes('LBFF 4'));assert(loud.title.includes('LBFF 5'));
  const all=[...h.w.document.querySelectorAll('#table-history tbody tr')].find(row=>row.querySelector('.hall-player-link')?.textContent==='Cauan7');
  if(all)assert.equal(r.querySelector('button').getAttribute('onclick'),all.querySelector('button').getAttribute('onclick'));
  assert.equal(h.calls.length,6);
 }finally{h.close();}
});

test('missing historical team stays unknown instead of inheriting the current team; team sorting uses the edition',async()=>{
 const h=await setup({historic:{Alice:{'LBFF 3':{k:10,q:5,team:'ZETA'}},Bob:{'LBFF 3':{k:8,q:5,team:'ALPHA'}},Carol:{'LBFF 3':{k:9,q:5}}},current:{players:{a:{name:'Alice',team:'ALPHA',kills:2,matches:1},b:{name:'Bob',team:'ZETA',kills:2,matches:1},c:{name:'Carol',team:'LOUD SNICKERS',kills:2,matches:1}}},editions:{players:{}}});try{
  h.select('LBFF 3');h.w.setHallEditionSort('team');assert.deepEqual([...h.w.document.querySelectorAll('#table-edition-history .hall-player-link')].map(b=>b.textContent),['Bob','Alice','Carol']);
  assert.equal(h.row('Carol').cells[2].textContent,'Sem equipe registrada');assert.equal(h.row('Carol').cells[2].querySelectorAll('img').length,0);
  const current=h.w.document.querySelector('#table-history tbody');assert(current.textContent.includes('LOUD SNICKERS'));
  h.select();assert(h.w.document.querySelector('#table-edition-history tbody').textContent.includes('Selecione uma edição'));
 }finally{h.close();}
});

test('cached shared identities respect the selected tournament date, including delayed logo updates',async()=>{
 const h=await setup();try{
  h.select('WB 2025 S2');h.w.setHallEditionPlayerSearch('Cauan7');const calls=[];
  h.w.cffCareerTeamIdentity=(name,at)=>{calls.push([name,at]);return name==='W7M ESPORTS'?{name:'W7M ESPORTS',logo:'historic-w7m.webp'}:null;};
  h.w.document.dispatchEvent(new h.w.Event('cff:career-identities-ready'));
  assert.equal(h.row('Cauan7').cells[2].querySelector('img').getAttribute('src'),'historic-w7m.webp');assert.deepEqual(calls,[['W7M ESPORTS','2025-08-22']]);assert.equal(h.calls.length,6);
 }finally{h.close();}
});

test('simple team selector changes only team display and sorting, with no additional loads',async()=>{
 const h=await setup({historic:{Alice:{'LBFF 3':{k:10,q:5,team:'ZETA'}},Bob:{'LBFF 3':{k:8,q:5,team:'ALPHA'}},Retired:{'LBFF 3':{k:5,q:5,team:'KEYD'}}},current:{players:{a:{name:'Alice',team:'ALPHA',kills:2,matches:1},b:{name:'Bob',team:'ZETA',kills:2,matches:1}}},editions:{players:{}}});try{
  h.select('LBFF 3');const select=h.w.document.getElementById('hist-edition-team-mode'),heading=h.w.document.getElementById('hist-edition-team-heading');
  assert.equal(select.value,'edition');assert.equal(heading.textContent,'Equipe da edição');assert.equal(h.row('Alice').cells[2].textContent,'ZETA');
  const totals=[...h.row('Alice').cells].slice(3).map(c=>c.textContent),global=h.w.document.querySelector('#table-history tbody').innerHTML;
  select.value='current';h.w.Function(select.getAttribute('onchange')).call(select);h.w.setHallEditionSort('team');
  assert.equal(heading.textContent,'Equipe atual');assert.equal(h.row('Alice').cells[2].textContent,'ALPHA');assert.equal(h.row('Retired').cells[2].textContent,'Inativo');
  assert.equal(h.w.document.querySelector('#table-edition-history .hall-player-link').textContent,'Alice');assert.deepEqual([...h.row('Alice').cells].slice(3).map(c=>c.textContent),totals);
  select.value='edition';h.w.Function(select.getAttribute('onchange')).call(select);assert.equal(h.w.document.querySelector('#table-edition-history .hall-player-link').textContent,'Bob');assert.equal(h.row('Retired').cells[2].textContent,'KEYD');
  assert.equal(h.w.document.querySelector('#table-history tbody').innerHTML,global);assert.equal(h.calls.length,6);
 }finally{h.close();}
});
