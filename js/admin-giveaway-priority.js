(() => {
  'use strict';
  if (!/admin-sorteio-comunidade\.html$/i.test(location.pathname)) return;
  if (window.__CFF_ADMIN_GIVEAWAY_PRIORITY_V1__) return;
  window.__CFF_ADMIN_GIVEAWAY_PRIORITY_V1__ = true;

  const API = 'https://cff-instagram-community.nakataffb4.workers.dev';
  const STORAGE = 'cff_giveaway_priority_rules_v1';
  const DEFAULTS = {
    cap: 3,
    commented: { enabled:false, pct:20 },
    topRank: { enabled:false, pct:30, top:1, mode:'fixed', step:1 },
    story: { enabled:false, pct:10 },
    top20: { enabled:false, pct:15 },
    active3: { enabled:false, pct:15 },
    active5: { enabled:false, pct:25 },
    active7: { enabled:false, pct:40 },
  };

  let db = null, current = null, entries = [], allMap = new Map(), allOrder = [], weekMap = new Map(), weekOrder = [];
  let sortState = { key:'weight', dir:'desc' };
  let stopEntries = null, stopCurrent = null;
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const clean = (v) => String(v || '').replace(/^@+/, '').trim();
  const key = (v) => clean(v).toLowerCase();
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  function rules() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE) || 'null') || {};
      const out = structuredClone(DEFAULTS);
      out.cap = Math.max(1, Math.min(10, num(raw.cap) || DEFAULTS.cap));
      for (const id of ['commented','story','top20','active3','active5','active7']) {
        out[id].enabled = Boolean(raw?.[id]?.enabled);
        out[id].pct = Math.max(0, Math.min(500, num(raw?.[id]?.pct ?? DEFAULTS[id].pct)));
      }
      out.topRank.enabled = Boolean(raw?.topRank?.enabled);
      out.topRank.pct = Math.max(0, Math.min(500, num(raw?.topRank?.pct ?? DEFAULTS.topRank.pct)));
      out.topRank.top = Math.max(1, Math.min(1000, Math.round(num(raw?.topRank?.top) || DEFAULTS.topRank.top)));
      out.topRank.mode = raw?.topRank?.mode === 'gradual' ? 'gradual' : 'fixed';
      out.topRank.step = Math.max(0, Math.min(500, num(raw?.topRank?.step ?? DEFAULTS.topRank.step)));
      return out;
    } catch (_) { return structuredClone(DEFAULTS); }
  }

  function saveRules() {
    const next = { cap: num($('#gp-cap')?.value) || 3 };
    for (const id of ['commented','story','top20','active3','active5','active7']) {
      next[id] = { enabled: Boolean($(`#gp-${id}-on`)?.checked), pct: Math.max(0, num($(`#gp-${id}-pct`)?.value)) };
    }
    next.topRank = {
      enabled: Boolean($('#gp-topRank-on')?.checked),
      pct: Math.max(0, num($('#gp-topRank-pct')?.value)),
      top: Math.max(1, Math.min(1000, Math.round(num($('#gp-topRank-top')?.value) || 1))),
      mode: $('#gp-topRank-mode')?.value === 'gradual' ? 'gradual' : 'fixed',
      step: Math.max(0, num($('#gp-topRank-step')?.value))
    };
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); } catch (_) {}
    render();
  }

  function css() {
    if ($('#cff-give-priority-css')) return;
    const s = document.createElement('style'); s.id = 'cff-give-priority-css'; s.textContent = `
      .gp{margin-top:16px}.gp-grid{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:16px;align-items:start}.gp-rules{display:grid;gap:8px;padding:0 16px 16px}.gp-rule{display:grid;grid-template-columns:auto minmax(0,1fr) 100px;gap:10px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:rgba(255,255,255,.025)}.gp-rule input[type=checkbox]{width:18px;height:18px;accent-color:#00c8ff}.gp-rule strong{display:block;color:#fff;font-size:12px}.gp-rule small{display:block;margin-top:3px;color:#7089a5;font-size:10px;line-height:1.35}.gp-pct{display:flex;align-items:center;gap:5px}.gp-pct input{width:70px;height:36px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#080e18;color:#fff;padding:0 8px;text-align:right}.gp-pct span{color:#7c94af;font-size:11px;font-weight:900}.gp-rank-config{display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:flex-end}.gp-rank-config input{width:58px!important}.gp-rank-config select{height:36px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#080e18;color:#fff;padding:0 7px;font-size:10px;font-weight:900}.gp-rank-config em{font-style:normal;color:#718aa6;font-size:10px;font-weight:900}.gp-rank-step{display:none}.gp-rank-step.is-visible{display:inline-flex;align-items:center;gap:5px}.gp-cap{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 16px 14px;color:#8ea5bf;font-size:11px}.gp-cap input{width:86px;height:38px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#080e18;color:#fff;padding:0 8px}.gp-tools{display:flex;gap:7px;flex-wrap:wrap;padding:0 16px 12px}.gp-mobile-sort{display:none;padding:0 16px 10px}.gp-mobile-sort label{display:grid;gap:5px;color:#7893b0;font-size:9px;font-weight:950;text-transform:uppercase}.gp-mobile-sort select{height:38px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#080e18;color:#fff;padding:0 9px;font-weight:900}.gp-table-wrap{overflow:auto;border-top:1px solid rgba(255,255,255,.07)}.gp-table{width:100%;border-collapse:collapse;min-width:820px}.gp-table th,.gp-table td{padding:10px 13px;border-bottom:1px solid rgba(255,255,255,.055);text-align:left;font-size:12px}.gp-table th{color:#7893b0;font-size:9px;text-transform:uppercase;letter-spacing:.05em}.gp-sort-btn{display:inline-flex;align-items:center;gap:5px;border:0;background:transparent;color:inherit;padding:0;font:inherit;text-transform:inherit;letter-spacing:inherit;cursor:pointer;font-weight:950}.gp-sort-btn:hover{color:#d7efff}.gp-sort-btn .arrow{color:#00c8ff;font-size:10px}.gp-user{color:#fff;font-weight:1000}.gp-weight{color:#00c8ff;font-size:16px;font-weight:1000;white-space:nowrap}.gp-reasons{color:#7892ad;line-height:1.45}.gp-empty{padding:24px;text-align:center;color:#758da8;font-size:11px}.gp-note{padding:0 16px 14px;color:#6e86a1;font-size:10px;line-height:1.5}.gp-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:0 16px 12px}.gp-stat{padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:10px;background:rgba(255,255,255,.025)}.gp-stat span{display:block;color:#718aa6;font-size:9px;font-weight:900;text-transform:uppercase}.gp-stat strong{display:block;margin-top:4px;color:#fff;font-size:18px}@media(max-width:850px){.gp-grid{grid-template-columns:1fr}.gp-table{min-width:760px}}@media(max-width:560px){.gp-rule{grid-template-columns:auto minmax(0,1fr);}.gp-pct{grid-column:2}.gp-rank-config{grid-column:2;justify-content:flex-start}.gp-rank-config select{width:100%}.gp-rank-step.is-visible{width:100%;justify-content:flex-start}.gp-tools .admin-btn{width:100%}.gp-summary{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.gp-stat{padding:8px}.gp-stat strong{font-size:16px}.gp-mobile-sort{display:block}.gp-table{min-width:660px}.gp-table th,.gp-table td{padding:9px 8px;font-size:11px}.gp-weight{font-size:14px}}@media(max-width:390px){.gp-summary{grid-template-columns:1fr}.gp-table{min-width:620px}}
    `; document.head.appendChild(s);
  }

  function mount() {
    if ($('#cff-give-priority')) return $('#cff-give-priority');
    const app = $('#give-app'); if (!app || app.hidden) return null; css();
    const r = rules();
    const section = document.createElement('section'); section.id='cff-give-priority'; section.className='admin-panel gp';
    section.innerHTML = `<div class="admin-panel-head admin-panel-head-wrap"><div><p class="admin-eyebrow">Prioridade opcional</p><h2>Chance extra por interação</h2><p class="admin-muted">1,5× significa 50% mais chance que um participante normal. Critérios desligados não alteram a chance.</p></div><button id="gp-refresh" class="admin-btn admin-btn-ghost" type="button">↻ Atualizar dados</button></div><div class="gp-grid"><div><div class="gp-rules">${ruleRow('commented','Já comentou no perfil','Histórico geral de comentários',r.commented)}${rankRuleRow(r.topRank)}${ruleRow('story','Já marcou em Story','Histórico geral de menções em Stories',r.story)}${ruleRow('top20','Top 20 da semana','Está entre os 20 primeiros do ranking semanal',r.top20)}${ruleRow('active3','3+ dias ativos','Constância nesta semana',r.active3)}${ruleRow('active5','5+ dias ativos','Bônus maior de longevidade',r.active5)}${ruleRow('active7','7 dias ativos','Maior bônus de constância',r.active7)}</div><div class="gp-cap"><span>Limite máximo de prioridade por pessoa</span><label><input id="gp-cap" type="number" min="1" max="10" step="0.1" value="${esc(r.cap)}"> ×</label></div><div class="gp-note">Os bônus são somados. Ex.: 20% equivale a +0,2 e 30% equivale a +0,3. Então 1,0 + 0,2 + 0,3 = 1,5 no sorteador.</div></div><div><div class="gp-summary"><div class="gp-stat"><span>Participantes</span><strong id="gp-total">0</strong></div><div class="gp-stat"><span>Com prioridade</span><strong id="gp-prioritized">0</strong></div><div class="gp-stat"><span>Maior peso</span><strong id="gp-max">1×</strong></div></div><div class="gp-tools"><button id="gp-copy" class="admin-btn admin-btn-primary" type="button">Copiar para sorteador com prioridade</button><button id="gp-sheet" class="admin-btn admin-btn-ghost" type="button">Copiar planilha</button><button id="gp-csv" class="admin-btn admin-btn-ghost" type="button">Baixar CSV</button></div><div class="gp-mobile-sort"><label>Ordenar por<select id="gp-mobile-sort"><option value="weight:desc">Maior chance</option><option value="weight:asc">Menor chance</option><option value="username:asc">Instagram A–Z</option><option value="username:desc">Instagram Z–A</option><option value="rank:asc">Melhor ranking</option><option value="rank:desc">Pior ranking</option><option value="index:asc">Ordem de inscrição</option></select></label></div><div class="gp-table-wrap"><table class="gp-table"><thead><tr><th><button class="gp-sort-btn" type="button" data-gp-sort="index"># <span class="arrow"></span></button></th><th><button class="gp-sort-btn" type="button" data-gp-sort="username">Instagram <span class="arrow"></span></button></th><th><button class="gp-sort-btn" type="button" data-gp-sort="reasons">Bônus aplicados <span class="arrow"></span></button></th><th><button class="gp-sort-btn" type="button" data-gp-sort="weight">Chance <span class="arrow"></span></button></th><th><button class="gp-sort-btn" type="button" data-gp-sort="rank">Ranking <span class="arrow"></span></button></th></tr></thead><tbody id="gp-body"><tr><td colspan="5"><div class="gp-empty">Carregando participantes...</div></td></tr></tbody></table></div></div></div>`;
    app.appendChild(section);
    section.querySelectorAll('input').forEach(el => el.addEventListener('change', saveRules));
    $('#gp-refresh')?.addEventListener('click', loadRankings);
    $('#gp-copy')?.addEventListener('click', copyForSorter);
    $('#gp-sheet')?.addEventListener('click', copySheet);
    $('#gp-csv')?.addEventListener('click', downloadCsv);
    $('#gp-topRank-mode')?.addEventListener('change', ()=>{ syncRankModeUi(); saveRules(); });
    section.querySelectorAll('[data-gp-sort]').forEach(btn=>btn.addEventListener('click',()=>setSort(btn.dataset.gpSort)));
    $('#gp-mobile-sort')?.addEventListener('change',e=>{const [key,dir]=String(e.target.value||'weight:desc').split(':');sortState={key,dir};render();});
    syncRankModeUi();
    return section;
  }

  function ruleRow(id,title,copy,rule) {
    return `<label class="gp-rule"><input id="gp-${id}-on" type="checkbox" ${rule.enabled?'checked':''}><span><strong>${esc(title)}</strong><small>${esc(copy)}</small></span><span class="gp-pct"><input id="gp-${id}-pct" type="number" min="0" max="500" step="5" value="${esc(rule.pct)}"><span>%</span></span></label>`;
  }

  function rankRuleRow(rule) {
    return `<label class="gp-rule"><input id="gp-topRank-on" type="checkbox" ${rule.enabled?'checked':''}><span><strong>Mais pontos no ranking</strong><small>Escolha bônus igual para todo o Top N ou gradual, diminuindo a cada posição.</small></span><span class="gp-pct gp-rank-config"><em>Top</em><input id="gp-topRank-top" type="number" min="1" max="1000" step="1" value="${esc(rule.top)}"><select id="gp-topRank-mode"><option value="fixed" ${rule.mode!=='gradual'?'selected':''}>Bônus igual</option><option value="gradual" ${rule.mode==='gradual'?'selected':''}>Gradual</option></select><em>Top 1 +</em><input id="gp-topRank-pct" type="number" min="0" max="500" step="1" value="${esc(rule.pct)}"><span>%</span><span id="gp-rank-step-wrap" class="gp-rank-step ${rule.mode==='gradual'?'is-visible':''}"><em>Cai</em><input id="gp-topRank-step" type="number" min="0" max="500" step="1" value="${esc(rule.step)}"><span>%/posição</span></span></span></label>`;
  }

  function syncRankModeUi(){
    const gradual=$('#gp-topRank-mode')?.value==='gradual';
    $('#gp-rank-step-wrap')?.classList.toggle('is-visible',gradual);
  }

  function normalizeRanking(raw) {
    const source = raw?.users && typeof raw.users === 'object' ? raw.users : {};
    return Object.values(source).map(x => ({ username:clean(x?.username), points:num(x?.points), comments:num(x?.comments), stories:num(x?.storyMentions), activeDays:num(x?.activeDays) })).filter(x=>x.username).sort((a,b)=>b.points-a.points||b.activeDays-a.activeDays||b.stories-a.stories||b.comments-a.comments);
  }

  async function loadRankings() {
    const btn=$('#gp-refresh'); if(btn){btn.disabled=true;btn.textContent='Atualizando...';}
    try {
      const [a,w] = await Promise.all(['all','week'].map(async period => { const r=await fetch(`${API}/api/ranking?period=${period}&_=${Date.now()}`,{cache:'no-store',headers:{Accept:'application/json'}}); if(!r.ok)throw new Error(`HTTP ${r.status}`); return r.json(); }));
      const all = normalizeRanking(a), week = normalizeRanking(w);
      allMap = new Map(all.map(x=>[key(x.username),x])); allOrder = all.map(x=>key(x.username)); weekMap = new Map(week.map(x=>[key(x.username),x])); weekOrder = week.map(x=>key(x.username));
      render();
    } catch (e) { console.error('[Giveaway priority ranking]',e); }
    finally { if(btn){btn.disabled=false;btn.textContent='↻ Atualizar dados';} }
  }

  function matched(x, r) {
    const a=allMap.get(key(x.username))||{}; const w=weekMap.get(key(x.username))||{}; const pos=weekOrder.indexOf(key(x.username))+1; const allPos=allOrder.indexOf(key(x.username))+1;
    const reasons=[]; let pct=0;
    const add=(id,label,ok)=>{if(r[id].enabled&&ok){pct+=num(r[id].pct);reasons.push(`${label} ${bonusLabel(r[id].pct)}`);}};
    add('commented','Já comentou',num(a.comments)>0);
    if(r.topRank.enabled&&allPos>0&&allPos<=r.topRank.top){
      const rankPct=r.topRank.mode==='gradual'?Math.max(0,num(r.topRank.pct)-(allPos-1)*num(r.topRank.step)):num(r.topRank.pct);
      if(rankPct>0){pct+=rankPct;reasons.push(`#${allPos} no ranking ${bonusLabel(rankPct)}`);}
    }
    add('story','Story',num(a.stories)>0);
    add('top20','Top 20',pos>0&&pos<=20);
    add('active3','3 dias',num(w.activeDays)>=3);
    add('active5','5 dias',num(w.activeDays)>=5);
    add('active7','7 dias',num(w.activeDays)>=7);
    const weight=Math.min(Math.max(1,num(r.cap)||3),1+pct/100);
    return {...x,weight:Math.round(weight*100)/100,pct:Math.round((weight-1)*100),reasons,pos,allPos,all:a,week:w};
  }

  function rows() {
    const seen=new Set(); const r=rules();
    return entries.filter(x=>{const k=key(x.username);if(!k||seen.has(k))return false;seen.add(k);return true;}).map((x,index)=>({...matched(x,r),entryIndex:index+1}));
  }

  function sortedRows(){
    const list=[...rows()],{key:sortKey,dir}=sortState,mul=dir==='asc'?1:-1;
    const val=x=>sortKey==='index'?num(x.entryIndex):sortKey==='username'?String(x.username||'').toLowerCase():sortKey==='reasons'?x.reasons.length:sortKey==='rank'?(x.allPos||999999):num(x.weight);
    list.sort((a,b)=>{const av=val(a),bv=val(b);if(typeof av==='string')return av.localeCompare(bv,'pt-BR')*mul;return (av-bv)*mul||a.entryIndex-b.entryIndex;});
    return list;
  }

  function setSort(key){
    if(sortState.key===key) sortState.dir=sortState.dir==='asc'?'desc':'asc';
    else sortState={key,dir:key==='username'||key==='index'||key==='rank'?'asc':'desc'};
    render();
  }

  function sorterWeight(v) { let out=(Math.round(Math.max(1,num(v))*100)/100).toFixed(2).replace('.',','); return out.replace(/,00$/,',0').replace(/(,\d)0$/,'$1'); }
  function bonusLabel(pct) { let out=(Math.round((num(pct)/100)*100)/100).toFixed(2).replace('.',','); out=out.replace(/,00$/,',0').replace(/(,\d)0$/,'$1'); return '+'+out; }
  function weightLabel(v) { return sorterWeight(v)+'×'; }

  function render() {
    const body=$('#gp-body'); if(!body)return; const base=rows(),list=sortedRows(),prioritized=base.filter(x=>x.weight>1),max=Math.max(1,...base.map(x=>x.weight));
    $('#gp-total').textContent=String(base.length); $('#gp-prioritized').textContent=String(prioritized.length); $('#gp-max').textContent=weightLabel(max);
    document.querySelectorAll('[data-gp-sort]').forEach(btn=>{const arrow=btn.querySelector('.arrow');if(arrow)arrow.textContent=sortState.key===btn.dataset.gpSort?(sortState.dir==='asc'?'▲':'▼'):'';});
    const mobile=$('#gp-mobile-sort');if(mobile){const wanted=`${sortState.key}:${sortState.dir}`;if([...mobile.options].some(o=>o.value===wanted))mobile.value=wanted;}
    if(!list.length){body.innerHTML='<tr><td colspan="5"><div class="gp-empty">Nenhum participante neste sorteio.</div></td></tr>';return;}
    body.innerHTML=list.map(x=>`<tr><td>${x.entryIndex}</td><td class="gp-user">@${esc(x.username)}</td><td class="gp-reasons">${x.reasons.length?esc(x.reasons.join(' • ')):'Sem bônus'}</td><td class="gp-weight">${esc(weightLabel(x.weight))}</td><td>${x.allPos?`#${x.allPos}`:'—'}</td></tr>`).join('');
  }

  async function copyText(text,msg) {
    try { await navigator.clipboard.writeText(text); }
    catch (_) { const a=document.createElement('textarea');a.value=text;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove(); }
    const base=$('#give-message'); if(base){base.textContent=msg;base.className='admin-message is-success';}
  }

  function copyForSorter() {
    const list=rows(); if(!list.length)return;
    copyText(list.map(x=>`${x.username} ${sorterWeight(x.weight)}`).join('\n'),'Lista com prioridades copiada. Cole direto no Sorteador Nakateam.');
  }

  function simpleLinesFor(input) {
    const r=rules();
    return (input||[]).map(item=>{ const username=clean(item?.username); const weighted=matched({username},r); return `${username} ${sorterWeight(weighted.weight)}`; }).join('\n');
  }

  function copySheet(input=rows()) {
    const list=input||[]; if(!list.length)return;
    copyText(simpleLinesFor(list),`${list.length} participantes copiados no formato Nome 1,0.`);
  }

  function downloadCsv() {
    const list=rows(); if(!list.length)return;
    const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const csv='\ufeff'+[['instagram','prioridade','chance_extra','criterios'],...list.map(x=>[`@${x.username}`,String(x.weight).replace('.',','),`${x.pct}%`,x.reasons.join(' | ')])].map(r=>r.map(q).join(';')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`sorteio-prioridades-${current?.id||'comunidade'}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
  }

  window.CFFGiveawayPriority = { copySimple: copySheet, simpleLinesFor, weightForUsername(username){ return matched({username:clean(username)},rules()); }, getRules: rules };

  async function connectFirebase() {
    const [{getApps,getApp},{getDatabase,ref,onValue},{getAuth,onAuthStateChanged}] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js'),
      import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js')
    ]);
    if(!getApps().length) return;
    const app=getApp(); db=getDatabase(app); const auth=getAuth(app);
    onAuthStateChanged(auth,user=>{if(!user)return; if(stopCurrent)stopCurrent(); stopCurrent=onValue(ref(db,'communityGiveaways/current'),snap=>{current=snap.val()||null; attachEntries(current?.id||'');});});
    function attachEntries(id){if(stopEntries){stopEntries();stopEntries=null;}entries=[];render();if(!id)return;stopEntries=onValue(ref(db,`communityGiveaways/entries/${id}`),snap=>{const raw=snap.val()||{};entries=Object.values(raw).map(x=>({username:clean(x?.username),createdAt:num(x?.createdAt)})).filter(x=>x.username);render();});}
  }

  function boot() {
    let tries=0; const t=setInterval(()=>{tries++;const app=$('#give-app');if(app&&!app.hidden){clearInterval(t);mount();connectFirebase().catch(console.error);loadRankings();}else if(tries>120)clearInterval(t);},100);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
