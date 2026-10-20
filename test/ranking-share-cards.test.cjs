const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),{createCanvas,loadImage,GlobalFonts}=require('@napi-rs/canvas');
if(fs.existsSync('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','Arial');
if(fs.existsSync('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf','Arial');
const qrcode=require('../js/vendor/qrcode-generator.js');
const read=p=>JSON.parse(fs.readFileSync(p));
const modelPromise=import('../js/ranking-share-model.mjs'),rendererPromise=import('../js/ranking-share-renderer.mjs');
const raw=()=>{const d=read('ffws-br-2026-s2/inicio-mvp-top10.json'),teams=read('ffws-br-2026-s2/inicio-resumo.json').teams;return {id:'wb-s2-mvp-geral',title:'Ranking de abates',event:'WB 2026 S2',stage:'Geral',metric:'kills',kind:'players',updatedAt:d.updatedAt,url:'https://centralfreefire.com.br/ffws-br-s2/inicio?aba=mvp&etapa=geral',rows:d.top10.geral.map((r,i)=>({...r,rank:i+1,logo:teams.find(t=>t.name===r.team).logo}))};};
const tick=()=>new Promise(r=>setImmediate(r));
async function wait(check){for(let i=0;i<100;i++){if(check())return;await tick();}throw Error('Interface não terminou de gerar o card');}
test('preferences reject invalid values and personalized recuts keep original ranks and exact links',async()=>{
 const m=await modelPromise,data=m.normalizePayload(raw());
 assert.equal(m.normalizeOptions(null,data).format,'feed');
 const bad=m.normalizeOptions({format:'evil',template:'bad',accent:'javascript:alert(1)',theme:'custom',rowCount:1000,highlight:999,first:0,second:0},data);
 assert.equal(bad.format,'feed');assert.equal(bad.rowCount,10);assert.equal(bad.accent,'#00c8ff');assert.equal(bad.highlight,-1);assert.equal(bad.second,1);
 for(const stage of ['geral','classificatoria','segundaFase','final'])assert.equal(new URL(m.shareURLFor('mvp',stage)).searchParams.get('etapa'),stage);
 const option=m.normalizeOptions({template:'compare',first:2,second:8},data);
 assert.deepEqual(m.selectedRows(data,option).map(r=>r.rank),[3,9]);assert(m.captionFor(data,option).includes(data.url));
 assert(!('first' in m.rememberedOptions(option)));assert(!('rows' in m.rememberedOptions(option)));
 const home=m.normalizePayload({rows:[{name:'Pessoa',kills:2}],url:'https://evil.example/'});assert.equal(home.rows[0].damage,null);assert.equal(m.formatValue(home.rows[0].damage),'—');assert.equal(home.url,'https://centralfreefire.com.br/');
});
test('all canvas formats and models retain source branding, stage, numbers and safe footer bounds',async()=>{
 const m=await modelPromise,{renderRankingCard}=await rendererPromise,data=m.normalizePayload(raw());
 const images=new Map([['/central free fire.webp',await loadImage('central free fire.webp')]]);
 for(const row of data.rows){images.set(row.logo,await loadImage(row.logo));images.set(row.photo,await loadImage(row.photo));}
 for(const format of Object.keys(m.FORMATS))for(const template of ['table','leader','compare']){
  const options=m.normalizeOptions({format,template,showPhotos:true},data),canvas=createCanvas(1,1),ctx=canvas.getContext('2d'),painted=[];
  const original=ctx.fillText.bind(ctx);ctx.fillText=(text,x,y)=>{painted.push({text:String(text),x,y});original(text,x,y);};
  renderRankingCard(canvas,data,options,{images});
  assert.equal(canvas.width,m.FORMATS[format].width);assert.equal(canvas.height,m.FORMATS[format].height);
  assert(painted.some(x=>x.text==='centralfreefire.com.br'));assert(painted.some(x=>x.text==='CENTRAL FREE FIRE'));assert(painted.some(x=>x.text.includes('Geral')));assert(painted.some(x=>x.text.includes('11/10/2026')));
  assert(painted.some(x=>x.text==='359'));if(template==='table')assert(painted.some(x=>x.text==='10º'));
  const maxY=Math.max(...painted.map(x=>x.y));assert(maxY<canvas.height*(format==='story'?.76:format==='feed'?.86:.94),format+' '+template+' '+maxY);
  assert(canvas.toBuffer('image/png').length>5000);
  if(process.env.CFF_CARD_RENDER_DIR){fs.mkdirSync(process.env.CFF_CARD_RENDER_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.CFF_CARD_RENDER_DIR,format+'-'+template+'.png'),canvas.toBuffer('image/png'));}
 }
});
test('QR code is generated locally and decodes to the exact filter URL',async()=>{
 const jsQR=require('jsqr'),{drawQR}=await rendererPromise,m=await modelPromise,url=m.shareURLFor('mvp','segundaFase'),qr=qrcode(0,'M');qr.addData(url);qr.make();
 const c=createCanvas(300,300),ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,300,300);drawQR(ctx,qr,10,10,280);
 const result=jsQR(ctx.getImageData(0,0,300,300).data,300,300);assert.equal(result.data,url);
});
async function editor(){
 const m=await modelPromise,r=await rendererPromise,dom=new JSDOM('<button id="launch">Criar card</button>',{url:'https://centralfreefire.com.br/ffws-br-s2/inicio',runScripts:'outside-only'}),w=dom.window,requests=[],downloads=[],copies=[],shares=[];
 const nativeHead=w.document.head.append.bind(w.document.head);
 w.document.head.append=(node)=>{requests.push(node.src||node.href);nativeHead(node);queueMicrotask(()=>{if(node.tagName==='SCRIPT'){w.eval(fs.readFileSync('js/vendor/qrcode-generator.js','utf8'));}node.onload?.();});};
 w.Image=class {set src(value){requests.push(value);queueMicrotask(()=>this.onerror?.());}};
 const drawing=new WeakMap();w.HTMLCanvasElement.prototype.getContext=function(){if(!drawing.has(this))drawing.set(this,createCanvas(this.width,this.height));return drawing.get(this).getContext('2d');};
 w.HTMLCanvasElement.prototype.toBlob=function(callback){const buffer=drawing.get(this).toBuffer('image/png');queueMicrotask(()=>callback(new w.Blob([buffer],{type:'image/png'})));};
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){downloads.push(this.download);};w.setTimeout=()=>1;w.clearTimeout=()=>{};
 Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async t=>copies.push(t)}});w.navigator.share=async args=>shares.push(args);w.navigator.canShare=()=>true;
 w.__model=m;w.__renderer=r;
 let src=fs.readFileSync('js/ranking-share-cards.mjs','utf8').replace(/^import .*\n/gm,'').replace(/export (async )?function /g,(_,a)=>`${a||''}function `);
 src='const {FORMATS,normalizePayload,normalizeOptions,rememberedOptions,selectedRows,STAT_LABELS,statValue,captionFor,captionWithLink,cardFilename}=window.__model;const {renderRankingCard}=window.__renderer;\n'+src+'\nwindow.openRankingCard=openRankingCard;';w.eval(src);
 const $=s=>w.document.querySelector(s),change=async(name,value)=>{const input=$(`[name="${name}"]`);if(input.type==='checkbox')input.checked=value;else input.value=value;input.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(()=>$('[data-card-action="download"]')?.disabled===false);};
 return {w,$,requests,downloads,copies,shares,change,open:(payload=raw())=>w.openRankingCard(payload),close:()=>dom.window.close()};
}
test('actual editor exports a PNG, copies editable caption with link, shares only on click and remembers style',async()=>{
 const u=await editor();try{
  u.$('#launch').focus();await u.open();assert.equal(u.$('canvas').width,1218);assert.equal(u.shares.length,0);assert.equal(u.downloads.length,0);
  await u.change('format','story');assert.equal(u.$('canvas').height,1920);await u.change('template','compare');
  await u.change('first','2');await u.change('second','8');assert.equal(u.$('[name="first"]').value,'2');
  await u.change('showQR',true);assert.equal(u.requests.filter(x=>x.includes('qrcode-generator')).length,1);
  u.$('[data-card-action="copy-caption"]').click();await tick();assert(u.copies[0].includes('Rigby245'));assert(u.copies[0].includes('aba=mvp&etapa=geral'));
  const caption=u.$('[name="caption"]');caption.value='Minha análise';caption.dispatchEvent(new u.w.Event('input',{bubbles:true}));await u.change('theme','tournament');assert.equal(caption.value,'Minha análise');
  u.$('[data-card-action="copy-caption"]').click();await tick();assert(u.copies.at(-1).includes('Minha análise\n\nhttps://'));
  u.$('[data-card-action="download"]').click();assert.equal(u.downloads.length,1);assert(u.downloads[0].endsWith('-compare-story.png'));
  u.$('[data-card-action="share"]').click();await tick();assert.equal(u.shares.length,1);assert.equal(u.shares[0].files[0].type,'image/png');assert(u.shares[0].text.includes('aba=mvp'));
  u.$('[data-card-action="close"]').click();assert.equal(u.w.document.activeElement.id,'launch');await u.open();assert.equal(u.$('[name="format"]').value,'story');assert.equal(u.requests.filter(x=>x.includes('ranking-share-cards.css')).length,1);
  assert(!u.requests.some(x=>/firebase|workers|player-stats|players\.json/.test(x)));
 }finally{u.close();}
});
test('share cancellation is silent and browsers without native sharing download a file',async()=>{
 const u=await editor();try{await u.open();u.w.navigator.share=async()=>{throw Object.assign(Error('Cancelado'),{name:'AbortError'});};u.$('[data-card-action="share"]').click();await tick();assert(!u.$('.cff-card-status').classList.contains('is-error'));u.w.navigator.canShare=()=>false;u.$('[data-card-action="share"]').click();await tick();assert.equal(u.downloads.length,1);}finally{u.close();}
});

