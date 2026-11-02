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
 w.TextEncoder=TextEncoder;
 w.TextDecoder=TextDecoder;
 w.CompressionStream=undefined;
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
  w.document.querySelector('[data-editor-tab-button="text"]').click();
  const editorTab=w.document.querySelector('[data-editor-tab="text"]');
  assert.equal(editorTab.hidden,false);
  assert.ok(editorTab.contains(w.document.getElementById('editorNameplateText')));
  assert.ok(editorTab.contains(w.document.getElementById('editorText')));
  assert.ok(!w.document.querySelector('[data-editor-tab-button="nameplate"]'));
  const advanced=w.document.getElementById('editorOverlayAdvanced');
  assert.equal(advanced.open,false,'opções avançadas começam recolhidas em imagem nova');
  advanced.open=true;
  assert.ok(advanced.contains(w.document.getElementById('editorText')));
  advanced.open=false;
  assert.equal(w.document.getElementById('editorNameplateEnabled').checked,true);

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
  assert.equal(w.document.querySelector('.tier-row .image-card img').alt, '');
  assert.equal(w.document.querySelector('.tier-row .tier-image-nameplate').textContent,'LOUD SNICKERS');

  w.document.getElementById('shareLinkBtn').click();
  await tick();
  const link=w.document.getElementById('shareProjectUrl').value;
  assert.match(link,/#tier=r\./,'o link deve incluir o projeto com as legendas');
  const payload=link.split('#tier=r.')[1];
  const shared=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
  assert.equal(shared.state.settings.nameplateEnabled,true);
  assert.ok(Object.values(shared.state.images).some(i=>i.nameplateText==='LOUD SNICKERS'&&i.nameplateOwnColors===true&&i.nameplateBgColor==='#ff0000'));
  w.document.getElementById('doneShareProjectBtn').click();
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

test('nome curto é alterado somente na tier e cancelamento da edição restaura visibilidade',async()=>{
 const {dom,w}=createBrowser();
 try {
  await tick();
  const bank=w.document.getElementById('imageBank');
  bank.querySelector('.image-card').click();
  w.document.querySelector('.tier-row .dropzone').click();
  const card=w.document.querySelector('.tier-row .image-card');
  card.querySelector('.edit-image').click();
  w.document.querySelector('[data-editor-tab-button="text"]').click();
  const shortName=w.document.getElementById('editorNameplateText');
  shortName.value='BURIRAM';
  shortName.dispatchEvent(new w.Event('input',{bubbles:true}));
  w.document.getElementById('editorNameplateEnabled').click();
  assert.ok(w.document.querySelector('.tier-row .tier-image-nameplate'));
  w.document.getElementById('cancelEditorBtn').click();
  assert.equal(w.document.querySelector('.tier-row .tier-image-nameplate'),null,'cancelar restaura a opção anterior');
  card.querySelector('.edit-image').click();
  w.document.querySelector('[data-editor-tab-button="text"]').click();
  shortName.value='BURIRAM';
  shortName.dispatchEvent(new w.Event('input',{bubbles:true}));
  w.document.getElementById('editorNameplateEnabled').click();
  w.document.getElementById('saveEditorBtn').click();
  await tick();
  const display=w.document.querySelector('.tier-row .tier-image-nameplate');
  assert.equal(display?.textContent,'BURIRAM');
  assert.equal(w.document.querySelector('.tier-row .image-card').dataset.imageId,card.dataset.imageId,'mantém o cadastro/ID');
 } finally {dom.window.close()}
});

test('drawer rolável conserva cabeçalho e ações sem cobrir os campos',()=>{
 const editor=w=>w.document.getElementById('imageEditorDialog');
 const fragment=html.slice(html.indexOf('id="imageEditorDialog"'));
 assert.ok(fragment.includes('id="editorScrollRegion"'));
 assert.ok(fragment.includes('id="editorOverlayAdvanced"'));
 assert.ok(fragment.includes('id="saveEditorBtn"'));
 assert.match(css,/#imageEditorDialog\.editor-drawer \.editor-controls\s*\{[^}]*overflow-y:auto/s);
 assert.match(css,/#imageEditorDialog\.editor-drawer \.dialog-inner\s*\{[^}]*grid-template-rows:auto minmax\(0,1fr\) auto/s);
 assert.match(css,/#imageEditorDialog\.editor-drawer \.editor-preview-panel\s*\{[^}]*grid-template-columns:/s);
 assert.match(js,/if \(scrollRegion\) scrollRegion\.scrollTop = 0/);
});
