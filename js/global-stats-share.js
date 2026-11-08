/* Central Free Fire: lightweight client-only image sharing for World Finals 2026 stats.
 * Uses aggregates already rendered on /stats; never fetches match/player databases.
 */
(function(){
'use strict';
if(window.CFFGlobalStatsShare)return;
const PAGE='/ffws-global-2026/stats', BRAND='/central%20free%20fire.webp';
const FORMATS={stories:[1080,1920],feed:[1080,1350],square:[1080,1080],wide:[1280,720]};
const ACCENTS={blue:'#00c8ff',red:'#ff445f',gold:'#f3c466',green:'#36db9c'};
const GROUPS=[
 ['anchor-s2-totais-equipe','team',[['eq-pts','points'],['eq-kills','kills'],['eq-booyah','booyahs']]],
 ['anchor-s2-medias-equipe','team',[['eq-avgpts','avgPoints'],['eq-avgkills','avgKills'],['eq-avgpos','avgPosition']]],
 ['anchor-s2-top3-equipe','team',[['eq-top3-count','top3'],['eq-top3-avg','top3Rate'],['eq-top12-count','top12']]],
 ['anchor-s2-totais-jogador','player',[['pl-totkills','kills'],['pl-totdano','damage'],['pl-totast','assists']]],
 ['anchor-s2-medias-jogador','player',[['pl-avgkills','avgKills'],['pl-avgdano','avgDamage'],['pl-avgast','avgAssists']]],
 ['anchor-s2-participacao','contribution',[['pl-partkills','avgPartKills'],['pl-partdano','avgPartDamage'],['pl-partast','avgPartAssists']]],
 ['anchor-s2-rec-drop-player','record',[['rec-pl-drop-kills','playerDrop','kills'],['rec-pl-drop-assists','playerDrop','assists'],['rec-pl-drop-damage','playerDrop','damage']]],
 ['anchor-s2-rec-day-player','record',[['rec-pl-day-kills','playerDay','kills'],['rec-pl-day-assists','playerDay','assists'],['rec-pl-day-damage','playerDay','damage']]],
 ['anchor-s2-rec-drop-team','record',[['rec-eq-drop-points','teamDrop','points'],['rec-eq-drop-kills','teamDrop','kills'],['rec-eq-drop-damage','teamDrop','damage']]],
 ['anchor-s2-rec-day-team','record',[['rec-eq-day-points','teamDay','points'],['rec-eq-day-kills','teamDay','kills'],['rec-eq-day-damage','teamDay','damage']]]
];
const RECORDS=[
 ['teamDay','points','Maior pontuação em um dia'],['teamDay','kills','Mais abates de equipe em um dia'],['teamDay','damage','Maior dano de equipe em um dia'],
 ['teamDrop','points','Mais pontos em uma queda'],['teamDrop','kills','Mais abates de equipe em uma queda'],['teamDrop','damage','Maior dano de equipe em uma queda'],
 ['playerDay','kills','Mais abates individuais em um dia'],['playerDay','damage','Maior dano individual em um dia'],['playerDay','assists','Mais assistências individuais em um dia'],
 ['playerDrop','kills','Mais abates individuais em uma queda'],['playerDrop','damage','Maior dano individual em uma queda'],['playerDrop','assists','Mais assistências individuais em uma queda']
];
const LABELS={points:'PONTOS',kills:'ABATES',damage:'DANO',assists:'ASSISTÊNCIAS',booyahs:'BOOYAHS',
 matches:'QUEDAS',avgPoints:'PTS / QUEDA',avgKills:'K / QUEDA',avgPosition:'POSIÇÃO MÉDIA',top3:'TOP 3',
 top3Rate:'TAXA TOP 3',top12:'ÚLTIMOS LUGARES',avgDamage:'DANO / QUEDA',avgAssists:'AST / QUEDA',
 avgPartKills:'PART. ABATES',avgPartDamage:'PART. DANO',avgPartAssists:'PART. ASSIST.'};
const nf=new Intl.NumberFormat('pt-BR');
const num=v=>Number(v)||0;
const key=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
const fmt=(v,metric)=>['avgPoints','avgKills','avgDamage','avgAssists','avgPosition'].includes(metric)?num(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+(metric==='avgPosition'?'º':''):
 ['top3Rate','avgPartKills','avgPartDamage','avgPartAssists'].includes(metric)?(metric==='top3Rate'?num(v)*100:num(v)).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':
 nf.format(Math.round(num(v)));
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const STAGES={classificatoria:'Knockout · Fase 1',segundaFase:'Knockout · Fase 2',lastChance:'Last Chance',final:'Grande Final',geral:'Todas as fases'};
let context=null,modal=null,livePayload=null,previewBlob=null,renderSeq=0,currentSource=null,modelRoot=null;
const imgCache=new Map();
const state={kind:'summary',format:'feed',theme:'dark',accent:'blue',showSubtitle:true,showFilters:true,showImage:true,
 title:'',team:'',player:'',teamB:'',topEntity:'team',metric:'points',record:'teamDay|points',single:'points'};
function dataRows(entity){
 if(!context)return [];
 return entity==='team'?context.teams:entity==='player'?context.players:entity==='contribution'?context.playerShareRows:context.records?.[entity]||[];
}
function findRow(name,entity){
 return dataRows(entity).find(row=>key(entity==='team'?row.team:row.name)===key(name))||dataRows(entity)[0]||null;
}
function sorted(rows,metric){
 const lowerFirst=metric==='avgPosition';
 return [...(rows||[])].sort((a,b)=>(lowerFirst?num(a[metric])-num(b[metric]):num(b[metric])-num(a[metric]))||num(b.kills)-num(a.kills)||String(a.team||a.name).localeCompare(String(b.team||b.name),'pt-BR'));
}
function optionsFor(select,rows,getValue,getLabel,selected){
 select.replaceChildren();
 (rows||[]).forEach(row=>{
  const opt=document.createElement('option');
  opt.value=String(getValue(row));opt.textContent=String(getLabel(row));select.append(opt);
 });
 if(selected!==undefined)select.value=String(selected);
 if(!select.value&&select.options.length)select.selectedIndex=0;
 return select.value;
}
function selectedRecord(){
 const [scope,metric]=state.record.split('|');
 return RECORDS.find(v=>v[0]===scope&&v[1]===metric)||RECORDS[0];
}
function contextLabel(){
 if(!context)return '';
 const f=context.filters||{},stage={classificatoria:'F1',segundaFase:'F2',lastChance:'Repescagem',final:'Final',geral:'Geral'}[f.stage]||'Mundial';
 const dates=[...new Set((context.events||[]).map(row=>row.date).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)))].sort();
 const terms=[stage];
 if(dates.length){
  const short=x=>x.slice(8,10)+'/'+x.slice(5,7);
  terms.push(dates.length===1?short(dates[0]):short(dates[0])+'–'+short(dates.at(-1)));
 }else if(f.days?.length){
  const days=f.days.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  if(days.length)terms.push(days.length===1?'D'+days[0]:'D'+days[0]+'–'+days.at(-1));
 }
 if(f.maps?.length===1)terms.push(f.maps[0]);
 else if(f.maps?.length>1)terms.push(f.maps.length+' mapas');
 terms.push((context.events?.length||0)+' quedas');
 return terms.join(' · ');
}
function shareLink(){
 const f=context?.filters||{},url=new URL(PAGE,location.origin);
 if(f.stage)url.searchParams.set('statsStage',f.stage);
 if(f.days?.length)url.searchParams.set('statsDays',f.days.join(','));
 if(f.maps?.length)url.searchParams.set('statsMaps',f.maps.join(','));
 return url.href;
}
function logoSrc(name){
 try{return context?.logoForTeam?.(name)||'';}catch(_){return ''}
}
function playerSrc(name,team){
 try{return context?.photoForPlayer?.(name,team)||'';}catch(_){return ''}
}
function stat(label,value,metric){
 return {label:label||LABELS[metric]||metric,value:fmt(value,metric)};
}
function packRows(rows,metric,type,limit=5){
 return sorted(rows,metric).slice(0,limit).map((row,index)=>({
  rank:index+1,name:type==='team'?row.team:row.name,team:row.team||'',score:fmt(row[metric],metric),
  logo:type==='team'?logoSrc(row.team):logoSrc(row.team),photo:type==='player'?playerSrc(row.name,row.team):''
 }));
}
function fromContext(){
 if(!context)return null;
 const totals=context.summary||{};
 const choice=currentSource||{};
 const kind=choice.kind||state.kind;
 const payload={kind,eyebrow:'FFWS GLOBAL FINALS 2026',title:'ESTATÍSTICAS DO MUNDIAL',subtitle:contextLabel(),
  badge:'CENTRAL FREE FIRE · DADOS OFICIAIS',main:'',mainLabel:'',entity:'',team:'',logo:'',
  photo:'',facts:[],rows:[],two:null,context:contextLabel()};
 if(kind==='summary'){
  payload.title='RESUMO DO MUNDIAL';
  payload.main=fmt(totals.kills,'kills');payload.mainLabel='ABATES REGISTRADOS';
  payload.facts=[stat('QUEDAS DISPUTADAS',totals.drops,'matches'),stat('PONTOS',totals.points,'points'),
    stat('BOOYAHS',totals.booyahs,'booyahs'),stat('EQUIPES',context.teams.length,'matches')];
 }else if(kind==='single'){
  const all={drops:totals.drops,points:totals.points,kills:totals.kills,booyahs:totals.booyahs,avgPoints:totals.avgPoints,avgPosition:totals.avgPosition};
  const metric=choice.metric||state.single,labels={drops:'QUEDAS DISPUTADAS',points:'PONTOS',kills:'ABATES',booyahs:'BOOYAHS',avgPoints:'MÉDIA DE PONTOS',avgPosition:'COLOCAÇÃO MÉDIA'};
  payload.title=labels[metric]||metric;
  payload.main=fmt(all[metric],metric);payload.mainLabel='TOTAL NO RECORTE';
  payload.facts=[stat('QUEDAS',totals.drops,'matches'),stat('ABATES',totals.kills,'kills'),stat('BOOYAHS',totals.booyahs,'booyahs')];
 }else if(kind==='team'){
  const row=choice.row||findRow(state.team,'team');
  if(!row)return null;
  payload.title='DESEMPENHO DA EQUIPE';payload.entity=row.team;payload.team=row.team;payload.logo=logoSrc(row.team);
  const leading=choice.metric&&row[choice.metric]!==undefined?choice.metric:'points';
  payload.main=fmt(row[leading],leading);payload.mainLabel=LABELS[leading]||'PONTOS';
  payload.facts=[stat('ABATES',row.kills,'kills'),stat('BOOYAHS',row.booyahs,'booyahs'),
   stat('QUEDAS',row.matches,'matches'),stat('PTS / QUEDA',row.avgPoints,'avgPoints'),
   stat('K / QUEDA',row.avgKills,'avgKills'),stat('TOP 3',row.top3,'top3')];
  payload.subtitle=row.team+' · '+contextLabel();
 }else if(kind==='player'){
  const row=choice.row||findRow(state.player,'player');
  if(!row)return null;
  payload.title='DESEMPENHO INDIVIDUAL';payload.entity=row.name;payload.team=row.team;
  payload.photo=playerSrc(row.name,row.team);payload.logo=logoSrc(row.team);
  const leading=choice.metric&&row[choice.metric]!==undefined?choice.metric:'kills';
  payload.main=fmt(row[leading],leading);payload.mainLabel=LABELS[leading]||'ABATES';
  payload.facts=[stat('DANO',row.damage,'damage'),stat('ASSISTÊNCIAS',row.assists,'assists'),
   stat('QUEDAS',row.matches,'matches'),stat('K / QUEDA',row.avgKills,'avgKills'),
   stat('DANO / QUEDA',row.avgDamage,'avgDamage'),
   ...(row.avgPartKills!==undefined?[stat('PART. ABATES',row.avgPartKills,'avgPartKills'),stat('PART. DANO',row.avgPartDamage,'avgPartDamage')]:[])];
  payload.subtitle=row.team+' · '+contextLabel();
 }else if(kind==='top'){
  const entity=choice.entity||state.topEntity,metric=choice.metric||state.metric;
  const label=choice.title||LABELS[metric]||'DESTAQUES';
  const source=entity==='contribution'?'contribution':entity;
  const rows=packRows(dataRows(source),metric,source==='team'?'team':'player');
  payload.title='TOP 5 · '+label;payload.rows=rows;
  payload.main=rows[0]?.score||'—';payload.mainLabel=label;
  payload.entity=rows[0]?.name||'';payload.team=rows[0]?.team||'';
  payload.logo=rows[0]?.logo||'';payload.photo=rows[0]?.photo||'';
 }else if(kind==='record'){
  const rec=choice.record||selectedRecord(),scope=rec[0],metric=rec[1],title=choice.title||rec[2];
  const row=choice.row||sorted(dataRows(scope),metric)[0];
  if(!row)return null;
  payload.title=title.toUpperCase();payload.main=fmt(row[metric],metric);payload.mainLabel=LABELS[metric];
  payload.entity=row.team&&scope.startsWith('team')?row.team:row.name;
  payload.team=row.team||'';payload.logo=logoSrc(row.team);payload.photo=scope.startsWith('player')?playerSrc(row.name,row.team):'';
  const day=row.day?'DIA '+row.day:'',map=row.map||'';
  payload.subtitle=[row.team&&scope.startsWith('player')?row.team:'',row.stage?STAGES[row.stage]:'',day,scope.endsWith('Drop')?'QUEDA '+(row.roundDrop||row.drop):'',
    scope.endsWith('Drop')?map:''].filter(Boolean).join(' · ');
  payload.facts=[stat('ABATES',row.kills,'kills'),
   ...(row.points!==undefined?[stat('PONTOS',row.points,'points')]:[]),
   ...(row.damage!==undefined?[stat('DANO',row.damage,'damage')]:[]),
   ...(row.assists!==undefined?[stat('ASSIST.',row.assists,'assists')]:[]),
   ...(row.matches!==undefined?[stat('QUEDAS',row.matches,'matches')]:[])];
 }else if(kind==='compare'){
  const first=findRow(state.team,'team'),second=findRow(state.teamB,'team');
  if(!first||!second||first.team===second.team)return null;
  payload.title='COMPARATIVO DE EQUIPES';
  payload.entity=first.team+' × '+second.team;payload.two=[first,second];
  payload.subtitle=contextLabel();
  payload.main=fmt(first.points,'points')+' × '+fmt(second.points,'points');payload.mainLabel='PONTOS';
  payload.facts=[{label:first.team,value:fmt(first.kills,'kills')+' ABATES'},
    {label:second.team,value:fmt(second.kills,'kills')+' ABATES'}];
 }
 if(state.title.trim())payload.title=state.title.trim().slice(0,85);
 return payload;
}
function settingsUI(){
 if(!modal)return;
 const $=q=>modal.querySelector(q);
 const kind=state.kind;
 $('.cff-share-entity-team').hidden=kind!=='team'&&kind!=='compare';
 $('.cff-share-team-b').hidden=kind!=='compare';
 $('.cff-share-entity-player').hidden=kind!=='player';
 $('.cff-share-top-settings').hidden=kind!=='top';
 $('.cff-share-record-setting').hidden=kind!=='record';
 $('.cff-share-single-setting').hidden=kind!=='single';
 $('.cff-share-custom-title').value=state.title;
 $('.cff-share-title-help').textContent=currentSource?.title?'Título sugerido: '+currentSource.title:'Deixe vazio para usar o título automático';
}
function textLine(ctx,text,x,y,max,font,color,weight='900',align='left'){
 ctx.textAlign=align;ctx.textBaseline='alphabetic';
 ctx.font=weight+' '+font+'px "Arial Narrow","Barlow Condensed",Arial,sans-serif';ctx.fillStyle=color;
 const t=String(text||'');
 if(ctx.measureText(t).width<=max)ctx.fillText(t,x,y);
 else{
  let v=t;
  while(v.length>1&&ctx.measureText(v+'…').width>max)v=v.slice(0,-1);
  ctx.fillText(v+'…',x,y);
 }
}
function rounded(ctx,x,y,w,h,r,color,stroke){
 const radius=Math.min(r,w/2,h/2);
 ctx.beginPath();ctx.roundRect(x,y,w,h,radius);
 if(color){ctx.fillStyle=color;ctx.fill();}
 if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
}
// Measure headlines before drawing so a two-line title cannot cover the next block.
function headlineLayout(ctx,title,maxWidth,requestedSize){
 const words=String(title||'').trim().split(/\s+/).filter(Boolean);
 for(let size=requestedSize;size>=25;size-=2){
  ctx.font='900 '+size+'px "Arial Narrow","Barlow Condensed",Arial,sans-serif';
  const lines=[];let line='';
  words.forEach(word=>{
   const next=line?line+' '+word:word;
   if(line&&ctx.measureText(next).width>maxWidth){lines.push(line);line=word;}
   else line=next;
  });
  if(line)lines.push(line);
  if(lines.length<=2&&lines.every(value=>ctx.measureText(value).width<=maxWidth))return {size,lines};
 }
 const size=25;ctx.font='900 '+size+'px "Arial Narrow","Barlow Condensed",Arial,sans-serif';
 const lines=[''];let rest='';
 words.forEach(word=>{
  const next=lines[0]?lines[0]+' '+word:word;
  if(!rest&&ctx.measureText(next).width<=maxWidth)lines[0]=next;
  else rest+=(rest?' ':'')+word;
 });
 if(rest)lines.push(rest);
 return {size,lines:lines.slice(0,2)};
}
function image(path){
 if(!path||!/^(https?:\/\/|\/|[a-z0-9][\w\-./% ]*\.(?:webp|png|jpe?g|svg)(?:\?.*)?$)/i.test(String(path)))return Promise.resolve(null);
 const url=new URL(String(path).startsWith('/')||/^https?:/i.test(path)?path:'/'+path,location.origin);
 if(url.origin!==location.origin)return Promise.resolve(null);
 const href=url.href;
 if(imgCache.has(href))return imgCache.get(href);
 const promise=new Promise(resolve=>{
  const pic=new Image();pic.crossOrigin='anonymous';pic.decoding='async';
  pic.onload=()=>resolve(pic);pic.onerror=()=>resolve(null);pic.src=href;
 });
 imgCache.set(href,promise);
 return promise;
}
function contain(ctx,pic,x,y,w,h){
 if(!pic)return;const iw=pic.naturalWidth||pic.width,ih=pic.naturalHeight||pic.height;
 if(!iw||!ih)return;const scale=Math.min(w/iw,h/ih);const dw=iw*scale,dh=ih*scale;
 ctx.drawImage(pic,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
}

function drawHeroPortrait(ctx,photo,emblem,x,y,size,accent,dark,surface){
 const radius=Math.max(14,Math.round(size*.085));
 ctx.save();ctx.shadowColor=accent;ctx.shadowBlur=size*.07;ctx.globalAlpha=.25;
 rounded(ctx,x,y,size,size,radius,surface);ctx.restore();
 ctx.save();ctx.beginPath();ctx.roundRect(x,y,size,size,radius);ctx.clip();
 const bg=ctx.createLinearGradient(x,y,x+size,y+size);
 bg.addColorStop(0,dark?'#182b42':'#ffffff');
 bg.addColorStop(1,dark?'#091625':'#dbe9f4');
 ctx.fillStyle=bg;ctx.fillRect(x,y,size,size);
 const halo=ctx.createRadialGradient(x+size*.56,y+size*.44,0,x+size*.56,y+size*.44,size*.75);
 halo.addColorStop(0,accent+'30');halo.addColorStop(1,accent+'00');
 ctx.fillStyle=halo;ctx.fillRect(x,y,size,size);
 if(emblem){
  ctx.save();ctx.globalAlpha=photo?(dark?.13:.11):.88;
  contain(ctx,emblem,x+size*.1,y+size*.09,size*.8,size*.8);ctx.restore();
 }
 if(photo){
  const iw=photo.naturalWidth||photo.width,ih=photo.naturalHeight||photo.height;
  if(iw>0&&ih>0){
   const scale=Math.min(size*.98/iw,size*1.14/ih);
   const dw=iw*scale,dh=ih*scale;
   ctx.drawImage(photo,x+(size-dw)/2,y+size*.045,dw,dh);
  }
  const fade=ctx.createLinearGradient(x,y+size*.74,x,y+size);
  fade.addColorStop(0,dark?'#0b192600':'#e8f1f500');
  fade.addColorStop(1,dark?'#0b1926db':'#e8f1f5c9');
  ctx.fillStyle=fade;ctx.fillRect(x,y+size*.74,size,size*.26);
 }
 ctx.restore();
 rounded(ctx,x,y,size,size,radius,null,dark?'#31516b':'#b5cbdc');
}
async function draw(payload){
 const canvas=modal.querySelector('canvas'),ctx=canvas.getContext('2d',{alpha:false});
 const [w,h]=FORMATS[state.format]||FORMATS.feed;
 canvas.width=w;canvas.height=h;
 const generation=++renderSeq;
 const [brand,emblem,photo,rowImages]=await Promise.all([image(BRAND),image(payload.logo),state.showImage?image(payload.photo):Promise.resolve(null),
  payload.rows?.length&&state.showImage?Promise.all(payload.rows.slice(0,5).map(row=>image(row.logo))):Promise.resolve([])]);
 if(generation!==renderSeq)return;
 const dark=state.theme==='dark',accent=ACCENTS[state.accent]||ACCENTS.blue;
 const bg=dark?'#070e1b':'#e9f1f8',surface=dark?'#111c30':'#ffffff',ink=dark?'#f8fbff':'#122439',muted=dark?'#a2bad5':'#3e5872';
 const grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,bg);grad.addColorStop(.7,dark?'#0b1e32':'#dbeaf6');grad.addColorStop(1,dark?'#06111f':'#f7fbff');
 ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
 ctx.globalAlpha=dark?.06:.07;ctx.strokeStyle=accent;ctx.lineWidth=3;
 for(let i=-7;i<14;i++){ctx.beginPath();ctx.moveTo(w*.55+i*95,-100);ctx.lineTo(w*.15+i*95,h+100);ctx.stroke()}
 ctx.globalAlpha=1;
 ctx.fillStyle=accent;ctx.fillRect(0,0,w,Math.max(9,w*.008));
 const pad=w*.07;const compact=h<=760;const wideList=compact&&payload.rows.length>0;
 const headY=compact?71:99,brandSize=compact?67:85;
 if(brand)contain(ctx,brand,pad,headY-43,brandSize,brandSize);
 else{rounded(ctx,pad,headY-42,brandSize,brandSize,14,accent);textLine(ctx,'CFF',pad+brandSize/2,headY+8,brandSize-8,27,dark?'#081523':'#fff','950','center')}
 textLine(ctx,'CENTRAL FREE FIRE',pad+brandSize+19,headY,600,compact?23:28,ink);
 textLine(ctx,payload.eyebrow,pad+brandSize+19,headY+29,600,compact?13:16,muted,'850');
 ctx.fillStyle=dark?'#34526c':'#b5cad9';ctx.fillRect(pad,headY+61,w-2*pad,2);
 // Canvas text coordinates are baselines: make headline, player, filters and score separate rows.
 const footerY=h-(compact?69:113);
 // Stories rankings: make the five rows fill the middle of the image, not
 // begin below a huge empty gap. Other formats preserve their layout.
 const storyRanking=h>=1800&&payload.rows.length>0;
 const panelTop=compact?497:storyRanking?Math.round(h*.425):Math.floor(h*.58);
 const heroVisible=state.showImage&&(photo||emblem)&&!wideList;
 const portraitY=compact?175:210;
 const portraitSize=heroVisible?Math.min(w*(compact?.255:h>1700?.425:.38),panelTop-portraitY-(compact?14:30)):0;
 const portraitX=w-pad-portraitSize;
 const contentWidth=wideList?w*.42:heroVisible?portraitX-pad-22:w-2*pad;
 const titleY=compact?201:h<=1100?231:h<=1400?236:244;
 const headline=headlineLayout(ctx,payload.title,contentWidth,compact?44:h<=1100?48:h<=1400?52:57);
 const titleStep=headline.size*1.05;
 headline.lines.forEach((line,i)=>textLine(ctx,line,pad,titleY+i*titleStep,contentWidth,headline.size,ink));
 const titleBottom=titleY+(headline.lines.length-1)*titleStep;
 const shortMeta=state.showFilters?payload.subtitle:(payload.team||'');
 const nameY=titleBottom+(compact?42:54),metaY=nameY+(compact?25:30);
 const hasName=Boolean(payload.entity&&!wideList);
 if(hasName)textLine(ctx,payload.entity.toUpperCase(),pad,nameY,contentWidth,compact?28:36,ink);
 if(state.showSubtitle&&shortMeta){
  textLine(ctx,shortMeta,pad,hasName?metaY:titleBottom+(compact?31:39),contentWidth,compact?17:20,muted,'750');
 }
 const minValueY=hasName?(state.showSubtitle&&shortMeta?metaY:nameY)+(compact?76:99):
  titleBottom+(state.showSubtitle&&shortMeta?(compact?110:137):(compact?83:110));
 const valueY=Math.min(minValueY,compact?427:h<=1100?455:h<=1400?485:530);
 const labelY=valueY+(compact?30:36);
 if(payload.main){
  const available=wideList?w*.38:contentWidth;
  let font=compact?77:clamp(w*.107,76,130);
  ctx.font='900 '+font+'px "Arial Narrow","Barlow Condensed",Arial,sans-serif';
  while(font>42&&ctx.measureText(String(payload.main)).width>available){
   font-=4;ctx.font='900 '+font+'px "Arial Narrow","Barlow Condensed",Arial,sans-serif';
  }
  textLine(ctx,payload.main,pad,valueY,available,font,accent);
  textLine(ctx,payload.mainLabel,pad,labelY,available,compact?17:22,muted,'850');
 }
 if(heroVisible&&portraitSize>80)drawHeroPortrait(ctx,photo,emblem,portraitX,portraitY,portraitSize,accent,dark,surface);
 const panelBottom=footerY-34;
 if(wideList){
  const items=payload.rows.slice(0,5);
  const x=w*.515,rowW=w*.415,yStart=192,gap=9;
  const rowH=(panelBottom-yStart-gap*(items.length-1))/Math.max(1,items.length);
  items.forEach((row,i)=>{
   const y=yStart+i*(rowH+gap);
   rounded(ctx,x,y,rowW,rowH,11,surface,dark?'#263e57':'#c6d6e4');
   rounded(ctx,x+9,y+13,44,rowH-26,8,i===0?accent:dark?'#1b3047':'#dce8f4');
   textLine(ctx,String(row.rank),x+31,y+rowH/2+8,39,23,i===0?'#081a2a':ink,'950','center');
   if(state.showImage&&rowImages[i])contain(ctx,rowImages[i],x+60,y+9,rowH-18,rowH-18);
   const nameX=x+(state.showImage?rowH+64:66);
   textLine(ctx,row.name,nameX,y+rowH/2+8,rowW-(nameX-x)-88,23,ink);
   textLine(ctx,row.score,x+rowW-13,y+rowH/2+9,93,25,accent,'950','right');
  });
 }else if(payload.rows.length){
  const items=payload.rows.slice(0,5);
  const gap=compact?7:storyRanking?16:12;
  const available=panelBottom-panelTop-(storyRanking?95:0);
  const rowH=clamp((available-gap*(items.length-1))/Math.max(1,items.length),
   compact?36:storyRanking?95:55,compact?70:storyRanking?156:95);
  if(storyRanking)textLine(ctx,'RANKING DO RECORTE',pad,panelTop-25,w-2*pad,19,muted,'900');
  items.forEach((row,i)=>{
   const y=panelTop+i*(rowH+gap);
   rounded(ctx,pad,y,w-pad*2,rowH,13,surface,dark?'#263e57':'#c6d6e4');
   const badgeSize=storyRanking?Math.min(86,rowH-24):rowH-16;
   const badgeY=storyRanking?y+(rowH-badgeSize)/2:y+8;
   rounded(ctx,pad+12,badgeY,badgeSize,badgeSize,8,i===0?accent:dark?'#1b3047':'#dce8f4');
   textLine(ctx,String(row.rank),pad+12+badgeSize/2,y+rowH/2+8,badgeSize-2,storyRanking?29:compact?19:26,i===0?'#081a2a':ink,'950','center');
   const logoSize=storyRanking?Math.min(99,rowH-22):rowH-15;
   if(state.showImage&&rowImages[i])contain(ctx,rowImages[i],pad+badgeSize+26,storyRanking?y+(rowH-logoSize)/2:y+8,logoSize,logoSize);
   const nameX=storyRanking?pad+badgeSize+(state.showImage&&rowImages[i]?logoSize+43:38):pad+rowH+(state.showImage?rowH+17:21);
   const nameWidth=storyRanking?Math.max(90,w-pad-155-nameX):w*.43;
   textLine(ctx,row.name,nameX,y+rowH/2+(storyRanking&&row.team&&row.team!==row.name?-6:7),nameWidth,storyRanking?33:compact?20:28,ink);
   if(storyRanking&&row.team&&row.team!==row.name)textLine(ctx,row.team,nameX,y+rowH/2+29,nameWidth,20,muted,'750');
   textLine(ctx,row.score,w-pad-17,y+rowH/2+10,w*.2,storyRanking?35:compact?23:31,accent,'950','right');
  });
 }else if(payload.two){
  const rows=payload.two,colGap=14,colW=(w-2*pad-colGap)/2;
  const boxH=Math.min(compact?122:210,panelBottom-panelTop);
  rows.forEach((row,i)=>{
   const x=pad+i*(colW+colGap),small=boxH<135;
   rounded(ctx,x,panelTop,colW,boxH,16,surface,dark?'#263e57':'#c6d6e4');
   textLine(ctx,row.team,x+18,panelTop+(small?28:42),colW-36,small?20:27,ink);
   textLine(ctx,fmt(row.points,'points')+' PTS',x+18,panelTop+(small?68:110),colW-36,small?34:46,accent);
   textLine(ctx,fmt(row.kills,'kills')+' ABATES',x+18,panelTop+boxH-17,colW-36,small?14:22,muted);
  });
 }else{
  const facts=payload.facts.slice(0,compact?2:6),cols=2,gap=compact?12:17;
  const usable=Math.max(0,panelBottom-panelTop),rows=Math.ceil(facts.length/cols);
  const boxH=Math.min(compact?104:h>1700?190:144,Math.max(0,(usable-gap*(rows-1))/Math.max(1,rows)));
  facts.forEach((fact,index)=>{
   const x=pad+(index%2)*( (w-2*pad+gap)/2 );
   const y=panelTop+Math.floor(index/2)*(boxH+gap),boxW=(w-pad*2-gap)/2;
   rounded(ctx,x,y,boxW,boxH,14,surface,dark?'#263e57':'#c6d6e4');
   textLine(ctx,fact.label,x+18,y+Math.min(boxH*.34,compact?24:35),boxW-36,compact?13:20,muted,'850');
   textLine(ctx,fact.value,x+18,y+boxH-16,boxW-36,boxH<75?23:compact?25:39,ink);
  });
 }
 ctx.fillStyle=accent;ctx.fillRect(pad,footerY-22,w-2*pad,3);
 textLine(ctx,'centralfreefire.com.br',pad,footerY+18,w*.72,compact?21:28,ink);
 textLine(ctx,'ESTATÍSTICAS · 2026',w-pad,footerY+18,w*.34,compact?12:17,muted,'800','right');
 previewBlob=null;livePayload=payload;
 const notice=modal.querySelector('[data-share-status]');
 if(notice)notice.textContent='Prévia pronta · '+w+' × '+h+' px';
}
function refresh(){
 if(!modal?.open)return;
 livePayload=null;
 const notice=modal.querySelector('[data-share-status]');
 if(notice)notice.textContent='Gerando prévia…';
 settingsUI();
 const data=fromContext();
 if(!data){modal.querySelector('[data-share-status]').textContent='Selecione um recorte com resultados.';return}
 draw(data).catch(error=>{modal.querySelector('[data-share-status]').textContent='Não foi possível gerar a imagem.';console.warn('[StatsShare]',error)});
}
async function blob(){
 if(!modal||!livePayload)throw Error('Prévia não disponível');
 const canvas=modal.querySelector('canvas');
 return new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Falha ao gerar PNG')),'image/png'));
}
function filename(){
 const name=(livePayload?.title||'estatisticas').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55);
 return 'central-free-fire-'+(name||'estatisticas')+'-'+state.format+'.png';
}
function downloadPNG(data){
 const url=URL.createObjectURL(data),a=document.createElement('a');
 a.href=url;a.download=filename();document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function message(text){
 const e=modal?.querySelector('[data-share-status]');if(e)e.textContent=text;
}
async function action(which){
 const btn=modal.querySelector('[data-share-action="'+which+'"]');
 if(btn)btn.disabled=true;
 try{
  if(which==='link'){
   await navigator.clipboard.writeText(shareLink());message('Link do recorte copiado!');return;
  }
  const png=await blob();
  if(which==='save'){downloadPNG(png);message('Imagem PNG salva.');return}
  if(which==='copy'){
   if(!navigator.clipboard?.write||typeof ClipboardItem!=='function')throw Error('Seu navegador não permite copiar imagens. Use Salvar.');
   await navigator.clipboard.write([new ClipboardItem({'image/png':png})]);
   message('Imagem copiada! Cole no aplicativo desejado.');return;
  }
  if(which==='share'){
   const file=new File([png],filename(),{type:'image/png'});
   if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:livePayload.title,text:'Central Free Fire',url:shareLink()});message('Compartilhamento realizado.');return}
   if(navigator.share){
    await navigator.share({title:livePayload.title,url:shareLink()});
    message('Este dispositivo compartilhou o link. Use Salvar para compartilhar o PNG.');return;
   }
   downloadPNG(png);message('O navegador não permite compartilhar diretamente. O PNG foi salvo.');
  }
 }catch(e){if(e.name!=='AbortError')message(e.message||'Não foi possível completar a ação.')}
 finally{if(btn)btn.disabled=false}
}
function prepareModal(){
 if(modal)return modal;
 modal=document.createElement('dialog');
 modal.id='cff-global-stats-share-dialog';modal.className='cff-stats-share-dialog';
 modal.setAttribute('aria-labelledby','cff-share-modal-title');
 modal.innerHTML=[
 '<div class="cff-stats-share-shell">',
  '<header class="cff-stats-share-header"><div><span>GERADOR DE CARDS</span><h2 id="cff-share-modal-title">Compartilhar estatísticas</h2></div><button type="button" data-share-close aria-label="Fechar">×</button></header>',
  '<div class="cff-stats-share-body"><section class="cff-stats-share-controls">',
   '<label>Tipo de card<select data-share-field="kind"><option value="summary">Resumo do recorte</option><option value="single">Estatística única</option><option value="team">Equipe</option><option value="player">Jogador</option><option value="top">Top 5 / ranking</option><option value="record">Recorde</option><option value="compare">Comparar equipes</option></select></label>',
   '<label class="cff-share-single-setting">Estatística<select data-share-field="single"><option value="points">Pontos</option><option value="kills">Abates</option><option value="booyahs">Booyahs</option><option value="drops">Quedas</option><option value="avgPoints">Média de pontos</option><option value="avgPosition">Colocação média</option></select></label>',
   '<label class="cff-share-entity-team">Equipe A<select data-share-field="team"></select></label>',
   '<label class="cff-share-team-b">Equipe B<select data-share-field="teamB"></select></label>',
   '<label class="cff-share-entity-player">Jogador<select data-share-field="player"></select></label>',
   '<div class="cff-share-top-settings"><label>Ranking<select data-share-field="topEntity"><option value="team">Equipes</option><option value="player">Jogadores</option><option value="contribution">Participação individual</option></select></label><label>Indicador<select data-share-field="metric"></select></label></div>',
   '<label class="cff-share-record-setting">Recorde<select data-share-field="record"></select></label>',
   '<fieldset><legend>Formato da imagem</legend><div class="cff-share-formats"><label><input type="radio" name="cff-share-format" value="stories">Stories <small>1080 × 1920</small></label><label><input type="radio" name="cff-share-format" value="feed">Feed 4:5 <small>1080 × 1350</small></label><label><input type="radio" name="cff-share-format" value="square">Quadrado <small>1080 × 1080</small></label><label><input type="radio" name="cff-share-format" value="wide">16:9 <small>1280 × 720</small></label></div></fieldset>',
   '<div class="cff-share-options-grid"><label>Tema<select data-share-field="theme"><option value="dark">Escuro</option><option value="light">Claro</option></select></label><label>Cor de destaque<select data-share-field="accent"><option value="blue">Azul CFF</option><option value="red">Vermelho</option><option value="gold">Dourado</option><option value="green">Verde</option></select></label></div>',
   '<label>Título personalizado<input type="text" maxlength="85" placeholder="Usar título automático" class="cff-share-custom-title" data-share-field="title"><small class="cff-share-title-help"></small></label>',
   '<div class="cff-share-switches"><label><input type="checkbox" data-share-field="showSubtitle"> Exibir subtítulo</label><label><input type="checkbox" data-share-field="showFilters"> Mostrar período/filtros</label><label><input type="checkbox" data-share-field="showImage"> Mostrar foto/escudo quando disponível</label></div>',
   '<p class="cff-share-locked">A logo Central Free Fire e o endereço centralfreefire.com.br aparecem em todos os cards.</p>',
  '</section>',
  '<section class="cff-stats-share-result"><div class="cff-stats-share-preview"><canvas role="img" aria-label="Prévia do card de estatísticas"></canvas></div><p role="status" data-share-status>Preparando imagem…</p><div class="cff-stats-share-actions"><button type="button" data-share-action="save">Salvar PNG</button><button type="button" data-share-action="share" class="primary">Compartilhar</button><button type="button" data-share-action="copy">Copiar imagem</button><button type="button" data-share-action="link">Copiar link do recorte</button></div></section>',
  '</div></div>'
 ].join('');
 document.body.append(modal);
 modal.querySelector('[data-share-close]').addEventListener('click',()=>modal.close());
 modal.addEventListener('click',ev=>{if(ev.target===modal)modal.close()});
 modal.addEventListener('close',()=>{renderSeq++;currentSource=null});
 modal.querySelectorAll('[data-share-field]').forEach(control=>{
  const prop=control.dataset.shareField;
  control.addEventListener(control.tagName==='INPUT'&&control.type==='text'?'input':'change',()=>{
   state[prop]=control.type==='checkbox'?control.checked:control.value;
   if(prop==='kind'||prop==='topEntity'||prop==='metric'||prop==='record'||prop==='single'||prop==='team'||prop==='player'||prop==='teamB')currentSource=null;
   if(prop==='topEntity')syncMetricOptions();
   refresh();
  });
 });
 modal.querySelectorAll('[name="cff-share-format"]').forEach(input=>input.addEventListener('change',()=>{
  if(input.checked){state.format=input.value;refresh()}
 }));
 modal.querySelectorAll('[data-share-action]').forEach(b=>b.addEventListener('click',()=>action(b.dataset.shareAction)));
 return modal;
}
function syncMetricOptions(){
 if(!modal)return;
 const entity=state.topEntity;
 const metrics=entity==='team'?['points','kills','booyahs','avgPoints','avgKills','avgPosition','top3','top3Rate','top12']:
 entity==='contribution'?['avgPartKills','avgPartDamage','avgPartAssists']:['kills','damage','assists','avgKills','avgDamage','avgAssists'];
 if(!metrics.includes(state.metric))state.metric=metrics[0];
 optionsFor(modal.querySelector('[data-share-field="metric"]'),metrics,v=>v,v=>LABELS[v],state.metric);
}
function open(source){
 if(!context)return;
 currentSource=source||null;
 const dlg=prepareModal();
 if(source?.kind)state.kind=source.kind;
 if(source?.kind==='single'&&source.metric)state.single=source.metric;
 if(source?.team)state.team=source.team;
 if(source?.player)state.player=source.player;
 if(source?.metric)state.metric=source.metric;
 if(source?.entity)state.topEntity=source.entity;
 if(source?.record)state.record=source.record[0]+'|'+source.record[1];
 state.title='';
 const teams=sorted(context.teams,'points');
 state.team=optionsFor(dlg.querySelector('[data-share-field="team"]'),teams,r=>r.team,r=>r.team,state.team);
 state.teamB=optionsFor(dlg.querySelector('[data-share-field="teamB"]'),teams,r=>r.team,r=>r.team,state.teamB&&state.teamB!==state.team?state.teamB:teams.find(x=>x.team!==state.team)?.team);
 state.player=optionsFor(dlg.querySelector('[data-share-field="player"]'),sorted(context.players,'kills'),r=>r.name,r=>r.name+' · '+r.team,state.player);
 optionsFor(dlg.querySelector('[data-share-field="record"]'),RECORDS,r=>r[0]+'|'+r[1],r=>r[2],state.record);
 syncMetricOptions();
 dlg.querySelectorAll('[data-share-field]').forEach(el=>{
  const prop=el.dataset.shareField;el.type==='checkbox'?el.checked=Boolean(state[prop]):el.value=String(state[prop]??'');
 });
 dlg.querySelector('[name="cff-share-format"][value="'+state.format+'"]').checked=true;
 dlg.showModal();
 refresh();
}
function shareButton(title,onClick,small){
 const b=document.createElement('button');b.type='button';
 b.className='cff-stats-share-trigger'+(small?' is-small':'');
 b.textContent=small?'↗':'↗ Compartilhar';
 b.setAttribute('aria-label',small?'Compartilhar '+title:'Gerar card e compartilhar '+title);
 b.title='Gerar imagem desta estatística';
 b.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();onClick()});
 return b;
}
function buildOpenSource(group,entry,title,row){
 const [id,scope,metric]=entry;
 if(group==='record')return {kind:'record',record:[scope,metric,title],row,title};
 if(row)return group==='team'?{kind:'team',row,team:row.team,metric:entry[1]}:{kind:'player',row,player:row.name,metric:entry[1]};
 return {kind:'top',entity:group==='contribution'?'contribution':group,metric,title};
}
function decorate(){
 if(!modelRoot||!context)return;
 const root=modelRoot;
 const filterHead=root.querySelector('#anchor-s2-filtros .ffws-global-panel-head');
 if(filterHead){
  const action=shareButton('o recorte da página',()=>open({kind:'summary'}));
  action.classList.add('cff-stats-share-main');filterHead.append(action);
 }
 root.querySelectorAll('#anchor-s2-resumo .ffws-global-stat-card').forEach((card,index)=>{
  const metric=['drops','points','kills','booyahs','avgPoints','avgPosition'][index];
  const title=card.querySelector('small')?.textContent||'Estatística';
  const btn=shareButton(title,()=>open(metric?{kind:'single',metric}:{kind:'summary'}),true);
  card.classList.add('cff-stats-share-card');card.append(btn);
 });
 GROUPS.forEach(([section,group,descs])=>{
  const heading=root.querySelector('#'+section);
  const list=heading?.nextElementSibling;
  if(!list?.classList.contains('grid-cards'))return;
  [...list.children].filter(el=>el.classList.contains('card')).forEach((card,index)=>{
   const def=descs[index];if(!def)return;
   const title=card.querySelector('h3')?.textContent?.trim()||'Estatística';
   const src=buildOpenSource(group,def,title);
   card.classList.add('cff-stats-share-card');
   const header=card.querySelector('h3');if(header)header.append(shareButton(title,()=>open(src),true));
   const metric=group==='record'?def[2]:def[1],source=group==='record'?def[1]:group;
   const candidates=sorted(dataRows(source),metric);
   const offset=Math.max(0,Number(window.__ffwsGlobalStatsPages?.[def[0]]||0))*4;
   const displayRows=candidates.slice(offset,offset+4);
   const listRows=[...card.children].filter(el=>el.tagName==='DIV'&&el.style.alignItems==='center'&&el.style.display==='grid');
   listRows.forEach((line,n)=>{
    const row=displayRows[n];if(!row)return;
    const label=row.name||row.team||title;
    line.classList.add('cff-stats-share-list-item');
    line.append(shareButton(label,()=>open(buildOpenSource(group,def,title,row)),true));
   });
  });
 });
 ['anchor-s2-ranking-medias','anchor-s2-ranking-totais'].forEach((id)=>{
  const panel=root.querySelector('#'+id),head=panel?.querySelector('.ffws-global-panel-head');
  if(!panel||!head)return;
  head.append(shareButton(id.endsWith('medias')?'ranking de médias':'ranking de totais',
   ()=>open({kind:'top',entity:'team',metric:id.endsWith('medias')?'avgPoints':'points'})));
  const ranking=sorted(context.teams,id.endsWith('medias')?'avgPoints':'points');
  [...panel.querySelectorAll('tbody tr')].forEach((tr,n)=>{
   const row=ranking[n];if(!row)return;
   const cell=tr.querySelector('td:last-child');if(!cell)return;
   cell.append(shareButton(row.team,()=>open({kind:'team',row,team:row.team,metric:id.endsWith('medias')?'avgPoints':'points'}),true));
  });
 });
}
function mount(root,model){
 if(!root||!model)return;
 context=model;modelRoot=root;
 // renderStats may finish before the lazy script load: avoid duplicate buttons.
 if(root.querySelector('.cff-stats-share-main'))return;
 decorate();
}
window.CFFGlobalStatsShare={mount,open};
})();