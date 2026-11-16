const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('admin-conversor-de-imagem.html','utf8');
const admin=fs.readFileSync('admin.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1]||'';

function between(first,last){
 const i=script.indexOf(first),j=script.indexOf(last,i+1);
 assert(i>=0&&j>i,'Código original não encontrado: '+first);
 return script.slice(i,j);
}
function runtime(){
 const outputFormat={value:'webp'},jpegBackground={value:'#fefefe'},qualityRange={value:'70'},events=[];
 const makeCanvas=()=>({
  width:20,height:10,
  getContext(){return {fillRect(){events.push('fill')},drawImage(){events.push('draw')},set fillStyle(color){events.push('color:'+color)}}},
  toBlob(callback,mime,quality){events.push('mime:'+mime);events.push('quality:'+quality);callback({type:mime,size:42})}
 });
 const sourceCanvas=makeCanvas(),document={createElement:()=>makeCanvas()};
 const factories=between('    const OUTPUT_FORMATS=Object.freeze({','    let image = null;')+
  between('    function flattenCanvasForJpeg(','    function updateFormatUI(){');
 const converter=new Function('outputFormat','document','jpegBackground','qualityRange',factories+
  'return {selectedOutputFormat,canvasToOutputBlob};')(outputFormat,document,jpegBackground,qualityRange);
 const paths=new Function('selectedOutputFormat','normalizeArchivePath',
  between('    function replacePathExtensionForOutput(','    function setBatchSelection(')+
  'return {replacePathExtensionForOutput,makeUniqueArchivePath};')(converter.selectedOutputFormat,x=>String(x).replace(/\\/g,'/'));
 return {converter,paths,outputFormat,events,sourceCanvas};
}
test('conversor mantém scripts válidos e possui atalho no painel',()=>{
 assert.doesNotThrow(()=>new Function(script));
 assert.match(admin,/href="admin-conversor-de-imagem\.html"/);
 assert.match(html,/Voltar ao painel/);
 assert.match(html,/id="batchZipBtn"/);
 assert.match(html,/id="eraserToggle"/);
 assert.match(html,/outputFormat\.disabled = true;/);
 assert.match(html,/outputFormat\.disabled = false;/);
});
test('exporta WebP e PNG com MIME correto, sem achatar transparência em PNG',async()=>{
 const x=runtime();
 for(const [format,mime] of [['webp','image/webp'],['png','image/png']]){
  x.outputFormat.value=format;x.events.length=0;
  const blob=await x.converter.canvasToOutputBlob(x.sourceCanvas);
  assert.equal(blob.type,mime);
  assert(!x.events.includes('fill'));
 }
 x.outputFormat.value='png';x.events.length=0;
 await x.converter.canvasToOutputBlob(x.sourceCanvas);
 assert(x.events.includes('quality:undefined'),'PNG não usa controle de qualidade com perdas');
});
test('JPG preenche transparência com a cor escolhida',async()=>{
 const x=runtime();x.outputFormat.value='jpeg';
 const blob=await x.converter.canvasToOutputBlob(x.sourceCanvas);
 assert.equal(blob.type,'image/jpeg');
 assert(x.events.includes('color:#fefefe'));
 assert(x.events.includes('fill'));
 assert(x.events.includes('draw'));
 assert(x.events.includes('quality:0.7'));
});
test('AVIF não recebe arquivo PNG disfarçado quando navegador não suporta o formato',async()=>{
 const x=runtime();x.outputFormat.value='avif';
 const canvas={toBlob(done){done({type:'image/png',size:50})}};
 await assert.rejects(x.converter.canvasToOutputBlob(canvas),/não exporta AVIF/);
});
test('ZIP preserva pastas, altera extensões e diferencia nomes duplicados',()=>{
 const x=runtime();
 for(const [format,ext] of [['webp','webp'],['jpeg','jpg'],['png','png'],['avif','avif']]){
  x.outputFormat.value=format;
  const path=x.paths.replacePathExtensionForOutput('equipes/brasil/time.png');
  assert.equal(path,'equipes/brasil/time.'+ext);
  const used=new Map();
  assert.equal(x.paths.makeUniqueArchivePath(path,used),path);
  assert.equal(x.paths.makeUniqueArchivePath(path,used),'equipes/brasil/time-2.'+ext);
 }
});
