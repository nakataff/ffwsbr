const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const source=fs.readFileSync('index.html','utf8');
const evolutions=source.match(/<section class="hall-extra-section" id="hall-evolutions-section"[\s\S]*?<\/section>/)?.[0];
const exportsSection=source.match(/<section class="hall-extra-section" id="hall-export-section"[\s\S]*?<\/section>/)?.[0];

async function setup(){
 assert(evolutions&&exportsSection,'Ambas as seções precisam existir abaixo de Líderes por Equipe');
 const dom=new JSDOM('<!doctype html><html><head></head><body>'+evolutions+exportsSection+'</body></html>',{
  url:'https://centralfreefire.com.br/index.html#hall-da-fama',runScripts:'outside-only'
 });
 const w=dom.window,calls=[];
 w.TextEncoder=TextEncoder;
 w.Blob=Blob;
 const data={
  'lbffData.json':read('lbffData.json'),
  'ffws-br-2026-s2/hall-player-stats.json':read('ffws-br-2026-s2/hall-player-stats.json'),
  'team-data/player-team-career.json':read('team-data/player-team-career.json'),
  'team-data/logo-map.json':read('team-data/logo-map.json'),
  'player-data/edition-teams.json':read('player-data/edition-teams.json'),
  'team-aliases.json':read('team-aliases.json'),
  'ranking-data/hall-edition-placements.json':read('ranking-data/hall-edition-placements.json')
 };
 w.fetch=async url=>{
  const key=String(url).split('?')[0].replace(/^\/+/, '');
  calls.push(key);
  assert(key in data,'O Hall deve carregar apenas os arquivos leves já existentes: '+key);
  return {ok:true,json:async()=>data[key]};
 };
 w.eval(fs.readFileSync('js/hall-fame-lite.min.js','utf8'));
 w.eval(fs.readFileSync('js/hall-evolution-export.js','utf8'));
 await w.CFFHallTools.boot();
 return {dom,w,state:w.CFFHallTools._state,calls,close:()=>w.close()};
}
function localHeaders(binary){
 const buf=Buffer.from(binary),files={};
 let at=0;
 while(at+30<=buf.length&&buf.readUInt32LE(at)===0x04034b50){
  const length=buf.readUInt32LE(at+18),nameLen=buf.readUInt16LE(at+26),extraLen=buf.readUInt16LE(at+28);
  const name=buf.toString('utf8',at+30,at+30+nameLen);
  const start=at+30+nameLen+extraLen;
  files[name]=buf.toString('utf8',start,start+length);
  at=start+length;
 }
 return files;
}
test('new sections follow Líderes por Equipe and use the Hall-only lazy loader',()=>{
 const leader=source.indexOf('id="hall-team-leaders-section"'),evo=source.indexOf('id="hall-evolutions-section"'),exported=source.indexOf('id="hall-export-section"');
 assert(leader>0&&leader<evo&&evo<exported);
 const loader=fs.readFileSync('js/site-shell-fast.min.js','utf8');
 assert.match(loader,/hallTools:'js\/hall-evolution-export\.js/);
 assert.match(loader,/await seq\(\['hallExtras','hall','hallTools'\]\)/);
 assert.match(source,/js\/site-shell-fast\.min\.js\?v=20261124-hall-evolution-export-v3/);
});
test('maiores evoluções usa splits consecutivos por jogador, com uma melhor evolução e filtro mínimo',async()=>{
 const a=await setup();
 try{
  const {w,state}=a;
  assert(state.rows.length>1000);
  assert(state.editions.includes('WB 2026 S2'));
  assert(state.players.size>300);
  const list=w.CFFHallTools.progressionRows('avg',true,'');
  assert(list.length>100);
  assert.equal(new Set(list.map(x=>x.key)).size,list.length,'Cada jogador deve aparecer apenas uma vez');
  assert(list.every(x=>x.difference>0));
  assert(list.every(x=>x.before.order<x.after.order));
  assert(list.every(x=>x.before.matches>=Math.ceil(state.maxMatches.get(x.before.edition)/2)));
  assert(list.every(x=>x.after.matches>=Math.ceil(state.maxMatches.get(x.after.edition)/2)));
  const ordered=[...list].sort((a,b)=>b.difference-a.difference);
  assert.equal(list[0].key,ordered[0].key);
  const previous=w.CFFHallTools.progressionRows('kills',true,'Nickz7');
  assert(previous.length<=1);
  const filtered=w.CFFHallTools.progressionRows('avg',true,'@@sem-jogador@@');
  assert.equal(filtered.length,0);
  assert.match(w.document.querySelector('#hall-evolution-info').textContent,/Top 1–10/);
  assert.equal(w.document.querySelectorAll('#hall-evolution-results tr').length,10);
  const next=w.document.querySelector('#hall-evolution-next');
  next.click();
  assert.match(w.document.querySelector('#hall-evolution-info').textContent,/Top 11–20/);
 }finally{a.close();}
});
test('exportador aproveita os splits existentes, permite selecionar jogadores e ordenar registros',async()=>{
 const a=await setup();
 try{
  const {w,state,calls}=a,api=w.CFFHallTools;
  assert.equal(calls.length,7,'Hall original usa 6 JSONs e exportador apenas um resumo leve de posições');
  state.chosen=new Set(['CAUAN7','JAPABKR']);
  const rows=api.sortedRows();
  assert(rows.length>2);
  assert(rows.every(r=>['CAUAN7','JAPABKR'].includes(r.key)));
  assert(rows.some(r=>r.edition==='LBFF 3'&&r.name.toLowerCase()==='cauan7'&&r.kills===138));
  const known={name:'teste',team:'Team Liquid',edition:'LBFF 1',year:2020,kills:2,matches:3,avg:2/3};
  assert.equal(api.recordValue(known,'position'),1,'LBFF 1 tem colocação geral confirmada');
  assert.equal(api.recordValue({...known,team:'Equipe não cadastrada'},'position'),null);
  state.sort='kills-desc';
  const highest=api.sortedRows();
  assert(highest[0].kills>=highest[1].kills);
  state.chosenEditions=new Set(['LBFF 3']);
  assert(api.sortedRows().every(row=>row.edition==='LBFF 3'));
  state.chosenEditions=new Set(state.editions);
  api.renderPreview();
  assert.match(w.document.querySelector('#hall-export-preview-info').textContent,/linhas/);
 }finally{a.close();}
});
test('Excel gera abas próprias, números, cabeçalho estilizado, congelamento e AutoFiltro',async()=>{
 const a=await setup();
 try{
  const {w,state}=a,api=w.CFFHallTools;
  state.chosen=new Set(['CAUAN7','JAPABKR']);
  const rows=api.sortedRows(),fields=state.fields.filter(x=>x.active);
  const workbook=api.xlsxBlob(rows,fields,'player');
  assert.equal(workbook.sheets,2);
  assert(workbook.blob.size>1500);
  const contents=localHeaders(await workbook.blob.arrayBuffer());
  assert(contents['xl/workbook.xml'].includes('<sheet name="Cauan7"'));
  assert(contents['xl/workbook.xml'].includes('<sheet name="JapaBKR"'));
  assert(contents['xl/styles.xml'].includes('FF006DB2'));
  const sheet=contents['xl/worksheets/sheet1.xml'];
  assert.match(sheet,/<pane ySplit="1"/);
  assert.match(sheet,/<autoFilter ref="A1:H/);
  assert.match(sheet,/Posição no torneio/);
  assert.match(sheet,/t="n" s="3"/);
  const allByYear=api.xlsxBlob(rows,fields,'year');
  assert(allByYear.sheets>=2);
  const chunks=api.workbookGroups(Array.from({length:201},(_,i)=>({name:'Jogador',edition:'LBFF 3',year:2020,order:i})), 'chunks');
  assert.deepEqual(chunks.map(s=>s.rows.length),[100,100,1]);
  const csv=api.csvBlob(rows,fields);
  const csvText=await csv.text();
  assert(csvText.startsWith('\uFEFF'));
  assert(csvText.includes('"Jogador";"Equipe";"Abates"'));
 }finally{a.close();}
});

test('GOD E-SPORTS LBFF 5 usa 17º da classificatória quando não foi finalista',async()=>{
 const a=await setup();
 try{
  const {w,state}=a,api=w.CFFHallTools;
  const bops=state.rows.find(r=>r.name.toUpperCase()==='BOPS'&&r.edition==='LBFF 5');
  assert(bops,'Bops precisa estar cadastrado na LBFF 5');
  assert.equal(bops.team,'GOD E-SPORTS');
  assert.equal(api.recordValue(bops,'position'),17);
  const p=read('ranking-data/hall-edition-placements.json');
  assert.equal(p.schema,2);
  assert.equal(p.positions['LBFF 5'].GODESPORTS,17);
  assert.match(p.sourceByEdition['LBFF 5'],/classificação para demais equipes/);
 }finally{a.close();}
});
test('WB 2024 F1 usa colocação calculada da classificatória e F2 só a Grande Final',async()=>{
 const a=await setup();
 try{
  const {w,state}=a,api=w.CFFHallTools,positions=read('ranking-data/hall-edition-placements.json');
  assert.equal(Object.keys(positions.positions['WB 2024 F1']).length,18);
  assert.equal(Object.keys(positions.positions['WB 2024 F2']).length,12);
  assert.equal(positions.positions['WB 2024 F1'].TEAMSOLID,1);
  assert.equal(positions.positions['WB 2024 F2'].FLUXOW7M,1);
  assert.match(positions.sourceByEdition['WB 2024 F1'],/Classificatória/);
  assert.match(positions.sourceByEdition['WB 2024 F2'],/Grande Final/);
  const bops=state.rows.find(r=>r.name.toUpperCase()==='BOPS'&&r.edition==='WB 2024 F2');
  assert(bops&&api.recordValue(bops,'position')===1);
  const stillMissing=state.rows.find(r=>r.edition==='WB 2024 F2'&&r.team==='MAGIC SQUAD');
  if(stillMissing)assert.equal(api.recordValue(stillMissing,'position'),null,'Não buscar tabela da classificatória para F2');
 }finally{a.close();}
});
test('colunas de carreira somam todos os splits uma só vez, preservando seleções de edição',async()=>{
 const a=await setup();
 try{
  const {state,w}=a,api=w.CFFHallTools;
  const bops=state.rows.find(r=>r.name.toUpperCase()==='BOPS'),records=state.rows.filter(r=>r.key===bops.key);
  const expectedKills=records.reduce((v,r)=>v+r.kills,0),expectedDrops=records.reduce((v,r)=>v+r.matches,0);
  const stats=state.career.get(bops.key);
  assert.equal(stats.careerMatches,expectedDrops);
  assert.equal(stats.careerEditions,records.length);
  assert(Math.abs(stats.careerAvg-expectedKills/expectedDrops)<1e-10);
  assert(stats.allTeams.includes('CORINTHIANS'));
  assert(stats.careerYears.includes('2024'));
  assert.equal(stats.careerTitles,3);
  assert.equal(api.recordValue(bops,'careerMatches'),expectedDrops);
  assert.equal(api.recordValue(bops,'careerEditions'),records.length);
  assert.equal(api.recordValue(bops,'careerTitles'),3);
  assert.equal(state.fields.filter(f=>f.active).length,8);
  assert.equal(state.fields.filter(f=>f.career).length,6);
  const options=w.document.querySelector('#hall-export-career-all');
  options.checked=true;
  options.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(state.fields.filter(f=>f.active).length,14);
  const preview=w.document.querySelector('#hall-export-preview-head');
  assert.match(preview.innerHTML,/Todas equipes/);
  assert.match(preview.innerHTML,/Edições jogadas/);
  state.chosen=new Set([bops.key]);
  state.chosenEditions=new Set(['LBFF 5']);
  const filtered=api.sortedRows();
  assert.equal(filtered.length,1);
  assert.equal(api.recordValue(filtered[0],'careerMatches'),expectedDrops,'Filtrar edições não reduz estatísticas da carreira');
 }finally{a.close();}
});
test('prévia mostra todas as linhas por páginas e respeita 10, 25, 50 ou 100',async()=>{
 const a=await setup();
 try{
  const {state,w}=a,api=w.CFFHallTools;
  state.chosen=new Set(['BOPS','CAUAN7','MT7']);
  api.renderPreview();
  const table=w.document.querySelectorAll('#hall-export-preview-body tr');
  assert.equal(table.length,10);
  assert.match(w.document.querySelector('#hall-export-preview-page').textContent,/Linhas 1–10/);
  w.document.querySelector('#hall-export-preview-next').click();
  assert.match(w.document.querySelector('#hall-export-preview-page').textContent,/Linhas 11–20/);
  const picker=w.document.querySelector('#hall-export-preview-page-size');
  picker.value='25';picker.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(w.document.querySelectorAll('#hall-export-preview-body tr').length,25);
  assert.match(w.document.querySelector('#hall-export-preview-page').textContent,/Linhas 1–25/);
  picker.value='100';picker.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(w.document.querySelectorAll('#hall-export-preview-body tr').length,api.sortedRows().length);
  assert(w.document.querySelector('#hall-export-preview-next').disabled);
 }finally{a.close();}
});