test('home card adapter captures current numbers and full team identities without a ranking fetch',async()=>{
 const html='<aside data-home-rankings-event="WB 2026 S2"><section id="home-ranking-kills"><h3>Top 6 Abates</h3><table><tbody><tr><td class="home-rank-pos">1</td><td class="home-rank-media"><img src="home-assets/players/yago.webp"></td><td class="home-rank-main"><a href="jogador.html?jogador=Yago&time=LOS"><b>Yago</b><small>LOS</small></a></td><td class="home-rank-number">1.234</td><td class="home-rank-number">121</td></tr></tbody></table></section></aside>';
 const d=new JSDOM(html,{url:'https://centralfreefire.com.br/',runScripts:'outside-only'}),w=d.window;const captured=[];w.openTestCard=async data=>captured.push(data);w.eval(fs.readFileSync('js/home-share-cards.js','utf8').replace("await import('/js/ranking-share-cards.mjs?v=20261020-cards-v3')","{openRankingCard:window.openTestCard}"));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));w.document.querySelector('button').click();await tick();
 assert.equal(captured[0].rows[0].kills,1234);assert.equal(captured[0].rows[0].matches,121);assert.equal(captured[0].rows[0].team,'LOS');assert.equal(captured[0].rows[0].damage,undefined);d.window.close();
});
test('short tables fill the usable height, while comparison metrics keep a readable gap above details',async()=>{
 const m=await modelPromise,{renderRankingCard}=await rendererPromise,data=m.normalizePayload(raw()),images=new Map();
 for(const row of data.rows)images.set(row.photo,await loadImage(row.photo));
 for(const format of ['feed','story','square']){
  const c=createCanvas(1,1),ctx=c.getContext('2d'),painted=[];const draw=ctx.fillText.bind(ctx);ctx.fillText=(text,x,y)=>{painted.push({text:String(text),x,y});draw(text,x,y);};
  renderRankingCard(c,data,m.normalizeOptions({format,template:'table',rowCount:3},data),{images});
  const first=painted.find(x=>x.text==='1º'),last=painted.find(x=>x.text==='3º');assert(last.y-first.y>c.height*.25,format);
  painted.length=0;renderRankingCard(c,data,m.normalizeOptions({format,template:'compare',showPhotos:true,showQR:true},data),{images});
  const label=painted.find(x=>x.text==='ABATES'),detail=painted.find(x=>x.text==='QUEDAS');assert(detail.y-label.y>=40,format+' comparison spacing');
 }
});

