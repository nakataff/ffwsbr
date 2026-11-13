import {mountCodePromotions} from './admin-code-promotions.mjs?v=20261108-shop-pricing-v4';
import {createStockBridge} from './admin-stock-bridge.mjs?v=20261019-admin-integration-v1';
import {prepareEconomyPhoto} from './economy-photo.mjs?v=20261014-cff-coins-v1';
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import {economyRequest,escapeEconomy as esc,loadEconomyStyle} from './economy-client.mjs?v=20261108-shop-notices-v4';
const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp(window.CFF_CONFIG.firebase),auth=getAuth(app);
const names={roulette:'Loja (estoque antigo)',shop:'Loja',both:'Loja (compartilhado)',hidden:'Fora da loja',redeemed:'Resgatado (fora da loja)'},hashes=new Map(),photoSync=new Map(),photoAttempts=new Set();
let promotionTools=null,codePrice=1000;
let host=null,busy=false,loading=false,queued=false,rows=[],inventory=[],stock=new Map(),signature='',loadedAt=0,accountEpoch=0;const selectedCodes=new Set(),noticeTitles=new Set(),archivedProtected=new Set();let noticeSettings=null,noticeInventory=[],noticeBusy=false;
const source=()=>window.CFF_CODE_DELIVERY_SOURCE;
const isAdmin=()=>auth.currentUser?.email==='admin@centralfreefire.com.br';
const incoming=createStockBridge({source,request:(op,body)=>economyRequest(auth,op,body,true),owner:()=>isAdmin()?auth.currentUser.uid:''});
const status=message=>{if(host)host.querySelector('[data-stock-status]').textContent=message;};
async function hashCode(code){if(!hashes.has(code)){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code));hashes.set(code,[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join(''));}return hashes.get(code);}
function preview(name,target){const row=name==='code'?rows.find(r=>r.code===host.querySelector('[name=code]').value):inventory.find(r=>r.code===host.querySelector('[name=editCode]').value),item=stock.get(row?.code),el=host.querySelector(target);el.innerHTML=row?`<img src="${esc(row.imageUrl||item?.image||'/edition/gift.webp')}" alt="${esc(row.title)}"><div><strong>${esc(row.title)}</strong><span>${name==='code'?'A foto será exibida junto ao prêmio.':item?.status==='claimed'?'Código entregue e protegido contra revenda. Você ainda pode corrigir a identificação do envio abaixo.':item?.status==='pending'?'Prêmio reservado, com entrega pendente.':item?.status==='expired'?'Código expirado.':item?.status==='redeemed'?'Código marcado como resgatado. Não pode voltar automaticamente à loja.':`Destino atual: ${names[item?.bucket]||'Carregando…'}`}</span></div>`:'<span>Selecione um codiguinho para conferir.</span>';}
function refresh(){if(!host||busy||!isAdmin())return;const data=source()?.read();rows=(Array.isArray(data)?data:[]).filter(r=>!stock.has(r.code));inventory=source()?.inventory?.()||[];const select=host.querySelector('[name=code]'),current=select.value;select.innerHTML=`<option value="">${data===null?'Desbloqueie o controle para escolher':'Escolha um código disponível'}</option>`+rows.map(r=>`<option value="${esc(r.code)}">${esc(r.title)} · ${esc(r.code)}</option>`).join('');if(rows.some(r=>r.code===current))select.value=current;
 selectedCodes.forEach(code=>{if(!rows.some(row=>row.code===code))selectedCodes.delete(code);});renderBulkChoices();
 const edit=host.querySelector('[name=editCode]'),editCurrent=edit.value;edit.innerHTML='<option value="">Escolha um código do estoque</option>'+inventory.filter(r=>stock.has(r.code)).map(r=>{const item=stock.get(r.code);return `<option value="${esc(r.code)}">${esc(r.title)} · ${esc(r.code)} · ${item.status==='claimed'?'Já entregue':item.status==='pending'?'Entrega pendente':item.status==='expired'?'Expirado':item.status==='redeemed'?'Resgatado':names[item.bucket]}</option>`;}).join('');if(inventory.some(r=>r.code===editCurrent)&&stock.has(editCurrent))edit.value=editCurrent;
 host.querySelectorAll('select,button').forEach(n=>n.disabled=data===null);host.querySelector('[data-reserve-submit]').disabled=data===null||(!select.value&&!selectedCodes.size)||loading;renderNoticeItems();editFields();preview('code','[data-stock-photo]');promotionTools?.render();paint();}
