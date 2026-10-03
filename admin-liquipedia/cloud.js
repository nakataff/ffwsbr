import {initializeApp,getApp,getApps} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import {getDatabase,ref,get,runTransaction} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';
const ROOT='adminLiquipediaEditor',ADMIN='admin@centralfreefire.com.br';
const reasonLabels={manual:'Salvamento manual',generateWiki:'Código gerado',exportJSON:'Backup exportado',saveParticipantToDb:'Time salvo',saveTeamDbFromText:'Time importado',updateSelectedTeamDbFromText:'Time atualizado',deleteSelectedTeamDb:'Time excluído',clearTeamDatabase:'Banco de times limpo','modelo-salvo':'Modelo salvo','modelo-aplicado':'Modelo aplicado','modelo-excluido':'Modelo excluído','time-editado':'Ficha editada','backup-importado':'Backup importado','edicao-periodica':'Edição em andamento'};
let user=null,db=null,baselineId='',ready=false,busy=false,pendingReason='',timer=0,lastSerialized='',autoEnabled=true;
const status=text=>{for(const id of ['editorCloudStatus','editorCloudBadge']){const el=document.getElementById(id);if(el)el.textContent=text;}};
const time=value=>new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
try{autoEnabled=localStorage.getItem('cff-liquipedia-cloud-auto')!=='false';}catch(error){}
const check=document.getElementById('editorCloudAuto');if(check)check.checked=autoEnabled;
function namedProject(data){return !!(data.infobox?.name||data.infobox?.displayTitle||(data.teams||[]).some(t=>t.name));}
async function save(reason='manual'){
  window.EditorLiquipedia?.flush();
  if(!ready||!user||!db){status('Nuvem: sessão ainda indisponível. O navegador mantém os dados.');return false;}
  if(reason!=='manual'&&!autoEnabled)return false;
  const data=window.EditorLiquipedia.snapshot();if(reason!=='manual'&&!namedProject(data))return false;
  const serialized=JSON.stringify(data);if(reason!=='manual'&&serialized===lastSerialized)return true;
  if(busy){pendingReason=reason;return false;}
  if(!navigator.onLine){pendingReason=reason;status('Nuvem: sem conexão. Dados salvos no navegador.');return false;}
  busy=true;status('Nuvem: salvando checkpoint…');
  const now=Date.now(),id='cp-'+now+'-'+Math.random().toString(36).slice(2,8);
  const payload={id,updatedAt:now,reason:reasonLabels[reason]||reason,name:data.infobox?.name||data.infobox?.displayTitle||'Projeto sem nome',projectId:data.projectId,backup:serialized};
  const expected=baselineId;
  const timeout=setTimeout(()=>{if(busy)status('Nuvem: aguardando conexão. O navegador mantém os dados.');},12000);
  try{
    // Compare the checkpoint before replacing it; another device can never be silently overwritten.
    const result=await runTransaction(ref(db,ROOT),remote=>{
      if((remote?.current?.id||'')!==expected)return;
      const history={...(remote?.history||{}),[id]:payload};
      Object.values(history).sort((a,b)=>Number(b.updatedAt)-Number(a.updatedAt)).slice(20).forEach(item=>delete history[item.id]);
      return {...(remote||{}),current:payload,history};
    },{applyLocally:false});
    if(!result.committed){status('Nuvem: há um backup mais recente de outra sessão. Abra “Ver backups na nuvem”.');pendingReason='';return false;}
    baselineId=id;lastSerialized=serialized;status('Nuvem: salvo '+time(now));return true;
  }catch(error){status('Nuvem: não foi possível salvar. Dados preservados no navegador.');return false;}
  finally{clearTimeout(timeout);busy=false;if(pendingReason){const next=pendingReason;pendingReason='';checkpoint(next);}}
}
function checkpoint(reason){if(!autoEnabled)return;clearTimeout(timer);timer=setTimeout(()=>save(reason),1400);}
function row(label,when,onRestore){
  const item=document.createElement('div');item.className='cloud-backup-row';const text=document.createElement('span');text.textContent=label+' · '+time(when);
  const button=document.createElement('button');button.className='tiny';button.textContent='Restaurar';button.onclick=onRestore;item.append(text,button);return item;
}
async function list(){
  const root=document.getElementById('editorCloudBackups');root.replaceChildren();
  const heading=document.createElement('strong');heading.textContent='Checkpoints e recuperação';root.append(heading);
  try{
    if(!ready||!db)throw Error('auth');
    const snap=await get(ref(db,ROOT));const remote=snap.val()||{};const items=Object.values(remote.history||{}).sort((a,b)=>b.updatedAt-a.updatedAt);
    if(remote.current&&!items.some(item=>item.id===remote.current.id))items.unshift(remote.current);
    for(const item of items){root.append(row(item.name+' ('+item.reason+')',item.updatedAt,()=>{
      if(!confirm(`Restaurar "${item.name}" de ${time(item.updatedAt)}? Uma cópia do projeto atual ficará guardada neste navegador.`))return;
      try{const parsed=JSON.parse(item.backup);window.EditorLiquipedia.restore(parsed);baselineId=remote.current?.id||'';lastSerialized=item.backup;status('Nuvem: checkpoint restaurado '+time(item.updatedAt));}catch(error){status('Esse checkpoint é inválido. O projeto atual foi preservado.');}
    }));}
    if(!items.length){const empty=document.createElement('p');empty.className='hint';empty.textContent='Nenhum checkpoint na nuvem ainda.';root.append(empty);}
  }catch(error){const info=document.createElement('p');info.className='hint';info.textContent='A nuvem não respondeu. As cópias locais aparecem abaixo.';root.append(info);}
  for(const item of window.EditorLiquipedia.history()){root.append(row('Navegador — '+item.label,item.updatedAt,()=>{if(confirm('Restaurar essa cópia local?'))window.EditorLiquipedia.restore(item.data);}));}
}
window.editorCloud={save,list,checkpoint,setAuto(enabled){autoEnabled=!!enabled;try{localStorage.setItem('cff-liquipedia-cloud-auto',String(autoEnabled));}catch(error){}status(autoEnabled?'Nuvem: checkpoints automáticos ativados':'Nuvem: salvamento manual');}};
window.addEventListener('online',()=>{if(pendingReason){const reason=pendingReason;pendingReason='';checkpoint(reason);}});
setInterval(()=>checkpoint('edicao-periodica'),120000);
const overlay=document.getElementById('cff-camp-auth');
try{
  const config=window.CFF_CONFIG?.firebase;if(!config)throw Error('config');
  const app=getApps().length?getApp():initializeApp(config);db=getDatabase(app);
  onAuthStateChanged(getAuth(app),async current=>{
    user=current;ready=false;
    if(!current||String(current.email||'').toLowerCase()!==ADMIN){location.replace('admin.html');return;}
    document.body.classList.remove('cff-auth-pending');overlay.hidden=true;
    try{const snap=await get(ref(db,ROOT+'/current'));const remote=snap.val();baselineId=remote?.id||'';ready=true;
      status(remote?'Nuvem: backup disponível de '+time(remote.updatedAt):'Nuvem: pronta para salvar');
    }catch(error){ready=true;status('Nuvem: não foi possível consultar o último backup. O navegador mantém os dados.');}
  },()=>{status('Nuvem: não foi possível validar a sessão.');});
}catch(error){overlay.querySelector('[data-cff-auth-status]').textContent='Não foi possível carregar a sessão. Volte ao painel e tente novamente.';}
