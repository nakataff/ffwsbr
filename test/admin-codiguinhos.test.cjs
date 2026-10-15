const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
function setup(){
 const html=fs.readFileSync(require.resolve('../admin-codiguinhos.html'),'utf8'),dom=new JSDOM(html,{url:'https://centralfreefire.com.br/admin-codiguinhos.html',runScripts:'outside-only'}),w=dom.window;
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.alert=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 w.eval(fs.readFileSync(require.resolve('../js/admin-code-state.js'),'utf8'));
 for(const script of w.document.querySelectorAll('script:not([src])'))if(script.type!=='module')w.eval(script.textContent);
 w.eval(fs.readFileSync(require.resolve('../js/admin-codiguinhos-ui.js'),'utf8'));
 let saves=0;w.CodiguinhosCloud={scheduleSave(){saves++;},flush:async()=>{},lock(){}};
 const group={id:'test',nome:'Pacote de teste',item:'Diamantes',inicio:'2020-01-01',fim:'2099-01-01',codigos:['ABCDEF123456','BCDEFG123456','CDEFGH123456']};
 w.aplicarEstadoCodiguinhos({__gruposAtivos:[group],codigos:{ABCDEF123456:{presente:{uid:'person',giftId:'codegift-test',sentAt:Date.parse('2026-10-14T20:30:00Z'),username:'pessoa'},recebeu:'@pessoa',entregue:false}}});w.CFF_CODE_GIFTS_READY=true;
 const $=s=>w.document.querySelector(s);return {w,$,source:w.CFF_CODE_DELIVERY_SOURCE,saves:()=>saves,close:()=>w.close()};
}
test('a sent gift has a visible dated stamp and is excluded from every availability count and filter',()=>{
 const a=setup();try{const card=a.$('[data-stock-code="ABCDEF123456"]');assert.match(card.textContent,/PRESENTE ENVIADO/);assert.match(card.textContent,/14\/10\/2026, 17:30/);assert(!a.source.read().some(r=>r.code==='ABCDEF123456'));assert.equal(a.$('#statDisponiveis').textContent,'2');assert.equal(a.$('#statRestantes').textContent,'2');assert.equal(a.$('#statGanhadores').textContent,'1');assert.equal(a.$('#statEntregues').textContent,'0');assert(card.querySelector('[data-code-gift-send]').disabled);
 a.$('#filtroStatus').value='disponiveis';a.w.render();assert(!a.$('[data-stock-code="ABCDEF123456"]'));a.$('#filtroStatus').value='presentes';a.w.render();assert.equal(a.w.document.querySelectorAll('[data-stock-code]').length,1);
 }finally{a.close();}
});
test('old deliveries reconcile without marking game redemption; repeated checks do not duplicate saves',async()=>{
 const a=setup();try{const record={code:'BCDEFG123456',uid:'person2',username:'outra',giftId:'codegift-second',sentAt:Date.parse('2026-10-13T21:22:00Z'),openedAt:0,pending:false};await a.source.reconcile([record]);assert.match(a.$('[data-stock-code="BCDEFG123456"]').textContent,/13\/10\/2026, 18:22/);assert.equal(a.$('#statDisponiveis').textContent,'1');assert.equal(a.$('#statEntregues').textContent,'0');assert.equal(a.saves(),1);await a.source.reconcile([record]);assert.equal(a.saves(),1);assert.equal(a.source.history().length,2);
 a.w.limparTudo();assert.equal(a.source.history().length,2);assert.equal(a.source.read().length,1);
 }finally{a.close();}
});
test('tabs isolate each function and moving nodes preserves input values; gift dialog is protected during sending',()=>{
 const a=setup();try{assert.equal(a.w.document.querySelectorAll('[role=tab]').length,8);assert.equal(a.$('#codes-panel-inventory').hidden,false);assert.equal(a.$('#codes-panel-settings').hidden,true);a.$('#busca').value='test';a.$('[data-codes-tab=settings]').click();assert.equal(a.$('#codes-panel-settings').hidden,false);assert.equal(a.$('#codes-panel-inventory').hidden,true);a.$('[data-codes-tab=inventory]').click();assert.equal(a.$('#busca').value,'test');assert.equal(a.$('#groups').closest('[data-codes-panel]').dataset.codesPanel,'inventory');assert.equal(a.$('#reportBox').closest('[data-codes-panel]').dataset.codesPanel,'reports');assert.equal(a.$('#archiveManager').closest('[data-codes-panel]').dataset.codesPanel,'archive');
 a.$('[data-codes-open-gift]').click();assert(a.$('#codes-gift-dialog').open);a.$('#cff-code-delivery').dataset.giftBusy='true';a.w.CFF_CODES_UI.giftBusy(true);a.$('[data-codes-close-gift]').click();assert(a.$('#codes-gift-dialog').open);a.$('#cff-code-delivery').dataset.giftBusy='false';a.w.CFF_CODES_UI.giftBusy(false);a.$('[data-codes-close-gift]').click();assert.equal(a.$('#codes-gift-dialog').open,false);
 }finally{a.close();}
});
test('pending deliveries stay unavailable without a false sent stamp',async()=>{
 const a=setup();try{await a.source.reconcile([{code:'BCDEFG123456',uid:'p',username:'pending',giftId:'codegift-p',sentAt:Date.parse('2026-10-14T18:00:00Z'),pending:true}]);const text=a.$('[data-stock-code="BCDEFG123456"]').textContent;assert.match(text,/ENVIO PENDENTE/);assert.doesNotMatch(text,/PRESENTE ENVIADO/);assert.equal(a.$('#statGanhadores').textContent,'1');assert.equal(a.source.read().length,1);}finally{a.close();}
});
test('the actual gift form requires recipient confirmation, uses a dialog and removes a successful gift from available codes',async()=>{
 const a=setup();try{
  const {createGiftSync}=await import('../js/admin-code-gift-sync.mjs');a.w.createGiftSync=createGiftSync;Object.defineProperty(a.w.crypto,'subtle',{value:crypto.subtle});
  const target={uid:'person2',username:'outra',name:'Pessoa de teste',avatarId:'default',path:'/conta.html?u=person2'},calls=[];
  a.w.profileOptions=async()=>({});a.w.get=async()=>({val:()=>({})});a.w.ref=(_,path)=>path;a.w.onValue=()=>()=>{};a.w.approvedImage=()=>'<img alt="Avatar">';a.w.hydrateProfileImages=()=>{};a.w.esc=v=>String(v).replace(/[<>]/g,x=>x==='<'?'&lt;':'&gt;');
  a.w.fetch=async(_url,options)=>{const b=JSON.parse(options.body);calls.push(b);const data=b.action==='codeGiftStatus'?{ok:true,gifts:[]}:b.action==='findGiftRecipient'?{recipient:target}:{recipient:target,giftId:'codegift-11111111-1111-4111-8111-111111111111',gift:{sentAt:Date.parse('2026-10-14T21:00:00Z')}};return {ok:true,json:async()=>data};};
  let source=fs.readFileSync(require.resolve('../js/admin-code-gifts.js'),'utf8').replace(/^import .*\n/gm,'').replace(/^export /gm,'');a.w.eval(source);
  const stop=await a.w.mountAdminCodeGifts(a.$('#cff-code-delivery'),{auth:{currentUser:{email:'admin@centralfreefire.com.br',uid:'admin',getIdToken:async()=> 'fake-token'}},db:{},source:a.source});
  for(let n=0;n<20;n++)await new Promise(r=>setTimeout(r,0));
  a.$('[data-code-gift-send="BCDEFG123456"]').click();assert(a.$('#codes-gift-dialog').open);const form=a.$('[data-code-send]');assert.equal(form.elements.code.value,'BCDEFG123456');assert(form.querySelector('[type=submit]').disabled);
  const find=a.$('[data-code-find]');find.elements.query.value='@outra';find.dispatchEvent(new a.w.SubmitEvent('submit',{bubbles:true,cancelable:true}));for(let n=0;n<10;n++)await Promise.resolve();assert.match(a.$('[data-code-recipient]').textContent,/Pessoa de teste/);assert(form.querySelector('[type=submit]').disabled);
  form.elements.confirmRecipient.checked=true;form.elements.confirmRecipient.dispatchEvent(new a.w.Event('change',{bubbles:true}));assert.equal(form.querySelector('[type=submit]').disabled,false);form.dispatchEvent(new a.w.SubmitEvent('submit',{bubbles:true,cancelable:true}));for(let n=0;n<20;n++)await new Promise(r=>setTimeout(r,0));
  assert.equal(calls.filter(x=>x.action==='sendCodeGift').length,1);assert.match(a.$('[data-stock-code="BCDEFG123456"]').textContent,/PRESENTE ENVIADO/);assert.match(a.$('[data-stock-code="BCDEFG123456"]').textContent,/14\/10\/2026, 18:00/);assert(!a.source.read().some(row=>row.code==='BCDEFG123456'));stop();
 }finally{a.close();}
});
test('stock manager mounts inside its own tab and a card shortcut opens that tab',async()=>{
 const a=setup();try{
  Object.defineProperty(a.w.crypto,'subtle',{value:crypto.subtle});a.w.TextEncoder=TextEncoder;a.w.getApps=()=>[{name:'[DEFAULT]'}];a.w.initializeApp=()=>({});const admin={uid:'admin',email:'admin@centralfreefire.com.br'};a.w.getAuth=()=>({currentUser:admin});a.w.onAuthStateChanged=(_auth,fn)=>fn(admin);a.w.economyRequest=async()=>({stock:[]});a.w.loadEconomyStyle=()=>{};a.w.esc=String;a.w.prepareEconomyPhoto=async x=>x;
  a.w.eval(fs.readFileSync(require.resolve('../js/admin-economy-stock.js'),'utf8').replace(/^import .*\n/gm,''));for(let n=0;n<15;n++)await new Promise(r=>setTimeout(r,0));
  assert.equal(a.$('#eco-code-stock').parentElement.id,'codes-panel-rewards');assert.equal(a.$('#codes-panel-rewards').hidden,true);a.$('[data-economy-stock="BCDEFG123456"]').click();assert.equal(a.$('#codes-panel-rewards').hidden,false);assert.equal(a.$('[name=code]').value,'BCDEFG123456');assert.equal(a.$('[data-reserve-submit]').disabled,false);
 }finally{a.close();}
});
