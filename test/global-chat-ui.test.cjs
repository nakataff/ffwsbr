const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const tick=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setTimeout(r,0));};
const id='1791910000000-0123456789abcdef',replyId='1791910006000-fedcba9876543210';
async function fixture({admin=false,visible=true,path='/conta.html',disabled=false}={}){
 const dom=new JSDOM('<body></body>',{url:'https://centralfreefire.com.br'+path,runScripts:'outside-only'}),w=dom.window,subscriptions=new Map(),calls=[],reads=[];
 const data={'.info/connected':true,'communityProfileDefaults':{},'communityRoleCatalog':{},'globalChat/settings':{accent:'#aaffdd',slowSeconds:30},'globalChat/messages':{[id]:{uid:'other',name:'Alice',username:'alice',roleId:'member',text:'Olá @nakata <img src=x>',at:1791910000000}},'userAccounts/person/profile':{name:'Nakata',username:'nakata',gender:'masculino',public:true},'communityAccountRoles/person':{roleId:'member'},'communityProfileCatalog/earned':{kind:'badge',title:'Campeão',description:'Venceu o mês',enabled:true}};
 let authCallback;
 const user={uid:'person',email:admin?'admin@centralfreefire.com.br':'user@test',getIdToken:async()=>'token'};
 const emit=path=>{for(const cb of subscriptions.get(path)||[])cb({val:()=>data[path]??null});};
 w.AbortSignal=AbortSignal;w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};w.CFF_CONFIG={firebase:{}};
 const roleData=await import('../js/profile-role-data.mjs');
 const modules={
 'firebase-app':{getApps:()=>[{name:'cff-public-accounts'}],initializeApp:()=>({})},
 'firebase-auth':{getAuth:()=>({}),setPersistence:async()=>{},onAuthStateChanged:(_a,cb)=>{authCallback=cb;queueMicrotask(()=>cb(user));return()=>{};}},
 'firebase-database':{getDatabase:()=>({}),ref:(_d,path)=>path,query:(path,...args)=>({path,args}),orderByKey:()=>({orderBy:'$key'}),limitToLast:n=>({limit:n}),onValue:(reference,cb)=>{const path=typeof reference==='string'?reference:reference.path;if(typeof reference==='object')assert.equal(reference.args[1].limit,100);reads.push(path);if(!subscriptions.has(path))subscriptions.set(path,new Set());subscriptions.get(path).add(cb);queueMicrotask(()=>cb({val:()=>data[path]??null}));return()=>subscriptions.get(path).delete(cb);},get:async path=>({val:()=>data[path]??null})},
 'community-profile-data':{profileOptions:async()=>({frames:[{id:'frame-bronze-1',kind:'frame',image:'/assets/profile-frames/bronze-1.png',frameScale:1.35}]}),approvedImage:(_o,_c,_id,cls)=>`<img class="${cls}" alt="Arte">`,hydrateProfileImages(){}},'profile-role-data':roleData};
 w.__import=async url=>modules[Object.keys(modules).find(k=>url.includes(k))];
 w.fetch=async(_url,init)=>{const body=JSON.parse(init.body);calls.push(body);let result={ok:true};if(body.action==='chatStatus'||body.action==='chatPreferences'){const identity={roleId:admin?'administrator':'member',username:'nakata',badgeIds:body.badgeIds||['earned'],nameColor:''};data['globalChat/identities/person']=identity;emit('globalChat/identities/person');result={...result,administrator:admin,moderator:admin,identity,preference:{badgeIds:body.badgeIds||[]},allowNameColor:admin,ownedBadges:['earned']};}return {ok:true,json:async()=>result};};
 if(disabled)w.document.documentElement.dataset.cffChat='off';
 if(!visible)w.localStorage.setItem('cff-chat-visible-v1','0');
 w.eval(fs.readFileSync('js/chat-visibility.mjs','utf8').replace(/^export /gm,''));
 w.eval(fs.readFileSync('js/profile-emblems.mjs','utf8').replace(/^export /gm,''));
 w.eval(fs.readFileSync('js/profile-frame-model.mjs','utf8').replace(/^export /gm,''));
 w.eval(fs.readFileSync('js/global-chat.js','utf8').replace(/^import .*\n/gm,'').replaceAll('import(','window.__import('));await tick();
 return {w,data,calls,reads,subscriptions,emit,changeUser:next=>authCallback?.(next),open:async()=>{w.document.querySelector('.cff-chat-launch').click();await tick();},close:()=>w.close()};
}
test('chat displays equipped profile frame, updates it live and leaves the avatar and emblem untouched',async()=>{
 const f=await fixture();
 try{
  f.data['communityProfiles/other/frameId']='frame-bronze-1';
  await f.open();
  const row=()=>f.w.document.querySelector('[data-chat-message="'+id+'"]');
  assert.equal(row().querySelector('.cff-chat-avatar')?.tagName,'IMG');
  assert.equal(row().querySelector('.cff-chat-frame-layer img.cff-chat-frame-image')?.tagName,'IMG');
  assert.equal(row().querySelector('.cff-chat-frame-layer').style.getPropertyValue('--cff-chat-frame-scale'),'1.35');
  assert.equal(row().querySelectorAll('.cff-chat-avatar').length,1);
  assert(row().querySelector('.cff-emblem-slot'));
  assert(f.reads.includes('communityProfiles/other/frameId'));
  assert(!f.reads.includes('communityProfiles'));
  // New custom frame is not rendered until an active catalog entry arrives.
  f.data['communityProfiles/other/frameId']='custom-frame';
  f.emit('communityProfiles/other/frameId');
  await tick();
  assert.equal(row().querySelector('.cff-chat-frame-layer'),null);
  f.data['communityProfileCatalog/custom-frame']={enabled:true,kind:'frame',title:'Prata',assetId:'webp-123',frameScale:1.6};
  f.emit('communityProfileCatalog/custom-frame');
  await tick();
  assert.equal(row().querySelector('.cff-chat-frame-layer').style.getPropertyValue('--cff-chat-frame-scale'),'1.6');
  f.data['communityProfileCatalog/custom-frame']={enabled:false,kind:'frame',title:'Prata',assetId:'webp-123'};
  f.emit('communityProfileCatalog/custom-frame');await tick();
  assert.equal(row().querySelector('.cff-chat-frame-layer'),null);
  f.data['communityProfiles/other/frameId']='';
  f.emit('communityProfiles/other/frameId');await tick();
  assert.equal(row().querySelector('.cff-chat-frame-layer'),null);
  assert.equal(row().querySelectorAll('.cff-chat-avatar').length,1);
  f.w.document.querySelector('.cff-chat-close').click();
  assert.equal(f.subscriptions.get('communityProfiles/other/frameId').size,0);
  assert.equal(f.subscriptions.get('communityProfileCatalog/custom-frame').size,0);
 }finally{f.close();}
});
test('public chat keeps bounded subscriptions, updates administrator badge and removes all conversation listeners when closed',async()=>{const f=await fixture({admin:true});try{f.data['globalChat/messages'][replyId]={uid:'person',name:'Nakata',roleId:'member',text:'Salve',at:1791910006000};await f.open();assert.match(f.w.document.querySelector(`[data-chat-message="${replyId}"]`).textContent,/Administrador/);assert.equal(f.w.document.querySelector('[data-chat-moderation]').hidden,false);assert.equal(f.w.document.querySelector('.cff-chat-message-text img'),null);assert.match(f.w.document.querySelector('.cff-chat-message-text').textContent,/<img src=x>/);assert(!f.reads.includes('communityProfiles'));assert(!f.reads.includes('communityProfileCatalog'));assert.equal(f.w.document.querySelector('#cff-global-chat').style.getPropertyValue('--chat-accent'),'#aaffdd');f.w.document.querySelector('.cff-chat-close').click();for(const [path,rows]of f.subscriptions)assert.equal(rows.size,path==='globalChat/latest'?1:0,path);}finally{f.close();}});
test('reply submission carries only the selected reference; action dialog offers reports and earned badge preferences',async()=>{const f=await fixture();try{await f.open();const d=f.w.document;d.querySelector('[data-chat-reply]').click();assert.equal(d.querySelector('[data-chat-replying]').hidden,false);const input=d.querySelector('#cff-chat-text');input.value='Respondendo @alice';input.dispatchEvent(new f.w.Event('input'));d.querySelector('.cff-chat-composer').dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await tick();const sent=f.calls.find(c=>c.action==='chatSend');assert.equal(sent.replyTo,id);assert.equal(sent.text,'Respondendo @alice');assert.equal(d.querySelector('[data-chat-replying]').hidden,true);d.querySelector('[data-chat-options]').click();assert(d.querySelector('[data-chat-action-dialog]').open);const choices=[...d.querySelector('[name=operation]').options].map(o=>o.value);assert(choices.includes('report'));assert(!choices.includes('delete'));d.querySelector('[data-close-dialog]').click();d.querySelector('[data-chat-personalize]').click();await tick();assert.match(d.querySelector('[data-chat-badge-options]').textContent,/Campeão/);d.querySelector('[name=badges]').checked=true;d.querySelector('[data-chat-preferences-form]').dispatchEvent(new f.w.Event('submit',{cancelable:true}));await tick();assert.deepEqual(f.calls.find(c=>c.action==='chatPreferences').badgeIds,['earned']);}finally{f.close();}});
test('mentions highlight only the intended account, revoked badge selection clears and message actions include moderation for the actual admin',async()=>{const f=await fixture({admin:true});try{f.data['globalChat/messages'][id].mentions=[{uid:'person',username:'nakata'}];f.data['globalChat/identities/other']={roleId:'moderator',badgeIds:['earned']};await f.open();const d=f.w.document;assert(d.querySelector('.is-mentioned'));assert(d.querySelector('[data-chat-badge]'));f.data['globalChat/identities/other']={roleId:'member'};f.emit('globalChat/identities/other');await tick();assert.equal(d.querySelector('[data-chat-badge]'),null);d.querySelector('[data-chat-options]').click();const select=d.querySelector('[name=operation]');assert([...select.options].some(o=>o.value==='pin'));select.value='mute';select.dispatchEvent(new f.w.Event('change'));assert.equal(d.querySelector('[data-chat-duration]').hidden,false);}finally{f.close();}});
test('admin panel starts with appearance preview, finds a person by handle and sends a confirmed moderator assignment',async()=>{const html=fs.readFileSync('admin-chat.html','utf8'),dom=new JSDOM(html,{url:'https://centralfreefire.com.br/admin-chat.html',runScripts:'outside-only'}),w=dom.window,calls=[];try{const user={uid:'admin',email:'admin@centralfreefire.com.br',getIdToken:async()=>'token'};w.AbortSignal=AbortSignal;Object.assign(w,{initializeApp:()=>({}),getApps:()=>[],getAuth:()=>({}),browserLocalPersistence:{},getDatabase:()=>({}),ref:(_db,p)=>p,get:async()=>({val:()=>null}),setPersistence:async()=>{},onAuthStateChanged:(_auth,cb)=>{queueMicrotask(()=>cb(user));},GoogleAuthProvider:function(){},signInWithPopup:async()=>{}});w.CFF_CONFIG={firebase:{}};w.fetch=async(_url,init)=>{const b=JSON.parse(init.body);calls.push(b);return{ok:true,json:async()=>b.action==='chatStatus'?{moderator:true}:b.operation==='findPerson'?{recipient:{uid:'target',name:'Alice',username:'alice',path:'/conta.html?u=target'},roles:{},style:{}}:{ok:true,rows:{}}};};const source=fs.readFileSync('js/admin-chat.js','utf8').replace(/^import .*\n/gm,'');await w.eval('(async()=>{'+source+'})()');await tick();assert.equal(w.document.querySelector('#chat-admin-app').hidden,false);const settings=w.document.querySelector('#chat-settings');settings.elements.accent.value='#ffddee';settings.dispatchEvent(new w.Event('input'));assert.equal(w.document.querySelector('#chat-preview').style.getPropertyValue('--preview-accent'),'#ffddee');w.document.querySelector('[data-chat-tab=people]').click();await tick();const form=w.document.querySelector('#chat-person-search');form.elements.query.value='@alice';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.match(w.document.querySelector('#chat-person-result').textContent,/Alice/);w.document.querySelector('#chat-person-role').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();const mutation=calls.find(c=>c.operation==='moderator');assert.equal(mutation.targetUid,'target');assert.equal(mutation.expectedUsername,'alice');assert.equal(mutation.enabled,true);}finally{w.close();}});