const NOTICE_LABELS={restock:'Reposição automática',last:'Última unidade na loja',expiring:'Validade próxima (24 horas)',promotion:'Promoções ativadas',soldout:'Item esgotado',removed:'Item retirado da loja',free:'Recompensas gratuitas (quando disponíveis)'};
function renderNoticeItems(){
 if(!host)return;const list=host.querySelector('[data-notice-stock-list]');if(!list)return;
 const titles=noticeInventory.filter(x=>x.quantity>0);
 noticeTitles.forEach(title=>{if(!titles.some(x=>x.title===title))noticeTitles.delete(title);});
 list.innerHTML=titles.map(item=>'<label class="eco-stock-check"><input type="checkbox" data-notice-item="'+esc(item.title)+'"'+(noticeTitles.has(item.title)?' checked':'')+'><span>'+esc(item.title)+'<small>'+item.quantity+' disponível(is) · '+Number(item.price).toLocaleString('pt-BR')+' Coins</small></span></label>').join('')||'<p>Não há itens da loja disponíveis para anunciar.</p>';
 host.querySelector('[data-notice-selected]').textContent=noticeTitles.size+' selecionado(s) · máximo 8';
 const preview=host.querySelector('[data-notice-preview]');
 if(preview)preview.textContent=noticeTitles.size?'Prévia do aviso:\n🎁 NOVIDADES NA LOJINHA CFF!\n'+titles.filter(x=>noticeTitles.has(x.title)).map(x=>'• '+x.title+' — '+x.quantity+' disponível(is) · '+Number(x.price).toLocaleString('pt-BR')+' CFF Coins').join('\n')+'\nConfira as recompensas na loja.':'Marque as skins acima para visualizar a mensagem antes de anunciar.';
 host.querySelector('[data-notice-send]').disabled=noticeBusy||!noticeTitles.size;
}
async function loadNotices(){
 if(!host||!isAdmin()||noticeBusy)return;
 const statusNode=host.querySelector('[data-notice-status]');
 try{
  const data=await economyRequest(auth,'shopNoticeConfig',{},true);if(!isAdmin()||!host)return;
  noticeSettings=data.settings;noticeInventory=data.stock||[];
  for(const [key,value] of Object.entries(noticeSettings)){const input=host.querySelector('[data-notice-toggle="'+key+'"]');if(input)input.checked=value===true;}
  renderNoticeItems();statusNode.textContent='Avisos prontos. Códigos privados nunca são publicados.';
 }catch(error){statusNode.textContent=error.message||'Não foi possível carregar avisos.';}
}
async function saveNoticeSettings(){
 if(!isAdmin()||noticeBusy)return;noticeBusy=true;
 const button=host.querySelector('[data-notice-settings-save]'),message=host.querySelector('[data-notice-status]');button.disabled=true;
 try{
  const settings=Object.fromEntries(Object.keys(NOTICE_LABELS).map(key=>[key,!!host.querySelector('[data-notice-toggle="'+key+'"]')?.checked]));
  const result=await economyRequest(auth,'shopNoticeConfigSave',{settings},true);
  noticeSettings=result.settings;message.textContent='Automação atualizada com sucesso.';
 }catch(error){message.textContent=error.message||'Falha ao salvar automações.';}
 finally{noticeBusy=false;button.disabled=false;renderNoticeItems();}
}
async function announceSelected(){
 if(!isAdmin()||noticeBusy||!noticeTitles.size)return;
 const titles=[...noticeTitles];if(titles.length>8){host.querySelector('[data-notice-status]').textContent='Selecione até 8 skins por anúncio.';return;}
 if(!confirm('Avisar no Chat Global sobre '+titles.length+' item(ns) selecionado(s)? Nenhum código privado será publicado.'))return;
 noticeBusy=true;renderNoticeItems();const message=host.querySelector('[data-notice-status]');message.textContent='Publicando aviso da loja…';
 try{
  const result=await economyRequest(auth,'shopNoticeAnnounce',{titles},true);
  message.textContent='Aviso enviado ao Chat Global: '+result.items.map(x=>x.title+' ('+x.quantity+')').join(', ')+'.';
  noticeTitles.clear();
  noticeInventory=noticeInventory.map(x=>result.items.find(item=>item.title===x.title)?{...x}:x);
 }catch(error){message.textContent=error.message||'Falha ao publicar aviso.';}
 finally{noticeBusy=false;renderNoticeItems();}
}
function renderBulkChoices(){
 const list=host?.querySelector('[data-stock-code-choices]');if(!list)return;
 const q=String(host.querySelector('[data-stock-code-filter]')?.value||'').trim().toLowerCase();
 const visible=rows.filter(r=>!q||r.title.toLowerCase().includes(q)||r.code.toLowerCase().includes(q)).slice(0,250);
 list.innerHTML=visible.map(row=>'<label class="eco-stock-check"><input type="checkbox" data-stock-multiple="'+esc(row.code)+'"'+(selectedCodes.has(row.code)?' checked':'')+'><span>'+esc(row.title)+'<small>'+esc(row.code)+'</small></span></label>').join('')||'<p>Nenhum código disponível neste filtro.</p>';
 const count=host.querySelector('[data-stock-selected]');if(count)count.textContent=selectedCodes.size+' selecionado(s) · máximo 20 por operação';
 const button=host.querySelector('[data-reserve-submit]');if(button)button.disabled=busy||loading||(!selectedCodes.size&&!host.querySelector('[name=code]')?.value);
}
function editFields(){
 const item=stock.get(host.querySelector('[name=editCode]').value);
 host.querySelector('[name=editBucket]').value=item?.bucket==='hidden'?'hidden':'shop';
 host.querySelector('[name=editBucket]').disabled=busy||item?.status!=='available';
 host.querySelector('[data-move-submit]').disabled=busy||item?.status!=='available';
 const row=inventory.find(r=>r.code===host.querySelector('[name=editCode]').value);
 const origin=host.querySelector('[name=deliveryOrigin]');
 origin.value=row?.originOverride||'auto';
 origin.disabled=busy||!row||!item;
 host.querySelector('[data-origin-submit]').disabled=busy||!row||!item;
 const identified=row?.deliveryOrigin==='manual'?'Enviado manualmente pelo administrador':row?.deliveryOrigin==='economy'?'Resgatado pelo sistema de pontos':'Origem não identificada';
 host.querySelector('[data-origin-current]').textContent=row&&item?'Origem registrada: '+identified+'. A correção não altera recibos, carteira ou destinatário.'+(item.status==='claimed'&&row.deliveryOrigin==='manual'?' Atenção: há um recibo de pontos vinculado ao estoque; confira o relatório financeiro antes de qualquer ajuste nesse recibo.':''):'Selecione um codiguinho do estoque para conferir a origem.';
 toggleRemovalReason();
 preview('edit','[data-edit-photo]');
}
function toggleRemovalReason(){
 const item=stock.get(host.querySelector('[name=editCode]').value);
 const reason=host.querySelector('[data-stock-removal-reason]');
 reason.hidden=host.querySelector('[name=editBucket]').value!=='hidden'||item?.bucket==='hidden'||item?.status!=='available';
 if(reason.hidden)reason.querySelector('input').value='';
}
function paint(){
 document.querySelectorAll('[data-stock-overlay]').forEach(n=>n.remove());
 document.querySelectorAll('[data-stock-code]').forEach(card=>card.classList.remove('eco-reward-available','eco-reward-claimed'));
 if(!isAdmin())return;
 const originByCode=new Map(inventory.map(row=>[row.code,row]));
 for(const card of document.querySelectorAll('[data-stock-code]')){
  const code=card.dataset.stockCode,item=stock.get(code);if(!item)continue;
  const data=originByCode.get(code),manual=data?.deliveryOrigin==='manual',manualGift=manual&&data?.hasGift,needsReview=data?.hasGift&&data.deliveryOrigin==='unknown';
  if(!card.classList.contains('invalid')){
   if(item.status==='claimed'&&!manualGift)card.classList.add('eco-reward-claimed');
   else if(item.status==='available'&&item.bucket!=='hidden'&&item.bucket!=='redeemed'&&!manual&&!data?.hasGift&&!data?.redeemed&&!data?.manualAssigned)card.classList.add('eco-reward-available');
  }
  const badge=document.createElement('button');
  badge.type='button';badge.className='eco-code-destination '+(item.status==='available'?'':'is-unavailable');
  badge.dataset.stockOverlay='';badge.dataset.editStockCode=code;
  badge.title='Clique para conferir ou corrigir a origem do envio';
  badge.textContent=manual?'Enviado por mim · Fora da loja · Corrigir origem':needsReview?'Entrega registrada · Conferir origem':item.status==='claimed'?'Entregue pelo sistema de pontos · Corrigir origem':item.status==='pending'?'Prêmio reservado · Entrega pendente':item.status==='redeemed'?'Resgatado · Fora da loja':item.status==='expired'?'Estoque expirado':names[item.bucket]+' · Editar destino';
  card.prepend(badge);
  card.querySelectorAll('[data-economy-stock],[data-code-gift-send]').forEach(b=>b.disabled=true);
 }
 for(const tile of document.querySelectorAll('[data-stock-group]')){
  const items=inventory.filter(r=>r.groupId===tile.dataset.stockGroup&&stock.get(r.code)?.status==='available'),wrap=tile.querySelector('.codiguin-photo-wrap');
  if(!items.length||!wrap)continue;
  const badges=document.createElement('div');badges.className='eco-tile-destinations';badges.dataset.stockOverlay='';
  for(const bucket of ['shop','roulette','both','hidden','redeemed']){
   const matches=items.filter(r=>stock.get(r.code).bucket===bucket);if(!matches.length)continue;
   const b=document.createElement('button');b.type='button';b.dataset.editStockCode=matches[0].code;b.textContent=names[bucket]+' · '+matches.length;badges.append(b);
  }
  wrap.append(badges);
 }
}
async function loadStock(force=false,quiet=false){if(!host||!isAdmin()||source()?.read()===null)return;if(loading||busy){queued=queued||force;return;}const entries=source()?.inventory?.()||[],key=entries.map(r=>r.code).join('|');if(!force&&key===signature&&Date.now()-loadedAt<60000)return;const epoch=accountEpoch;loading=true;refresh();if(!quiet)status('Conferindo estoque da loja…');try{await incoming.sync(force);if(epoch!==accountEpoch||!isAdmin())return;const archived=source()?.archivedRedeemedCodes?.()||[];
 const oldEntries=archived.filter(code=>!archivedProtected.has(code));
 for(let i=0;i<oldEntries.length;i+=50){
  const batch=oldEntries.slice(i,i+50),ids=await Promise.all(batch.map(hashCode));
  await economyRequest(auth,'markStockRedeemed',{hashes:ids,redeemed:true,announce:false},true);
  for(const code of batch)archivedProtected.add(code);
 }
 const entries=source()?.inventory?.()||[],key=entries.map(r=>r.code).join('|'),next=new Map();for(let i=0;i<entries.length;i+=500){const part=entries.slice(i,i+500),ids=await Promise.all(part.map(r=>hashCode(r.code))),result=await economyRequest(auth,'stockStatus',{hashes:ids},true),byHash=new Map(result.stock.map(r=>[r.hash,r]));
 if(result.codePrice)codePrice=result.codePrice;
 const previouslyRedeemed=[];
 for(let j=0;j<part.length;j++){
  const item=byHash.get(ids[j]);
  if(item?.status==='available'&&part[j].redeemed)previouslyRedeemed.push(ids[j]);
 }
 // Backfill old encrypted records in bounded batches. Fail closed if the server cannot protect them.
 for(let j=0;j<previouslyRedeemed.length;j+=50){
  const batch=previouslyRedeemed.slice(j,j+50);
  await economyRequest(auth,'markStockRedeemed',{hashes:batch,redeemed:true,announce:false},true);
  for(const hash of batch){const item=byHash.get(hash);if(item){item.status='redeemed';item.bucket='redeemed';}}
 }
 for(let j=0;j<part.length;j++)if(byHash.has(ids[j]))next.set(part[j].code,byHash.get(ids[j]));}if(epoch!==accountEpoch||!isAdmin())return;stock=next;window.CFF_ECONOMY_STOCK_CODES=new Set(stock.keys());signature=key;loadedAt=Date.now();if(source()?.refresh)source().refresh();else window.dispatchEvent(new Event('cff:codiguinhos-changed'));if(!quiet)status('Estoque atualizado. Clique na etiqueta para editar o destino.');}catch(e){if(epoch===accountEpoch)status(e.message);}finally{loading=false;if(epoch===accountEpoch){refresh();if(queued){queued=false;loadStock(true);}else syncPhotos(false).catch(e=>status(e.message));}}}
