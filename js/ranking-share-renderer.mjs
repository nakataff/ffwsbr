import {FORMATS,selectedRows,metricLabel,formatValue,dateText} from './ranking-share-model.mjs?v=20261020-cards-v2';
const INK='#f3f6fb',MUTED='#9bafc8';
function rounded(ctx,x,y,w,h,r=12){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function box(ctx,x,y,w,h,fill,stroke){rounded(ctx,x,y,w,h);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}}
function font(ctx,size,bold=true){ctx.font=`${bold?'800':'500'} ${size}px Arial, sans-serif`;}
function text(ctx,value,x,y,max,size=26,color=INK,align='left'){
  font(ctx,size);ctx.fillStyle=color;ctx.textAlign=align;let s=String(value??'');
  while(s.length>1&&ctx.measureText(s).width>max)s=s.slice(0,-2)+'…';ctx.fillText(s,x,y);ctx.textAlign='left';
}
function stat(ctx,value,x,y,max,size=26,color=INK,align='left'){font(ctx,size);while(size>10&&ctx.measureText(String(value)).width>max){size--;font(ctx,size);}text(ctx,value,x,y,max,size,color,align);}
function picture(ctx,img,x,y,w,h,cover=false){
  if(!img)return;const scale=cover?Math.max(w/img.width,h/img.height):Math.min(w/img.width,h/img.height);
  ctx.save();rounded(ctx,x,y,w,h,10);ctx.clip();ctx.drawImage(img,x+(w-img.width*scale)/2,y+(h-img.height*scale)/2,img.width*scale,img.height*scale);ctx.restore();
}
export function drawQR(ctx,qr,x,y,size){
  if(!qr)return;const count=qr.getModuleCount(),scale=Math.max(1,Math.floor(size/(count+8))),outer=(count+8)*scale;
  ctx.fillStyle='#fff';ctx.fillRect(x,y,outer,outer);ctx.fillStyle='#08101b';
  for(let r=0;r<count;r++)for(let c=0;c<count;c++)if(qr.isDark(r,c))ctx.fillRect(x+(c+4)*scale,y+(r+4)*scale,scale,scale);
}
export function renderRankingCard(canvas,data,options,assets={}) {
  const {width:w,height:h}=FORMATS[options.format];canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Este navegador não conseguiu gerar a imagem.');
  const images=assets.images||new Map(),rows=selectedRows(data,options),wide=options.format==='wide',story=options.format==='story';
  const margin=Math.round(w*(story?.095:.05)),top=wide?38:story?132:58;
  const bottom=Math.round(h*(story?.75:options.format==='feed'?.85:.92));
  const footerHeight=options.showQR?126:76,footerY=bottom-footerHeight;
  const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#0c1a2e');bg.addColorStop(1,'#080d19');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  const glow=ctx.createRadialGradient(w*.9,0,5,w*.9,0,w);glow.addColorStop(0,options.accent+'20');glow.addColorStop(1,options.accent+'00');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  ctx.fillStyle=options.accent;ctx.fillRect(0,0,w,7);
  text(ctx,'CENTRAL FREE FIRE · ESTATÍSTICAS',margin,top,w-margin*2,wide?16:20,options.accent);
  const heading=options.template==='compare'?'COMPARAÇÃO':options.template==='leader'?'EM DESTAQUE':data.title.toLocaleUpperCase('pt-BR');
  text(ctx,heading,margin,top+(wide?46:65),w-margin*2,wide?40:58);
  text(ctx,[data.event,data.stage].filter(Boolean).join(' · '),margin,top+(wide?77:107),w-margin*2,wide?20:25,MUTED);
  text(ctx,[options.template==='table'?'TOP '+rows.length:'RECORTE DO RANKING',data.updatedAt?'DADOS: '+dateText(data.updatedAt):''].filter(Boolean).join('  ·  '),margin,top+(wide?102:140),w-margin*2,wide?14:17,MUTED);
  const contentY=top+(wide?130:178),contentBottom=footerY-25,contentHeight=contentBottom-contentY;
  const getImage=row=>images.get(options.showPhotos&&data.kind==='players'?row.photo:options.showLogos?row.logo:'');
  if(options.template==='table') {
    const columns=wide&&rows.length>5?2:1,gap=28,colW=(w-margin*2-gap*(columns-1))/columns;
    const groups=Array.from({length:columns},(_,col)=>rows.slice(col*Math.ceil(rows.length/columns),(col+1)*Math.ceil(rows.length/columns)));
    groups.forEach((group,col)=>{
      const left=margin+col*(colW+gap),right=left+colW,header=wide?24:34;
      const rowH=(contentHeight-header)/Math.max(1,group.length),rankWidth=wide?46:rows.length<=5?66:52;
      const primaryX=right-(wide?85:150),secondaryX=right-16;
      text(ctx,'#',left+14,contentY+16,40,wide?12:16,MUTED);
      text(ctx,data.kind==='players'?'JOGADOR / EQUIPE':'EQUIPE',left+rankWidth+16,contentY+16,primaryX-left-100,wide?12:16,MUTED);
      text(ctx,metricLabel(data.metric),primaryX,contentY+16,110,wide?12:16,MUTED,'right');
      text(ctx,data.kind==='teams'?'ABATES':'QUEDAS',secondaryX,contentY+16,75,wide?12:16,MUTED,'right');
      group.forEach(row=>{
        const i=group.indexOf(row),y=contentY+header+i*rowH,selected=data.rows.indexOf(row)===options.highlight;
        box(ctx,left,y,colW,rowH-5,selected?options.accent+'25':'#111e32',selected?options.accent:'#20304a');
        const center=y+(rowH-5)/2;ctx.textBaseline='middle';
        stat(ctx,row.rank+'º',left+14,center,rankWidth-6,Math.min(wide?25:40,rowH*.5),options.accent);
        const img=getImage(row),imageSize=Math.min(wide?26:options.showPhotos?110:80,rowH*.65),nameX=left+rankWidth+16+(img?imageSize+12:0);
        picture(ctx,img,left+rankWidth+16,center-imageSize/2,imageSize,imageSize,options.showPhotos&&data.kind==='players');
        const detail=data.kind==='players'&&row.team&&rowH>=53&&!wide;
        text(ctx,row.name,nameX,detail?center-rowH*.12:center,primaryX-nameX-25,wide?20:Math.min(52,rowH*.42));
        if(detail)text(ctx,row.team,nameX,center+rowH*.2,primaryX-nameX-25,Math.min(24,rowH*.22),MUTED);
        stat(ctx,formatValue(row[data.metric]),primaryX,center,wide?70:145,wide?24:Math.min(64,rowH*.5),selected?options.accent:INK,'right');
        stat(ctx,formatValue(data.kind==='teams'?row.kills:row.matches),secondaryX,center,wide?60:100,wide?21:Math.min(44,rowH*.4),MUTED,'right');
        ctx.textBaseline='alphabetic';
      });
    });
  } else if(options.template==='leader') {
    const row=rows[0];if(!row)throw Error('Nenhum resultado para compartilhar.');
    const image=getImage(row),photoWidth=wide?260:w*.38;
    box(ctx,margin,contentY,w-margin*2,contentHeight,'#101e32','#263b55');
    if(image)picture(ctx,image,w-margin-photoWidth-16,contentY+10,photoWidth,contentHeight-20, false);
    const left=margin+30,max=w-margin*2-60-(image?photoWidth:0),center=contentY+contentHeight*.4;
    text(ctx,row.rank+'º NO RANKING',left,contentY+38,max,wide?16:22,options.accent);
    text(ctx,row.name,left,center-(wide?45:70),max,wide?32:54);
    if(data.kind==='players')text(ctx,row.team,left,center-(wide?10:30),max,wide?18:24,MUTED);
    stat(ctx,formatValue(row[data.metric]),left,center+(wide?44:110),max,wide?66:136,options.accent);
    text(ctx,metricLabel(data.metric),left,center+(wide?72:151),max,wide?16:23,MUTED);
    const stats=data.kind==='teams'?`${formatValue(row.kills)} abates · ${formatValue(row.booyahs)} Booyahs`:`${formatValue(row.matches)} quedas · ${row.matches?(row.kills/row.matches).toLocaleString('pt-BR',{maximumFractionDigits:2,minimumFractionDigits:2}):'0'} K/Q`;
    text(ctx,stats,left,contentBottom-25,max,wide?17:23,MUTED);
  } else {
    const gap=20,cw=(w-margin*2-gap)/2;
    rows.forEach((row,i)=>{
      const x=margin+i*(cw+gap),img=getImage(row),photoH=!wide&&img?Math.min(cw*.94,contentHeight*(contentHeight<700?.30:.38)):0;
      box(ctx,x,contentY,cw,contentHeight,'#101e32',i===0?options.accent:'#263b55');
      let y=contentY+30;
      text(ctx,row.rank+'º NO RANKING',x+24,y,cw-48,wide?14:19,options.accent);
      if(photoH){picture(ctx,img,x+24,y+15,cw-48,photoH);y+=photoH+32;}else y+=wide?34:52;
      text(ctx,row.name,x+24,y,cw-48,wide?26:42);y+=wide?27:44;
      if(data.kind==='players'){text(ctx,row.team,x+24,y,cw-48,wide?15:22,MUTED);y+=wide?26:46;}
      const statsY=contentBottom-(wide?36:146),valueY=wide?y+34:statsY-88,valueFont=wide?52:Math.min(108,Math.max(52,(valueY-y+20)/.8));
      stat(ctx,formatValue(row[data.metric]),x+24,valueY,cw-48,valueFont,options.accent);
      text(ctx,metricLabel(data.metric),x+24,valueY+(wide?24:38),cw-48,wide?14:23,MUTED);
      const stats=data.kind==='teams'?[['ABATES',row.kills],['BOOYAHS',row.booyahs],['QUEDAS',row.matches]]:[['QUEDAS',row.matches],['DANO',row.damage],['ASSISTÊNCIAS',row.assists]];
      if(!wide)stats.forEach(([label,value],j)=>{text(ctx,label,x+24,statsY+j*43,cw*.6,20,MUTED);stat(ctx,formatValue(value),x+cw-24,statsY+j*43,cw*.4,26,INK,'right');});
      else text(ctx,`${formatValue(row.matches)} quedas`,x+24,statsY+13,cw-48,16,MUTED);
    });
  }
  // Permanent branding; it remains inside the safe area for Stories and Feed.
  ctx.fillStyle='#2b4058';ctx.fillRect(margin,footerY,w-margin*2,1);
  const brand=images.get('/central free fire.webp'),logoSize=wide?46:64,brandX=margin+(brand?logoSize+14:0),brandY=footerY+15;
  picture(ctx,brand,margin,brandY,logoSize,logoSize);
  const space=w-margin-brandX-(options.showQR?140:0);
  text(ctx,'CENTRAL FREE FIRE',brandX,brandY+(wide?17:23),space,wide?18:28,INK);
  text(ctx,'centralfreefire.com.br',brandX,brandY+(wide?40:51),space,wide?16:24,MUTED);
  if(options.showQR)drawQR(ctx,assets.qr,w-margin-116,footerY+8,116);
  return canvas;
}
