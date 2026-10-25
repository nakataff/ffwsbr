// Daily reminders reuse account/check-in/quiz responses. No network calls or polling.
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let identity={uid:'',name:'',instagram:'checking'};
const key=uid=>'cff-daily-tasks-v1:'+uid;
function read(){try{const value=JSON.parse(localStorage.getItem(key(identity.uid)));return value?.day===day()?value:{};}catch{return {};}}
function state(){const data=read(),signed=!!identity.uid;return {signed,name:identity.name,tasks:[
 {id:'checkin',title:'Check-in diário',copy:'Garanta sua CFF COIN de hoje',href:'/conta.html#cff-daily-checkin',done:data.checkin===true},
 {id:'quiz',title:'Desafios diários',copy:'3 desafios · +5 moedas se acertar tudo',href:'/conta.html?tab=quiz',done:data.quiz===true},
 {id:'instagram',title:'Vincular Instagram',copy:'Conecte seu @ para participar do ranking',href:'/conta.html#cff-instagram-connect',done:identity.instagram==='linked',checking:identity.instagram==='checking'}]};}
function draw(){
 const s=state(),pending=s.signed&&s.tasks.some(t=>!t.done&&!t.checking);
 document.querySelectorAll('[data-account-entry],[data-cff-bottom="profile"]').forEach(entry=>{
  let dot=entry.querySelector('[data-daily-dot]');
  if(pending&&!dot){dot=document.createElement('span');dot.dataset.dailyDot='';dot.className='cff-daily-dot';dot.setAttribute('role','img');dot.setAttribute('aria-label','Há atividades diárias para conferir');entry.append(dot);}
  if(!pending)dot?.remove();
 });
 document.querySelectorAll('[data-daily-tasks]').forEach(root=>{
  root.innerHTML=s.signed?'<section class="cff-daily-hub" aria-label="Atividades diárias"><header><div><small>SEU DIA NA CENTRAL</small><h2>O que fazer hoje</h2></div><span>'+s.tasks.filter(t=>t.done).length+'/3</span></header><div>'+s.tasks.map(t=>'<a class="cff-daily-task'+(t.done?' is-done':'')+'" href="'+t.href+'"><span class="cff-daily-task-icon" aria-hidden="true">'+(t.done?'✓':t.id==='quiz'?'✦':t.id==='instagram'?'@':'◷')+'</span><span><b>'+t.title+'</b><small>'+esc(t.done?(t.id==='instagram'?'Instagram vinculado':'Concluído hoje'):t.checking?'Conferindo vínculo…':t.copy)+'</small></span><em>'+(t.done?'✓':t.checking?'…':'Abrir ›')+'</em></a>').join('')+'</div><p>Check-in e desafios renovam à meia-noite de Brasília. Abra o atalho para conferir seu progresso.</p></section>':'<p class="cff-daily-guest">Entre na sua conta para fazer o check-in, jogar os desafios e ganhar moedas.</p>';
 });
}
function record(kind,event){const info=event.detail;if(!identity.uid||info?.uid!==identity.uid||info.day!==day())return;const data=read();data.day=info.day;data[kind]=kind==='quiz'?!!info.complete:!!info.coins;try{localStorage.setItem(key(identity.uid),JSON.stringify(data));}catch{}draw();}
window.addEventListener('cff:daily-checkin',e=>record('checkin',e));
window.addEventListener('cff:daily-checkin-status',e=>record('checkin',e));
window.addEventListener('cff:daily-quiz-status',e=>record('quiz',e));
window.addEventListener('storage',e=>{if(e.key===key(identity.uid))draw();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)draw();});
window.CFF_DAILY_TASKS={state,draw,setIdentity(next){identity=next;draw();}};
const style=document.createElement('link');style.rel='stylesheet';style.href='/css/daily-tasks.css?v=20261025-daily-v1';document.head.append(style);
