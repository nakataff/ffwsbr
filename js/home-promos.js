(() => {
 'use strict';
 const host=document.getElementById('home-promos'),home=document.getElementById('home');
 if(!host||host.dataset.ready)return;
 host.dataset.ready='1';
 const track=host.querySelector('.home-promo-track'),cards=[...track.children];
 const controls=host.querySelector('.home-promo-controls'),dots=host.querySelector('.home-promo-dots'),pause=host.querySelector('.home-promo-pause');
 const mobile=matchMedia('(max-width:768px)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
 let index=0,timer,visible=true,hover=false,focused=false,paused=false,frame;
 dots.innerHTML=cards.map((card,i)=>`<button type="button" data-promo-index="${i}" aria-controls="home-promo-track" aria-label="Mostrar card ${i+1}: ${card.dataset.promoLabel}" aria-current="${i===0}"></button>`).join('');
 controls.hidden=false;
 const buttons=[...dots.children];
 const canRotate=()=>mobile.matches&&!reduced.matches&&!paused&&!hover&&!focused&&visible&&!document.hidden&&home.classList.contains('active');
 function schedule(){
  clearTimeout(timer);
  if(canRotate())timer=setTimeout(()=>{show((index+1)%cards.length);schedule();},6000);
 }
 function sync(){
  cards.forEach((card,i)=>{
   const offscreen=mobile.matches&&i!==index;
   card.inert=offscreen;
   if(offscreen)card.setAttribute('aria-hidden','true');else card.removeAttribute('aria-hidden');
  });
  buttons.forEach((button,i)=>button.setAttribute('aria-current',String(i===index)));
 }
 function show(next){
  index=Math.max(0,Math.min(cards.length-1,next));sync();
  track.scrollTo({left:cards[index].offsetLeft-cards[0].offsetLeft,behavior:reduced.matches?'auto':'smooth'});
 }
 dots.addEventListener('click',event=>{
  const button=event.target.closest('[data-promo-index]');
  if(button){show(Number(button.dataset.promoIndex));schedule();}
 });
 pause.addEventListener('click',()=>{
  paused=!paused;
  pause.setAttribute('aria-pressed',String(paused));
  pause.setAttribute('aria-label',paused?'Retomar troca automática dos cards':'Pausar troca automática dos cards');
  pause.querySelector('path').setAttribute('d',paused?'m7 5 7 5-7 5Z':'M7 5v10M13 5v10');
  schedule();
 });
 track.addEventListener('scroll',()=>{
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{
   if(!mobile.matches)return;
   const next=Math.round(track.scrollLeft/(track.clientWidth+12));
   if(next!==index){index=Math.max(0,Math.min(cards.length-1,next));sync();}
  });
 },{passive:true});
 track.addEventListener('pointerdown',()=>{clearTimeout(timer);});
 track.addEventListener('pointerup',schedule);
 track.addEventListener('pointercancel',schedule);
 host.addEventListener('mouseenter',()=>{hover=true;schedule();});
 host.addEventListener('mouseleave',()=>{hover=false;schedule();});
 host.addEventListener('focusin',()=>{focused=true;schedule();});
 host.addEventListener('focusout',event=>{focused=host.contains(event.relatedTarget);schedule();});
 function resize(){
  track.scrollTo({left:mobile.matches?cards[index].offsetLeft-cards[0].offsetLeft:0,behavior:'auto'});
  sync();schedule();
 }
 mobile.addEventListener('change',resize);reduced.addEventListener('change',schedule);
 document.addEventListener('visibilitychange',schedule);
 new MutationObserver(schedule).observe(home,{attributes:true,attributeFilter:['class']});
 if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);schedule();}).observe(host);
 window.addEventListener('resize',resize,{passive:true});
 sync();schedule();
})();
