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
  const key=JSON.stringify([item.kind,reward,Number(item.price),Number(item.originalPrice||item.price)]),old=grouped.get(key);
  if(!old){grouped.set(key,{...item});continue;}
  if(item.kind==='code'){
   const quantity=Number(old.quantity||0)+Number(item.quantity||0),available=old.available||item.available;
   grouped.set(key,{...(!old.available&&item.available||item.available&&Number(item.expiresAt||Infinity)<Number(old.expiresAt||Infinity)?item:old),quantity,available});
  }
 }
 return [...grouped.values()];
}
export function canRescue(item,state,now=Date.now()){
 if(!item.available||item.owned||item.kind==='code'&&item.expiresAt&&item.expiresAt<=now)return false;
 const voucher=state.vouchers?.next;
 if(item.kind==='code'&&voucher&&voucher.expiresAt>now)return true;
 return Number(state.wallet.balance)>=Number(item.price)&&!(item.kind==='code'&&state.codeRedeemAvailableAt>now);
}
export function filterShop(items,{category='all',search='',affordable=false,hideOwned=false,state}={}){
 const query=searchKey(search);
 return items.filter(p=>!(p.kind==='code'&&p.expiresAt&&p.expiresAt<=Date.now())&&(category==='all'||p.kind===category)&&(!query||searchKey(p.title).includes(query))&&(!hideOwned||!p.owned)&&(!affordable||canRescue(p,state)));
}

const expiryDate=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}),expiryTime=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'});
function calendarDay(at){const p=Object.fromEntries(expiryDate.formatToParts(new Date(at)).map(p=>[p.type,p.value]));return Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day));}
export function shopExpiry(item,now=Date.now()){
 const at=Number(item.expiresAt);if(item.kind!=='code'||!Number.isFinite(at)||at<=0)return null;
 const expired=at<=now,days=Math.max(0,Math.round((calendarDay(at)-calendarDay(now))/86400000));
 return {expired,soon:!expired&&days<=7,days,date:expiryDate.format(new Date(at)),time:expiryTime.format(new Date(at)),label:expired?'Expirado':days===0?'Vence hoje':days===1?'Vence amanhã':days<=7?'Vence em '+days+' dias':'Validade'};
}
