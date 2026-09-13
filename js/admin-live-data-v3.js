import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import { getDatabase, ref, get, update, remove, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';

const ADMIN_EMAIL='admin@centralfreefire.com.br';
const PROD_ROOT='ffwsLive/2026-s2';
const TEST_ROOT='ffwsLive/2026-s2/teste';
const firebaseConfig=window.CFF_CONFIG?.firebase;
if(!firebaseConfig) throw new Error('Configuração Firebase não encontrada.');

const app=getApps().length?getApp():initializeApp(firebaseConfig);
const auth=getAuth(app),db=getDatabase(app);
setPersistence(auth,browserLocalPersistence).catch(()=>{});

const $=s=>document.querySelector(s);
const E={
  login:$('#live-login'),dashboard:$('#live-dashboard'),password:$('#live-password'),loginBtn:$('#live-login-btn'),loginMsg:$('#live-login-message'),logout:$('#live-logout'),
  stage:$('#live-stage'),day:$('#live-day'),drop:$('#live-drop'),next:$('#live-next'),map:$('#live-map'),customMapWrap:$('#live-custom-map-wrap'),customMap:$('#live-custom-map'),
  teamsFile:$('#live-teams-file'),playersFile:$('#live-players-file'),teamsStatus:$('#live-teams-status'),playersStatus:$('#live-players-status'),validate:$('#live-validate'),publish:$('#live-publish'),
  message:$('#live-message'),preview:$('#live-preview'),refresh:$('#live-refresh'),count:$('#live-count'),updated:$('#live-updated'),list:$('#live-drop-list'),stageHelp:$('#live-stage-help'),testMode:$('#live-test-mode')
};

const BONUS=Object.freeze({'LOS':50,'LOUD SNICKERS':42,'FLUXO W7M':35,'INTZ':29,'TEAM SOLID':24,'RISE GAMING':19,'ALPHA7':15,'RUSH GAMING':11,'INFLUENCE RAGE':8,'CPT VOX':5,'AFROGAMES':2,'SX TET':0});
const STAGES=Object.freeze({
  segundaFase:{label:'Segunda Fase',days:6,dropsByDay:{1:6,2:6,3:6,4:6,5:6,6:6}},
  final:{label:'Final',days:2,dropsByDay:{1:6,2:10},championPoint:160}
});
const POINTS_TO_PLACEMENT={12:1,9:2,8:3,7:4,6:5,5:6,4:7,3:8,2:9,1:10};

let stageData={},teamText='',playerText='',teamFileName='',playerFileName='',rosterNames=new Set();

const clean=v=>String(v??'').replace(/^\uFEFF/,'').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toUpperCase();
const normHeader=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const num=v=>{let x=clean(v).replace(/\s/g,'');if(/^[-+]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(x))x=x.replace(/\./g,'').replace(',','.');else if(/^[-+]?\d+(?:,\d+)?$/.test(x))x=x.replace(',','.');x=x.replace(/[^\d.+-]/g,'');const n=Number(x);return Number.isFinite(n)?n:0};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function canonicalTeam(value){
  const key=norm(value),a={
    LOS:'LOS',LOUD:'LOUD SNICKERS',LOUDSNICKERS:'LOUD SNICKERS',FX:'FLUXO W7M',FLUXO:'FLUXO W7M',FLUXOW7M:'FLUXO W7M',W7M:'FLUXO W7M',
    INTZ:'INTZ',INTZESPORTS:'INTZ',TS:'TEAM SOLID',TEAMSOLID:'TEAM SOLID',SOLID:'TEAM SOLID',RISE:'RISE GAMING',RISEGAMING:'RISE GAMING',
    A7:'ALPHA7',ALPHA7:'ALPHA7',RSHM:'RUSH GAMING',RUSH:'RUSH GAMING',RUSHGAMING:'RUSH GAMING',INF:'INFLUENCE RAGE',IR:'INFLUENCE RAGE',INFLUENCERAGE:'INFLUENCE RAGE',
    CPT:'CPT VOX',CPTVOX:'CPT VOX',AFG:'AFROGAMES',AFRO:'AFROGAMES',AFROGAMES:'AFROGAMES',SXT:'SX TET',SXTET:'SX TET',
    CIVIS:'CIVIS',CIVISSPORTS:'CIVIS',CVS:'CIVIS',CTZ:'CIVIS',LOOPS:'LOOPS',LPS:'LOOPS'
  };
  return a[key]||clean(value).toUpperCase();
}
function splitLine(line,sep){const out=[];let cur='',quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){cur+='"';i++}else quoted=!quoted}else if(ch===sep&&!quoted){out.push(cur);cur=''}else cur+=ch}out.push(cur);return out.map(v=>clean(v.replace(/^"|"$/g,'')))}
function parseTable(text){
  const raw=String(text||'').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n'),lines=raw.split('\n').filter(x=>x.trim());
  if(!lines.length)return[];
  const head=lines[0],sep=head.includes('\t')?'\t':((head.match(/;/g)||[]).length>(head.match(/,/g)||[]).length?';':',');
  const headers=splitLine(head,sep);
  return lines.slice(1).map(line=>{const cols=splitLine(line,sep),row={};headers.forEach((h,i)=>row[normHeader(h)]=cols[i]??'');return row}).filter(row=>Object.values(row).some(v=>clean(v)));
}
function read(row,names){for(const name of names){const key=normHeader(name);if(Object.prototype.hasOwnProperty.call(row,key)&&clean(row[key])!=='')return row[key]}return''}
function parseTeams(text){
  const rows=parseTable(text),parsed=[],zero=[];
  rows.forEach((row,index)=>{
    const rawTeam=read(row,['Equipe','Time','Team']);if(!rawTeam)return;
    const team=canonicalTeam(rawTeam),kills=num(read(row,['Abates','Kills','Kill'])),points=num(read(row,['Pontos','Pontos Totais','Total','Points'])),booyah=num(read(row,['Booyah','BOOYAH','Booyahs']));
    let position=Math.trunc(num(read(row,['Posição','Posicao','POS','Pos','Position','Placement','Média Posição','Media Posição','Média Posicao','Media Posicao','Posição Média','Posicao Media'])));
    const ppRaw=read(row,['Pontos de Colocação','Pontos Colocação','Placement Points','PP']),placementPoints=ppRaw===''?Math.max(0,points-kills):num(ppRaw);
    if(!position){position=POINTS_TO_PLACEMENT[placementPoints]||0;if(placementPoints===0)zero.push(index)}
    parsed.push({team,position,placementPoints,kills,points,booyah:booyah>0?1:0});
  });
  if(zero.length===1&&parsed[zero[0]])parsed[zero[0]].position=11;
  return parsed;
}
function parsePlayers(text){
  return parseTable(text).map(row=>{
    const name=clean(read(row,['Jogador','Player','Nome'])),team=canonicalTeam(read(row,['Equipe','Time','Team']));if(!name||!team)return null;
    return{name,team,kills:num(read(row,['Abates','Kills','Kill'])),damage:num(read(row,['Dano','Damage'])),assists:num(read(row,['Assists','Assistências','Assistencias'])),mvp:num(read(row,['MVP'])),survival:num(read(row,['Sobrevivência','Sobrevivencia','Survival'])),revives:num(read(row,['Revives','Revive']))};
  }).filter(Boolean);
}

