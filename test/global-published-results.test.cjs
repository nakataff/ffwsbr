const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const C=require('../js/global-camp-core'),meta=require('../ffws-global-2026/camp-model.json');
const json=name=>JSON.parse(fs.readFileSync('ffws-global-2026/'+name+'.json','utf8'));
const makeRound=(key,kills)=>{
 const participants=C.entrants(key,{},meta),drop=C.emptyDrop(participants);
 participants.forEach((id,i)=>{drop.placements[id]=i+1;drop.kills[id]=i?0:kills;drop.points[id]=[12,9,8,7,6,5,4,3,2,1,0,0][i]+drop.kills[id];});
 drop.map='Bermuda';
 return C.validate({key,participants,drops:[drop],players:[]},meta);
};
const fixture={'classificatoria-1':makeRound('classificatoria-1',7),'classificatoria-2':makeRound('classificatoria-2',2)};
test('Classificatória and Stats share published scores, preserve session filters, and do not invent individual data',async()=>{
 const body=['classificatoria','segunda-fase','stats'].map(page=>`<section class="page" id="ffws-global-2026-${page}"><div id="ffws-global-2026-${page}-content"></div></section>`).join('');
 const w=new JSDOM(body,{url:'https://centralfreefire.com.br/index.html',runScripts:'outside-only'}).window;
 let calls=0,fail=false,published=process.env.CFF_WORLD_LIVE_FIXTURE?JSON.parse(fs.readFileSync(process.env.CFF_WORLD_LIVE_FIXTURE)):fixture;
 try{
  w.CFF_CONFIG={firebase:{databaseURL:'https://fixture.invalid/'}};
  w.requestAnimationFrame=()=>0;
  w.fetch=async url=>{const path=String(url);if(path.includes('fixture.invalid')){calls++;assert.match(path,/\/ffwsLive\/global-2026\/rounds\.json$/);return {ok:!fail,json:async()=>published};}
   const name=path.split('/').at(-1).split('.')[0],data=json(name);
   if(name==='stages')Object.assign(data.classificatoria,{rounds:[],rows:[],finished:false});
   return {ok:true,json:async()=>data};
  };
  const source=fs.readFileSync('ffws-global-2026/global.js','utf8').replace("  if (document.readyState === 'loading')","  window.__resultTest={state,loadData,loadLiveResults,stageEvents,renderPage,aggregateStatsTeams,statsStageEvents,statsTeamStandings};\n  if (document.readyState === 'loading')");
  w.eval(source);
  const api=w.__resultTest,d=w.document;
  await api.loadData();await Promise.all([api.loadLiveResults(),api.loadLiveResults()]);await api.loadLiveResults();
  assert.equal(calls,1);
  api.renderPage('ffws-global-2026-classificatoria');api.renderPage('ffws-global-2026-stats');
  const classRoot=d.querySelector('#ffws-global-2026-classificatoria-content'),statsRoot=d.querySelector('#ffws-global-2026-stats-content');
  const winner=C.rank(Object.values(published),meta)[0];
  const first=classRoot.querySelector('tbody tr');
  assert(first.textContent.includes(winner.name));
  assert.equal(Number(first.querySelector('.ffws-global-points-col').textContent),winner.points);
  const bands=['pool-1','pool-2','pool-3','pool-4','repechage','eliminated'];
  const legend=[...classRoot.querySelectorAll('.ffws-global-pool-legend li')];
  assert.equal(legend.length,6);
  assert.deepEqual(legend.map(item=>item.querySelector('b').textContent),['1º–12º · Pool 1','13º–14º · Pool 2','15º–16º · Pool 3','17º–18º · Pool 4','19º–20º · Repescagem','21º–24º · Eliminação']);
  assert.deepEqual(bands.map((band,i)=>[classRoot.querySelectorAll('tbody .ffws-global-band-'+band).length,legend[i].classList.contains('ffws-global-band-'+band)]),[[12,true],[2,true],[2,true],[2,true],[2,true],[4,true]]);
  assert(statsRoot.querySelector('#anchor-s2-totais-equipe'));
  assert(statsRoot.querySelector('#anchor-s2-medias-equipe'));
  assert(statsRoot.querySelector('#anchor-s2-rec-day-team'));
  assert(!statsRoot.querySelector('#anchor-s2-totais-jogador'));
  assert.match(statsRoot.textContent,/estatísticas individuais serão exibidas/);
  assert(!statsRoot.textContent.includes('Mais Dano em uma Queda'));
  const filters=statsRoot.querySelector('#anchor-s2-filtros');
  assert.equal(filters.querySelectorAll('select').length,1);
  assert.equal(filters.querySelector('select').options.length,5);
  assert.equal(filters.querySelectorAll('[data-global-multi]').length,2);
  assert.equal(filters.querySelectorAll('button[onclick*="setFFWSGlobalStatsStage"]').length,0);
  if(published===fixture){
   assert.deepEqual(Array.from(api.stageEvents('classificatoria'),e=>[e.day,e.round,e.roundDrop,e.drop]),[[1,1,1,1],[1,2,1,7]]);
   const rounds=[...statsRoot.querySelectorAll('.ffws-global-drop-round')];
   assert.equal(rounds.length,2);
   assert.match(rounds[0].querySelector('h3').textContent,/Rodada 1.*Grupos A × B.*04h00/);
   assert.match(rounds[1].querySelector('h3').textContent,/Rodada 2.*Grupos C × D.*09h00/);
   assert.equal(rounds[0].querySelector('button span').textContent,'Q1');
   assert.equal(rounds[1].querySelector('button span').textContent,'Q1');
   w.openFFWSGlobalDropReport('classificatoria:1:1');
   const report=d.querySelector('#ffws-global-drop-report-body');
   assert.match(report.querySelector('.ffws-global-drop-report-navbtn').textContent,/D1 • R2 • Q1/);
   w.openFFWSGlobalDropReport('classificatoria:1:7');
   assert.match(report.querySelector('.ffws-global-drop-report-title').textContent,/DIA 1 • RODADA 2 • QUEDA 1/);
   assert.match(report.querySelector('.ffws-global-drop-booyah').textContent,new RegExp(C.team(meta,fixture['classificatoria-2'].participants[0]).name));
   w.openFFWSGlobalDayReport('classificatoria',1);
   assert.match(report.querySelector('.ffws-global-drop-report-title').textContent,/DIA 1 • 2 QUEDAS/);
   w.closeFFWSGlobalDropReport();
   w.setFFWSGlobalStatsMulti('days','1',true);
   w.setFFWSGlobalStatsMulti('maps','Bermuda',true);
   statsRoot.querySelector('#ffws-global-stats-stage').focus();
   w.setFFWSGlobalStatsStage('geral');
   const stage=statsRoot.querySelector('#ffws-global-stats-stage');
   assert.equal(stage.value,'geral');
   assert.equal(stage.selectedOptions[0].textContent,'Todas as fases');
   assert.equal(stage,d.activeElement);
   assert.equal(api.state.statsFilters.days.length,0);
   assert.equal(api.state.statsFilters.maps.length,0);
   w.setFFWSGlobalStatsStage('classificatoria');
   w.setFFWSGlobalStageFilter('classificatoria','period','2');
   assert.equal(classRoot.querySelectorAll('tbody tr').length,12);
   assert(!classRoot.querySelector('.ffws-global-pool-legend,.ffws-global-pool-band'));
   assert.equal(Number(classRoot.querySelector('tbody .ffws-global-points-col').textContent),14);
   const teams=api.aggregateStatsTeams(api.statsStageEvents('classificatoria'));
   assert.equal(teams.reduce((total,row)=>total+row.points,0),123);
   published={...fixture,'classificatoria-1':makeRound('classificatoria-1',8)};
   await api.loadLiveResults(true);
   assert.equal(api.stageEvents('classificatoria').length,2);
   assert.equal(api.stageEvents('classificatoria')[0].results[0].points,20);
  }
  if(!process.env.CFF_WORLD_LIVE_FIXTURE){
   // The same live drops must not replace or duplicate the official workbook,
   // and a newer live-only round still extends the static archive.
   api.state.stages=json('stages');
   const standings=api.statsTeamStandings({stage:'classificatoria',days:['1'],maps:['Bermuda']});
   assert.equal(standings.FLUXOW7M.position,3,'day and map filters do not change the official phase table');
   assert.equal(Object.keys(api.statsTeamStandings({stage:'geral',days:[]})).length,0);
   assert.equal(Object.keys(api.statsTeamStandings({stage:'segundaFase',days:['1','2']})).length,0);
   api.state.stages.final.rows=[{team:'LOUD',position:1,points:125},{team:'LOS',position:2,points:145}];
   assert.equal(api.statsTeamStandings({stage:'final',days:[]}).LOUD.position,1,'use the official Champion Rush result');
   const officialDrops=api.stageEvents('classificatoria').length;
   assert.equal(officialDrops,api.state.stages.classificatoria.rounds.length);
   const archived=api.stageEvents('classificatoria')[0];
   assert.equal(archived.results.find(row=>row.team==='LOUD').points,22);
   const nextKey='segundaFase-1';
   published={...published,[nextKey]:makeRound(nextKey,7)};
   await api.loadLiveResults(true);
   const merged=api.stageEvents('classificatoria');
   assert.equal(merged.length,officialDrops);
   assert.equal(api.stageEvents('segundaFase').length,1);
   api.renderPage('ffws-global-2026-segunda-fase');
   assert.match(d.querySelector('#ffws-global-2026-segunda-fase-content').textContent,/Equipes por rodada/);
   assert.equal(merged[0],archived);
  }
  fail=true;const count=api.stageEvents('classificatoria').length;
  await api.loadLiveResults(true);assert.equal(api.stageEvents('classificatoria').length,count);
 }finally{w.close();}
});

