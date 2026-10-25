import {inboxSnapshot,publishInbox,forgetInbox,subscribeInbox} from './inbox-store.mjs?v=20261019-inbox-v1';
import {walletSnapshot,walletFresh,publishWalletBalance,forgetWalletBalance,subscribeWalletBalance} from './wallet-balance.mjs?v=20261017-header-wallet-v1';

export function createHeaderWallet({auth,request,defer=()=>false,loadInbox=()=>import('./inbox-popover.mjs?v=20261020-inbox-popover-v1')}){
 let uid='',pending=null,retryAfter=0,popover=null,inboxJob=null,inboxGeneration=0;
 const getUid=()=>auth()?.currentUser?.uid||'';
 function links(){
  return [...document.querySelectorAll('[data-account-entry]')].map(entry=>{
   let group=entry.parentElement;
   if(!group?.matches('[data-account-access-group]')){group=document.createElement('span');group.className='cff-account-access-group';group.dataset.accountAccessGroup='1';entry.before(group);group.append(entry);}
   let link=group.querySelector('[data-header-wallet]');
   if(!link){link=document.createElement('a');link.dataset.headerWallet='1';link.className='cff-header-wallet';link.href='/conta.html?tab=points&shopSection=shop#eco-shop';link.hidden=true;link.innerHTML='<img src="/edition/moeda%20cff.webp" width="32" height="32" alt="" decoding="async"><span><strong data-wallet-value>—</strong><small>CFF COINS</small></span>';group.prepend(link);}
   let inbox=group.querySelector('[data-header-inbox]');if(!inbox){inbox=document.createElement('a');inbox.dataset.headerInbox='1';inbox.className='cff-header-inbox';inbox.href='/conta.html?tab=inbox';inbox.innerHTML='<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg><i hidden></i>';group.insertBefore(inbox,entry);}
   const summary=inboxSnapshot(uid);inbox.hidden=!uid;inbox.querySelector('i').hidden=!summary?.hasNew;inbox.setAttribute('aria-label',summary?.hasNew?'Caixa de entrada: há novidades':'Abrir caixa de entrada');inbox.title='Caixa de entrada';inbox.setAttribute('aria-haspopup','dialog');inbox.setAttribute('aria-controls','cff-inbox-popover');if(!inbox.hasAttribute('aria-expanded'))inbox.setAttribute('aria-expanded','false');
   return link;
  });
 }
 function draw(){
  const value=walletSnapshot(uid),label=value?value.balance.toLocaleString('pt-BR'):'—';
  for(const link of links()){
   link.hidden=!uid;link.querySelector('[data-wallet-value]').textContent=label;
   link.setAttribute('aria-label',value?`Seu saldo: ${label} CFF COINS. Abrir loja.`:'Consultar meu saldo de CFF COINS e abrir loja.');
   link.title=value?(walletFresh(value)?`${label} CFF COINS · Abrir loja`:'Saldo salvo: '+label+' CFF COINS · Abra a loja para atualizar'):'Ver saldo e loja';
  }
 }
 async function load(){
  const current=uid,startedAt=Date.now(),inbox=inboxSnapshot(current),needsWallet=!defer()&&!walletFresh(walletSnapshot(current)),needsInbox=!inbox||startedAt-inbox.at>=60000;
  if(!current||pending||document.visibilityState==='hidden'||Date.now()<retryAfter||!needsWallet&&!needsInbox)return;
  const job=Promise.resolve().then(()=>request(auth(),needsWallet?'wallet':'inboxSummary',needsWallet?{includeInbox:true}:{})).then(result=>{if(uid===current&&getUid()===current){if(needsWallet){const cached=walletSnapshot(current);if(!(cached?.at>startedAt)&&(!walletFresh(cached)||cached.balance!==result.wallet?.balance))publishWalletBalance(current,result.wallet);}const summary=result.inbox||result.summary;if(summary&&!(inboxSnapshot(current)?.at>startedAt))publishInbox(current,summary);}}).catch(()=>{if(uid===current)retryAfter=Date.now()+60000;}).finally(()=>{if(pending===job)pending=null;if(uid===current)draw();});pending=job;return job;
 }
 function sync(){
  const current=getUid();if(current!==uid){++inboxGeneration;popover?.destroy();popover=null;inboxJob=null;document.querySelectorAll('[data-header-inbox]').forEach(n=>n.setAttribute('aria-expanded','false'));if(uid){forgetWalletBalance(uid);forgetInbox(uid);}uid=current;pending=null;retryAfter=0;}
  draw();if(uid)load();
 }
 const inboxClick=event=>{
  const trigger=event.target.closest('[data-header-inbox]');if(!trigger||trigger.hidden||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||!getUid())return;
  event.preventDefault();if(popover){if(popover.isOpen)popover.close();else popover.open(trigger);return;}if(inboxJob)return;
  const current=getUid(),generation=inboxGeneration;trigger.setAttribute('aria-busy','true');
  const job=Promise.resolve().then(loadInbox).then(module=>{if(generation!==inboxGeneration||current!==getUid())return;popover=module.createInboxPopover({auth,request});popover.open(trigger);}).catch(()=>{if(generation===inboxGeneration&&current===getUid())window.location.assign(trigger.href);}).finally(()=>{trigger.removeAttribute('aria-busy');if(inboxJob===job)inboxJob=null;});inboxJob=job;
 };
 document.addEventListener('click',inboxClick);
 const stopInbox=subscribeInbox(()=>draw());
 const unsubscribe=subscribeWalletBalance(value=>{if(value.uid===uid&&getUid()===uid)draw();});
 const resume=()=>{if(getUid()===uid&&uid){draw();load();}};
 window.addEventListener('focus',resume);window.addEventListener('pageshow',resume);
 document.addEventListener('visibilitychange',resume);
 if(!document.querySelector('[data-header-wallet-style]')){const style=document.createElement('link');style.rel='stylesheet';style.href='/css/header-wallet.css?v=20261023-inbox-alerts-v1';style.dataset.headerWalletStyle='1';document.head.append(style);}
 return {sync,stop(){++inboxGeneration;popover?.destroy();popover=null;inboxJob=null;document.removeEventListener('click',inboxClick);unsubscribe();stopInbox();window.removeEventListener('focus',resume);window.removeEventListener('pageshow',resume);document.removeEventListener('visibilitychange',resume);}};
}