function isTest(){return Boolean(E.testMode?.checked)}
function rootPath(){return isTest()?TEST_ROOT:PROD_ROOT}
function cfg(){return STAGES[E.stage.value]||STAGES.segundaFase}
function stagePath(){return`${rootPath()}/${E.stage.value}`}
function mapName(){return E.map.value==='Outro'?clean(E.customMap.value):clean(E.map.value)}
function msg(text,type=''){E.message.textContent=text||'';E.message.className=`live-message${type?' '+type:''}`}
function loginMsg(text,type=''){E.loginMsg.textContent=text||'';E.loginMsg.className=`live-message${type?' '+type:''}`}
function fmtTime(v){const n=Number(v||0);if(!n)return'—';try{return new Date(n).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return'—'}}
function drops(data=stageData){const out=[],days=data?.drops||{};Object.keys(days).sort((a,b)=>Number(a)-Number(b)).forEach(day=>{const ds=days[day]||{};Object.keys(ds).sort((a,b)=>Number(a)-Number(b)).forEach(drop=>{const item=ds[drop];if(item)out.push({...item,day:Number(item.day||day),drop:Number(item.drop||drop)})})});return out}
function nextDrop(){const c=cfg(),used=new Set(drops().map(x=>`${x.day}:${x.drop}`));for(let day=1;day<=c.days;day++)for(let drop=1;drop<=Number(c.dropsByDay[day]||0);drop++)if(!used.has(`${day}:${drop}`))return{day,drop};return null}
function applyNext(){const n=nextDrop();if(n){E.next.value=`Dia ${n.day} • Queda ${n.drop}`;E.day.value=n.day;E.drop.value=n.drop}else E.next.value='Etapa completa'}
function render(){
  const list=drops();E.count.textContent=String(list.length);E.updated.textContent=fmtTime(stageData.updatedAt);
  E.stageHelp.textContent=isTest()
    ? 'MODO TESTE: aceita equipes antigas e salva tudo em uma área isolada. Esses dados NÃO entram no site público.'
    : (E.stage.value==='final'?'Final: Dia 1 com 6 quedas; Dia 2 com até 10; Champion Rush em 160 pontos.':'Segunda Fase: 6 dias × 6 quedas; os bônus da Classificatória são somados automaticamente.');
  E.list.innerHTML=list.length?list.slice().reverse().map(x=>`<div class="live-drop"><div><strong>Dia ${x.day} • Q${x.drop}</strong><small> • ${esc(x.map||'Sem mapa')}</small></div><div class="live-actions" style="margin:0"><button class="live-btn ghost" style="padding:6px 8px" data-edit-drop="${x.day}:${x.drop}" type="button">Editar</button><button class="live-btn danger" style="padding:6px 8px" data-delete-drop="${x.day}:${x.drop}" type="button">Excluir</button></div></div>`).join(''):'<div class="live-note">Nenhuma queda salva ainda.</div>';
  if(E.publish)E.publish.textContent=isTest()?'PROCESSAR TESTE':'PROCESSAR E PUBLICAR';
  applyNext();
}
async function loadStage(){
  msg(isTest()?'Carregando área de teste…':'Carregando dados da etapa…');
  try{const snap=await get(ref(db,stagePath()));stageData=snap.val()||{};render();msg(isTest()?'Área de teste carregada. Nada daqui altera o site público.':'Dados carregados.','ok')}
  catch(error){console.error(error);stageData={};render();msg('Não foi possível ler a base.','error')}
}
async function loadRoster(){try{const r=await fetch(`ffws-br-2026-s2/teams.json?v=${Date.now()}`,{cache:'no-store'}),j=await r.json();rosterNames=new Set((j.teams||[]).flatMap(t=>t.players||[]).map(norm))}catch{rosterNames=new Set()}}
async function fileRead(input,type){const f=input.files?.[0];if(!f)return;const text=await f.text();if(type==='teams'){teamText=text;teamFileName=f.name;E.teamsStatus.textContent=`${f.name} carregado`;E.teamsStatus.className='live-file-ok'}else{playerText=text;playerFileName=f.name;E.playersStatus.textContent=`${f.name} carregado`;E.playersStatus.className='live-file-ok'}}

