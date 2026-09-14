(() => {
  'use strict';
  if (!/interacoes\.html$/i.test(location.pathname)) return;
  if (window.__CFF_COMMUNITY_REWARDS__) return;
  window.__CFF_COMMUNITY_REWARDS__ = true;

  const API='https://cff-instagram-community.nakataffb4.workers.dev';
  const SESSION_KEY='cff_daily_checkin_session_v1';
  let state=null,busy=false;
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
  const session=()=>{try{return localStorage.getItem(SESSION_KEY)||''}catch{return''}};

  async function request(path,options={}){
    const r=await fetch(API+path,{cache:'no-store',headers:{'Content-Type':'application/json',Accept:'application/json',...(options.headers||{})},...options});
    let data={};try{data=await r.json()}catch{}
    if(!r.ok){const e=new Error(data?.error||`HTTP ${r.status}`);e.status=r.status;throw e}return data;
  }

  function css(){
    if($('#cff-rewards-css'))return;
    const s=document.createElement('style');s.id='cff-rewards-css';s.textContent=`
      .cff-rewards{margin:0 0 18px;border:1px solid rgba(0,200,255,.20);border-radius:18px;background:linear-gradient(145deg,rgba(13,25,41,.98),rgba(6,12,21,.98));overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.19)}
      .cff-rewards-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:17px 20px;border-bottom:1px solid rgba(0,200,255,.12)}.cff-rewards-head h2{margin:0;color:#fff;font-size:.9rem;font-weight:1000;text-transform:uppercase;letter-spacing:1px}.cff-rewards-head span{color:#6885a5;font-size:.67rem;font-weight:850}
      .cff-rewards-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;padding:12px}.cff-reward-card{padding:12px;border:1px solid rgba(255,255,255,.075);border-radius:12px;background:rgba(255,255,255,.025);min-width:0}.cff-reward-card.is-done{border-color:rgba(92,224,162,.25);background:rgba(92,224,162,.05)}
      .cff-reward-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.cff-reward-icon{font-size:1rem}.cff-reward-points{color:#00c8ff;font-size:.68rem;font-weight:1000;white-space:nowrap}.cff-reward-card.is-done .cff-reward-points{color:#7be4ad}.cff-reward-title{display:block;margin-top:7px;color:#fff;font-size:.76rem;font-weight:1000}.cff-reward-copy{display:block;margin-top:4px;color:#728dac;font-size:.65rem;line-height:1.4;font-weight:750}
      .cff-reward-bar{height:5px;margin-top:9px;border-radius:99px;background:#142135;overflow:hidden}.cff-reward-bar span{display:block;height:100%;border-radius:99px;background:#00c8ff}.cff-reward-card.is-done .cff-reward-bar span{background:#68e0a5}.cff-reward-chips{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}.cff-reward-chip{padding:4px 6px;border:1px solid rgba(255,255,255,.08);border-radius:999px;color:#708ba9;font-size:.56rem;font-weight:900;text-transform:uppercase}.cff-reward-chip.ok{border-color:rgba(92,224,162,.22);background:rgba(92,224,162,.06);color:#8ce8ba}
      .cff-code{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;padding:14px 16px;border-top:1px solid rgba(0,200,255,.1);background:rgba(0,0,0,.10)}.cff-code[hidden]{display:none}.cff-code label{display:grid;gap:5px;color:#7893b2;font-size:.64rem;font-weight:950;text-transform:uppercase}.cff-code input{height:41px;border:1px solid #263b55;border-radius:9px;background:#050b13;color:#fff;padding:0 11px;outline:none;font-weight:900;text-transform:uppercase}.cff-code input:focus{border-color:#00c8ff}.cff-code button{height:41px;border:1px solid #00c8ff;border-radius:9px;background:#00c8ff;color:#03131b;padding:0 13px;font-size:.66rem;font-weight:1000;text-transform:uppercase;cursor:pointer}.cff-code button:disabled{opacity:.5}.cff-code-msg{grid-column:1/-1;color:#718daa;font-size:.66rem;font-weight:800}.cff-code-msg.ok{color:#79e2ad}.cff-code-msg.err{color:#ff9aa6}
      .cff-rewards-locked{padding:18px 20px;color:#7893b2;font-size:.74rem;font-weight:800;line-height:1.5}.cff-rewards-locked strong{color:#d9efff}
      @media(max-width:980px){.cff-rewards-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:540px){.cff-rewards-head{align-items:flex-start;flex-direction:column;padding:15px}.cff-rewards-grid{grid-template-columns:1fr;padding:9px}.cff-code{grid-template-columns:1fr}.cff-code button{width:100%}}
    `;document.head.appendChild(s);
  }

  function mount(){
    if($('#cff-community-rewards'))return $('#cff-community-rewards');
    const toolbar=$('.ig-toolbar');if(!toolbar)return null;css();
    const el=document.createElement('section');el.className='cff-rewards';el.id='cff-community-rewards';el.innerHTML='<div class="cff-rewards-locked">Carregando bônus da semana...</div>';toolbar.parentNode.insertBefore(el,toolbar);return el;
  }

  function pct(value,target){return Math.max(0,Math.min(100,target?Math.round((num(value)/num(target))*100):100))}
  function card(icon,title,copy,points,value,target,done,chips=''){
    return `<div class="cff-reward-card ${done?'is-done':''}"><div class="cff-reward-top"><span class="cff-reward-icon">${icon}</span><span class="cff-reward-points">${done?'✓ ':''}+${num(points)} pts</span></div><strong class="cff-reward-title">${esc(title)}</strong><span class="cff-reward-copy">${esc(copy)}</span><div class="cff-reward-bar"><span style="width:${pct(value,target)}%"></span></div>${chips?`<div class="cff-reward-chips">${chips}</div>`:''}</div>`;
  }

  function render(data){
    state=data;const root=mount();if(!root)return;
    if(!data?.linked){root.innerHTML='<div class="cff-rewards-head"><h2>🔥 Bônus da semana</h2><span>Constância vale ponto</span></div><div class="cff-rewards-locked"><strong>Vincule seu Instagram no check-in acima</strong><br>Depois disso você acompanha aqui sua frequência, missão semanal e códigos surpresa.</div>';return;}
    const p=data.progress||{},b=data.bonuses||{},mission=data.mission||{},rules=data.rules||{};
    const s3=num(rules.streak3Points||3),s5=num(rules.streak5Points||7),s7=num(rules.streak7Points||15),streakMax=s3+s5+s7;
    const streakDone=Boolean(b.streak7),postDone=Boolean(b.posts10),mixDone=Boolean(b.mix),missionDone=Boolean(b.mission);
    const mixChips=[['Comentário',p.comments>0],['Story',p.stories>0],['Check-in',p.checkins>0]].map(([t,ok])=>`<span class="cff-reward-chip ${ok?'ok':''}">${ok?'✓ ':''}${esc(t)}</span>`).join('');
    const missionChips=[[`Posts ${p.distinctPosts}/${mission.commentsTarget||3}`,p.distinctPosts>=(mission.commentsTarget||3)],[`Check-ins ${p.checkins}/${mission.checkinsTarget||2}`,p.checkins>=(mission.checkinsTarget||2)],[`Stories ${p.stories}/${mission.storiesTarget||1}`,p.stories>=(mission.storiesTarget||1)]].map(([t,ok])=>`<span class="cff-reward-chip ${ok?'ok':''}">${ok?'✓ ':''}${esc(t)}</span>`).join('');
    const streakPts=(b.streak3?s3:0)+(b.streak5?s5:0)+(b.streak7?s7:0);
    root.innerHTML=`<div class="cff-rewards-head"><h2>🔥 Bônus da semana</h2><span>@${esc(data.username)} • ${esc(data.weekStart||'')} a ${esc(data.weekEnd||'')}</span></div><div class="cff-rewards-grid">
      ${card('📅','Frequência',`${p.activeDays}/7 dias ativos • bônus já ganhos: ${streakPts} pts`,streakMax,p.activeDays,7,streakDone,`<span class="cff-reward-chip ${b.streak3?'ok':''}">3d +${s3}</span><span class="cff-reward-chip ${b.streak5?'ok':''}">5d +${s5}</span><span class="cff-reward-chip ${b.streak7?'ok':''}">7d +${s7}</span>`)}
      ${card('💬','Posts diferentes',`${p.distinctPosts} publicações comentadas`,10,p.distinctPosts,10,postDone,`<span class="cff-reward-chip ${b.posts5?'ok':''}">5 posts +5</span><span class="cff-reward-chip ${b.posts10?'ok':''}">10 posts +5</span>`)}
      ${card('🧩','Participação completa','Comente, mencione nos Stories e faça check-in na mesma semana',5,(p.comments>0?1:0)+(p.stories>0?1:0)+(p.checkins>0?1:0),3,mixDone,mixChips)}
      ${card('🎯',mission.label||'Missão semanal',mission.active===false?'Missão pausada':`Complete os 3 objetivos da semana`,mission.points||10,(p.distinctPosts>=(mission.commentsTarget||3)?1:0)+(p.checkins>=(mission.checkinsTarget||2)?1:0)+(p.stories>=(mission.storiesTarget||1)?1:0),3,missionDone,missionChips)}
    </div>${data.surpriseCode?.active?`<form class="cff-code" id="cff-code-form"><label>Código surpresa • +${num(data.surpriseCode.points)} pts<input id="cff-code-input" maxlength="40" autocomplete="off" placeholder="Digite o código"></label><button type="submit">Resgatar</button><div class="cff-code-msg" id="cff-code-msg">${esc(data.surpriseCode.label||'Código escondido em algum conteúdo da Central FF 👀')}</div></form>`:''}`;
    $('#cff-code-form')?.addEventListener('submit',claimCode);
  }

  async function claimCode(e){
    e.preventDefault();if(busy)return;const input=$('#cff-code-input'),msg=$('#cff-code-msg'),button=e.currentTarget.querySelector('button');const code=String(input?.value||'').trim();if(!code){msg.textContent='Digite o código primeiro.';msg.className='cff-code-msg err';return}busy=true;button.disabled=true;button.textContent='Validando...';
    try{const data=await request('/api/rewards/code',{method:'POST',body:JSON.stringify({session:session(),code})});msg.textContent=data.alreadyClaimed?'Você já resgatou este código.':`Código certo! +${num(data.points)} pts no ranking 🔥`;msg.className='cff-code-msg ok';input.value='';setTimeout(load,700)}catch(err){msg.textContent=err.message||'Código inválido.';msg.className='cff-code-msg err'}finally{busy=false;button.disabled=false;button.textContent='Resgatar'}
  }

  function injectRules(){
    const rules=$('.ig-rules');if(!rules||$('#ig-rule-weekly-bonuses'))return;
    const row=document.createElement('div');row.className='ig-rule';row.id='ig-rule-weekly-bonuses';row.innerHTML='<div class="ig-rule-icon">🔥</div><div><strong>Bônus semanais</strong><small>Frequência, posts diferentes, participação completa, missão semanal, comentário rápido e códigos surpresa.</small></div><div class="ig-rule-points">ATÉ +</div>';const note=rules.querySelector('.ig-note');if(note)rules.insertBefore(row,note);else rules.appendChild(row);
  }

  async function load(){
    if(!mount())return;injectRules();try{const qs=new URLSearchParams();if(session())qs.set('session',session());qs.set('_',Date.now());render(await request('/api/rewards/status?'+qs.toString()))}catch(err){console.error('[CFF Rewards]',err);const root=mount();if(root)root.innerHTML='<div class="cff-rewards-locked">Os bônus semanais estão temporariamente indisponíveis.</div>'}
  }

  function boot(){let tries=0;const t=setInterval(()=>{tries++;if($('.ig-toolbar')){clearInterval(t);load()}else if(tries>100)clearInterval(t)},100)}
  window.addEventListener('storage',e=>{if(e.key===SESSION_KEY)load()});document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();