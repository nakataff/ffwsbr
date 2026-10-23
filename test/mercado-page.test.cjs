'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom'),read=p=>fs.readFileSync(p,'utf8');
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r));};
const rows=[{id:'m1',jogador:'MT7',status:'fechado',timeOrigem:'LOUD',timeDestino:'W7M',escudoOrigem:'',escudoDestino:'',foto:'silhueta.webp',careerManaged:true,atualizacao:'23/10/2026'}, {id:'m2',jogador:'Joker',personId:'coach-loud-joker',role:'Coach',status:'rumor',timeOrigem:'LOUD',timeDestino:'',careerManaged:true}];
async function ui({cache,offline=false,pages=false}={}){
 const dom=new JSDOM(read('mercado.html'),{url:'https://centralfreefire.com.br/mercado.html?time=btr&grupo=A',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,calls=[],votes=[];
 w.console.warn=()=>{};w.console.error=()=>{};w.CFF_CONFIG={sheets:{mercado:'https://example.invalid/old-sheet'}};w.fbLoadVotes=()=>{};w.fbVote=(...a)=>votes.push(a);
 w.requestAnimationFrame=fn=>{fn();return 1;};w.AbortController=AbortController;
 if(cache)w.localStorage.setItem('cff_mercado_api_cache_v1',JSON.stringify(cache));
 w.fetch=async url=>{url=String(url);calls.push(url);let data;
  if(url.includes('/careers/market')){if(offline)throw Error('Offline');data={ok:true,entries:pages&&url.includes('offset=')?[{...rows[0],id:'m3',jogador:'Yago'}]:rows,total:3,hasMore:pages&&!url.includes('offset=')};}
  else if(url.includes('logo-map.json'))data={logos:{LOUD:'loud.webp',W7M:'w7m.webp'},aliases:{}};
  else if(url.includes('routes.json'))data={routes:{mt7:'s:fluxo-w7m',yago:'s:los'}};
  else if(url.includes('market-fallback'))data={entries:rows};
  else throw Error('Unexpected request '+url);
  return {ok:true,json:async()=>structuredClone(data),text:async()=>JSON.stringify(data)};
 };
 for(const script of ['js/charts-market.min.js','js/mercado-status-performance-hotfix.min.js','js/mercado-page.js'])vm.runInContext(read(script),dom.getInternalVMContext());
 await settle();return {w,dom,calls,votes,$:s=>w.document.querySelector(s),all:s=>[...w.document.querySelectorAll(s)],close:()=>w.close()};
}
test('Mercado is real standalone HTML and no longer a hidden page inside the index',()=>{
 const d=new JSDOM(read('mercado.html')).window.document;
 assert.equal(d.querySelector('main').id,'mercado');assert(d.querySelector('#mercado-list'));assert.equal(d.querySelectorAll('button.mercado-filter-chip').length,7);assert.equal(d.querySelector('title').textContent,'Mercado da Bala | Central Free Fire');assert(d.querySelector('link[rel=canonical]').href.endsWith('/mercado.html'));
 const scripts=[...d.querySelectorAll('script')].map(s=>s.src||s.textContent).join(' ');assert(!scripts.includes('location.replace'));assert(!scripts.includes('site-shell-fast'));assert(!scripts.includes('core-data'));assert(!scripts.includes('chart.js'));
 const index=new JSDOM(read('index.html')).window.document;assert(!index.getElementById('mercado'));assert(!index.getElementById('mercado-list'));assert(index.getElementById('home-mercado-list'));assert(index.querySelector('a[href="/mercado.html"]'));assert(Buffer.byteLength(read('mercado.html'))<12000);assert(Buffer.byteLength(read('css/mercado.css'))<16000);
});
test('the existing bounded API feeds the standalone page, with real filters, photos, logos and profile links',async()=>{
 const u=await ui();try{
  assert.equal(u.all('.mercado-card').length,2);assert.equal(u.calls.filter(x=>x.includes('/careers/market')).length,1);assert(!u.calls.some(x=>/google|players.json|stages.json|career.*catalog/.test(x)));assert.equal(u.w.location.search,'');
  assert(u.$('.mercado-card-avatar').src.endsWith('/silhueta.webp'));assert(u.$('.mercado-club img').src.endsWith('/loud.webp'));
  assert(u.$('.mercado-player-name-link[href*="id=mt7"]'));assert(u.$('a[href="/carreira.html?id=coach-loud-joker"]'));assert(u.$('.mercado-club[href*="equipe-historica.html?time=LOUD"]'));
  const chip=u.$('[data-filter=rumor]');u.w.filterMercado(chip,'rumor');assert.equal(u.all('.mercado-card:not([hidden])').length,1);assert.equal(chip.getAttribute('aria-pressed'),'true');
  u.w.filterMercado(u.$('[data-filter=all]'),'all');u.$('#mercado-team-filter').value='W7M';u.w.renderMercado();assert.equal(u.all('.mercado-card:not([hidden])').length,1);assert.equal(u.calls.filter(x=>x.includes('/careers/market')).length,1);
  u.$('#mercado-team-filter').value='all';u.w.renderMercado();const button=u.$('.vote-btn[data-vote=up]');u.w.voteMercado({stopPropagation(){},target:button},'MT7','up');assert.deepEqual(u.votes[0],['MT7','up',null]);assert.equal(u.$('[data-vote-count=up]').textContent,'1');assert(button.getAttribute('aria-label').includes('MT7'));
 }finally{u.close();}
});
test('fresh cache avoids a second feed request from the home, and older movements load only on click',async()=>{
 const cached={rows,savedAt:Date.now(),raw:JSON.stringify({ok:true,entries:rows,hasMore:false})},u=await ui({cache:cached});try{assert.equal(u.all('.mercado-card').length,2);assert.equal(u.calls.filter(x=>x.includes('/careers/market')).length,0);}finally{u.close();}
 const more=await ui({pages:true});try{assert.equal(more.calls.filter(x=>x.includes('/careers/market')).length,1);assert(!more.$('#mercado-load-more').hidden);more.$('#mercado-load-more').click();await settle();assert.equal(more.all('.mercado-card').length,3);assert.equal(more.calls.filter(x=>x.includes('/careers/market')).length,2);assert(more.$('#mercado-load-more').hidden);}finally{more.close();}
 const old=await ui({cache:{...cached,savedAt:1},offline:true});try{assert.equal(old.all('.mercado-card').length,2);assert.equal(old.calls.filter(x=>x.includes('/careers/market')).length,1);}finally{old.close();}
});
test('legacy index links redirect cleanly, hash changes remain compatible and unrelated pages are untouched',()=>{
 for(const pathname of ['/','/index.html']){
  let destination='',handler;const c={window:{addEventListener:(name,fn)=>handler=fn},location:{pathname,search:'?time=btr',hash:'#mercado',replace:x=>destination=x}};vm.runInNewContext(read('js/root-page-redirects.js'),c);assert.equal(destination,'/mercado.html');assert.equal(c.window.cffRootPageUrl('mercado'),'/mercado.html');destination='';c.location.hash='#hall-da-fama';handler();assert.equal(destination,'');c.location.hash='#mercado';handler();assert.equal(destination,'/mercado.html');
 }
 const source=read('js/site-shell-fast.min.js');assert(source.includes("if(page==='mercado'){location.href='/mercado.html';return page;}"));assert(source.includes("if(location.hash==='#mercado'){location.replace('/mercado.html');return;}"));
});
test('shared menus and saved mobile shortcuts link directly and mark the standalone Mercado active',async()=>{
 const u=await ui();try{let calls=0;u.w.navigate=()=>calls++;u.w.eval(read('js/shared-navigation.js'));u.w.document.dispatchEvent(new u.w.Event('DOMContentLoaded'));const link=u.$('[data-cff-route=mercado]');assert(link);assert.equal(link.getAttribute('href'),'/mercado.html');assert.equal(link.getAttribute('aria-current'),'page');const event=new u.w.MouseEvent('click',{bubbles:true,cancelable:true,button:0});link.dispatchEvent(event);assert(!event.defaultPrevented);assert.equal(calls,0);
  u.w.localStorage.setItem('cff-mobile-dock-v1',JSON.stringify([{route:'mercado',icon:'bolt'}]));u.w.eval(read('js/mobile-dock.js'));const dock=u.$('[data-cff-bottom-route=mercado]');assert(dock);assert.equal(dock.getAttribute('href'),'/mercado.html');assert.equal(dock.getAttribute('aria-current'),'page');
 }finally{u.close();}
});
test('standalone voting reuses existing storage and subscribes only once',async()=>{
 let subscriptions=0;const c={window:{fbLoadVotes:()=>subscriptions++},mercadoHasLoaded:true};vm.runInNewContext(read('js/mercado-votes.mjs').replace(/^import .*;$/m,''),c);c.window.fbLoadVotes();c.window.fbLoadVotes();assert.equal(subscriptions,1);
});
