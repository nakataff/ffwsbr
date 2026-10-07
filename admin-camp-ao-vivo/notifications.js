import {getApps} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import {request,stylesheet} from '/js/camp-notifications.js?v=20261007-bell-v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,80);
const app=()=>getApps().find(a=>a.name==='[DEFAULT]')||getApps()[0];
const bell='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function snapshot(){const b=window.collectBackupData?.(true);if(!b?.selectedTeams?.length)throw Error('Adicione os times antes de configurar avisos.');return b;}
function identity(b){const stage=b.config?.cffFfwsStage,name=String(b.tournamentModeV1?.name||b.config?.tournamentName||'').trim();if(!name)throw Error('Defina o nome do torneio.');return {name,stage:['final','segundaFase'].includes(stage)?stage:'',id:['final','segundaFase'].includes(stage)?'ffws-br-2026-s2-'+stage.toLowerCase():''};}
function rowCode(row){return row.dataset.teamCode||row.dataset.v51TeamCode||row.querySelector('input[name="booyah"]')?.value||row.querySelector('[data-code]')?.dataset.code||Array.from(row.querySelectorAll('input[id]')).find(i=>/^(kills|pts|place|boo)-/.test(i.id))?.id.replace(/^(kills|pts|place|boo)-/,'')||'';}
function launchRow(code){return Array.from(document.querySelectorAll('#teams-inputs-container .team-row')).find(r=>rowCode(r)===code);}
function logo(code,name){const row=launchRow(code),team=window.getTeams?.().find(t=>t.code===code);const sources=[row?.querySelector('img.mini-logo,img')?.src,window.getLogo?.(name||team?.name||code)];for(const src of sources)try{if(!src)continue;const u=new URL(src,location.href);if(u.protocol==='https:'&&['centralfreefire.com.br','www.centralfreefire.com.br'].includes(u.hostname))return u.href;}catch{}return '';}
function roster(b){const catalog=String(b.teams||'').split(/\r?\n/).map(line=>line.split(',').map(v=>v.trim()));return b.selectedTeams.map(code=>{const row=catalog.find(r=>r[1]===code)||[code,code,code];return{id:key(code),code,name:row[0]||code,aliases:[code,row[2]||code],logo:logo(code,row[0]||code)};});}
async function catalog(){return (await request('settings',{},app())).catalog||{};}
function dialog(title,html){document.getElementById('cff-notify-dialog')?.remove();const d=document.createElement('dialog');d.id='cff-notify-dialog';d.className='cff-notify-dialog';d.innerHTML='<div class="cff-notify-dialog-heading"><h2>'+esc(title)+'</h2><button type="button" class="cff-notify-close" data-close aria-label="Fechar">×</button></div>'+html+'<p role="status" data-status></p>';d.querySelector('[data-close]').onclick=()=>d.close();d.addEventListener('close',()=>d.remove());document.body.append(d);d.showModal();return d;}
async function configure(){
 try{const b=snapshot(),info=identity(b),list=await catalog(),teams=roster(b),prior=info.id?list[info.id]:Object.values(list).find(t=>t.name===info.name),priorId=info.id||Object.keys(list).find(id=>list[id]===prior)||'camp-'+crypto.randomUUID();
 const d=dialog('Avisos do torneio','<form><p><strong>'+esc(info.name)+'</strong></p><label><input name="enabled" type="checkbox" '+(prior?.enabled?'checked':'')+'> Permitir avisos para este torneio</label><p class="cff-notify-help">As pessoas escolhem o torneio ou seus times na conta. Envie pelo sino do time em Lançar quedas.</p><button class="cff-camp-btn is-primary">Salvar configuração</button></form>');
 d.querySelector('form').onsubmit=async e=>{e.preventDefault();const submit=e.target.querySelector('button');submit.disabled=true;try{await request('configure',{tournamentId:priorId,name:info.name,enabled:e.target.elements.enabled.checked,teams,officialStage:info.stage},app());d.querySelector('[data-status]').textContent='Configuração salva. As pessoas já podem escolher os avisos pela conta.';}catch(e){d.querySelector('[data-status]').textContent=e.message;}finally{submit.disabled=false;}};
 }catch(e){window.CFF_CAMP?.toast?.(e.message,'err');}
}
function score(b,team,drop){
 const d=b.drops?.[drop-1],code=team.code;
 if(!d||['placements','kills','points'].some(k=>d[k]?.[code]===null||d[k]?.[code]===undefined||d[k]?.[code]===''||!Number.isInteger(Number(d[k][code])))||d.unknownKills?.[code]||d.estimatedKills?.[code])throw Error('Preencha posição, abates e pontos reais deste time na queda.');
 const row={teamId:team.id,team:team.name,position:Number(d.placements[code]),kills:Number(d.kills[code]),points:Number(d.points[code]),logo:logo(code,team.name)};
 if(row.position<1||row.kills<0||row.points<row.kills)throw Error('Confira posição, abates e pontos deste time.');
 row.dayPoints=b.drops.slice(0,drop).reduce((sum,d)=>sum+(Number(d.points?.[code])||0),0);
 return row;
}
async function publish(code){
 try{const b=snapshot(),info=identity(b),list=await catalog(),id=info.id||Object.keys(list).find(id=>list[id].name===info.name),t=list[id];if(!t?.enabled)throw Error('Abra Avisos do torneio e marque Permitir avisos primeiro.');
 const team=roster(b).find(r=>r.code===code&&t.teams?.[r.id]);if(!team)throw Error('Salve a configuração de avisos com este time primeiro.');
 const day=Number(b.tournamentModeV1?.draftDayNumber)||1,drop=Number(document.getElementById('drop-num')?.value)||1;
 let row=score(b,team,drop),sent=false;
 const d=dialog('Enviar aviso','<form><span class="cff-notify-badge">PONTUAÇÃO PARCIAL</span><p class="cff-notify-match">'+esc(info.name.replace(/\s*[—-]\s*Dia\s*\d+\s*$/i,''))+' / DIA '+day+' / QUEDA '+drop+'</p><div class="cff-notify-score-preview" data-preview></div><p class="cff-notify-help">Será enviado para quem acompanha este torneio ou time.</p><button class="cff-camp-btn is-primary cff-notify-send">'+bell+' Confirmar e enviar</button></form>');
 const f=d.querySelector('form'),status=d.querySelector('[data-status]'),button=f.querySelector('button');
 function preview(){try{const latest=snapshot();if(identity(latest).name!==info.name||(Number(latest.tournamentModeV1?.draftDayNumber)||1)!==day||(Number(document.getElementById('drop-num')?.value)||1)!==drop)throw Error('A queda mudou. Feche e abra o sino novamente.');row=score(latest,team,drop);d.querySelector('[data-preview]').innerHTML=(row.logo?'<img src="'+esc(row.logo)+'" alt="" class="cff-notify-team-logo">':'')+'<div><strong>'+esc(team.name)+'</strong><p>'+esc(team.name)+' acaba de cair no top '+row.position+' com '+row.kills+' abates!</p><div class="cff-notify-score-values"><span><b>'+row.points+'</b> pts na queda</span><span><b>'+row.dayPoints+'</b> pts no dia</span></div></div>';button.disabled=sent;}catch(e){status.textContent=e.message;button.disabled=true;}}
 preview();f.onsubmit=async e=>{e.preventDefault();preview();if(button.disabled)return;button.disabled=true;try{const r=await request('publish',{tournamentId:id,day,drop,result:row},app());sent=true;status.textContent=r.duplicate?'Este aviso já foi enviado.':'Aviso enviado para a fila de notificações.';button.textContent=r.duplicate?'Já enviado':'✓ Aviso confirmado';const trigger=launchRow(code)?.querySelector('.cff-notify-bell');if(trigger){trigger.classList.add('is-sent');trigger.title='Aviso confirmado — clique para conferir';}}catch(e){status.textContent=e.message;}finally{button.disabled=sent;}};
 }catch(e){window.CFF_CAMP?.toast?.(e.message,'err');}
}
function attachBells(){
 document.querySelectorAll('#teams-inputs-container .team-row').forEach(row=>{
  if(row.classList.contains('starting-row'))return;
  const code=rowCode(row),header=row.querySelector('.team-flex');if(!code||!header||row.querySelector('.cff-notify-bell'))return;
  const button=document.createElement('button');button.type='button';button.className='cff-notify-bell';button.innerHTML=bell;button.title='Confirmar eliminação e enviar aviso';button.setAttribute('aria-label','Enviar aviso de eliminação de '+code);button.tabIndex=-1;
  button.onclick=e=>{e.preventDefault();e.stopPropagation();publish(code);};header.append(button);
 });
}
function boot(){
 if(window.__CFF_CAMP_READY__!==true||!document.querySelector('.cff-camp-command'))return false;
 stylesheet();const tools=document.createElement('div');tools.className='cff-notify-admin';tools.innerHTML='<button type="button" class="cff-camp-btn" data-config>'+bell+' Avisos do torneio</button><a class="cff-camp-btn" href="/conta.html?tab=notifications" target="_blank" rel="noopener">Testar na minha conta ↗</a><span>Envie pelo sino ao lado do nome do time em Lançar quedas.</span>';tools.querySelector('[data-config]').onclick=configure;document.querySelector('.cff-camp-command').append(tools);
 attachBells();const container=document.getElementById('teams-inputs-container');if(container){let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;attachBells();});}).observe(container,{childList:true,subtree:true});}
 return true;
}
if(!boot()){let attempts=0;const timer=setInterval(()=>{if(boot()||++attempts>120)clearInterval(timer);},500);}
