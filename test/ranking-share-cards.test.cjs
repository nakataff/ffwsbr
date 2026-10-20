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
 src='const {FORMATS,normalizePayload,normalizeOptions,rememberedOptions,selectedRows,captionFor,captionWithLink,cardFilename}=window.__model;const {renderRankingCard}=window.__renderer;\n'+src+'\nwindow.openRankingCard=openRankingCard;';w.eval(src);
 const $=s=>w.document.querySelector(s),change=async(name,value)=>{const input=$(`[name="${name}"]`);if(input.type==='checkbox')input.checked=value;else input.value=value;input.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(()=>$('[data-card-action="download"]')?.disabled===false);};
 return {w,$,requests,downloads,copies,shares,change,open:()=>w.openRankingCard(raw()),close:()=>dom.window.close()};
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
 const d=new JSDOM(html,{url:'https://centralfreefire.com.br/',runScripts:'outside-only'}),w=d.window;const captured=[];w.openTestCard=async data=>captured.push(data);w.eval(fs.readFileSync('js/home-share-cards.js','utf8').replace("await import('/js/ranking-share-cards.mjs?v=20261020-cards-v1')","{openRankingCard:window.openTestCard}"));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));w.document.querySelector('button').click();await tick();
 assert.equal(captured[0].rows[0].kills,1234);assert.equal(captured[0].rows[0].matches,121);assert.equal(captured[0].rows[0].team,'LOS');assert.equal(captured[0].rows[0].damage,undefined);d.window.close();
});