function validatePayload(){
  const c=cfg(),day=Math.trunc(Number(E.day.value||0)),drop=Math.trunc(Number(E.drop.value||0)),max=Number(c.dropsByDay[day]||0),map=mapName();
  if(day<1||day>c.days)throw new Error(`Dia inválido para ${c.label}.`);
  if(drop<1||drop>max)throw new Error(`Queda inválida. Dia ${day} aceita até ${max}.`);
  if(!map)throw new Error('Escolha o mapa desta queda.');
  if(!teamText||!playerText)throw new Error('Envie T1 e P1.');
  const teams=parseTeams(teamText),players=parsePlayers(playerText);
  if(teams.length!==12)throw new Error(`T1: encontrei ${teams.length} equipes; deveriam ser 12.`);
  if(!players.length)throw new Error('P1: nenhum jogador reconhecido. Confira os cabeçalhos.');
  const positions=teams.map(x=>x.position).filter(x=>x>=1&&x<=12);
  if(new Set(positions).size!==12)throw new Error('T1: não consegui identificar posições 1º–12º. A coluna pode ser “Média Posição” ou “Posição”.');

  const allowed=new Set(Object.keys(BONUS).map(norm)),badTeams=teams.filter(x=>!allowed.has(norm(x.team))).map(x=>x.team);
  if(badTeams.length&&!isTest())throw new Error(`Equipe fora da Segunda Fase/Final: ${badTeams.join(', ')}. Para testar arquivos antigos, ative “Modo teste”.`);

  const tk=new Map(teams.map(x=>[norm(x.team),Number(x.kills||0)])),pk=new Map();
  players.forEach(x=>pk.set(norm(x.team),(pk.get(norm(x.team))||0)+Number(x.kills||0)));
  const mismatch=teams.filter(x=>(tk.get(norm(x.team))||0)!==(pk.get(norm(x.team))||0)).map(x=>`${x.team}: T=${tk.get(norm(x.team))||0} / P=${pk.get(norm(x.team))||0}`);
  if(mismatch.length)throw new Error(`Abates T1 × P1 não batem: ${mismatch.join(' • ')}`);

  const unknown=rosterNames.size?players.filter(x=>!rosterNames.has(norm(x.name))).map(x=>x.name):[];
  return{payload:{stage:E.stage.value,day,drop,map,teams:teams.sort((a,b)=>a.position-b.position),players,source:{teams:teamFileName||'T1',players:playerFileName||'P1'},testMode:isTest(),updatedAt:Date.now()},unknown,badTeams};
}
function preview(result){
  const p=result.payload,totalK=p.teams.reduce((s,x)=>s+num(x.kills),0),totalD=p.players.reduce((s,x)=>s+num(x.damage),0),lines=[];
  lines.push(`${isTest()?'TESTE • ':''}OK • ${cfg().label} • Dia ${p.day} • Q${p.drop} • ${p.map}`);
  lines.push(`${p.teams.length} equipes • ${p.players.length} jogadores • ${totalK} abates • ${Math.round(totalD).toLocaleString('pt-BR')} dano`);
  if(result.badTeams?.length)lines.push(`MODO TESTE — equipes fora da etapa atual: ${result.badTeams.join(', ')}`);
  lines.push(result.unknown.length?`ATENÇÃO — jogadores fora do roster atual: ${result.unknown.join(', ')}`:'Roster: todos reconhecidos.');
  lines.push('',...p.teams.map(x=>`${String(x.position).padStart(2,'0')}º ${x.team.padEnd(17)} ${String(x.points).padStart(3)} pts • ${String(x.kills).padStart(2)} K`));
  E.preview.textContent=lines.join('\n');E.preview.classList.remove('live-hidden');msg(isTest()?'Teste validado. Pode processar sem afetar o site público.':'T1 + P1 conferidos. Pode publicar.','ok');
}
async function publish(){
  let result;try{result=validatePayload();preview(result)}catch(error){msg(error.message||String(error),'error');return}
  const p=result.payload,target=ref(db,`${stagePath()}/drops/${p.day}/${p.drop}`);
  try{
    const snap=await get(target);if(snap.exists()&&!confirm(`Dia ${p.day} • Q${p.drop} já existe ${isTest()?'na área de teste':'na etapa'}. Substituir?`))return;
    E.publish.disabled=true;msg(isTest()?'Processando teste…':'Publicando…');
    const u={};u[`${stagePath()}/drops/${p.day}/${p.drop}`]=p;u[`${stagePath()}/updatedAt`]=serverTimestamp();u[`${stagePath()}/formatVersion`]=3;u[`${stagePath()}/label`]=`${cfg().label}${isTest()?' • TESTE':''}`;
    if(!isTest()&&E.stage.value==='segundaFase')u[`${stagePath()}/bonus`]=BONUS;
    if(!isTest()&&E.stage.value==='final')u[`${stagePath()}/championPoint`]=160;
    await update(ref(db),u);
    teamText=playerText=teamFileName=playerFileName='';E.teamsFile.value='';E.playersFile.value='';E.teamsStatus.textContent='Nenhum arquivo selecionado';E.playersStatus.textContent='Nenhum arquivo selecionado';
    await loadStage();msg(isTest()?'Teste salvo na área isolada. O site público não foi alterado.':'Queda publicada. O site passa a consumir os novos dados.','ok');
  }catch(error){console.error(error);msg(`Falha ao salvar: ${error.message||error}`,'error')}finally{E.publish.disabled=false}
}
async function editDrop(day,drop){
  const item=stageData?.drops?.[day]?.[drop];if(!item)return;
  E.day.value=day;E.drop.value=drop;const known=[...E.map.options].some(o=>o.value===item.map||o.textContent===item.map);if(known){E.map.value=item.map;E.customMapWrap.classList.add('live-hidden')}else{E.map.value='Outro';E.customMap.value=item.map||'';E.customMapWrap.classList.remove('live-hidden')}
  msg(`Editando Dia ${day} • Q${drop}. Reenvie T1 e P1 para substituir.`,'ok');
}
async function deleteDrop(day,drop){
  if(!confirm(`Excluir Dia ${day} • Q${drop}${isTest()?' da área de teste':''}?`))return;
  try{await remove(ref(db,`${stagePath()}/drops/${day}/${drop}`));await update(ref(db),{[`${stagePath()}/updatedAt`]:serverTimestamp()});await loadStage();msg('Queda excluída.','ok')}catch(error){msg(`Falha ao excluir: ${error.message||error}`,'error')}
}

