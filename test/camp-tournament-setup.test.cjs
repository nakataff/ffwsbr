const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),{JSDOM}=require('jsdom');
const copy=x=>JSON.parse(JSON.stringify(x));
const phase=(id,format='classic')=>({id,name:id,teams:2,advance:1,days:1,firstDrops:2,laterDrops:2,format,cp:110,lastDate:'2026-10-25',unlimited:false,completed:false,eliminated:[]});
function harness(){
 const html=fs.readFileSync('admin-camp-ao-vivo.html','utf8').replace(/<script\b[\s\S]*?<\/script>/g,'');
 const d=new JSDOM(html,{url:'https://centralfreefire.com.br/',runScripts:'outside-only',pretendToBeVisual:true}),w=d.window;
 const a=phase('Qualificatória','champion'),b={...phase('Final'),teams:1,advance:0};
 let data={config:{tournamentName:'Teste',quedas:2,cffTournamentPhasesV1:{version:1,activeId:a.id,phases:[a,b]}},selectedTeams:['A','B'],drops:[{points:{A:110,B:300},kills:{A:0,B:0}},{points:{A:12,B:0},kills:{A:0,B:0},booyah:'A'}],tournamentModeV1:{enabled:true,rosterCodes:['A','B'],days:[],draftDayNumber:1,config:{teamsPerRound:2}}};
 const messages=[],applied=[];let fail=false;
 w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.autoSave=()=>{};w.collectBackupData=()=>copy(data);w.importBackup=()=>{data=JSON.parse(w.document.getElementById('backup-input').value)};
 w.CFF_CAMP={toast:(...args)=>messages.push(args),applyBackupText:async text=>{applied.push(JSON.parse(text));if(fail)throw new Error('Falha simulada');data=JSON.parse(text)}};w.v76TournamentMode={getState:()=>copy(data.tournamentModeV1)};
 w.eval(fs.readFileSync('admin-camp-ao-vivo/tournament-setup.js','utf8'));
 return {w,messages,applied,fail:()=>{fail=true},get data(){return data}};
}
test('phase UI collapses inactive phases, separates finishing and toggles Champion settings without replacing inputs',()=>{
 const h=harness(),w=h.w;try{const active=w.document.querySelector('.cff-phase.active');assert(active.open);assert(!w.document.querySelector('.cff-phase:not(.active)').open);assert(!active.querySelector('.cff-phase-finish').open);const select=active.querySelector('[data-field=format]'),name=active.querySelector('[data-field=name]');select.value='classic';select.dispatchEvent(new w.Event('change',{bubbles:true}));assert([...active.querySelectorAll('[data-champion-field]')].every(e=>e.hidden));assert.equal(active.querySelector('[data-field=name]'),name)}finally{w.close()}
});
test('invalid qualification count cannot replace the current tournament',async()=>{
 const h=harness(),w=h.w;try{const field=w.document.querySelector('.active [data-field=advance]');field.value='3';field.dispatchEvent(new w.Event('change',{bubbles:true}));await w.CFF_TOURNAMENT_SETUP.applyPhase();assert.equal(h.applied.length,0);assert.match(h.messages.at(-1)[0],/maior/);assert.equal(w.CFF_TOURNAMENT_SETUP.getPlan().activeId,'Qualificatória');assert(!w.document.querySelector('[data-phase-apply]').disabled)}finally{w.close()}
});
test('phase transition uses source Champion Rush rules, preserves a snapshot and restores saved results',async()=>{
 const h=harness(),w=h.w;try{await w.CFF_TOURNAMENT_SETUP.openPhase('Final');assert.deepEqual(h.applied[0].selectedTeams,['A']);assert(h.applied[0].drops.every(drop=>drop.points.A===null));const plan=w.CFF_TOURNAMENT_SETUP.getPlan();assert.equal(plan.activeId,'Final');assert.equal(plan.phases[0].snapshot.drops[0].points.B,300);assert.equal(JSON.parse(w.localStorage.getItem('cff_camp_before_phase_change_v1')).backup.drops[0].points.A,110);await w.CFF_TOURNAMENT_SETUP.openPhase('Qualificatória');assert.equal(h.applied[1].drops[0].points.B,300);assert.deepEqual(h.applied[1].selectedTeams,['A','B'])}finally{w.close()}
});
test('failed transition rolls back the active phase and completion flags',async()=>{
 const h=harness(),w=h.w;try{h.fail();await w.CFF_TOURNAMENT_SETUP.advance();const plan=w.CFF_TOURNAMENT_SETUP.getPlan();assert.equal(plan.activeId,'Qualificatória');assert.equal(plan.phases[0].completed,false);assert.deepEqual(Array.from(plan.phases[0].eliminated),[]);assert.match(h.messages.at(-1)[0],/Falha simulada/);assert(!w.document.querySelector('[data-phase-apply]').disabled)}finally{w.close()}
});
test('malformed recovery JSON and missing FFWS integration produce messages instead of uncaught errors',()=>{
 const h=harness(),w=h.w;try{w.localStorage.setItem('cff_camp_before_phase_change_v1','{broken');w.document.getElementById('cff-phase-recover').click();assert.match(h.messages.at(-1)[0],/Não foi possível ler/);w.document.getElementById('cff-final-import').click();assert.match(h.messages.at(-1)[0],/Integração FFWS indisponível/)}finally{w.close()}
});

test('all teams can advance from a phase without eliminations, such as Point Rush',async()=>{
 const h=harness(),w=h.w;try{
  const change=(selector,value)=>{const field=w.document.querySelector(selector);field.value=value;field.dispatchEvent(new w.Event('change',{bubbles:true}))};
  change('.active [data-field=advance]','2');change('.cff-phase:not(.active) [data-field=teams]','2');
  await w.CFF_TOURNAMENT_SETUP.applyPhase();assert.equal(h.applied.length,1);
  await w.CFF_TOURNAMENT_SETUP.advance();assert.equal(w.CFF_TOURNAMENT_SETUP.getPlan().activeId,'Final');assert.deepEqual(h.applied.at(-1).selectedTeams,['A','B']);assert.deepEqual(Array.from(w.CFF_TOURNAMENT_SETUP.getPlan().phases[0].eliminated),[]);
 }finally{w.close()}
});
