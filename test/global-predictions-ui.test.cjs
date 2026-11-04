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
