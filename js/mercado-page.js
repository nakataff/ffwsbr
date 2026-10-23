/* Complete Mercado page; the same cached, paginated feed powers the home summary. */
(() => {
  'use strict';
  if(window.CFFMercadoPage)return;
  const root=document.getElementById('mercado');if(!root)return;
  const VERSION='20261023-market-logos-v2';
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z\d]/gi,'').toUpperCase();
  const slug=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z\d]+/g,'-').replace(/^-|-$/g,'');
  let routes={};
  const originalLogo=window.resolveEscudo;
  window.resolveEscudo=(explicit,name)=>window.cffResolveTeamLogo?.(name,explicit||'')||originalLogo?.(explicit,name)||'escudo.webp';
  function enrich(){
    root.querySelectorAll('.mercado-card[data-market-index]').forEach(card=>{
      const row=mercadoData[Number(card.dataset.marketIndex)];if(!row)return;
      const names=getMercadoPlayers(row),staff=/coach|analista|manager|treinador|comiss/i.test(row.role||'');
      card.querySelectorAll('.mercado-player-name-list>span:not(.mercado-name-sep)').forEach((node,index)=>{
        const name=names[index];if(!name)return;
        let url='';
        if(row.personId&&names.length===1&&staff)url='/carreira.html?id='+encodeURIComponent(row.personId);
        else if(Object.hasOwn(routes,slug(name)))url='/jogador.html?'+new URLSearchParams({id:slug(name),voltar:'mercado.html'});
        else if(row.personId&&names.length===1)url='/carreira.html?id='+encodeURIComponent(row.personId);
        if(!url)return;
        const link=document.createElement('a');link.className='mercado-player-name-link';link.href=url;link.textContent=name;link.title='Ver perfil de '+name;node.replaceWith(link);
      });
      // Only club crests use the shared fallback; person photos remain independent.
      card.querySelectorAll('.mercado-club').forEach(club=>{
        const name=club.querySelector('.mercado-club-name')?.textContent.trim(),img=club.querySelector('img');
        if(!name||!img||['SEMCLUBE','SEMEQUIPE','FA','FREEAGENT'].includes(norm(name)))return;
        img.dataset.teamLogo=name;
        // A legacy inline handler would overwrite the shared retry with escudo.webp.
        img.onerror=null;img.removeAttribute('onerror');
      });
      card.querySelectorAll('div.mercado-club').forEach(club=>{
        const name=club.querySelector('.mercado-club-name')?.textContent.trim();
        if(!name||['SEMCLUBE','SEMEQUIPE','FA','FREEAGENT'].includes(norm(name)))return;
        const link=document.createElement('a');link.className='mercado-club';link.href='/equipe-historica.html?time='+encodeURIComponent(name);link.title='Ver equipe '+name;
        while(club.firstChild)link.append(club.firstChild);club.replaceWith(link);
      });
      card.querySelectorAll('.vote-btn').forEach(button=>button.setAttribute('aria-label',(button.dataset.vote==='up'?'Aprovar':'Desaprovar')+' movimentação de '+row.jogador));
    });
  }
  const originalRender=window.renderMercado;
  window.renderMercado=(force=false)=>{originalRender(force);enrich();};
  function retryButton(){
    if(root.querySelector('[data-market-retry]'))return;
    const button=document.createElement('button');button.type='button';button.className='mercado-retry';button.dataset.marketRetry='';button.textContent='Tentar novamente';
    button.addEventListener('click',()=>load(true));root.append(button);
  }
  async function load(force=false){
    root.querySelector('[data-market-retry]')?.remove();
    try{await window.loadMercado({skipPhotos:true,force});}catch{retryButton();}
  }
  const url=new URL(location.href);
  for(const key of ['time','team','jogador','cff-global-build','grupo','etapa','dia','aba'])url.searchParams.delete(key);
  if(url.href!==location.href)history.replaceState(null,'',url);
  window.CFFMercadoPage={reload:()=>load(true)};
  load();
  // Small local indices only. Do not import competitive data or the career catalogue.
  const read=path=>fetch(path+'?v='+VERSION,{cache:'default'}).then(r=>{if(!r.ok)throw Error();return r.json();});
  Promise.allSettled([window.cffLoadTeamLogoMap?.(),read('/player-data/routes.json')]).then(([,players])=>{
    if(players.status==='fulfilled')routes=players.value.routes||{};
    if(typeof mercadoHasLoaded!=='undefined'&&mercadoHasLoaded)window.renderMercado(true);
  });
})();
