const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
async function setup(){
 const section=fs.readFileSync('index.html','utf8').match(/<section class="hall-extra-section" id="hall-year-ranking-section">[\s\S]*?<\/section>/)[0],dom=new JSDOM(section,{url:'https://centralfreefire.com.br/index.html#hall-da-fama',runScripts:'outside-only'}),w=dom.window,calls=[];
 const data={'lbffData.json':read('lbffData.json'),'ffws-br-2026-s2/hall-player-stats.json':read(fs.existsSync('ffws-br-2026-s2/hall-player-stats.json')?'ffws-br-2026-s2/hall-player-stats.json':'ffws-br-2026-s2/player-stats.json'),'team-data/player-team-career.json':{teams:{}},'team-data/logo-map.json':read('team-data/logo-map.json'),'player-data/edition-teams.json':read('player-data/edition-teams.json'),'team-aliases.json':read('team-aliases.json')};
 w.fetch=async url=>{calls.push(String(url));assert(String(url).split('?')[0] in data);return {ok:true,json:async()=>data[String(url).split('?')[0]]};};
 w.eval(fs.readFileSync('js/hall-fame-lite.min.js','utf8'));await w.cffHallLiteBoot();return{w,doc:w.document,calls,close:()=>w.close()};
}
test('LBFF 3 belongs to 2020 in yearly totals, split details and year metadata',async()=>{
 const h=await setup();try{const {w,doc}=h;
  w.setHallYear(2020);w.setHallYearPlayerSearch('Cauan7');let row=doc.querySelector('#table-hall-year-ranking .hall-year-main-row');assert.equal(row.cells[2].textContent,'138');assert.match(doc.querySelector('#hall-year-meta').textContent,/2 edições/);w.cffHallToggleYearPlayer('CAUAN7');assert.equal(doc.querySelector('.hall-year-detail-row span').title,'LBFF 3');
  w.setHallYear(2021);row=doc.querySelector('#table-hall-year-ranking .hall-year-main-row');assert.equal(row.cells[2].textContent,String(99+93+102));w.cffHallToggleYearPlayer('CAUAN7');assert.deepEqual([...doc.querySelectorAll('.hall-year-detail-row>span:first-child')].map(s=>s.title).sort(),['LBFF 4','LBFF 5','LBFF 6']);assert.match(doc.querySelector('#hall-year-meta').textContent,/3 edições/);
  assert.equal(h.calls.length,6);
 }finally{h.close();}
});
test('compact summary opens on demand and expands the yearly leader using the existing split layout',async()=>{
 const h=await setup();try{const {w,doc}=h,button=doc.querySelector('#hall-year-summary-toggle'),panel=doc.querySelector('#hall-year-summary');assert.equal(button.disabled,false);assert.equal(panel.hidden,true);assert.equal(panel.querySelectorAll('tbody tr').length,0);
  w.setHallYear(2021);w.setHallYearPlayerSearch('Cauan7');const ranking=doc.querySelector('#table-hall-year-ranking tbody').innerHTML;
  w.Function(button.getAttribute('onclick')).call(button);assert.equal(panel.hidden,false);assert.equal(button.getAttribute('aria-expanded'),'true');
  const rows=[...panel.querySelectorAll('.hall-year-main-row')];assert.deepEqual(rows.map(r=>r.cells[0].textContent),['2026','2025','2024','2023','2022','2021','2020']);
  const leader=rows.find(r=>r.cells[0].textContent==='2020');assert.equal(leader.cells[1].textContent,'JapaBKR');assert.equal(leader.cells[2].textContent,'208');w.Function(leader.getAttribute('onclick')).call(leader);
  const splits=[...panel.querySelectorAll('.hall-year-detail-row')];assert.equal(splits.length,2);assert.deepEqual(splits.map(r=>r.querySelector('span').title).sort(),['LBFF 1','LBFF 3']);assert.equal(splits.reduce((sum,r)=>sum+Number(r.querySelector('strong').textContent),0),208);
  assert.equal(doc.querySelector('#table-hall-year-ranking tbody').innerHTML,ranking,'summary does not change full ranking filters or expanded rows');
  const close=panel.querySelector('.hall-year-collapse');w.Function('event',close.getAttribute('onclick')).call(close,{stopPropagation(){}});assert.equal(panel.querySelectorAll('.hall-year-detail-tr').length,0);
  w.cffHallYearSummaryRowKey({key:' ',preventDefault(){}},2020,'JAPABKR');assert.equal(panel.querySelectorAll('.hall-year-detail-tr').length,1);
  w.cffHallToggleYearSummary();assert.equal(panel.hidden,true);assert.equal(button.getAttribute('aria-expanded'),'false');assert.equal(h.calls.length,6,'all toggles and expansions use loaded static data');
 }finally{h.close();}
});
test('summary always ranks by kills and remains independent from full ranking filters and sort order',async()=>{
 const h=await setup();try{const {w,doc}=h;w.cffHallToggleYearSummary();const before=[...doc.querySelectorAll('#table-hall-year-summary .hall-year-main-row')].map(r=>r.textContent);
  w.setHallYearMetric('avg');w.setHallYearPlayerSearch('Nobody');w.setHallYearTeamSearch('Unknown');w.setHallYearMinDrops(true);w.changeHallYearPage(1);
  assert.deepEqual([...doc.querySelectorAll('#table-hall-year-summary .hall-year-main-row')].map(r=>r.textContent),before);assert.equal(h.calls.length,6);
 }finally{h.close();}
});
