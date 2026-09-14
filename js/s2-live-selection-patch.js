(()=>{
  'use strict';
  if(window.__CFF_S2_LIVE_SELECTION_PATCH_V3__)return;
  window.__CFF_S2_LIVE_SELECTION_PATCH_V3__=true;

  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toUpperCase();
  const num=v=>Number(v)||0;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let cache=null,cacheAt=0,wrapping=false,syncing=false,scheduled=false;

  async function data(){
    if(cache&&Date.now()-cacheAt<3000)return cache;
    try{
      const r=await fetch(`ffws-br-2026-s2/players.json?v=${Date.now()}`,{cache:'no-store'});
      if(!r.ok)return null;
      cache=await r.json();cacheAt=Date.now();return cache;
    }catch(_){return null}
  }

  function metaFor(payload,name,team){
    const list=Array.isArray(payload?.players)?payload.players:[],n=norm(name),t=norm(team);
    return list.find(p=>norm(p?.team)===t&&[p?.name,p?.sourceName,...(p?.aliases||[])].some(a=>norm(a)===n))||list.find(p=>[p?.name,p?.sourceName,...(p?.aliases||[])].some(a=>norm(a)===n))||null;
  }
  function role(row){const raw=String(row?.meta?.roleShort||row?.meta?.role||row?.roleShort||row?.role||'RUSH').toUpperCase();if(raw.includes('GRAN'))return'GRAN';if(raw.includes('SUP'))return'SUP';if(raw==='3'||raw.includes('3º'))return'3';return'RUSH'}
  function lineup(rows){const used=new Set(),take=(roles,n)=>rows.filter(r=>!used.has(r)&&roles.includes(role(r))).slice(0,n).map(r=>(used.add(r),r));let out=[...take(['RUSH','3'],2),...take(['GRAN'],1),...take(['SUP'],1)];if(out.length<4)out=out.concat(rows.filter(r=>!used.has(r)).slice(0,4-out.length));return out}
  function logo(team){try{return window.getTeamLogoByAliases?.(team)||window.logos?.[team]||'escudo.webp'}catch(_){return'escudo.webp'}}
  function photo(meta){try{return window.cffResolvePlayerPhoto?.(meta?.name,meta?.photo||meta?.image||'')||meta?.photo||meta?.image||'silhueta.webp'}catch(_){return meta?.photo||meta?.image||'silhueta.webp'}}
  function card(row){const color='#21c778',r=role(row),m=row.meta||{name:row.name},dmg=`${(row.damage/1000).toFixed(1)}K`;return `<div class="ffws-s2-s1-selection-card" role="button" tabindex="0" onclick="window.openCurrentSeasonPlayer?.('${String(row.name).replace(/'/g,"\\'")}','${String(row.team).replace(/'/g,"\\'")}')"><div style="cursor:pointer;width:280px;height:420px;background:#000;border:4px solid ${color};border-radius:15px;position:relative;overflow:hidden;box-shadow:0 0 25px rgba(33,199,120,.44);margin:0 auto;box-sizing:border-box"><div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 30%,#063524,#000);opacity:.95"></div><div style="position:absolute;top:15px;left:15px;z-index:10;background:${color};color:#fff;padding:4px 12px;border-radius:4px;font-size:.75em;font-weight:900;letter-spacing:1px">2ª FASE</div><div style="position:absolute;top:50px;left:25px;z-index:4;text-align:center;color:${color}"><div style="font-size:22px;font-weight:900">${esc(r)}</div><div style="margin:8px auto;width:35px;height:3px;background:${color}"></div><img src="${esc(logo(row.team))}" alt="${esc(row.team)}" style="width:50px;height:50px;object-fit:contain;margin-top:5px"></div><img src="${esc(photo(m))}" alt="${esc(row.name)}" onerror="this.onerror=null;this.src='silhueta.webp'" style="position:absolute;top:20px;right:-35px;height:270px;max-width:245px;object-fit:contain;object-position:right bottom;z-index:2;filter:drop-shadow(5px 5px 15px #000);-webkit-mask-image:linear-gradient(to bottom,#000 75%,transparent 100%)"><div style="position:absolute;bottom:0;width:100%;height:170px;background:linear-gradient(transparent,#000 45%);z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:20px;box-sizing:border-box"><div style="color:#fff;font-size:24px;font-weight:900;text-transform:uppercase;padding:6px 10px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-sizing:border-box">${esc(row.name)}</div><div style="display:flex;justify-content:space-around;width:90%;color:#fff;border-top:1px solid rgba(33,199,120,.38);padding-top:10px"><div style="text-align:center"><div style="font-size:.65em;color:#888">KILLS</div><div style="font-size:1.1em;font-weight:900;color:${color}">${row.kills}</div></div><div style="text-align:center"><div style="font-size:.65em;color:#888">DANO</div><div style="font-size:1.1em;font-weight:900">${dmg}</div></div><div style="text-align:center"><div style="font-size:.65em;color:#888">QUEDAS</div><div style="font-size:1.1em;font-weight:900">${row.matches}</div></div></div></div></div></div>`}

  async function rows(){
    const p=await data();if(!p)return[];
    const entries=(p.entries||[]).filter(e=>norm(e?.stage||e?.etapa)==='SEGUNDAFASE'),agg=new Map();
    entries.forEach(e=>{const name=e.name||e.player||e.jogador,team=e.team||e.equipe||'';if(!name)return;const k=`${norm(name)}__${norm(team)}`;if(!agg.has(k))agg.set(k,{name,team,meta:metaFor(p,name,team),kills:0,damage:0,assists:0,matches:0,mvps:0});const r=agg.get(k);r.kills+=num(e.kills??e.abates);r.damage+=num(e.damage??e.dano);r.assists+=num(e.assists??e.assistencias);r.matches+=num(e.matches??e.quedas)||1;r.mvps+=num(e.mvp??e.mvps)});
    return[...agg.values()].sort((a,b)=>b.kills-a.kills||b.damage-a.damage||b.assists-a.assists);
  }

  function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}

  function patchClassificatoria(){
    const root=document.getElementById('ffws-br-s2-selecoes-content');if(!root)return;
    const panel=root.querySelector('.season-selection-panel-classificatoria');if(!panel)return;
    setText(panel.querySelector('.season-selection-section-head p'),'Seleção final dos melhores jogadores por função na Classificatória.');
    const notice=panel.querySelector('.season-selection-disclaimer');
    if(notice){
      setText(notice.querySelector('strong'),'CLASSIFICATÓRIA ENCERRADA');
      setText(notice.querySelector('span'),'Seleção definitiva da primeira fase após o encerramento das 14 rodadas.');
    }
  }

  async function patchSecondPanel(rs){
    const root=document.getElementById('ffws-br-s2-selecoes-content');if(!root||!rs.length)return;
    const panel=root.querySelector('.season-selection-panel-segunda-fase');if(!panel)return;
    const grid=panel.querySelector('.season-selection-grid'),head=panel.querySelector('.season-selection-section-head p');if(!grid)return;
    setText(head,'Melhores de cada posição considerando os dados já disputados na Segunda Fase.');
    const selected=lineup(rs);
    const signature=selected.map(r=>`${norm(r.name)}:${norm(r.team)}:${r.kills}:${r.damage}:${r.matches}`).join('|');
    if(grid.dataset.cffLiveSelectionSignature===signature)return;
    grid.dataset.cffLiveSelectionSignature=signature;
    grid.innerHTML=selected.map(card).join('');
  }

  async function sync(){
    if(syncing)return;
    syncing=true;
    try{
      patchClassificatoria();
      const root=document.getElementById('ffws-br-s2-selecoes-content');if(!root)return;
      const rs=await rows();if(!rs.length)return;
      [...root.querySelectorAll('.season-selection-tab')].forEach(btn=>{
        if(!/SEGUNDA FASE/i.test(btn.textContent||''))return;
        if(btn.disabled)btn.disabled=false;
        if(btn.hasAttribute('aria-disabled'))btn.removeAttribute('aria-disabled');
        if(btn.classList.contains('locked'))btn.classList.remove('locked');
        const small=btn.querySelector('small');if(small)small.remove();
        if(btn.dataset.cffSecondPhaseLive!=='1'){
          btn.dataset.cffSecondPhaseLive='1';
          btn.onclick=()=>{window.setFFWSS2SelectionTab?.('segundaFase');setTimeout(scheduleSync,30)};
        }
      });
      await patchSecondPanel(rs);
    }finally{syncing=false}
  }

  function scheduleSync(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;sync()});
  }

  function wrapSetter(){
    if(wrapping||typeof window.setFFWSS2SelectionTab!=='function')return;
    wrapping=true;
    const orig=window.setFFWSS2SelectionTab;
    window.setFFWSS2SelectionTab=tab=>{orig(tab);setTimeout(scheduleSync,20)};
  }

  const observer=new MutationObserver(mutations=>{
    const relevant=mutations.some(m=>{
      const target=m.target?.nodeType===1?m.target:m.target?.parentElement;
      return target?.closest?.('#ffws-br-s2-selecoes-content')||[...m.addedNodes].some(n=>n.nodeType===1&&(n.id==='ffws-br-s2-selecoes-content'||n.querySelector?.('#ffws-br-s2-selecoes-content')));
    });
    if(relevant)scheduleSync();
  });

  const boot=()=>{
    const tryWrap=()=>{wrapSetter();if(wrapping)clearInterval(timer)};
    const timer=setInterval(tryWrap,250);
    setTimeout(()=>clearInterval(timer),10000);
    tryWrap();
    observer.observe(document.body,{childList:true,subtree:true});
    scheduleSync();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
