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
 assert.match(html,/tier-constructor\.js\?v=20261102-(?:workspace|nameplates|text-scroll|name-size)-v1/);
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
  assert.ok([...layout.querySelectorAll('.tier-row .row-name')].every(n=>n.contentEditable==='false'));
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
