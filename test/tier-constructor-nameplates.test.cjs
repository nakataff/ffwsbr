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
 const w=dom.window,drawn=[],clips=[],shares=[],renders=[],revoked=[],requests=[];
 let lastSharedPayload=null;
 let uid=0;
 w.structuredClone=structuredClone;
 w.TextEncoder=TextEncoder;
 w.TextDecoder=TextDecoder;
 w.CompressionStream=undefined;
 w.crypto.randomUUID=()=> 'uuid-'+(++uid);
 w.requestAnimationFrame=fn=>{Promise.resolve().then(fn);return 1};
 w.matchMedia=()=>({matches:true,addListener(){},removeListener(){}});
 w.confirm=()=>true;
 w.scrollTo=()=>{};
 for(const dialog of w.document.querySelectorAll('dialog')){
  dialog.show=()=>{dialog.open=true};
  dialog.showModal=()=>{dialog.open=true};
  dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new w.Event('close'))};
 }
 w.Image=class {constructor(){this.width=100;this.height=100;this.naturalWidth=100;this.naturalHeight=100;}set src(value){this._src=value;Promise.resolve().then(()=>this.onload?.())}get src(){return this._src}};
 w.HTMLCanvasElement.prototype.getContext=function(){
  const ctx={canvas:this,measureText:t=>({width:String(t).length*7}),fillText:(...args)=>drawn.push({kind:'text',args}),fillRect:(...args)=>drawn.push({kind:'rect',args}),drawImage:(...args)=>drawn.push({kind:'image',canvas:this,args})};
  return new Proxy(ctx,{get:(o,key)=>key in o?o[key]:()=>{},set:(o,key,value)=>{o[key]=value;return true}});
 };
 w.HTMLCanvasElement.prototype.toBlob=function(callback){const blob=new w.Blob(['image'],{type:'image/png'});renders.push({width:this.width,height:this.height,blob});callback(blob);};
 w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,aGVsbG8=';
 w.URL.createObjectURL=()=> 'blob:mock';
 w.URL.revokeObjectURL=url=>revoked.push(url);
 w.HTMLAnchorElement.prototype.click=function(){};
 w.ClipboardItem=class {constructor(data){this.data=data}};
 Object.defineProperty(w.navigator,'clipboard',{value:{write:async items=>clips.push(items)},configurable:true});
 Object.defineProperty(w.navigator,'share',{value:async info=>shares.push(info),configurable:true});
 Object.defineProperty(w.navigator,'canShare',{value:()=>true,configurable:true});
 w.fetch=async(url,opts={})=>{
  requests.push(String(url));
  if(String(url).includes('/api/tier-share')){
   if(opts.method==='POST'){
    lastSharedPayload=JSON.parse(opts.body).payload;
    return {ok:true,json:async()=>({ok:true,id:'aB9cD0eF1gH2',expiresAt:Date.now()+365*86400000})};
   }
   return {ok:!!lastSharedPayload,json:async()=>({ok:!!lastSharedPayload,payload:lastSharedPayload})};
  }
  return {ok:true,json:async()=>({
   rows:[{name:'S',color:'#ff7f7f'},{name:'A',color:'#ffbf7f'}],
   assets:[
    {id:'team:loud',name:'LOUD',type:'team',image:'loud.webp'},
    {id:'player:sem-foto',name:'Brabox',type:'player',image:'silhueta.webp',available:false}
   ],
   caption:'TESTE'
  })};
 };
 w.eval(js);
 return {dom,w,drawn,clips,shares,renders,revoked,requests,getTierPayload:()=>lastSharedPayload};
}

