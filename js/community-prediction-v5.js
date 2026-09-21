(function communityPredictionV5(){
  'use strict';

  if (!/interacoes\.html$/i.test(location.pathname)) return;
  if (window.__CFF_COMMUNITY_PREDICTION_V5__) return;
  window.__CFF_COMMUNITY_PREDICTION_V5__ = true;

  const API='https://cff-instagram-community.nakataffb4.workers.dev';
  const SESSION_KEY='cff_daily_checkin_session_v1';
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const session=()=>{try{return localStorage.getItem(SESSION_KEY)||''}catch{return''}};
  const state={payload:null,activeDay:0,busy:false,rankingPeriod:'week',drafts:new Map(),playerSearch:new Map()};

  async function request(path,options={}){
    const r=await fetch(API+path,{cache:'no-store',headers:{'Content-Type':'application/json',Accept:'application/json',...(options.headers||{})},...options});
    let data={};try{data=await r.json()}catch{}
    if(!r.ok){const e=new Error(data?.error||`HTTP ${r.status}`);e.status=r.status;throw e}
    return data;
  }

  function injectCss(){
    if($('#cff-prediction-v5-css'))return;
    const s=document.createElement('style');
    s.id='cff-prediction-v5-css';
    s.textContent=`
      .cff-pred-v5{display:grid;gap:14px}
      .cff-pred-v5-hero{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:22px;border:1px solid rgba(0,200,255,.2);border-radius:17px;background:linear-gradient(135deg,rgba(0,200,255,.08),rgba(8,14,24,.98) 55%)}
      .cff-pred-v5-kicker{color:#00c8ff;font-size:.65rem;font-weight:1000;letter-spacing:1.3px;text-transform:uppercase}
      .cff-pred-v5-hero h2{margin:5px 0 6px;color:#fff;font-size:clamp(1.25rem,3vw,1.9rem);font-weight:1000;line-height:1;text-transform:uppercase}
      .cff-pred-v5-hero p{margin:0;max-width:650px;color:#839fbd;font-size:.76rem;font-weight:750;line-height:1.5}
      .cff-pred-v5-badge{flex:0 0 auto;padding:9px 11px;border:1px solid rgba(0,200,255,.22);border-radius:10px;background:rgba(0,200,255,.07);color:#bdefff;font-size:.65rem;font-weight:950;text-transform:uppercase}
      .cff-pred-day-tabs{display:flex;gap:7px;padding:5px;border:1px solid #1d2a42;border-radius:12px;background:#070d17}
      .cff-pred-day-tab{flex:1;min-height:44px;border:0;border-radius:8px;background:transparent;color:#7690ae;font-weight:950;cursor:pointer;text-transform:uppercase}
      .cff-pred-day-tab.is-active{background:#122237;color:#fff;box-shadow:inset 0 0 0 1px rgba(0,200,255,.3)}
      .cff-pred-day-tab small{display:block;margin-top:2px;color:#617e9e;font-size:.55rem}
      .cff-pred-day-tab.is-active small{color:#91cfe2}
      .cff-pred-day-card{border:1px solid #1d2a42;border-radius:17px;background:#0a111d;overflow:hidden}
      .cff-pred-day-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #1d2a42}
      .cff-pred-day-head strong{color:#fff;font-size:.9rem;font-weight:1000;text-transform:uppercase}
      .cff-pred-day-head span{color:#6f8baa;font-size:.63rem;font-weight:850}
      .cff-pred-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px}
      .cff-pred-field{min-width:0;padding:13px;border:1px solid rgba(255,255,255,.075);border-radius:12px;background:#070d17}
      .cff-pred-field.mvp{grid-column:1/-1;border-color:rgba(255,195,49,.15)}
      .cff-pred-label{display:block;margin-bottom:8px;color:#00c8ff;font-size:.61rem;font-weight:1000;letter-spacing:.8px;text-transform:uppercase}
      .cff-pred-field.worst .cff-pred-label{color:#ffad83}.cff-pred-field.mvp .cff-pred-label{color:#ffd06a}
      .cff-pred-question{display:block;margin-bottom:10px;color:#edf6ff;font-size:.82rem;font-weight:900}
      .cff-pred-input-row{display:grid;grid-template-columns:minmax(0,1fr) 132px;gap:8px}
      .cff-pred-control{width:100%;height:42px;border:1px solid #263953;border-radius:9px;background:#050a12;color:#fff;padding:0 10px;outline:none;font-weight:850}
      .cff-pred-control:focus{border-color:#00c8ff;box-shadow:0 0 0 3px rgba(0,200,255,.06)}
      .cff-pred-control[disabled]{opacity:.6}
      .cff-pred-help{display:block;margin-top:7px;color:#627d9b;font-size:.61rem;font-weight:750;line-height:1.4}
      .cff-pred-selected{display:flex;align-items:center;gap:8px;margin-top:8px;padding:8px 10px;border:1px solid rgba(255,195,49,.15);border-radius:9px;background:rgba(255,195,49,.04);color:#ffe2a0;font-size:.67rem;font-weight:900}
      .cff-pred-selected b{color:#fff}
      .cff-pred-day-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-top:1px solid #1d2a42;background:#080e18}
      .cff-pred-day-status{color:#7894b3;font-size:.65rem;font-weight:800;line-height:1.4}
      .cff-pred-day-status.ok{color:#74dfa9}.cff-pred-day-status.warn{color:#ffd477}
      .cff-pred-save{min-height:42px;padding:0 16px;border:1px solid #00c8ff;border-radius:9px;background:#00c8ff;color:#03111a;font-size:.68rem;font-weight:1000;text-transform:uppercase;cursor:pointer}
      .cff-pred-save:disabled{opacity:.42;cursor:default}
      .cff-public-votes{margin:0 12px 12px;border:1px solid rgba(0,200,255,.13);border-radius:12px;background:#070c15;overflow:hidden}
      .cff-public-votes-head{display:flex;justify-content:space-between;gap:10px;padding:11px 13px;border-bottom:1px solid rgba(255,255,255,.07)}
      .cff-public-votes-head strong{color:#fff;font-size:.73rem;text-transform:uppercase}.cff-public-votes-head span{color:#6d8aa9;font-size:.61rem}
      .cff-public-votes-wrap{overflow:auto}
      .cff-public-votes table{width:100%;min-width:620px;border-collapse:collapse}
      .cff-public-votes th,.cff-public-votes td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.055);text-align:left;font-size:.68rem}
      .cff-public-votes th{color:#607e9e;background:#060b12;font-size:.58rem;text-transform:uppercase}
      .cff-public-votes td{color:#dce9f6}.cff-public-votes td:first-child{color:#fff;font-weight:900}
      .cff-public-votes-empty{padding:16px;color:#6f8baa;font-size:.68rem;text-align:center}
      .cff-pred-custom{margin-top:2px;border:1px solid #1d2a42;border-radius:14px;background:#0a111d;padding:13px}
      .cff-pred-custom strong{display:block;color:#fff;font-size:.78rem}.cff-pred-custom small{color:#6985a4;font-size:.61rem}
      .cff-pred-rank-v5{border:1px solid #1d2a42;border-radius:17px;background:#0a111d;overflow:hidden}
      .cff-pred-rank-v5-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 17px;border-bottom:1px solid #1d2a42}
      .cff-pred-rank-v5-head h3{margin:0;color:#fff;font-size:.82rem;text-transform:uppercase}
      .cff-pred-rank-tabs{display:flex;gap:5px}.cff-pred-rank-tab{border:1px solid #263853;border-radius:8px;background:transparent;color:#718dab;padding:6px 9px;font-size:.59rem;font-weight:950;text-transform:uppercase;cursor:pointer}
      .cff-pred-rank-tab.is-active{border-color:#00c8ff;background:rgba(0,200,255,.08);color:#dff9ff}
      .cff-pred-rank-list{display:grid}.cff-pred-rank-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:11px 15px;border-bottom:1px solid rgba(255,255,255,.055)}
      .cff-pred-rank-row:last-child{border-bottom:0}.cff-pred-rank-pos{color:#6b88a8;font-weight:1000}.cff-pred-rank-user{min-width:0;border:0;background:none;padding:0;overflow:hidden;color:#eef7ff;font:950 .72rem/1.2 inherit;text-align:left;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}.cff-pred-rank-user:hover{color:#00c8ff;text-decoration:underline}.cff-pred-rank-stat{color:#6f8baa;font-size:.61rem}.cff-pred-rank-points{color:#00c8ff;font-size:.73rem;font-weight:1000}
      .cff-pred-profile-overlay{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:16px;background:rgba(2,6,12,.78);backdrop-filter:blur(6px)}
      .cff-pred-profile{width:min(780px,100%);max-height:min(88vh,820px);overflow:auto;border:1px solid rgba(0,200,255,.25);border-radius:18px;background:#09111d;box-shadow:0 26px 80px rgba(0,0,0,.48)}
      .cff-pred-profile-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #1d2a42;background:rgba(9,17,29,.97);backdrop-filter:blur(8px)}
      .cff-pred-profile-head small{display:block;color:#00c8ff;font-size:.58rem;font-weight:1000;letter-spacing:.9px;text-transform:uppercase}.cff-pred-profile-head h3{margin:3px 0 0;color:#fff;font-size:1rem}
      .cff-pred-profile-close{display:grid;place-items:center;width:36px;height:36px;border:1px solid #273a54;border-radius:9px;background:#101a29;color:#9bb2ca;font-size:1rem;cursor:pointer}.cff-pred-profile-close:hover{border-color:#00c8ff;color:#fff}
      .cff-pred-profile-body{display:grid;gap:10px;padding:12px}
      .cff-pred-profile-day{border:1px solid #1d2a42;border-radius:13px;background:#070d17;overflow:hidden}
      .cff-pred-profile-day-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 13px;border-bottom:1px solid rgba(255,255,255,.06)}
      .cff-pred-profile-day-head strong{color:#fff;font-size:.72rem;text-transform:uppercase}.cff-pred-profile-day-head span{color:#6e89a7;font-size:.6rem;font-weight:850}
      .cff-pred-profile-day.is-future{opacity:.72}
      .cff-pred-profile-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:rgba(255,255,255,.055)}
      .cff-pred-profile-pick{min-width:0;padding:12px;background:#08101b}
      .cff-pred-profile-pick>span{display:block;color:#6885a4;font-size:.56rem;font-weight:1000;letter-spacing:.7px;text-transform:uppercase}
      .cff-pred-profile-pick strong{display:block;margin-top:5px;color:#eef7ff;font-size:.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .cff-pred-profile-pick b{display:block;margin-top:4px;color:#00c8ff;font-size:.65rem}
      .cff-pred-profile-pick small{display:block;margin-top:5px;color:#617e9d;font-size:.58rem;line-height:1.35}
      .cff-pred-profile-pick .is-hit{color:#75dfa8}.cff-pred-profile-pick .is-miss{color:#ff9ca8}.cff-pred-profile-lock{padding:19px 14px;color:#687f99;font-size:.67rem;font-weight:850;text-align:center}
      .cff-pred-profile-loading{padding:36px 20px;color:#7994b2;text-align:center;font-size:.73rem;font-weight:850}
      .cff-pred-empty{padding:24px;color:#748fab;text-align:center;font-size:.72rem;font-weight:800}
      @media(max-width:700px){.cff-pred-v5-hero{align-items:flex-start;flex-direction:column}.cff-pred-v5-badge{width:100%;text-align:center}.cff-pred-form-grid{grid-template-columns:1fr}.cff-pred-field.mvp{grid-column:auto}.cff-pred-input-row{grid-template-columns:1fr}.cff-pred-day-foot{align-items:stretch;flex-direction:column}.cff-pred-save{width:100%}.cff-pred-rank-row{grid-template-columns:30px minmax(0,1fr) auto}.cff-pred-rank-stat{display:none}.cff-pred-profile-overlay{padding:8px}.cff-pred-profile{max-height:94vh}.cff-pred-profile-grid{grid-template-columns:1fr}.cff-pred-profile-head{padding:13px 14px}}
    `;
    document.head.appendChild(s);
  }

  function injectRankingRule(){
    const rules=document.querySelector('.ig-rules');
    if(!rules||document.getElementById('ig-rule-prediction'))return;
    const row=document.createElement('div');
    row.className='ig-rule';
    row.id='ig-rule-prediction';
    row.innerHTML='<div class="ig-rule-icon">🎯</div><div><strong>Palpites da WB</strong><small>Participe nos dois dias: melhor, pior e MVP. Participação soma pontos e os acertos rendem bônus.</small></div><div class="ig-rule-points">BÔNUS</div>';
    const note=rules.querySelector('.ig-note');
    if(note)rules.insertBefore(row,note);else rules.appendChild(row);
  }

  function mount(){
    injectCss();
    injectRankingRule();
    const root=$('#cff-predictions-mount');
    if(root)return root;
    return null;
  }

  function rankingMount(){
    injectCss();
    return $('#cff-prediction-ranking-mount');
  }

  function fmtDeadline(ms){
    if(!ms)return'';
    try{return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'long',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(Number(ms))).replace(/^./,m=>m.toUpperCase())}
    catch{return''}
  }

  function fmtDayDate(day){
    const ms=Number(day?.closesAt||0);
    if(!ms)return`Dia ${num(day?.day)}`;
    try{
      const date=new Date(ms);
      const weekday=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'long'}).format(date).replace(/^./,m=>m.toUpperCase());
      const dm=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit'}).format(date);
      return `${weekday} ${dm}`;
    }catch{return`Dia ${num(day?.day)}`}
  }

  function weekendSummary(days){
    const list=(days||[]).map(day=>fmtDayDate(day)).filter(Boolean);
    return list.join(' e ');
  }

  function optionDisplay(o){
    if(!o)return'';
    return o.team?`${o.label} — ${o.team}`:o.label;
  }

  function voteFor(id){return state.payload?.votes?.[id]||null}
  function draftFor(p){
    if(state.drafts.has(p.id))return state.drafts.get(p.id);
    const v=voteFor(p.id);
    const d={option:v?.option||'',points:v?.points==null?'':String(v.points)};
    state.drafts.set(p.id,d);
    return d;
  }
  function open(p){return p?.status==='open'&&(!p.closesAt||Date.now()<Number(p.closesAt))}
  function dayPredictions(day){return Array.isArray(day?.predictions)?day.predictions:[]}
  function pred(day,metric){return dayPredictions(day).find(p=>p.metric===metric)||null}

  function teamField(p,kind){
    if(!p)return'';
    const d=draftFor(p),editable=Boolean(state.payload?.linked)&&open(p);
    const options=(p.options||[]).map(o=>`<option value="${esc(o.id)}" ${d.option===o.id?'selected':''}>${esc(o.label)}</option>`).join('');
    const title=kind==='worst'?'📉 Pior equipe':'🔥 Melhor equipe';
    return `<div class="cff-pred-field ${kind}">
      <span class="cff-pred-label">${title}</span>
      <strong class="cff-pred-question">${esc(p.question||'')}</strong>
      <div class="cff-pred-input-row">
        <select class="cff-pred-control" data-team-option="${esc(p.id)}" ${editable?'':'disabled'}><option value="">Escolha uma equipe</option>${options}</select>
        <input class="cff-pred-control" type="number" min="0" max="300" step="1" inputmode="numeric" data-pred-points="${esc(p.id)}" value="${esc(d.points)}" placeholder="Pontos" ${editable?'':'disabled'}>
      </div>
      <small class="cff-pred-help">${d.option?`Seu palpite atual: ${esc((p.options||[]).find(o=>o.id===d.option)?.label||'—')}${d.points!==''?` • ${esc(d.points)} pts`:''}`:'Escolha o time e estime a pontuação do dia.'}</small>
    </div>`;
  }

  function mvpField(p){
    if(!p)return'';
    const d=draftFor(p),editable=Boolean(state.payload?.linked)&&open(p);
    const selected=(p.options||[]).find(o=>o.id===d.option);
    const value=state.playerSearch.get(p.id)??(selected?optionDisplay(selected):'');
    const listId=`cff-mvp-list-${String(p.id).replace(/[^a-z0-9_-]/gi,'')}`;
    const opts=(p.options||[]).map(o=>`<option value="${esc(optionDisplay(o))}"></option>`).join('');
    return `<div class="cff-pred-field mvp">
      <span class="cff-pred-label">⭐ MVP do dia</span>
      <strong class="cff-pred-question">${esc(p.question||'Quem será o MVP?')}</strong>
      <div class="cff-pred-input-row">
        <div><input class="cff-pred-control" list="${esc(listId)}" data-player-search="${esc(p.id)}" value="${esc(value)}" placeholder="Pesquise o nome do jogador" autocomplete="off" ${editable?'':'disabled'}><datalist id="${esc(listId)}">${opts}</datalist></div>
        <input class="cff-pred-control" type="number" min="0" max="60" step="1" inputmode="numeric" data-pred-points="${esc(p.id)}" value="${esc(d.points)}" placeholder="Kills" ${editable?'':'disabled'}>
      </div>
      ${selected?`<div class="cff-pred-selected">Selecionado: <b>${esc(selected.label)}</b><span>${esc(selected.team||'')}</span></div>`:''}
      <small class="cff-pred-help">Digite o nome, escolha uma sugestão e estime quantos abates o jogador fará no dia.</small>
    </div>`;
  }

  function publicVotes(day){
    const predictions=dayPredictions(day);
    const best=predictions.find(p=>p.metric==='best'),worst=predictions.find(p=>p.metric==='worst'),mvp=predictions.find(p=>p.metric==='mvp');
    const publicMap=state.payload?.publicVotes||{};
    if(Date.now()<Number(day?.closesAt||0))return'';
    const byUser=new Map();
    for(const p of [best,worst,mvp].filter(Boolean)){
      for(const vote of publicMap[p.id]||[]){
        const key=norm(vote.username);
        if(!byUser.has(key))byUser.set(key,{username:vote.username});
        byUser.get(key)[p.metric]=vote;
      }
    }
    const rows=[...byUser.values()];
    return `<div class="cff-public-votes">
      <div class="cff-public-votes-head"><strong>Palpites da comunidade • Dia ${num(day.day)} • ${esc(fmtDayDate(day))}</strong><span>Visíveis após 13h de ${esc(fmtDayDate(day))}</span></div>
      ${rows.length?`<div class="cff-public-votes-wrap"><table><thead><tr><th>Usuário</th><th>Melhor</th><th>Pior</th><th>MVP</th></tr></thead><tbody>${rows.map(row=>`<tr><td>@${esc(row.username)}</td><td>${row.best?`${esc(row.best.optionLabel)}${row.best.points==null?'':` • ${num(row.best.points)} pts`}`:'—'}</td><td>${row.worst?`${esc(row.worst.optionLabel)}${row.worst.points==null?'':` • ${num(row.worst.points)} pts`}`:'—'}</td><td>${row.mvp?`${esc(row.mvp.optionLabel)}${row.mvp.points==null?'':` • ${num(row.mvp.points)} K`}`:'—'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="cff-public-votes-empty">Ainda não há palpites registrados para mostrar.</div>'}
    </div>`;
  }

  function dayComplete(day){
    return dayPredictions(day).filter(p=>['best','worst','mvp'].includes(p.metric)).every(p=>{
      const d=draftFor(p);
      return Boolean(d.option)&&d.points!==''&&Number.isFinite(Number(d.points));
    });
  }

  function dayChanged(day){
    return dayPredictions(day).some(p=>{
      const d=draftFor(p),v=voteFor(p.id);
      return !v||v.option!==d.option||Number(v.points)!==Number(d.points);
    });
  }

  function dayCard(day){
    const ps=dayPredictions(day),best=pred(day,'best'),worst=pred(day,'worst'),mvp=pred(day,'mvp');
    const isOpen=ps.some(open),linked=Boolean(state.payload?.linked),hasVotes=ps.some(p=>voteFor(p.id));
    let status='';
    if(!linked)status='<span class="cff-pred-day-status warn">Vincule seu Instagram no check-in para liberar os palpites.</span>';
    else if(!isOpen)status='<span class="cff-pred-day-status warn">Palpites encerrados. Agora os palpites da comunidade estão públicos abaixo.</span>';
    else if(hasVotes)status=`<span class="cff-pred-day-status ok">Seu palpite já foi salvo. Você pode alterar até <b>13h de ${esc(fmtDayDate(day))}</b>.</span>`;
    else status=`<span class="cff-pred-day-status">Preencha os 3 campos e salve o dia inteiro. O prazo termina às <b>13h de ${esc(fmtDayDate(day))}</b>.</span>`;
    const can=linked&&isOpen&&dayComplete(day)&&dayChanged(day)&&!state.busy;
    return `<article class="cff-pred-day-card">
      <div class="cff-pred-day-head"><strong>FFWS BR 2026 S2 • Dia ${num(day.day)} • ${esc(fmtDayDate(day))}</strong><span>PALPITES ATÉ ${esc(fmtDeadline(day.closesAt))}</span></div>
      <div class="cff-pred-form-grid">${teamField(best,'best')}${teamField(worst,'worst')}${mvpField(mvp)}</div>
      <div class="cff-pred-day-foot">${status}${!linked?'<button class="cff-pred-save" type="button" data-open-checkin>Ir para o check-in</button>':linked&&isOpen?`<button class="cff-pred-save" type="button" data-save-day="${num(day.day)}" ${can?'':'disabled'}>${hasVotes?'Salvar alterações':'Salvar palpites do dia'}</button>`:''}</div>
      ${publicVotes(day)}
    </article>`;
  }

  function customMarkup(p){
    const v=voteFor(p.id),editable=Boolean(state.payload?.linked)&&open(p),d=draftFor(p);
    return `<article class="cff-pred-custom"><strong>${esc(p.label||'Palpite extra')}</strong><small>${esc(p.question||'')}</small><div class="cff-pred-input-row" style="margin-top:9px"><select class="cff-pred-control" data-custom-option="${esc(p.id)}" ${editable?'':'disabled'}><option value="">Escolha</option>${(p.options||[]).map(o=>`<option value="${esc(o.id)}" ${d.option===o.id?'selected':''}>${esc(o.label)}</option>`).join('')}</select>${editable?`<button class="cff-pred-save" type="button" data-save-custom="${esc(p.id)}" ${d.option?'':'disabled'}>Salvar</button>`:`<div class="cff-pred-day-status">${v?`Seu palpite: ${esc((p.options||[]).find(o=>o.id===v.option)?.label||v.option)}`:'Encerrado'}</div>`}</div></article>`;
  }

  function render(){
    const root=mount();if(!root)return;
    const data=state.payload||{},days=Array.isArray(data.days)?data.days:[];
    if(!days.length){root.innerHTML='<div class="cff-pred-empty">Nenhum fim de semana de palpites disponível agora.</div>';return}
    if(!state.activeDay||!days.some(d=>num(d.day)===num(state.activeDay))){
      const future=days.find(d=>Number(d.closesAt)>Date.now())||days[0];
      state.activeDay=num(future?.day);
    }
    const active=days.find(d=>num(d.day)===num(state.activeDay))||days[0];
    const custom=(Array.isArray(data.predictions)?data.predictions:[]).filter(p=>p.category==='custom');
    root.innerHTML=`<div class="cff-pred-v5">
      <div class="cff-pred-v5-hero"><div><div class="cff-pred-v5-kicker">🎯 Palpites da comunidade</div><h2>Palpites do fim de semana</h2><p><b>${esc(weekendSummary(days))}</b>. Cada dia fecha separadamente às 13h da própria data — o palpite de sábado não fica aberto até domingo.</p></div><div class="cff-pred-v5-badge">${data.linked?`@${esc(data.username||'vinculado')}`:'Instagram não vinculado'}</div></div>
      <div class="cff-pred-day-tabs">${days.map(day=>`<button class="cff-pred-day-tab ${num(day.day)===num(state.activeDay)?'is-active':''}" type="button" data-day="${num(day.day)}">Dia ${num(day.day)} • ${esc(fmtDayDate(day))}<small>${Number(day.closesAt)>Date.now()?`ABERTO ATÉ 13H DE ${esc(fmtDayDate(day))}`:'ENCERRADO'}</small></button>`).join('')}</div>
      ${dayCard(active)}
      ${custom.length?`<div>${custom.map(customMarkup).join('')}</div>`:''}
    </div>`;
    bind();
  }

  function bind(){
    const root=mount();if(!root)return;
    root.querySelectorAll('[data-day]').forEach(btn=>btn.addEventListener('click',()=>{state.activeDay=num(btn.dataset.day);render()}));
    root.querySelectorAll('[data-team-option]').forEach(input=>input.addEventListener('change',()=>{
      const id=input.dataset.teamOption,p=findPrediction(id),d=draftFor(p);d.option=input.value||'';state.drafts.set(id,d);render();
    }));
    root.querySelectorAll('[data-pred-points]').forEach(input=>input.addEventListener('input',()=>{
      const id=input.dataset.predPoints,p=findPrediction(id);if(!p)return;const d=draftFor(p);d.points=input.value===''?'':String(Math.max(0,Math.round(Number(input.value)||0)));state.drafts.set(id,d);
      const day=currentDay();const save=root.querySelector('[data-save-day]');if(save)save.disabled=!(day&&dayComplete(day)&&dayChanged(day)&&state.payload?.linked&&!state.busy);
    }));
    root.querySelectorAll('[data-player-search]').forEach(input=>{
      const apply=()=>{
        const id=input.dataset.playerSearch,p=findPrediction(id);if(!p)return;state.playerSearch.set(id,input.value);
        const key=norm(input.value);
        const option=(p.options||[]).find(o=>norm(optionDisplay(o))===key)||(p.options||[]).find(o=>norm(o.label)===key);
        const d=draftFor(p);d.option=option?.id||'';state.drafts.set(id,d);
        if(option)render();
      };
      input.addEventListener('change',apply);
    });
    root.querySelectorAll('[data-save-day]').forEach(btn=>btn.addEventListener('click',()=>submitDay(num(btn.dataset.saveDay))));
    root.querySelectorAll('[data-open-checkin]').forEach(btn=>btn.addEventListener('click',()=>{window.cffOpenCommunityTab?.('ranking');setTimeout(()=>document.getElementById('cff-community-checkin')?.focus?.({preventScroll:true}),0)}));
    root.querySelectorAll('[data-custom-option]').forEach(input=>input.addEventListener('change',()=>{const p=findPrediction(input.dataset.customOption),d=draftFor(p);d.option=input.value||'';state.drafts.set(p.id,d);render()}));
    root.querySelectorAll('[data-save-custom]').forEach(btn=>btn.addEventListener('click',()=>submitCustom(btn.dataset.saveCustom)));
  }

  function currentDay(){return (state.payload?.days||[]).find(d=>num(d.day)===num(state.activeDay))||null}
  function findPrediction(id){
    for(const day of state.payload?.days||[]){const p=(day.predictions||[]).find(x=>x.id===id);if(p)return p}
    return (state.payload?.predictions||[]).find(x=>x.id===id)||null;
  }

  async function submitOne(p,d){
    return request('/api/prediction/vote',{method:'POST',body:JSON.stringify({session:session(),predictionId:p.id,option:d.option,points:['team_points','player_kills'].includes(p.kind)?Number(d.points):null})});
  }

  async function submitDay(dayNumber){
    const day=(state.payload?.days||[]).find(d=>num(d.day)===num(dayNumber));
    if(!day||state.busy||!dayComplete(day))return;
    state.busy=true;render();
    try{
      let latest=null;
      for(const p of dayPredictions(day).filter(p=>['best','worst','mvp'].includes(p.metric)))latest=await submitOne(p,draftFor(p));
      dayPredictions(day).forEach(p=>{state.drafts.delete(p.id);state.playerSearch.delete(p.id)});
      if(latest?.all)state.payload=latest.all;else await load(false);
      render();
    }catch(e){console.error('[CFF Predictions day]',e);alert(e.message||'Não foi possível salvar os palpites.')}
    finally{state.busy=false;render()}
  }

  async function submitCustom(id){
    const p=findPrediction(id),d=p?draftFor(p):null;
    if(!p||!d?.option||state.busy)return;
    state.busy=true;
    try{const data=await submitOne(p,d);if(data?.all)state.payload=data.all;state.drafts.delete(id);render()}
    catch(e){console.error('[CFF custom prediction]',e)}
    finally{state.busy=false}
  }

  async function load(showLoading=true){
    const root=mount();if(!root)return;
    if(showLoading)root.innerHTML='<div class="cff-pred-empty">Carregando palpites...</div>';
    try{
      const qs=new URLSearchParams();if(session())qs.set('session',session());qs.set('_',String(Date.now()));
      state.payload=await request('/api/predictions?'+qs.toString());
      render();
      loadRanking();
    }catch(e){
      console.error('[CFF Predictions]',e);
      root.innerHTML='<div class="cff-pred-empty">Palpites temporariamente indisponíveis.</div>';
    }
  }

  function profileMetricLabel(metric){
    if(metric==='best')return'🔥 Melhor equipe';
    if(metric==='worst')return'📉 Pior equipe';
    if(metric==='mvp')return'⭐ MVP';
    return'Palpite';
  }

  function profilePickMarkup(p){
    if(!p?.revealed)return`<div class="cff-pred-profile-pick"><span>${esc(profileMetricLabel(p?.metric))}</span><strong>—</strong><small>Palpite ainda não revelado</small></div>`;
    if(!p.vote)return`<div class="cff-pred-profile-pick"><span>${esc(profileMetricLabel(p.metric))}</span><strong>Não participou</strong><small>Nenhum palpite registrado</small></div>`;
    const value=p.vote.points==null?'':p.metric==='mvp'?`${num(p.vote.points)} K`:`${num(p.vote.points)} pts`;
    const result=p.result?(p.result.points==null?p.result.optionLabel:`${p.result.optionLabel} • ${num(p.result.points)} ${p.metric==='mvp'?'K':'pts'}`):'Resultado ainda pendente';
    const resultClass=p.result?(p.vote.correctSelection?'is-hit':'is-miss'):'';
    const verdict=p.result?(p.vote.correctSelection?'✓ Acertou a escolha':'✕ Escolha diferente'):'';
    return`<div class="cff-pred-profile-pick">
      <span>${esc(profileMetricLabel(p.metric))}</span>
      <strong>${esc(p.vote.optionLabel||'—')}</strong>
      ${value?`<b>${esc(value)}</b>`:''}
      <small>Resultado: ${esc(result)}</small>
      ${verdict?`<small class="${resultClass}">${esc(verdict)}</small>`:''}
    </div>`;
  }

  function closePredictionProfile(){
    document.getElementById('cff-pred-profile-overlay')?.remove();
    document.removeEventListener('keydown',profileEscape);
  }

  function profileEscape(e){if(e.key==='Escape')closePredictionProfile()}

  async function openPredictionProfile(userKey,username){
    closePredictionProfile();
    const overlay=document.createElement('div');
    overlay.id='cff-pred-profile-overlay';
    overlay.className='cff-pred-profile-overlay';
    overlay.innerHTML=`<section class="cff-pred-profile" role="dialog" aria-modal="true" aria-label="Perfil de palpites">
      <div class="cff-pred-profile-head"><div><small>Histórico público de palpites</small><h3>@${esc(username||'usuario')}</h3></div><button class="cff-pred-profile-close" type="button" aria-label="Fechar">✕</button></div>
      <div class="cff-pred-profile-loading">Carregando rodadas...</div>
    </section>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.cff-pred-profile-close')?.addEventListener('click',closePredictionProfile);
    overlay.addEventListener('click',e=>{if(e.target===overlay)closePredictionProfile()});
    document.addEventListener('keydown',profileEscape);
    try{
      const data=await request('/api/prediction/profile?userKey='+encodeURIComponent(userKey)+'&_='+Date.now());
      const days=Array.isArray(data?.days)?data.days:[];
      const body=overlay.querySelector('.cff-pred-profile-loading');
      const title=overlay.querySelector('.cff-pred-profile-head h3');
      if(title)title.textContent='@'+String(data?.username||username||'usuario').replace(/^@+/,'');
      if(!body)return;
      body.className='cff-pred-profile-body';
      body.innerHTML=days.length?days.map(day=>{
        const date=day.date?day.date.split('-').reverse().slice(0,2).join('/'):'';
        return`<article class="cff-pred-profile-day ${day.revealed?'':'is-future'}">
          <div class="cff-pred-profile-day-head"><strong>Dia ${num(day.day)}${date?' • '+esc(date):''}</strong><span>${day.revealed?'PALPITES LIBERADOS':'AINDA NÃO REVELADO'}</span></div>
          ${day.revealed?`<div class="cff-pred-profile-grid">${(day.predictions||[]).map(profilePickMarkup).join('')}</div>`:`<div class="cff-pred-profile-lock">Os palpites deste dia ficam ocultos até o fechamento das 13h</div>`}
        </article>`;
      }).join(''):'<div class="cff-pred-profile-loading">Nenhuma rodada encontrada.</div>';
    }catch(e){
      const body=overlay.querySelector('.cff-pred-profile-loading');
      if(body)body.textContent='Não foi possível carregar este perfil agora.';
      console.error('[CFF prediction profile]',e);
    }
  }

  async function loadRanking(){
    const root=rankingMount();if(!root)return;
    root.innerHTML='<div class="cff-pred-empty">Carregando ranking de palpites...</div>';
    try{
      const data=await request('/api/prediction/ranking?period='+encodeURIComponent(state.rankingPeriod)+'&_='+Date.now());
      const rows=Array.isArray(data?.ranking)?data.ranking:[];
      root.innerHTML=`<section class="cff-pred-rank-v5"><div class="cff-pred-rank-v5-head"><h3>🏆 Ranking de palpites</h3><div class="cff-pred-rank-tabs">${[['week','Semana'],['month','Mês'],['all','Geral']].map(([id,label])=>`<button class="cff-pred-rank-tab ${state.rankingPeriod===id?'is-active':''}" data-rank-period="${id}" type="button">${label}</button>`).join('')}</div></div><div class="cff-pred-rank-list">${rows.length?rows.slice(0,30).map((row,i)=>`<div class="cff-pred-rank-row"><span class="cff-pred-rank-pos">${i+1}º</span><button class="cff-pred-rank-user" type="button" data-pred-profile="${esc(row.userKey||'')}" data-pred-username="${esc(row.username||'usuario')}" title="Ver palpites de @${esc(row.username||'usuario')}">@${esc(row.username||'usuario')}</button><span class="cff-pred-rank-stat">${num(row.wins)} acertos • ${num(row.participations)} palpites</span><strong class="cff-pred-rank-points">${num(row.points)} pts</strong></div>`).join(''):'<div class="cff-pred-empty">O ranking de palpites ainda não começou.</div>'}</div></section>`;
      root.querySelectorAll('[data-rank-period]').forEach(btn=>btn.addEventListener('click',()=>{state.rankingPeriod=btn.dataset.rankPeriod||'week';loadRanking()}));
      root.querySelectorAll('[data-pred-profile]').forEach(btn=>btn.addEventListener('click',()=>openPredictionProfile(btn.dataset.predProfile||'',btn.dataset.predUsername||'usuario')));
    }catch(e){root.innerHTML='<div class="cff-pred-empty">Não foi possível carregar o ranking de palpites.</div>'}
  }

  function boot(){
    if(!mount())return;
    if(location.hash==='#palpites')window.cffOpenCommunityTab?.('predictions',{updateHash:false});
    load();
    setInterval(()=>{if(!document.hidden)load(false)},5*60*1000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();