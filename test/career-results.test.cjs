const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const manifest=read('career-data/results/manifest.json');
const snapshot=id=>read('career-data/results/'+manifest.teams[id]);
const competition=(id,name,family='LBFF')=>({id,name,family});
const tenure=(extra={})=>({id:'t1',role:'coach',teamId:'teamliquid',teamName:'TEAM LIQUID',start:{},end:{},competitions:[competition('lbff1','LBFF 1'),competition('lbff3','LBFF 3')],...extra});
test('snapshots are deterministic, retain distinct W7M identities and never turn absent statistics into zero',()=>{
 execFileSync('python3',['scripts/build-career-results.py','--check'],{cwd:root});
 assert.notEqual(manifest.aliases.w7mesports,manifest.aliases.fluxow7m);
 const w7m=snapshot('w7mesports').editions.find(e=>e.id==='ffwsbr2025s1');assert.equal(w7m.stages.find(s=>s.isFinal).position,10);
 const loud=snapshot('loudsnickers'),s1=loud.editions.find(e=>e.id==='ffwsbr2026s1');assert.equal(s1.stages.find(s=>s.isFinal).position,1);assert(s1.stages.find(s=>s.isFinal).champion);
 const s2=loud.editions.find(e=>e.id==='ffwsbr2026s2');assert.equal(s2.stages.length,3);assert.equal(s2.stages.find(s=>s.isFinal).position,2);assert.equal(s2.stages.find(s=>s.id==='segundaFase').points,540);assert.equal(s2.stages.find(s=>s.isFinal).matches,13);assert(!s2.stages.some(s=>s.champion));assert(s2.staff.some(p=>p.name==='JOKER (coach)'));
 const lbff9=loud.editions.find(e=>e.id==='lbff9');assert(!Object.hasOwn(lbff9.stages.find(s=>s.isFinal),'kills'));assert(!Object.hasOwn(lbff9.stages.find(s=>s.isFinal),'booyahs'));
 for(const id of ['ffwsbr2024s1','ffwsbr2024s2'])assert(!loud.editions.find(e=>e.id===id).stages.some(s=>s.champion));
 const liquid=snapshot('teamliquid');assert(liquid.editions.find(e=>e.id==='lbff1').stages.some(s=>s.champion));
 assert(liquid.editions.find(e=>e.id==='lbff1').staff.some(p=>p.name==='Souto'));
});
test('only confirmed staff editions contribute, repeated passages and former-player achievements are not double counted',async()=>{
 const m=await import('../js/career-results.mjs');
 const p={tenures:[tenure(),tenure({id:'repeat'}),tenure({role:'player',competitions:[competition('lbff4','LBFF 4')]}),tenure({deleted:true,competitions:[competition('lbff8','LBFF 8')]})]};
 const rows=m.linkCoachResults(p,manifest,new Map([['teamliquid',snapshot('teamliquid')]]));
 assert.equal(rows.length,2);assert.equal(rows[0].tenures.length,2);assert.deepEqual(m.coachSummary(rows),{editions:2,finals:1,titles:1,international:0});
 const changed=m.linkCoachResults({tenures:[tenure({competitions:[]})]},manifest,new Map());assert.equal(changed.length,0);
});
test('a departure before the final does not acquire the teams championship; partial and imprecise dates remain explicit',async()=>{
 const m=await import('../js/career-results.mjs');
 const event=snapshot('loudsnickers').editions.find(e=>e.id==='ffwsbr2026s1');
 const t=tenure({teamId:'loudsnickers',teamName:'LOUD',end:{date:'2026-04-01'},competitions:[competition(event.id,event.name,'FFWS_BR')]});
 const rows=m.linkCoachResults({tenures:[t]},manifest,new Map([['loudsnickers',snapshot('loudsnickers')]]));
 assert(rows[0].periods[0].partial);assert.deepEqual(m.coachSummary(rows),{editions:1,finals:0,titles:0,international:0});
 assert(m.participationPeriod({...t,end:{date:'2026-05'}},event).awardEligible);
 assert(!m.participationPeriod({...t,end:{date:'2026-04'}},event).awardEligible);
 assert(m.participationPeriod({...t,end:{},start:{date:'2026-07-01'}},event).outside);
 assert.equal(m.participationPeriod(tenure(),event).label,'Participação registrada nesta edição');
 const unknown=m.linkCoachResults({tenures:[tenure({competitions:[competition('custom','Mundial 2025','MUNDIAL')]})]},manifest,new Map());
 assert.deepEqual(m.coachSummary(unknown),{editions:1,finals:0,titles:0,international:1});
});
async function fixture(person,fetcher){
 const client=await import('../js/career-client.mjs'),dom=new JSDOM('<main id="root"></main>',{url:'https://centralfreefire.com.br/test',runScripts:'outside-only'}),w=dom.window,calls=[];
 Object.assign(w,{esc:client.esc,ROLES:client.ROLES,STATUSES:client.STATUSES,teamHref:client.teamHref,personHref:client.personHref,periodLabel:client.periodLabel,careerTrail:client.careerTrail,orderedTenures:client.orderedTenures,competitionPeriodLabel:client.competitionPeriodLabel,tenureCards:client.tenureCards,
  readCareer:async()=>({person}),AbortSignal,fetch:async(url,options)=>{calls.push(String(url));return fetcher?fetcher(url,options):{ok:true,json:async()=>read(String(url).split('?')[0].replace(/^\//,''))};}});
 w.eval(fs.readFileSync(path.join(root,'js/career-results.mjs'),'utf8').replace(/^import .*\n/gm,'').replace(/^export /gm,'')+'\nwindow.mountCoachResults=mountCoachResults;');
 return {w,calls,dom,body:w.document.querySelector('#root'),close:()=>w.close()};
}
test('results download only associated teams once, filter locally and preserve roster escaping and missing data',async()=>{
 const p={id:'souto',tenures:[tenure(),tenure({id:'missing',competitions:[competition('absent','Edição <script>alert(1)</script>')]})]};
 const f=await fixture(p);try{
  f.body.innerHTML='<details data-career-results open><div data-career-results-body></div></details>';const panel=f.body.firstChild;
  await Promise.all([f.w.mountCoachResults(panel,p),f.w.mountCoachResults(panel,p)]);
  assert.equal(f.calls.length,2);assert.equal(f.calls[0],'/career-data/results/manifest.json');assert(f.calls[1].includes('teamliquid-'));
  assert(f.calls.every(u=>!u.includes('workers.dev')&&!u.includes('career-seed')&&!u.includes('passagens')));
  assert.equal(f.body.querySelectorAll('.career-results-edition').length,3);assert([...f.body.querySelectorAll('.career-results-edition')].every(d=>!d.open));
  assert(!f.body.querySelector('script'));assert(f.body.textContent.includes('Resultado ainda não cadastrado'));
  const select=f.body.querySelector('[data-results-filter="year"]');select.value='2020';select.dispatchEvent(new f.w.Event('change',{bubbles:true}));assert.equal(f.body.querySelectorAll('.career-results-edition').length,2);
  const roster=f.body.querySelector('.career-results-roster');assert(roster);assert(!roster.open);assert(roster.textContent.includes('Souto'));assert(roster.textContent.includes('LUUUKING'));
  await f.w.mountCoachResults(panel,p);assert.equal(f.calls.length,2);
 }finally{f.close();}
});
test('failed static downloads offer an explicit retry and coalesced successful files are retained',async()=>{
 let fails=true;const p={tenures:[tenure()]};const f=await fixture(p,async url=>{
  if(fails&&String(url).includes('teamliquid-'))return {ok:false};
  return {ok:true,json:async()=>read(String(url).replace(/^\//,''))};
 });try{
  f.body.innerHTML='<details data-career-results open><div data-career-results-body></div></details>';const panel=f.body.firstChild;
  await f.w.mountCoachResults(panel,p);assert(f.body.textContent.includes('totais de finais e títulos estão incompletos'));assert.equal(f.calls.length,2);
  fails=false;f.body.querySelector('button').click();for(let i=0;i<8;i++)await new Promise(r=>setTimeout(r,0));
  assert.equal(f.calls.length,3);assert(!f.body.textContent.includes('incompletos'));assert(f.body.querySelector('.career-results-roster'));
 }finally{f.close();}
});
test('the public profile inserts lazy result tabs without fetching snapshots, retains it on redraw and excludes pure players',async()=>{
 const p={id:'souto',name:'Souto',kind:'staff',current:[],tenures:[tenure()],availability:'unknown'};const f=await fixture(p);
 try{
  f.w.eval(fs.readFileSync(path.join(root,'js/career-public.js'),'utf8').replace(/^import .*\n/gm,'').replace(/^export /gm,''));
  await f.w.mountPersonCareer(f.body,{id:'souto'},{standalone:true});const panel=f.body.querySelector('[data-career-results]');assert(panel);assert(panel.closest('[role=tabpanel]').hidden);assert.equal(f.body.querySelectorAll('[role=tab]').length,4);assert.equal(f.calls.length,0);f.body.querySelector('[data-profile-tab=career]').click();assert(!f.body.querySelector('[data-profile-panel=career]').hidden);assert([...f.body.querySelectorAll('.career-pro-tenure')].every(d=>!d.open));assert(!f.body.querySelector('.career-pro-stats-link'));assert.equal(f.calls.length,0);
  await f.w.mountPersonCareer(f.body,{id:'souto'},{standalone:true});assert.equal(f.body.querySelector('[data-career-results]'),panel);
  p.tenures[0].role='player';await f.w.mountPersonCareer(f.body,{id:'souto'},{standalone:true});assert(!f.body.querySelector('[data-career-results]'));assert.equal(f.calls.length,0);
 }finally{f.close();}
});

test('profile tabs fetch only relevant static files on demand, share downloads across awards and exclude athlete titles',async()=>{
 const p={id:'joker-coach',name:'JOKER (coach)',kind:'staff',availability:'active',current:[],tenures:[tenure({teamId:'loudsnickers',teamName:'LOUD SNICKERS',competitions:[competition('ffwsbr2026s2','FFWS BR 2026 S2','FFWS_BR')]}),tenure({id:'athlete',teamId:'teamliquid',role:'player'})]};
 const f=await fixture(p);try{
  const source=fs.readFileSync(path.join(root,'js/career-public.js'),'utf8').replace(/^import .*\n/gm,'').replace(/^export /gm,'').replace(/await import\('\.\/career-results\.mjs\?v=[^']+'\)/g,'await Promise.resolve({mountCoachResults:window.mountCoachResults})');
  f.w.eval(source);await f.w.mountPersonCareer(f.body,{id:p.id},{standalone:true});assert.equal(f.calls.length,0);
  const click=async id=>{f.body.querySelector('[data-profile-tab='+id+']').click();for(let i=0;i<8;i++)await new Promise(r=>setTimeout(r,0));};
  await click('competitions');assert.equal(f.calls.length,2);assert(f.calls[1].includes('loudsnickers-'));assert(!f.calls.some(u=>u.includes('teamliquid-')));
  const competitions=f.body.querySelector('[data-profile-panel=competitions]');assert(!competitions.hidden);assert(competitions.textContent.includes('Segunda fase'));assert(competitions.textContent.includes('540'));assert(competitions.textContent.includes('185'));assert(competitions.querySelectorAll('.career-results-edition').length===1);
  await click('awards');assert.equal(f.calls.length,2);assert.equal(f.body.querySelector('[data-profile-panel=awards] .career-results-metrics strong').textContent,'1');
  await click('career');assert.equal(f.calls.length,2);assert(f.body.querySelector('[data-profile-panel=competitions]').hidden);
  const tab=f.body.querySelector('[data-profile-tab=career]');tab.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));assert.equal(f.body.querySelector('[data-profile-tab=overview]').getAttribute('aria-selected'),'true');
 }finally{f.close();}
});
