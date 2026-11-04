/* Shared, pure tournament rules. No network, storage or account reads. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CFF_GLOBAL_CAMP_CORE=api})(typeof window==='object'?window:globalThis,function(){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)), norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const number=v=>v===null||v===undefined||String(v).trim()===''?null:Number.isFinite(Number(v))?Number(v):null;
const points=[12,9,8,7,6,5,4,3,2,1,0,0];
function team(meta,value){const key=norm(value);if(!key)return;return meta.teams.find(t=>[t.id,t.name,t.abbreviation,t.wikiName,...(t.aliases||[])].some(a=>norm(a)===key))}
function emptyDrop(codes){const blank=()=>Object.fromEntries(codes.map(c=>[c,null]));return{map:'',date:'',booyah:'',inputMode:'detail-pos-kills',points:blank(),kills:blank(),placements:blank(),top12:Object.fromEntries(codes.map(c=>[c,false])),unknownKills:{},estimatedKills:{},mvp:'',mvppoint:''}}
function campCode(meta,id){const t=team(meta,id);return t?.wikiName||t?.id||id}
function translateDrop(drop,convert){const out=clone(drop);for(const key of ['points','kills','placements','top12','unknownKills','estimatedKills'])out[key]=Object.fromEntries(Object.entries(out[key]||{}).map(([code,value])=>[convert(code),value]));out.booyah=out.booyah?convert(out.booyah):'';return out}
function nativeDrop(drop,meta){return translateDrop(drop,id=>campCode(meta,id))}
function record(data,key,meta){const canonical=value=>meta?(team(meta,value)?.id||value):value;return{key,participants:(data.selectedTeams||[]).map(canonical),drops:(data.drops||[]).map(d=>translateDrop(d,canonical)),players:clone(data.config?.cffGlobalPlayers||[]),complete:false}}
function phases(meta){return[
 {id:'classificatoria',name:'Classificatória · Fase 1',teams:24,advance:18,days:6,firstDrops:6,laterDrops:6,unlimited:false,format:'classic',cp:110,lastDate:'2026-11-15',completed:false},
 {id:'segundaFase',name:'Segunda fase · Pools',teams:18,advance:8,days:4,firstDrops:6,laterDrops:6,unlimited:false,format:'classic',cp:110,lastDate:'2026-11-22',completed:false},
 {id:'lastChance',name:'Repescagem',teams:12,advance:4,days:1,firstDrops:10,laterDrops:10,unlimited:false,format:'classic',cp:110,lastDate:'2026-11-27',completed:false},
 {id:'final',name:'Grande Final',teams:12,advance:0,days:1,firstDrops:1,laterDrops:1,unlimited:true,format:'champion',cp:meta.championPoint,lastDate:'2026-11-28',completed:false}
]}
function confirmed(data,key,meta){const raw=record(data,key,meta),complete=[];let draft=false;
 for(const drop of raw.drops){const touched=raw.participants.some(id=>['points','kills','placements'].some(k=>number(drop[k]?.[id])!==null));if(!touched){draft=true;continue}if(draft)break;
 try{validate({...raw,drops:[...complete,drop],players:[]},meta);complete.push(drop)}catch(error){if(!complete.length)throw error;draft=true;break}}
 const result=validate({...raw,drops:complete},meta);return{record:result,hasDraft:draft&&raw.drops.some(d=>!complete.includes(d)&&raw.participants.some(id=>['points','kills','placements'].some(k=>number(d[k]?.[id])!==null)))};
}
function publication(root,current,meta,expected,receipt,expectedRanking){
 root=root||{};const key=current.key,revisions=root.revisions||{},records=root.rounds||{};
 if(root.receipts?.[key]===receipt)return root;
 if(Number(revisions[key]||0)!==expected)throw Error('Há uma versão mais recente desta rodada. Use Puxar publicados antes de editar novamente.');
 current=validate(current,meta);const ids=entrants(key,records,meta);if(ids.some(id=>!current.participants.includes(id)))throw Error('Os times foram alterados. Puxe os lançamentos do site antes de publicar.');
 if((records[key]?.drops?.length||0)>current.drops.length)throw Error('A rodada no site já possui mais quedas. Puxe os resultados publicados para não apagar lançamentos posteriores.');
 const all={...records,[key]:current},at=meta.rounds.findIndex(r=>r.key===key);for(const round of meta.rounds.slice(at+1))if(all[round.key]){const valid=entrants(round.key,all,meta);if(valid.some(id=>!all[round.key].participants.includes(id)))throw Error('Esta correção muda os classificados de uma rodada já publicada. Confira as fases seguintes antes de alterar.');}
 if(expectedRanking){const round=meta.rounds.find(r=>r.key===key),source=round.stage==='classificatoria'?meta.rounds.filter(r=>r.stage===round.stage).map(r=>all[r.key]).filter(Boolean):[current];if(JSON.stringify(rank(source,meta,round.stage==='final'))!==JSON.stringify(expectedRanking))throw Error('A classificação foi atualizada desde os dados carregados. Puxe os resultados publicados e confira novamente.');}
 return{...root,version:1,rounds:all,revisions:{...revisions,[key]:expected+1},receipts:{...root.receipts,[key]:receipt},home:summary(all,meta)};
}
function validate(rec,meta){
 const round=meta.rounds.find(r=>r.key===rec.key);if(!round)throw Error('Rodada do Mundial inválida.');
 const ids=rec.participants||[];if(ids.length!==12||new Set(ids).size!==12||ids.some(id=>!meta.teams.some(t=>t.id===id)))throw Error('Confira os 12 times desta rodada.');
 const played=[];let gap=false;
 for(const d of rec.drops||[]){
  const touched=ids.some(id=>['points','placements','kills'].some(k=>number(d[k]?.[id])!==null));
  if(!touched){gap=true;continue}if(gap)throw Error('Há uma queda vazia antes de resultados preenchidos.');
  const places=[];
  for(const id of ids){const p=number(d.placements?.[id]),k=number(d.kills?.[id]),total=number(d.points?.[id]);
   if(!Number.isSafeInteger(p)||p<1||p>12||!Number.isSafeInteger(k)||k<0||total!==points[p-1]+k)throw Error('Complete posição e abates dos 12 times, com a pontuação correta, antes de confirmar a rodada.');places.push(p)}
  if(new Set(places).size!==12)throw Error('Há posições repetidas na queda.');
  const winner=ids.find(id=>number(d.placements[id])===1);if(d.booyah&&d.booyah!==winner)throw Error('Booyah diferente do time em primeiro lugar.');
  played.push({...clone(d),booyah:winner});
 }
 if(!played.length)throw Error('Preencha ao menos uma queda completa.');
 if(round.stage==='final'){const totals={};let finished=false;for(const d of played){if(finished)throw Error('A final já terminou por Champion Rush. Remova as quedas posteriores ao Booyah do campeão.');finished=(totals[d.booyah]||0)>=meta.championPoint;for(const id of ids)totals[id]=(totals[id]||0)+Number(d.points[id]);}}
 if(round.matches&&played.length>round.matches)throw Error('Esta rodada excede o limite de quedas.');
 const rows=(rec.players||[]).map(raw=>{
  const p=meta.players.find(p=>p.id===raw.id);const t=p&&team(meta,p.team);
  if(!p||!t||!ids.includes(t.id))throw Error('Jogador fora dos times desta rodada.');
  const row={id:p.id,name:p.name,teamId:t.id,team:t.name,role:p.role||'',photo:p.photo||'',matches:number(raw.matches)};
  if(!Number.isSafeInteger(row.matches)||row.matches<1||row.matches>played.length)throw Error('Confira as quedas jogadas de cada jogador.');
  for(const key of ['kills','damage','assists']){row[key]=number(raw[key]);if(row[key]!==null&&(!Number.isSafeInteger(row[key])||row[key]<0))throw Error('As estatísticas devem ser números inteiros positivos ou zero.');}
  if(['kills','damage','assists'].every(k=>row[k]===null))throw Error('Informe pelo menos uma estatística do jogador.');return row;
 });
 if(new Set(rows.map(p=>p.id)).size!==rows.length)throw Error('Jogador repetido.');
 return{key:round.key,participants:ids,drops:played,players:rows,complete:round.matches?played.length===round.matches:!!champion({participants:ids,drops:played},110)};
}
function champion(rec,cp=110){const totals={};for(const d of rec.drops||[]){const id=d.booyah||(rec.participants||[]).find(id=>number(d.placements?.[id])===1);if(id&&(totals[id]||0)>=cp)return id;for(const id of rec.participants||[])totals[id]=(totals[id]||0)+(number(d.points?.[id])||0)}return null}
function rank(records,meta,final=false){const map=new Map();for(const rec of records)for(const id of rec.participants||[]){if(!map.has(id)){const t=meta.teams.find(t=>t.id===id);map.set(id,{id,name:t?.name||id,logo:t?.logo||'',points:0,kills:0,booyahs:0,matches:0,lastPlace:99,lastPoints:0})}const row=map.get(id);for(const d of rec.drops||[]){const value=number(d.points?.[id]);if(value===null)continue;row.points+=value;row.kills+=number(d.kills?.[id])||0;row.booyahs+=Number(number(d.placements?.[id])===1);row.matches++;row.lastPlace=number(d.placements?.[id])||99;row.lastPoints=value}}
 const win=final?champion(records[0]||{},meta.championPoint):null;return [...map.values()].filter(r=>r.matches).sort((a,b)=>win&&(a.id===win||b.id===win)?(a.id===win?-1:1):b.points-a.points||b.booyahs-a.booyahs||b.kills-a.kills||a.lastPlace-b.lastPlace||a.name.localeCompare(b.name,'pt-BR'))}
function entrants(key,records,meta){
 const round=meta.rounds.find(r=>r.key===key);if(!round)throw Error('Rodada inválida.');
 if(round.stage==='classificatoria')return round.groups.flatMap(g=>meta.groups[g]);
 const phase1=meta.rounds.filter(r=>r.stage==='classificatoria');
 if(phase1.some(r=>!records[r.key]?.complete))throw Error('Confirme as 12 rodadas completas da Fase 1 para calcular os pools.');
 const seeds=rank(phase1.map(r=>records[r.key]),meta).map(t=>t.id);
 const pool=day=>day===1?seeds.slice(0,12):seeds.slice(10+day*2-2,10+day*2);
 const second=day=>{if(day===1)return pool(1);const prev=records['segundaFase-'+(day-1)];if(!prev?.complete)throw Error('Confirme o dia anterior da Fase 2 para calcular as vagas.');return [...rank([prev],meta).slice(2).map(t=>t.id),...pool(day)]};
 if(round.stage==='segundaFase')return second(round.day);
 if(!records['segundaFase-4']?.complete)throw Error('Confirme os quatro dias da Fase 2.');
 if(round.stage==='lastChance')return [...seeds.slice(18,20),...rank([records['segundaFase-4']],meta).slice(2).map(t=>t.id)];
 if(!records['lastChance-1']?.complete)throw Error('Confirme as dez quedas da repescagem.');
 return [...[1,2,3,4].flatMap(day=>rank([records['segundaFase-'+day]],meta).slice(0,2).map(t=>t.id)),...rank([records['lastChance-1']],meta).slice(0,4).map(t=>t.id)];
}
function backup(template,meta,key,archive={},official=false){
 const round=meta.rounds.find(r=>r.key===key),saved=archive[key],ids=official&&saved?[...saved.participants]:entrants(key,archive,meta),codes=ids.map(id=>campCode(meta,id)),final=round.stage==='final',data=clone(template);
 data.teams=meta.teams.map(t=>`${t.name}, ${campCode(meta,t.id)}, ${t.abbreviation}`).join('\n');data.logos=meta.teams.map(t=>`${t.name}, /${t.logo.replace(/^\//,'')}`).join('\n');
 data.selectedTeams=codes;data.currentInputMode='detail-pos-kills';data.drops=saved?saved.drops.map(d=>nativeDrop(d,meta)):Array.from({length:round.matches||1},()=>emptyDrop(codes));while(data.drops.length<(round.matches||1))data.drops.push(emptyDrop(codes));data.startingPoints=Object.fromEntries(codes.map(code=>[code,0]));data.placementOverrides={};
 const label=round.stage==='classificatoria'?`Fase 1 · ${round.groups.join(' × ')}`:round.stage==='segundaFase'?`Fase 2 · Dia ${round.day}`:round.stage==='lastChance'?'Repescagem':'Grande Final';
 data.config={...data.config,cffGlobalRound:key,cffGlobalArchive:clone(archive),cffGlobalPlayers:clone(saved?.players||[]),cffInterfaceMode:'complete',cffFfwsStage:'global-'+round.stage,cffTournamentModel:'ffws-global-2026',cffGlobalPresentationVersion:5,emojiVisualEnabled:false,v68PositionEmojiLegend:{rows:[]},cffTournamentPhasesV1:{version:1,activeId:round.stage,phases:phases(meta)},tournamentName:meta.name+' — '+label,date:round.date,tournamentDays:1,quedas:String(data.drops.length),championEnabled:final,cp:'110',finalMode:final?'champion':'classic',v68ChampionRushUnlimited:final,startingEnabled:false,autoTime:true,autoInterval:'30',daySettings:[{day:1,count:data.drops.length,date:round.date,time:round.time24,fuso:'BRT',start:round.date+' '+round.time24}],emojiRules:'',bgEnabled:false,bgRules:[],postTitle:meta.name+' — '+label};
 data.tournamentModeV1={version:7,enabled:false,view:'day',name:data.config.tournamentName,rosterCodes:codes,draftActiveCodes:codes,draftDayNumber:1,editingDayId:'',days:[],config:{teamsPerRound:12,expectedTeams:12,advanceCount:0}};return data;
}
function summary(records,meta){const available=meta.rounds.filter(r=>records[r.key]?.drops?.length);if(!available.length)return{version:1,updatedAt:Date.now(),stage:'classificatoria',teams:[],rankings:{kills:[],damage:[],assists:[]},days:[]};
 const latest=available.at(-1),stage=latest.stage,phase=available.filter(r=>r.stage===stage),selected=stage==='classificatoria'?phase:phase.filter(r=>r.key===latest.key),recs=selected.map(r=>records[r.key]);
 const agg=rs=>{const map=new Map();for(const rec of rs)for(const p of rec.players||[]){const row=map.get(p.id)||{...p,matches:0,kills:null,damage:null,assists:null,coverage:{kills:0,damage:0,assists:0}};row.matches+=p.matches;for(const k of ['kills','damage','assists'])if(number(p[k])!==null){row[k]=(row[k]||0)+p[k];row.coverage[k]+=p.matches}map.set(p.id,row)}return [...map.values()]};
 const ranked=agg(recs),top=k=>ranked.filter(p=>p[k]!==null).sort((a,b)=>b[k]-a[k]||(b.kills||0)-(a.kills||0)||(b.damage||0)-(a.damage||0)||a.name.localeCompare(b.name,'pt-BR')).slice(0,6);
 const dates=[...new Set(available.map(r=>r.date))];const days=dates.map(date=>{const rs=available.filter(r=>r.date===date),players=agg(rs.map(r=>records[r.key])).filter(p=>p.kills!==null).sort((a,b)=>b.kills-a.kills||(b.damage||0)-(a.damage||0));const used=new Set(),take=(test,n)=>players.filter(p=>!used.has(p.id)&&test(norm(p.role))).slice(0,n).map(p=>(used.add(p.id),p));const selection=[...take(r=>/rush|3/.test(r),2),...take(r=>/gran/.test(r),1),...take(r=>/sup/.test(r),1)];return{date,keys:rs.map(r=>r.key),players:selection,missingRoles:selection.length<4}});
 return{version:1,updatedAt:Date.now(),stage,roundKey:latest.key,date:latest.date,partial:recs.some(r=>!r.complete),teams:rank(recs,meta,stage==='final').slice(0,6),rankings:{kills:top('kills'),damage:top('damage'),assists:top('assists')},days};
}
// Balanced templates: nested TeamOpponent / MS values are never split on inner pipes.
function split(text){const out=[];let start=0,depth=0;for(let i=0;i<text.length;i++){if(text.slice(i,i+2)==='{{'){depth++;i++}else if(text.slice(i,i+2)==='}}'){depth--;i++}else if(text[i]==='|'&&depth===0){out.push(text.slice(start,i).trim());start=i+1}}out.push(text.slice(start).trim());return out}
function templates(text){const out=[],stack=[];text=String(text).replace(/<!--[\s\S]*?-->/g,'');for(let i=0;i<text.length-1;i++){const pair=text.slice(i,i+2);if(pair==='{{'){stack.push(i);i++}else if(pair==='}}'){const start=stack.pop();if(start!==undefined){const parts=split(text.slice(start+2,i));out.push({name:norm(parts.shift()),parts,start,end:i+2})}i++}}if(stack.length)throw Error('Código Wiki incompleto: faltam fechar templates.');return out.sort((a,b)=>a.start-b.start)}
function wiki(text,meta,participants){participants=participants.map(code=>team(meta,code)?.id||code);if(String(text).length>300000)throw Error('Cole apenas o código da rodada (até 300 KB).');const parsed=templates(text),opponents=parsed.filter(t=>t.name==='teamopponent'&&t.parts.some(p=>/^m\d+\s*=/.test(p))),drops=[],unknown=[],seen=new Set();
 if(!opponents.length)throw Error('Não encontrei TeamOpponent. Cole o Match completo com m1={{MS|posição|abates}}.');
 for(const op of opponents){const t=team(meta,op.parts[0]);if(!t){unknown.push(op.parts[0]);continue}if(!participants.includes(t.id))throw Error(t.name+' não joga nesta rodada.');if(seen.has(t.id))throw Error('Há mais de uma rodada ou um time repetido no código. Cole um único Match.');seen.add(t.id);
 for(const field of op.parts.slice(1)){const m=field.match(/^m(\d+)\s*=\s*([\s\S]+)$/);if(!m)continue;const index=Number(m[1])-1;if(index<0||index>998)throw Error('Número de queda inválido.');const ms=templates(m[2]).find(t=>t.name==='ms');if(!ms)continue;
 const pos=number(ms.parts[0]),kills=number(ms.parts[1]);if(pos===null&&kills===null)continue;if(!Number.isInteger(pos)||pos<1||pos>12||!Number.isInteger(kills)||kills<0)throw Error('Wiki com posição ou abates incompletos para '+t.name+'.');
 if(!drops[index])drops[index]=emptyDrop(participants);const d=drops[index];d.placements[t.id]=pos;d.kills[t.id]=kills;d.points[t.id]=points[pos-1]+kills;d.top12[t.id]=pos===12;if(pos===1)d.booyah=t.id;
 }}
 if(unknown.length)throw Error('Times não reconhecidos: '+unknown.join(', ')+'. Nenhum resultado foi alterado.');
 if(!drops.some(Boolean))throw Error('O código não contém posições e abates por queda. Um resumo de pontos não informa os dados individuais.');
 return Array.from({length:drops.length},(_,i)=>drops[i]||emptyDrop(participants));
}
return{norm,team,campCode,nativeDrop,emptyDrop,record,confirmed,publication,phases,validate,champion,rank,entrants,backup,summary,wiki,templates};
});
