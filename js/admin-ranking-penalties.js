import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';

const API='https://cff-instagram-community.nakataffb4.workers.dev';
const ADMIN='admin@centralfreefire.com.br',config=window.CFF_CONFIG?.firebase;
if(!config)throw new Error('Configuração do login indisponível.');
const auth=getAuth(getApps().length?getApp():initializeApp(config));
const $=selector=>document.querySelector(selector);
let account=null,busy=false,nonce='',reverseId='',revision=0,history=[];
const number=value=>Number(value||0).toLocaleString('pt-BR');
const date=value=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(value));
const isAdmin=()=>auth.currentUser&&auth.currentUser.email?.toLowerCase()===ADMIN;
const status=(element,text,success=false)=>{
 const el=$(element);el.textContent=text||'';el.className='rp-message'+(text?(success?' is-success':' is-error'):'');
};
async function api(path,body){
 if(!isAdmin())throw new Error('Sessão administrativa expirada.');
 const uid=auth.currentUser.uid,token=await auth.currentUser.getIdToken();
 if(!isAdmin()||auth.currentUser.uid!==uid)throw new Error('Sua sessão mudou.');
 const response=await fetch(API+path,{
  method:body?'POST':'GET',cache:'no-store',signal:AbortSignal.timeout(body?45000:25000),
  headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 let data={};try{data=await response.json();}catch{}
 if(!isAdmin()||auth.currentUser.uid!==uid)throw new Error('Sua sessão mudou.');
 if(!response.ok)throw new Error(data.error||'Não foi possível completar a operação.');
 return data;
}
function setBusy(value){
 busy=value;
 for(const id of ['rp-search-button','rp-history-refresh','rp-confirm-submit','rp-reverse-submit'])
  $('#'+id).disabled=busy;
 $('#rp-apply').disabled=busy||!account||account.maximum<1;
 $('#rp-amount').disabled=busy||!account||account.maximum<1;
 $('#rp-reason').disabled=busy||!account||account.maximum<1;
}
function renderAccount(){
 $('#rp-person').hidden=!account;
 if(!account)return;
 $('#rp-found-username').textContent='@'+account.username;
 $('#rp-week').textContent=number(account.weekPoints);
 $('#rp-month').textContent=number(account.monthPoints);
 $('#rp-total').textContent=number(account.totalPoints);
 $('#rp-amount').max=String(account.maximum);
 $('#rp-limit').textContent=account.maximum>0?'(máximo '+number(account.maximum)+')':'(sem pontos disponíveis)';
 const requested=Number($('#rp-amount').value);
 $('#rp-amount').value=account.maximum>0?String(requested>0?Math.min(requested,account.maximum):Math.min(5,account.maximum)):'';
 setBusy(busy);
}
function make(tag,className='',value=''){
 const node=document.createElement(tag);if(className)node.className=className;
 if(value!==undefined&&value!=='')node.textContent=String(value);
 return node;
}
function renderHistory(){
 const host=$('#rp-history');host.replaceChildren();
 $('#rp-history-caption').textContent=account?'Registros de @'+account.username:'Últimas 30 penalidades registradas';
 if(!history.length){host.append(make('p','rp-empty',account?'Nenhuma punição registrada para este participante.':'Nenhuma punição registrada.'));return;}
 for(const item of history){
  const card=make('article','rp-entry');
  const head=make('div','rp-entry-head');
  head.append(make('strong','rp-entry-user','@'+item.username),
   make('span','rp-entry-value','−'+number(item.points)+' pontos'));
  card.append(head);
  card.append(make('small','rp-entry-date',date(item.createdAt)));
  card.append(make('div','rp-entry-reason',item.reason));
  const bottom=make('div','rp-entry-bottom');
  const reverted=Number(item.revertedAt)>0;
  bottom.append(make('span','rp-entry-status'+(reverted?' reverted':''),reverted?'Revertida':'Punição ativa'));
  if(!reverted){
   const button=make('button','admin-btn','Reverter');
   button.type='button';button.disabled=busy;
   button.addEventListener('click',()=>openReverse(item));
   bottom.append(button);
  }
  card.append(bottom);
  if(reverted){
   const info=make('div','rp-entry-reversal','Revertida em '+date(item.revertedAt)+(item.revertReason?' · Motivo: '+item.revertReason:''));
   card.append(info);
  }
  host.append(card);
 }
}
async function refresh({showMessage=false}={}){
 const seq=++revision,username=account?.username||'',query=username?'?username='+encodeURIComponent(username):'';
 setBusy(true);
 status('#rp-history-status','Carregando histórico...',true);
 try{
  const response=await api('/api/admin/ranking-penalties'+query);
  if(seq!==revision)return;
  account=response.account||null;history=response.history||[];
  renderAccount();renderHistory();
  status('#rp-history-status',showMessage?'Histórico atualizado.':'',true);
 }catch(error){
  if(seq===revision)status('#rp-history-status',error.message);
 }finally{if(seq===revision)setBusy(false);}
}
async function search(event){
 event.preventDefault();if(busy)return;
 const name=$('#rp-username').value.trim().replace(/^@/,'');
 if(!/^[a-zA-Z0-9._]{2,30}$/.test(name))return status('#rp-form-message','Digite um @Instagram válido.',false);
 const seq=++revision;setBusy(true);
 status('#rp-form-message','Buscando no ranking...',true);
 try{
  const result=await api('/api/admin/ranking-penalties?username='+encodeURIComponent(name));
  if(seq!==revision)return;
  account=result.account;history=result.history||[];nonce='';
  $('#rp-amount').value='';$('#rp-reason').value='';
  renderAccount();renderHistory();
  status('#rp-form-message','Participante localizado. Confira o @ antes de aplicar o desconto.',true);
 }catch(error){
  if(seq===revision){account=null;history=[];renderAccount();renderHistory();status('#rp-form-message',error.message);}
 }finally{if(seq===revision)setBusy(false);}
}
function openConfirm(event){
 event.preventDefault();
 if(busy||!account)return;
 const amount=Number($('#rp-amount').value),reason=$('#rp-reason').value.trim();
 if(!Number.isInteger(amount)||amount<1||amount>account.maximum)return status('#rp-form-message','O desconto deve estar entre 1 e '+account.maximum+' pontos.');
 if(reason.length<8||reason.length>300)return status('#rp-form-message','Descreva um motivo com 8 a 300 caracteres.');
 if(!nonce)nonce=crypto.randomUUID();
 $('#rp-confirm-description').textContent='Descontar '+number(amount)+' ponto(s) de @'+account.username+'? Motivo: '+reason;
 $('#rp-confirm-dialog').showModal();
}
async function confirmPenalty(event){
 event.preventDefault();if(busy||!account)return;
 const data={action:'apply',userKey:account.userKey,points:Number($('#rp-amount').value),reason:$('#rp-reason').value.trim(),nonce};
 setBusy(true);
 try{
  const result=await api('/api/admin/ranking-penalties',data);
  $('#rp-confirm-dialog').close();
  nonce='';
  $('#rp-reason').value='';$('#rp-amount').value='';
  await refresh();
  status('#rp-form-message',result.result.alreadyApplied?'Punição já registrada. Nenhum ponto foi descontado novamente.':'Desconto de '+number(data.points)+' ponto(s) aplicado. Histórico atualizado.',true);
 }catch(error){
  $('#rp-confirm-dialog').close();
  status('#rp-form-message',error.message+' Confira o histórico antes de tentar novamente.');
 }finally{setBusy(false);}
}
function openReverse(item){
 if(busy||Number(item.revertedAt)>0)return;
 reverseId=item.id;
 $('#rp-reverse-description').textContent='Devolver '+number(item.points)+' ponto(s) de @'+item.username+'? A punição continuará registrada como revertida.';
 $('#rp-reverse-reason').value='';
 status('#rp-reverse-message','');
 $('#rp-reverse-dialog').showModal();
}
async function confirmReverse(event){
 event.preventDefault();if(busy||!reverseId)return;
 const reason=$('#rp-reverse-reason').value.trim();
 if(reason.length<8||reason.length>300)return status('#rp-reverse-message','Informe um motivo de 8 a 300 caracteres.');
 setBusy(true);
 try{
  const result=await api('/api/admin/ranking-penalties',{action:'reverse',id:reverseId,reason});
  reverseId='';
  $('#rp-reverse-dialog').close();
  await refresh();
  status('#rp-form-message',result.result.alreadyReverted?'Punição já havia sido revertida.':'Punição revertida. Os pontos voltaram ao período original.',true);
 }catch(error){status('#rp-reverse-message',error.message);}
 finally{setBusy(false);}
}
$('#rp-search-form').addEventListener('submit',search);
$('#rp-apply-form').addEventListener('submit',openConfirm);
$('#rp-confirm-form').addEventListener('submit',confirmPenalty);
$('#rp-reverse-form').addEventListener('submit',confirmReverse);
$('#rp-confirm-cancel').addEventListener('click',()=>$('#rp-confirm-dialog').close());
$('#rp-reverse-cancel').addEventListener('click',()=>$('#rp-reverse-dialog').close());
$('#rp-history-refresh').addEventListener('click',()=>refresh({showMessage:true}));
$('#rp-clear').addEventListener('click',()=>{
 if(busy)return;
 account=null;nonce='';history=[];$('#rp-username').value='';$('#rp-reason').value='';$('#rp-amount').value='';
 renderAccount();status('#rp-form-message','');refresh();
});
for(const id of ['rp-amount','rp-reason'])$('#'+id).addEventListener('input',()=>{nonce='';});
onAuthStateChanged(auth,user=>{
 if(!user||user.email?.toLowerCase()!==ADMIN){
  revision++;account=null;history=[];nonce='';reverseId='';$('#rp-app').hidden=true;$('#rp-auth').hidden=false;
  $('#rp-confirm-dialog').close();$('#rp-reverse-dialog').close();
  if(user)location.replace('admin.html');
  return;
 }
 $('#rp-auth').hidden=true;$('#rp-app').hidden=false;
 refresh();
});