test('chat displays only the authoritative emblem and keeps it after appearance redraws, grant and revoke',async()=>{const f=await fixture();try{f.data['globalChat/messages'][id].emblemId='verified';await f.open();const slot=()=>f.w.document.querySelector(`[data-chat-message="${id}"] [data-emblem-uid="other"]`);assert.equal(slot().children.length,0);f.data['communityEmblemAssignments/other']={emblemId:'verified'};f.emit('communityEmblemAssignments/other');await tick();assert.match(slot().textContent,/✓/);f.data['communityRoleCatalog']={member:{label:'Comunidade',color:'#aaffdd'}};f.emit('communityRoleCatalog');await tick();assert.match(slot().textContent,/✓/);f.data['globalChat/identities/other']={roleId:'moderator'};f.emit('globalChat/identities/other');await tick();assert.match(slot().textContent,/✓/);f.data['communityEmblemAssignments/other']=null;f.emit('communityEmblemAssignments/other');await tick();assert.equal(slot().children.length,0);assert(!f.reads.includes('communityEmblemAssignments'));f.w.document.querySelector('.cff-chat-close').click();assert.equal(f.subscriptions.get('communityEmblemAssignments/other').size,0);}finally{f.close();}});

test('saved profile role overrides stale chat identities and updates old messages immediately, including revocation',async()=>{const f=await fixture();try{f.data['communityAccountRoles/other']={roleId:'moderator'};f.data['globalChat/identities/other']={roleId:'member'};await f.open();const role=()=>f.w.document.querySelector(`[data-chat-message="${id}"] .cff-chat-role`).textContent;assert.equal(role(),'Moderador');f.data['communityAccountRoles/other']={roleId:'influencer'};f.emit('communityAccountRoles/other');await tick();assert.equal(role(),'Influenciador');f.data['communityAccountRoles/other']=null;f.emit('communityAccountRoles/other');await tick();assert.equal(role(),'Membro');assert(!f.reads.includes('communityAccountRoles'));f.w.document.querySelector('.cff-chat-close').click();for(const [path,callbacks]of f.subscriptions)if(path.startsWith('communityAccountRoles/'))assert.equal(callbacks.size,0,path);}finally{f.close();}});
test('a protected administrator identity keeps its badge even when its cosmetic profile role is member',async()=>{const f=await fixture();try{f.data['communityAccountRoles/other']={roleId:'member'};f.data['globalChat/identities/other']={roleId:'administrator',realAdministrator:true};await f.open();assert.equal(f.w.document.querySelector(`[data-chat-message="${id}"] .cff-chat-role`).textContent,'Administrador');assert(f.w.document.querySelector('[data-chat-moderation]').hidden);}finally{f.close();}});
test('participant role observers are removed when their messages leave the bounded history',async()=>{const f=await fixture();try{await f.open();assert.equal(f.subscriptions.get('communityAccountRoles/other').size,1);f.data['globalChat/messages']={[replyId]:{uid:'someone',name:'Outro',roleId:'member',text:'Oi',at:1791910006000}};f.emit('globalChat/messages');await tick();assert.equal(f.subscriptions.get('communityAccountRoles/other').size,0);assert.equal(f.subscriptions.get('communityAccountRoles/someone').size,1);}finally{f.close();}});


