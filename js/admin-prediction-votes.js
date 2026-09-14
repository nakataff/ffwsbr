(() => {
  'use strict';
  if (!/admin-palpite\.html$/i.test(location.pathname)) return;
  if (window.__CFF_ADMIN_PREDICTION_VOTES__) return;
  window.__CFF_ADMIN_PREDICTION_VOTES__ = true;

  const API='https://cff-instagram-community.nakataffb4.workers.dev';
  const ADMIN='admin@centralfreefire.com.br';
  let payload=null,currentFilter='all',query='',loading=false;
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const fmt=ms=>ms?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(ms)):'—';

  function css(){
    if($('#cff-admin-pred-votes-css'))return;
    const s=document.createElement('style');s.id='cff-admin-pred-votes-css';s.textContent=`
      .apv{margin-top:16px}.apv-head-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.apv-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:0 16px 12px}.apv-stat{padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:rgba(255,255,255,.025)}.apv-stat span{display:block;color:#738eaa;font-size:10px;font-weight:900;text-transform:uppercase}.apv-stat strong{display:block;margin-top:5px;color:#fff;font-size:20px}.apv-tools{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(220px,1fr);gap:8px;padding:0 16px 12px}.apv-tools select,.apv-tools input{width:100%;height:42px;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:#080e18;color:#fff;padding:0 10px;outline:none}.apv-tools select:focus,.apv-tools input:focus{border-color:#00c8ff}.apv-table-wrap{overflow:auto;border-top:1px solid rgba(255,255,255,.07)}.apv-table{width:100%;border-collapse:collapse;min-width:900px}.apv-table th,.apv-table td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.055);text-align:left;font-size:12px}.apv-table th{position:sticky;top:0;background:#08101c;color:#738eaa;font-size:10px;text-transform:uppercase;letter-spacing:.04em}.apv-user{color:#fff;font-weight:1000}.apv-pred{max-width:260px;color:#d9e8f7;font-weight:850}.apv-choice{display:flex;align-items:center;gap:7px;color:#b9efff;font-weight:900}.apv-logo{width:25px;height:25px;object-fit:contain}.apv-points{color:#00c8ff;font-weight:1000}.apv-badge{display:inline-flex;padding:4px 7px;border-radius:999px;background:rgba(255,255,255,.05);color:#859bb4;font-size:10px;font-weight:950}.apv-badge.win{background:rgba(83,217,157,.1);color:#82e9b6}.apv-empty{padding:25px;text-align:center;color:#738da9;font-size:12px}.apv-note{padding:10px 16px;color:#7188a3;font-size:11px;line-height:1.45}.apv-error{color:#ff9ba6}.apv-loading{opacity:.65}@media(max-width:700px){.apv-summary{grid-template-columns:1fr 1fr 1fr}.apv-tools{grid-template-columns:1fr}.apv-head-actions .admin-btn{width:100%;justify-content:center}}@media(max-width:470px){.apv-summary{grid-template-columns:1fr}.apv-stat strong{font-size:17px}}
    `;document.head.appendChild(s);
  }

  function mount(){
    if($('#cff-admin-pred-votes'))return $('#cff-admin-pred-votes');
    const app=$('#pred-app');if(!app)return null;css();
    const section=document.createElement('section');section.className='admin-panel apv';section.id='cff-admin-pred-votes';section.innerHTML=`
      <div class="admin-panel-head admin-panel-head-wrap"><div><p class="admin-eyebrow">Auditoria</p><h2>Palpites de cada participante</h2></div><div class="apv-head-actions"><button class="admin-btn admin-btn-ghost" id="apv-refresh" type="button">↻ Atualizar</button></div></div>
      <div class="apv-summary"><div class="apv-stat"><span>Palpites registrados</span><strong id="apv-total">0</strong></div><div class="apv-stat"><span>Participantes</span><strong id="apv-users">0</strong></div><div class="apv-stat"><span>Desafios</span><strong id="apv-preds">0</strong></div></div>
      <div class="apv-tools"><select id="apv-filter"><option value="all">Todos os palpites</option></select><input id="apv-search" type="search" placeholder="Buscar por @ do Instagram"></div>
      <div class="apv-table-wrap"><table class="apv-table"><thead><tr><th>Instagram</th><th>Palpite</th><th>Escolha</th><th>Pts previstos</th><th>Resultado</th><th>Enviado em</th></tr></thead><tbody id="apv-body"><tr><td colspan="6"><div class="apv-empty">Carregando palpites...</div></td></tr></tbody></table></div>
      <div class="apv-note">Esta área é privada: os dados são liberados pelo Worker somente depois de validar sua sessão de administrador do Firebase.</div>`;
    app.appendChild(section);
    $('#apv-refresh')?.addEventListener('click',load);
    $('#apv-filter')?.addEventListener('change',e=>{currentFilter=e.target.value||'all';renderRows()});
    $('#apv-search')?.addEventListener('input',e=>{query=String(e.target.value||'').trim().replace(/^@+/, '').toLowerCase();renderRows()});
    return section;
  }

  async function authUser(){
    const {getAuth}=await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js');
    const auth=getAuth();let user=auth.currentUser;
    if(!user){await new Promise(resolve=>{const stop=auth.onAuthStateChanged(u=>{user=u;stop();resolve()})})}
    if(!user||String(user.email||'').toLowerCase()!==ADMIN)throw new Error('Sessão administrativa inválida');
    return user;
  }

  function allRows(){
    const out=[];for(const pred of payload?.predictions||[])for(const vote of pred.votes||[])out.push({...vote,predictionId:pred.id,predictionLabel:pred.label,predictionQuestion:pred.question,predictionKind:pred.kind,predictionStatus:pred.status,result:pred.result,options:pred.options||[]});return out;
  }
  function optionLogo(row){const option=(row.options||[]).find(o=>o.id===row.option);return option?.logo||''}
  function resultText(row){
    if(row.won)return `<span class="apv-badge win">GANHOU +${Number(row.bonusPoints||0)}</span>`;
    if(row.predictionStatus==='settled'){
      const result=row.result||{};const label=result.teamLabel||result.option||'Finalizado';
      if(row.predictionKind==='team_points'&&result.points!=null)return `<span class="apv-badge">${esc(label)} • ${Number(result.points)} pts</span>`;
      return `<span class="apv-badge">${esc(label)}</span>`;
    }
    return `<span class="apv-badge">${row.predictionStatus==='open'?'ABERTO':'AGUARDANDO'}</span>`;
  }
  function renderFilters(){const select=$('#apv-filter');if(!select)return;const previous=currentFilter;select.innerHTML='<option value="all">Todos os palpites</option>'+((payload?.predictions||[]).map(p=>`<option value="${esc(p.id)}">${esc(p.label||'Palpite')} • ${esc(p.question||p.id)} (${Number(p.voteCount||0)})</option>`).join(''));select.value=[...select.options].some(o=>o.value===previous)?previous:'all';currentFilter=select.value}
  function renderRows(){
    const body=$('#apv-body');if(!body)return;let rows=allRows();if(currentFilter!=='all')rows=rows.filter(r=>r.predictionId===currentFilter);if(query)rows=rows.filter(r=>String(r.username||'').toLowerCase().includes(query));
    const unique=new Set(allRows().map(r=>String(r.username||'').toLowerCase()));$('#apv-total').textContent=String(payload?.totalVotes||0);$('#apv-users').textContent=String(unique.size);$('#apv-preds').textContent=String((payload?.predictions||[]).length);
    if(!rows.length){body.innerHTML='<tr><td colspan="6"><div class="apv-empty">Nenhum palpite encontrado neste filtro.</div></td></tr>';return}
    body.innerHTML=rows.map(row=>{const logo=optionLogo(row);return `<tr><td class="apv-user">@${esc(String(row.username||'usuario').replace(/^@+/,''))}</td><td class="apv-pred"><strong>${esc(row.predictionLabel||'Palpite')}</strong><br><span style="color:#728ca8">${esc(row.predictionQuestion||row.predictionId)}</span></td><td><span class="apv-choice">${logo?`<img class="apv-logo" src="${esc(logo)}" alt="">`:''}${esc(row.optionLabel||row.option||'—')}</span></td><td class="apv-points">${row.guessedPoints==null?'—':Number(row.guessedPoints)+' pts'}</td><td>${resultText(row)}</td><td>${esc(fmt(row.votedAt))}</td></tr>`}).join('');
  }

  async function load(){
    if(loading)return;const root=mount();if(!root)return;loading=true;root.classList.add('apv-loading');const body=$('#apv-body');if(body)body.innerHTML='<tr><td colspan="6"><div class="apv-empty">Atualizando palpites...</div></td></tr>';
    try{const user=await authUser(),token=await user.getIdToken();const r=await fetch(`${API}/api/admin/prediction-votes?_=${Date.now()}`,{cache:'no-store',headers:{Accept:'application/json',Authorization:`Bearer ${token}`}});let data={};try{data=await r.json()}catch{}if(!r.ok)throw new Error(data?.error||`HTTP ${r.status}`);payload=data;renderFilters();renderRows()}
    catch(err){console.error('[Admin palpites]',err);if(body)body.innerHTML=`<tr><td colspan="6"><div class="apv-empty apv-error">${esc(err.message||'Não foi possível carregar os palpites.')}</div></td></tr>`}
    finally{loading=false;root.classList.remove('apv-loading')}
  }

  function boot(){let tries=0;const timer=setInterval(()=>{tries++;const app=$('#pred-app');if(app&&!app.hidden){clearInterval(timer);mount();load()}else if(tries>120)clearInterval(timer)},100)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();