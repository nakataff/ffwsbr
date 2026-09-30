(() => {
  'use strict';
  if (!/admin-sorteio-comunidade\.html$/i.test(location.pathname)) return;
  if (window.__CFF_ADMIN_PRIVATE_GIVEAWAY_V1__) return;
  window.__CFF_ADMIN_PRIVATE_GIVEAWAY_V1__ = true;

  const PUBLIC_BASE='https://centralfreefire.com.br/sorteio-comunidade/';
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const fmt=ms=>ms?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(ms)):'—';
  const toLocal=ms=>{
    if(!ms)return'';
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));
    const o=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    return `${o.year}-${o.month}-${o.day}T${o.hour}:${o.minute}`;
  };
  const parseBrt=value=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(value||''))?Date.parse(`${value}:00-03:00`):0;

  let db=null,refFn=null,onValueFn=null,setFn=null,updateFn=null;
  let items=new Map(),currentId='',entries=[],stopEntries=null,stopPrivate=null;

  function message(text,type=''){
    const el=$('#private-message');if(!el)return;
    el.textContent=text||'';el.className=`admin-message${type?` is-${type}`:''}`;
  }

  function randomHex(bytes=16){
    const arr=new Uint8Array(bytes);crypto.getRandomValues(arr);
    return [...arr].map(v=>v.toString(16).padStart(2,'0')).join('');
  }

  function randomId(){
    for(let i=0;i<100;i++){
      const arr=new Uint32Array(1);crypto.getRandomValues(arr);
      const id=String(1000000+(arr[0]%9000000));
      if(!items.has(id))return id;
    }
    return String(Date.now()).slice(-7).padStart(7,'1');
  }

  async function sha256(value){
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value||'')));
    return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
  }

  function fieldsFromForm(){
    return {
      name:Boolean($('#private-field-name')?.checked),
      id:Boolean($('#private-field-id')?.checked),
      instagram:Boolean($('#private-field-instagram')?.checked),
      nickname:Boolean($('#private-field-nickname')?.checked)
    };
  }

  function selectedItem(){return currentId?items.get(currentId)||null:null}
  function privateLink(id=currentId){return id?PUBLIC_BASE+id:''}

  function setTab(name){
    const target=name==='private'?'private':'public';
    document.querySelectorAll('[data-give-admin-tab]').forEach(btn=>btn.classList.toggle('is-active',btn.dataset.giveAdminTab===target));
    document.querySelectorAll('[data-give-admin-panel]').forEach(panel=>{panel.hidden=panel.dataset.giveAdminPanel!==target;});
    try{sessionStorage.setItem('cff-give-admin-tab',target);}catch(_){}
  }

  function wireTabs(){
    document.querySelectorAll('[data-give-admin-tab]').forEach(btn=>btn.addEventListener('click',()=>setTab(btn.dataset.giveAdminTab)));
    let initial='public';try{initial=sessionStorage.getItem('cff-give-admin-tab')||'public';}catch(_){}
    setTab(initial);
  }

  function resetForm(){
    currentId='';
    $('#private-form')?.reset();
    if($('#private-field-name'))$('#private-field-name').checked=true;
    if($('#private-field-instagram'))$('#private-field-instagram').checked=true;
    const end=new Date(Date.now()+3*60*60*1000);
    if($('#private-end'))$('#private-end').value=toLocal(end);
    if($('#private-select'))$('#private-select').value='';
    const status=$('#private-status');if(status){status.textContent='NOVO';status.classList.add('closed');}
    const box=$('#private-link-box');if(box)box.hidden=true;
    stopEntriesWatch();
    entries=[];renderEntries();
    message('Crie um link privado e compartilhe somente com quem deve participar.');
  }

  function fillForm(item){
    if(!item)return resetForm();
    currentId=String(item.id||'');
    $('#private-title').value=item.title||'';
    $('#private-description').value=item.description||'';
    $('#private-end').value=toLocal(item.endsAt);
    $('#private-password').value='';
    const fields=item.fields||{};
    $('#private-field-name').checked=Boolean(fields.name);
    $('#private-field-id').checked=Boolean(fields.id);
    $('#private-field-instagram').checked=Boolean(fields.instagram);
    $('#private-field-nickname').checked=Boolean(fields.nickname);
    const open=Boolean(item.active&&Number(item.endsAt)>Date.now());
    const status=$('#private-status');if(status){status.textContent=open?'ABERTO':'ENCERRADO';status.classList.toggle('closed',!open);}
    const link=privateLink(currentId),box=$('#private-link-box');
    if($('#private-link'))$('#private-link').textContent=link;
    if(box)box.hidden=false;
    if($('#private-select'))$('#private-select').value=currentId;
    watchEntries(currentId);
    message(open?'Sorteio privado carregado.':'Este sorteio privado está encerrado.');
  }

  function renderSelect(){
    const select=$('#private-select');if(!select)return;
    const list=[...items.values()].sort((a,b)=>Number(b.updatedAt||b.createdAt||0)-Number(a.updatedAt||a.createdAt||0));
    select.innerHTML='<option value="">Selecione um sorteio privado</option>'+list.map(item=>{
      const open=Boolean(item.active&&Number(item.endsAt)>Date.now());
      return `<option value="${esc(item.id)}">${esc(item.title||'Sorteio privado')} • #${esc(item.id)} • ${open?'ABERTO':'ENCERRADO'}</option>`;
    }).join('');
    if(currentId&&items.has(currentId))select.value=currentId;
  }

  function stopEntriesWatch(){
    if(stopEntries){stopEntries();stopEntries=null;}
  }

  function watchEntries(id){
    stopEntriesWatch();entries=[];renderEntries();if(!id||!db)return;
    stopEntries=onValueFn(refFn(db,`communityGiveaways/privateEntries/${id}`),snap=>{
      const raw=snap.val()||{};
      entries=Object.values(raw).map(x=>({
        name:String(x?.name||''),
        id:String(x?.id||''),
        instagram:String(x?.instagram||'').replace(/^@+/,''),
        nickname:String(x?.nickname||''),
        createdAt:Number(x?.createdAt||0)
      })).sort((a,b)=>a.createdAt-b.createdAt);
      renderEntries();
    });
  }

  function renderEntries(){
    const body=$('#private-tbody');if(!body)return;
    if($('#private-total'))$('#private-total').textContent=String(entries.length);
    if(!currentId){body.innerHTML='<tr><td colspan="6"><div class="give-empty">Nenhum sorteio privado selecionado.</div></td></tr>';return;}
    if(!entries.length){body.innerHTML='<tr><td colspan="6"><div class="give-empty">Ainda não há participantes neste sorteio.</div></td></tr>';return;}
    body.innerHTML=entries.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.name||'—')}</td><td>${esc(x.id||'—')}</td><td>${x.instagram?'@'+esc(x.instagram):'—'}</td><td>${esc(x.nickname||'—')}</td><td><span class="private-muted">${esc(fmt(x.createdAt))}</span></td></tr>`).join('');
  }

  async function savePrivate(event){
    event.preventDefault();if(!db)return;
    const title=String($('#private-title')?.value||'').trim();
    const description=String($('#private-description')?.value||'').trim();
    const endsAt=parseBrt($('#private-end')?.value);
    const password=String($('#private-password')?.value||'');
    const fields=fieldsFromForm();
    if(title.length<3)return message('Digite um título válido.','error');
    if(!endsAt||endsAt<=Date.now())return message('O encerramento precisa estar no futuro.','error');
    if(!Object.values(fields).some(Boolean))return message('Escolha pelo menos um campo para identificar os participantes.','error');

    const existing=selectedItem();
    const id=currentId||randomId();
    let passwordSalt=String(existing?.passwordSalt||''),passwordHash=String(existing?.passwordHash||'');
    if(!existing&&password.length<3)return message('Escolha uma senha com pelo menos 3 caracteres.','error');
    if(password){
      if(password.length<3)return message('A senha precisa ter pelo menos 3 caracteres.','error');
      passwordSalt=randomHex(16);
      passwordHash=await sha256(`${passwordSalt}:${password}`);
    }
    if(!passwordSalt||!passwordHash)return message('Defina uma senha para o sorteio privado.','error');

    const data={
      id,title,description,endsAt,active:true,fields,passwordSalt,passwordHash,
      createdAt:Number(existing?.createdAt||Date.now()),updatedAt:Date.now()
    };
    try{
      await setFn(refFn(db,`communityGiveaways/private/${id}`),data);
      currentId=id;
      if($('#private-password'))$('#private-password').value='';
      message(`Sorteio privado salvo. Link: ${privateLink(id)}`,'success');
    }catch(err){console.error(err);message('Não foi possível salvar o sorteio privado.','error');}
  }

  async function closePrivate(){
    if(!db||!currentId)return message('Selecione um sorteio privado.','error');
    try{
      await updateFn(refFn(db,`communityGiveaways/private/${currentId}`),{active:false,endsAt:Math.min(Number(selectedItem()?.endsAt||Date.now()),Date.now()),updatedAt:Date.now()});
      message('Sorteio privado encerrado.','success');
    }catch(err){console.error(err);message('Não foi possível encerrar.','error');}
  }

  async function copyLink(){
    const link=privateLink();if(!link)return message('Salve o sorteio primeiro.','error');
    try{await navigator.clipboard.writeText(link);}catch(_){const a=document.createElement('textarea');a.value=link;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();}
    message('Link privado copiado.','success');
  }

  async function copyEntries(){
    if(!entries.length)return message('Ainda não há participantes para copiar.','error');
    const lines=entries.map(x=>{
      const parts=[];
      if(x.name)parts.push(x.name);
      if(x.id)parts.push(`ID: ${x.id}`);
      if(x.instagram)parts.push(`@${x.instagram}`);
      if(x.nickname)parts.push(x.nickname);
      return parts.join(' | ');
    }).join('\n');
    try{await navigator.clipboard.writeText(lines);}catch(_){const a=document.createElement('textarea');a.value=lines;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();}
    message(`${entries.length} participantes copiados.`,'success');
  }

  function bind(){
    wireTabs();
    $('#private-form')?.addEventListener('submit',savePrivate);
    $('#private-new')?.addEventListener('click',resetForm);
    $('#private-close')?.addEventListener('click',closePrivate);
    $('#private-copy-link')?.addEventListener('click',copyLink);
    $('#private-copy-entries')?.addEventListener('click',copyEntries);
    $('#private-select')?.addEventListener('change',e=>{
      const id=String(e.target.value||'');currentId=id;
      if(id&&items.has(id))fillForm(items.get(id));else resetForm();
    });
    resetForm();
  }

  async function connect(){
    const [{getApps,getApp},{getDatabase,ref,onValue,set,update}]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js')
    ]);
    if(!getApps().length)return;
    db=getDatabase(getApp());refFn=ref;onValueFn=onValue;setFn=set;updateFn=update;
    stopPrivate=onValue(ref(db,'communityGiveaways/private'),snap=>{
      const raw=snap.val()||{};
      items=new Map(Object.values(raw).filter(x=>x?.id).map(x=>[String(x.id),x]));
      renderSelect();
      if(currentId&&items.has(currentId))fillForm(items.get(currentId));
    });
  }

  function boot(){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      const app=$('#give-app');
      if(app&&!app.hidden){
        clearInterval(timer);
        bind();
        connect().catch(err=>{console.error('[Private giveaway admin]',err);message('Falha ao conectar os sorteios privados.','error');});
      }else if(tries>120)clearInterval(timer);
    },100);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