test('controles de nome e compartilhamento estão disponíveis, mas legendas são opcionais',()=>{
 for(const id of ['nameplateButtons','nameplateBgColorInput','nameplateTextColorInput','nameplateHeightRange','nameplateFontSizeRange','nameplateFontSizeNumber','editorNameplateText','editorNameplateFontSizeRange','editorNameplateFontSizeNumber','editorNameplateFontSizeReset','editorNameplateOwnColors','editorNameplateBg','editorNameplateColor','copyPngBtn','sharePngBtn'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(js,/nameplateEnabled: false/);
 assert.match(js,/nameplateOwnColors/);
 assert.match(css,/\.tier-image-nameplate/);
 assert.match(js,/renderTierPngBlob/);
 assert.match(js,/ClipboardItem/);
});

test('silhueta com nome e logo de time entram na tier e são exibidas apenas ao ativar',async()=>{
 const {dom,w,getTierPayload}=createBrowser();
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
  assert.equal(input.value,'LOUD','campo já traz o nome original do time');
  assert.equal(w.document.getElementById('editorNameplateFontSizeNumber').value,'13');
  const sizeRange=w.document.getElementById('editorNameplateFontSizeRange');
  sizeRange.value='10';sizeRange.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(w.document.getElementById('editorNameplateFontSizeNumber').value,'10');
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
  assert.equal(changed?.style.fontSize,'10px','o tamanho personalizado é exibido na tier');
  assert.equal(w.document.querySelector('.tier-row .image-card img').alt,'LOUD','nome original permanece associado à logo');
  assert.equal(w.document.querySelector('.tier-row .tier-image-nameplate').textContent,'LOUD SNICKERS');

  w.document.getElementById('shareLinkBtn').click();
  await tick();
  const link=w.document.getElementById('shareProjectUrl').value;
  assert.match(link,/#s=aB9cD0eF1gH2$/,'o endereço deve conter só um ID curto');
  assert(link.length<100);
  assert.match(getTierPayload(),/^r\./,'o projeto completo vai para o servidor');
  const payload=getTierPayload().slice(2);
  const shared=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
  assert.equal(shared.state.settings.nameplateEnabled,true);
  assert.ok(Object.values(shared.state.images).some(i=>i.nameplateText==='LOUD SNICKERS'&&i.nameplateOwnColors===true&&i.nameplateBgColor==='#ff0000'&&i.nameplateFontSize===10));
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

test('tamanho padrão vale para todos, mas o editor permite ajustar e restaurar por imagem',async()=>{
 const {dom,w,drawn}=createBrowser();
 try {
  await tick();
  w.document.getElementById('imageBank').querySelector('.image-card').click();
  w.document.querySelector('.tier-row .dropzone').click();
  w.document.querySelector('#nameplateButtons [data-value="true"]').click();
  const globalRange=w.document.getElementById('nameplateFontSizeRange');
  globalRange.value='20';globalRange.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(w.document.getElementById('nameplateFontSizeNumber').value,'20');
  assert.equal(w.document.querySelector('.tier-row .tier-image-nameplate').style.fontSize,'20px');
  w.document.querySelector('.tier-row .image-card .edit-image').click();
  w.document.querySelector('[data-editor-tab-button="text"]').click();
  const input=w.document.getElementById('editorNameplateText');
  assert.equal(input.value,'LOUD','nome é preenchido sem precisar digitar');
  assert.equal(w.document.getElementById('editorNameplateFontSizeNumber').value,'20');
  assert.equal(w.document.getElementById('editorNameplateFontSizeReset').disabled,true);
  const individual=w.document.getElementById('editorNameplateFontSizeNumber');
  individual.value='8';individual.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(w.document.getElementById('editorNameplateFontSizeRange').value,'8');
  assert.equal(w.document.getElementById('editorNameplateFontSizeReset').disabled,false);
  w.document.getElementById('saveEditorBtn').click();await tick();
  assert.equal(w.document.querySelector('.tier-row .tier-image-nameplate').style.fontSize,'8px');
  globalRange.value='16';globalRange.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(w.document.querySelector('.tier-row .tier-image-nameplate').style.fontSize,'8px','personalização não muda com ajustes globais');
  w.document.querySelector('.tier-row .image-card .edit-image').click();
  w.document.querySelector('[data-editor-tab-button="text"]').click();
  assert.equal(w.document.getElementById('editorNameplateText').value,'LOUD');
  w.document.getElementById('editorNameplateFontSizeReset').click();
  assert.equal(w.document.getElementById('editorNameplateFontSizeNumber').value,'16');
  w.document.getElementById('saveEditorBtn').click();await tick();
  assert.equal(w.document.querySelector('.tier-row .tier-image-nameplate').style.fontSize,'16px');
  w.document.getElementById('copyPngBtn').click();await tick();
  assert.ok(drawn.some(d=>d.kind==='text'&&d.args[0]==='LOUD'),'exportação continua escrevendo a legenda');
 } finally {dom.window.close();}
});

test('links antigos continuam abrindo e os novos consultam a API pelo ID',()=>{
 assert.match(js,/params\.get\(TIER_SHARE_HASH_KEY\)/);
 assert.match(js,/params\.get\(TIER_SHARE_SHORT_HASH_KEY\)/);
 assert.match(js,/loadShortShareProject\(id\)/);
 assert.match(js,/decodeShareProject\(payload\)/);
 assert.match(js,/window\.location\.origin/);
});


test('preview uses exact PNG dimensions, fits all rows without cropping and every export respects the selected format',async()=>{
 const h=createBrowser(),{w,dom,renders,drawn,requests,revoked}=h;
 try{
  await tick();
  w.document.getElementById('imageBank').querySelector('.image-card').click();
  w.document.querySelector('.tier-row .dropzone').click();
  const rowsBefore=w.document.querySelectorAll('.tier-row').length, initialRequests=requests.length;
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});
  w.document.getElementById('tierFocusEnterBtn').click();
  w.document.getElementById('imageBank').querySelector('.image-card').click();
  w.document.querySelector('.tier-row .dropzone').click();
  assert.equal(w.document.querySelectorAll('.tier-row .image-card').length,2,'desktop fullscreen also supports click-to-place');
  w.document.getElementById('tierFocusPreviewBtn').click();await tick();
  assert.equal(w.document.getElementById('tierPreviewDialog').open,true);
  assert.equal(w.document.getElementById('tierPreviewImage').hidden,false);
  for(const [format,width,height] of [['16:9',1920,1080],['1:1',1080,1080],['9:16',1080,1920]]){
   const select=w.document.getElementById('tierExportFormat');select.value=format;select.dispatchEvent(new w.Event('change'));
   await tick();
   const last=renders.at(-1);assert.equal(last.width,width);assert.equal(last.height,height);
   const fit=drawn.filter(d=>d.kind==='image'&&d.canvas.width===width&&d.canvas.height===height).at(-1);
   assert(fit,'full tier is drawn onto the output canvas');
   const [source,x,y,dw,dh]=fit.args;
   assert(x>0&&y>0&&x+dw<width&&y+dh<height,'safe margins and no clipping');
   assert(Math.abs(dw/dh-source.width/source.height)<.00001,'aspect preserved');
   assert.equal(w.document.getElementById('tierPreviewDownloadBtn').disabled,false);
   assert.match(w.document.getElementById('tierPreviewStatus').textContent,new RegExp(width+' × '+height));
   w.document.getElementById('tierPreviewShareBtn').click();await tick();
   assert.equal(h.shares.at(-1).files[0].size,last.blob.size);
  }
  assert.equal(w.document.querySelectorAll('.tier-row').length,rowsBefore);
  assert.equal(w.document.getElementById('imageBank').querySelectorAll('.image-card').length,0,'all selected teams were moved to their rows');
  assert.equal(requests.length,initialRequests,'format changes do not fetch backend data');
  w.document.getElementById('closeTierPreviewBtn').click();
  assert(revoked.length>=4,'old preview object URLs are released');
  assert(w.document.body.classList.contains('tier-focus-mode'),'closing preview keeps fullscreen editing');
  w.document.getElementById('copyPngBtn').click();await tick();
  assert.equal(renders.at(-1).width,1080);assert.equal(renders.at(-1).height,1920);
  assert.equal(JSON.parse(w.localStorage.getItem('tierlist_autosave_v1')).settings.exportFormat,'9:16');
 }finally{dom.window.close();}
});

test('tier page prevents global chat from booting without changing other pages or the user preference',()=>{
 assert.match(html,/<body[^>]*data-cff-chat="off"/);
 const boot=read('js/config.min.js');assert(boot.includes("document.body?.dataset.cffChat==='off'"));
});
