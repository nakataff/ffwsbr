const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {JSDOM} = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const source = fs.readFileSync('js/home-support.js', 'utf8');
const DAY = 86400000;
function setup({hidden=false, blocked=false, local={}, session={}, unavailable=false}={}) {
  const dom = new JSDOM(html, {url:'https://centralfreefire.com.br/', runScripts:'outside-only'});
  const w = dom.window;
  let now = 2000000000000, timer;
  w.Date.now = () => now;
  Object.defineProperty(w.document, 'hidden', {get:()=>hidden});
  w.setTimeout = fn => {timer=fn;return 1;};
  w.HTMLDialogElement.prototype.showModal = function(){this.setAttribute('open','');};
  w.HTMLDialogElement.prototype.close = function(){if(this.open){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));}};
  for (const [k,v] of Object.entries(local)) w.localStorage.setItem(k,v);
  for (const [k,v] of Object.entries(session)) w.sessionStorage.setItem(k,v);
  if (blocked) w.document.body.insertAdjacentHTML('beforeend','<dialog open>Another invitation</dialog>');
  if (unavailable) Object.defineProperty(w, 'sessionStorage', {get(){throw new Error('Disabled storage');}});
  const run = () => vm.runInContext(source, dom.getInternalVMContext());
  run();
  return {w,dom,run,advance:ms=>now+=ms,show:()=>timer?.(),dialog:()=>w.document.getElementById('cff-support-dialog')};
}
test('support stays directly above the Mundial on desktop, mobile and resize',()=>{
  const x=setup();
  try {
    let mobile=false,change;
    x.w.matchMedia=()=>({get matches(){return mobile;},addEventListener:(_,fn)=>change=fn});
    x.w.setInterval=()=>1;x.w.clearInterval=()=>{};
    vm.runInContext(fs.readFileSync('js/home-global-finals.js','utf8'),x.dom.getInternalVMContext());
    const card=x.w.document.querySelector('.home-support'),board=x.w.document.querySelector('#home-global-classified');
    for (const value of [false,true,false]) {
      mobile=value;change();
      assert.equal(card.nextElementSibling,board);
      assert(card.parentElement.matches(mobile?'.home-left-rail':'.home-center-column'));
    }
  } finally {x.w.close();}
});
test('invitation opens with safe campaign link and dismisses for exactly 24 hours',()=>{
  const x=setup();
  try {
    const before=x.w.document.querySelector('.home-support a');before.focus();
    x.show();const d=x.dialog();assert(d?.open);
    assert.equal(d.querySelector('a').href,'https://vaquinha.livepix.gg/central-free-fire');
    assert.equal(d.querySelector('a').target,'_blank');
    assert(d.querySelector('a').relList.contains('noopener'));
    assert(d.textContent.includes('por 1 dia'));assert(!d.textContent.includes('7 dias'));
    d.querySelector('[data-support-dismiss]').click();assert(!x.dialog());
    assert.equal(Number(x.w.localStorage.getItem('cff-support-hidden-until-v1')),2000000000000+DAY);
    assert.equal(x.w.document.activeElement,before);
    x.show();assert(!x.dialog());
    x.advance(DAY+1);x.show();assert(x.dialog()?.open);
  } finally {x.w.close();}
});
test('Escape and backdrop close both persist the same one-day cooldown',()=>{
  for(const kind of ['escape','backdrop']){
    const x=setup();try{x.show();const d=x.dialog();
      if(kind==='escape')d.dispatchEvent(new x.w.Event('cancel',{cancelable:true}));
      else d.dispatchEvent(new x.w.MouseEvent('click',{clientX:-1,clientY:-1}));
      assert(!x.dialog());assert.equal(Number(x.w.localStorage.getItem('cff-support-hidden-until-v1')),2000000000000+DAY);
    }finally{x.w.close();}
  }
});
test('another overlay, hidden page, unavailable storage or another route prevents interruption',()=>{
  for(const options of [{blocked:true},{hidden:true},{unavailable:true},{}]){
    const x=setup(options);try{if(!Object.keys(options).length)x.w.document.getElementById('home').classList.remove('active');x.show();assert(!x.dialog());}finally{x.w.close();}
  }
});
test('dismissal survives reload; a session expires after one day instead of blocking forever',()=>{
  for(const options of [{local:{'cff-support-hidden-until-v1':2000000000001}},{session:{'cff-support-seen-v1':2000000000000}}]){
    const x=setup(options);try{x.show();assert(!x.dialog());}finally{x.w.close();}
  }
  const x=setup({session:{'cff-support-seen-v1':2000000000000-DAY-1}});
  try{x.show();assert(x.dialog()?.open);}finally{x.w.close();}
});
test('clicking the card silences the invitation and cross-tab dismissal closes an open one',()=>{
  const x=setup();try{
    x.w.document.querySelector('.home-support a').dispatchEvent(new x.w.MouseEvent('click',{cancelable:true}));
    x.show();assert(!x.dialog());
    x.advance(DAY+1);x.show();assert(x.dialog()?.open);
    x.w.dispatchEvent(new x.w.StorageEvent('storage',{key:'cff-support-hidden-until-v1',newValue:String(2000000000000+3*DAY)}));
    assert(!x.dialog());
  }finally{x.w.close();}
});
