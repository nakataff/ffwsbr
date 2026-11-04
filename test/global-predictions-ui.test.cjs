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
 assert(html.includes('id="cff-global-predictions"'));
 assert(html.includes('gfp-legacy'));
 assert(html.includes('global-predictions.js'));
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
