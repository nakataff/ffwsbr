const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const tick=async()=>{for(let i=0;i<10;i++)await new Promise(r=>setTimeout(r,0));};
const giftId='codegift-11111111-1111-4111-8111-111111111111',second='codegift-22222222-2222-4222-8222-222222222222';
const at=1791910000000;
function fixture(html='<div id="root"></div>'){
 const dom=new JSDOM(html,{url:'https://centralfreefire.com.br/conta.html',runScripts:'outside-only'}),w=dom.window;
 w.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));w.AbortSignal=AbortSignal;
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 const evaluate=p=>w.eval(fs.readFileSync(require.resolve('../'+p),'utf8').replace(/^import .*\n/gm,'').replace(/^export /gm,''));
 return {w,evaluate,root:w.document.querySelector('#root'),auth:{currentUser:{uid:'person',getIdToken:async()=> 'private-token'}},close:()=>w.close()};
}
test('inventory separates available cosmetics and puts equipped items first without showing locked rewards',async()=>{
 const {inventoryAssets,INVENTORY_TABS}=await import('../js/profile-inventory.mjs');assert.equal(INVENTORY_TABS[0][0],'gifts');
 const input={options:{players:[{id:'player',name:'Jogador'}],frames:[{id:'base-frame',name:'Bronze'}]},catalog:{owned:{kind:'avatar',title:'Meu avatar',assetId:'image'},locked:{kind:'avatar',title:'Bloqueado'},disabled:{kind:'avatar',title:'Desativado'},cover:{kind:'cover',enabled:true,title:'Capa padrão'}},available:(_x,id)=>id==='owned',profile:{avatarId:'player'},defaults:{coverId:'cover'}};
 const avatars=inventoryAssets('avatar',input);assert.equal(avatars[0].id,'player');assert(avatars.some(x=>x.id==='owned'));assert(avatars.some(x=>x.id==='default'));assert(!avatars.some(x=>['locked','disabled','cover'].includes(x.id)));
 assert.deepEqual(inventoryAssets('frame',input).map(x=>x.id),['base-frame']);assert.deepEqual(inventoryAssets('cover',input).map(x=>x.id),['cover']);
});
test('gifts open first, archive and restore independently of the code return endpoint and preserve cosmetic ownership',async()=>{
 const a=fixture();try{
  let listener,unsubscribed=false;const opened=[],calls=[],codes={[giftId]:{title:'Meu código',sentAt:at,openedAt:at+10},[second]:{title:'Ainda fechado',sentAt:at+30}};
  a.w.ref=(_db,path)=>{assert.equal(path,'communityCodeGifts/person');return path;};a.w.onValue=(_ref,callback)=>{listener=callback;callback({val:()=>codes});return()=>unsubscribed=true;};a.w.createCodeGiftOpener=()=>({open:async id=>opened.push(id),invalidate(){},stop(){}});
  a.evaluate('js/gift-archive.mjs');a.evaluate('js/recipient-code-gifts.js');a.w.fetch=async(_url,request)=>{const body=JSON.parse(request.body);calls.push(body);return {ok:true,json:async()=>({ok:true,archivedAt:body.archived?at+100:0})};};
  const profileGifts={cosmetic:{assetId:'avatar',kind:'avatar',title:'Avatar recebido',grantedAt:at+20}};
  const stop=a.w.mountRecipientCodeGifts(a.root,{auth:a.auth,db:{},uid:'person',profileGifts,image:()=>'<img alt="Avatar recebido">'});
  assert.match(a.root.textContent,/Meu código/);assert.match(a.root.textContent,/Avatar recebido/);assert(!a.root.querySelector(`[data-archive-gift="${second}"]`));
  a.root.querySelector(`[data-open-code-gift="${giftId}"]`).click();await tick();assert.deepEqual(opened,[giftId]);
  a.root.querySelector(`[data-archive-gift="${giftId}"]`).click();await tick();assert(!a.root.querySelector(`[data-open-code-gift="${giftId}"]`));assert.match(a.root.querySelector('[data-gift-archive-view]').textContent,/1/);
  a.root.querySelector('[data-gift-archive-view]').click();assert.match(a.root.textContent,/Meu código/);assert(!a.root.querySelector(`[data-open-code-gift="${second}"]`));
  a.root.querySelector('[data-archive-gift]').click();await tick();assert.match(a.root.textContent,/Nenhum presente arquivado/);
  a.root.querySelector('[data-gift-archive-view]').click();a.root.querySelector('[data-archive-gift="cosmetic"]').click();await tick();
  assert.equal(calls[2].kind,'profile');assert(calls.every(c=>c.action==='archiveGift'));assert.equal(profileGifts.cosmetic.assetId,'avatar');
  stop();assert(unsubscribed);listener({val:()=>({})});
 }finally{a.close();}
});
test('archive failures are retryable and cannot render a response from a different account',async()=>{
 const a=fixture();try{a.w.ref=(_db,p)=>p;a.w.onValue=(_ref,callback)=>{callback({val:()=>({[giftId]:{title:'Meu código',sentAt:at,openedAt:at}})});return()=>{};};a.w.createCodeGiftOpener=()=>({stop(){},invalidate(){}});a.evaluate('js/gift-archive.mjs');a.evaluate('js/recipient-code-gifts.js');let resolve,calls=0;a.w.fetch=async()=>{calls++;if(calls===1)throw Error('Sem conexão');return new Promise(r=>resolve=r);};const stop=a.w.mountRecipientCodeGifts(a.root,{auth:a.auth,db:{},uid:'person'});a.root.querySelector('[data-archive-gift]').click();await tick();assert.match(a.root.textContent,/Sem conexão/);assert(!a.root.querySelector('[data-archive-gift]').disabled);a.root.querySelector('[data-archive-gift]').click();await tick();a.auth.currentUser={uid:'other'};resolve({ok:true,json:async()=>({archivedAt:at})});await tick();assert(a.root.querySelector('[data-open-code-gift]'));stop();}finally{a.close();}
});
test('an opened gift can be archived directly, closes its code dialog and keeps the saved code out of archive responses',async()=>{
 const a=fixture();try{a.evaluate('js/gift-archive.mjs');a.evaluate('js/code-gift-opener.mjs');const calls=[];a.w.fetch=async(_url,request)=>{const body=JSON.parse(request.body);calls.push(body);return{ok:true,json:async()=>body.action==='openCodeGift'?{gift:{code:'PRIVATE1234',title:'Presente'}}:{ok:true,archivedAt:at}};};let archived=0;const viewer=a.w.createCodeGiftOpener({auth:a.auth,uid:'person',onArchived:()=>archived++});await viewer.open(giftId);a.w.document.querySelector('[data-archive-open-gift]').click();a.w.document.querySelector('[data-archive-open-gift]').click();await tick();assert.equal(archived,1);assert(!a.w.document.querySelector('dialog'));assert.equal(calls.filter(c=>c.action==='archiveGift').length,1);assert(!JSON.stringify(calls).includes('PRIVATE1234'));viewer.stop();}finally{a.close();}
});
test('the real account page places inventory beside shop, retains old gifts/badges links and limits image rendering',()=>{
 const a=fixture();try{
 const source=fs.readFileSync(require.resolve('../js/public-account.js'),'utf8');assert.match(source,/\['points','Loja'\],\['inventory','Inventário'\]/);assert.match(source,/tab=\['gifts','badges'\]\.includes\(requestedTab\)\?'inventory'/);assert.match(source,/items\.slice\(0,inventoryLimit\)/);
 const body=source.slice(source.indexOf('function giftHtml()'),source.indexOf('function mountFavoriteFeed'));a.w.INVENTORY_TABS=[['gifts','Presentes'],['avatars','Avatares'],['badges','Insígnias']];a.w.inventoryTab='gifts';a.w.inventoryLimit=24;a.w.inventoryAssets=()=>[];a.w.options={};a.w.catalog={};a.w.profile={};a.w.profileDefaults={};a.w.esc=String;a.w.eval(body);a.root.innerHTML=a.w.inventoryHtml();assert(a.root.querySelector('.cff-inventory-content').firstElementChild.id==='cff-code-gift-inventory');assert.equal(a.root.querySelector('[aria-pressed=true]').dataset.inventoryTab,'gifts');
 }finally{a.close();}
});
test('the actual account render mounts only the selected inventory collection and keeps the new navigation active',async()=>{
 const a=fixture('<div id="cff-account-root"></div>');try{
  const {INVENTORY_TABS,inventoryAssets}=await import('../js/profile-inventory.mjs');
  Object.assign(a.w,{INVENTORY_TABS,inventoryAssets,tab:'inventory',inventoryTab:'gifts',inventoryLimit:24,inventoryGiftView:{archived:false,limit:20},database:{},auth:{},user:{uid:'person'},profile:{name:'Pessoa'},grants:{},options:{players:[],teams:[]},catalog:{},profileDefaults:{},ownership:{},roles:{},gifts:{},viewUid:'',viewInstagram:'',viewSlug:'',accountLoadError:null,notificationViewUid:null,stopEconomy:null,stopCodeGiftInventory:null,instagramConnect:{mount(){}},profileCheckin:{mount(){}},communityProfileUI:{mount(){}},$:id=>a.w.document.getElementById(id),refreshOwnInstagramBadge(){},registrationComplete:()=>true,hero:()=>'<section class="cff-profile-hero"></section>',hydrateProfileImages(){},redeemAvatar(){},mountFavoriteFeed(){},mountAccountNotifications(){},medals:()=>[],badgeGroupsHtml:()=>'<p>Insígnias organizadas</p>',catalogAvailable:()=>false,avatarControl:()=>'',approvedImage:()=>'<img alt="Preview">'});
  let mounts=0,stops=0;a.w.mountRecipientCodeGifts=(host,input)=>{mounts++;assert.equal(input.uid,'person');host.innerHTML='<p>Inventário carregado</p>';return()=>stops++;};
  const source=fs.readFileSync(require.resolve('../js/public-account.js'),'utf8'),inventory=source.slice(source.indexOf('function giftHtml()'),source.indexOf('function mountFavoriteFeed')),render=source.slice(source.indexOf('function render(){'),source.indexOf('function injectAccountAccess(){'));
  a.w.eval(inventory+'\n'+render);a.w.render();
  const nav=[...a.w.document.querySelectorAll('[data-account-tab]')];assert.deepEqual(nav.map(n=>n.textContent),['Meu perfil','Loja','Inventário','Comunidade']);assert.equal(nav[2].getAttribute('aria-selected'),'true');assert.equal(mounts,1);
  a.w.inventoryTab='avatars';a.w.render();assert.equal(stops,1);assert.equal(mounts,1);assert(a.w.document.querySelector('.cff-inventory-grid'));assert(!a.w.document.querySelector('#cff-code-gift-inventory'));assert.equal(a.w.document.querySelector('[data-inventory-tab=avatars]').getAttribute('aria-pressed'),'true');
  a.w.inventoryTab='badges';a.w.render();assert.match(a.w.document.querySelector('.cff-inventory-content').textContent,/Insígnias organizadas/);
 }finally{a.close();}
});
