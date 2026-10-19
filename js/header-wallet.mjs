import {inboxSnapshot,forgetInbox,subscribeInbox} from './inbox-store.mjs?v=20261019-inbox-v1';
import {walletSnapshot,walletFresh,publishWalletBalance,forgetWalletBalance,subscribeWalletBalance} from './wallet-balance.mjs?v=20261017-header-wallet-v1';

export function createHeaderWallet({auth,request,defer=()=>false}){
 let uid='',pending=null,retryAfter=0;
 const getUid=()=>auth()?.currentUser?.uid||'';
 function links(){
  return [...document.querySelectorAll('[data-account-entry]')].map(entry=>{
   let group=entry.parentElement;
   if(!group?.matches('[data-account-access-group]')){group=document.createElement('span');group.className='cff-account-access-group';group.dataset.accountAccessGroup='1';entry.before(group);group.append(entry);}
   let link=group.querySelector('[data-header-wallet]');
   if(!link){link=document.createElement('a');link.dataset.headerWallet='1';link.className='cff-header-wallet';link.href='/conta.html?tab=points';link.hidden=true;link.innerHTML='<img src="/edition/moeda%20cff.webp" width="32" height="32" alt="" decoding="async"><span><strong data-wallet-value>—</strong><small>CFF COINS</small></span>';group.prepend(link);}
   let inbox=group.querySelector('[data-header-inbox]');if(!inbox){inbox=document.createElement('a');inbox.dataset.headerInbox='1';inbox.className='cff-header-inbox';inbox.href='/conta.html?tab=inbox';inbox.innerHTML='<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg><i hidden></i>';group.insertBefore(inbox,entry);}
   const summary=inboxSnapshot(uid);inbox.hidden=!uid;inbox.querySelector('i').hidden=!summary?.hasNew;inbox.setAttribute('aria-label',summary?.hasNew?'Caixa de entrada: há novidades':'Abrir caixa de entrada');inbox.title='Caixa de entrada';
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
  const current=uid,startedAt=Date.now();if(!current||pending||Date.now()<retryAfter||walletFresh(walletSnapshot(current)))return;
  const job=Promise.resolve().then(()=>request(auth(),'wallet',{includeInbox:true})).then(result=>{if(uid===current&&getUid()===current){const cached=walletSnapshot(current);if(!(cached?.at>startedAt)&&(!walletFresh(cached)||cached.balance!==result.wallet?.balance))publishWalletBalance(current,result.wallet);}}).catch(()=>{if(uid===current)retryAfter=Date.now()+60000;}).finally(()=>{if(pending===job)pending=null;if(uid===current)draw();});pending=job;return job;
 }
 function sync(){
  const current=getUid();if(current!==uid){if(uid){forgetWalletBalance(uid);forgetInbox(uid);}uid=current;pending=null;retryAfter=0;}
  draw();if(uid&&!defer())load();
 }
 const stopInbox=subscribeInbox(()=>draw());
 const unsubscribe=subscribeWalletBalance(value=>{if(value.uid===uid&&getUid()===uid)draw();});
 const resume=()=>{if(getUid()===uid&&uid){draw();load();}};
 window.addEventListener('focus',resume);window.addEventListener('pageshow',resume);
 if(!document.querySelector('[data-header-wallet-style]')){const style=document.createElement('link');style.rel='stylesheet';style.href='/css/header-wallet.css?v=20261019-inbox-v1';style.dataset.headerWalletStyle='1';document.head.append(style);}
 return {sync,stop(){unsubscribe();stopInbox();window.removeEventListener('focus',resume);window.removeEventListener('pageshow',resume);}};
}
