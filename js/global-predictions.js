/* Palpites Global Finals 2026: escolha rápida, pesquisa local e salvamento validado no Worker. */
(function(){
 'use strict';
 const root=document.getElementById('cff-global-predictions');
 if(!root)return;
 const API='https://cff-instagram-community.nakataffb4.workers.dev';
 const SESSION='cff_daily_checkin_session_v1';
 const state={data:null,roundKey:'',drafts:new Map(),busy:false,error:'',message:'',loading:false,requestId:0,activePicker:''};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const session=()=>{try{return localStorage.getItem(SESSION)||''}catch{return''}};
 const now=()=>Date.now();
 const fmtDate=stamp=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit'}).format(new Date(stamp));
 const fmtTime=stamp=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(stamp));
 const shortStage=s=>({classificatoria:'FASE 1',segundaFase:'FASE 2',lastChance:'LAST CHANCE',final:'GRANDE FINAL'})[s]||'MUNDIAL';
 const getDraft=()=>{
  const key=state.data?.round?.key;
  if(!key)return {best:'',worst:'',mvp:''};
  if(!state.drafts.has(key))state.drafts.set(key,{best:state.data.votes?.best||'',worst:state.data.votes?.worst||'',mvp:state.data.votes?.mvp||''});
  return state.drafts.get(key);
 };
 const selectedLabel=(metric,option)=>{
  const options=metric==='mvp'?state.data?.round?.players:state.data?.round?.teams;
  return (options||[]).find(x=>x.id===option)||null;
 };
 const optionView=(metric,v)=>metric==='mvp'
  ?'<span class="gfp-avatar">'+esc((v.label||'?').slice(0,1).toUpperCase())+'</span><span><strong>'+esc(v.label)+'</strong><small>'+esc(v.team)+'</small></span>'
  :'<img src="'+esc(v.logo||'/escudo.webp')+'" alt="" loading="lazy" decoding="async" onerror="this.style.opacity=.2"><span><strong>'+esc(v.short||v.label)+'</strong><small>'+esc(v.label)+'</small></span>';
 function optionsHTML(metric,query=''){
  const r=state.data?.round,options=metric==='mvp'?r?.players:r?.teams;
  const found=(options||[]).filter(v=>norm([v.label,v.short,v.team].filter(Boolean).join(' ')).includes(norm(query)));
  return found.length?found.map(v=>'<button type="button" class="gfp-choice" role="option" data-gfp-choice="'+metric+'" data-option="'+esc(v.id)+'">'+optionView(metric,v)+'</button>').join('')
   :'<p class="gfp-not-found">Nenhum participante encontrado nesta rodada.</p>';
 }
 function countdown(stamp){
  const left=Math.max(0,Math.ceil((stamp-now())/1000));
  if(!left)return'Palpites encerrados';
  const h=Math.floor(left/3600),m=Math.floor(left%3600/60),s=left%60;
  return h+'h '+String(m).padStart(2,'0')+'m '+String(s).padStart(2,'0')+'s';
 }
 function card(metric,label,kicker,icon){
  const round=state.data.round,options=metric==='mvp'?round.players:round.teams,
   saved=getDraft()[metric],selected=selectedLabel(metric,saved),open=round.ready&&round.closesAt>now();
  const answer=round.result?.[metric]||[],correct=round.result&&selected&&answer.includes(saved);
  return '<section class="gfp-card" data-gfp-field="'+metric+'"><div class="gfp-card-top"><span class="gfp-card-icon" aria-hidden="true">'+icon+'</span>'+
   '<div><small>'+esc(kicker)+'</small><h3>'+esc(label)+'</h3></div>'+
   (selected?'<span class="gfp-tick" aria-label="Selecionado">✓</span>':'')+'</div>'+
   (selected?'<div class="gfp-selected">'+optionView(metric,selected)+'</div>':'<div class="gfp-unselected">Nenhum '+(metric==='mvp'?'jogador':'time')+' selecionado</div>')+
   (open?'<label class="gfp-search"><span class="sr-only">Buscar '+(metric==='mvp'?'jogador':'equipe')+'</span>'+
   '<input type="search" data-gfp-search="'+metric+'" placeholder="⌕ Buscar '+(metric==='mvp'?'jogador':'equipe')+'..." autocomplete="off" aria-label="Buscar '+(metric==='mvp'?'jogador':'equipe')+' participante"></label>'+
   '<div class="gfp-results" role="listbox" data-gfp-options="'+metric+'" hidden>'+optionsHTML(metric)+'</div>'
   :'<small class="gfp-locked">'+(round.ready?'Escolhas bloqueadas após o início':'Participantes ainda não confirmados')+'</small>')+
   (round.result?'<p class="gfp-verdict '+(correct?'is-hit':'')+'">Resultado: '+esc(answer.map(id=>selectedLabel(metric,id)?.label||id).join(' / ')||'—')+(selected?(correct?' · Acertou!':' · Não acertou'):'')+'</p>':'')+
   '</section>';
 }
 function render(){
  if(state.loading){root.innerHTML='<div class="gfp-loading">Carregando os palpites do Mundial…</div>';return}
  const d=state.data,round=d?.round;
  if(!round){root.innerHTML='<div class="gfp-loading">'+esc(state.error||'Não foi possível carregar os palpites.')+' <button type="button" data-gfp-retry>Tentar novamente</button></div>';return}
  const draft=getDraft(),filled=['best','worst','mvp'].filter(k=>!!draft[k]).length;
  const can=round.ready&&round.closesAt>now()&&d.linked&&!state.busy;
  const valid=filled===3&&draft.best!==draft.worst;
  root.innerHTML='<div class="gfp-shell">'+
   '<header class="gfp-hero"><div><span class="gfp-eyebrow">FFWS GLOBAL FINALS • 2026</span>'+
   '<h2>Palpites do Mundial</h2><p>Escolha a melhor equipe, a pior equipe e quem terá mais abates na rodada. Sem complicação.</p></div>'+
   '<div class="gfp-hero-meta"><strong>'+filled+'/3</strong><span>Escolhas feitas</span></div></header>'+
   '<nav class="gfp-round-rail" aria-label="Escolha a rodada">'+(d.rounds||[]).map(r=>
     '<button type="button" data-gfp-round="'+esc(r.key)+'" class="gfp-round'+(r.key===round.key?' is-active':'')+'" aria-pressed="'+(r.key===round.key)+'">'+
      '<small>'+esc(shortStage(r.stage))+'</small><strong>'+esc(fmtDate(r.closesAt))+' • '+esc(fmtTime(r.closesAt))+'</strong>'+
      '<span>'+esc(r.status==='settled'?'Apurado':r.closesAt<=now()?'Encerrado':!r.ready?'A definir':'Aberto')+'</span></button>'
   ).join('')+'</nav>'+
   '<div class="gfp-info-row"><div><span class="gfp-label">'+esc(shortStage(round.stage))+' • '+esc(round.label)+'</span>'+
     '<h3>'+esc(fmtDate(round.closesAt))+' às '+esc(fmtTime(round.closesAt))+'</h3>'+
     '<small>'+esc(round.groups?.length?'Grupos '+round.groups.join(' × ')+' · ':'')+round.teams.length+' equipes participantes</small></div>'+
   '<div class="gfp-deadline"><strong data-gfp-countdown>'+esc(countdown(round.closesAt))+'</strong>'+
    '<small>Bloqueio no início da rodada • Brasília</small></div></div>'+
   (state.error?'<div class="gfp-error" role="alert">'+esc(state.error)+'</div>':'')+
   (state.message?'<div class="gfp-success" role="status">'+esc(state.message)+'</div>':'')+
   (!d.linked?'<div class="gfp-auth"><span>Para salvar seus palpites e receber pontos, vincule seu Instagram no check-in da comunidade.</span>'+
    '<button type="button" data-gfp-checkin>Ir para o check-in</button></div>':'')+
   (!round.ready?'<div class="gfp-placeholder">Os participantes desta rodada ainda não foram confirmados. As opções aparecerão automaticamente quando o confronto for definido.</div>':'')+
   '<div class="gfp-fields">'+card('best','Melhor equipe','QUEM FARÁ MAIS PONTOS?','🏆')+
   card('worst','Pior equipe','QUEM FARÁ MENOS PONTOS?','📉')+
   card('mvp','MVP da rodada','QUEM TERÁ MAIS ABATES?','⭐')+'</div>'+
   '<div class="gfp-footer"><p>'+((round.closesAt>now())?'Você pode mudar as três escolhas quantas vezes quiser até '+fmtTime(round.closesAt)+' de '+fmtDate(round.closesAt)+'.':'Rodada iniciada: os palpites não podem mais ser alterados.')+
    '<br><span>+1 ponto por escolha enviada pela primeira vez • +5 por acerto • +3 se acertar as três.</span></p>'+
   (round.status==='open'?'<button type="button" class="gfp-save" data-gfp-save '+(can&&valid?'':'disabled')+'>'+(Object.keys(d.votes||{}).length?'Salvar alterações':'Salvar meus palpites')+'</button>':
    '<span class="gfp-closed">'+(round.status==='settled'?'✓ Resultado apurado':'Palpites fechados')+'</span>')+'</div>'+
   '<p class="gfp-footnote">Os horários, os participantes e o fechamento são conferidos no servidor. Os acertos só são premiados após confirmação dos resultados.</p>'+
   '</div>';
 }
 async function request(path,opts){
  const r=await fetch(API+path,{...opts,headers:{'Content-Type':'application/json',...(opts?.headers||{})},cache:'no-store'});
  let data={};try{data=await r.json()}catch{}
  if(!r.ok||data.ok===false)throw Error(data.error||'Não foi possível salvar os palpites.');
  return data;
 }
 async function load(key='',silent=false){
  const id=++state.requestId;
  state.loading=!silent;state.error='';if(!silent)render();
  try{
   const qs=new URLSearchParams();if(key)qs.set('round',key);const token=session();if(token)qs.set('session',token);
   const data=await request('/api/global-predictions?'+qs);
   if(id!==state.requestId)return;
   state.data=data;state.roundKey=data.round?.key||'';state.loading=false;state.message='';render();
  }catch(e){if(id!==state.requestId)return;state.loading=false;state.error=e.message;render();}
 }
 async function save(){
  const round=state.data?.round,draft=getDraft();
  if(!round||state.busy||!state.data?.linked||!round.ready||now()>=round.closesAt||!['best','worst','mvp'].every(k=>draft[k])||draft.best===draft.worst)return;
  state.busy=true;state.error='';state.message='';render();
  try{
   const result=await request('/api/global-predictions/vote',{method:'POST',body:JSON.stringify({session:session(),roundKey:round.key,...draft})});
   state.data=result;state.drafts.set(round.key,{...result.votes});state.message='Palpites salvos! '+(result.participationAwarded?'+'+result.participationAwarded+' ponto(s) de participação.':'Você pode alterar até o início da rodada.');
  }catch(e){state.error=e.message;await load(round.key,true);state.error=e.message;}
  finally{state.busy=false;render();}
 }
 function openResults(metric,input){
  const panel=root.querySelector('[data-gfp-options="'+metric+'"]');
  if(!panel)return;
  root.querySelectorAll('[data-gfp-options]').forEach(x=>{if(x!==panel)x.hidden=true;});
  panel.innerHTML=optionsHTML(metric,input?.value||'');panel.hidden=false;state.activePicker=metric;
 }
 root.addEventListener('click',e=>{
  const tab=e.target.closest('[data-gfp-round]');
  if(tab){state.message='';load(tab.dataset.gfpRound);return;}
  const choice=e.target.closest('[data-gfp-choice]');
  if(choice){
   const round=state.data?.round;if(!round?.ready||now()>=round.closesAt)return;
   const metric=choice.dataset.gfpChoice,option=choice.dataset.option;
   getDraft()[metric]=option;state.error='';state.message='';render();return;
  }
  if(e.target.closest('[data-gfp-save]')){save();return;}
  if(e.target.closest('[data-gfp-retry]')){load();return;}
  if(e.target.closest('[data-gfp-checkin]')){window.cffOpenCommunityTab?.('ranking');document.getElementById('cff-checkin-mount')?.scrollIntoView?.({behavior:'smooth'});}
 });
 root.addEventListener('focusin',e=>{const input=e.target.closest('[data-gfp-search]');if(input)openResults(input.dataset.gfpSearch,input);});
 root.addEventListener('input',e=>{const input=e.target.closest('[data-gfp-search]');if(input)openResults(input.dataset.gfpSearch,input);});
 root.addEventListener('keydown',e=>{
  const input=e.target.closest('[data-gfp-search]');
  if(!input)return;
  const panel=root.querySelector('[data-gfp-options="'+input.dataset.gfpSearch+'"]');
  if(e.key==='Escape'){if(panel)panel.hidden=true;input.blur();return;}
  if(e.key==='Enter'){const first=panel?.querySelector('[data-gfp-choice]');if(first){e.preventDefault();first.click();}}
 });
 document.addEventListener('click',e=>{if(!e.target.closest('#cff-global-predictions .gfp-card'))root.querySelectorAll('[data-gfp-options]').forEach(x=>x.hidden=true);});
 setInterval(()=>{
  const r=state.data?.round,el=root.querySelector('[data-gfp-countdown]');
  if(!r||!el)return;
  if(el.textContent!==countdown(r.closesAt))el.textContent=countdown(r.closesAt);
  if(r.closesAt<=now()&&root.querySelector('[data-gfp-save]'))render();
 },1000);
 window.addEventListener('storage',e=>{if(e.key===SESSION)load(state.roundKey,true);});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.data)load(state.roundKey,true);});
 load();
})();