test('team chart filters real drops, formats labels, and applies the chosen team color',async()=>{
 const dom=new JSDOM('<main id="ffws-global-2026-stats-content"></main>',{
  url:'https://centralfreefire.com.br/ffws-global-2026/stats/',runScripts:'dangerously'
 });
 const w=dom.window;
 const draws=[];
 try{
  w.requestAnimationFrame=()=>0;
  w.HTMLCanvasElement.prototype.getContext=()=>({});
  w.Chart=function(_ctx,config){draws.push(config);this.data=config.data;this.update=()=>{};this.destroy=()=>{};};
  w.eval(fs.readFileSync('ffws-global-2026/global.js','utf8').replace("  if (document.readyState === 'loading')",
   "  window.__evolution={state,renderStats,renderS2StatsEvolutionChart};\n  if (document.readyState === 'loading')"));
  const {state,renderStats,renderS2StatsEvolutionChart}=w.__evolution;
  const [teams,stages]=['teams','stages'].map(name=>JSON.parse(fs.readFileSync('ffws-global-2026/'+name+'.json','utf8')));
  stages.classificatoria.rounds=stages.classificatoria.rounds.filter(round=>round.day<=5);
  state.teams=teams.teams;
  state.stages=stages;
  state.statsEvolution.teams=['LOUD'];
  const root=w.document.getElementById('ffws-global-2026-stats-content');
  const section=()=>root.querySelector('#anchor-s2-evolucao');
  const field=name=>section().querySelector(`[data-evolution-field="${name}"]`);
  const select=(name,value)=>{
   const control=field(name);
   control.value=value;
   control.dispatchEvent(new w.Event('change'));
  };
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  renderStats();
  renderS2StatsEvolutionChart();
  await settle();
  assert.equal(draws.at(-1).data.labels.length,5);
  select('view','drop');
  await settle();
  assert.equal(draws.at(-1).data.labels.length,60);
  select('day','classificatoria:5');
  assert.equal(field('drop').options.length,13);
  assert.equal(field('drop').options[7].textContent,'Rodada 2 · Queda 1');
  select('drop','1');
  select('metric','points');
  await settle();
  assert.deepEqual(Array.from(draws.at(-1).data.datasets[0].data),[32]);
  const swatch=section().querySelector('input[type=color]');
  swatch.value='#ff6600';
  swatch.dispatchEvent(new w.Event('input'));
  const show=section().querySelector('input[type=checkbox]');
  show.click();
  await settle();
  const chart=draws.at(-1);
  assert.equal(chart.data.datasets[0].borderColor,'#ff6600');
  assert.equal(chart.options.interaction.mode,'index','a tooltip lists all teams for a day or drop');
  assert.equal(chart.options.scales.x.offset,true,'a single drop is centered');
  const painted=[];
  chart.plugins[0].afterDatasetsDraw({
   data:chart.data,chartArea:{left:10,right:480,top:45,bottom:315},
   isDatasetVisible:()=>true,getDatasetMeta:()=>({data:[{x:200,y:97,skip:false}]}),
   ctx:{save(){},restore(){},strokeText(){},measureText:()=>({width:36}),fillText:text=>painted.push(text)}
  });
  assert.deepEqual(painted,['32 PTS']);
  const markers=section().querySelector('.ffws-global-evolution-markers select');
  assert.deepEqual(Array.from(markers.options,o=>o.value),['dot','crest','above']);
  assert.equal(markers.value,'dot');
  show.click();
  const logo=section().querySelector('#ffws-global-evolution-team-buttons button[title="LOUD"] img');
  Object.defineProperties(logo,{complete:{value:true},naturalWidth:{value:64},naturalHeight:{value:48}});
  const renderMarkers=async mode=>{
   markers.value=mode;
   markers.dispatchEvent(new w.Event('change'));
   await settle();
   const current=draws.at(-1), output={icons:[],labels:[],circles:[]};
   current.plugins[0]?.afterDatasetsDraw({
    data:current.data,chartArea:{left:10,right:480,top:45,bottom:315},
    isDatasetVisible:()=>true,getDatasetMeta:()=>({data:[{x:200,y:97,skip:false}]}),
    ctx:{save(){},restore(){},beginPath(){},arc:(x,y,radius)=>output.circles.push({x,y,radius}),fill(){},stroke(){},strokeText(){},
     drawImage:(image,x,y,width,height)=>output.icons.push({image,x:x+width/2,y:y+height/2,width,height}),
     measureText:()=>({width:36}),fillText:(text,x,y)=>output.labels.push({text,x,y})}
   });
   return output;
  };
  const crest=await renderMarkers('crest');
  assert.deepEqual(crest,{icons:[{image:logo,x:200,y:97,width:14,height:10.5}],labels:[],circles:[{x:200,y:97,radius:9}]});
  const above=await renderMarkers('above');
  assert.equal(above.icons[0].image,logo);
  assert.equal(above.labels[0].text,'32 PTS');
  assert.equal(above.icons[0].width,24);
  assert(above.icons[0].y+above.icons[0].height/2<above.labels[0].y-7);
  assert.deepEqual(above.circles,[]);
  assert(show.checked&&show.disabled);
  assert.deepEqual(await renderMarkers('dot'),{icons:[],labels:[],circles:[]});
  assert(!show.checked&&!show.disabled);
  select('metric','position');
  await settle();
  assert.deepEqual(Array.from(draws.at(-1).data.datasets[0].data),[1]);
  select('day','');
  assert.equal(field('drop').value,'');
  await settle();
  assert.equal(draws.at(-1).data.labels.length,60);
 }finally{w.close();}
});

