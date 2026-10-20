(() => {
  'use strict';
  if(window.__cffShareRankings)return;
  window.__cffShareRankings=true;
  const targets={
    'home-ranking-teams':{title:'CLASSIFICAÇÃO',primary:'PONTOS',secondary:'ABATES'},
    'home-ranking-kills':{title:'RANKING DE ABATES',primary:'ABATES',secondary:'QUEDAS'},
    'home-ranking-damage':{title:'RANKING DE DANO',primary:'DANO',secondary:'QUEDAS'},
    'home-ranking-assists':{title:'RANKING DE ASSISTÊNCIAS',primary:'ASSISTÊNCIAS',secondary:'QUEDAS'}
  };
  const sizes={feed:[1218,1291],story:[1080,1920]};
  let panel=null,canvas=null,select=null,status=null,active=null,logoPromise=null;
  const $=(selector,root=document)=>root.querySelector(selector);
  const getText=node=>String(node?.textContent||'').replace(/\s+/g,' ').trim();
  function rows(widget){
    return [...widget.querySelectorAll('tbody tr')].map(tr=>{
      const nums=[...tr.querySelectorAll('.home-rank-number')].map(getText);
      const name=getText($('.home-rank-main b',tr));
      const detail=getText($('.home-rank-main small',tr));
      return {place:getText($('.home-rank-pos',tr)),name,detail,value:nums[0]||'',extra:nums[1]||''};
    }).filter(row=>row.name&&row.value&&row.value!=='—').slice(0,6);
  }
  function pathRound(ctx,x,y,w,h,r){
    const rad=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rad,y);
    ctx.arcTo(x+w,y,x+w,y+h,rad);ctx.arcTo(x+w,y+h,x,y+h,rad);
    ctx.arcTo(x,y+h,x,y,rad);ctx.arcTo(x,y,x+w,y,rad);ctx.closePath();
  }
  function roundFill(ctx,x,y,w,h,r,color){pathRound(ctx,x,y,w,h,r);ctx.fillStyle=color;ctx.fill();}
  function trim(ctx,value,max){let v=String(value||'');if(ctx.measureText(v).width<=max)return v;while(v.length>1&&ctx.measureText(v+'…').width>max)v=v.slice(0,-1);return v+'…';}
  async function logo(){
    if(!logoPromise)logoPromise=new Promise(resolve=>{
      const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);
      img.src='/central%20free%20fire.webp';
    });return logoPromise;
  }
  function renderImage(data,format,brandImage){
    const [w,h]=sizes[format],c=document.createElement('canvas');c.width=w;c.height=h;
    const ctx=c.getContext('2d');if(!ctx)throw Error('Seu navegador não conseguiu criar o card.');
    const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#091926');bg.addColorStop(.58,'#0a111b');bg.addColorStop(1,'#080d17');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    const glow=ctx.createRadialGradient(w*.92,h*.17,20,w*.92,h*.17,w*.83);glow.addColorStop(0,'rgba(0,200,255,.18)');glow.addColorStop(1,'rgba(0,200,255,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#00c8ff';ctx.fillRect(0,0,w,12);
    const margin=64,avatar=90;
    roundFill(ctx,margin,66,avatar,avatar,18,'#152c40');
    if(brandImage){ctx.save();pathRound(ctx,margin+4,70,avatar-8,avatar-8,15);ctx.clip();ctx.drawImage(brandImage,margin+4,70,avatar-8,avatar-8);ctx.restore();}
    else{ctx.fillStyle='#00c8ff';ctx.font='900 44px Impact, Arial Narrow, sans-serif';ctx.fillText('CFF',margin+11,125);}
    ctx.fillStyle='#e7f7ff';ctx.font='900 35px Impact, Arial Narrow, sans-serif';ctx.fillText('CENTRAL FREE FIRE',margin+112,114);
    ctx.fillStyle='#89b3ca';ctx.font='700 22px Arial, sans-serif';ctx.fillText('DADOS DO COMPETITIVO',margin+114,148);
    ctx.fillStyle='#00c8ff';ctx.fillRect(margin,210,78,5);
    const headingY=format==='story'?302:270;
    ctx.fillStyle='#ffffff';ctx.font='900 66px Impact, Arial Narrow, sans-serif';
    ctx.fillText(trim(ctx,data.title,w-2*margin),margin,headingY);
    ctx.fillStyle='#b0cadc';ctx.font='700 25px Arial, sans-serif';
    ctx.fillText(trim(ctx,data.event,w-2*margin),margin,headingY+45);
    ctx.fillStyle='#65b8d3';ctx.font='700 19px Arial, sans-serif';
    const stamp='DADOS EXIBIDOS NO SITE • '+new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date());
    ctx.fillText(stamp,margin,headingY+82);
    const top=format==='story'?560:375;
    const rowHeight=format==='story'?137:108;
    ctx.textBaseline='middle';
    data.rows.forEach((item,i)=>{
      const y=top+i*rowHeight;
      roundFill(ctx,margin,y,w-margin*2,rowHeight-10,18,i===0?'#143d52':'#142334');
      ctx.strokeStyle=i===0?'#1581ad':'#2b3b4f';ctx.lineWidth=2;
      pathRound(ctx,margin,y,w-margin*2,rowHeight-10,18);ctx.stroke();
      ctx.fillStyle=i===0?'#00dcff':'#9aacc4';ctx.font='900 35px Impact, Arial Narrow, sans-serif';
      ctx.fillText(String(item.place||i+1).padStart(2,'0'),margin+24,y+(rowHeight-10)/2);
      const nameX=margin+110,available=w-nameX-250;
      ctx.fillStyle='#f3f8ff';ctx.font='900 33px Impact, Arial Narrow, sans-serif';
      ctx.fillText(trim(ctx,item.name,available),nameX,y+38);
      ctx.fillStyle='#9bb4ce';ctx.font='600 21px Arial, sans-serif';
      ctx.fillText(trim(ctx,item.detail,available),nameX,y+72);
      ctx.textAlign='right';ctx.fillStyle='#f4fbff';ctx.font='900 41px Impact, Arial Narrow, sans-serif';
      ctx.fillText(trim(ctx,item.value,170),w-margin-25,y+37);
      ctx.font='700 17px Arial, sans-serif';ctx.fillStyle='#70cade';
      ctx.fillText(data.primary,w-margin-25,y+73);
      ctx.textAlign='left';
    });
    ctx.textBaseline='alphabetic';
    const footer=top+6*rowHeight+(format==='story'?28:22);
    ctx.fillStyle='#284c66';ctx.fillRect(margin,footer,w-margin*2,2);
    ctx.fillStyle='#d4eef9';ctx.font='900 26px Impact, Arial Narrow, sans-serif';
    ctx.fillText('CENTRALFREEFIRE.COM.BR',margin,footer+47);
    ctx.fillStyle='#80a6bd';ctx.font='600 18px Arial, sans-serif';
    ctx.fillText('Compartilhe as estatísticas. Acompanhe o competitivo.',margin,footer+83);
    return c;
  }
  function capture(widget){
    const config=targets[widget.id],event=document.querySelector('[data-home-rankings-event]')?.dataset.homeRankingsEvent||'FREE FIRE COMPETITIVO';
    const renderedTitle=getText($('h3',widget)).replace(/^[^\p{L}\d]+/u,'');
    return {title:renderedTitle.toLocaleUpperCase('pt-BR')||config.title,
      event:String(event).trim()||'FREE FIRE COMPETITIVO',primary:config.primary,rows:rows(widget)};
  }
  async function draw(){
    if(!active||!panel)return;
    status.textContent='Gerando card…';
    try{
      const data=capture(active);
      if(!data.rows.length)throw Error('Este ranking ainda não tem resultados disponíveis.');
      canvas=renderImage(data,select.value,await logo());
      const preview=$('.cff-share-preview',panel);
      preview.replaceChildren(canvas);
      status.textContent='';
      $('[data-share-action="download"]',panel).disabled=false;
      $('[data-share-action="share"]',panel).disabled=false;
    }catch(error){
      canvas=null;$('.cff-share-preview',panel).replaceChildren();
      status.textContent=error.message;
      $('[data-share-action="download"]',panel).disabled=true;
      $('[data-share-action="share"]',panel).disabled=true;
    }
  }
  function filename(){return 'central-free-fire-'+active.id.replace('home-ranking-','')+'-'+select.value+'.png';}
  function imageBlob(){return new Promise((resolve,reject)=>{if(!canvas)return reject(Error('Card indisponível.'));canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Falha ao gerar PNG.')),'image/png');});}
  async function download(){
    const blob=await imageBlob();const object=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=object;a.download=filename();document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(object),5000);
    status.textContent='Download do PNG iniciado.';
  }
  async function share(){
    const blob=await imageBlob();
    const file=new File([blob],filename(),{type:'image/png'});
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
      try{await navigator.share({files:[file],title:'Estatísticas | Central Free Fire',text:'Dados do competitivo em centralfreefire.com.br'});}
      catch(error){if(error.name!=='AbortError')throw error;}
      return;
    }
    await download();
    status.textContent='Imagem baixada. Agora é só compartilhar no Instagram, WhatsApp ou onde preferir.';
  }
  function ensureDialog(){
    if(panel)return;
    panel=document.createElement('dialog');panel.className='cff-share-dialog';
    panel.setAttribute('aria-labelledby','cff-share-dialog-title');
    panel.innerHTML='<div class="cff-share-top"><div><small>ESTATÍSTICAS COMPARTILHÁVEIS</small><h2 id="cff-share-dialog-title">Criar card CFF</h2></div><button type="button" class="cff-share-close" data-share-action="close" aria-label="Fechar">×</button></div><label class="cff-share-format">Formato <select aria-label="Formato da imagem"><option value="feed">Feed • 1218 × 1291</option><option value="story">Stories • 1080 × 1920</option></select></label><div class="cff-share-preview"></div><p class="cff-share-status" aria-live="polite"></p><div class="cff-share-actions"><button type="button" data-share-action="download">↓ Baixar PNG</button><button type="button" data-share-action="share">↗ Compartilhar</button></div>';
    document.body.append(panel);select=$('select',panel);status=$('.cff-share-status',panel);
    select.addEventListener('change',draw);
    $('[data-share-action="close"]',panel).addEventListener('click',()=>panel.close());
    $('[data-share-action="download"]',panel).addEventListener('click',()=>download().catch(e=>status.textContent=e.message));
    $('[data-share-action="share"]',panel).addEventListener('click',()=>share().catch(e=>status.textContent=e.message));
    panel.addEventListener('click',event=>{if(event.target===panel)panel.close();});
  }
  function boot(){
    Object.keys(targets).forEach(id=>{
      const widget=document.getElementById(id);
      if(!widget||widget.querySelector('.cff-ranking-share-trigger'))return;
      const button=document.createElement('button');button.type='button';
      button.className='cff-ranking-share-trigger';
      button.title='Criar imagem deste ranking';button.setAttribute('aria-label','Criar card compartilhável: '+targets[id].title);
      button.textContent='↗ Card';
      button.addEventListener('click',()=>{active=widget;ensureDialog();select.value='feed';panel.showModal();draw();});
      widget.append(button);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
