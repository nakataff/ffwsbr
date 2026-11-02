'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('tier-constructor.html'),js=read('js/tier-constructor.js'),css=read('css/tier-constructor-workspace.css');
const tick=(ms=90)=>new Promise(resolve=>setTimeout(resolve,ms));

function createBrowser(){
 const dom=new JSDOM(html,{url:'https://centralfreefire.com.br/tier-constructor.html',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,drawn=[],clips=[],shares=[];
 let uid=0;
 w.structuredClone=structuredClone;
 w.crypto.randomUUID=()=> 'uuid-'+(++uid);
 w.requestAnimationFrame=fn=>{Promise.resolve().then(fn);return 1};
 w.matchMedia=()=>({matches:true,addListener(){},removeListener(){}});
 w.confirm=()=>true;
 for(const dialog of w.document.querySelectorAll('dialog')){
  dialog.show=()=>{dialog.open=true};
  dialog.showModal=()=>{dialog.open=true};
  dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new w.Event('close'))};
 }
 w.Image=class {constructor(){this.width=100;this.height=100;this.naturalWidth=100;this.naturalHeight=100;}set src(value){this._src=value;Promise.resolve().then(()=>this.onload?.())}get src(){return this._src}};
 w.HTMLCanvasElement.prototype.getContext=function(){
  const ctx={canvas:this,measureText:t=>({width:String(t).length*7}),fillText:(...args)=>drawn.push({kind:'text',args}),fillRect:(...args)=>drawn.push({kind:'rect',args})};
  return new Proxy(ctx,{get:(o,key)=>key in o?o[key]:()=>{},set:(o,key,value)=>{o[key]=value;return true}});
 };
 w.HTMLCanvasElement.prototype.toBlob=function(callback){callback(new w.Blob(['image'],{type:'image/png'}));};
 w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,aGVsbG8=';
 w.URL.createObjectURL=()=> 'blob:mock';
 w.URL.revokeObjectURL=()=>{};
 w.HTMLAnchorElement.prototype.click=function(){};
 w.ClipboardItem=class {constructor(data){this.data=data}};
 Object.defineProperty(w.navigator,'clipboard',{value:{write:async items=>clips.push(items)},configurable:true});
 Object.defineProperty(w.navigator,'share',{value:async info=>shares.push(info),configurable:true});
 Object.defineProperty(w.navigator,'canShare',{value:()=>true,configurable:true});
 w.fetch=async()=>({ok:true,json:async()=>({
  rows:[{name:'S',color:'#ff7f7f'},{name:'A',color:'#ffbf7f'}],
  assets:[
   {id:'team:loud',name:'LOUD',type:'team',image:'loud.webp'},
   {id:'player:sem-foto',name:'Brabox',type:'player',image:'silhueta.webp',available:false}
  ],
  caption:'TESTE'
 })});
 w.eval(js);
 return {dom,w,drawn,clips,shares};
}

test('controles de nome e compartilhamento estão disponíveis, mas legendas são opcionais',()=>{
 for(const id of ['nameplateButtons','nameplateBgColorInput','nameplateTextColorInput','nameplateHeightRange','editorNameplateText','editorNameplateOwnColors','editorNameplateBg','editorNameplateColor','copyPngBtn','sharePngBtn'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(js,/nameplateEnabled: false/);
 assert.match(js,/nameplateOwnColors/);
 assert.match(css,/\.tier-image-nameplate/);
 assert.match(js,/renderTierPngBlob/);
 assert.match(js,/ClipboardItem/);
});

test('silhueta com nome e logo de time entram na tier e são exibidas apenas ao ativar',async()=>{
 const {dom,w}=createBrowser();
 try{
  await tick();
  const bank=w.document.getElementById('imageBank');
  assert.equal(bank.querySelectorAll('.image-card').length,2,'inclui jogador sem foto');
  assert.equal(w.document.querySelectorAll('.tier-image-nameplate').length,0,'desligado por padrão');
  const first=bank.querySelector('.image-card');
  first.click();
  w.document.querySelector('.tier-row .dropzone').click();
  assert.equal(w.document.querySelectorAll('.tier-row .image-card').length,1);
  const toggle=w.document.querySelector('#nameplateButtons [data-value="true"]');
  toggle.click();
  assert.equal(w.document.querySelector('.tier-row .tier-image-nameplate')?.textContent,'LOUD');
  const other=bank.querySelector('.image-card');
  other.click();
  w.document.querySelector('.tier-row .dropzone').click();
  assert.deepEqual([...w.document.querySelectorAll('.tier-row .tier-image-nameplate')].map(x=>x.textContent),['LOUD','Brabox']);
  const name=w.document.querySelector('.tier-row .image-card .edit-image');
  name.click();
  w.document.querySelector('[data-editor-tab-button="nameplate"]').click();
  const input=w.document.getElementById('editorNameplateText');
  input.value='LOUD SNICKERS';input.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(w.document.getElementById('editorNameplateSample').textContent,'LOUD SNICKERS');
  w.document.getElementById('editorNameplateOwnColors').click();
  const bg=w.document.getElementById('editorNameplateBg');
  bg.value='#ff0000';bg.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(w.document.getElementById('editorNameplateSample').style.backgroundColor,'rgb(255, 0, 0)');
  w.document.getElementById('saveEditorBtn').click();
  await tick();
  const changed=w.document.querySelector('.tier-row .tier-image-nameplate');
  assert.equal(changed?.textContent,'LOUD SNICKERS');
  assert.equal(changed?.style.backgroundColor,'rgb(255, 0, 0)');
  w.document.querySelector('#nameplateButtons [data-value="false"]').click();
  assert.equal(w.document.querySelectorAll('.tier-image-nameplate').length,0);
 }finally{dom.window.close();}
});

test('copiar e compartilhar PNG usam o resultado renderizado com as legendas',async()=>{
 const {dom,w,drawn,clips,shares}=createBrowser();
 try{
  await tick();
  const bank=w.document.getElementById('imageBank');
  bank.querySelector('.image-card').click();
  w.document.querySelector('.tier-row .dropzone').click();
  w.document.querySelector('#nameplateButtons [data-value="true"]').click();
  w.document.getElementById('copyPngBtn').click();
  await tick();
  assert.equal(clips.length,1,'deve escrever a imagem no clipboard');
  assert.ok(clips[0][0].data['image/png'],'mime image/png');
  assert.ok(drawn.some(item=>item.kind==='text'&&item.args[0]==='LOUD'),'nome deve estar no PNG');
  w.document.getElementById('sharePngBtn').click();
  await tick();
  assert.equal(shares.length,1,'compartilhamento nativo usa File');
  assert.equal(shares[0].files[0].name,'tier-list.png');
 }finally{dom.window.close();}
});
