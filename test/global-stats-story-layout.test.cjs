const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('js/global-stats-share.js','utf8');
const formats={stories:[1080,1920],feed:[1080,1350],square:[1080,1080],wide:[1280,720]};
function setup(extra={}){
 const win={};
 class ImageStub{
  constructor(){this.naturalWidth=this.width=320;this.naturalHeight=this.height=460;}
  set src(path){this.onload?.();}
 }
 const marker='window.CFFGlobalStatsShare={mount,open};';
 assert(code.includes(marker));
 vm.runInNewContext(code.replace(marker,'window.__shareTest={draw,state,action,setModal:value=>modal=value,setPayload:value=>livePayload=value,setPreviewBlob:value=>previewBlob=value};'+marker),
  {window:win,location:{origin:'https://centralfreefire.com.br'},Image:ImageStub,URL,console,...extra});
 return win.__shareTest;
}
const facts=(n=6)=>Array.from({length:n},(_,i)=>({label:'MÉTRICA '+(i+1),value:((i+1)*1234).toLocaleString('pt-BR')}));
const ranks=(n=5)=>Array.from({length:n},(_,i)=>({rank:i+1,name:'Jogador '+(i+1),team:'Equipe '+(i+1),logo:'/team-'+i+'.webp',score:(48-i*2)+'%'}));
const common={eyebrow:'FFWS GLOBAL FINALS 2026',subtitle:'F1 · 06/11–08/11 · 36 quedas',rows:[],facts:[],two:null,main:'73',mainLabel:'ABATES'};
const samples=[
 {kind:'summary',title:'RESUMO DO MUNDIAL',facts:facts(4)},
 {kind:'single',title:'ABATES NO MUNDIAL',facts:facts(3)},
 {kind:'team',title:'DESEMPENHO DA EQUIPE',entity:'P ESPORTS',logo:'/team.webp',facts:facts(6)},
 {kind:'player',title:'DESEMPENHO INDIVIDUAL',entity:'Jogador',photo:'/player.webp',logo:'/team.webp',facts:facts(6)},
 {kind:'top',title:'TOP 5 · PART. DANO',entity:'Jogador',photo:'/player.webp',logo:'/team.webp',rows:ranks(5)},
 {kind:'record',title:'RECORDE DE ABATES',entity:'Jogador',photo:'/player.webp',logo:'/team.webp',facts:facts(2)},
 {kind:'compare',title:'COMPARATIVO DE EQUIPES',entity:'P ESPORTS × TEAM FLASH',
  two:[{team:'P ESPORTS',points:211,kills:198,booyahs:4,matches:18},
       {team:'TEAM FLASH',points:190,kills:178,booyahs:3,matches:18}]}
];
function mockCanvas(){
 const rects=[],texts=[];
 const ctx={
  font:'900 30px Arial',beginPath(){},clip(){},save(){},restore(){},fill(){},stroke(){},fillRect(){},moveTo(){},lineTo(){},drawImage(){},
  roundRect(x,y,w,h){rects.push({x,y,w,h});},
  createLinearGradient(){return{addColorStop(){}};},createRadialGradient(){return{addColorStop(){}};},
  measureText(value){return{width:String(value).length*(Number(this.font.match(/(\d+(?:\.\d+)?)px/)?.[1])||30)*.53};},
  fillText(value,x,y){texts.push({value:String(value),x,y,font:Number(this.font.match(/(\d+(?:\.\d+)?)px/)?.[1])||30});}
 };
 return {canvas:{width:0,height:0,getContext(){return ctx;}},rects,texts};
}
async function render(api,format,kind,showImage=true,overrides={}){
 const item=samples.find(x=>x.kind===kind);assert(item);
 const result=mockCanvas();
 api.state.format=format;api.state.showImage=showImage;api.state.showSubtitle=true;api.state.showFilters=true;
 api.setModal({querySelector:key=>key==='canvas'?result.canvas:{textContent:''}});
 await api.draw({...common,...item,...overrides});
 assert.deepEqual([result.canvas.width,result.canvas.height],formats[format]);
 return result;
}
test('all seven card topics use the full 9:16 area, with and without a photo',async()=>{
 const api=setup();
 for(const showImage of [true,false])for(const sample of samples){
  const {canvas,rects,texts}=await render(api,'stories',sample.kind,showImage);
  const pad=canvas.width*.07,usableWidth=canvas.width-2*pad;
  const cards=rects.filter(r=>Math.abs(r.w-usableWidth)<1&&r.y>500&&r.h>100);
  const expected=sample.rows?.length?sample.rows.length:sample.two?.length||sample.facts.length;
  assert.equal(cards.length,expected,sample.kind+' number of visible blocks');
  const first=cards[0].y,last=cards.at(-1).y+cards.at(-1).h,footerY=canvas.height-113;
  assert(first<900,sample.kind+' content should begin above 47% of Story height');
  assert(last>1540,sample.kind+' content should reach lower Story area');
  assert(last<footerY-40,sample.kind+' should leave unobstructed footer space');
  assert(cards.every(r=>r.h>=90&&r.y>=0&&r.y+r.h<=footerY-40));
  assert(texts.some(r=>r.value==='CENTRAL FREE FIRE'));
  assert(texts.some(r=>r.value==='centralfreefire.com.br'));
  assert(texts.every(r=>Number.isFinite(r.x)&&Number.isFinite(r.y)));
  if(showImage&&(sample.photo||sample.logo)){
   const portraits=rects.filter(r=>r.w>450&&r.w<550&&r.h>450&&r.h<550&&r.y<500);
   assert(portraits.length>0,sample.kind+' needs featured portrait or crest');
   assert(first>Math.max(...portraits.map(r=>r.y+r.h))+30,sample.kind+' content cannot cover portrait');
  }
 }
});
test('other three export dimensions remain available and rendering does not throw',async()=>{
 const api=setup();
 for(const format of ['feed','square','wide'])for(const sample of samples){
  const {canvas,texts}=await render(api,format,sample.kind);
  assert(texts.some(r=>r.value==='centralfreefire.com.br'),format+' '+sample.kind);
  assert.equal(canvas.width,formats[format][0]);assert.equal(canvas.height,formats[format][1]);
 }
});
test('all Stories topics use content-driven rather than ranking-only spacing',()=>{
 assert.match(code,/const story=state\.format==='stories'/);
 assert.match(code,/const storyHeroEnd=Math\.max/);
 assert.match(code,/storyFit\(facts\.length/);
 assert.match(code,/storyFit\(rows\.length/);
 assert.match(code,/storyFit\(items\.length/);
 assert(!code.includes('storyRanking'),'a ranking-specific gate would leave other topics with an empty middle');
});

test('4:5 Feed ranks and every card topic fill space beneath the featured player without approaching the footer',async()=>{
 const api=setup();
 for(const sample of samples){
  const {canvas,rects}=await render(api,'feed',sample.kind);
  const footerY=canvas.height-113;
  const cards=rects.filter(r=>r.y>520&&r.y<footerY-50&&r.h>80&&r.w>300);
  assert(cards.length>=2,sample.kind+' must show its stats/rows');
  const first=Math.min(...cards.map(r=>r.y));
  const last=Math.max(...cards.map(r=>r.y+r.h));
  assert(first<770,sample.kind+' begins too low (unwanted gap): '+first);
  assert(last>1060,sample.kind+' should fill the lower half of the 4:5 card: '+last);
  assert(last<footerY-22,sample.kind+' must not cover the footer divider: '+last);
 }
});
test('Stories rank names, values and featured numbers are visibly larger than in Feed',async()=>{
 const api=setup();
 const story=await render(api,'stories','top');
 const feed=await render(api,'feed','top');
 const get=(screen,name,afterY)=>screen.texts.find(t=>t.value===name&&t.y>afterY)?.font;
 const storyName=get(story,'Jogador 1',600),feedName=get(feed,'Jogador 1',550);
 const storyValue=get(story,'48%',600),feedValue=get(feed,'48%',550);
 const storyFeatured=get(story,'73',350),feedFeatured=get(feed,'73',350);
 assert(storyName>=feedName*1.1,'Stories player names must be at least 10% larger');
 assert(storyValue>=feedValue*1.1,'Stories ranking scores must be at least 10% larger');
 assert(storyFeatured>feedFeatured,'Stories featured number should be larger');
});
test('mobile Save Image opens native photo share immediately, without losing user gesture to blob encoding',async()=>{
 const shares=[];
 class MockFile{constructor(parts,name,options){this.parts=parts;this.name=name;this.type=options.type;}}
 const navigator={userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
  platform:'iPhone',canShare:data=>Boolean(data.files?.length),
  share:data=>{shares.push(data);return Promise.resolve();}};
 const api=setup({navigator,File:MockFile});
 const button={disabled:false},status={textContent:''};
 api.setModal({querySelector:key=>key==='[data-share-action="save"]'?button:key==='[data-share-status]'?status:null});
 api.setPayload({title:'TOP 5 · ABATES'});
 api.setPreviewBlob(new Blob(['real-png-placeholder'],{type:'image/png'}));
 const pending=api.action('save');
 assert.equal(shares.length,1,'native share must be called synchronously from user click');
 assert.equal(shares[0].files[0].type,'image/png');
 assert.match(shares[0].files[0].name,/\.png$/);
 assert.equal(button.disabled,true);
 await pending;
 assert.equal(button.disabled,false);
 assert.match(status.textContent,/Opções de imagem concluídas/);
});
test('Save Image on desktop still downloads PNG; canceled iPhone share does not force a download',async()=>{
 let downloads=0;
 class TestURL extends URL{}
 TestURL.createObjectURL=()=> 'blob:https://centralfreefire.com.br/card';
 TestURL.revokeObjectURL=()=>{};
 const document={body:{append(){}},createElement(){return {click(){downloads++},remove(){}}}};
 const desktop=setup({navigator:{userAgent:'Windows Chrome',platform:'Win32'},URL:TestURL,document,setTimeout:()=>{}});
 const button={disabled:false},status={textContent:''},modal={querySelector:key=>key==='[data-share-action="save"]'?button:key==='[data-share-status]'?status:null};
 desktop.setModal(modal);desktop.setPayload({title:'ABATES'});desktop.setPreviewBlob(new Blob(['sample'],{type:'image/png'}));
 await desktop.action('save');
 assert.equal(downloads,1);
 assert.match(status.textContent,/Download da imagem iniciado/);
 const cancel=setup({navigator:{userAgent:'iPhone',platform:'iPhone',canShare:()=>true,
  share:()=>Promise.reject(Object.assign(new Error('cancel'),{name:'AbortError'}))},File:class{constructor(){}}});
 const status2={textContent:''};
 cancel.setModal({querySelector:key=>key==='[data-share-action="save"]'?{disabled:false}:key==='[data-share-status]'?status2:null});
 cancel.setPayload({title:'ABATES'});cancel.setPreviewBlob(new Blob(['sample'],{type:'image/png'}));
 await cancel.action('save');
 assert.equal(downloads,1,'canceling mobile share should not download anything');
 assert.match(status2.textContent,/Salvamento cancelado/);
});

test('main ranking badge and optional rank of each of six stats draw correctly in all four image formats',async()=>{
 const api=setup(),rankedFacts=facts(6).map((fact,i)=>({...fact,rank:i+1}));
 const payload={mainRank:1,mainRankLabel:'ABATES',facts:rankedFacts};
 for(const format of ['stories','feed','square','wide']){
  api.state.showMainRank=true;api.state.showFactRanks=true;
  const {texts,canvas}=await render(api,format,'player',true,payload);
  const scores=texts.filter(x=>/^#[1-6]$/.test(x.value)).map(x=>x.value);
  assert(scores.includes('#1'),'featured rank badge missing in '+format);
  for(let n=2;n<=6;n++)assert(scores.includes('#'+n),'metric rank #'+n+' missing in '+format);
  assert(texts.some(x=>x.value==='RANKING DE'),'featured ranking description missing in '+format);
  assert(texts.some(x=>x.value==='ABATES'),'featured metric rank label missing in '+format);
  assert(texts.every(x=>x.x>=-1&&x.x<=canvas.width+1),'rank text spills out of '+format);
  api.state.showMainRank=false;api.state.showFactRanks=false;
  const plain=await render(api,format,'player',true,payload);
  assert(!plain.texts.some(x=>/^#[1-6]$/.test(x.value)),'disabled rank badges must disappear in '+format);
 }
});
