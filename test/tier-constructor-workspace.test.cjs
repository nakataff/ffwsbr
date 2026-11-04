'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('tier-constructor.html');
const js=read('js/tier-constructor.js');
const css=read('css/tier-constructor-workspace.css');
function tick(){return new Promise(resolve=>setTimeout(resolve,30));}

test('banco e rows compartilham o editor; biblioteca e projetos existentes continuam acessíveis',()=>{
 assert.match(html,/id="tierEditorLayout"[^>]*data-bank-layout="left"/);
 const area=html.slice(html.indexOf('id="tierEditorLayout"'),html.indexOf('id="tierSiteLibrary"'));
 assert.ok(area.includes('id="imageBank"'));
 assert.ok(area.includes('id="tierBoard"'));
 assert.ok(area.indexOf('id="imageBank"')<area.indexOf('id="tierBoard"'));
 for(const id of ['tierBankLayoutButtons','toggleEditControlsBtn','settingsBtn','projectMenu','tierSiteLibrary','tierAssetResults','imageBank','trashPanel','tierBoard'])assert.ok(html.includes('id="'+id+'"'),id);
 for(const preset of ['wb-2026-s1','wb-2026-s2','ewc-2026','ffws-global-2026'])assert.ok(html.includes('data-tier-preset="'+preset+'"'),preset);
 assert.match(html,/tier-constructor-workspace\.css\?v=20261102-(?:workspace|nameplates|text-scroll|name-size)-v1/);
 assert.match(html,/tier-constructor\.js\?v=(?:20261104-(?:short-links|mobile-fullscreen)-v1|20261104-(?:chat-rows-v2|tier-preview-v1)|20261102-(?:workspace|nameplates|text-scroll|name-size)-v1)/);
});
test('toolbar sem sticky, banco lateral no PC e faixas roláveis no celular',()=>{
 assert.match(css,/\.tier-constructor-app \.topbar\s*\{[^}]*position:static/s);
 assert.match(css,/grid-template-columns:clamp\(230px,23vw,320px\) minmax\(0,1fr\)/);
 assert.match(css,/data-bank-layout="bottom"/);
 assert.match(css,/@media\(max-width:960px\)/);
 assert.match(css,/position:sticky/);
 assert.match(css,/overflow-x:auto/);
 for(const selector of ['.row-delete-button','.row-tools','.row-color','.image-card .card-actions'])assert.ok(css.includes('.tier-clean-mode '+selector));
});
test('layout, modo limpo e configurações reagem aos cliques e mantêm as preferências',async()=>{
 const dom=new JSDOM(html,{url:'https://centralfreefire.com.br/tier-constructor.html',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;
 const dialogs=w.document.querySelectorAll('dialog');
 for(const dialog of dialogs){
  dialog.show=()=>{dialog.open=true;};
  dialog.showModal=()=>{dialog.open=true;};
  dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new w.Event('close'));};
 }
 w.structuredClone=structuredClone;
 w.requestAnimationFrame=()=>1;
 w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});
 w.confirm=()=>true;
 w.HTMLCanvasElement.prototype.getContext=()=>({measureText:(value)=>({width:String(value).length*10})});
 w.fetch=async()=>({ok:true,json:async()=>({rows:[{name:'S',color:'#ff7f7f'},{name:'A',color:'#ffbf7f'}],assets:[],caption:'TESTE'})});
 try{
  w.eval(js);
  await tick();
  const layout=w.document.getElementById('tierEditorLayout');
  const group=w.document.getElementById('tierBankLayoutButtons');
  assert.equal(layout.dataset.bankLayout,'left');
  group.querySelector('[data-layout="bottom"]').click();
  assert.equal(layout.dataset.bankLayout,'bottom');
  assert.equal(w.localStorage.getItem('tier_constructor_bank_layout_v1'),'bottom');
  assert.equal(group.querySelector('[data-layout="bottom"]').getAttribute('aria-pressed'),'true');
  group.querySelector('[data-layout="left"]').click();
  assert.equal(layout.dataset.bankLayout,'left');
  const clean=w.document.getElementById('toggleEditControlsBtn');
  clean.click();
  assert.ok(layout.classList.contains('tier-clean-mode'));
  assert.equal(clean.getAttribute('aria-pressed'),'true');
  assert.equal(w.localStorage.getItem('tier_constructor_hide_edit_controls_v1'),'true');
  assert.ok([...layout.querySelectorAll('.tier-row .row-name')].every(n=>n.contentEditable==='true'),'nomes continuam editáveis mesmo sem controles visuais');
  const direct=layout.querySelector('.tier-row .row-name');
  assert.equal(direct.getAttribute('role'),'textbox');
  direct.innerText='Favoritos';
  direct.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(w.document.querySelector('#rowManager .row-manager-item input[type="text"]')?.value,'Favoritos','nome editado diretamente atualiza as configurações');
  const immersive=w.document.getElementById('tierFocusEnterBtn');
  const exit=w.document.getElementById('tierFocusExitBtn');
  assert.equal(exit.hidden,true);
  immersive.click();
  assert.ok(w.document.body.classList.contains('tier-focus-mode'));
  assert.equal(immersive.getAttribute('aria-pressed'),'true');
  assert.equal(exit.hidden,false);
  assert.equal(direct.contentEditable,'true','nome permanece editável em tela cheia');
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.ok(!w.document.body.classList.contains('tier-focus-mode'));
  assert.equal(exit.hidden,true);
  immersive.click();
  exit.click();
  assert.ok(!w.document.body.classList.contains('tier-focus-mode'));
  clean.click();
  assert.ok(!layout.classList.contains('tier-clean-mode'));
  assert.ok([...layout.querySelectorAll('.tier-row .row-name')].every(n=>n.contentEditable==='true'));
  const settings=w.document.getElementById('settingsBtn'),dialog=w.document.getElementById('settingsDialog');
  settings.click();
  assert.equal(dialog.open,true);
  assert.equal(settings.getAttribute('aria-expanded'),'true');
  settings.click();
  assert.equal(dialog.open,false);
  assert.equal(settings.getAttribute('aria-expanded'),'false');
 }finally{w.close();}
});


