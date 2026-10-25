import {FORMATS,normalizePayload,normalizeOptions,rememberedOptions,selectedRows,STAT_LABELS,statValue,captionFor,captionWithLink,cardFilename} from './ranking-share-model.mjs?v=20261020-cards-v6';
import {renderRankingCard} from './ranking-share-renderer.mjs?v=20261020-cards-v6';
const VERSION='20261020-cards-v6',PREFS='cff_ranking_card_style_v2';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const images=new Map();let cssPromise,qrPromise,dialog,active,options,canvas,file,drawSequence=0,captionDirty=false,opener,views=[];
const $=s=>dialog.querySelector(s);
function styles(){
  if(cssPromise)return cssPromise;
  cssPromise=new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/css/ranking-share-cards.css?v='+VERSION;link.onload=resolve;link.onerror=()=>{link.remove();cssPromise=null;reject(Error('Não foi possível carregar o editor. Tente novamente.'));};document.head.append(link);});
  return cssPromise;
}
export function localImagePath(src){
  const raw=String(src||'');if(!raw||/[:\\]|^\/\//.test(raw)||raw.split('/').includes('..'))return '';
  return '/'+raw.replace(/^\//,'');
}
function loadImage(src){
  if(images.has(src))return images.get(src);
  const workerLogo=/^https:\/\/cff-camp-notifications\.nakataffb4\.workers\.dev\/careers\/logo\/[0-9a-f-]{36}$/i.test(String(src||''));
  const path=workerLogo?src:localImagePath(src);if(!path)return Promise.resolve(null);
  const promise=new Promise(resolve=>{const img=new Image();const timer=setTimeout(()=>finish(null),5000);let done=false;
    function finish(result){if(done)return;done=true;clearTimeout(timer);resolve(result);}
    img.decoding='async';if(workerLogo)img.crossOrigin='anonymous';img.onload=()=>finish(img);img.onerror=()=>finish(null);img.src=path;
  });images.set(src,promise);return promise;
}
function qrGenerator(){
  if(window.qrcode)return Promise.resolve(window.qrcode);
  if(qrPromise)return qrPromise;
  qrPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/js/vendor/qrcode-generator.js?v=1.4.4';script.onload=()=>window.qrcode?resolve(window.qrcode):reject(Error('QR Code indisponível.'));script.onerror=()=>{script.remove();qrPromise=null;reject(Error('Não foi possível carregar o QR Code. Desmarque a opção para continuar.'));};document.head.append(script);});return qrPromise;
}
function readPreferences(){try{return JSON.parse(localStorage.getItem(PREFS)||'{}');}catch(_){return {};}}
function savePreferences(){try{localStorage.setItem(PREFS,JSON.stringify(rememberedOptions(options)));}catch(_){}}
function message(text,error=false){$('.cff-card-status').textContent=text;$('.cff-card-status').classList.toggle('is-error',error);}
function setBusy(busy){dialog.setAttribute('aria-busy',String(busy));dialog.querySelectorAll('[data-card-export]').forEach(b=>b.disabled=busy||!file);}
function fieldOptions(){return active.rows.map((r,i)=>`<option value="${i}">${r.rank}º ${esc(r.name)}</option>`).join('');}
function fieldVisibility(){
  $('[data-card-table-only]').hidden=options.template!=='table';
  $('[data-card-first]').hidden=['table','team'].includes(options.template);
  $('[data-card-second]').hidden=options.template!=='compare';
  $('[data-card-photo-option]').hidden=active.kind!=='players';
  $('[name="highlight"]').querySelectorAll('option').forEach(o=>o.disabled=Number(o.value)>=Math.min(options.rowCount==='all'?active.rows.length:options.rowCount,active.rows.length));
  $('[name="accent"]').value=options.accent;
  $('[data-card-stats]').hidden=options.template!=='team';
  $('[data-card-stats]').innerHTML='<legend>Dados no card</legend>'+Object.entries(STAT_LABELS).map(([key,label])=>`<label class="cff-card-check"><input type="checkbox" data-card-stat="${key}"${options.stats.includes(key)?' checked':''}${statValue(active.rows[options.first]||{},key)==null?' disabled':''}> ${esc(label)}${statValue(active.rows[options.first]||{},key)==null?' · indisponível':''}</label>`).join('');
  $('[data-card-context]').textContent=[active.event,active.stage].filter(Boolean).join(' · ');
}
function syncFields(){
  for(const [key,value]of Object.entries(options)){const input=$(`[name="${key}"]`);if(input){if(input.type==='checkbox')input.checked=value;else input.value=String(value);}}
  fieldVisibility();
}
function changeStep(step){
  dialog.querySelectorAll('[data-card-step]').forEach(b=>{const active=b.dataset.cardStep===step;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
  dialog.querySelectorAll('[data-card-panel]').forEach(p=>p.hidden=p.dataset.cardPanel!==step);
}
function ensureDialog(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.className='cff-card-dialog';dialog.setAttribute('aria-labelledby','cff-card-title');
  dialog.innerHTML=`<header class="cff-card-header"><div><small>ESTATÍSTICAS COMPARTILHÁVEIS</small><h2 id="cff-card-title">Criar card CFF</h2><p data-card-context></p></div><button type="button" class="cff-card-close" data-card-action="close" aria-label="Fechar editor de card">×</button></header><div class="cff-card-body"><section class="cff-card-controls"><div class="cff-card-steps" role="tablist" aria-label="Etapas do editor">${[['model','Modelo'],['style','Personalizar'],['caption','Legenda']].map(([id,label],i)=>`<button type="button" role="tab" id="cff-card-step-${id}" aria-controls="cff-card-panel-${id}" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-card-step="${id}">${i+1}. ${label}</button>`).join('')}</div><section role="tabpanel" id="cff-card-panel-model" aria-labelledby="cff-card-step-model" data-card-panel="model"><label data-card-view hidden>Etapa<select name="view"></select></label><label>Modelo<select name="template"><option value="table">Ranking em tabela</option><option value="leader">Destaque individual</option><option value="compare">Comparar dois</option><option value="team">Equipe em números</option></select></label><label>Formato<select name="format">${Object.entries(FORMATS).map(([key,f])=>`<option value="${key}">${f.label} · ${f.width} × ${f.height}</option>`).join('')}</select></label><div data-card-table-only><label>Posições no card<select name="rowCount"><option value="3">Top 3</option><option value="5">Top 5</option><option value="10">Top 10</option><option value="all">Todos os times</option></select></label><label>Destacar uma linha<select name="highlight"></select></label></div><label data-card-first>Primeiro destaque<select name="first"></select></label><label data-card-second>Segundo destaque<select name="second"></select></label><fieldset class="cff-card-stat-fields" data-card-stats hidden></fieldset><p class="cff-card-hint">A etapa e os números são os mesmos do recorte aberto no site.</p></section><section role="tabpanel" id="cff-card-panel-style" aria-labelledby="cff-card-step-style" data-card-panel="style" hidden><label>Tema<select name="theme"><option value="cff">Central Free Fire</option><option value="tournament">Competição</option><option value="team">Equipe em destaque</option><option value="custom">Cor personalizada</option></select></label><label class="cff-card-color">Cor do destaque<input type="color" name="accent" value="#00c8ff"></label><label class="cff-card-check"><input type="checkbox" name="showLogos" checked> Logos das equipes</label><label class="cff-card-check" data-card-photo-option><input type="checkbox" name="showPhotos"> Fotos dos jogadores</label><label class="cff-card-check"><input type="checkbox" name="showQR"> QR Code para este recorte</label><p class="cff-card-hint">Seu estilo fica salvo neste aparelho. A marca CFF acompanha todos os cards.</p></section><section role="tabpanel" id="cff-card-panel-caption" aria-labelledby="cff-card-step-caption" data-card-panel="caption" hidden><label>Legenda para compartilhar<textarea name="caption" rows="10" maxlength="2500"></textarea></label><button type="button" class="cff-card-text-button" data-card-action="reset-caption">Restaurar legenda sugerida</button><button type="button" class="cff-card-text-button" data-card-action="copy-link">Copiar só o link</button><p class="cff-card-hint">O link abre esta mesma etapa. Você pode ajustar a legenda antes de copiar.</p></section></section><section class="cff-card-preview-area" aria-label="Prévia do card"><div class="cff-card-preview"></div><p class="cff-card-preview-note">Imagem pronta para postar · marca e fonte incluídas</p></section></div><footer class="cff-card-footer"><p class="cff-card-status" role="status" aria-live="polite"></p><div class="cff-card-actions"><button type="button" data-card-action="copy-caption">Copiar legenda + link</button><button type="button" data-card-action="download" data-card-export disabled>Baixar PNG</button><button type="button" data-card-action="share" data-card-export disabled>Compartilhar</button></div></footer>`;
  document.body.append(dialog);
  dialog.addEventListener('click',event=>{const b=event.target.closest('button');if(b?.dataset.cardStep){changeStep(b.dataset.cardStep);return;}if(b?.dataset.cardAction)action(b.dataset.cardAction);if(event.target===dialog)dialog.close();});
  dialog.addEventListener('change',event=>{
    const input=event.target;
    if(input.dataset.cardStat){const stats=[...dialog.querySelectorAll('[data-card-stat]:checked')].map(i=>i.dataset.cardStat);options=normalizeOptions({...options,stats},active);syncFields();savePreferences();refresh();return;}
    if(input.name==='view'){const view=views.find(v=>v.id===input.value);if(!view)return;active=view.data;options=normalizeOptions(options,active);syncFields();refresh();return;}
    if(!input.name||input.name==='caption')return;
    const next={...options,[input.name]:input.type==='checkbox'?input.checked:input.value};
    if(input.name==='accent')next.theme='custom';options=normalizeOptions(next,active);syncFields();savePreferences();refresh();
  });
  dialog.addEventListener('input',event=>{if(event.target.name==='caption')captionDirty=true;});
  dialog.addEventListener('close',()=>{++drawSequence;file=null;opener?.focus?.();});
  dialog.addEventListener('keydown',event=>{
    if(!event.target.matches('[data-card-step]')||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const buttons=[...dialog.querySelectorAll('[data-card-step]')],i=buttons.indexOf(event.target),n=event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
    changeStep(buttons[n].dataset.cardStep);buttons[n].focus();
  });
}
async function refresh(){
  const seq=++drawSequence,data=active,style={...options};file=null;setBusy(true);message('Preparando a imagem…');
  if(!captionDirty)$('[name="caption"]').value=captionFor(data,style);
  const paths=new Set(['/central free fire.webp']);
  for(const row of selectedRows(data,style)){if(style.showLogos&&row.logo)paths.add(row.logo);if(style.showPhotos&&data.kind==='players'&&row.photo)paths.add(row.photo);}
  try{
    const assets=new Map(await Promise.all([...paths].map(async p=>[p,await loadImage(p)])));
    let qr=null;if(style.showQR){const generator=await qrGenerator();qr=generator(0,'M');qr.addData(data.url);qr.make();}
    if(seq!==drawSequence||!dialog.open)return;
    const next=renderRankingCard(document.createElement('canvas'),data,style,{images:assets,qr});
    const blob=await new Promise((resolve,reject)=>next.toBlob(b=>b?resolve(b):reject(Error('Não foi possível salvar a imagem.')),'image/png'));
    if(seq!==drawSequence||!dialog.open)return;
    canvas=next;file=new File([blob],cardFilename(data,style),{type:'image/png'});canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${data.title}, ${data.event}, ${data.stage}`);
    $('.cff-card-preview').replaceChildren(canvas);message(`${canvas.width} × ${canvas.height} · ${Math.max(1,Math.round(blob.size/1024))} KB · pronto para compartilhar`);
  }catch(error){if(seq===drawSequence&&dialog.open)message(error.message||'Não foi possível gerar o card. Tente outro formato.',true);}
  finally{if(seq===drawSequence)setBusy(false);}
}
function download(){
  if(!file)return;const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);message('PNG baixado. A legenda está no botão “Copiar legenda + link”.');
}
async function copy(text){
  if(!navigator.clipboard?.writeText)throw Error('Copie o texto pelo campo da legenda neste navegador.');
  try{await navigator.clipboard.writeText(text);message('Copiado!');}catch(_){changeStep('caption');$('[name="caption"]').focus();$('[name="caption"]').select();throw Error('Selecione e copie a legenda pelo campo de texto.');}
}
async function action(type){
  try{
    if(type==='close')return dialog.close();
    if(type==='reset-caption'){captionDirty=false;$('[name="caption"]').value=captionFor(active,options);return;}
    if(type==='copy-link')return await copy(active.url);
    const caption=captionWithLink($('[name="caption"]').value,active);
    if(type==='copy-caption')return await copy(caption);
    if(type==='download')return download();
    if(type==='share'&&file){
      if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:active.title+' | Central Free Fire',text:caption});message('Compartilhamento concluído.');}
      else{download();message('Imagem baixada. Copie a legenda e envie pelo aplicativo que preferir.');}
    }
  }catch(error){if(error.name!=='AbortError')message(error.message||'Não foi possível compartilhar. Tente baixar o PNG.',true);}
}
export async function openRankingCard(payload){
  views=(Array.isArray(payload.views)?payload.views:[]).slice(0,4).map(v=>({id:String(v.id),data:normalizePayload(v)})).filter(v=>v.data.rows.length);
  const chosen=views.find(v=>v.id===payload.viewId)||views[0],data=chosen?.data||normalizePayload(payload);if(!data.rows.length)throw Error('Este recorte ainda não tem resultados.');
  await styles();ensureDialog();opener=document.activeElement;active=data;options=normalizeOptions(readPreferences(),active);captionDirty=false;file=null;
  $('[data-card-context]').textContent=[data.event,data.stage].filter(Boolean).join(' · ');
  $('[name="first"]').innerHTML=fieldOptions();$('[name="second"]').innerHTML=fieldOptions();
  $('[name="highlight"]').innerHTML='<option value="-1">Nenhuma</option>'+fieldOptions();
  $('[name="rowCount"]').querySelectorAll('option').forEach(o=>{o.hidden=o.value==='all'&&(data.kind!=='teams'||data.mode==='annual');o.textContent=o.value==='all'?'Todos os times · '+data.rows.length:'Top '+Math.min(Number(o.value),data.rows.length);});
  $('[data-card-view]').firstChild.textContent=data.mode==='annual'?'Visualização':'Etapa';
  $('[data-card-view]').hidden=views.length<2;$('[name="view"]').innerHTML=views.map(v=>`<option value="${esc(v.id)}">${esc(v.data.stage)}</option>`).join('');$('[name="view"]').value=chosen?.id||'';
  $('[name="template"]').querySelectorAll('option').forEach(o=>{o.hidden=data.mode==='annual'?!['table','leader'].includes(o.value):data.mode==='team'?o.value!=='team':o.value==='team';o.disabled=o.hidden;});
  $('[name="template"]').disabled=data.mode==='team';
  $('[name="template"] option[value="leader"]').textContent=data.mode==='annual'?'Equipe em destaque':'Destaque individual';
  $('[data-card-first]').firstChild.textContent=data.mode==='annual'?'Equipe em destaque':'Primeiro destaque';
  $('[name="template"] option[value="compare"]').disabled=data.rows.length<2;
  $('[data-card-panel="model"] .cff-card-hint').textContent=data.mode==='annual'?'Escolha uma equipe no destaque ou até 10 equipes na tabela. O link abre o ranking completo.':'A etapa e os números são os mesmos do recorte aberto no site.';
  syncFields();changeStep('model');$('.cff-card-preview').replaceChildren();if(!dialog.open)dialog.showModal();await refresh();
}
