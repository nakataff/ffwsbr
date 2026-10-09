(() => {
  'use strict';
  const api=()=>window.CFF_SHOWCASE_DATA;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v.split('-').reverse().join('/') : '';
  const safeImage=v=>/^data:image\/(webp|png|jpeg);base64,/i.test(v||'')||/^https?:\/\//i.test(v||'') ? v : '';
  const defaults={title:'Codiguinhos para resgatar',columns:3,names:true,dates:true,status:true,remaining:false,light:false};
  const dlg=document.createElement('dialog');dlg.className='showcase-dialog';dlg.setAttribute('aria-label','Mostruário de codiguinhos');
  dlg.innerHTML=`<div class="showcase-bar"><h2>Mostruário para print</h2><button data-action="clean">Modo print</button><button class="secondary" data-action="close">← Voltar ao controle</button></div>
    <div class="showcase-options"><label>Título <input type="text" data-setting="title" maxlength="100"></label><label>Colunas <select data-setting="columns"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>${[['names','Nomes'],['dates','Datas'],['status','Status'],['remaining','Quantidade restante'],['light','Fundo claro']].map(([key,label])=>`<label><input type="checkbox" data-setting="${key}">${label}</label>`).join('')}<span>O modo print esconde os itens ocultos e os controles. Esc volta à edição.</span></div>
    <div class="showcase-board"><h2 class="showcase-heading"></h2><div class="showcase-grid"></div></div><button class="showcase-exit secondary" data-action="edit">← Voltar à edição</button>`;
  document.body.append(dlg);let clean=false;
  function read(){const d=api()?.read();return d?{...d,settings:{...defaults,...d.settings}}:null;}
  function render(){
    if(!dlg.open)return;const d=read();if(!d){close();return;}
    const s=d.settings;dlg.classList.toggle('showcase-clean',clean);dlg.classList.toggle('showcase-light',s.light);dlg.style.setProperty('--showcase-cols',Math.max(1,Math.min(4,Number(s.columns)||3)));
    dlg.querySelector('.showcase-heading').textContent=s.title;
    dlg.querySelectorAll('[data-setting]').forEach(el=>{if(el.type==='checkbox')el.checked=!!s[el.dataset.setting];else el.value=s[el.dataset.setting];});
    const items=d.items.filter(i=>!clean||!i.meta.hidden);
    dlg.querySelector('.showcase-grid').innerHTML=items.length?items.map(i=>{
      const m=i.meta,image=safeImage(i.image),status={available:'Disponível para resgatar',waiting:'Em breve',expired:'Encerrado',empty:'Esgotado'}[i.status]||'Disponível';
      const range=m.date?date(m.date):[date(i.start),date(i.end)].filter(Boolean).join(' — ');
      return `<article class="showcase-card ${m.hidden?'is-hidden':''} ${m.featured?'is-featured':''}" data-id="${esc(i.id)}">${image?`<img class="showcase-image" src="${esc(image)}" alt="${esc(m.title||i.name)}">`:'<div class="showcase-placeholder">Imagem do codiguinho</div>'}<div class="showcase-info">${s.names?`<h3>${esc(m.title||i.name)}</h3>`:''}${s.dates&&range?`<p>${esc(range)}</p>`:''}${m.description?`<p data-description>${esc(m.description)}</p>`:''}${s.status?`<span class="showcase-status ${esc(i.status)}">${status}</span>`:''}${s.remaining?`<p>${i.remaining} para resgatar</p>`:''}</div><div class="showcase-editor"><label><input type="checkbox" data-field="hidden" ${m.hidden?'checked':''}> Ocultar no print</label><label><input type="checkbox" data-field="featured" ${m.featured?'checked':''}> Destacar</label><input data-field="title" type="text" maxlength="100" value="${esc(m.title||'')}" placeholder="Título opcional" aria-label="Título do card"><label>Data do card <input type="date" data-field="date" value="${esc(m.date||'')}"></label><textarea data-field="description" maxlength="250" placeholder="Descrição curta (opcional)" aria-label="Descrição do card">${esc(m.description||'')}</textarea><div class="showcase-editor-actions"><button class="small secondary" data-action="photo">Trocar imagem</button><button class="small secondary" data-action="up" ${d.items[0]?.id===i.id?'disabled':''} aria-label="Mover para cima">↑</button><button class="small secondary" data-action="down" ${d.items.at(-1)?.id===i.id?'disabled':''} aria-label="Mover para baixo">↓</button></div></div></article>`;
    }).join(''):'<div class="showcase-empty">Nenhum codiguinho para mostrar. Adicione um pacote no controle ou volte à edição para mostrar os ocultos.</div>';
  }
  function close(){clean=false;dlg.close();dlg.querySelector('.showcase-grid').replaceChildren();}
  dlg.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action,id=b.closest('[data-id]')?.dataset.id;
    if(a==='close')close();else if(a==='clean'||a==='edit'){clean=a==='clean';render();dlg.scrollTop=0;}else if(a==='photo'){api().photo(id);}else if(a==='up'||a==='down'){const d=read(),pos=d.items.findIndex(i=>i.id===id)+1;api().order(id,pos+(a==='up'?-1:1));render();}
  });
  function update(e){
    const el=e.target,key=el.dataset.setting,field=el.dataset.field,d=read();if(!d)return;
    const value=el.type==='checkbox'?el.checked:el.value;
    if(key){api().settings({...d.settings,[key]:key==='columns'?Number(value):value});}
    if(field){const id=el.closest('[data-id]').dataset.id,i=d.items.find(i=>i.id===id);if(i)api().item(id,{...i.meta,[field]:value});}
    if(key==='title'){dlg.querySelector('.showcase-heading').textContent=value;}
    else if(field==='title'||field==='description'){
      const card=el.closest('[data-id]'),i=read().items.find(i=>i.id===card.dataset.id),info=card.querySelector('.showcase-info');
      if(field==='title'){const h=info.querySelector('h3');if(h)h.textContent=value||i.name;}
      else {let p=info.querySelector('[data-description]');if(!p){p=document.createElement('p');p.dataset.description='';info.append(p);}p.textContent=value;}
    }else if(key||field)render();
  }
  dlg.addEventListener('change',update);
  dlg.addEventListener('input',e=>{if(e.target.type==='text'||e.target.tagName==='TEXTAREA')update(e);});
  dlg.addEventListener('cancel',e=>{if(clean){e.preventDefault();clean=false;render();}else close();});
  window.CFF_SHOWCASE={open(){if(!read())return;clean=false;dlg.showModal();render();},close,refresh:render};
})();
