import {FORMATS,selectedRows,metricLabel,formatValue,dateText,STAT_LABELS,statText} from './ranking-share-model.mjs?v=20261020-cards-v5';
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
  const heading=options.template==='team'?'EQUIPE EM NÚMEROS':options.template==='compare'?'COMPARAÇÃO':options.template==='leader'?'EM DESTAQUE':data.title.toLocaleUpperCase('pt-BR');
  text(ctx,heading,margin,top+(wide?46:65),w-margin*2,wide?40:58);
  text(ctx,[data.event,data.stage].filter(Boolean).join(' · '),margin,top+(wide?77:107),w-margin*2,wide?20:25,MUTED);
  text(ctx,[options.template==='table'?(options.rowCount==='all'?'TABELA COMPLETA · '+rows.length+' EQUIPES':'TOP '+rows.length):options.template==='team'?'ESTATÍSTICAS DA EQUIPE':'RECORTE DO RANKING',data.updatedAt?'DADOS: '+dateText(data.updatedAt):''].filter(Boolean).join('  ·  '),margin,top+(wide?102:140),w-margin*2,wide?14:17,MUTED);
  const contentY=top+(wide?130:178),contentBottom=footerY-25,contentHeight=contentBottom-contentY;
  const getImage=row=>images.get(options.showPhotos&&data.kind==='players'?row.photo:options.showLogos?row.logo:'');
  if(options.template==='team') {
    const row=rows[0];if(!row)throw Error('Equipe sem dados para este recorte.');
    const width=w-margin*2,identityH=wide?75:Math.min(155,contentHeight*.24),logoSize=wide?62:identityH-22;
    const image=getImage(row),nameX=margin+(image?logoSize+22:0);
    picture(ctx,image,margin,contentY,logoSize,logoSize);
    text(ctx,row.name,nameX,contentY+(wide?36:60),width-(nameX-margin),wide?34:48);
    text(ctx,data.stage==='Geral'?'Etapas disputadas somadas':'Dados somente desta etapa',nameX,contentY+(wide?62:96),width-(nameX-margin),wide?16:22,MUTED);
    const keys=options.stats,columns=wide?Math.min(4,keys.length):Math.min(2,keys.length),count=Math.ceil(keys.length/columns),gap=wide?12:18,gridY=contentY+identityH,cellW=(width-gap*(columns-1))/columns,cellH=(contentBottom-gridY-gap*(count-1))/count;
    keys.forEach((key,i)=>{
      const x=margin+(i%columns)*(cellW+gap),y=gridY+Math.floor(i/columns)*(cellH+gap);
      box(ctx,x,y,cellW,cellH,'#111e32',i===0?options.accent:'#263b55');
      text(ctx,STAT_LABELS[key],x+20,y+Math.min(32,cellH*.32),cellW-40,wide?14:Math.min(22,cellH*.19),MUTED);
      stat(ctx,statText(row,key),x+20,y+cellH*.77,cellW-40,wide?Math.min(40,cellH*.43):Math.min(76,cellH*.43),i===0?options.accent:INK);
    });
  } else if(data.mode==='annual'&&options.template==='leader') {
    const row=rows[0];if(!row)throw Error('Escolha uma equipe para destacar.');
    const width=w-margin*2,labels=data.annualColumns||[],gap=wide?10:14;
    const detailH=labels.length?(wide?90:Math.min(190,contentHeight*.26)):0;
    const heroH=contentHeight-detailH-(labels.length?20:0),img=getImage(row);
    box(ctx,margin,contentY,width,heroH,'#101e32',options.accent);
    if(wide){
      const logoSize=Math.min(150,heroH*.72),max=width-(img?logoSize+80:60),left=margin+26;
      picture(ctx,img,w-margin-logoSize-24,contentY+(heroH-logoSize)/2,logoSize,logoSize);
      text(ctx,row.rank+'º NO RANKING ANUAL',left,contentY+heroH*.18,max,16,options.accent);
      stat(ctx,row.name,left,contentY+heroH*.4,max,36);
      stat(ctx,formatValue(row.points),left,contentY+heroH*.77,max,72,options.accent);
      text(ctx,'PONTOS CFF',left,contentY+heroH*.77+25,max,16,MUTED);
    }else{
      const logoSize=Math.min(165,heroH*.3),center=w/2;
      picture(ctx,img,center-logoSize/2,contentY+20,logoSize,logoSize);
      text(ctx,row.rank+'º NO RANKING ANUAL',center,contentY+heroH*(img?.44:.22),width-50,24,options.accent,'center');
      stat(ctx,row.name,center,contentY+heroH*(img?.55:.38),width-50,54,INK,'center');
      stat(ctx,formatValue(row.points),center,contentY+heroH*(img?.83:.75),width-50,116,options.accent,'center');
      text(ctx,'PONTOS CFF',center,contentY+heroH*(img?.83:.75)+38,width-50,24,MUTED,'center');
    }
    if(labels.length){
      const cellW=(width-gap*(labels.length-1))/labels.length,y=contentY+heroH+20;
      labels.forEach((label,i)=>{
        const x=margin+i*(cellW+gap);
        box(ctx,x,y,cellW,detailH,'#111e32','#263b55');
        text(ctx,label.toLocaleUpperCase('pt-BR'),x+cellW/2,y+detailH*.27,cellW-20,wide?13:20,MUTED,'center');
        stat(ctx,formatValue(row.annualValues[i]),x+cellW/2,y+detailH*.76,cellW-20,wide?32:52,INK,'center');
      });
    }
  } else if(data.mode==='annual') {
    const width=w-margin*2,labels=data.annualColumns||[],detail=labels.length>0,header=wide?28:40;
    const rowH=(contentHeight-header)/Math.max(1,rows.length),rankW=wide?34:46,teamW=detail?width*.34:width*.68,cellW=(width-teamW)/Math.max(1,labels.length+1);
    const positions=[...labels,'TOTAL'].map((label,i)=>({label,x:margin+teamW+cellW*(i+1)-12}));
    text(ctx,'#',margin+10,contentY+16,30,wide?11:15,MUTED);
    text(ctx,'EQUIPE',margin+rankW+12,contentY+16,teamW-rankW-20,wide?12:16,MUTED);
    positions.forEach(p=>text(ctx,p.label,p.x,contentY+16,cellW-12,wide?11:15,MUTED,'right'));
    rows.forEach((row,i)=>{
      const y=contentY+header+i*rowH,center=y+(rowH-5)/2,selected=data.rows.indexOf(row)===options.highlight;
      box(ctx,margin,y,width,rowH-5,selected?options.accent+'25':'#111e32',selected?options.accent:'#20304a');ctx.textBaseline='middle';
      stat(ctx,row.rank+'º',margin+10,center,rankW-5,Math.min(wide?19:29,rowH*.45),options.accent);
      const img=getImage(row),size=Math.min(wide?25:50,rowH*.63),nameX=margin+rankW+12+(img?size+10:0);
      picture(ctx,img,margin+rankW+12,center-size/2,size,size);
      stat(ctx,row.name,nameX,center,margin+teamW-nameX-12,Math.min(wide?18:29,rowH*.4));
      positions.forEach((p,j)=>stat(ctx,formatValue(j===labels.length?row.points:row.annualValues[j]),p.x,center,cellW-18,Math.min(wide?21:34,rowH*.45),j===labels.length?options.accent:INK,'right'));
      ctx.textBaseline='alphabetic';
    });
  } else if(options.template==='table') {
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
      const x=margin+i*(cw+gap),img=getImage(row),photoH=!wide&&img?Math.min(cw*.94,contentHeight*(contentHeight<700?.30:.38)):0,widePhoto=wide&&img?cw*.3:0,labelWidth=cw-48-(widePhoto?widePhoto+12:0);
      box(ctx,x,contentY,cw,contentHeight,'#101e32',i===0?options.accent:'#263b55');
      if(widePhoto)picture(ctx,img,x+cw-widePhoto-12,contentY+38,widePhoto,contentHeight-55);
      let y=contentY+30;
      text(ctx,row.rank+'º NO RANKING',x+24,y,cw-48,wide?14:19,options.accent);
      if(photoH){picture(ctx,img,x+24,y+15,cw-48,photoH);y+=photoH+32;}else y+=wide?34:52;
      text(ctx,row.name,x+24,y,labelWidth,wide?26:42);y+=wide?27:44;
      if(data.kind==='players'){text(ctx,row.team,x+24,y,labelWidth,wide?15:22,MUTED);y+=wide?26:46;}
      const statsY=contentBottom-(wide?36:146),valueY=wide?y+34:statsY-88,valueFont=wide?52:Math.min(108,Math.max(52,(valueY-y+20)/.8));
      stat(ctx,formatValue(row[data.metric]),x+24,valueY,labelWidth,valueFont,options.accent);
      text(ctx,metricLabel(data.metric),x+24,valueY+(wide?24:38),labelWidth,wide?14:23,MUTED);
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
