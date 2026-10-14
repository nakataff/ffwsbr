import {economyRequest,escapeEconomy as esc} from './economy-client.mjs?v=20261014-monthly-coins-v1';
export const checkinDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function checkinMessage(data){
 const coins=data.coinsAwarded?'+1 CFF COIN recebida.':'A CFF COIN de hoje já está na sua carteira.';
 return coins+' '+(data.rankingStatus==='done'?'Check-in do ranking confirmado!':data.rankingStatus==='link_required'?'Confirme seu Instagram para fazer também o check-in do ranking.':'O ranking não confirmou agora. Tente novamente; sua moeda já está garantida.');
}
export function createProfileCheckin({auth: getAuth,onCompleted=()=>{}}){
 let root=null,uid='',day='',data=null,busy=false,loading=null,message='';
 const active=id=>getAuth()?.currentUser?.uid===id;
 function draw(){if(!root?.isConnected||!active(uid))return;const done=data?.coins&&data?.ranking;
  root.innerHTML=`<section class="cff-profile-panel cff-daily-checkin"><div class="cff-daily-checkin-icon" aria-hidden="true">${done?'✓':'◷'}</div><div class="cff-daily-checkin-copy"><span class="cff-profile-eyebrow">SUA PRESENÇA CONTA</span><h2>Check-in diário</h2><p>+1 CFF COIN e presença no ranking com seu Instagram confirmado.</p><small>Renova à meia-noite de Brasília.</small><p class="cff-daily-checkin-status" role="status" aria-live="polite">${esc(message)}</p></div><button type="button" class="cff-account-button${done?'':' primary'}" data-profile-checkin${busy||loading||done?' disabled':''}>${busy?'Confirmando…':loading?'Conferindo…':done?'Concluído hoje':data?.coins?'Confirmar no ranking':'Fazer check-in'}</button></section>`;
  root.querySelector('[data-profile-checkin]').addEventListener('click',submit);
 }
 async function submit(){if(busy||!active(uid))return;const current=uid;busy=true;message='Registrando sua presença…';draw();
  try{const result=await economyRequest(getAuth(),'profileCheckin');if(!active(current)||current!==uid)return;data=result;day=result.day;message=checkinMessage(result);window.dispatchEvent(new CustomEvent('cff:daily-checkin',{detail:{uid:current,...result}}));if(result.ranking)onCompleted();}
  catch(error){if(active(current)&&current===uid)message=error.message;}
  finally{if(current===uid){busy=false;draw();}}
 }
 function mount(container){root=container;if(!root)return;const current=getAuth()?.currentUser?.uid,today=checkinDay();
  if(current!==uid||today!==day){uid=current;day=today;data=null;message='';busy=false;loading=null;}
  if(!current)return;
  if(!data&&!loading){const identity=current,requestedDay=day;loading=economyRequest(getAuth(),'profileCheckinStatus').then(result=>{if(identity!==uid||requestedDay!==day||!active(identity))return;data=result;if(data.coins&&data.ranking)message='Sua presença de hoje já foi confirmada.';}).catch(()=>{}).finally(()=>{if(identity===uid&&requestedDay===day){loading=null;draw();}});}
  draw();
 }
 window.addEventListener('cff:daily-checkin',event=>{if(event.detail?.uid!==uid||event.detail.day!==day)return;data=event.detail;message=checkinMessage(data);draw();});
 return {mount};
}
