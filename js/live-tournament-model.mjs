export const PHASES=['Fase de grupos','Knockout','Point Rush','Repescagem','Semifinal','Grande final','Outra fase'];
export const LIMIT=180;
const id=()=>crypto.randomUUID(),fail=message=>{throw Error(message);};
export function safeLink(value,{local=false}={}){const text=String(value||'').trim();if(!text)return '';if(text.length>1000||/[\u0000-\u0020\\]/.test(text))return fail('Informe um link válido, sem espaços.');let u;try{u=new URL(text,'https://centralfreefire.com.br');}catch{return fail('Link inválido.');}if(u.protocol!=='https:'||u.username||u.password||(!local&&!/^https:\/\//i.test(text)))return fail('Use um link HTTPS completo.');return local&&u.origin==='https://centralfreefire.com.br'?u.pathname+u.search+u.hash:u.href;}
export function channelLink(value){const link=safeLink(value);if(!link)return '';const u=new URL(link),host=u.hostname.replace(/^www\./,'');if(['youtube.com','m.youtube.com'].includes(host)&&/^\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)(?:\/streams)?\/?$/.test(u.pathname)){u.pathname=u.pathname.replace(/\/streams\/?$/,'').replace(/\/$/,'')+'/live';u.search='';u.hash='';}return u.href;}
export function alternatives(text){if(String(text||'').split('\n').filter(x=>x.trim()).length>8)fail('Use no máximo 8 alternativas.');return String(text||'').split('\n').filter(s=>s.trim()).map((line,i)=>{const parts=line.split('|');if(parts.length!==2||!parts[0].trim()||!parts[1]?.trim()||parts[0].trim().length>80)fail('Use uma alternativa por linha: Nome do canal | https://...');return {label:parts[0].trim(),url:channelLink(parts[1])};}).filter(x=>x.url).slice(0,8);}
export function brtTime(day,time){if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return NaN;const date=new Date(day+'T'+time+':00-03:00');if(!Number.isFinite(date.getTime())||new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)!==day)return NaN;return date.getTime();}
export function newTournament(){return {id:id(),name:'',logo:'',pageUrl:'',region:'brasil',level:'oficial',channel:'',url:'',alternatives:'',featured:'main',linkMode:'schedule',phases:[],revision:0,publishedIds:[],publishedAt:0,hasUnpublishedChanges:false};}
export function newPhase(name='Fase de grupos'){return {id:id(),name,time:'19:00',hours:3,slots:[]};}
export function addDay(phase,day){if(!Number.isFinite(brtTime(day,phase.time)))fail('Selecione uma data e um horário válidos.');const slot={id:id(),day,time:phase.time,hours:Number(phase.hours)||3,label:'Dia '+(new Set(phase.slots.map(x=>x.day)).size+1),url:'',channel:'',alternatives:'',status:'auto',embed:false};phase.slots.push(slot);return slot;}
export function clonePhase(phase){const result=structuredClone(phase);result.id=id();result.name=phase.name+' (cópia)';result.slots=result.slots.map(s=>({...s,id:id(),status:'auto'}));return result;}
export function cloneSlot(slot){return {...structuredClone(slot),id:id(),label:slot.label+' (cópia)',status:'auto'};}
export function compileTournament(raw,{now=Date.now(),requireSchedule=true}={}){
 const t=structuredClone(raw),warnings=[],rows={};
 if(!/^[a-f0-9-]{36}$/.test(t.id||'')||String(t.name||'').trim().length<2||t.name.trim().length>120)fail('Informe o nome do torneio (até 120 caracteres).');
 if(!['brasil','internacional'].includes(t.region)||!['oficial','amador'].includes(t.level))fail('Confira a região e a categoria.');
 t.name=t.name.trim();t.logo=safeLink(t.logo,{local:true});t.pageUrl=safeLink(t.pageUrl,{local:true});t.url=channelLink(t.url);t.channel=String(t.channel||'').trim();if(t.channel.length>120)fail('O nome do canal deve ter até 120 caracteres.');
 const defaultAlt=alternatives(t.alternatives);if(!Array.isArray(t.phases)||t.phases.length>16)fail('Use no máximo 16 fases por torneio.');
 const total=t.phases.reduce((n,p)=>n+(p.slots?.length||0),0);if(total>LIMIT)fail('Use no máximo 180 rodadas por torneio.');if(requireSchedule&&!total)fail('Selecione ao menos um dia no calendário.');
 const ids=new Set(),windows=[];let past=0;
 for(const phase of t.phases){if(!/^[a-f0-9-]{36}$/.test(phase.id||'')||ids.has(phase.id)||!String(phase.name||'').trim()||phase.name.length>80)fail('Confira o nome e o identificador de cada fase.');ids.add(phase.id);
  if(!Array.isArray(phase.slots))fail('Rodadas inválidas.');
  for(const slot of phase.slots){if(!/^[a-f0-9-]{36}$/.test(slot.id||'')||ids.has(slot.id))fail('Uma rodada está duplicada. Use o botão Duplicar para criar outra.');ids.add(slot.id);
   const start=brtTime(slot.day,slot.time),duration=Math.round(Number(slot.hours)*60),label=String(slot.label||'').trim(),status=slot.status||'auto';if(!Number.isFinite(start)||!Number.isFinite(duration)||duration<1||duration>4320||label.length>100||!['auto','live','ended','cancelled'].includes(status))fail('Confira data, horário, duração e situação das rodadas.');
   const url=channelLink(slot.url||t.url),channel=String(slot.channel||t.channel).trim(),links=slot.alternatives?.trim()?alternatives(slot.alternatives):defaultAlt;
   if(requireSchedule&&status!=='cancelled'&&(!url||!channel))fail('Defina o canal e o link padrão, ou preencha os links das rodadas.');
   if(channel.length>120)fail('O nome do canal de uma rodada é muito longo.');
   const videoId=(()=>{if(!url)return '';const u=new URL(url),h=u.hostname.replace(/^www\./,'');return h==='youtu.be'?u.pathname.slice(1):['youtube.com','m.youtube.com'].includes(h)?u.searchParams.get('v')||u.pathname.match(/^\/live\/([A-Za-z0-9_-]{6,20})$/)?.[1]||'':'';})();
   if(slot.embed&&!/^[A-Za-z0-9_-]{6,20}$/.test(videoId))fail('Para assistir pelo site, a rodada precisa de um link direto do vídeo do YouTube.');
   const key='tournament-'+t.id+'-'+slot.id,end=start+duration*60000;
   if(end<now)past++;
   if(status==='cancelled')continue;
   rows[key]={id:key,torneio:t.name,faseDia:[phase.name,label].filter(Boolean).join(' · '),canal:channel||'Canal a definir',url,links,regiao:t.region,nivel:t.level,tipo:'misto',inicio:slot.day+'T'+slot.time,duracaoMinutos:duration,endAt:end,linkMode:t.linkMode==='always'?'always':'schedule',tournamentId:t.id,phaseId:phase.id,slotId:slot.id,logo:t.logo,pageUrl:t.pageUrl,scheduleState:status,featuredUrl:t.featured==='main'?url:links[Number(t.featured)]?.url||url,embedEnabled:!!slot.embed,...(slot.embed?{embedVideoId:videoId,embedUrl:url}:{})};
   if(status!=='ended')windows.push({start,end,name:phase.name+' / '+(label||slot.day)});
  }
 }
 windows.sort((a,b)=>a.start-b.start);for(let i=0;i<windows.length;i++)for(let j=i+1;j<windows.length&&windows[j].start<windows[i].end;j++){if(warnings.length<12)warnings.push('Horários sobrepostos: '+windows[i].name+' e '+windows[j].name+'.');}
 if(past)warnings.push(past+' rodada(s) já passaram do término previsto.');
 if(requireSchedule&&!Object.keys(rows).length)fail('Cadastre ao menos uma rodada que não esteja cancelada.');
 return {tournament:t,rows,warnings,total};
}
export function publicationChanges(previous,current,mode='draft',{now=Date.now()}={}){
 const {tournament,rows,warnings,total}=compileTournament(current,{now,requireSchedule:mode==='publish'}),revision=Number(previous?.revision||0)+1;
 if(!['draft','publish','unpublish','delete'].includes(mode))fail('Ação inválida.');
 const prior=previous?.publishedIds||[],publishedIds=mode==='publish'?Object.keys(rows):mode==='draft'?prior:[],changes={};
 if(mode!=='draft'){for(const key of prior)if(!publishedIds.includes(key))changes['adminLives/'+key]=null;if(mode==='publish')for(const [key,value]of Object.entries(rows))changes['adminLives/'+key]={...value,updatedAt:now};}
 const saved={...tournament,revision,updatedAt:now,publishedIds,publishedAt:mode==='publish'?now:mode==='draft'?previous?.publishedAt||0:0,hasUnpublishedChanges:mode==='draft'&&!!publishedIds.length};
 changes['adminLiveTournaments/'+tournament.id]=mode==='delete'?null:saved;
 changes['adminLiveTournamentIndex/'+tournament.id]=mode==='delete'?null:{id:tournament.id,name:tournament.name,logo:tournament.logo,revision,updatedAt:now,publishedAt:saved.publishedAt,hasUnpublishedChanges:saved.hasUnpublishedChanges,phases:tournament.phases.length,slots:total,lastEndAt:Math.max(0,...Object.values(rows).map(r=>r.endAt))};
 return {changes,saved,warnings};
}
