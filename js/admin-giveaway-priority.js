(() => {
  'use strict';
  if (!/admin-sorteio-comunidade\.html$/i.test(location.pathname)) return;
  if (window.__CFF_ADMIN_GIVEAWAY_PRIORITY_V1__) return;
  window.__CFF_ADMIN_GIVEAWAY_PRIORITY_V1__ = true;

  const API = 'https://cff-instagram-community.nakataffb4.workers.dev';
  const STORAGE = 'cff_giveaway_priority_rules_v1';
  const DEFAULTS = {
    cap: 3,
    commented: { enabled:false, pct:10 },
    story: { enabled:false, pct:10 },
    top20: { enabled:false, pct:15 },
    active3: { enabled:false, pct:15 },
    active5: { enabled:false, pct:25 },
    active7: { enabled:false, pct:40 },
  };

  let db = null, current = null, entries = [], allMap = new Map(), weekMap = new Map(), weekOrder = [];
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
      return out;
    } catch (_) { return structuredClone(DEFAULTS); }
  }

  function saveRules() {
    const next = { cap: num($('#gp-cap')?.value) || 3 };
    for (const id of ['commented','story','top20','active3','active5','active7']) {
      next[id] = { enabled: Boolean($(`#gp-${id}-on`)?.checked), pct: Math.max(0, num($(`#gp-${id}-pct`)?.value)) };
    }
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); } catch (_) {}
    render();
  }

  function css() {
    if ($('#cff-give-priority-css')) return;
    const s = document.createElement('style'); s.id = 'cff-give-priority-css'; s.textContent = `
      .gp{margin-top:16px}.gp-grid{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:16px;align-items:start}.gp-rules{display:grid;gap:8px;padding:0 16px 16px}.gp-rule{display:grid;grid-template-columns:auto minmax(0,1fr) 100px;gap:10px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:rgba(255,255,255,.025)}.gp-rule input[type=checkbox]{width:18px;height:18px;accent-color:#00c8ff}.gp-rule strong{display:block;color:#fff;font-size:12px}.gp-rule small{display:block;margin-top:3px;color:#7089a5;font-size:10px;line-height:1.35}.gp-pct{display:flex;align-items:center;gap:5px}.gp-pct input{width:70px;height:36px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#080e18;color:#fff;padding:0 8px;text-align:right}.gp-pct span{color:#7c94af;font-size:11px;font-weight:900}.gp-cap{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 16px 14px;color:#8ea5bf;font-size:11px}.gp-cap input{width:86px;height:38px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#080e18;color:#fff;padding:0 8px}.gp-tools{display:flex;gap:7px;flex-wrap:wrap;padding:0 16px 12px}.gp-table-wrap{overflow:auto;border-top:1px solid rgba(255,255,255,.07)}.gp-table{width:100%;border-collapse:collapse;min-width:760px}.gp-table th,.gp-table td{padding:9px 11px;border-bottom:1px solid rgba(255,255,255,.055);text-align:left;font-size:11px}.gp-table th{color:#7893b0;font-size:9px;text-transform:uppercase;letter-spacing:.05em}.gp-user{color:#fff;font-weight:1000}.gp-weight{color:#00c8ff;font-size:13px;font-weight:1000}.gp-reasons{color:#7892ad;line-height:1.45}.gp-empty{padding:24px;text-align:center;color:#758da8;font-size:11px}.gp-note{padding:0 16px 14px;color:#6e86a1;font-size:10px;line-height:1.5}.gp-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:0 16px 12px}.gp-stat{padding:10px;border:1px solid rgba(255,255,255,.07);border-radius:10px;background:rgba(255,255,255,.025)}.gp-stat span{display:block;color:#718aa6;font-size:9px;font-weight:900;text-transform:uppercase}.gp-stat strong{display:block;margin-top:4px;color:#fff;font-size:18px}@media(max-width:850px){.gp-grid{grid-template-columns:1fr}}@media(max-width:560px){.gp-rule{grid-template-columns:auto minmax(0,1fr);}.gp-pct{grid-column:2}.gp-tools .admin-btn{width:100%}.gp-summary{grid-template-columns:1fr}}
    `; document.head.appendChild(s);
  }

  function mount() {
    if ($('#cff-give-priority')) return $('#cff-give-priority');
    const app = $('#give-app'); if (!app || app.hidden) return null; css();
    const r = rules();
    const section = document.createElement('section'); section.id='cff-give-priority'; section.className='admin-panel gp';
    section.innerHTML = `<div class="admin-panel-head admin-panel-head-wrap"><div><p class="admin-eyebrow">Prioridade opcional</p><h2>Chance extra por interação</h2><p class="admin-muted">1,5× significa 50% mais chance que um participante normal. Critérios desligados não alteram a chance.</p></div><button id="gp-refresh" class="admin-btn admin-btn-ghost" type="button">↻ Atualizar dados</button></div><div class="gp-grid"><div><div class="gp-rules">${ruleRow('commented','Já comentou no perfil','Histórico geral de comentários',r.commented)}${ruleRow('story','Já marcou em Story','Histórico geral de menções em Stories',r.story)}${ruleRow('top20','Top 20 da semana','Está entre os 20 primeiros do ranking semanal',r.top20)}${ruleRow('active3','3+ dias ativos','Constância nesta semana',r.active3)}${ruleRow('active5','5+ dias ativos','Bônus maior de longevidade',r.active5)}${ruleRow('active7','7 dias ativos','Maior bônus de constância',r.active7)}</div><div class="gp-cap"><span>Limite máximo de prioridade por pessoa</span><label><input id="gp-cap" type="number" min="1" max="10" step="0.1" value="${esc(r.cap)}"> ×</label></div><div class="gp-note">Os bônus são somados. Ex.: +15% por 3 dias e +25% por 5 dias = 1,40×. A regra de 7 dias pode somar com as anteriores para valorizar ainda mais quem acompanha a página a semana inteira.</div></div><div><div class="gp-summary"><div class="gp-stat"><span>Participantes</span><strong id="gp-total">0</strong></div><div class="gp-stat"><span>Com prioridade</span><strong id="gp-prioritized">0</strong></div><div class="gp-stat"><span>Maior peso</span><strong id="gp-max">1×</strong></div></div><div class="gp-tools"><button id="gp-copy" class="admin-btn admin-btn-primary" type="button">Copiar para sorteador com prioridade</button><button id="gp-sheet" class="admin-btn admin-btn-ghost" type="button">Copiar planilha</button><button id="gp-csv" class="admin-btn admin-btn-ghost" type="button">Baixar CSV</button></div><div class="gp-table-wrap"><table class="gp-table"><thead><tr><th>#</th><th>Instagram</th><th>Critérios</th><th>Prioridade</th><th>Chance extra</th></tr></thead><tbody id="gp-body"><tr><td colspan="5"><div class="gp-empty">Carregando participantes...</div></td></tr></tbody></table></div></div></div>`;
    app.appendChild(section);
    section.querySelectorAll('input').forEach(el => el.addEventListener('change', saveRules));
    $('#gp-refresh')?.addEventListener('click', loadRankings);
    $('#gp-copy')?.addEventListener('click', copyForSorter);
    $('#gp-sheet')?.addEventListener('click', copySheet);
    $('#gp-csv')?.addEventListener('click', downloadCsv);
    return section;
  }

  function ruleRow(id,title,copy,rule) {
    return `<label class="gp-rule"><input id="gp-${id}-on" type="checkbox" ${rule.enabled?'checked':''}><span><strong>${esc(title)}</strong><small>${esc(copy)}</small></span><span class="gp-pct"><input id="gp-${id}-pct" type="number" min="0" max="500" step="5" value="${esc(rule.pct)}"><span>%</span></span></label>`;
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
      allMap = new Map(all.map(x=>[key(x.username),x])); weekMap = new Map(week.map(x=>[key(x.username),x])); weekOrder = week.map(x=>key(x.username));
      render();
    } catch (e) { console.error('[Giveaway priority ranking]',e); }
    finally { if(btn){btn.disabled=false;btn.textContent='↻ Atualizar dados';} }
  }

  function matched(x, r) {
    const a=allMap.get(key(x.username))||{}; const w=weekMap.get(key(x.username))||{}; const pos=weekOrder.indexOf(key(x.username))+1;
    const reasons=[]; let pct=0;
    const add=(id,label,ok)=>{if(r[id].enabled&&ok){pct+=num(r[id].pct);reasons.push(`${label} +${num(r[id].pct)}%`);}};
    add('commented','Comentou',num(a.comments)>0);
    add('story','Story',num(a.stories)>0);
    add('top20','Top 20',pos>0&&pos<=20);
    add('active3','3 dias',num(w.activeDays)>=3);
    add('active5','5 dias',num(w.activeDays)>=5);
    add('active7','7 dias',num(w.activeDays)>=7);
    const weight=Math.min(Math.max(1,num(r.cap)||3),1+pct/100);
    return {...x,weight:Math.round(weight*100)/100,pct:Math.round((weight-1)*100),reasons,pos,all:a,week:w};
  }

  function rows() {
    const seen=new Set(); const r=rules();
    return entries.filter(x=>{const k=key(x.username);if(!k||seen.has(k))return false;seen.add(k);return true;}).map(x=>matched(x,r));
  }

  function weightLabel(v) { return String(Math.round(num(v)*100)/100).replace('.',',')+'×'; }

  function render() {
    const body=$('#gp-body'); if(!body)return; const list=rows(); const prioritized=list.filter(x=>x.weight>1); const max=Math.max(1,...list.map(x=>x.weight));
    $('#gp-total').textContent=String(list.length); $('#gp-prioritized').textContent=String(prioritized.length); $('#gp-max').textContent=weightLabel(max);
    if(!list.length){body.innerHTML='<tr><td colspan="5"><div class="gp-empty">Nenhum participante neste sorteio.</div></td></tr>';return;}
    body.innerHTML=list.map((x,i)=>`<tr><td>${i+1}</td><td class="gp-user">@${esc(x.username)}</td><td class="gp-reasons">${x.reasons.length?esc(x.reasons.join(' • ')):'Sem bônus'}</td><td class="gp-weight">${esc(weightLabel(x.weight))}</td><td>${x.pct?`+${x.pct}%`:'Normal'}</td></tr>`).join('');
  }

  async function copyText(text,msg) {
    try { await navigator.clipboard.writeText(text); }
    catch (_) { const a=document.createElement('textarea');a.value=text;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove(); }
    const base=$('#give-message'); if(base){base.textContent=msg;base.className='admin-message is-success';}
  }

  function copyForSorter() {
    const list=rows(); if(!list.length)return;
    copyText(list.map(x=>`@${x.username} ${weightLabel(x.weight)}`).join('\n'),'Lista com prioridades copiada. Cole direto no Sorteador Nakateam.');
  }

  function copySheet() {
    const list=rows(); if(!list.length)return;
    copyText(['instagram\tprioridade\tchance_extra\tcriterios',...list.map(x=>`@${x.username}\t${String(x.weight).replace('.',',')}\t${x.pct}%\t${x.reasons.join(' | ')}`)].join('\n'),'Planilha com prioridades copiada.');
  }

  function downloadCsv() {
    const list=rows(); if(!list.length)return;
    const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const csv='\ufeff'+[['instagram','prioridade','chance_extra','criterios'],...list.map(x=>[`@${x.username}`,String(x.weight).replace('.',','),`${x.pct}%`,x.reasons.join(' | ')])].map(r=>r.map(q).join(';')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`sorteio-prioridades-${current?.id||'comunidade'}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
  }

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
