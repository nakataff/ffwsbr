'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM,VirtualConsole}=require('jsdom');
const read=p=>fs.readFileSync(p,'utf8'),tick=()=>new Promise(r=>setTimeout(r,0));
async function setup({modal=true,home=false}={}){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM('<section id="sobre"><section data-interaction-guide></section></section><aside class="home-left-rail"><section class="home-rail-live"></section></aside>',{url:'https://centralfreefire.com.br/index.html#home',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
 let calls=0;w.fetch=async()=>{calls++;return{ok:true,json:async()=>({users:{}})}};
 w.setInterval=()=>0;
 if(modal){w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');this.querySelector('[autofocus]')?.focus()};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'))};}
 await tick();w.eval(read('js/interaction-guide.js'));if(home)w.eval(read('js/home-community-ranking.js'));await tick();
 return{w,d:w.document,errors,calls:()=>calls,close:()=>w.close()};
}
test('About and Interactions mount the same accessible 3-step guide and native FAQ without data requests',async()=>{
 const f=await setup();try{
  for(const path of ['index.html','interacoes.html']){const html=read(path);assert(html.includes('data-interaction-guide'));assert(html.includes('js/interaction-guide.js?v=20261029-interaction-guide-v1'));assert(html.includes('css/interaction-guide.css?v=20261029-interaction-guide-v1'));}
  const root=f.d.querySelector('[data-interaction-guide]');assert.equal(root.querySelectorAll('.cff-ig-guide-steps>li').length,3);assert.equal(root.querySelectorAll('details').length,6);
  assert(root.textContent.includes('Já enviei · Confirmar Instagram'));assert(root.querySelector('a[href="/conta.html?tab=overview#cff-instagram-connect"]'));assert(root.querySelector('a[href="/conta.html?tab=points&shopSection=shop"]'));assert(root.querySelector('a[href="/conta.html?tab=quiz"]'));assert.equal(f.calls(),0);
  f.w.CFF_INTERACTION_GUIDE.mount(root);assert.equal(root.querySelectorAll('details').length,6);assert.deepEqual(f.errors,[]);
 }finally{f.close()}
});
test('home help opens one modal, preserves the ranking destination, restores focus, and makes no new requests',async()=>{
 const f=await setup({home:true});try{
  const trigger=f.d.querySelector('[data-open-interaction-guide]'),card=f.d.getElementById('home-community-ranking');assert(trigger);assert.equal(trigger.getAttribute('href'),'interacoes.html#como-participar');assert.equal(f.calls(),1);
  const key=new f.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});trigger.dispatchEvent(key);assert.equal(key.defaultPrevented,false,'the card must not intercept keyboard use of a nested link');
  trigger.focus();trigger.click();const dialog=f.d.querySelector('dialog');assert(dialog.open);assert(f.d.documentElement.classList.contains('cff-ranking-help-open'));assert.equal(dialog.querySelectorAll('.cff-ig-guide-steps>li').length,3);assert.equal(dialog.querySelectorAll('details').length,0);assert.equal(f.calls(),1);
  f.w.CFF_INTERACTION_GUIDE.open(trigger);assert.equal(f.d.querySelectorAll('dialog').length,1);assert.equal(dialog.getAttribute('aria-labelledby'),dialog.querySelector('h2').id);
  dialog.querySelector('button').click();assert(!dialog.open);assert.equal(f.d.activeElement,trigger);assert(!f.d.documentElement.classList.contains('cff-ranking-help-open'));assert.equal(f.calls(),1);assert.deepEqual(f.errors,[]);
  assert(card.querySelector('a[href="interacoes.html"]'));
 }finally{f.close()}
});
test('old browsers retain a normal link to the full guide if dialog is unavailable',async()=>{
 const f=await setup({modal:false,home:true});try{const link=f.d.querySelector('[data-open-interaction-guide]');assert.equal(f.w.CFF_INTERACTION_GUIDE.open(link),false);assert.equal(f.d.querySelector('dialog'),null);assert.equal(link.getAttribute('href'),'interacoes.html#como-participar');assert.equal(f.calls(),1);}finally{f.close()}
});
test('help distinguishes participation days from check-in/quiz, and uses the deployed ranking point rules',async()=>{
 const f=await setup();try{
  const text=f.d.querySelector('[data-interaction-guide]').textContent,worker=read('cloudflare/instagram-community/worker.js'),economy=read('functions/economy-interactions.js');
  for(const [name,value]of [['storyMentionPoints',5],['commentPoints',2],['checkinPoints',1],['storyMentionDailyLimit',3],['commentMediaMaxAgeDays',7],['googleAccountPoints',20]])assert(worker.includes(name+': '+value));
  assert(text.includes('Comentário válido: +2 pontos'));assert(text.includes('Story com menção recebida: +5 pontos'));assert(text.includes('até 3 por dia'));assert(text.includes('últimos 7 dias'));assert(text.includes('Check-in: +1 ponto'));assert(text.includes('20 pontos'));
  assert(economy.includes('PARTICIPATION_DAILY=40'));assert(economy.includes('PARTICIPATION_DAYS=25'));assert(text.includes('40 moedas'));assert(text.includes('1.000 CFF COINS'));assert(text.includes('Fazer só check-in ou quiz não conta'));assert(text.includes('uma compra não tira seus pontos'));assert(text.includes('Curtidas não entram'));assert(text.includes('não garante um presente'));assert(text.includes('meia-noite de Brasília'));
 }finally{f.close()}
});
