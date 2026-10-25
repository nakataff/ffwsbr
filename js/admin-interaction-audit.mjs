// Private audit panel: only requests the clicked Instagram, never the full community ranking.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fmt=n=>(Number(n)||0).toLocaleString('pt-BR');
const typeLabels={comment:'Comentários',story:'Stories',checkin:'Check-in',bonus_streak:'Bônus de sequência',bonus:'Bônus',adjustment:'Ajustes'};
const label=t=>typeLabels[t]||String(t||'Outro').replace(/_/g,' ');
const today=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>parts.find(p=>p.type===k)?.value).join('-')};
const dateLabel=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')?d.slice(8)+'/'+d.slice(5,7)+'/'+d.slice(0,4):String(d||'');
function styles(){if(document.getElementById('eco-interaction-audit-style'))return;const tag=document.createElement('style');tag.id='eco-interaction-audit-style';tag.textContent=`
.eco-ia{margin:20px 0;padding:20px;border:1px solid rgba(0,200,255,.24);border-radius:16px;background:rgba(5,23,42,.68)}
.eco-ia-head{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.eco-ia h3{margin:0 0 5px;font-size:1.15rem;color:#f4f9ff}.eco-ia p{margin:6px 0 13px;color:#91a8bf;font-size:.84rem;line-height:1.5}
.eco-ia-find{display:flex;gap:8px;align-items:end;flex-wrap:wrap}.eco-ia-find label{flex:1 1 210px;min-width:0;color:#c9d7e5;font-size:.8rem;font-weight:800}
.eco-ia input,.eco-ia select{display:block;box-sizing:border-box;min-height:42px;width:100%;border-radius:9px;border:1px solid #36516a;background:#0e1929;color:#fff;padding:9px 11px;margin-top:5px}
.eco-ia-periods{display:flex;gap:7px;flex-wrap:wrap;margin-top:14px}.eco-ia-periods button[aria-pressed=true]{background:#00a3ce;color:#071727;border-color:#00a3ce}
.eco-ia-dates{display:flex;gap:9px;flex-wrap:wrap;align-items:end;margin:12px 0}.eco-ia-dates label{font-size:.76rem;color:#9fc1db;min-width:145px;flex:1 1 145px}
.eco-ia-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:16px 0}.eco-ia-stats>div{padding:12px;border-radius:10px;border:1px solid #283e50;background:#101f30}
.eco-ia-stats span{display:block;color:#91aac2;font-size:.72rem}.eco-ia-stats strong{display:block;margin-top:5px;font-size:1.2rem;color:#ecfaff}
.eco-ia-grid{display:grid;grid-template-columns:1fr 1.3fr;gap:16px}.eco-ia h4{margin:15px 0 7px;font-size:.92rem;color:#fff}
.eco-ia-table{width:100%;border-collapse:collapse}.eco-ia-table th,.eco-ia-table td{border-bottom:1px solid #28384b;padding:9px 5px;text-align:left;font-size:.76rem}.eco-ia-table th{color:#8eafc9}.eco-ia-table td{color:#dfebf7}.eco-ia-table td:last-child,.eco-ia-table th:last-child{text-align:right}
.eco-ia-table button{background:none;border:0;color:#33cdfb;cursor:pointer;font:inherit;text-decoration:underline;padding:2px}
.eco-ia-message{min-height:22px!important;color:#a5c8e7!important}.eco-ia-controls{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding-top:10px}
@media(max-width:740px){.eco-ia{padding:13px}.eco-ia-grid{grid-template-columns:1fr}.eco-ia-table th,.eco-ia-table td{font-size:.72rem;padding:8px 3px}}
`;document.head.appendChild(tag)}
export function mountInteractionAudit(host,{request}){
 if(!host)return null;styles();
 let nick='',period='week',report=null,offset=0,serial=0;
 host.className='eco-ia';host.innerHTML=`<div class="eco-ia-head"><div><span class="cff-profile-eyebrow">RANKING DE INTERAÇÕES · INSTAGRAM</span><h3>Auditoria de pontos por pessoa</h3></div><a href="/interacoes.html" target="_blank" rel="noopener">Ver ranking público ↗</a></div>
 <p>Consulte um @Instagram específico para ver comentários, Stories, check-ins e outros créditos no dia, semana ou mês. A pesquisa não carrega a pontuação dos demais participantes.</p>
 <form class="eco-ia-find" data-ia-find><label>Instagram da pessoa<input name="username" autocomplete="off" maxlength="31" placeholder="@usuario" required></label><button type="submit" class="cff-account-button primary">Consultar pontos</button></form>
 <div data-ia-filters hidden><div class="eco-ia-periods" role="group" aria-label="Período">
 ${[['day','Dia'],['week','Semana'],['month','Mês'],['custom','Personalizado']].map(([id,name])=>`<button type="button" class="cff-account-button" data-ia-period="${id}" aria-pressed="${id==='week'}">${name}</button>`).join('')}</div>
 <div class="eco-ia-dates"><label data-ia-single>Data de referência<input type="date" name="date" max="${today()}" value="${today()}"></label><label data-ia-from hidden>De<input type="date" name="from" max="${today()}" value="${today()}"></label><label data-ia-to hidden>Até<input type="date" name="to" max="${today()}" value="${today()}"></label><button type="button" class="cff-account-button" data-ia-apply>Aplicar filtro</button></div></div>
 <p class="eco-ia-message" data-ia-status role="status" aria-live="polite">Nenhuma consulta realizada</p><div data-ia-result></div>`;
 const $=q=>host.querySelector(q);
 const status=t=>{$('[data-ia-status]').textContent=t};
 function filters(){const custom=period==='custom';$('[data-ia-single]').hidden=custom;$('[data-ia-from]').hidden=!custom;$('[data-ia-to]').hidden=!custom;host.querySelectorAll('[data-ia-period]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.iaPeriod===period)));}
 function render(){const el=$('[data-ia-result]');if(!report?.found){el.innerHTML=report?'<p>Nenhum cadastro de Instagram encontrado com esse nome exato. Confira o @ digitado.</p>':'';return;}
 const title=`@ ${esc(report.username)}`.replace('@ ','@'),range=`${dateLabel(report.start)} a ${dateLabel(report.end)}`;
 el.innerHTML=`<h4>${title} · ${range}</h4><div class="eco-ia-stats"><div><span>Pontos no período</span><strong>${fmt(report.points)}</strong></div><div><span>Interações registradas</span><strong>${fmt(report.events)}</strong></div><div><span>Total histórico</span><strong>${fmt(report.pointsAll)}</strong></div><div><span>Dias com registros</span><strong>${fmt(report.days.length)}</strong></div></div>
 <div class="eco-ia-grid"><div><h4>Por tipo de interação</h4><table class="eco-ia-table"><thead><tr><th>Origem</th><th>Ações</th><th>Pontos</th></tr></thead><tbody>${report.types.map(r=>`<tr><td>${esc(label(r.type))}</td><td>${fmt(r.count)}</td><td><strong>${fmt(r.points)}</strong></td></tr>`).join('')||'<tr><td colspan="3">Sem pontos neste período</td></tr>'}</tbody></table>
 <h4>Dia a dia</h4><table class="eco-ia-table"><thead><tr><th>Dia</th><th>Ações</th><th>Pontos</th></tr></thead><tbody>${report.days.map(r=>`<tr><td><button type="button" data-ia-day="${esc(r.day)}" title="Ver este dia">${dateLabel(r.day)}</button></td><td>${fmt(r.events)}</td><td><strong>${fmt(r.points)}</strong></td></tr>`).join('')||'<tr><td colspan="3">Sem atividades</td></tr>'}</tbody></table></div>
 <div><h4>Extrato de interações</h4><table class="eco-ia-table"><thead><tr><th>Data</th><th>Origem</th><th>Pontos</th></tr></thead><tbody>${report.entries.map(r=>`<tr><td>${dateLabel(r.day)}</td><td>${esc(label(r.type))}${r.sourceId?`<small style="display:block;color:#718ca8">Ref.: ${esc(r.sourceId).slice(0,42)}</small>`:''}</td><td><strong>${r.points>0?'+':''}${fmt(r.points)}</strong></td></tr>`).join('')||'<tr><td colspan="3">Nenhum lançamento</td></tr>'}</tbody></table><div class="eco-ia-controls"><span>Registros ${report.entries.length?offset+1:0}–${offset+report.entries.length}</span><div><button type="button" class="cff-account-button" data-ia-page="-1" ${offset===0?'disabled':''}>Anterior</button> <button type="button" class="cff-account-button" data-ia-page="1" ${!report.hasMore?'disabled':''}>Próxima</button></div></div></div></div>`;
 }
 async function load(nextOffset=0){if(!nick)return;const token=++serial;status('Consultando somente @'+nick+'…');$('[data-ia-filters]').hidden=false;const apply=$('[data-ia-apply]');apply.disabled=true;
 const body={username:nick,period,offset:nextOffset,date:$('[name=date]').value,from:$('[name=from]').value,to:$('[name=to]').value};
 try{const result=await request('interactionReport',body);if(token!==serial||!host.isConnected)return;report=result;offset=nextOffset;render();status(result.found?`Relatório de @${result.username} atualizado · ${dateLabel(result.start)} – ${dateLabel(result.end)} · Horário de Brasília`:'Instagram não encontrado. Digite o @ exato.');}
 catch(e){if(token!==serial)return;status(e.message||'Erro ao consultar pontos.');}
 finally{if(token===serial)apply.disabled=false}
 }
 host.addEventListener('submit',e=>{if(!e.target.matches('[data-ia-find]'))return;e.preventDefault();nick=String(new FormData(e.target).get('username')||'').replace(/^@/,'').trim().toLowerCase();period='week';filters();load(0)});
 host.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.iaPeriod){period=b.dataset.iaPeriod;filters();load(0)}else if(b.hasAttribute('data-ia-apply'))load(0);else if(b.dataset.iaDay){period='day';$('[name=date]').value=b.dataset.iaDay;filters();load(0)}else if(b.dataset.iaPage)load(Math.max(0,offset+Number(b.dataset.iaPage)*20));});
 return {open(name){const value=String(name||'').replace(/^@/,'').trim();if(!value)return;nick=value.toLowerCase();$('[name=username]').value=value;period='week';filters();host.scrollIntoView({block:'start',behavior:'smooth'});load(0)}};
}
