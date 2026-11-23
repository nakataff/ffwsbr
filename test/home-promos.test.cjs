const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
function fixture({mobile=true,reduced=false,collapsed=false}={}){
 const dom=new JSDOM(html,{url:'https://centralfreefire.com.br/',runScripts:'outside-only'}),w=dom.window;
 const timers=new Map(),queries=new Map(),scrolls=[];let next=0,intersection,hidden=false;
 w.setTimeout=(fn,delay)=>{timers.set(++next,{fn,delay});return next;};w.clearTimeout=id=>timers.delete(id);
 w.requestAnimationFrame=fn=>{fn();return 1;};w.cancelAnimationFrame=()=>{};
 w.matchMedia=query=>{if(!queries.has(query))queries.set(query,{matches:query.includes('reduced')?reduced:mobile,addEventListener(type,fn){this.change=fn;}});return queries.get(query);};
 Object.defineProperty(w.document,'hidden',{get:()=>hidden});
 w.IntersectionObserver=class{constructor(fn){intersection=fn;}observe(){}disconnect(){}};
 const host=w.document.getElementById('home-promos'),track=host.querySelector('.home-promo-track'),cards=[...track.children];
 Object.defineProperty(track,'clientWidth',{value:360});cards.forEach((card,i)=>Object.defineProperty(card,'offsetLeft',{value:i*372}));
 track.scrollTo=options=>{scrolls.push(options);track.scrollLeft=options.left;track.dispatchEvent(new w.Event('scroll'));};
 w.eval(fs.readFileSync('js/home-promos.js','utf8'));
 return{w,host,track,cards,timers,scrolls,close:()=>w.close(),advance(){const item=[...timers.entries()][0];assert(item,'Expected rotation timer');timers.delete(item[0]);item[1].fn();},media(value){const q=queries.get('(max-width:768px)');q.matches=value;q.change();},motion(value){const q=queries.get('(prefers-reduced-motion:reduce)');q.matches=value;q.change();},visible(value){intersection([{isIntersecting:value}]);},hidden(value){hidden=value;w.document.dispatchEvent(new w.Event('visibilitychange'));}};
}
test('compact promos use four unique themes, correct destinations and do not contact any service',()=>{
 const f=fixture({mobile:false});try{
  assert.equal(f.cards.length,4);assert.equal(new Set(f.cards.map(c=>c.getAttribute('style'))).size,4);
  const support=f.host.querySelector('[data-support-link]');assert.equal(support.href,'https://livepix.gg/nakataff');
  for(const a of f.host.querySelectorAll('a[href*="whatsapp"]')){const u=new URL(a.href);assert.equal(u.searchParams.get('phone'),'5521994480776');assert.match(u.searchParams.get('text'),/Instagram @nakataff/);assert(a.relList.contains('noopener'));}
  assert.equal(f.timers.size,0);assert(f.cards.every(card=>!card.inert&&!card.hasAttribute('aria-hidden')));
  assert.equal(f.host.previousElementSibling.id,'news-hero-container');
 }finally{f.close();}
});
test('mobile rotates every six seconds, allows direct selection and swipe, pauses and respects desktop resize',()=>{
 const f=fixture();try{
  assert.equal([...f.timers.values()][0].delay,6000);assert.equal(f.cards.filter(c=>c.inert).length,3);
  f.advance();assert.equal(f.host.querySelector('[aria-current="true"]').dataset.promoIndex,'1');assert.equal(f.scrolls.at(-1).left,372);
  f.host.querySelector('[data-promo-index="3"]').click();assert.equal(f.scrolls.at(-1).left,1116);
  f.track.scrollLeft=744;f.track.dispatchEvent(new f.w.Event('scroll'));assert.equal(f.host.querySelector('[aria-current="true"]').dataset.promoIndex,'2');
  const pause=f.host.querySelector('.home-promo-pause');pause.click();assert.equal(f.timers.size,0);assert.equal(pause.getAttribute('aria-pressed'),'true');pause.click();assert.equal(f.timers.size,1);
  f.media(false);assert.equal(f.timers.size,0);assert(f.cards.every(c=>!c.inert));assert.equal(f.scrolls.at(-1).left,0);
  f.media(true);assert.equal(f.timers.size,1);assert.equal(f.cards.filter(c=>c.inert).length,3);
 }finally{f.close();}
});
test('rotation suspends for reduced motion, invisible page, offscreen content, focus and an inactive home',async()=>{
 const f=fixture();try{
  f.motion(true);assert.equal(f.timers.size,0);f.motion(false);assert.equal(f.timers.size,1);
  f.visible(false);assert.equal(f.timers.size,0);f.visible(true);assert.equal(f.timers.size,1);
  f.hidden(true);assert.equal(f.timers.size,0);f.hidden(false);assert.equal(f.timers.size,1);
  f.host.querySelector('a').focus();assert.equal(f.timers.size,0);f.host.querySelector('a').blur();assert.equal(f.timers.size,1);
  f.w.document.getElementById('home').classList.remove('active');await Promise.resolve();assert.equal(f.timers.size,0);
  f.w.document.getElementById('home').classList.add('active');await Promise.resolve();assert.equal(f.timers.size,1);
 }finally{f.close();}
});
test('bottom dock keeps its five links and stored preference with an icon-only, accessible edge control',()=>{
 for(const stored of ['0','1']){
  const dom=new JSDOM('<body><div id="main-content"></div></body>',{url:'https://centralfreefire.com.br/',runScripts:'outside-only'}),w=dom.window;
  try{
   w.localStorage.setItem('cff-bottom-navigation-collapsed-v1',stored);
   w.eval(fs.readFileSync('js/shared-navigation.js','utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
   const nav=w.document.querySelector('.cff-bottom-navigation'),toggle=w.document.querySelector('.cff-bottom-navigation-toggle');
   assert.equal(nav.querySelectorAll('a').length,5);assert.equal(toggle.textContent,'');assert.equal(toggle.querySelectorAll('svg').length,1);
   assert.equal(toggle.getAttribute('aria-expanded'),stored==='1'?'false':'true');assert.equal(nav.inert,stored==='1');
   toggle.click();assert.equal(toggle.getAttribute('aria-expanded'),stored==='1'?'true':'false');assert.equal(w.localStorage.getItem('cff-bottom-navigation-collapsed-v1'),stored==='1'?'0':'1');
   assert.equal(toggle.getAttribute('aria-controls'),nav.id);assert.match(toggle.getAttribute('aria-label'),/menu inferior/);
  }finally{w.close();}
 }
});

test('publishing a new set remounts the carousel without stacking timers and every card is a single direct link',()=>{
 const f=fixture();try{
  assert(f.cards.every(card=>card.tagName==='A'&&card.href.startsWith('https://')&&!card.querySelector('a')));
  assert.equal(f.host.querySelectorAll('a').length,4);assert.equal(f.cards[0].querySelector('.home-promo-action').textContent,'Consultar valores');
  for(let i=0;i<5;i++)f.host.dispatchEvent(new f.w.Event('cff:promos-updated'));
  assert.equal(f.timers.size,1);assert.equal(f.host.querySelectorAll('[data-promo-index]').length,4);
  f.track.innerHTML='';f.host.hidden=true;f.host.dispatchEvent(new f.w.Event('cff:promos-updated'));assert.equal(f.timers.size,0);
 }finally{f.close();}
});