test('hiding the chat closes it without stealing focus and stops every listener, including unread notifications',async()=>{
 const f=await fixture();try{
  await f.open();const d=f.w.document,control=d.createElement('button');d.body.append(control);control.focus();
  f.w.setChatVisible(false);
  assert.equal(d.getElementById('cff-global-chat').hidden,true);
  assert.equal(d.getElementById('cff-chat-panel').hidden,true);
  assert.equal(d.activeElement,control);
  for(const [path,callbacks]of f.subscriptions)assert.equal(callbacks.size,0,path);
  assert.equal(f.w.localStorage.getItem('cff-chat-visible-v1'),'0');
  d.querySelector('.cff-chat-launch').click();await tick();
  for(const [path,callbacks]of f.subscriptions)assert.equal(callbacks.size,0,path);
  f.w.setChatVisible(true);await tick();
  assert.equal(d.getElementById('cff-global-chat').hidden,false);
  assert.equal(f.subscriptions.get('globalChat/latest').size,1);
  assert.equal(d.getElementById('cff-chat-panel').hidden,true);
  await f.open();assert.equal(d.getElementById('cff-chat-panel').hidden,false);
 }finally{f.close();}
});
test('a saved hidden preference starts with no database subscriptions and can be restored from another tab',async()=>{
 const f=await fixture({visible:false});try{
  assert.equal(f.w.document.getElementById('cff-global-chat').hidden,true);
  assert.equal(f.reads.length,0);assert.equal(f.calls.length,0);
  f.w.localStorage.setItem('cff-chat-visible-v1','1');
  f.w.dispatchEvent(new f.w.StorageEvent('storage',{key:'cff-chat-visible-v1',newValue:'1'}));await tick();
  assert.equal(f.w.document.getElementById('cff-global-chat').hidden,false);
  assert.deepEqual(f.reads,['globalChat/latest']);
  f.w.localStorage.setItem('cff-chat-visible-v1','0');
  f.w.dispatchEvent(new f.w.StorageEvent('storage',{key:'cff-chat-visible-v1',newValue:'0'}));
  assert.equal(f.w.document.getElementById('cff-global-chat').hidden,true);
  assert.equal(f.subscriptions.get('globalChat/latest').size,0);
 }finally{f.close();}
});

