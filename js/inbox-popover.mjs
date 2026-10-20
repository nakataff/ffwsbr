import {economyRequest,escapeEconomy as esc} from './economy-client.mjs?v=20261019-inbox-v1';
import {inboxLink} from './user-inbox.mjs?v=20261019-inbox-v1';
import {inboxSnapshot,publishInbox,subscribeInbox} from './inbox-store.mjs?v=20261019-inbox-v1';
const VERSION='20261020-inbox-popover-v1',CACHE_MS=60000;
const date=at=>Number.isFinite(Number(at))?new Date(Number(at)).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'';
export function createInboxPopover({auth,request=economyRequest}={}){
 const uid=auth()?.currentUser?.uid,dialog=document.createElement('dialog');
 let live=true,rows=[],loadedAt=0,snapshot=0,pending=null,error='',opener=null,sequence=0;
 const reading=new Set(),valid=()=>live&&uid&&auth()?.currentUser?.uid===uid;
 dialog.className='cff-inbox-popover';dialog.id='cff-inbox-popover';dialog.setAttribute('aria-labelledby','cff-inbox-popover-title');
 document.body.append(dialog);
 if(!document.querySelector('[data-inbox-popover-style]')){const style=document.createElement('link');style.rel='stylesheet';style.href='/css/inbox-popover.css?v='+VERSION;style.dataset.inboxPopoverStyle='1';document.head.append(style);}
 function expanded(){return new Set([...dialog.querySelectorAll('details[open]')].map(n=>Number(n.dataset.inboxItem)));}
 function render(){
  if(!valid()||!dialog.open)return;const opened=expanded(),focused=document.activeElement,focusSelector=focused?.matches('[data-inbox-close]')?'[data-inbox-close]':focused?.matches('[data-inbox-refresh]')?'[data-inbox-refresh]':focused?.matches('summary')&&focused.closest('[data-inbox-item]')?`[data-inbox-item="${focused.closest('[data-inbox-item]').dataset.inboxItem}"] summary`:null,scroll=dialog.querySelector('.cff-inbox-popover-list')?.scrollTop||0;
  dialog.setAttribute('aria-busy',String(!!pending));
  dialog.innerHTML=`<header class="cff-inbox-popover-head"><div><small>MENSAGENS DA CENTRAL</small><h2 id="cff-inbox-popover-title">Caixa de entrada</h2></div><button type="button" data-inbox-close aria-label="Fechar caixa de entrada">×</button></header><div class="cff-inbox-popover-toolbar"><p>Suas mensagens mais recentes</p><button type="button" data-inbox-refresh${pending?' disabled':''} aria-label="Atualizar mensagens">↻ Atualizar</button></div><p class="cff-inbox-popover-status" role="status" aria-live="polite">${esc(error||(pending?'Carregando mensagens…':''))}</p><div class="cff-inbox-popover-list">${rows.map(m=>{
   const url=m.url?inboxLink(m.url):'',external=url.startsWith('https://');
   return `<details data-inbox-item="${m.id}" class="cff-inbox-popover-item${m.read?'':' is-unread'}${m.priority==='important'?' is-important':''}"${opened.has(m.id)?' open':''}><summary><span class="cff-inbox-popover-icon" aria-hidden="true">${m.category==='reward'?'🎁':'✉'}</span><span class="cff-inbox-popover-summary"><span class="cff-inbox-popover-meta">${m.category==='reward'?'Recompensa':m.scope==='all'?'Comunicado':'Mensagem'}${m.priority==='important'?' · Importante':''}<b data-inbox-unread${m.read?' hidden':''}>Não lida</b></span><strong>${esc(m.title)}</strong><span class="cff-inbox-popover-excerpt">${esc(m.body)}</span><time datetime="${esc(Number.isFinite(new Date(Number(m.sentAt)).getTime())?new Date(Number(m.sentAt)).toISOString():'')}">${esc(date(m.sentAt))}</time></span><span class="cff-inbox-popover-chevron" aria-hidden="true">⌄</span></summary><div class="cff-inbox-popover-content"><p>${esc(m.body)}</p>${m.expiresAt?`<small>Disponível até ${esc(date(m.expiresAt))}</small>`:''}<div>${url?`<a href="${esc(url)}" data-inbox-open="${m.id}"${external?' target="_blank" rel="noopener noreferrer"':''}>${esc(m.button||'Abrir')}</a>`:''}<button type="button" data-inbox-read="${m.id}"${m.read?' hidden':''}>Marcar como lida</button></div></div></details>`;
  }).join('')||(!pending?`<div class="cff-inbox-popover-empty"><span aria-hidden="true">✉</span><h3>${error?'Não foi possível carregar':'Tudo em dia por aqui'}</h3><p>${error?'Tente novamente ou abra a caixa completa no perfil.':'Seus próximos recados e recompensas aparecerão aqui.'}</p></div>`:'')}</div><footer class="cff-inbox-popover-foot"><a href="/conta.html?tab=inbox">Ver tudo no perfil <span aria-hidden="true">→</span></a></footer>`;
  dialog.querySelector('.cff-inbox-popover-list').scrollTop=scroll;if(focusSelector)dialog.querySelector(focusSelector)?.focus();
 }
 async function load(force=false){
  if(!valid()||pending)return pending;
  const age=Date.now()-loadedAt,newer=(inboxSnapshot(uid)?.latest||0)>snapshot;
  if(loadedAt&&!newer&&age<(force?30000:CACHE_MS)){if(force){error='Suas mensagens já estão atualizadas. Aguarde alguns segundos.';render();}return;}
  const seq=++sequence;error='';
  const job=Promise.resolve().then(()=>{if(valid())return request(auth(),'inboxPreview');}).then(result=>{if(!valid()||seq!==sequence||!result)return;rows=result.entries.filter(m=>Number.isSafeInteger(m.id)&&m.id>0).slice(0,6);snapshot=result.snapshot;loadedAt=Date.now();if(result.summary)publishInbox(uid,result.summary);}).catch(e=>{if(valid()&&seq===sequence)error=e.message||'Não foi possível carregar suas mensagens.';}).finally(()=>{if(pending===job)pending=null;render();});
  pending=job;render();return job;
 }
 async function mark(id){
  const row=rows.find(m=>m.id===id);if(!valid()||!row||row.read||reading.has(id))return;reading.add(id);
  const button=dialog.querySelector(`[data-inbox-read="${id}"]`);if(button)button.disabled=true;
  try{const result=await request(auth(),'inboxRead',{id});if(!valid())return;row.read=true;if(result.summary)publishInbox(uid,result.summary);const item=dialog.querySelector(`[data-inbox-item="${id}"]`);item?.classList.remove('is-unread');const badge=item?.querySelector('[data-inbox-unread]');if(badge)badge.hidden=true;if(button)button.hidden=true;}
  catch(e){if(valid()){error=e.message||'Não foi possível marcar a mensagem como lida.';const status=dialog.querySelector('[role="status"]');if(status)status.textContent=error;}}
  finally{reading.delete(id);if(button&&valid())button.disabled=false;}
 }
 function close(){if(dialog.open)dialog.close();}
 const click=e=>{const button=e.target.closest('button,a');if(e.target===dialog){close();return;}if(!button||!valid())return;if(button.hasAttribute('data-inbox-close'))close();else if(button.hasAttribute('data-inbox-refresh'))load(true);else if(button.dataset.inboxRead||button.dataset.inboxOpen)mark(Number(button.dataset.inboxRead||button.dataset.inboxOpen));};
 const toggle=e=>{if(e.target.matches('details[data-inbox-item]')&&e.target.open)mark(Number(e.target.dataset.inboxItem));};
 const onClose=()=>{document.querySelectorAll('[data-header-inbox]').forEach(n=>n.setAttribute('aria-expanded','false'));if(valid()&&opener?.isConnected)opener.focus();};
 const unsubscribe=subscribeInbox(value=>{if(value.uid===uid&&value.latest>snapshot)loadedAt=0;});
 dialog.addEventListener('click',click);dialog.addEventListener('toggle',toggle,true);dialog.addEventListener('close',onClose);
 return {get isOpen(){return dialog.open;},open(trigger){if(!valid())return;opener=trigger;trigger?.setAttribute('aria-expanded','true');if(!dialog.open)dialog.showModal();render();load();dialog.querySelector('[data-inbox-close]')?.focus();},close,destroy(){if(!live)return;live=false;++sequence;unsubscribe();dialog.removeEventListener('click',click);dialog.removeEventListener('toggle',toggle,true);dialog.removeEventListener('close',onClose);if(dialog.open)dialog.close();dialog.remove();rows=[];reading.clear();}};
}