test('close and tied team results keep every crest and label tied to its true data point',()=>{
 const w=new JSDOM('',{url:'https://centralfreefire.com.br/ffws-global-2026/stats/',runScripts:'outside-only'}).window;
 try{
  w.eval(fs.readFileSync('ffws-global-2026/global.js','utf8').replace("  if (document.readyState === 'loading')",
   "  window.evolutionLabels=s2StatsEvolutionLabels;\n  if (document.readyState === 'loading')"));
  const colors=['#ff9900','#ad34b1','#00ff57','#09f','#f9d'];
  const datasets=colors.map((borderColor,i)=>({borderColor,data:[72+Math.floor(i/2),81+Math.floor(i/2)]}));
  const images=colors.map(color=>({color,complete:true,naturalWidth:24,naturalHeight:24}));
  for(const width of [195,720]) for(const mode of ['above','crest']){
   const marks=[],guides=[],circles=[];
   const chartArea={left:10,right:10+width,top:45,bottom:330};
   const coord=i=>[{x:10+width/4,y:49+i*2},{x:10+width*3/4,y:326-i*2}];
   const ctx={save(){},restore(){},beginPath(){},arc:(...coords)=>circles.push(coords),fill(){},stroke(){},strokeText(){},
    moveTo:(x,y)=>guides.push({x,y}),lineTo(){},measureText:()=>({width:62}),
    drawImage:(image,x,y,w,h)=>marks.push({image,x,y,w,h}),
    fillText(text,x,y){marks.push({text,color:this.fillStyle,x,y});}};
   w.evolutionLabels('kills',mode==='above',mode,images).afterDatasetsDraw({ctx,chartArea,data:{datasets},
    isDatasetVisible:()=>true,getDatasetMeta:i=>({data:coord(i)})});
   assert.equal(marks.filter(item=>item.image).length,10);
   assert.equal(guides.length,10);
   for(let i=0;i<colors.length;i++)for(const point of coord(i))assert(guides.some(g=>g.x===point.x&&g.y===point.y));
   if(mode==='crest'){assert.equal(circles.length,10);continue;}
   assert.equal(circles.length,0);
   assert.equal(marks.length,20);
   const boxes=[];
   for(let i=0;i<marks.length;i+=2){
    const [icon,label]=marks.slice(i,i+2);
    assert.equal(icon.image.color,label.color);
    assert(icon.y+icon.h<label.y-7);
    const box={left:label.x-31,right:label.x+31,top:icon.y,bottom:label.y+7};
    assert(box.top>=chartArea.top&&box.bottom<=chartArea.bottom);
    assert(!boxes.some(b=>box.left<b.right&&box.right>b.left&&box.top<b.bottom&&box.bottom>b.top));
    boxes.push(box);
   }
  }
 }finally{w.close();}
});