test('visualização mobile usa tier fluida, banco compacto no rodapé e modo tela cheia sem menus',()=>{
 const mobile=read('css/tier-constructor-mobile-focus.css');
 assert.match(html,/id="tierFocusEnterBtn"/);
 assert.match(html,/id="tierFocusExitBtn"/);
 assert.match(html,/tier-constructor-mobile-focus\.css\?v=20261104-tier-preview-v1/);
 assert.match(mobile,/grid-template-columns:var\(--label-width\) minmax\(0,1fr\)!important/);
 assert.match(mobile,/position:fixed!important/);
 assert.match(mobile,/bottom:calc\(70px \+ env\(safe-area-inset-bottom,0px\)\)/);
 assert.match(mobile,/body\.tier-focus-mode/);
 assert.match(mobile,/z-index:2147483000!important/);
 assert.match(mobile,/body\.tier-focus-mode \.tier-constructor-app \.tier-editor-layout \.tier-bank-panel\{\s*display:flex!important/);
 assert.match(mobile,/#tierCaption\{display:none!important\}/);
});

test('ao abrir o Tier Constructor a página posiciona as rows imediatamente, também em links compartilhados',()=>{
 const start=js.indexOf('function scrollToTierRowsOnEntry()');
 const end=js.indexOf('const initializeBlankProject',start);
 assert(start>0&&end>start,'helper de navegação por rows deve existir');
 const source=js.slice(start,end);
 const run=hash=>{
  const dom=new JSDOM('<header class="cff-public-topbar"></header><div class="tier-constructor-app"><header class="topbar"></header><section id="tierBoardPanel"><div class="tier-row">S</div></section></div>',{
   url:'https://centralfreefire.com.br/tier-constructor.html'+hash,runScripts:'outside-only'
  });
  const w=dom.window,positions=[];
  w.requestAnimationFrame=callback=>{callback();return 1;};
  w.scrollTo=options=>positions.push(options);
  w.getComputedStyle=el=>({position:el.classList.contains('cff-public-topbar')?'fixed':el.classList.contains('topbar')?'sticky':'static'});
  const panel=w.document.getElementById('tierBoardPanel');
  panel.getBoundingClientRect=()=>({top:920,height:650});
  w.document.querySelector('.cff-public-topbar').getBoundingClientRect=()=>({height:68});
  w.document.querySelector('.topbar').getBoundingClientRect=()=>({height:100});
  w.eval(source+'window.__jump=scrollToTierRowsOnEntry;');
  w.__jump();
  return {w,dom,positions};
 };
 for(const hash of ['', '#s=ABCD1234test', '#tier=r.eyJ2ZXJzaW9uIjoxfQ', '#rows']){
  const x=run(hash);
  try{
   assert.equal(x.positions.length,1,hash||'sem hash');
   assert.equal(x.positions[0].top,740,'subtrai cabeçalhos fixos para exibir as rows');
   assert.equal(x.positions[0].behavior,'auto');
  }finally{x.dom.window.close();}
 }
 const other=run('#configuracoes');
 try{assert.equal(other.positions.length,0,'âncora não relacionada ao editor deve ser respeitada');}
 finally{other.dom.window.close();}
 assert.match(js,/\}\)\(\)\.finally\(scrollToTierRowsOnEntry\)/,'rolagem acontece após o projeto terminar de carregar');
});
