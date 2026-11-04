'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const source=fs.readFileSync('js/global-predictions.js','utf8');
async function settle(check){for(let i=0;i<90;i++){if(check())return;await new Promise(r=>setTimeout(r,6));}assert(check(),'A interface dos palpites não carregou');}
test('interface mostra 3 escolhas sem campo de abates, filtra participantes e salva os votos',async()=>{
 const dom=new JSDOM('<div id="cff-global-predictions"></div>',{url:'https://centralfreefire.com.br/interacoes.html#palpites',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;
 const cutoff=Date.now()+60*60_000;
 const teams=[{id:'loud',label:'LOUD',short:'LOUD',logo:'/loud.webp'},{id:'rrq',label:'RRQ',short:'RRQ',logo:'/rrq.webp'},{id:'lyon',label:'LYON',short:'LYON',logo:'/lyon.webp'}];
 const players=[{id:'loud-jogador',label:'Jogador LOUD',team:'LOUD'},{id:'lyon-haax',label:'Haax',team:'LYON'}];
 const round={key:'classificatoria-1',stage:'classificatoria',date:'2026-11-06',time:'04:00',closesAt:cutoff,label:'Rodada 1',groups:['A','B'],ready:true,status:'open',teams,players,result:null};
 let saved=null,postCount=0;
 const data=()=>({ok:true,round,rounds:[{...round}],linked:true,username:'teste',votes:saved||{},bonuses:{}});
 w.localStorage.setItem('cff_daily_checkin_session_v1','valid');
 w.fetch=async(url,options)=>{
  if(String(url).endsWith('/vote')){
   postCount++;
   const body=JSON.parse(options.body);
   saved={best:body.best,worst:body.worst,mvp:body.mvp};
   return {ok:true,status:200,json:async()=>({...data(),saved:true,participationAwarded:3})};
  }
  return {ok:true,status:200,json:async()=>data()};
 };
 try{
  w.eval(source);
  await settle(()=>w.document.querySelectorAll('.gfp-card').length===3);
  assert.equal(w.document.querySelectorAll('[data-gfp-search]').length,3);
  assert.equal(w.document.querySelectorAll('input[type="number"]').length,0);
  assert.equal(w.document.querySelectorAll('.gfp-round').length,1);
  const choose=(metric,query,id)=>{
   const input=w.document.querySelector('[data-gfp-search="'+metric+'"]');
   input.focus();input.value=query;input.dispatchEvent(new w.Event('input',{bubbles:true}));
   const options=[...w.document.querySelectorAll('[data-gfp-options="'+metric+'"] [data-gfp-choice]')];
   assert(options.length>=1);
   const button=options.find(x=>x.dataset.option===id);assert(button,metric+' option missing');
   button.click();
  };
  choose('best','lou','loud');
  choose('worst','rrq','rrq');
  choose('mvp','haax','lyon-haax');
  const submit=w.document.querySelector('[data-gfp-save]');
  assert(!submit.disabled);
  submit.click();
  await settle(()=>postCount===1&&w.document.querySelector('.gfp-success'));
  assert.deepEqual(saved,{best:'loud',worst:'rrq',mvp:'lyon-haax'});
  assert.equal(w.document.querySelector('.gfp-hero-meta strong').textContent,'3/3');
  assert(w.document.querySelector('.gfp-success').textContent.includes('Palpites salvos'));
 }finally{w.close();}
});
test('aba de palpites permanece visível sem depender do fim de semana da FFWS BR',()=>{
 const html=fs.readFileSync('interacoes.html','utf8');
 assert(html.includes('data-community-tab="predictions">🎯 Palpites'));
 assert(!html.includes('id="cff-global-predictions"'));
 assert(html.includes('/ffws-global-2026/palpites/'));
 const standalone=fs.readFileSync('ffws-global-2026/palpites/index.html','utf8');
 assert(standalone.includes('id="cff-global-predictions"'));
 assert(standalone.includes('global-predictions.js'));
 assert(html.includes('gfp-legacy'));
 assert(!html.includes('src="/js/global-predictions.js'));
 assert(html.includes('global-predictions.css'));
});

test('navegação agrupa 2 rodadas por data na Fase 1, setas trocam dias e outras fases ficam compactas',async()=>{
 const dom=new JSDOM('<div id="cff-global-predictions"></div>',{url:'https://centralfreefire.com.br/interacoes.html#palpites',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;
 const teamList=[{id:'loud',label:'LOUD',short:'LOUD'},{id:'rrq',label:'RRQ',short:'RRQ'}];
 const players=[{id:'loud-jogador',label:'Jogador LOUD',team:'LOUD'}];
 const t=Date.now()+48*3600_000;
 const make=(key,date,time,stage,round,groups)=>({
  key,date,time,stage,round,label:'Rodada '+round,groups,closesAt:t+(round*3_600_000),ready:true,status:'open',
  teams:teamList,players,result:null
 });
 const rounds=[
  make('classificatoria-1','2026-11-06','04:00','classificatoria',1,['A','B']),
  make('classificatoria-2','2026-11-06','09:00','classificatoria',2,['C','D']),
  make('classificatoria-3','2026-11-07','04:00','classificatoria',3,['A','C']),
  make('classificatoria-4','2026-11-07','09:00','classificatoria',4,['B','D']),
  make('segundaFase-1','2026-11-19','07:00','segundaFase',1,[]),
  make('final-1','2026-11-28','07:00','final',1,[])
 ];
 let requestCount=0;
 w.fetch=async url=>{
  requestCount++;
  const key=new URL(String(url)).searchParams.get('round')||'classificatoria-1';
  const r=rounds.find(x=>x.key===key);
  return {ok:true,status:200,json:async()=>({ok:true,round:r,rounds,linked:false,username:'',votes:{},bonuses:{}})};
 };
 try {
  w.eval(source);
  await settle(()=>w.document.querySelectorAll('.gfp-day-rounds .gfp-round').length===2);
  const getCards=()=>[...w.document.querySelectorAll('[data-gfp-round]')].map(e=>e.dataset.gfpRound);
  assert.deepEqual(getCards(),['classificatoria-1','classificatoria-2'],'não exibir todas as rodadas ao mesmo tempo');
  assert.equal(w.document.querySelectorAll('[data-gfp-day-step]').length,2);
  assert(w.document.querySelector('[data-gfp-day-step="-1"]').disabled);
  assert(!w.document.querySelector('[data-gfp-day-step="1"]').disabled);
  assert(w.document.querySelector('.gfp-day-center').textContent.includes('Dia 1 de 4'));
  assert(w.document.querySelector('.gfp-round.is-active').textContent.includes('Rodada 1'));
  w.document.querySelector('[data-gfp-round="classificatoria-2"]').click();
  await settle(()=>w.document.querySelector('[data-gfp-round="classificatoria-2"].is-active'));
  assert.deepEqual(getCards(),['classificatoria-1','classificatoria-2']);
  w.document.querySelector('[data-gfp-day-step="1"]').click();
  await settle(()=>w.document.querySelector('[data-gfp-round="classificatoria-3"].is-active'));
  assert.deepEqual(getCards(),['classificatoria-3','classificatoria-4']);
  assert(w.document.querySelector('.gfp-day-center').textContent.includes('Dia 2 de 4'));
  assert(w.document.querySelectorAll('.gfp-card').length===3);
  w.document.querySelector('[data-gfp-day-step="1"]').click();
  await settle(()=>w.document.querySelector('[data-gfp-round="segundaFase-1"].is-active'));
  assert.deepEqual(getCards(),['segundaFase-1'],'rodada única deve ocupar somente um card');
  assert(w.document.querySelector('.gfp-day-rounds.is-single'));
  w.document.querySelector('[data-gfp-day-step="-1"]').click();
  await settle(()=>w.document.querySelector('[data-gfp-round="classificatoria-3"].is-active'));
  assert.deepEqual(getCards(),['classificatoria-3','classificatoria-4']);
  assert.equal(requestCount,5);
 } finally { w.close(); }
});
test('CSS reserva duas rodadas por dia no desktop e se adapta ao mobile sem faixa com 18 cartões',()=>{
 const css=fs.readFileSync('css/global-predictions.css','utf8');
 assert(css.includes('.gfp-day-rounds{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))'));
 assert(css.includes('.gfp-day-arrow'));
 assert(css.includes('@media(max-width:650px)'));
 assert(css.includes('@media(max-width:380px)'));
 const script=fs.readFileSync('js/global-predictions.js','utf8');
 assert(script.includes("dayNavigation(d.rounds,round.key)"));
 assert(!script.includes('<nav class="gfp-round-rail"'));
});

async function accountFixture({logged=false,existing={},failOnce=false,holdSave=false}={}){
 const dom=new JSDOM('<div id="cff-global-predictions"></div>',{url:'https://centralfreefire.com.br/ffws-global-2026/palpites/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 let user=logged?{uid:'alice'}:null,saved=existing,post=0,release;const requests=[];
 const teams=[{id:'loud',label:'LOUD',short:'LOUD'},{id:'rrq',label:'RRQ',short:'RRQ'},{id:'lyon',label:'LYON',short:'LYON'}],players=[{id:'trap',label:'TRAP',team:'LOUD'}];
 const round={key:'classificatoria-1',stage:'classificatoria',date:'2026-11-06',round:1,closesAt:Date.now()+3600000,label:'Rodada 1',groups:['A','B'],ready:true,status:'open',teams,players,result:null};
 const data=(who=user,votes=who?.uid==='alice'?saved:{})=>({ok:true,round,rounds:[round],linked:!!who,username:who?.uid||'',votes});
 w.CFF_ACCOUNT={ready:Promise.resolve(),get user(){return user},getIdToken:async()=> 'signed-'+user.uid};
 w.fetch=async(url,options)=>{requests.push({url,headers:options.headers});if(options.method==='POST'){post++;const b=JSON.parse(options.body),who=user;if(failOnce&&post===1)return{ok:false,status:503,json:async()=>({ok:false,error:'Falha temporária. Tente novamente.'})};if(holdSave)await new Promise(r=>release=r);saved={best:b.best,worst:b.worst,mvp:b.mvp};return{ok:true,status:200,json:async()=>({...data(who,saved),saved:true,participationAwarded:3})};}return{ok:true,status:200,json:async()=>data()};};
 w.eval(source);await settle(()=>w.document.querySelectorAll('.gfp-card').length===3);
 const choose=(metric,id)=>{w.document.querySelector('[data-gfp-search="'+metric+'"]').focus();w.document.querySelector('[data-gfp-choice="'+metric+'"][data-option="'+id+'"]').click()};
 return{w,requests,choose,get post(){return post},release:()=>release(),login(uid='alice'){user={uid};w.dispatchEvent(new w.Event('cff:account-changed'));},close:()=>w.close()};
}
test('same-page login enables saving without discarding guest choices and uses a signed token for the special account link',async()=>{
 const f=await accountFixture();try{
  f.choose('best','loud');f.choose('worst','rrq');f.choose('mvp','trap');assert(f.w.document.querySelector('[data-gfp-save]').disabled);assert.match(f.w.document.querySelector('.gfp-save-state').textContent,/Não salvo/);
  const n=f.requests.length;f.login();await settle(()=>!f.w.document.querySelector('.gfp-auth'));
  assert(!f.w.document.querySelector('[data-gfp-save]').disabled);assert.equal(f.w.document.querySelectorAll('.gfp-selected').length,3);assert.equal(f.requests.length,n+1);assert.equal(f.requests.at(-1).headers.Authorization,'Bearer signed-alice');
  f.w.document.querySelector('[data-gfp-save]').click();await settle(()=>f.w.document.querySelector('.gfp-success'));assert.equal(f.post,1);assert.match(f.w.document.querySelector('.gfp-save-state').textContent,/Palpites salvos/);assert.equal(f.w.document.querySelectorAll('.gfp-tick.is-draft').length,0);
 }finally{f.close()}
});
test('failed saves preserve choices, distinguish unsaved changes and retry without hiding the failure',async()=>{
 const f=await accountFixture({logged:true,failOnce:true});try{
  f.choose('best','loud');f.choose('worst','rrq');f.choose('mvp','trap');f.w.document.querySelector('[data-gfp-save]').click();await settle(()=>f.w.document.querySelector('.gfp-error'));
  assert.equal(f.w.document.querySelectorAll('.gfp-selected').length,3);assert.match(f.w.document.querySelector('.gfp-save-state').textContent,/Não salvo/);assert(!f.w.document.querySelector('[data-gfp-save]').disabled);assert.equal(f.w.document.querySelector('.gfp-success'),null);
  f.w.document.querySelector('[data-gfp-save]').click();await settle(()=>f.w.document.querySelector('.gfp-success'));assert.equal(f.post,2);
  const count=f.requests.length;f.choose('best','lyon');assert.match(f.w.document.querySelector('.gfp-save-state').textContent,/Não salvo/);assert.equal(f.requests.length,count,'local edits/search never read the backend');
 }finally{f.close()}
});
test('previous votes load as saved and an old account response cannot restore choices after switching accounts',async()=>{
 const f=await accountFixture({logged:true,existing:{best:'loud',worst:'rrq',mvp:'trap'},holdSave:true});try{
  assert.match(f.w.document.querySelector('.gfp-save-state').textContent,/Palpites salvos/);assert.equal(f.post,0);
  f.choose('best','lyon');f.w.document.querySelector('[data-gfp-save]').click();await settle(()=>f.post===1);assert(f.w.document.querySelector('[data-gfp-round]').disabled);
  f.login('bob');await settle(()=>f.w.document.querySelectorAll('.gfp-unselected').length===3);f.release();await new Promise(r=>setTimeout(r,20));assert.equal(f.w.document.querySelector('.gfp-success'),null);assert.equal(f.w.document.querySelectorAll('.gfp-selected').length,0);
 }finally{f.close()}
});
test('standalone page and home provide accessible links without loading votes on Interactions or home',()=>{
 const page=fs.readFileSync('ffws-global-2026/palpites/index.html','utf8'),home=fs.readFileSync('index.html','utf8'),interactions=fs.readFileSync('interacoes.html','utf8');
 assert(page.includes('aria-current="page"'));assert(page.includes('Como funciona a pontuação?'));assert(page.includes('public-account.js'));assert(!page.includes('global.js'));assert(!home.includes('src="/js/global-predictions.js'));assert(!interactions.includes('src="/js/global-predictions.js'));assert(home.includes('home-global-predictions-link'));assert(home.includes('href="/ffws-global-2026/palpites/"'));
});
