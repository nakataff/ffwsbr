import './career-team-identities.mjs?v=20261015-career-directory-v1';
import {readCareer,esc,ROLES,STATUSES,tenureCards,careerTrail,personHref,teamHref,periodLabel} from './career-client.mjs?v=20261017-staff-profile-v1';
const loaded=new WeakMap();
function style(){if(document.querySelector('[data-career-style]')||document.querySelector('link[href*="css/careers.css"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='/css/careers.css?v=20261017-coach-results-v1';link.dataset.careerStyle='1';document.head.append(link);}
function currentHtml(p){return p.current.length?p.current.map(t=>`<a href="${teamHref(t.teamPageName||t.teamName)}">${esc(t.teamName)}</a><span>${ROLES[t.role]}</span>`).join(' · '):p.availability==='free_agent'?`Sem equipe / F/A${p.freeAgentSince?.date?' · desde '+esc(periodLabel(p.freeAgentSince)):''}`:p.availability==='retired'?'Aposentado':'Vínculo atual a confirmar';}
const trail=p=>careerTrail(p,{resolveLogo:(name,logo,managed)=>managed?logo:window.cffResolveTeamLogo?.(name,logo)||logo||'escudo.webp'});
function hideLegacy(node){if(!node.hidden)node.hidden=true;if(node.dataset.careerHidden!=='1')node.dataset.careerHidden='1';}
const rendered=new WeakMap();
function setHtml(node,html){const previous=rendered.get(node);if(previous?.input===html&&previous.first===node.firstChild&&previous.last===node.lastChild)return;node.innerHTML=html;rendered.set(node,{input:html,first:node.firstChild,last:node.lastChild});}
function competitionDetails(p){const tenures=(p.tenures||[]).filter(t=>t.competitions?.length);return tenures.length?`<details class="career-competition-public" data-career-competition-details><summary>Competições por equipe</summary>${tenures.map(t=>`<div><strong>${esc(t.teamName)} · ${esc(ROLES[t.role]||t.role)}</strong><p class="career-participation-chips">${t.competitions.map(c=>`<span>${esc(c.name)}</span>`).join('')}</p></div>`).join('')}</details>`:'';}

const knownImage=value=>{
 const raw=String(value||'').trim();
 if(!raw||raw.startsWith('//')||raw.includes('..'))return 'silhueta.webp';
 if(/^https:\/\//i.test(raw)){try{const u=new URL(raw);if(u.username||u.password)return 'silhueta.webp';return raw;}catch{return 'silhueta.webp';}}
 return /^\/?[a-z\d_ %().\/-]+\.(?:webp|png|jpe?g)(?:\?[a-z\d_=&%.-]+)?$/i.test(raw)?raw:'silhueta.webp';
};
const plurality=(count,singular,plural)=>count===1?singular:plural;
function standalonePerson(p){
 const all=(p.tenures||[]).filter(t=>!t.deleted).slice().sort((a,b)=>(b.order||0)-(a.order||0));
 const current=new Set((p.current||[]).map(t=>t.id));
 const teams=new Set(all.map(t=>t.teamId||t.teamName));
 const editions=new Set(all.flatMap(t=>(t.competitions||[]).map(c=>c.id||c.name)));
 const role=ROLES[p.current?.[0]?.role||all[0]?.role||p.defaultRole]||(p.kind==='staff'?'Profissional de esports':'Jogador');
 const status=p.availability==='free_agent'?'Sem equipe / F/A':p.availability==='retired'?'Aposentado':p.current?.length?p.current.map(t=>t.teamName).join(' · '):'Equipe a confirmar';
 const photo=knownImage(p.photo);
 const present=all.map((t,i)=>{
  const active=current.has(t.id),ended=t.status==='ended',team=t.teamName||'Equipe a confirmar';
  const logo=knownImage(t.logoManaged?t.logo:window.cffResolveTeamLogo?.(team,t.logo)||t.logo||'escudo.webp');
  const start=t.start?.date?esc(periodLabel({date:t.start.date})):'Não informada';
  const end=t.end?.date?esc(periodLabel({date:t.end.date})):ended?'Não informada':active?'Em andamento':'Não informada';
  const competitions=Array.isArray(t.competitions)?t.competitions:[];
  const editionsHtml=competitions.length?`<div class="career-pro-competitions">${competitions.map(x=>`<span>${esc(x.name)}</span>`).join('')}</div>`:'<p class="career-pro-muted">Nenhuma competição vinculada a esta passagem no cadastro.</p>';
  const references=[t.start?.edition&&`<span>Entrada: ${esc(t.start.edition)}</span>`,t.end?.edition&&`<span>Saída: ${esc(t.end.edition)}</span>`].filter(Boolean);
  return `<article class="career-pro-tenure" data-career-passage="${esc(t.id||'')}">
    <div class="career-pro-tenure-head"><div class="career-pro-team-identity">
      <a class="career-pro-team-logo" href="${teamHref(t.teamPageName||team)}" aria-label="Abrir dados da equipe ${esc(team)}"><img src="${esc(logo)}" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='/escudo.webp'"></a>
      <div><span class="career-pro-eyebrow">PASSAGEM ${String(all.length-i).padStart(2,'0')}</span><h3>${esc(team)}</h3><p>${esc(ROLES[t.role]||t.role||'Cargo a confirmar')}</p></div>
    </div><span class="career-pro-tenure-status${active?' is-active':ended?' is-ended':''}">${active?'Vínculo atual':ended?'Passagem encerrada':esc(STATUSES[t.status]||'A confirmar')}</span></div>
    <div class="career-pro-tenure-dates"><div><small>Entrada · data</small><strong>${start}</strong></div><div><small>Saída · data</small><strong>${end}</strong></div></div>
    ${references.length?`<p class="career-pro-edition-reference"><strong>Edições de referência</strong><span>${references.join(' · ')}</span></p>`:''}
    <div class="career-pro-tenure-competitions"><div class="career-pro-subhead"><h4>Competições vinculadas</h4><small>${competitions.length} ${plurality(competitions.length,'edição','edições')}</small></div>${editionsHtml}</div>
    ${t.notes?`<p class="career-pro-notes"><strong>Observações</strong> ${esc(t.notes)}</p>`:''}
    <div class="career-pro-tenure-footer"><span>Dados da organização e histórico de elencos</span><a href="${teamHref(t.teamPageName||team)}">Ver página da equipe <span aria-hidden="true">↗</span></a></div>
   </article>`;
 }).join('');
 return `<div class="career-pro-profile${p.kind==='staff'?' is-staff':''}">
 <section class="career-pro-hero" aria-label="Identificação de ${esc(p.name)}">
  <div class="career-pro-portrait"><img src="${esc(photo)}" alt="Foto de ${esc(p.name)}" onerror="this.onerror=null;this.src='/silhueta.webp'" decoding="async"></div>
  <div class="career-pro-heading"><span class="career-pro-eyebrow">${p.kind==='staff'?'COMISSÃO TÉCNICA':'CARREIRA PROFISSIONAL'}</span><h1>${esc(p.name)}</h1><p class="career-pro-role">${esc(role)}</p>${p.playerRetired?'<span class="career-pro-ex-player">Ex-jogador · carreira como atleta encerrada</span>':''}<span class="career-pro-availability"><span aria-hidden="true"></span>${esc(status)}</span>${p.availability==='free_agent'&&p.freeAgentSince?.date?`<p class="career-pro-since">Sem equipe desde ${esc(periodLabel(p.freeAgentSince))}</p>`:''}</div>
 </section>
 <section class="career-pro-metrics" aria-label="Resumo do histórico">
  <div><strong>${teams.size}</strong><span>${plurality(teams.size,'Equipe registrada','Equipes registradas')}</span></div>
  <div><strong>${all.length}</strong><span>${plurality(all.length,'Passagem registrada','Passagens registradas')}</span></div>
  <div><strong>${editions.size}</strong><span>${plurality(editions.size,'Edição vinculada','Edições vinculadas')}</span></div>
 </section>
 <section class="career-pro-history"><div class="career-pro-section-title"><div><span class="career-pro-eyebrow">TRAJETÓRIA</span><h2>Passagens por equipes</h2></div><span>Da primeira à organização mais recente</span></div>
 <div class="career-trail">${trail(p)}</div>
 </section>
 <section class="career-pro-details"><div class="career-pro-section-title"><div><span class="career-pro-eyebrow">REGISTROS DE CARREIRA</span><h2>Dados de cada passagem</h2></div><span>Vínculos e competições do cadastro central</span></div>
 ${present||'<div class="career-pro-empty">Nenhuma passagem registrada até o momento.</div>'}
 </section>
 ${!p.id.startsWith('person-')?`<p class="career-pro-stats-link"><a href="/jogador.html?id=${encodeURIComponent(p.id)}">Consultar estatísticas e conquistas registradas ↗</a></p>`:''}
 </div>`;
}
const resultPanels=new WeakMap();
function attachCoachResults(root,p,standalone){
 const hasStaff=(p.tenures||[]).some(t=>!t.deleted&&t.role&&t.role!=='player');
 let panel=root.querySelector('[data-career-results]');
 if(!hasStaff){panel?.remove();return;}
 const signature=JSON.stringify([p.id,p.tenures]);
 if(panel&&resultPanels.get(panel)===signature)return;
 panel?.remove();panel=document.createElement('details');panel.className='career-results';panel.dataset.careerResults='1';
 panel.innerHTML='<summary><span><small>COMISSÃO TÉCNICA</small><strong>Resultados por split</strong></span><span class="career-results-open-label">Ver resultados <span aria-hidden="true">⌄</span></span></summary><div data-career-results-body></div>';
 resultPanels.set(panel,signature);
 if(standalone){const anchor=root.querySelector('.career-pro-history');anchor.after(panel);}else root.append(panel);
 panel.addEventListener('toggle',async()=>{
  if(!panel.open||panel.dataset.loading==='1')return;panel.dataset.loading='1';
  try{const module=await import('./career-results.mjs?v=20261017-coach-results-v1');if(panel.isConnected)await module.mountCoachResults(panel,p);}
  catch{delete panel.dataset.loading;panel.querySelector('[data-career-results-body]').textContent='Resultados indisponíveis. Feche e abra esta seção para tentar novamente.';}
 });
}
function applyPerson(root,p,{standalone=false}={}){
 if(standalone){document.title=p.name+' · Carreira | Central Free Fire';setHtml(root,standalonePerson(p));attachCoachResults(root,p,true);return;}
 // Preserve the existing section and its position, replacing only the old list.
 root.querySelectorAll('[data-career-person-history]').forEach(node=>node.remove());
 let list=root.querySelector('#profile-team-history,#pp-team-history-container,[data-career-history-list]');
 if(!list){let panel=root.querySelector('[data-career-history-panel]');if(!panel){panel=document.createElement('section');panel.className='profile-section career-compact-section';panel.dataset.careerHistoryPanel='1';panel.innerHTML='<div class="profile-section-head"><h2>Passagens por equipes</h2></div><div data-career-history-list></div>';root.append(panel);}list=panel.querySelector('[data-career-history-list]');}
 if(!list.classList.contains('career-trail'))list.classList.add('career-trail');setHtml(list,trail(p));
 const legacySection=list.closest('.profile-section');for(const node of [list,legacySection])if(node){if(node.hidden)node.hidden=false;if(node.hasAttribute('data-career-hidden'))node.removeAttribute('data-career-hidden');}
 let competitions=root.querySelector('[data-career-competitions-panel]');const competitionHtml=competitionDetails(p);if(competitionHtml){if(!competitions){competitions=document.createElement('div');competitions.dataset.careerCompetitionsPanel='1';list.after(competitions);}setHtml(competitions,competitionHtml);}else competitions?.remove();
 attachCoachResults(root,p,false);
 if(!p.managed)return;
 if(root.dataset.careerManaged!=='1')root.dataset.careerManaged='1';
 const kicker=root.querySelector('.profile-kicker,.cff-player-hero-kicker');const label=p.current.length?(p.kind==='staff'?'COMISSÃO TÉCNICA':'JOGADOR EM ATIVIDADE'):p.availability==='free_agent'?'SEM EQUIPE / F/A':p.availability==='retired'?'APOSENTADO':'EQUIPE A CONFIRMAR';if(kicker&&kicker.textContent!==label)kicker.textContent=label;
 root.querySelectorAll('.profile-team,.profile-team-logo,.cff-player-hero-team-btn,.cff-player-hero-team-orbit,.cff-rosterless-badge,#pp-team,.profile-teammates:not([data-career-teammates]),#pp-teammates-section').forEach(hideLegacy);
 if(!p.current.length)root.querySelectorAll('.profile-badge').forEach(node=>{if(/^(titular|reserva|capitão|saiu)$/i.test(node.textContent.trim()))hideLegacy(node);});
 let current=root.querySelector('[data-career-current]');if(!current){current=document.createElement('div');current.dataset.careerCurrent='1';current.className='career-inline-current';const header=root.querySelector('.profile-identity,.cff-player-hero-content,.player-profile-header');(header||list.parentNode).append(current);}setHtml(current,currentHtml(p)+(p.playerRetired?'<span class="career-pro-ex-player">Ex-jogador · carreira como atleta encerrada</span>':''));
 let teammates=root.querySelector('[data-career-teammates]');const peers=p.current.length?(p.teammates||[]):[];
 if(!peers.length){teammates?.remove();return;}
 if(!teammates){teammates=document.createElement('details');teammates.className='profile-teammates career-teammates';teammates.dataset.careerTeammates='1';current.after(teammates);}
 setHtml(teammates,`<summary><span class="profile-teammates-title">Companheiros atuais</span><small>${peers.length} integrante(s)</small><span class="profile-teammates-toggle"><span class="when-closed">Ver elenco</span><span class="when-open">Recolher</span></span></summary><div class="profile-teammates-grid">${peers.map(t=>`<a class="profile-teammate-card" href="/jogador.html?id=${encodeURIComponent(t.id)}"><img src="${esc(t.photo||'silhueta.webp')}" alt="" loading="lazy" decoding="async"><span><strong>${esc(t.name)}</strong><small>${ROLES[t.role]||esc(t.role)}</small></span></a>`).join('')}</div>`);
}
export async function mountPersonCareer(root,query,{standalone=false}={}){
 const marker=JSON.stringify(query),last=loaded.get(root);if(last?.key===marker){if(last.person&&root.isConnected)applyPerson(root,last.person,{standalone});return;}
 const entry={key:marker};loaded.set(root,entry);
 root.querySelectorAll('[data-career-hidden]').forEach(node=>{node.hidden=false;node.removeAttribute('data-career-hidden');});root.querySelectorAll('[data-career-current],[data-career-teammates]').forEach(node=>node.remove());delete root.dataset.careerManaged;
 try{const [result]=await Promise.all([readCareer('person',query),window.cffLoadTeamLogoMap?.().catch(()=>null)]);if(loaded.get(root)!==entry||!root.isConnected)return;style();entry.person=result.person;applyPerson(root,result.person,{standalone});}
 catch(error){if(standalone&&loaded.get(root)===entry)root.innerHTML=`<section class="career-empty"><h1>Histórico indisponível</h1><p>${esc(error.message)}</p><button type="button" data-career-retry>Tentar novamente</button></section>`;root.querySelector('[data-career-retry]')?.addEventListener('click',()=>{loaded.delete(root);mountPersonCareer(root,query,{standalone});});}
}

const STAFF_S2_URL='/player-data/staff/wb-2026-s2-public.json?v=20261017-staff-s2-v1';
function canonicalStaffTeam(name){
 const key=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 return ({loud:'loudsnickers',fluxo:'fluxow7m',alpha7esports:'alpha7',afgesports:'afrogames',loopssports:'loops',civissports:'civis'})[key]||key;
}
async function staffRosterFallback(team){
 try{
  const response=await fetch(STAFF_S2_URL,{cache:'force-cache'});
  if(!response.ok)throw Error('Cadastro do campeonato indisponível');
  const data=await response.json();
  const entries=(data.people||[]).filter(p=>canonicalStaffTeam(p.team)===canonicalStaffTeam(team));
  if(!entries.length)return '';
  const rows=entries.map(p=>'<div class="career-staff-fallback-row"><span class="career-staff-fallback-name">'+esc(p.name)+'</span><span>'+esc(ROLES[p.role]||p.role)+'</span></div>').join('');
  return '<section class="career-staff-tournament-fallback" data-staff-s2-public><h3>Comissão registrada · WB 2026 S2</h3><p class="career-hint">Lista histórica do campeonato. Não confirma vínculo atual nem reverte saídas ou transferências registradas no painel.</p>'+rows+'<p class="career-hint"><a href="'+esc(data.source)+'" target="_blank" rel="noopener noreferrer">Fonte: participantes da FFWS BR 2026 S2 ↗</a></p></section>';
 }catch{return '';}
}
export function mountTeamCareer(root,name,{standalone=false}={}){
 const marker='team:'+name;if(loaded.get(root)?.key===marker)return;const entry={key:marker,scope:'current',offset:0,request:0};loaded.set(root,entry);style();let panel;
 const rosterHeading=root.querySelector('#cff-current-roster h2');if(rosterHeading&&rosterHeading.textContent==='Elenco atual')rosterHeading.textContent='Elenco da WB 2026 S2';
 if(standalone){root.innerHTML=`<h1>${esc(name)}</h1><section class="career-panel" data-career-team></section>`;panel=root.querySelector('[data-career-team]');}
 else{panel=root.querySelector('[data-career-team]');if(!panel){panel=document.createElement('section');panel.className='career-panel career-public';panel.dataset.careerTeam='1';const anchor=root.querySelector('#cff-current-roster')||root.querySelector('#tp-players-cards-container');if(anchor)anchor.after(panel);else root.append(panel);}}
 panel.innerHTML='<h2>Histórico de vínculos</h2><p class="career-hint">Consulte as entradas, saídas e cargos desta equipe.</p>';
 async function load(){const request=++entry.request;panel.innerHTML='<p role="status">Carregando vínculos desta equipe…</p>';try{const data=await readCareer('team',{name,scope:entry.scope,offset:String(entry.offset)});if(loaded.get(root)!==entry||request!==entry.request||!root.isConnected)return;panel.innerHTML=`<h2>Jogadores e comissão · vínculos</h2><p class="career-public-subtitle">O elenco de uma competição e os vínculos atuais podem ser diferentes.</p><div class="career-scope-buttons"><button type="button" data-career-scope="current" aria-pressed="${entry.scope==='current'}">Vínculos atuais</button><button type="button" data-career-scope="all" aria-pressed="${entry.scope==='all'}">Todas as passagens</button></div>${data.entries.map(t=>`<article class="career-roster-row"><a href="${personHref(t.personId)}">${esc(t.name)}</a><div><small>${ROLES[t.role]} · ${STATUSES[t.status]}</small><small>${esc(periodLabel(t.start))} → ${esc(periodLabel(t.end))}</small></div></article>`).join('')||'<p class="career-hint">Nenhum vínculo confirmado neste filtro. Os registros importados podem ser consultados em Todas as passagens.</p>'}<div class="career-pagination"><button type="button" data-career-page="previous"${data.offset?'':' disabled'}>Anterior</button><span>${data.total?data.offset+1:0}–${data.offset+data.entries.length} de ${data.total}</span><button type="button" data-career-page="next"${data.hasMore?'':' disabled'}>Próxima</button></div>`;
 }catch(error){const roster=await staffRosterFallback(name);if(loaded.get(root)===entry&&request===entry.request)panel.innerHTML=`<h2>Histórico de vínculos</h2><p class="career-hint">Consulta de carreiras temporariamente indisponível.</p>${roster}<button type="button" data-career-team-retry>Tentar novamente</button>`;}}
 panel.addEventListener('click',event=>{const scope=event.target.closest('[data-career-scope]'),page=event.target.closest('[data-career-page]');if(scope){entry.scope=scope.dataset.careerScope;entry.offset=0;load();}else if(page&&!page.disabled){entry.offset=Math.max(0,entry.offset+(page.dataset.careerPage==='next'?20:-20));load();}else if(event.target.closest('[data-career-team-retry]'))load();});
 if(standalone||!('IntersectionObserver' in window))load();else{const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();load();}},{rootMargin:'200px'});observer.observe(panel);}
}
function setup(){
 const standalone=document.querySelector('#career-public-root');if(standalone){const params=new URLSearchParams(location.search);if(params.get('team'))mountTeamCareer(standalone,params.get('team'),{standalone:true});else if(params.get('id'))mountPersonCareer(standalone,{id:params.get('id')},{standalone:true});else standalone.textContent='Abra uma pessoa ou equipe para consultar o histórico.';return;}
 const specs=[['#player-root','.profile-name','person'],['#player-profile','#pp-name,.cff-player-hero-content h2','person'],['#historical-team-profile','.historical-team-name','team'],['#team-page-root','.cff-team-hero h1','team'],['#team-profile','#tp-name','team']];
 for(const [selector,heading,kind]of specs){const root=document.querySelector(selector);if(!root)continue;let timer;const update=()=>{if(timer)return;timer=setTimeout(()=>{timer=null;if(!root.getClientRects().length)return;const name=root.querySelector(heading)?.textContent.trim();if(!name||/^(NOME|NOME DO JOGADOR|Carregando)/i.test(name))return;if(kind==='person')mountPersonCareer(root,{id:selector==='#player-root'?new URLSearchParams(location.search).get('id')||'':'',name});else{const label=root.querySelector('#cff-current-roster h2');if(label?.textContent==='Elenco atual')label.textContent='Elenco da WB 2026 S2';mountTeamCareer(root,name);}},80);};new MutationObserver(update).observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','style']});update();}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
