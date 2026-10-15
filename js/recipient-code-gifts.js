import {createCodeGiftOpener} from './code-gift-opener.mjs?v=20261015-inventory-v1';
import {setGiftArchived} from './gift-archive.mjs?v=20261015-inventory-v1';
import {ref,onValue} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';
import {escapeProfile as esc} from './community-profile-data.js?v=20261013-profile-frames-v1';
export function mountRecipientCodeGifts(host,{auth,db,uid,viewState={},profileGifts={},image=()=>'',hydrate=()=>{}}){
 if(!document.querySelector('[data-cff-code-gift-style]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/css/code-gifts.css?v=20261015-inventory-v1';css.dataset.cffCodeGiftStyle='1';document.head.append(css);}
 let stopped=false,busy=false,archived=!!viewState.archived,codeGifts={},loaded=false,limit=viewState.limit||20;
 const opener=createCodeGiftOpener({auth,uid,onArchived:()=>{if(!stopped)status.textContent='Presente arquivado. Você pode restaurá-lo em Arquivados.';}});
 host.classList.add('cff-recipient-code-gifts');host.innerHTML='<div class="cff-gift-heading"><div><h2>Seus presentes</h2><p>Abra seus codiguinhos por aqui. Depois de usar, arquive para organizar.</p></div><button type="button" data-gift-archive-view aria-pressed="false">Arquivados</button></div><p role="status" data-code-gift-error></p><div data-code-gift-list>Carregando presentes…</div><button type="button" data-gifts-more hidden>Mostrar mais presentes</button>';
 const list=host.querySelector('[data-code-gift-list]'),status=host.querySelector('[data-code-gift-error]'),toggle=host.querySelector('[data-gift-archive-view]');
 const date=value=>esc(new Date(value).toLocaleDateString('pt-BR'));
 function render(){
  if(stopped)return;
  const entries=[...Object.entries(codeGifts).map(([id,g])=>({...g,id,kind:'code'})),...Object.entries(profileGifts).map(([id,g])=>({...g,id,kind:'profile'}))].sort((a,b)=>(b.sentAt||b.grantedAt)-(a.sentAt||a.grantedAt));
  const count=entries.filter(g=>!!g.archivedAt).length;toggle.textContent=archived?'← Presentes ativos':'Arquivados'+(count?' ('+count+')':'');toggle.setAttribute('aria-pressed',String(archived));
  const visible=entries.filter(g=>!!g.archivedAt===archived);list.innerHTML=visible.slice(0,limit).map(g=>{
   const isCode=g.kind==='code',state=g.returnedAt?'Devolvido ao estoque':g.openedAt?'Presente aberto':isCode?'Novo presente':'Item liberado';
   return `<article class="cff-code-present${g.archivedAt?' is-archived':''}">${isCode?'<img src="/edition/gift.webp" alt="Presente da Central">':image(g.assetId)}<div><span class="cff-code-gift-state">${state}${g.archivedAt?' · Arquivado':''}</span><h3>${esc(g.title||'Presente da Central')}</h3><small>Recebido em ${date(g.sentAt||g.grantedAt)}${g.archivedAt?' · Arquivado em '+date(g.archivedAt):''}</small>${g.message?'<p>'+esc(g.message)+'</p>':''}<div class="cff-gift-card-actions">${isCode?`<button type="button" data-open-code-gift="${esc(g.id)}"${g.returnedAt?' disabled':''}>${g.returnedAt?'Devolvido em '+date(g.returnedAt):g.openedAt?'Ver código':'Abrir presente'}</button>`:'<a class="cff-account-button" href="/conta.html?tab=edit">Usar no perfil</a>'}${g.archivedAt||!isCode||g.openedAt||g.returnedAt?`<button type="button" class="cff-gift-archive-button" data-archive-gift="${esc(g.id)}" data-gift-kind="${g.kind}">${g.archivedAt?'Restaurar presente':'Arquivar presente'}</button>`:''}</div></div></article>`;
  }).join('')||`<p>${loaded?(archived?'Nenhum presente arquivado.':'Seus próximos presentes vão aparecer aqui.'):'Carregando presentes…'}</p>`;
  host.querySelector('[data-gifts-more]').hidden=visible.length<=limit;hydrate(list);
 }
 const stop=onValue(ref(db,'communityCodeGifts/'+uid),snapshot=>{if(stopped)return;codeGifts=snapshot.val()||{};loaded=true;for(const [id,g]of Object.entries(codeGifts))if(g.returnedAt)opener.invalidate(id);render();},()=>{if(!stopped){loaded=true;status.textContent='Não foi possível carregar seus codiguinhos. Atualize a página.';render();}});
 const click=async event=>{
  if(event.target.closest('[data-gift-archive-view]')){archived=!archived;limit=20;viewState.archived=archived;viewState.limit=limit;status.textContent='';render();return;}
  if(event.target.closest('[data-gifts-more]')){limit+=20;viewState.limit=limit;render();return;}
  const open=event.target.closest('[data-open-code-gift]'),archive=event.target.closest('[data-archive-gift]'),button=open||archive;
  if(!button||busy||stopped||auth.currentUser?.uid!==uid)return;
  const id=open?open.dataset.openCodeGift:archive.dataset.archiveGift,kind=open?'code':archive.dataset.giftKind,gift=(kind==='code'?codeGifts:profileGifts)[id];if(!gift||open&&gift.returnedAt)return;
  busy=true;button.disabled=true;status.textContent='';
  try{if(open)await opener.open(id);else{const result=await setGiftArchived({auth,uid,giftId:id,kind,archived:!gift.archivedAt});if(stopped||auth.currentUser?.uid!==uid)return;gift.archivedAt=result.archivedAt;render();status.textContent=result.archivedAt?'Presente arquivado. Seus itens continuam disponíveis.':'Presente restaurado.';}}
  catch(error){if(!stopped&&auth.currentUser?.uid===uid)status.textContent=error.message;}
  finally{busy=false;button.disabled=false;}
 };
 host.addEventListener('click',click);return ()=>{stopped=true;stop();host.removeEventListener('click',click);opener.stop();};
}
