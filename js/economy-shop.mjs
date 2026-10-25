// Presentation only: exact stock choices and all purchase checks remain on the server.
export const SHOP_CATEGORIES={all:'Todos',code:'Codiguinhos',game:'Itens do Free Fire',avatar:'Avatares',cover:'Capas',frame:'Molduras'};
const titleKey=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
const searchKey=value=>titleKey(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export function shopCatalog(items=[]){
 const grouped=new Map();
 for(const item of items){
  // Same reward/price can have different uploaded images. Preserve the exact
  // stock choice of one available variant; quantity is the sum of its stock.
  // Never combine differently priced products or different cosmetic assets.
  const reward=item.kind==='code'?titleKey(item.title):item.assetId||item.id;
  const key=JSON.stringify([item.kind,reward,Number(item.price)]),old=grouped.get(key);
  if(!old){grouped.set(key,{...item});continue;}
  if(item.kind==='code'){
   const quantity=Number(old.quantity||0)+Number(item.quantity||0),available=old.available||item.available;
   grouped.set(key,{...(!old.available&&item.available?item:old),quantity,available});
  }
 }
 return [...grouped.values()];
}
export function canRescue(item,state,now=Date.now()){
 if(!item.available||item.owned)return false;
 const voucher=state.vouchers?.next;
 if(item.kind==='code'&&voucher&&voucher.expiresAt>now)return true;
 return Number(state.wallet.balance)>=Number(item.price)&&!(item.kind==='code'&&state.codeRedeemAvailableAt>now);
}
export function filterShop(items,{category='all',search='',affordable=false,hideOwned=false,state}={}){
 const query=searchKey(search);
 return items.filter(p=>(category==='all'||p.kind===category)&&(!query||searchKey(p.title).includes(query))&&(!hideOwned||!p.owned)&&(!affordable||canRescue(p,state)));
}
