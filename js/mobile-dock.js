(()=>{
'use strict';
if(window.CFFMobileDock)return;
const bar=document.querySelector('.cff-bottom-navigation');
if(!bar)return;
const KEY='cff-mobile-dock-v1';
const iconPaths={
 home:'<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c4 5 4 13 0 18M12 3c-4 5-4 13 0 18"/>',
 chart:'<path d="M4 20V11m6 9V5m6 15v-8m4 8H2"/>',
 users:'<path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m12 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17 3a4 4 0 0 1 0 8"/>',
 trophy:'<path d="M8 21h8M12 17v4M7 4h10v7a5 5 0 0 1-10 0V4ZM7 6H4v3a4 4 0 0 0 4 4m9-7h3v3a4 4 0 0 1-4 4"/>',
 star:'<path d="m12 2 3 6.5 7 .9-5 4.9 1.2 7L12 18l-6.2 3.3 1.2-7-5-4.9 7-.9z"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
 fire:'<path d="M12 22c5 0 8-3.4 8-8.1 0-3.3-2.1-6.5-4-8.1.1 3-1.4 4.2-2 4.5C13.8 7.2 11.8 4.7 10 2 10 7 4 10.2 4 14c0 4.7 3 8 8 8Z"/>',
 bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
 medal:'<circle cx="12" cy="15" r="6"/><path d="m8 10-3-8h5l2 6 2-6h5l-3 8"/>',
 book:'<path d="M4 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4zM20 4h-7a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h7z"/>',
 swords:'<path d="M4 4 20 20M20 4 4 20M4 4l3 1-2 2m15-3-3 1 2 2"/>',
 gift:'<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M2 9h20M12 9v12M12 9c-9 0-8-7-4-7 3 0 4 5 4 7Zm0 0c9 0 8-7 4-7-3 0-4 5-4 7Z"/>',
 coins:'<circle cx="12" cy="12" r="9"/><path d="M15 8c-1-2-6-2-6 1s6 1 6 5-6 4-7 1m4-10v14"/>'
};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons=Object.keys(iconPaths);
const iconNames={home:'Casa',globe:'Globo',chart:'Gráfico',users:'Pessoas',trophy:'Troféu',star:'Estrela',calendar:'Calendário',fire:'Chama',bolt:'Raio',medal:'Medalha',book:'Livro',swords:'Confronto',gift:'Presente',coins:'Moedas'};
const groups=[
 {id:'main',title:'Principal',pages:[['Início','home','home'],['Mercado','mercado','bolt'],['Tier Constructor','/tier-constructor.html','star']]},
 {id:'worlds',title:'Mundial 2026',pages:[['Mundial','ffws-global-2026-formato','globe'],['Fase 1','ffws-global-2026-classificatoria','calendar'],['Fase 2','ffws-global-2026-segunda-fase','chart'],['Last Chance','ffws-global-2026-last-chance','bolt'],['Grande Final','ffws-global-2026-final','trophy'],['MVP Mundial','ffws-global-2026-mvp','medal'],['Equipes Mundial','ffws-global-2026-equipes','users']]},
 {id:'stats',title:'Estatísticas e WB',pages:[['Estatísticas','registro-detalhado','chart'],['Hall da Fama','hall-da-fama','trophy'],['Ranking MVP','ffws-br-s2-mvp','medal'],['Final WB','ffws-br-s2-final','trophy'],['Notas CFF','ffws-br-s2-notas','star'],['Comparar 1v1','ffws-br-s2-comparar','swords'],['Equipes históricas','/equipes-historicas.html','users']]},
 {id:'community',title:'Comunidade e conta',pages:[['Comunidade','/interacoes.html','users'],['Loja CFF','/conta.html?tab=points&shopSection=shop#eco-shop','coins'],['Inventário','/conta.html?tab=inventory','gift'],['Desafios diários','/conta.html?tab=quiz','fire'],['Meu perfil','/conta.html','home']]}
];
const pages=groups.flatMap(g=>g.pages.map(([label,route,icon])=>({label,route,icon,group:g.id})));
const defaults=[{route:'home',icon:'home'},{route:'ffws-global-2026-formato',icon:'globe'},{route:'registro-detalhado',icon:'chart'},{route:'/interacoes.html',icon:'users'}];
const lookup=route=>pages.find(p=>p.route===route);
const read=()=>{try{const a=JSON.parse(localStorage.getItem(KEY));return defaults.map((d,i)=>({route:lookup(a?.[i]?.route)?a[i].route:d.route,icon:iconPaths[a?.[i]?.icon]?a[i].icon:d.icon}));}catch{return defaults.map(d=>({...d}));}};
let state=read(),sheet=null;
const svg=key=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(iconPaths[key]||iconPaths.home)+'</svg>';
const href=route=>route.startsWith('/')?route:window.CFF_SEASON_ROUTES?.pathForPage(route)||'/index.html#'+route;
const pageNow=()=>window.CFF_SEASON_ROUTES?.pageFromLocation?.()||document.querySelector('.page.active')?.id||location.hash.slice(1)||'home';
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{}}
function selected(route,page){
 if(route.startsWith('/')){const u=new URL(route,location.origin);return u.pathname===location.pathname&&(!u.search||u.search===location.search);}
 return (route==='home'?page==='home'&&/^\/(?:index\.html)?$/.test(location.pathname):route===page)||(route==='ffws-global-2026-formato'&&String(page).startsWith('ffws-global-2026-'))||
 (route==='registro-detalhado'&&/(?:stats|mvp|registro|comparar|notas)/.test(page));
}
function accessEntry(){return [...document.querySelectorAll('[data-account-entry]')].find(e=>e.querySelector('img'))||document.querySelector('[data-account-entry]');}
function avatar(){return accessEntry()?.querySelector('img')||null;}
function syncAvatar(){
 const link=bar.querySelector('[data-cff-bottom="profile"]');if(!link)return;
 const source=avatar(),src=source?.getAttribute('src')||'';
 let image=link.querySelector('.cff-dock-avatar');
 if(src){
  if(!image){image=document.createElement('img');image.className='cff-dock-avatar';image.alt='';link.querySelector('svg')?.replaceWith(image);}
  if(image.getAttribute('src')!==src)image.setAttribute('src',src);
 }else if(image){const wrap=document.createElement('span');wrap.innerHTML=svg('users');image.replaceWith(wrap.firstElementChild);}
 if(sheet?.open)syncSheet();
}
function refresh(page=pageNow()){
 const links=[...bar.querySelectorAll('[data-cff-bottom]')];
 for(let i=0;i<4;i++){
  const a=links[i],item=state[i],p=lookup(item.route);
  if(!a||!p)continue;
  a.dataset.cffBottomRoute=item.route;a.href=href(item.route);
  a.innerHTML=svg(item.icon)+'<span>'+esc(p.label)+'</span>';
  a.setAttribute('aria-label','Abrir '+p.label);
  const on=selected(item.route,page);
  a.classList.toggle('is-current',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
 }
 const profile=bar.querySelector('[data-cff-bottom="profile"]');
 if(profile){const on=location.pathname==='/conta.html'||location.pathname.startsWith('/perfil/');profile.classList.toggle('is-current',on);if(on)profile.setAttribute('aria-current','page');else profile.removeAttribute('aria-current');}
 syncAvatar();
}
function balance(){return [...document.querySelectorAll('[data-header-wallet] [data-wallet-value]')].map(e=>e.textContent.trim()).find(s=>s&&s!=='—')||'—';}
function syncSheet(){
 if(!sheet)return;
 const signed=!!avatar();
 sheet.querySelector('[data-dock-name]').textContent=signed?(accessEntry()?.textContent.trim()||'Meu perfil'):'Visitante';
 sheet.querySelector('[data-dock-balance]').textContent=signed?balance():'—';
 const art=sheet.querySelector('[data-dock-avatar]'),src=avatar()?.getAttribute('src');
 if(art)art.innerHTML=src?'<img alt="" src="'+esc(src)+'">':svg('users');
 sheet.querySelector('[data-dock-login]').hidden=signed;
}
function editorRow(i){
 const item=state[i],p=lookup(item.route),g=groups.find(group=>group.id===p?.group)||groups[0];
 return '<div class="cff-dock-editor-row"><strong>Atalho '+(i+1)+'</strong><div class="cff-dock-editor-fields"><label>Categoria<select data-dock-group="'+i+'">'+groups.map(group=>'<option value="'+group.id+'"'+(group.id===g.id?' selected':'')+'>'+esc(group.title)+'</option>').join('')+'</select></label>'+
 '<label>Página<select data-dock-route="'+i+'">'+g.pages.map(([label,route])=>'<option value="'+esc(route)+'"'+(route===item.route?' selected':'')+'>'+esc(label)+'</option>').join('')+'</select></label>'+
 '<label>Ícone<select data-dock-icon="'+i+'">'+icons.map(key=>'<option value="'+key+'"'+(key===item.icon?' selected':'')+'>'+esc(iconNames[key])+'</option>').join('')+'</select></label></div></div>';
}
function renderEditor(){if(sheet)sheet.querySelector('[data-dock-editor]').innerHTML=state.map((_,i)=>editorRow(i)).join('');}
function open(){
 if(!sheet){
  sheet=document.createElement('dialog');sheet.className='cff-dock-dialog';
  sheet.setAttribute('aria-label','Meu perfil e atalhos');
  sheet.innerHTML=[
   '<div class="cff-dock-sheet-head"><div><small>CENTRAL FREE FIRE</small><h2>Meu espaço</h2></div><button type="button" data-dock-close aria-label="Fechar">×</button></div>',
   '<div class="cff-dock-account-line"><div class="cff-dock-profile-image" data-dock-avatar></div><div><strong data-dock-name>Minha conta</strong><span>Seu espaço na comunidade</span></div></div>',
   '<a class="cff-dock-coins" href="/conta.html?tab=points&shopSection=shop#eco-shop"><img src="/edition/moeda%20cff.webp" alt=""><span><strong data-dock-balance>—</strong><small>CFF COINS · ABRIR LOJA</small></span><span>↗</span></a>',
   '<div class="cff-dock-actions"><a href="/conta.html">Meu perfil</a><a href="/conta.html?tab=edit">Configurações e edição</a><a href="/conta.html?tab=inventory">Inventário</a><a href="/conta.html?tab=notifications">Notificações</a><button type="button" data-dock-login hidden>Entrar com Google</button></div>',
   '<details class="cff-dock-config"><summary>⚙ Personalizar barra inferior <span>⌄</span></summary><p>Escolha a página e o ícone dos quatro primeiros atalhos. O perfil permanece fixo na quinta posição.</p><div data-dock-editor></div><div class="cff-dock-editor-actions"><button type="button" data-dock-reset>Restaurar padrão</button><button type="button" data-dock-finish>Concluir</button></div><small>Preferências salvas neste navegador</small></details>'
  ].join('');
  document.body.append(sheet);
  sheet.querySelector('[data-dock-close]').addEventListener('click',()=>sheet.close());
  sheet.querySelector('[data-dock-finish]').addEventListener('click',()=>sheet.querySelector('.cff-dock-config').open=false);
  sheet.querySelector('[data-dock-reset]').addEventListener('click',()=>{state=defaults.map(d=>({...d}));save();refresh();renderEditor();});
  sheet.querySelector('[data-dock-login]').addEventListener('click',()=>{sheet.close();const entry=accessEntry();if(entry)entry.click();else location.href='/conta.html';});
  sheet.addEventListener('click',event=>{if(event.target===sheet)sheet.close();});
  sheet.addEventListener('change',event=>{
   const t=event.target,raw=t.dataset.dockGroup??t.dataset.dockRoute??t.dataset.dockIcon;
   if(raw===undefined)return;
   const i=Number(raw);if(!Number.isInteger(i)||i<0||i>3)return;
   if(t.hasAttribute('data-dock-group')){
    const g=groups.find(g=>g.id===t.value);if(!g)return;
    state[i]={route:g.pages[0][1],icon:g.pages[0][2]};renderEditor();
   }else if(t.hasAttribute('data-dock-route')){
    const p=lookup(t.value);if(!p)return;
    state[i]={route:p.route,icon:p.icon};renderEditor();
   }else if(t.hasAttribute('data-dock-icon')){
    if(!iconPaths[t.value])return;state[i].icon=t.value;
   }
   save();refresh();
  });
  renderEditor();
 }
 syncSheet();sheet.showModal();
}
bar.addEventListener('click',event=>{
 if(!event.target.closest('[data-cff-bottom="profile"]'))return;
 event.preventDefault();event.stopImmediatePropagation();open();
},true);
const watched=new WeakSet();
function observeAccount(){
 for(const entry of document.querySelectorAll('[data-account-entry]')){
  if(watched.has(entry))continue;watched.add(entry);
  new MutationObserver(syncAvatar).observe(entry,{subtree:true,attributes:true,attributeFilter:['src'],childList:true});
 }
 syncAvatar();
}
window.addEventListener('cff:account-access-rendered',observeAccount);
window.addEventListener('hashchange',()=>refresh());
window.addEventListener('popstate',()=>refresh());
window.addEventListener('cff:pretty-route',()=>refresh());
window.addEventListener('pageshow',()=>refresh());
window.CFFMobileDock={refresh,openSettings:()=>{open();sheet.querySelector('.cff-dock-config').open=true;}};
observeAccount();refresh();
})();