function teamPayload(){const squads=read('ffws-br-2026-s2/inicio-elencos.json'),team=squads.teams.find(t=>t.name==='LOS');const views=Object.entries(team.statsByStage).map(([id,stats])=>({id,mode:'team',kind:'teams',title:'Equipe em números',event:'WB 2026 S2',stage:id==='geral'?'Geral':id==='segundaFase'?'Segunda fase':id==='final'?'Final':'Classificatória',updatedAt:squads.updatedAt,url:'https://centralfreefire.com.br/ffws-br-s2/inicio?aba=equipes&etapa='+id+'&time=LOS',rows:[{name:team.name,team:team.name,logo:team.logo,...stats}]}));return {...views[0],views,viewId:'geral'};}
test('complete team tables include all fourteen entrants in each export format within the safe area',async()=>{
 const m=await modelPromise,{renderRankingCard}=await rendererPromise,summary=read('ffws-br-2026-s2/inicio-resumo.json'),data=m.normalizePayload({kind:'teams',metric:'points',title:'Classificação',stage:'Classificatória',rows:summary.stages.classificatoria.rows.map(r=>({...r,name:r.team}))});
 for(const format of Object.keys(m.FORMATS)){
  const options=m.normalizeOptions({rowCount:'all',format,showQR:true},data);assert.equal(m.selectedRows(data,options).length,14);assert.equal(options.rowCount,'all');
  const c=createCanvas(1,1),ctx=c.getContext('2d'),texts=[];const fill=ctx.fillText.bind(ctx);ctx.fillText=(t,x,y)=>{texts.push({text:String(t),y});fill(t,x,y);};renderRankingCard(c,data,options);
  assert(texts.some(t=>t.text==='14º'));assert(texts.some(t=>t.text==='CIVIS'));assert(texts.some(t=>t.text.includes('TABELA COMPLETA')));assert(Math.max(...texts.map(t=>t.y))<c.height*(format==='story'?.76:format==='feed'?.86:.94));
  if(process.env.CFF_CARD_RENDER_DIR)fs.writeFileSync(path.join(process.env.CFF_CARD_RENDER_DIR,format+'-all-teams.png'),c.toBuffer('image/png'));
 }
});
test('player portraits are enabled by default and drawn in highlight and comparison including horizontal cards',async()=>{
 const m=await modelPromise,{renderRankingCard}=await rendererPromise,data=m.normalizePayload(raw()),images=new Map();for(const row of data.rows.slice(0,2))images.set(row.photo,await loadImage(row.photo));
 for(const format of Object.keys(m.FORMATS))for(const template of ['leader','compare']){const options=m.normalizeOptions({format,template},data),c=createCanvas(1,1),ctx=c.getContext('2d'),drawn=[];const draw=ctx.drawImage.bind(ctx);ctx.drawImage=(...args)=>{drawn.push(args[0]);draw(...args);};renderRankingCard(c,data,options,{images});assert(drawn.includes(images.get(data.rows[0].photo)));if(template==='compare')assert(drawn.includes(images.get(data.rows[1].photo)));}
 assert.equal(m.normalizeOptions({showPhotos:false},data).showPhotos,false);
});
test('team cards render only selected available metrics in every format and captions use the same values',async()=>{
 const m=await modelPromise,{renderRankingCard}=await rendererPromise,payload=teamPayload(),data=m.normalizePayload(payload.views.find(v=>v.id==='final')),images=new Map([[data.rows[0].logo,await loadImage(data.rows[0].logo)]]);
 for(const format of Object.keys(m.FORMATS)){
  const options=m.normalizeOptions({format,stats:Object.keys(m.STAT_LABELS),showQR:true},data),c=createCanvas(1,1),ctx=c.getContext('2d'),painted=[];const fill=ctx.fillText.bind(ctx);ctx.fillText=(t,x,y)=>{painted.push({text:String(t),y});fill(t,x,y);};renderRankingCard(c,data,options,{images});assert.equal(options.template,'team');assert.equal(options.stats.length,7);assert(painted.some(t=>t.text==='6,62'));assert(painted.some(t=>t.text==='BOOYAHS'));assert(painted.some(t=>t.text==='DANO'));assert(Math.max(...painted.map(t=>t.y))<c.height*(format==='story'?.76:format==='feed'?.86:.94));
  if(process.env.CFF_CARD_RENDER_DIR)fs.writeFileSync(path.join(process.env.CFF_CARD_RENDER_DIR,format+'-team.png'),c.toBuffer('image/png'));
 }
 const general=m.normalizePayload(payload.views.find(v=>v.id==='geral')),options=m.normalizeOptions({stats:['points','average','kills','garbage']},general);assert.deepEqual(options.stats,['average','kills']);const caption=m.captionFor(general,options);assert(caption.includes('ABATES / QUEDA: 8,73'));assert(!caption.includes('PONTOS:'));assert(!caption.includes('DANO:'));assert(caption.includes('time=LOS'));
});
test('team editor switches preloaded phases and chosen metrics without fetching rankings, and includes all-team option',async()=>{
 const u=await editor();try{
  await u.open(teamPayload());assert.equal(u.$('[name="template"]').value,'team');assert.equal(u.$('[name="view"]').value,'geral');assert(u.$('[data-card-stat="points"]').disabled);assert(!u.$('[data-card-stats]').hidden);
  const before=u.requests.length;await u.change('view','final');assert(!u.$('[data-card-stat="points"]').disabled);assert(u.$('[name="caption"]').value.includes('Final'));assert(u.$('[name="caption"]').value.includes('etapa=final&time=LOS'));assert.equal(u.requests.length,before);
  const damage=u.$('[data-card-stat="damage"]');damage.checked=true;damage.dispatchEvent(new u.w.Event('change',{bubbles:true}));await wait(()=>!u.$('[data-card-action="download"]').disabled);assert(u.$('[name="caption"]').value.includes('DANO:'));
  const summary=read('ffws-br-2026-s2/inicio-resumo.json');await u.open({kind:'teams',metric:'points',rows:summary.stages.classificatoria.rows.map(r=>({...r,name:r.team}))});await u.change('rowCount','all');assert.equal(u.$('[name="rowCount"]').selectedOptions[0].textContent,'Todos os times · 14');
  await u.open();assert(u.$('[name="rowCount"] option[value="all"]').hidden);assert(u.$('[name="showPhotos"]').checked);assert(u.requests.some(x=>x.includes('player-photos/s2/yago.webp')));
 }finally{u.close();}
});

