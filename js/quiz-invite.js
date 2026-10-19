(() => {
 'use strict';
 if(window.__cffQuizInviteReady)return;window.__cffQuizInviteReady=true;
 const KEY='cff-quiz-invite-hidden-until-v1',SEEN='cff-quiz-invite-seen-v1',DONE='cff-quiz-completed-day-v1',DAY=86400000;
 const read=(storage,key)=>{try{return window[storage].getItem(key);}catch{return null;}};
 const write=(storage,key,value)=>{try{window[storage].setItem(key,String(value));}catch{}};
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const playing=()=>new URLSearchParams(location.search).get('tab')==='quiz';
 const suppressed=()=>playing()||Number(read('localStorage',KEY))>Date.now()||read('localStorage',DONE)===today()||Number(read('sessionStorage',SEEN))>Date.now()-DAY;
 let panel=null;
 function remove(){panel?.remove();panel=null;}
 function dismiss(){write('localStorage',KEY,Date.now()+DAY);remove();}
 function show(){
  const home=document.getElementById('home');
  if(suppressed()||document.hidden||home&&!home.classList.contains('active')||document.querySelector('dialog[open],.modal-overlay.active,#sidebar-panel.active'))return;
  panel=document.createElement('aside');panel.className='cff-quiz-invite';panel.setAttribute('aria-label','Quiz diário da Central');
  panel.innerHTML='<button type="button" class="cff-quiz-invite-close" aria-label="Fechar convite do quiz por 1 dia">×</button><span class="cff-quiz-invite-kicker">DESAFIO DIÁRIO</span><h2>Manja de Free Fire?</h2><p>São 3 perguntinhas por dia para testar seu conhecimento e ganhar CFF COINS por acerto.</p><div><a href="/conta.html?tab=quiz">Jogar o quiz <span aria-hidden="true">↗</span></a><button type="button" data-quiz-invite-later>Agora não</button></div><small>Grátis · Novas perguntas todos os dias</small>';
  panel.querySelector('.cff-quiz-invite-close').addEventListener('click',dismiss);panel.querySelector('[data-quiz-invite-later]').addEventListener('click',dismiss);panel.querySelector('a').addEventListener('click',()=>{write('localStorage',KEY,Date.now()+DAY);remove();});
  document.body.append(panel);write('sessionStorage',SEEN,Date.now());
 }
 setTimeout(show,6000);
 window.addEventListener('storage',e=>{if(e.key===KEY||e.key===DONE)remove();});
 window.addEventListener('cff:quiz-complete',()=>{write('localStorage',DONE,today());remove();});
 window.addEventListener('hashchange',()=>{const home=document.getElementById('home');if(home&&!home.classList.contains('active'))remove();});
 document.addEventListener('click',e=>{if(e.target.closest('[data-account-tab="quiz"]'))remove();});
})();
