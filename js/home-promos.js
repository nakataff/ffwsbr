(() => {
 'use strict';
 const host=document.getElementById('home-promos'),home=document.getElementById('home');
 if(!host)return;
 function mount(){
 const abort=new AbortController();
 const on=(target,type,fn,options={})=>target.addEventListener(type,fn,{...options,signal:abort.signal});
 const track=host.querySelector('.home-promo-track'),cards=[...track.children];
 if(!cards.length)return ()=>{};
 const controls=host.querySelector('.home-promo-controls'),dots=host.querySelector('.home-promo-dots'),pause=host.querySelector('.home-promo-pause');
 const mobile=matchMedia('(max-width:768px)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
 let index=0,timer,visible=true,hover=false,focused=false,paused=false,frame;
 dots.innerHTML=cards.map((card,i)=>`<button type="button" data-promo-index="${i}" aria-controls="home-promo-track" aria-label="Mostrar card ${i+1}: ${String(card.dataset.promoLabel).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}" aria-current="${i===0}"></button>`).join('');
 controls.hidden=cards.length<2;
 const buttons=[...dots.children];
 const canRotate=()=>cards.length>1&&mobile.matches&&!reduced.matches&&!paused&&!hover&&!focused&&visible&&!document.hidden&&home.classList.contains('active');
 function schedule(){
  clearTimeout(timer);
  if(canRotate())timer=setTimeout(()=>{show((index+1)%cards.length);schedule();},Number(host.dataset.interval||6)*1000);
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
 on(dots,'click',event=>{
  const button=event.target.closest('[data-promo-index]');
  if(button){show(Number(button.dataset.promoIndex));schedule();}
 });
 on(pause,'click',()=>{
  paused=!paused;
  pause.setAttribute('aria-pressed',String(paused));
  pause.setAttribute('aria-label',paused?'Retomar troca automática dos cards':'Pausar troca automática dos cards');
  pause.querySelector('path').setAttribute('d',paused?'m7 5 7 5-7 5Z':'M7 5v10M13 5v10');
  schedule();
 });
 on(track,'scroll',()=>{
  cancelAnimationFrame(frame);
  frame=requestAnimationFrame(()=>{
   if(!mobile.matches)return;
   const next=Math.round(track.scrollLeft/(track.clientWidth+12));
   if(next!==index){index=Math.max(0,Math.min(cards.length-1,next));sync();}
  });
 },{passive:true});
 on(track,'pointerdown',()=>{clearTimeout(timer);});
 on(track,'pointerup',schedule);
 on(track,'pointercancel',schedule);
 on(host,'mouseenter',()=>{hover=true;schedule();});
 on(host,'mouseleave',()=>{hover=false;schedule();});
 on(host,'focusin',()=>{focused=true;schedule();});
 on(host,'focusout',event=>{focused=host.contains(event.relatedTarget);schedule();});
 function resize(){
  track.scrollTo({left:mobile.matches?cards[index].offsetLeft-cards[0].offsetLeft:0,behavior:'auto'});
  sync();schedule();
 }
 on(mobile,'change',resize);on(reduced,'change',schedule);
 on(document,'visibilitychange',schedule);
 const homeObserver=new MutationObserver(schedule);homeObserver.observe(home,{attributes:true,attributeFilter:['class']});
 let observer;
 if('IntersectionObserver' in window){observer=new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);schedule();});observer.observe(host);}
 on(window,'resize',resize,{passive:true});
 sync();schedule();
 return ()=>{abort.abort();clearTimeout(timer);cancelAnimationFrame(frame);homeObserver.disconnect();observer?.disconnect();};
 }
 let cleanup=mount();
 host.addEventListener('cff:promos-updated',()=>{cleanup();cleanup=mount();});
})();
