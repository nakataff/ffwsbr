const VERSION='20261013-code-gifts-v1';
const SERVICE='https://cff-camp-notifications.nakataffb4.workers.dev/api';
const ADMIN='admin@centralfreefire.com.br';
const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-4 3V11.5A7.5 7.5 0 0 1 9.5 4h3a7.5 7.5 0 0 1 7.5 7.5Z"/><path d="M7 10h8M7 14h5"/></svg>';
if(!document.getElementById('cff-global-chat'))mountChat();
function mountChat(){
 const css=document.createElement('link');css.rel='stylesheet';css.href='/css/global-chat.css?v='+VERSION;document.head.append(css);
 const host=document.createElement('div');host.id='cff-global-chat';
 host.innerHTML=`<button type="button" class="cff-chat-launch" aria-label="Abrir chat global" aria-expanded="false" aria-controls="cff-chat-panel">${icon}<span>Chat global</span></button><section id="cff-chat-panel" class="cff-chat-panel" role="dialog" aria-modal="false" aria-labelledby="cff-chat-title" hidden><header class="cff-chat-head"><div class="cff-chat-brand">${icon}<div><small>COMUNIDADE CENTRAL</small><h2 id="cff-chat-title">Chat global</h2></div></div><button type="button" class="cff-chat-close" aria-label="Fechar chat">×</button></header><div class="cff-chat-subhead"><span data-chat-connection>Conectando…</span><button type="button" data-chat-moderation hidden>Moderação</button></div><div class="cff-chat-mod-panel" data-chat-mod-panel hidden><strong>Usuários restringidos</strong><p>O cargo Moderador é atribuído na aba Cargos do painel de perfis.</p><div data-chat-restrictions></div></div><div class="cff-chat-action-panel" data-chat-action-panel hidden><form data-chat-action-form><strong data-chat-action-name></strong><label>Ação<select name="operation"><option value="delete">Apagar esta mensagem</option><option value="mute">Silenciar por 10 minutos</option><option value="block">Bloquear envio de mensagens</option></select></label><label>Motivo opcional<input name="reason" maxlength="160" placeholder="Ex.: spam ou ofensas"></label><div><button type="submit">Aplicar</button><button type="button" data-chat-cancel-action>Cancelar</button></div></form></div><div class="cff-chat-timeline" role="log" aria-label="Mensagens do chat" aria-live="off" aria-relevant="additions text" tabindex="0"><p class="cff-chat-empty">Carregando a conversa…</p></div><button type="button" class="cff-chat-new" data-chat-new hidden>Novas mensagens ↓</button><form class="cff-chat-composer"><p data-chat-account></p><label class="cff-chat-sr-only" for="cff-chat-text">Sua mensagem</label><textarea id="cff-chat-text" name="text" maxlength="500" rows="2" placeholder="Converse com a comunidade…" disabled></textarea><div class="cff-chat-compose-footer"><small data-chat-counter>0/500</small><button type="submit" disabled>Enviar <span aria-hidden="true">↗</span></button></div><p class="cff-chat-status" role="status" data-chat-status></p></form><footer class="cff-chat-foot">Respeite a comunidade · últimas 100 mensagens</footer></section>`;
 document.body.append(host);
 const $=selector=>host.querySelector(selector),panel=$('#cff-chat-panel'),launch=$('.cff-chat-launch'),timeline=$('.cff-chat-timeline'),composer=$('.cff-chat-composer'),input=$('#cff-chat-text'),send=composer.querySelector('[type=submit]'),status=$('[data-chat-status]');
 let deps,dependencyPromise,app,auth,db,user=null,roles={},profile={},restriction=null,stops=[],modStop=null,catalog={},defaults={},roleCatalog={},options={},connected=false,sending=false,open=false,generation=0,firstSnapshot=true,selection=null,cooldownUntil=0,restrictionRows={};
 let latestChat=null,lastSeen='';try{lastSeen=localStorage.getItem('cff_chat_last_seen_v1')||'';}catch{}
 const updateUnread=()=>{const unread=!!latestChat?.id&&latestChat.id!==lastSeen;launch.classList.toggle('has-unread',unread);launch.setAttribute('aria-label',unread?'Abrir chat global · novas mensagens':'Abrir chat global');};
 const markRead=()=>{if(!latestChat?.id||document.hidden)return;lastSeen=latestChat.id;try{localStorage.setItem('cff_chat_last_seen_v1',lastSeen);}catch{}updateUnread();};
 let unreadStop=null,unreadStarting=false,unreadPageActive=true;
 const startUnread=async()=>{if(unreadStop||unreadStarting)return;unreadStarting=true;try{const [a,d]=await Promise.all([import('https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js')]);const config=window.CFF_CONFIG?.firebase;if(!config||!unreadPageActive)return;const existing=a.getApps().find(x=>x.name==='[DEFAULT]')||a.initializeApp(config);unreadStop=d.onValue(d.ref(d.getDatabase(existing),'globalChat/latest'),snapshot=>{latestChat=snapshot.val();if(open)markRead();else updateUnread();});}catch{}finally{unreadStarting=false;}};
 startUnread();window.addEventListener('pagehide',()=>{unreadPageActive=false;unreadStop?.();unreadStop=null;});window.addEventListener('pageshow',event=>{unreadPageActive=true;if(event.persisted)startUnread();});
 window.addEventListener('storage',event=>{if(event.key==='cff_chat_last_seen_v1'){lastSeen=event.newValue||'';updateUnread();}});
 document.addEventListener('visibilitychange',()=>{if(open&&!document.hidden)markRead();});
 const nodes=new Map();
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const isModerator=()=>user?.email===ADMIN||roles.roleId==='moderator';
 const say=text=>{status.textContent=text;};
 const listen=(path,callback,error)=>{const seq=generation;return deps.database.onValue(deps.database.ref(db,path),snapshot=>{if(open&&seq===generation)callback(snapshot.val());},error||(()=>{}));};
 async function dependencies(){
  if(deps)return deps;
  return dependencyPromise||=(async()=>{
  const [appModule,authModule,database,images,roleData]=await Promise.all([import('https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js'),import('/js/community-profile-data.js?v=20261013-profile-frames-v1'),import('/js/profile-role-data.mjs?v=20261012-profile-admin-v1')]);
  const config=window.CFF_CONFIG?.firebase;if(!config)throw Error('Não foi possível carregar o chat. Atualize a página.');
  const adminApp=/^\/admin(?:[-.]|\/)/i.test(location.pathname)?appModule.getApps().find(x=>x.name==='[DEFAULT]'):null;
  app=adminApp||appModule.getApps().find(x=>x.name==='cff-public-accounts')||appModule.initializeApp(config,'cff-public-accounts');auth=authModule.getAuth(app);db=database.getDatabase(app);await authModule.setPersistence(auth,authModule.browserLocalPersistence);
  options=await images.profileOptions().catch(()=>({}));deps={app:appModule,auth:authModule,database,images,roleData};return deps;
  })().catch(error=>{dependencyPromise=null;throw error;});
 }
 async function api(action,body={}){
  const current=user;if(!current)throw Error('Entre com Google para participar.');
  const token=await current.getIdToken(),response=await fetch(SERVICE,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action,...body})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Não foi possível concluir a ação.');return result;
 }
 function availability(){
  if(!open)return;
  const registered=!!profile.name&&/^[a-z0-9_]{3,24}$/.test(profile.username||'')&&['masculino','feminino'].includes(profile.gender),limited=user?.email!==ADMIN&&(restriction?.blocked||Number(restriction?.mutedUntil)>Date.now());
  input.disabled=!user||!registered||profile.public===false||limited||sending;send.disabled=input.disabled||!connected||!input.value.trim()||Date.now()<cooldownUntil;
  const account=$('[data-chat-account]');
  const markup=!user?'<button type="button" data-chat-login>Entrar com Google para conversar</button>':!registered&&user.email===ADMIN?'Conta administrativa · moderação habilitada':!registered?'<a href="/conta.html">Complete seu cadastro para participar →</a>':profile.public===false?'<a href="/conta.html">Deixe seu perfil público para participar →</a>':esc(limited?(restriction.blocked?'Envio bloqueado pela moderação.':'Silenciado até '+new Date(restriction.mutedUntil).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+'.'):'Conversando como '+profile.name);
  if(account.dataset.markup!==markup){account.dataset.markup=markup;account.innerHTML=markup;}
  $('[data-chat-moderation]').hidden=!isModerator();
  if(!isModerator()){$('[data-chat-mod-panel]').hidden=true;$('[data-chat-action-panel]').hidden=true;modStop?.();modStop=null;}
  for(const node of nodes.values())node.querySelector('[data-chat-options]').hidden=!isModerator();
 }
 function renderMessage(id,message){
  let node=nodes.get(id);if(!node){node=document.createElement('article');node.className='cff-chat-message';node.dataset.chatMessage=id;nodes.set(id,node);}
  const role=deps.roleData.roleForAccount({roleId:message.roleId||'member'},roleCatalog),signature=JSON.stringify([message,catalog[message.avatarId],role]);
  if(node.dataset.signature===signature)return node;node.dataset.signature=signature;
  const uid=/^[A-Za-z0-9_-]{1,128}$/.test(message.uid||'')?message.uid:'',path='/conta.html?u='+encodeURIComponent(uid),date=new Date(Number(message.at)||0);
  node.innerHTML=`<a class="cff-chat-photo" href="${path}" aria-label="Ver perfil de ${esc(message.name)}">${deps.images.approvedImage(options,catalog,message.avatarId||defaults.avatarId||'default','cff-chat-avatar',message.name)}</a><div class="cff-chat-message-body"><div class="cff-chat-message-top"><a href="${path}">${esc(message.name||'Membro da Central')}</a><time datetime="${date.toISOString()}">${esc(date.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}))}</time><button type="button" data-chat-options="${esc(id)}" aria-label="Moderar mensagem de ${esc(message.name)}"${isModerator()?'':' hidden'}>⋯</button></div><span class="cff-chat-role"></span><p class="cff-chat-message-text"></p></div>`;
  const badge=node.querySelector('.cff-chat-role');badge.textContent=role.label;badge.style.color=role.color;node.querySelector('.cff-chat-message-text').textContent=String(message.text||'');node._chatMessage=message;return node;
 }
 function renderMessages(messages){
  const atBottom=timeline.scrollHeight-timeline.scrollTop-timeline.clientHeight<80,entries=Object.entries(messages||{}).sort(([a],[b])=>a.localeCompare(b)).slice(-100),ids=new Set(entries.map(([id])=>id));let added=false;
  timeline.querySelector('.cff-chat-empty')?.remove();
  for(const [id,node] of nodes)if(!ids.has(id)){node.remove();nodes.delete(id);}
  let cursor=timeline.firstElementChild;
  for(const [id,message]of entries){if(!nodes.has(id))added=true;const node=renderMessage(id,message);if(node!==cursor)timeline.insertBefore(node,cursor);cursor=node.nextElementSibling;}
  if(!entries.length){const empty=document.createElement('p');empty.className='cff-chat-empty';empty.textContent='A conversa começa aqui. Mande a primeira mensagem!';timeline.append(empty);}
  deps.images.hydrateProfileImages(timeline,db);
  if(firstSnapshot||atBottom){timeline.scrollTop=timeline.scrollHeight;$('[data-chat-new]').hidden=true;}else if(added)$('[data-chat-new]').hidden=false;
  firstSnapshot=false;timeline.setAttribute('aria-live','polite');
 }
 function renderRestrictions(){
  const list=$('[data-chat-restrictions]'),active=Object.entries(restrictionRows||{}).filter(([,item])=>item.blocked||Number(item.mutedUntil)>Date.now()),signature=JSON.stringify(active);if(list.dataset.signature===signature)return;list.dataset.signature=signature;list.replaceChildren();
  for(const [uid,item]of active){
   if(!item.blocked&&Number(item.mutedUntil)<=Date.now())continue;
   const row=document.createElement('div');row.className='cff-chat-restriction';const name=document.createElement('span');name.textContent=(item.name||'Membro')+' · '+(item.blocked?'Bloqueado':'Silenciado');const button=document.createElement('button');button.type='button';button.textContent='Liberar';button.dataset.chatRelease=uid;row.append(name,button);list.append(row);
  }
  if(!list.childElementCount)list.textContent='Nenhuma restrição ativa.';
 }
 async function show(){
  if(open)return;open=true;markRead();const seq=++generation;firstSnapshot=true;panel.hidden=false;launch.setAttribute('aria-expanded','true');document.body.classList.toggle('cff-chat-mobile-open',matchMedia('(max-width:600px)').matches);panel.setAttribute('aria-modal',String(matchMedia('(max-width:600px)').matches));$('.cff-chat-close').focus();
  try{await dependencies();if(!open||seq!==generation)return;
   stops.push(listen('.info/connected',value=>{connected=value===true;$('[data-chat-connection]').textContent=connected?'● Ao vivo':'○ Reconectando…';availability();}));
   stops.push(listen('communityProfileCatalog',value=>{catalog=value||{};for(const [id,node]of nodes)renderMessage(id,node._chatMessage);deps.images.hydrateProfileImages(timeline,db);}));
   stops.push(listen('communityProfileDefaults',value=>{defaults=value||{};}));
   stops.push(listen('communityRoleCatalog',value=>{roleCatalog=value||{};for(const [id,node]of nodes)renderMessage(id,node._chatMessage);}));
   const feed=deps.database.query(deps.database.ref(db,'globalChat/messages'),deps.database.orderByKey(),deps.database.limitToLast(100));
   stops.push(deps.database.onValue(feed,snapshot=>{if(open)renderMessages(snapshot.val());},()=>{say('Não foi possível carregar as mensagens. Feche e abra o chat para tentar novamente.');}));
   let accountStops=[];stops.push(()=>accountStops.forEach(fn=>fn()));
   stops.push(deps.auth.onAuthStateChanged(auth,next=>{if(!open||seq!==generation)return;accountStops.forEach(fn=>fn());accountStops=[];modStop?.();modStop=null;user=next;roles={};profile={};restriction=null;$('[data-chat-mod-panel]').hidden=true;availability();if(!next)return;const uid=next.uid;
    const observe=(path,callback)=>accountStops.push(listen(path,value=>{if(user?.uid===uid)callback(value);}));
    observe('userAccounts/'+uid+'/profile',value=>{profile=value||{};availability();});observe('communityAccountRoles/'+uid,value=>{roles=value||{};availability();});observe('globalChat/restrictions/'+uid,value=>{restriction=value;availability();});
   }));
   const tick=setInterval(()=>{availability();if(!$('[data-chat-mod-panel]').hidden)renderRestrictions();},1000);stops.push(()=>clearInterval(tick));say('');
  }catch(error){say(error.message||'Não foi possível abrir o chat.');}
 }
 function hide(){if(!open)return;open=false;generation++;stops.splice(0).forEach(fn=>fn());modStop?.();modStop=null;panel.hidden=true;document.body.classList.remove('cff-chat-mobile-open');launch.setAttribute('aria-expanded','false');launch.focus();}
 launch.addEventListener('click',()=>open?hide():show());$('.cff-chat-close').addEventListener('click',hide);
 timeline.addEventListener('scroll',()=>{if(timeline.scrollHeight-timeline.scrollTop-timeline.clientHeight<80)$('[data-chat-new]').hidden=true;});
 $('[data-chat-new]').addEventListener('click',()=>{timeline.scrollTop=timeline.scrollHeight;$('[data-chat-new]').hidden=true;});
 input.addEventListener('input',()=>{$('[data-chat-counter]').textContent=input.value.length+'/500';availability();});
 input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();if(!send.disabled)composer.requestSubmit();}});
 composer.addEventListener('submit',async event=>{event.preventDefault();if(send.disabled)return;const text=input.value.trim();sending=true;availability();say('Enviando…');try{await api('chatSend',{text});input.value='';$('[data-chat-counter]').textContent='0/500';cooldownUntil=Date.now()+5000;timeline.scrollTop=timeline.scrollHeight;say('Mensagem enviada.');}catch(error){say(error.message);}finally{sending=false;availability();if(open&&!input.disabled)input.focus();}});
 host.addEventListener('click',async event=>{
  const login=event.target.closest('[data-chat-login]');if(login){try{if(window.CFF_ACCOUNT?.login)await window.CFF_ACCOUNT.login();else{const provider=new deps.auth.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await deps.auth.signInWithPopup(auth,provider);}}catch{say('Não foi possível entrar. Tente pela página Minha conta.');}return;}
  if(event.target.closest('[data-chat-moderation]')){const block=$('[data-chat-mod-panel]');block.hidden=!block.hidden;if(!block.hidden&&!modStop)modStop=listen('globalChat/restrictions',value=>{restrictionRows=value||{};renderRestrictions();},()=>say('Não foi possível carregar as restrições.'));return;}
  const action=event.target.closest('[data-chat-options]');if(action&&isModerator()){const node=nodes.get(action.dataset.chatOptions);if(!node)return;selection={id:action.dataset.chatOptions,...node._chatMessage};$('[data-chat-action-name]').textContent='Moderar · '+selection.name;const select=$('[data-chat-action-form]').elements.operation;for(const option of select.options)option.disabled=option.value!=='delete'&&selection.uid===user?.uid;select.value='delete';$('[data-chat-action-panel]').hidden=false;select.focus();return;}
  if(event.target.closest('[data-chat-cancel-action]')){$('[data-chat-action-panel]').hidden=true;selection=null;return;}
  const release=event.target.closest('[data-chat-release]');if(release){release.disabled=true;try{await api('chatModerate',{operation:'release',targetUid:release.dataset.chatRelease});say('Envio liberado para esta conta.');}catch(error){say(error.message);}finally{release.disabled=false;}}
 });
 $('[data-chat-action-form]').addEventListener('submit',async event=>{event.preventDefault();if(!selection)return;const form=event.currentTarget,button=form.querySelector('[type=submit]');button.disabled=true;try{await api('chatModerate',{operation:form.elements.operation.value,messageId:selection.id,targetUid:selection.uid,reason:form.elements.reason.value});$('[data-chat-action-panel]').hidden=true;form.elements.reason.value='';selection=null;say('Moderação aplicada.');}catch(error){say(error.message);}finally{button.disabled=false;}});
 document.addEventListener('keydown',event=>{if(!open)return;if(event.key==='Escape'){event.preventDefault();hide();}else if(event.key==='Tab'&&matchMedia('(max-width:600px)').matches){const controls=[...panel.querySelectorAll('button:not(:disabled),a,input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});
 const viewport=()=>{host.style.setProperty('--cff-chat-vh',(window.visualViewport?.height||innerHeight)+'px');host.style.setProperty('--cff-chat-top',(window.visualViewport?.offsetTop||0)+'px');};viewport();window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);
 window.addEventListener('pagehide',()=>{if(open)hide();});
}
