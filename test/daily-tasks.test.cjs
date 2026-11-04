const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),{JSDOM}=require('jsdom');
const source=fs.readFileSync('js/daily-tasks.mjs','utf8');
function fixture(){const d=new JSDOM('<button data-account-entry>Meu perfil</button><a data-cff-bottom="profile"></a><div data-daily-tasks></div>',{url:'https://centralfreefire.com.br/conta.html',runScripts:'outside-only'}),w=d.window;w.fetch=()=>{throw Error('Reminders must never fetch');};w.eval(source);return {w,d,api:w.CFF_DAILY_TASKS,emit:(name,detail)=>w.dispatchEvent(new w.CustomEvent(name,{detail})),day:()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())};}
test('daily indicators reuse completion events and isolate accounts and dates',()=>{const f=fixture();try{f.api.setIdentity({uid:'alice',name:'Alice',instagram:'linked'});assert.equal(f.w.document.querySelectorAll('[data-daily-dot]').length,2);assert.equal(f.w.document.querySelectorAll('.cff-daily-task').length,3);f.emit('cff:daily-checkin-status',{uid:'alice',day:f.day(),coins:true});f.emit('cff:daily-quiz-status',{uid:'other',day:f.day(),complete:true});assert(f.w.document.querySelector('[data-daily-dot]'));f.emit('cff:daily-quiz-status',{uid:'alice',day:f.day(),complete:true});assert.equal(f.w.document.querySelector('[data-daily-dot]'),null);f.api.setIdentity({uid:'bob',name:'Bob',instagram:'unlinked'});assert(f.w.document.querySelector('[data-daily-dot]'));f.api.setIdentity({uid:'alice',instagram:'linked'});assert.equal(f.w.document.querySelector('[data-daily-dot]'),null);f.w.localStorage.setItem('cff-daily-tasks-v1:alice',JSON.stringify({day:'2000-01-01',quiz:true,checkin:true}));f.api.draw();assert(f.w.document.querySelector('[data-daily-dot]'));f.api.setIdentity({uid:'',instagram:'unlinked'});assert.equal(f.w.document.querySelector('[data-daily-dot]'),null);}finally{f.w.close();}});
test('mobile account sheet uses auth identity even without an avatar',async()=>{const d=new JSDOM('<nav class="cff-bottom-navigation"><a data-cff-bottom="profile"></a></nav>',{url:'https://centralfreefire.com.br/',runScripts:'outside-only'}),w=d.window;try{w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.CFF_ACCOUNT={user:{uid:'alice',name:'Alice'},ready:Promise.resolve()};w.eval(fs.readFileSync('js/mobile-dock.js','utf8'));w.document.querySelector('[data-cff-bottom="profile"]').click();await Promise.resolve();assert.equal(w.document.querySelector('[data-dock-name]').textContent,'Alice');assert(w.document.querySelector('[data-dock-login]').hidden);}finally{w.close();}});
test('confirmed check-in disables the main button even while ranking is pending',async()=>{const d=new JSDOM('<div id="checkin"></div>',{url:'https://centralfreefire.com.br/conta.html',runScripts:'outside-only'}),w=d.window;let requests=0;try{w.esc=String;w.auth={currentUser:{uid:'alice'}};w.economyRequest=async(_auth,operation)=>{requests++;return {day:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),coins:true,ranking:false,rankingStatus:'link_required'};};const code=fs.readFileSync('js/profile-checkin.mjs','utf8').replace(/^import[^\n]*\n/,'').replace(/export /g,'');w.eval(code+'\nwindow.checkin=createProfileCheckin({auth:()=>auth});');w.checkin.mount(w.document.getElementById('checkin'));await new Promise(r=>setImmediate(r));const button=w.document.querySelector('[data-profile-checkin]');assert(button.disabled);assert.equal(button.textContent,'Check-in concluído hoje');button.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await Promise.resolve();assert.equal(requests,1);assert.equal(w.document.querySelector('[data-profile-ranking-retry]'),null);}finally{w.close();}});


test('account dropdown marks each pending task individually and clears after completion',()=>{
 const f=fixture();
 try{
  f.api.setIdentity({uid:'ana',name:'Ana',instagram:'unlinked'});
  const menu=f.w.document.createElement('div');
  menu.id='cff-account-menu';
  menu.innerHTML='<a data-cff-daily-action="checkin">Check-in diário</a>'+
   '<a data-cff-daily-action="quiz">Desafios diários</a>'+
   '<a data-cff-daily-action="instagram">Vincular Instagram</a>'+
   '<a href="/conta.html">Meu perfil</a>';
  f.w.document.body.append(menu);
  f.api.draw();
  const pending=key=>!!menu.querySelector('[data-cff-daily-action="'+key+'"] [data-cff-menu-task-dot]');
  assert(pending('checkin'));
  assert(pending('quiz'));
  assert(pending('instagram'));
  assert.equal(menu.querySelectorAll('[data-cff-menu-task-dot]').length,3);
  assert.equal(menu.querySelectorAll('a:not([data-cff-daily-action]) [data-cff-menu-task-dot]').length,0);
  f.emit('cff:daily-checkin-status',{uid:'ana',day:f.day(),coins:true});
  assert.equal(pending('checkin'),false);
  assert(pending('quiz'));
  assert(pending('instagram'));
  f.emit('cff:daily-quiz-status',{uid:'ana',day:f.day(),complete:true});
  assert.equal(pending('quiz'),false);
  f.api.setIdentity({uid:'ana',name:'Ana',instagram:'linked'});
  assert.equal(menu.querySelectorAll('[data-cff-menu-task-dot]').length,0);
  assert.equal(f.w.document.querySelector('[data-daily-dot]'),null);
  f.api.setIdentity({uid:'',name:'',instagram:'checking'});
  assert.equal(menu.querySelectorAll('[data-cff-menu-task-dot]').length,0);
 }finally{f.w.close();}
});
test('dropdown items use text-only labels rather than decorative icon glyphs',()=>{
 const text=fs.readFileSync('js/public-account.js','utf8');
 for(const label of ['Check-in diário','Desafios diários','Vincular Instagram','Caixa de entrada']){
  assert(text.includes('>'+label+'</a>'));
 }
 for(const decorated of ['◷ Check-in diário','✦ Desafios diários','@ Vincular Instagram','✉ Caixa de entrada']){
  assert.equal(text.includes('>'+decorated+'</a>'),false);
 }
 assert(text.includes('window.CFF_DAILY_TASKS?.draw();const r=entry.getBoundingClientRect()'));
});