test('administrative routes never mount the widget, load its styles or subscribe to the conversation',async()=>{
 for(const path of ['/admin.html','/admin-carreiras.html','/admin-chat.html','/admin-perfis.html','/admin/','/tools/admin-tarefas.html']){
  const f=await fixture({path});try{assert.equal(f.w.document.getElementById('cff-global-chat'),null,path);assert.equal(f.w.document.querySelector('link[href*="global-chat.css"]'),null);assert.equal(f.reads.length,0);assert.equal(f.calls.length,0);}finally{f.close();}
 }
 const f=await fixture({disabled:true});try{assert.equal(f.w.document.getElementById('cff-global-chat'),null);assert.equal(f.reads.length,0);}finally{f.close();}
});
test('own messages face the other side and author alignment follows account changes',async()=>{
 const f=await fixture();try{
  f.data['globalChat/messages'][replyId]={uid:'person',name:'Nakata',roleId:'member',text:'Minha mensagem',at:1791910006000};await f.open();const d=f.w.document,own=()=>d.querySelector(`[data-chat-message="${replyId}"]`),other=()=>d.querySelector(`[data-chat-message="${id}"]`);
  assert(own().classList.contains('is-own'));assert(!other().classList.contains('is-own'));
  const style=d.createElement('style');style.textContent=fs.readFileSync('css/global-chat.css','utf8');d.head.append(style);
  assert.equal(f.w.getComputedStyle(own()).flexDirection,'row-reverse');assert.equal(parseFloat(f.w.getComputedStyle(own().querySelector('.cff-chat-message-text')).borderTopRightRadius),0);
  assert.equal(parseFloat(f.w.getComputedStyle(other().querySelector('.cff-chat-message-text')).borderTopLeftRadius),0);
  f.changeUser(null);await tick();assert(!own().classList.contains('is-own'));assert(!other().classList.contains('is-own'));
  f.changeUser({uid:'other',email:'other@test',getIdToken:async()=>'token'});await tick();assert(!own().classList.contains('is-own'));assert(other().classList.contains('is-own'));
 }finally{f.close();}
});
test('giveaway form styles cannot stretch the launcher or alter chat buttons',async()=>{
 const f=await fixture({path:'/sorteio-comunidade.html'});try{
  const d=f.w.document,style=d.createElement('style'),giveaway=fs.readFileSync('sorteio-comunidade.html','utf8');style.textContent=giveaway.match(/<style>([\s\S]*?)<\/style>/)[1]+fs.readFileSync('css/global-chat.css','utf8');d.head.append(style);
  const shell=d.createElement('main');shell.className='shell';shell.innerHTML='<button>Participar do sorteio</button>';d.body.append(shell);
  assert.equal(f.w.getComputedStyle(shell.querySelector('button')).width,'100%');assert.equal(f.w.getComputedStyle(d.querySelector('.cff-chat-launch')).width,'max-content');assert.equal(f.w.getComputedStyle(d.querySelector('.cff-chat-launch')).height,'auto');
  assert.equal(f.w.getComputedStyle(d.querySelector('.cff-chat-close')).width,'32px');assert.equal(f.w.getComputedStyle(d.querySelector('.cff-chat-close')).height,'32px');
  assert.equal(f.w.getComputedStyle(d.querySelector('.cff-chat-launch')).textTransform,'none');
 }finally{f.close();}
});
test('the shared bootstrap skips public chat imports on admin pages and supports an explicit page opt-out',async()=>{
 const source=fs.readFileSync('js/config.min.js','utf8').replaceAll('import(','window.__import(');
 for(const [path,disabled,expected]of [['/admin.html',false,0],['/admin-chat.html',false,0],['/admin/tarefas',false,0],['/index.html',false,1],['/sorteio-comunidade.html',false,1],['/conta.html',true,0]]){
  const dom=new JSDOM('<body></body>',{url:'https://centralfreefire.com.br'+path,runScripts:'outside-only'}),w=dom.window,calls=[];
  try{if(disabled)w.document.documentElement.dataset.cffChat='off';w.__import=async url=>calls.push(url);w.eval(source);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await tick();assert.equal(calls.length,expected,path);assert(calls.every(url=>url.includes('global-chat.js?v=20261020-chat-layout-v1')));}finally{w.close();}
 }
 for(const path of ['admin-chat.html','admin-perfis.html'])assert(!fs.readFileSync(path,'utf8').includes('src="/js/global-chat.js'));
});