E.teamsFile?.addEventListener('change',()=>fileRead(E.teamsFile,'teams'));
E.playersFile?.addEventListener('change',()=>fileRead(E.playersFile,'players'));
E.map?.addEventListener('change',()=>E.customMapWrap.classList.toggle('live-hidden',E.map.value!=='Outro'));
E.stage?.addEventListener('change',()=>loadStage());
E.testMode?.addEventListener('change',()=>{stageData={};E.preview.classList.add('live-hidden');loadStage()});
E.refresh?.addEventListener('click',()=>loadStage());
E.validate?.addEventListener('click',()=>{try{preview(validatePayload())}catch(error){msg(error.message||String(error),'error')}});
E.publish?.addEventListener('click',publish);
E.list?.addEventListener('click',event=>{const edit=event.target.closest('[data-edit-drop]'),del=event.target.closest('[data-delete-drop]');if(edit){const[d,q]=edit.dataset.editDrop.split(':').map(Number);editDrop(d,q)}if(del){const[d,q]=del.dataset.deleteDrop.split(':').map(Number);deleteDrop(d,q)}});
E.loginBtn?.addEventListener('click',async()=>{const password=E.password.value;E.loginBtn.disabled=true;loginMsg('Entrando…');try{await signInWithEmailAndPassword(auth,ADMIN_EMAIL,password);E.password.value=''}catch(error){loginMsg('Senha inválida ou acesso não autorizado.','error')}finally{E.loginBtn.disabled=false}});
E.password?.addEventListener('keydown',event=>{if(event.key==='Enter')E.loginBtn.click()});
E.logout?.addEventListener('click',()=>signOut(auth));

onAuthStateChanged(auth,user=>{
  const allowed=user&&String(user.email||'').toLowerCase()===ADMIN_EMAIL;
  E.login?.classList.toggle('live-hidden',Boolean(allowed));E.dashboard?.classList.toggle('live-hidden',!allowed);E.logout?.classList.toggle('live-hidden',!allowed);
  if(allowed){loadRoster();loadStage()}else{stageData={};render();if(user)loginMsg('Este usuário não tem acesso ao painel.','error')}
});