test('annual cards show weighted points, no irrelevant kill statistics and both view snapshots in all safe formats',async()=>{
 const m=await modelPromise,{renderRankingCard}=await rendererPromise,source=read('ranking-data/brasil-2026.json'),events=source.events.filter(e=>e.status==='finished');
 for(const detailed of [false,true]){
  const data=m.normalizePayload({id:'anual-2026',kind:'teams',mode:'annual',metric:'points',title:'Ranking anual CFF',event:'Brasil 2026',stage:detailed?'Por competição':'Pontuação total',annualColumns:detailed?events.map(e=>e.label):[],updatedAt:source.updatedAt,url:'https://centralfreefire.com.br/ranking-anual.html?ano=2026&visao='+ (detailed?'competicoes':'total'),rows:source.rows.map(r=>({rank:r.rank,name:r.team,team:r.team,logo:r.logo,points:r.total,annualValues:events.map(e=>r.results.find(x=>x.event===e.id)?.points??null)}))});
  for(const format of Object.keys(m.FORMATS)){
   const options=m.normalizeOptions({format,rowCount:'all',template:'compare'},data);assert.equal(options.rowCount,10);assert.equal(options.template,'table');
   const canvas=createCanvas(1,1),ctx=canvas.getContext('2d'),painted=[],original=ctx.fillText.bind(ctx);ctx.fillText=(t,x,y)=>{painted.push({text:String(t),x,y});original(t,x,y);};renderRankingCard(canvas,data,options);
   assert(painted.some(p=>p.text==='920'));assert(painted.some(p=>p.text==='TOTAL'));assert(!painted.some(p=>/ABATES|QUEDAS|BOOYAHS/.test(p.text)));assert.equal(painted.some(p=>p.text==='EWC'),detailed);
   assert(Math.max(...painted.map(p=>p.y))<canvas.height*(format==='story'?.76:format==='feed'?.86:.94));assert(canvas.toBuffer('image/png').length>5000);
   if(process.env.CFF_CARD_RENDER_DIR){fs.mkdirSync(process.env.CFF_CARD_RENDER_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.CFF_CARD_RENDER_DIR,'annual-'+format+'-'+(detailed?'all-events':'total')+'.png'),canvas.toBuffer('image/png'));}
  }
  const caption=m.captionFor(data,m.normalizeOptions({},data));assert(caption.includes('920 pontos CFF'));assert(caption.includes('Metodologia própria'));assert(caption.includes(data.url));assert(!caption.includes('quedas'));
 }
});
test('annual editor restores the detailed view, switches to total and downloads a user-triggered PNG',async()=>{
 const u=await editor();try{
  const source=read('ranking-data/brasil-2026.json'),events=source.events.filter(e=>e.status==='finished'),make=id=>({id,kind:'teams',mode:'annual',metric:'points',event:'Brasil 2026',stage:id==='events'?'Por competição':'Pontuação total',annualColumns:id==='events'?events.map(e=>e.label):[],rows:source.rows.map(r=>({rank:r.rank,name:r.team,points:r.total,annualValues:events.map(e=>r.results.find(x=>x.event===e.id)?.points??null)}))});
  await u.open({views:[make('total'),make('events')],viewId:'events'});assert.equal(u.$('[name="view"]').value,'events');assert.equal(u.$('[name="rowCount"]').value,'10');assert(u.$('[name="rowCount"] option[value="all"]').hidden);assert(u.$('[name="template"]').disabled);assert(u.$('[name="caption"]').value.includes('EWC: 325'));
  await u.change('view','total');assert(!u.$('[name="caption"]').value.includes('EWC: 325'));u.$('[data-card-action="download"]').click();await tick();assert.equal(u.downloads.length,1);assert.equal(u.shares.length,0);
 }finally{u.close();}
});
