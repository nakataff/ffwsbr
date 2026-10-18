import {canonicalTeamHref} from './team-routes.mjs?v=20261018-career-organized-v1';
export const CAREER_API='https://cff-camp-notifications.nakataffb4.workers.dev';
export const ROLES={player:'Jogador',head_coach:'Head coach',coach:'Coach',assistant_coach:'Assistant coach',analyst:'Analista',manager:'Manager',other:'Comissão / cargo não informado'};
export const STATUSES={unverified:'A revisar',active:'Ativo',ended:'Encerrado',loan:'Empréstimo',substitute:'Substituto'};
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function periodLabel(value={}){let date=value.date||'';if(/^\d{4}-\d{2}-\d{2}$/.test(date))date=date.split('-').reverse().join('/');else if(/^\d{4}-\d{2}$/.test(date))date=date.slice(5)+'/'+date.slice(0,4);return [date,value.edition].filter(Boolean).join(' · ')||'Não informado';}
export const certaintyLabel=value=>value?.certainty==='confirmed'?'Confirmado':value?.certainty==='estimated'?'Estimado':'A confirmar';
export const personHref=id=>'/carreira.html?id='+encodeURIComponent(id);
export const teamHref=canonicalTeamHref;
const cache=new Map(),pending=new Map(),TTL=60000;
export async function readCareer(kind,query,{force=false}={}){
 if(!['person','team'].includes(kind))throw Error('Consulta inválida.');const params=new URLSearchParams({...query,view:'roster-v1'}),url=CAREER_API+'/careers/'+kind+'?'+params,key=url,stored=cache.get(key);
 if(!force&&stored&&Date.now()-stored.at<TTL)return stored.data;if(pending.has(key))return pending.get(key);
 const job=(async()=>{const response=await fetch(url,{cache:force?'reload':'no-cache',signal:AbortSignal.timeout(6000)}),data=await response.json();if(!response.ok)throw Error(data.error||'Histórico indisponível.');cache.set(key,{at:Date.now(),data});if(cache.size>50)cache.delete(cache.keys().next().value);return data;})();pending.set(key,job);try{return await job;}finally{pending.delete(key);}
}
export async function careerAdmin(auth,operation,body={}){const user=auth.currentUser;if(!user)throw Error('Entre no painel para continuar.');const token=await user.getIdToken(),response=await fetch(CAREER_API+'/api',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({...body,action:'careerAdmin',operation}),signal:AbortSignal.timeout(20000)}),data=await response.json();if(auth.currentUser?.uid!==user.uid)throw Error('Sua conta mudou. Entre novamente.');if(!response.ok)throw Error(data.error||'Não foi possível concluir a alteração.');if(!['search','teams','person','history','summary','departureCandidates','teamDetail','resolveTeam','reviewSummary','teamHistory'].includes(operation))cache.clear();return data;}
export function tenureCards(tenures,{admin=false,person}={}){return orderedTenures(person||{tenures}).map(t=>`<article class="career-tenure${t.status==='unverified'?' is-unverified':''}"><div class="career-tenure-head"><div><a href="${teamHref(t.teamPageName||t.teamName)}">${esc(t.teamName)}</a><span>${esc(ROLES[t.role]||t.role)}</span></div><span class="career-status career-status-${esc(t.status)}">${STATUSES[t.status]||esc(t.status)}</span></div><div class="career-dates"><div><small>ENTRADA</small><strong>${esc(periodLabel(t.start))}</strong><span>${certaintyLabel(t.start)}</span></div><div><small>SAÍDA</small><strong>${t.status==='active'&&!t.end?.date&&!t.end?.edition?'Em atividade':esc(periodLabel(t.end))}</strong><span>${certaintyLabel(t.end)}</span></div></div>${t.source||t.sourceUrl?`<p class="career-source">Fonte: ${t.sourceUrl?`<a href="${esc(t.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(t.source||'Ver anúncio')} ↗</a>`:esc(t.source)}</p>`:''}${t.departure?.reason||t.departure?.source||t.departure?.sourceUrl?`<p class="career-source">Saída: ${esc(t.departure.reason)}${t.departure.source||t.departure.sourceUrl?` · ${t.departure.sourceUrl?`<a href="${esc(t.departure.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(t.departure.source||'Ver anúncio')} ↗</a>`:esc(t.departure.source)}`:''}</p>`:''}${t.competitions?.length?`<p class="career-participation-chips">${t.competitions.map(c=>`<span>${esc(c.name)}</span>`).join('')}</p>`:''}${t.notes?`<p class="career-notes">${esc(t.notes)}</p>`:''}${admin?`<div class="career-row-actions"><button type="button" data-career-edit="${esc(t.id)}">Editar</button>${t.status!=='ended'?`<button type="button" data-career-transfer="${esc(t.id)}">Registrar transferência</button>`:''}<button type="button" data-career-archive="${esc(t.id)}">Arquivar</button></div>`:''}</article>`).join('');}

function dateRange(value){
 const date=String(value||'');
 if(/^20\d{2}$/.test(date))return [date+'-01-01',date+'-12-31'];
 if(/^20\d{2}-(0[1-9]|1[0-2])$/.test(date)){const [y,m]=date.split('-').map(Number);return [date+'-01',date+'-'+new Date(Date.UTC(y,m,0)).getUTCDate()];}
 if(/^20\d{2}-\d{2}-\d{2}$/.test(date)){const stamp=Date.parse(date+'T12:00Z');if(Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===date)return [date,date];}
 return null;
}
function recordedPeriod(tenure){
 const periods=(tenure.competitions||[]).map(c=>{
  const p=c.period||{},year=p.year||String(c.name||'').match(/\b20\d{2}\b/)?.[0];
  const start=dateRange(p.startDate),end=dateRange(p.endDate),annual=dateRange(year);
  return {start:start?.[0]||end?.[0]||annual?.[0],end:end?.[1]||start?.[1]||annual?.[1],yearOnly:!start&&!end};
 }).filter(p=>p.start&&p.end);
 if(!periods.length)return null;
 const first=periods.slice().sort((a,b)=>a.start.localeCompare(b.start))[0],last=periods.slice().sort((a,b)=>b.end.localeCompare(a.end))[0];
 return {start:first.start,end:last.end,startYearOnly:first.yearOnly,endYearOnly:last.yearOnly};
}
export function competitionPeriodLabel(tenure){
 const period=recordedPeriod(tenure);if(!period)return '';
 const first=period.startYearOnly?period.start.slice(0,4):periodLabel({date:period.start}),last=period.endYearOnly?period.end.slice(0,4):periodLabel({date:period.end});
 return 'Participações registradas: '+first+(first!==last?' → '+last:'')+' · estimativa pelos torneios';
}
export function orderedTenures(person,{newestFirst=false}={}){
 const current=new Set((person.current||[]).map(t=>t.id).filter(Boolean));
 const rows=(person.tenures||[]).filter(t=>!t.deleted).map((tenure,index)=>{
  const period=recordedPeriod(tenure),start=dateRange(tenure.start?.date),end=dateRange(tenure.end?.date);
  const active=!['free_agent','retired'].includes(person.availability)&&(current.has(tenure.id)||!Array.isArray(person.current)&&['active','loan','substitute'].includes(tenure.status));
  return {tenure,index,active,start:start?.[0]||period?.start||end?.[0]||'',end:end?.[1]||period?.end||start?.[1]||''};
 });
 const byOrder=(a,b)=>(Number(a.tenure.order)||0)-(Number(b.tenure.order)||0)||a.index-b.index;
 const byDate=(a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end)||byOrder(a,b);
 const historical=rows.filter(r=>!r.active).sort(byOrder),dated=historical.filter(r=>r.start).sort(byDate);
 const rank=new Map(dated.map((r,i)=>[r,i])),gaps=Array.from({length:dated.length+1},()=>[]),next=[];
 let following=null;for(let i=historical.length-1;i>=0;i--){next[i]=following;if(historical[i].start)following=historical[i];}
 let previous=null;
 for(let i=0;i<historical.length;i++){
  const row=historical[i];if(row.start){previous=row;continue;}
  const after=next[i],slot=after&&(!previous||rank.get(previous)<rank.get(after))?rank.get(after):previous?rank.get(previous)+1:0;
  gaps[slot].push(row);
 }
 // Unknown passages stay between their existing dated neighbors. No dates or
 // contracts are invented, and authoritative current links remain at the end.
 const result=[];for(let i=0;i<=dated.length;i++){result.push(...gaps[i].map(r=>r.tenure));if(dated[i])result.push(dated[i].tenure);}
 result.push(...rows.filter(r=>r.active).sort(byDate).map(r=>r.tenure));
 return newestFirst?result.reverse():result;
}
export function careerTrail(person,{resolveLogo=(_name,logo)=>logo||'escudo.webp'}={}){
 const rows=[],teamKey=t=>t.teamId||String(t.teamName||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 for(const t of orderedTenures(person)){
  const previous=rows.at(-1);if(previous&&teamKey(previous)===teamKey(t)&&previous.role===t.role){rows[rows.length-1]={...t,start:previous.start};}else rows.push({...t});
 }
 const current=new Set((person.current||[]).map(t=>t.id));
 const cards=rows.map(t=>{
  const active=current.has(t.id),dates=[t.start,t.end].filter(b=>b?.date||b?.edition).map(periodLabel).join(' → ')||competitionPeriodLabel(t),role=t.role!=='player'?ROLES[t.role]||t.role:'';
  return `<a class="career-trail-team${active?' is-current':''}" href="${teamHref(t.teamPageName||t.teamName)}"${dates?` title="${esc(dates)}"`:''}><span class="career-trail-label">${active?'Atual':esc(role)}</span><span class="career-trail-logo"><img src="${esc(resolveLogo(t.teamName,t.logo,t.logoManaged))}" alt="" loading="lazy" decoding="async" ${t.logoManaged?'data-career-team-logo="1"':`data-team-logo="${esc(t.teamName)}"`}></span><strong>${esc(t.teamName)}</strong></a>`;
 });
 if(person.availability==='free_agent'||person.availability==='retired')cards.push(`<span class="career-trail-team is-current"><span class="career-trail-label">Atual</span><span class="career-trail-logo career-trail-free">${person.availability==='retired'?'—':'F/A'}</span><strong>${person.availability==='retired'?'Aposentado':'Sem equipe'}</strong></span>`);
 return cards.join('<span class="career-trail-arrow" aria-hidden="true">→</span>')||'<p class="career-hint">Histórico de equipes em atualização.</p>';
}
