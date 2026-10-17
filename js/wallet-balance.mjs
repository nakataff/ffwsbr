// Shared by all economy-client versions: no timers, database calls or user catalog.
const KEY='cff-wallet-balance-v1',TTL=5*60*1000,values=new Map(),listeners=new Set();
export function walletSnapshot(uid){
 if(!uid)return null;
 if(values.has(uid))return values.get(uid);
 try{const value=JSON.parse(localStorage.getItem(KEY));if(value?.uid===uid&&Number.isSafeInteger(value.balance)&&value.balance>=0&&Number.isFinite(value.at)&&value.at<=Date.now()){values.set(uid,value);return value;}}catch{}
 return null;
}
export function walletFresh(value){return !!value&&Date.now()-value.at<TTL;}
export function publishWalletBalance(uid,wallet){
 const balance=wallet?.balance;if(!uid||!Number.isSafeInteger(balance)||balance<0)return;
 const value={uid,balance,at:Date.now()};values.set(uid,value);
 try{localStorage.setItem(KEY,JSON.stringify(value));}catch{}
 listeners.forEach(fn=>fn(value));
}
export function forgetWalletBalance(uid){
 values.delete(uid);try{if(JSON.parse(localStorage.getItem(KEY))?.uid===uid)localStorage.removeItem(KEY);}catch{}
}
export function subscribeWalletBalance(fn){listeners.add(fn);return()=>listeners.delete(fn);}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{
 if(event.key!==KEY||!event.newValue)return;
 try{const v=JSON.parse(event.newValue);if(v?.uid&&Number.isSafeInteger(v.balance)&&v.balance>=0&&Number.isFinite(v.at)&&v.at<=Date.now()){const old=values.get(v.uid);if(!old||v.at>=old.at){values.set(v.uid,v);listeners.forEach(fn=>fn(v));}}}catch{}
});
