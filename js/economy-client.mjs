import {publishInbox,inboxSnapshot} from './inbox-store.mjs?v=20261019-inbox-v1';
import {publishWalletBalance,walletSnapshot} from './wallet-balance.mjs?v=20261017-header-wallet-v1';
const API='https://cff-camp-notifications.nakataffb4.workers.dev/api';
const KEY='cff-pending-invite-v1';
export function rememberInvite(){try{const code=new URL(location.href).searchParams.get('invite');if(/^[A-F0-9]{12}$/i.test(code||''))localStorage.setItem(KEY,JSON.stringify({code:code.toUpperCase(),at:Date.now()}));}catch{}}
export async function economyRequest(auth,operation,body={},admin=false){
 const user=auth.currentUser,startedAt=Date.now();if(!user)throw Error('Entre com Google para continuar.');
 const token=await user.getIdToken();const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({...body,action:admin?'economyAdmin':'economy',operation}),keepalive:operation==='inboxRead',signal:AbortSignal.timeout(operation==='profileCheckin'?45000:30000)});
 const data=await r.json();if(!r.ok||data.error)throw Error(data.error||'Não foi possível acessar os pontos agora.');if(auth.currentUser?.uid!==user.uid)throw Error('Sua conta mudou. Atualize a página.');if(!admin&&data.inbox&&!(inboxSnapshot(user.uid)?.at>startedAt))publishInbox(user.uid,data.inbox);if(!admin&&(!['wallet','profileCheckinStatus','quizStatus'].includes(operation)||!(walletSnapshot(user.uid)?.at>startedAt)))publishWalletBalance(user.uid,data.wallet);return data;
}
let attaching=null;
export async function attachPendingReferral(auth){
 if(attaching)return attaching;let invite;try{invite=JSON.parse(localStorage.getItem(KEY));}catch{}if(!invite||Date.now()-invite.at>86400000){try{localStorage.removeItem(KEY);}catch{}return;}
 attaching=economyRequest(auth,'attachReferral',{code:invite.code}).then(()=>{try{localStorage.removeItem(KEY);}catch{}}).finally(()=>{attaching=null;});return attaching;
}
export const escapeEconomy=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function loadEconomyStyle(){let l=document.querySelector('link[data-economy-style]');if(!l){l=document.createElement('link');l.rel='stylesheet';l.dataset.economyStyle='1';document.head.append(l);}l.href='/css/economy.css?v=20261019-shop-navigation-v1';}
