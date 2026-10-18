import './career-team-identities.mjs?v=20261015-career-directory-v1';
import {readCareer,esc,ROLES,STATUSES,tenureCards,careerTrail,personHref,teamHref,periodLabel} from './career-client.mjs?v=20261018-career-organized-v1';
const loaded=new WeakMap();
function style(){if(document.querySelector('[data-career-style]')||document.querySelector('link[href*="css/careers.css"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='/css/careers.css?v=20261018-career-organized-v1';link.dataset.careerStyle='1';document.head.append(link);}
function currentHtml(p){return p.current.length?p.current.map(t=>`<a href="${teamHref(t.teamPageName||t.teamName)}">${esc(t.teamName)}</a><span class="career-current-role"> · ${esc(ROLES[t.role]||t.role)}</span>`).join(' · '):p.availability==='free_agent'?`Sem equipe / F/A${p.freeAgentSince?.date?' · desde '+esc(periodLabel(p.freeAgentSince)):''}`:p.availability==='retired'?'Aposentado':'Vínculo atual a confirmar';}
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
 const current=new Set((p.current||[]).map(t=>t.id)),teams=new Set(all.map(t=>t.teamId||t.teamName));
 const editions=new Set(all.flatMap(t=>(t.competitions||[]).map(c=>c.id||c.name)));
 const staff=all.some(t=>t.role&&t.role!=='player');
 const role=ROLES[p.current?.[0]?.role||all[0]?.role||p.defaultRole]||(p.kind==='staff'?'Comissão técnica':'Jogador');
 const status=p.availability==='free_agent'?'Sem equipe / F/A':p.availability==='retired'?'Aposentado':p.current?.length?p.current.map(t=>t.teamName).join(' · '):'Equipe a confirmar';
 const present=all.map(t=>{
  const active=current.has(t.id),team=t.teamName||'Equipe a confirmar';
  const logo=knownImage(t.logoManaged?t.logo:window.cffResolveTeamLogo?.(team,t.logo)||t.logo||'escudo.webp');
  const comps=t.competitions||[],dates=[t.start?.date&&'Entrada: '+periodLabel({date:t.start.date}),t.end?.date&&'Saída: '+periodLabel({date:t.end.date})].filter(Boolean);
  return `<details class="career-pro-tenure" data-career-passage="${esc(t.id||'')}"><summary class="career-pro-tenure-head"><div class="career-pro-team-identity"><span class="career-pro-team-logo"><img src="${esc(logo)}" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='/escudo.webp'"></span><span><strong>${esc(team)}</strong><small>${esc(ROLES[t.role]||t.role)}${dates.length?' · '+esc(dates.join(' → ')):''}</small></span></div><span class="career-pro-tenure-status${active?' is-active':''}">${active?'Atual':`${comps.length} ${plurality(comps.length,'edição','edições')}`}</span><span class="career-disclosure" aria-hidden="true"></span></summary><div class="career-passage-body">${!dates.length?'<p class="career-pro-muted">Datas de entrada e saída ainda não cadastradas.</p>':''}${comps.length?`<div class="career-pro-competitions">${comps.map(c=>`<span>${esc(c.name)}</span>`).join('')}</div>`:'<p class="career-pro-muted">Competições ainda não vinculadas.</p>'}${t.notes?`<p class="career-pro-notes">${esc(t.notes)}</p>`:''}<a class="career-results-team-link" href="${teamHref(t.teamPageName||team)}">Ver equipe ↗</a>${t.sourceUrl?`<a class="career-results-team-link" href="${esc(t.sourceUrl)}" target="_blank" rel="noopener noreferrer">Fonte do registro ↗</a>`:''}</div></details>`;
 }).join('');
 const latest=all.filter(t=>t.competitions?.length).slice(0,2);
 return `<div class="career-pro-profile${p.kind==='staff'?' is-staff':''}">
 <section class="career-pro-hero" aria-label="Identificação de ${esc(p.name)}"><div class="career-pro-portrait"><img src="${esc(knownImage(p.photo))}" alt="Foto de ${esc(p.name)}" onerror="this.onerror=null;this.src='/silhueta.webp'" decoding="async"></div><div class="career-pro-heading"><span class="career-pro-eyebrow">${p.kind==='staff'?'COMISSÃO TÉCNICA':'CARREIRA PROFISSIONAL'}</span><h1>${esc(p.name)}</h1><p class="career-pro-role">${esc(role)}</p>${p.playerRetired?'<span class="career-pro-ex-player">Ex-jogador</span>':''}<span class="career-pro-availability"><span aria-hidden="true"></span>${esc(status)}</span>${p.availability==='free_agent'&&p.freeAgentSince?.date?`<p class="career-pro-since">Desde ${esc(periodLabel(p.freeAgentSince))}</p>`:''}</div></section>
 <nav class="career-profile-tabs" role="tablist" aria-label="Dados do perfil">${[['overview','Resumo'],['career','Carreira'],...(staff?[['competitions','Competições'],['awards','Conquistas']]:[])].map(([id,label],i)=>`<button type="button" role="tab" id="career-tab-${id}" aria-controls="career-panel-${id}" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-profile-tab="${id}">${label}</button>`).join('')}</nav>
 <section id="career-panel-overview" role="tabpanel" aria-labelledby="career-tab-overview" data-profile-panel="overview"><section class="career-pro-metrics" aria-label="Histórico completo"><div><strong>${teams.size}</strong><span>Equipes</span></div><div><strong>${all.length}</strong><span>Passagens</span></div><div><strong>${editions.size}</strong><span>Edições vinculadas</span></div></section><section class="career-pro-history"><div class="career-pro-section-title"><div><span class="career-pro-eyebrow">TRAJETÓRIA</span><h2>Passagens por equipes</h2></div></div><div class="career-trail">${trail(p)}</div></section>${latest.length?`<section class="career-overview-editions"><div class="career-pro-section-title"><h2>Competições registradas</h2>${staff?'<button type="button" data-open-profile-tab="competitions">Ver resultados ↗</button>':''}</div>${latest.map(t=>`<div class="career-overview-row"><strong>${esc(t.teamName)}</strong><span>${t.competitions.slice(-3).map(c=>esc(c.name)).join(' · ')}${t.competitions.length>3?` · +${t.competitions.length-3}`:''}</span></div>`).join('')}</section>`:'<p class="career-pro-muted">O histórico será completado conforme as participações forem vinculadas.</p>'}</section>
 <section id="career-panel-career" role="tabpanel" aria-labelledby="career-tab-career" data-profile-panel="career" hidden><div class="career-pro-section-title"><h2>Histórico de equipes</h2><span>Mais recente primeiro</span></div>${present||'<p class="career-pro-empty">Nenhuma passagem cadastrada.</p>'}${all.some(t=>t.role==='player')&&!p.id.startsWith('person-')?`<p class="career-pro-stats-link"><a href="/jogador.html?id=${encodeURIComponent(p.id)}">Estatísticas da carreira como jogador ↗</a></p>`:''}</section>
 ${staff?['competitions','awards'].map(id=>`<section id="career-panel-${id}" role="tabpanel" aria-labelledby="career-tab-${id}" data-profile-panel="${id}" hidden><div class="career-pro-section-title"><div><span class="career-pro-eyebrow">COMISSÃO TÉCNICA</span><h2>${id==='awards'?'Conquistas e finais':'Resultados por competição'}</h2></div></div><div class="career-results career-results-tab" data-career-results="${id}"><div data-career-results-body></div></div></section>`).join(''):''}
 </div>`;
}
const profileBindings=new WeakMap();
function bindProfileTabs(root,p){
 if(profileBindings.get(root)===root.firstChild)return;profileBindings.set(root,root.firstChild);
 const choose=async id=>{
  const tabs=[...root.querySelectorAll('[data-profile-tab]')];
  if(!tabs.some(t=>t.dataset.profileTab===id))return;
  for(const tab of tabs){const active=tab.dataset.profileTab===id;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
  root.querySelectorAll('[data-profile-panel]').forEach(panel=>{panel.hidden=panel.dataset.profilePanel!==id;});
  if(!['competitions','awards'].includes(id))return;
  const panel=root.querySelector(`[data-career-results="${id}"]`);
  panel.querySelector('[data-career-results-body]').innerHTML||= '<p role="status">Carregando resultados…</p>';
  try{const module=await import('./career-results.mjs?v=20261018-worlds-complete-v3');if(panel.isConnected)await module.mountCoachResults(panel,p,{awards:id==='awards'});}
  catch{panel.querySelector('[data-career-results-body]').innerHTML='<p>Não foi possível carregar os resultados.</p><button type="button" data-open-profile-tab="'+id+'">Tentar novamente</button>';}
 };
 root.onclick=event=>{const button=event.target.closest('[data-profile-tab],[data-open-profile-tab]');if(button)choose(button.dataset.profileTab||button.dataset.openProfileTab);};
 root.onkeydown=event=>{if(!event.target.matches('[data-profile-tab]')||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...root.querySelectorAll('[data-profile-tab]')],at=tabs.indexOf(event.target),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(at+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].focus();choose(tabs[next].dataset.profileTab);};
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
  try{const module=await import('./career-results.mjs?v=20261018-worlds-complete-v3');if(panel.isConnected)await module.mountCoachResults(panel,p);}
  catch{delete panel.dataset.loading;panel.querySelector('[data-career-results-body]').textContent='Resultados indisponíveis. Feche e abra esta seção para tentar novamente.';}
 });
}
function applyPerson(root,p,{standalone=false}={}){
 if(standalone){document.title=p.name+' · Carreira | Central Free Fire';setHtml(root,standalonePerson(p));bindProfileTabs(root,p);return;}
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
 const kicker=root.querySelector('.profile-kicker,.cff-player-hero-kicker');const label=p.current.length?(p.current.some(t=>t.role!=='player')?'COMISSÃO TÉCNICA':'JOGADOR EM ATIVIDADE'):p.availability==='free_agent'?'SEM EQUIPE / F/A':p.availability==='retired'?'APOSENTADO':'EQUIPE A CONFIRMAR';if(kicker&&kicker.textContent!==label)kicker.textContent=label;
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
 const standalone=document.querySelector('#career-public-root');if(standalone){const params=new URLSearchParams(location.search);if(params.get('team'))location.replace(teamHref(params.get('team')));else if(params.get('id'))mountPersonCareer(standalone,{id:params.get('id')},{standalone:true});else standalone.textContent='Abra uma pessoa ou equipe para consultar o histórico.';return;}
 const specs=[['#player-root','.profile-name','person'],['#player-profile','#pp-name,.cff-player-hero-content h2','person'],['#historical-team-profile','.historical-team-name','team'],['#team-page-root','.cff-team-hero h1','team'],['#team-profile','#tp-name','team']];
 for(const [selector,heading,kind]of specs){const root=document.querySelector(selector);if(!root)continue;let timer;const update=()=>{if(timer)return;timer=setTimeout(()=>{timer=null;if(!root.getClientRects().length)return;const name=root.querySelector(heading)?.textContent.trim();if(!name||/^(NOME|NOME DO JOGADOR|Carregando)/i.test(name))return;if(kind==='person')mountPersonCareer(root,{id:selector==='#player-root'?new URLSearchParams(location.search).get('id')||'':'',name});else{const label=root.querySelector('#cff-current-roster h2');if(label?.textContent==='Elenco atual')label.textContent='Elenco da WB 2026 S2';mountTeamCareer(root,name);}},80);};new MutationObserver(update).observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','style']});update();}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