async function syncPhotos(force){if(busy||loading||!host||!isAdmin())return;const entries=source()?.inventory?.();if(!entries)return;const groups=new Map();for(const row of entries){const item=stock.get(row.code);if(!row.imageUrl||!item||item.status!=='available')continue;const previous=photoSync.get(row.code);if(!force&&(photoAttempts.has(row.code+'|'+row.imageUrl)||item.image&&(!previous||previous===row.imageUrl)))continue;if(!groups.has(row.imageUrl))groups.set(row.imageUrl,[]);groups.get(row.imageUrl).push(row.code);}if(!groups.size){if(force)status('Nenhuma foto pendente no estoque.');return;}busy=true;host.querySelectorAll('select,button').forEach(n=>n.disabled=true);let updated=0;try{for(const [photo,codes]of groups){status('Atualizando fotos do estoque…');for(const code of codes)photoAttempts.add(code+'|'+photo);const imageUrl=await prepareEconomyPhoto(photo);for(let i=0;i<codes.length;i+=500){const result=await economyRequest(auth,'stockPhotos',{codes:codes.slice(i,i+500),imageUrl},true);updated+=result.updated;}for(const code of codes)photoSync.set(code,photo);}status(updated+' código(s) com foto atualizada.');}catch(e){status(e.message);}finally{busy=false;refresh();await loadStockAfterChange();}}
async function loadStockAfterChange(){signature='';queued=false;await loadStock(true,true);await loadNotices();}
async function save(e,edit){
 e.preventDefault();if(busy||loading||!isAdmin())return;
 const form=e.currentTarget,bucket=form.elements[edit?'editBucket':'bucket'].value,reason=edit&&bucket==='hidden'?String(form.elements.removalReason?.value||'').trim():'';
 const picked=edit?[inventory.find(r=>r.code===form.elements.editCode.value)]:selectedCodes.size?rows.filter(r=>selectedCodes.has(r.code)):[rows.find(r=>r.code===form.elements.code.value)];
 const selected=picked.filter(Boolean);
 if(!selected.length)return;
 if(selected.length>20){status('Selecione até 20 códigos por operação para evitar o limite de pedidos do servidor.');return;}
 if(edit&&stock.get(selected[0].code)?.status!=='available')return;
 if(edit&&stock.get(selected[0].code)?.bucket===bucket){status('Este codiguinho já está em '+names[bucket]+'.');return;}
 const confirmation=edit?(bucket==='hidden'?'Retirar este codiguinho da loja? Ele ficará guardado no estoque e poderá voltar depois.':'Colocar este codiguinho de volta na loja?'):'Reservar '+selected.length+' codiguinho(s) para '+names[bucket]+'?';
 if(!confirm(confirmation))return;
 busy=true;host.querySelectorAll('select,button').forEach(n=>n.disabled=true);
 const photos=new Map();let done=0,failed=0;const issues=[];
 try{
  for(let i=0;i<selected.length;i++){
   const row=selected[i],item=stock.get(row.code);
   if(edit&&bucket==='shop'&&(row.redeemed||row.hasGift||row.manualAssigned)){failed++;issues.push(row.title+': código com resgate ou destinatário registrado não pode voltar à loja');continue;}
   status('Reservando '+(i+1)+' de '+selected.length+'…');
   try{
    if(edit)await economyRequest(auth,'moveStock',{hash:item.hash,bucket,...(bucket==='hidden'?{reason}:{})},true);
    else{
     let imageUrl=photos.get(row.imageUrl||'');
     if(imageUrl===undefined){imageUrl=await prepareEconomyPhoto(row.imageUrl);photos.set(row.imageUrl||'',imageUrl);}
     await economyRequest(auth,'addStock',{code:row.code,title:row.title,bucket,imageUrl,expiresAt:row.expires?Date.parse(row.expires+'T23:59:59-03:00'):0},true);
    }
    done++;selectedCodes.delete(row.code);
    if(!edit||!(row.redeemed||row.hasGift||row.manualAssigned)){try{await source().reserved({code:row.code,bucket});}catch{issues.push(row.title+': sincronização local pendente');}}
   }catch(error){failed++;issues.push(row.title+': '+(error.message||'Falhou'));}
  }
 }finally{
  busy=false;await loadStockAfterChange();
  if(edit&&done)host.querySelector('[name=removalReason]').value='';
  status((edit?'Destino atualizado em ':'Reservados ')+done+' código(s) / '+failed+' erro(s).'+(issues.length?' '+issues.slice(0,3).join(' | '):''));
 }
}
async function saveDeliveryOrigin(){
 if(busy||loading||!isAdmin())return;
 const code=host.querySelector('[name=editCode]').value;
 const origin=host.querySelector('[name=deliveryOrigin]').value;
 const message=host.querySelector('[data-origin-status]');
 if(!code||!stock.has(code)){message.textContent='Selecione um código do estoque.';return;}
 if(!['auto','manual','economy'].includes(origin))return;
 if(!confirm('Corrigir a identificação do envio deste codiguinho? A compra e o recibo original não serão alterados.'))return;
 busy=true;
 host.querySelector('[data-origin-submit]').disabled=true;
 try{
  await source().setDeliveryOrigin({code,origin});
  message.textContent=origin==='manual'?'Identificação corrigida para enviado manualmente. O código continua fora de venda.':origin==='economy'?'Identificação visual corrigida para sistema de pontos.':'Correção manual removida; a identificação voltou a seguir o registro do envio.';
  refresh();
 }catch(error){message.textContent=error.message||'Não foi possível salvar a correção.';}
 finally{busy=false;refresh();}
}
async function markCodeRedeemed(code,redeemed){
 if(!isAdmin())throw new Error('Acesse a conta administrativa antes de atualizar o estoque.');
 const normalized=String(code||'').toUpperCase(),hash=await hashCode(normalized);
 const result=await economyRequest(auth,'markStockRedeemed',{hashes:[hash],redeemed:Boolean(redeemed),announce:true},true);
 const current=stock.get(normalized);
 if(current&&current.status!=='claimed'&&current.status!=='pending'){
  stock.set(normalized,{...current,bucket:redeemed?'redeemed':'hidden',status:redeemed?'redeemed':'available'});
 }
 loadedAt=0;
 return result;
}
function mount(){if(host)return;loadEconomyStyle();host=document.createElement('section');host.className='eco-stock-panel';host.id='eco-code-stock';host.innerHTML=`<div class="eco-stock-panel-heading"><div><span class="eco-stock-eyebrow">CFF COINS</span><h2>Codiguinhos da loja</h2><p>A roleta entrega vales. Adicione os codiguinhos à loja para a pessoa escolher no resgate.</p></div><a href="/admin-pontos.html">Gerenciar CFF COINS ↗</a></div><div data-code-promotions></div><section class="eco-stock-notices" data-shop-notices><h3>📢 Avisos no Chat Global</h3><p>Selecione um ou mais prêmios disponíveis. A mensagem informa a quantidade e o preço, sem revelar os códigos.</p><div class="eco-stock-code-choices" data-notice-stock-list></div><p data-notice-selected>0 selecionado(s)</p><pre class="eco-stock-notice-preview" data-notice-preview aria-live="polite"></pre><button type="button" class="secondary" data-notice-send disabled>Avisar novos itens no Chat Global</button><details><summary>Configurar mensagens automáticas</summary><div class="eco-stock-notice-toggles"><label><input type="checkbox" data-notice-toggle="restock"> Reposição automática</label><label><input type="checkbox" data-notice-toggle="last"> Última unidade na loja</label><label><input type="checkbox" data-notice-toggle="expiring"> Validade próxima (24 horas)</label><label><input type="checkbox" data-notice-toggle="promotion"> Promoções ativadas</label><label><input type="checkbox" data-notice-toggle="soldout"> Item esgotado</label><label><input type="checkbox" data-notice-toggle="removed"> Item retirado da loja</label><label><input type="checkbox" data-notice-toggle="free"> Recompensas gratuitas (quando disponíveis)</label></div><button type="button" class="secondary" data-notice-settings-save>Salvar automações</button></details><p data-notice-status role="status" aria-live="polite"></p></section><div class="eco-stock-forms"><form class="eco-admin-form" data-stock-reserve><h3>Reservar novo código</h3><label>Código disponível (seleção individual)<select name="code"></select></label><label>Selecionar vários códigos<input type="search" data-stock-code-filter placeholder="Filtrar por skin ou código" autocomplete="off"></label><div class="eco-stock-selection-actions"><button type="button" data-stock-select-all>Marcar visíveis</button><button type="button" data-stock-select-none>Limpar seleção</button><small data-stock-selected>0 selecionado(s)</small></div><div class="eco-stock-code-choices" data-stock-code-choices></div><div class="eco-stock-photo-preview" data-stock-photo></div><label>Destino<select name="bucket"><option value="shop">Loja de CFF COINS</option></select></label><button type="submit" data-reserve-submit>Reservar no estoque</button></form><form class="eco-admin-form" data-stock-edit><h3>Disponibilidade na loja</h3><p>Retire um codiguinho da venda sem apagar o código ou a reserva. Você poderá recolocá-lo depois.</p><label>Código do estoque<select name="editCode" required></select></label><div class="eco-stock-photo-preview" data-edit-photo></div><label>Novo destino<select name="editBucket"><option value="shop">Disponível na loja</option><option value="hidden">Fora da loja (guardado no estoque)</option></select></label><label data-stock-removal-reason hidden>Motivo da retirada (opcional)<input type="text" name="removalReason" maxlength="140" placeholder="Ex.: item removido temporariamente" autocomplete="off"><small>O motivo aparece no aviso automático se esta for a última unidade do prêmio na loja e a opção de avisar estiver ativada.</small></label><button type="submit" data-move-submit>Salvar destino</button><div class="eco-origin-correction" style="margin-top:16px;border-top:1px solid var(--line);padding-top:14px"><h4 style="margin:0 0 8px">Corrigir origem do envio</h4><p data-origin-current>Selecione um codiguinho para conferir a origem.</p><label>Identificação no controle<select name="deliveryOrigin"><option value="auto">Usar registro original (automático)</option><option value="manual">Enviado por mim (administrador)</option><option value="economy">Resgatado pelo sistema de pontos</option></select></label><button type="button" class="secondary" data-origin-submit>Salvar identificação</button><small>A correção é somente visual e fica no controle criptografado. Não modifica o destinatário, recibos ou histórico financeiro e não recoloca um código à venda.</small><p role="status" data-origin-status aria-live="polite"></p></div></form></div><div class="eco-stock-panel-footer"><button type="button" class="secondary" data-sync-stock-photos>Atualizar fotos do estoque</button><button type="button" class="secondary" data-refresh-stock>Atualizar disponibilidade</button><p role="status" aria-live="polite" data-stock-status></p></div>`;
 promotionTools=mountCodePromotions(host.querySelector('[data-code-promotions]'),{items:()=>[...stock.values()],price:()=>codePrice,request:(op,body)=>economyRequest(auth,op,body,true),onSaved:async()=>{try{localStorage.setItem('cff-stock-updated-v1',String(Date.now()));}catch{}await loadStockAfterChange();await loadNotices();},owner:()=>isAdmin()?auth.currentUser.uid:''});
 const main=document.querySelector('main')||document.body,stats=main.querySelector('.stats'),panel=document.getElementById('codes-panel-rewards');if(panel)panel.append(host);else if(stats)stats.after(host);else main.append(host);
 host.querySelector('[name=code]').addEventListener('change',()=>{renderBulkChoices();preview('code','[data-stock-photo]');});
 host.querySelector('[data-stock-code-filter]').addEventListener('input',renderBulkChoices);
 host.querySelector('[data-stock-code-choices]').addEventListener('change',e=>{const code=e.target?.dataset?.stockMultiple;if(!code)return;if(e.target.checked)selectedCodes.add(code);else selectedCodes.delete(code);renderBulkChoices();});
 host.querySelector('[data-stock-select-all]').addEventListener('click',()=>{host.querySelectorAll('[data-stock-multiple]').forEach(el=>{if(selectedCodes.size<20)selectedCodes.add(el.dataset.stockMultiple);});renderBulkChoices();});
 host.querySelector('[data-stock-select-none]').addEventListener('click',()=>{selectedCodes.clear();renderBulkChoices();});
 host.querySelector('[data-notice-stock-list]').addEventListener('change',e=>{const title=e.target?.dataset?.noticeItem;if(!title)return;if(e.target.checked){if(noticeTitles.size>=8){e.target.checked=false;host.querySelector('[data-notice-status]').textContent='No máximo 8 itens por aviso.';return;}noticeTitles.add(title);}else noticeTitles.delete(title);renderNoticeItems();});
 host.querySelector('[data-notice-send]').addEventListener('click',announceSelected);
 host.querySelector('[data-notice-settings-save]').addEventListener('click',saveNoticeSettings);host.querySelector('[name=editCode]').addEventListener('change',()=>{host.querySelector('[name=removalReason]').value='';editFields();});host.querySelector('[name=editBucket]').addEventListener('change',toggleRemovalReason);host.querySelector('[data-origin-submit]').addEventListener('click',saveDeliveryOrigin);host.querySelector('[data-stock-reserve]').addEventListener('submit',e=>save(e,false));host.querySelector('[data-stock-edit]').addEventListener('submit',e=>save(e,true));host.querySelector('[data-sync-stock-photos]').addEventListener('click',()=>syncPhotos(true));host.querySelector('[data-refresh-stock]').addEventListener('click',()=>loadStock(true));
 window.addEventListener('cff:codiguinhos-changed',()=>queueMicrotask(()=>{refresh();loadStock();}));window.addEventListener('focus',()=>{refresh();loadStock(true);});window.addEventListener('cff:code-returned',()=>{window.dispatchEvent(new Event('cff:code-gift-recheck'));loadStock(true);});window.addEventListener('storage',event=>{if(event.key==='cff-stock-updated-v1')loadStock(true);if(event.key==='cff-code-returns-updated'){window.dispatchEvent(new Event('cff:code-gift-recheck'));loadStock(true);}});document.addEventListener('click',e=>{const edit=e.target.closest('[data-edit-stock-code]'),reserve=e.target.closest('[data-economy-stock]');if((!edit&&!reserve)||busy||!isAdmin())return;e.stopPropagation();refresh();if(edit){host.querySelector('[name=editCode]').value=edit.dataset.editStockCode;editFields();const item=stock.get(edit.dataset.editStockCode);if(item)promotionTools?.select(item.title);}else{host.querySelector('[name=code]').value=reserve.dataset.economyStock;host.querySelector('[data-reserve-submit]').disabled=!host.querySelector('[name=code]').value;preview('code','[data-stock-photo]');}window.CFF_CODES_UI?.open('rewards');const target=host.querySelector(edit?'[data-stock-edit]':'[data-stock-reserve]')||host;target.scrollIntoView({behavior:'smooth',block:'center'});if(edit&&item?.status==='claimed')host.querySelector('[name=deliveryOrigin]').focus({preventScroll:true});},true);
 window.CFF_ECONOMY_STOCK_MARK_REDEEMED=markCodeRedeemed;
 window.CFF_ECONOMY_STOCK_REFRESH=()=>loadStock(true);
 refresh();}
onAuthStateChanged(auth,user=>{accountEpoch++;incoming.invalidate();if(user?.email==='admin@centralfreefire.com.br'){mount();host.hidden=false;refresh();loadStock(true);loadNotices();}else{delete window.CFF_ECONOMY_STOCK_MARK_REDEEMED;delete window.CFF_ECONOMY_STOCK_REFRESH;archivedProtected.clear();selectedCodes.clear();noticeTitles.clear();noticeSettings=null;noticeInventory=[];stock.clear();inventory=[];rows=[];signature='';loadedAt=0;window.CFF_ECONOMY_STOCK_CODES=new Set();if(host){host.hidden=true;host.querySelectorAll('select').forEach(n=>n.replaceChildren());host.querySelectorAll('[data-stock-photo],[data-edit-photo]').forEach(n=>n.replaceChildren());}paint();}});
