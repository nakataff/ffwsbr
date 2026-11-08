// Edits one reward by title; existing stock status supplies all data. No polling.
export function mountCodePromotions(host,{items,price,request,onSaved=()=>{},owner=()=>true}){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),number=n=>Number(n||0).toLocaleString('pt-BR');
 let live=true,busy=false,dirty=false,ownerAtStart=owner();
 host.innerHTML='<form class="eco-admin-form eco-promotion-form" data-code-promotion><h3>Preços e promoções da loja</h3><p>Defina o preço normal de cada item e, se desejar, um valor promocional. Aplica-se às unidades disponíveis e futuras reposições.</p><label>Prêmio<select name="prize" required></select></label><label>Preço normal em CFF Coins<input name="normalPrice" type="number" min="1" max="100000" step="1" inputmode="numeric" required placeholder="Ex.: 750"></label><label><span><input type="checkbox" name="enabled"> Ativar promoção</span><small>Desative para voltar ao preço normal.</small></label><label data-sale-field>Preço promocional em CFF COINS<input name="salePrice" type="number" min="1" step="1" inputmode="numeric" placeholder="Ex.: 700"></label><output class="eco-promotion-preview" data-price-preview aria-live="polite"></output><button type="submit" data-promotion-save>Salvar preço do prêmio</button><p role="status" data-promotion-status></p></form>';
 const form=host.querySelector('form'),f=form.elements,status=form.querySelector('[data-promotion-status]');
 const valid=()=>live&&host.isConnected&&owner()===ownerAtStart&&!!ownerAtStart;
 const available=()=>items().filter(s=>s.title&&(!s.status||s.status==='available')&&(!s.expires||s.expires>Date.now()));
 function preview(){const list=available().filter(s=>s.title===f.prize.value),base=Number(f.normalPrice.value)||Number(list[0]?.normalPrice)||Number(price()),on=f.enabled.checked;f.salePrice.disabled=!on||busy;f.salePrice.required=on;f.salePrice.max=Math.max(1,base-1);form.querySelector('[data-sale-field]').hidden=!on;form.querySelector('[data-promotion-save]').disabled=busy||!list.length;const expires=list.map(s=>s.expires).filter(Boolean),soon=expires.length?new Date(Math.min(...expires)).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'';form.querySelector('[data-price-preview]').innerHTML=list.length?`<span>${list.length} código(s) disponível(is)${soon?' · Próxima validade: '+esc(soon):''}</span><strong>${on?'<s>'+number(base)+'</s> → '+number(f.salePrice.value):number(base)} CFF COINS</strong><small>O pagamento com 1 Vale Codiguinho continua disponível.</small>`:'Escolha um prêmio com estoque disponível.';}
 function fill(){const list=available().filter(s=>s.title===f.prize.value),value=list[0]?.salePrice,base=Number(list[0]?.normalPrice)||Number(price());f.normalPrice.value=base;f.enabled.checked=!!value&&value<base;f.salePrice.value=f.enabled.checked?value:'';dirty=false;preview();}
 function render(){if(!valid()||busy)return;const current=f.prize.value,titles=[...new Set(available().map(s=>s.title))].sort((a,b)=>a.localeCompare(b,'pt-BR'));f.prize.innerHTML='<option value="">Escolha o prêmio da loja</option>'+titles.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');if(titles.includes(current))f.prize.value=current;else dirty=false;if(dirty)preview();else fill();}
 form.addEventListener('change',e=>{if(e.target===f.prize)fill();else{dirty=true;preview();}});f.salePrice.addEventListener('input',()=>{dirty=true;preview();});f.normalPrice.addEventListener('input',()=>{dirty=true;preview();});
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy||!valid()||!form.reportValidity())return;
  const title=f.prize.value,normalPrice=Number(f.normalPrice.value),salePrice=f.enabled.checked?Number(f.salePrice.value):0;
  if(!available().some(item=>item.title===title))return;
  if(!Number.isSafeInteger(normalPrice)||normalPrice<1||normalPrice>100000||!Number.isSafeInteger(salePrice)||salePrice<0||salePrice&&salePrice>=normalPrice){status.textContent='Confira os preços. A promoção deve ser menor que o preço normal.';return;}
  busy=true;form.querySelectorAll('input,select,button').forEach(n=>n.disabled=true);status.textContent='Atualizando preço…';
  try{
   const previous=available().find(item=>item.title===title),base=Number(previous?.normalPrice)||Number(price()),oldSale=Number(previous?.salePrice)||0;
   if(base!==normalPrice)await request('setCodePrice',{title,normalPrice});
   const result=oldSale!==salePrice?await request('setCodePromotion',{title,salePrice}):{ok:true,originalPrice:normalPrice,price:salePrice||normalPrice,promotion:!!salePrice};
   if(!valid())return;dirty=false;
   status.textContent=salePrice===0&&oldSale>0?'Promoção removida. O prêmio voltou ao preço normal de '+number(result.price)+' CFF Coins.':'Preço salvo: '+number(result.price)+' CFF Coins'+(result.promotion?' (promoção ativa)':'')+'.';
   await onSaved(result);
  }catch(error){if(valid())status.textContent=error.message+' Confira o preço atual antes de tentar novamente.';}
  finally{busy=false;if(valid()){form.querySelectorAll('input,select,button').forEach(n=>n.disabled=false);render();}}
 });

 render();return{render,select(title){if(!valid())return;f.prize.value=title;fill();},stop(){live=false;host.replaceChildren();}};
}
