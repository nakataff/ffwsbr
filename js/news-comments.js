(function(){
  'use strict';

  const VERSION='20260909-news-comments-v4';
  const MAX_COMMENTS=50;
  const COOLDOWN_MS=30000;
  const NAME_KEY='cff_comment_name_v1';
  const LAST_SEND_KEY='cff_comment_last_send_v1';
  const LAST_TEXT_KEY='cff_comment_last_text_v1';

  function pathSlug(){
    const path=location.pathname||'';
    let match=path.match(/^\/noticias\/([^/]+)\/?$/i);
    if(match&&match[1]) return decodeURIComponent(match[1]);
    match=path.match(/^\/noticia\/([^/]+)\/?$/i);
    if(match&&match[1]) return decodeURIComponent(match[1]);
    const params=new URLSearchParams(location.search);
    return String(params.get('id')||params.get('slug')||'').trim();
  }

  function isNewsPage(){
    return /\/noticia\.html$/i.test(location.pathname)||/^\/noticias\/[^/]+\/?$/i.test(location.pathname)||/^\/noticia\/[^/]+\/?$/i.test(location.pathname);
  }
  if(!isNewsPage()) return;

  const config=window.CFF_CONFIG||{};
  const databaseURL=String(config.firebase&&config.firebase.databaseURL||'').replace(/\/$/,'');
  const slug=String(pathSlug()||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,160);
  if(!databaseURL||!slug) return;

  function clean(value){
    return String(value==null?'':value).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
  }
  function normalize(value){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  }
  function randomId(){
    const bytes=new Uint8Array(12);crypto.getRandomValues(bytes);return 'c_'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  }
  function clientId(){
    const key='cff_comment_client_v1';
    try{let value=localStorage.getItem(key);if(!value){value=randomId().replace(/^c_/,'u_');localStorage.setItem(key,value)}return value}catch(_){return 'u_'+Math.random().toString(36).slice(2,14)}
  }
  function formatDate(value){
    const d=new Date(Number(value||0));
    if(Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace(',',' •');
  }

  function linkifyTextNode(node){
    const value=node.nodeValue||'';
    const urlRegex=/https?:\/\/[^\s<>"']+/gi;
    if(!urlRegex.test(value)) return;
    urlRegex.lastIndex=0;
    const frag=document.createDocumentFragment();
    let last=0,match;
    while((match=urlRegex.exec(value))){
      let raw=match[0];
      let trailing='';
      while(/[.,;:!?)]$/.test(raw)){trailing=raw.slice(-1)+trailing;raw=raw.slice(0,-1)}
      frag.appendChild(document.createTextNode(value.slice(last,match.index)));
      const a=document.createElement('a');
      a.href=raw;
      a.target='_blank';
      a.rel='noopener noreferrer';
      a.textContent=raw;
      a.style.overflowWrap='anywhere';
      frag.appendChild(a);
      if(trailing) frag.appendChild(document.createTextNode(trailing));
      last=match.index+match[0].length;
    }
    frag.appendChild(document.createTextNode(value.slice(last)));
    node.parentNode.replaceChild(frag,node);
  }

  function linkifyArticle(){
    const body=document.querySelector('.news-body');
    if(!body) return false;
    const walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT,{acceptNode(node){
      const parent=node.parentElement;
      if(!parent||parent.closest('a,script,style')) return NodeFilter.FILTER_REJECT;
      return /https?:\/\//i.test(node.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }});
    const nodes=[];let node;
    while((node=walker.nextNode())) nodes.push(node);
    nodes.forEach(linkifyTextNode);
    return true;
  }

  if(!linkifyArticle()){
    const target=document.getElementById('noticia-dinamica')||document.body;
    if(target){
      const observer=new MutationObserver(function(){if(linkifyArticle()) observer.disconnect()});
      observer.observe(target,{childList:true,subtree:true});
      setTimeout(function(){observer.disconnect();linkifyArticle()},10000);
    }
  }

  const BLOCKED_PATTERNS=[
    /\b(fdp|vtnc|vsf)\b/i,
    /\b(filho\s+da\s+puta|filha\s+da\s+puta)\b/i,
    /\b(vai\s+tomar\s+no\s+cu|tomar\s+no\s+cu)\b/i,
    /\b(porra|caralho|buceta|arrombado|arrombada)\b/i,
    /\b(retardado|retardada|mongoloide)\b/i,
    /\b(viado|viadinho|bicha)\b/i,
    /\b(macaco|macaca)\b/i
  ];

  function moderationReason(text){
    const value=String(text||'').trim();
    const normalized=normalize(value);
    if(BLOCKED_PATTERNS.some(rx=>rx.test(normalized))) return 'Seu comentário contém um termo bloqueado pelo filtro.';
    const urls=value.match(/https?:\/\//gi)||[];
    if(urls.length>1) return 'Evite enviar vários links no mesmo comentário.';
    const mentions=value.match(/@[a-z0-9._]{2,}/gi)||[];
    if(mentions.length>5) return 'Muitas marcações foram detectadas. Reduza a quantidade de @.';
    if(/(.)\1{8,}/i.test(normalized)) return 'O comentário parece conter spam ou repetição excessiva.';
    if(/\b(\w+)(?:\s+\1){5,}\b/i.test(normalized)) return 'O comentário parece conter spam ou repetição excessiva.';
    const letters=(value.match(/[A-Za-zÀ-ÿ]/g)||[]).length;
    const uppers=(value.match(/[A-ZÀ-Ý]/g)||[]).length;
    if(letters>=35&&uppers/letters>.9) return 'Evite escrever o comentário inteiro em letras maiúsculas.';
    try{
      const previous=normalize(localStorage.getItem(LAST_TEXT_KEY)||'');
      if(previous&&previous===normalized) return 'Você já enviou esse mesmo comentário.';
    }catch(_){}
    return '';
  }

  function injectStyles(){
    if(document.getElementById('cff-news-comments-css')) return;
    const style=document.createElement('style');
    style.id='cff-news-comments-css';
    style.textContent=`
      .cff-comments{margin:28px 0 0;border:1px solid rgba(0,200,255,.18);border-radius:18px;background:rgba(9,17,31,.86);overflow:hidden;color:#f4f9ff}
      .cff-comments-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid rgba(0,200,255,.14);background:linear-gradient(135deg,rgba(0,200,255,.09),rgba(255,255,255,.018))}
      .cff-comments-kicker{color:#00c8ff;font-size:.72rem;font-weight:1000;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:3px}
      .cff-comments-title{margin:0;color:#fff;font-size:1.12rem;line-height:1.1;font-weight:1000;text-transform:uppercase}
      .cff-comments-count{display:inline-flex;align-items:center;justify-content:center;min-width:42px;height:32px;padding:0 10px;border:1px solid rgba(0,200,255,.25);border-radius:999px;background:rgba(0,200,255,.07);color:#7edfff;font-size:.8rem;font-weight:1000}
      .cff-comments-body{padding:18px 20px 20px}
      .cff-comment-form{display:grid;grid-template-columns:1fr;gap:12px;padding:16px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.025)}
      .cff-comment-field{display:grid;gap:6px;min-width:0}.cff-comment-field label{color:#9bb9d8;font-size:.69rem;font-weight:950;letter-spacing:.65px;text-transform:uppercase}
      .cff-comment-input,.cff-comment-text{width:100%;min-width:0;border:1px solid #253650;border-radius:11px;background:#08111f;color:#fff;outline:none;padding:11px 12px;font:inherit}
      .cff-comment-input{height:44px}.cff-comment-text{height:96px;min-height:96px;max-height:220px;resize:vertical;line-height:1.45}
      .cff-comment-input:focus,.cff-comment-text:focus{border-color:#00c8ff;box-shadow:0 0 0 3px rgba(0,200,255,.1)}
      .cff-comment-actions{display:flex;align-items:center;justify-content:space-between;gap:14px}
      .cff-comment-submit{min-height:44px;border:0;border-radius:11px;padding:0 20px;background:#00c8ff;color:#00131b;font-weight:1000;white-space:nowrap;cursor:pointer}.cff-comment-submit:disabled{opacity:.48;cursor:not-allowed}
      .cff-comment-note{min-height:17px;color:#7897b8;font-size:.72rem;line-height:1.4}.cff-comment-note.is-error{color:#ff8f9b}.cff-comment-note.is-success{color:#72e6ad}
      .cff-comments-list{display:grid;gap:10px;margin-top:15px}.cff-comment{padding:13px 14px;border:1px solid rgba(255,255,255,.075);border-radius:13px;background:#0b1422}
      .cff-comment-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}.cff-comment-author{min-width:0;color:#fff;font-size:.9rem;font-weight:1000;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cff-comment-time{flex:0 0 auto;color:#6f8dac;font-size:.66rem;font-weight:800}.cff-comment-text-body{color:#dcecff;font-size:.91rem;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}.cff-comments-empty,.cff-comments-loading{padding:18px 8px 5px;color:#7897b8;text-align:center;font-size:.82rem;font-weight:800}
      @media(max-width:760px){.cff-comments{margin-top:20px;border-radius:15px}.cff-comments-head{padding:14px 15px}.cff-comments-body{padding:14px}.cff-comment-form{padding:12px}.cff-comment-actions{align-items:stretch;flex-direction:column}.cff-comment-submit{width:100%}.cff-comment-text{height:110px;min-height:110px}.cff-comment-top{align-items:flex-start;flex-direction:column;gap:2px}}
    `;
    document.head.appendChild(style);
  }

  function build(){
    if(document.getElementById('cff-news-comments')) return document.getElementById('cff-news-comments');
    const section=document.createElement('section');
    section.id='cff-news-comments';section.className='cff-comments';
    section.innerHTML='<div class="cff-comments-head"><div><div class="cff-comments-kicker">Comunidade</div><h2 class="cff-comments-title">Comentários</h2></div><span class="cff-comments-count" id="cff-comments-count">0</span></div><div class="cff-comments-body"><form class="cff-comment-form" id="cff-comment-form"><div class="cff-comment-field"><label for="cff-comment-name">Nome ou @</label><input class="cff-comment-input" id="cff-comment-name" maxlength="36" autocomplete="nickname" placeholder="@seuinstagram" required></div><div class="cff-comment-field"><label for="cff-comment-text">Comentário</label><textarea class="cff-comment-text" id="cff-comment-text" maxlength="600" placeholder="Comente sobre a notícia..." required></textarea></div><div class="cff-comment-actions"><div class="cff-comment-note" id="cff-comment-note">Comentários públicos • filtro automático de spam e termos ofensivos</div><button class="cff-comment-submit" id="cff-comment-submit" type="submit">COMENTAR</button></div></form><div class="cff-comments-list" id="cff-comments-list"><div class="cff-comments-loading">Carregando comentários...</div></div></div>';
    return section;
  }

  function mount(section){
    const more=document.querySelector('.more-news');
    if(more&&more.parentNode){more.parentNode.insertBefore(section,more);return true}
    const dynamic=document.getElementById('noticia-dinamica');
    if(dynamic&&dynamic.parentNode){dynamic.insertAdjacentElement('afterend',section);return true}
    const article=document.querySelector('article.article-shell,article.news-article,article');
    if(article&&article.parentNode){article.insertAdjacentElement('afterend',section);return true}
    return false;
  }

  injectStyles();
  const section=build();
  if(!mount(section)){
    let attempts=0;const timer=setInterval(()=>{if(mount(section)||++attempts>50) clearInterval(timer)},200);
  }

  const els={form:section.querySelector('#cff-comment-form'),name:section.querySelector('#cff-comment-name'),text:section.querySelector('#cff-comment-text'),submit:section.querySelector('#cff-comment-submit'),note:section.querySelector('#cff-comment-note'),list:section.querySelector('#cff-comments-list'),count:section.querySelector('#cff-comments-count')};
  try{els.name.value=String(localStorage.getItem(NAME_KEY)||'').slice(0,36)}catch(_){}
  const endpoint=databaseURL+'/newsComments/'+encodeURIComponent(slug);
  function setNote(text,type){els.note.textContent=text;els.note.classList.toggle('is-error',type==='error');els.note.classList.toggle('is-success',type==='success')}
  function render(rows){
    els.count.textContent=String(rows.length);els.list.innerHTML='';
    if(!rows.length){els.list.innerHTML='<div class="cff-comments-empty">Seja o primeiro a comentar.</div>';return}
    rows.forEach(item=>{const card=document.createElement('article');card.className='cff-comment';const top=document.createElement('div');top.className='cff-comment-top';const author=document.createElement('strong');author.className='cff-comment-author';author.textContent=item.name||'Visitante';const time=document.createElement('time');time.className='cff-comment-time';time.textContent=formatDate(item.createdAt);const text=document.createElement('div');text.className='cff-comment-text-body';text.textContent=item.text||'';top.append(author,time);card.append(top,text);els.list.appendChild(card)});
  }
  async function load(){
    try{const response=await fetch(endpoint+'.json?orderBy=%22createdAt%22&limitToLast='+MAX_COMMENTS,{cache:'no-store'});if(!response.ok) throw new Error('HTTP '+response.status);const raw=await response.json();const rows=Object.values(raw||{}).map(item=>({name:clean(item&&item.name),text:String(item&&item.text||'').trim(),createdAt:Number(item&&item.createdAt||0)})).filter(item=>item.text).sort((a,b)=>b.createdAt-a.createdAt);render(rows)}catch(_){els.list.innerHTML='<div class="cff-comments-empty">Comentários indisponíveis no momento.</div>'}
  }
  els.form.addEventListener('submit',async event=>{
    event.preventDefault();
    const name=clean(els.name.value).slice(0,36),text=String(els.text.value||'').replace(/\r/g,'').trim().slice(0,600);
    if(name.length<2) return setNote('Digite um nome ou @ válido.','error');
    if(text.length<2) return setNote('Escreva um comentário antes de enviar.','error');
    const blocked=moderationReason(text);
    if(blocked) return setNote(blocked,'error');
    try{const last=Number(localStorage.getItem(LAST_SEND_KEY)||0),wait=COOLDOWN_MS-(Date.now()-last);if(wait>0) return setNote('Aguarde '+Math.ceil(wait/1000)+'s para comentar novamente.','error')}catch(_){}
    els.submit.disabled=true;setNote('Enviando comentário...');
    try{const response=await fetch(endpoint+'/'+encodeURIComponent(randomId())+'.json',{method:'PUT',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,text,createdAt:Date.now(),clientId:clientId()})});if(!response.ok) throw new Error('HTTP '+response.status);try{localStorage.setItem(NAME_KEY,name);localStorage.setItem(LAST_SEND_KEY,String(Date.now()));localStorage.setItem(LAST_TEXT_KEY,text)}catch(_){}els.text.value='';setNote('Comentário publicado!','success');await load()}catch(_){setNote('Não foi possível publicar agora. Tente novamente em instantes.','error')}finally{els.submit.disabled=false}
  });
  load();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) load()});
  window.CFF_NEWS_COMMENTS_VERSION=VERSION;
})();
