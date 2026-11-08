const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('js/global-stats-share.js','utf8');
const formats={stories:[1080,1920],feed:[1080,1350],square:[1080,1080],wide:[1280,720]};
function setup(){
 const win={};
 class ImageStub{
  constructor(){this.naturalWidth=this.width=320;this.naturalHeight=this.height=460;}
  set src(path){this.onload?.();}
 }
 const marker='window.CFFGlobalStatsShare={mount,open};';
 assert(code.includes(marker));
 vm.runInNewContext(code.replace(marker,'window.__shareTest={draw,state,setModal:value=>modal=value};'+marker),
  {window:win,location:{origin:'https://centralfreefire.com.br'},Image:ImageStub,URL,console});
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
  fillText(value,x,y){texts.push({value:String(value),x,y});}
 };
 return {canvas:{width:0,height:0,getContext(){return ctx;}},rects,texts};
}
async function render(api,format,kind,showImage=true){
 const item=samples.find(x=>x.kind===kind);assert(item);
 const result=mockCanvas();
 api.state.format=format;api.state.showImage=showImage;api.state.showSubtitle=true;api.state.showFilters=true;
 api.setModal({querySelector:key=>key==='canvas'?result.canvas:{textContent:''}});
 await api.draw({...common,...item});
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
