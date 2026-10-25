const key=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,80);
const valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isInteger(Number(v));
export function resultsFromBackup(backup,roster,day,drop){
 const byCode=new Map(roster.map(t=>[t.code,t]));
 const mode=backup.tournamentModeV1||{},days=(mode.days||[]).filter(d=>Number(d.number)<day).map(d=>({day:Number(d.number),data:d.editorSnapshot}));
 if(days.some(d=>!d.data?.drops))throw Error('Um dia anterior não tem as quedas salvas. Abra e registre esse dia novamente para incluir a tabela geral.');
 days.push({day,data:backup});const matches=[];
 for(const entry of days){const b=entry.data,codes=b.selectedTeams||[...byCode.keys()],participants=codes.map(c=>byCode.get(c)?.id||key(c));
  const headstart=Object.fromEntries(Object.entries(b.startingPoints||{}).filter(([c])=>byCode.has(c)&&b.config?.startingEnabled!==false).map(([c,v])=>[byCode.get(c).id,Number(v)||0]));
  for(const [index,d] of (b.drops||[]).entries()){
   if(entry.day===day&&index+1>drop)break;const rows=[];
   for(const code of codes){const team=byCode.get(code);if(!team)throw Error('Salve os avisos com todos os times do torneio.');
    if(['placements','kills','points'].some(k=>!valid(d[k]?.[code]))||d.unknownKills?.[code]||d.estimatedKills?.[code])continue;
    rows.push({teamId:team.id,team:team.name,position:Number(d.placements[code]),kills:Number(d.kills[code]),points:Number(d.points[code])});
   }
   if(rows.length)matches.push({day:entry.day,drop:index+1,map:String(d.map||''),participants,rows,headstart});
  }
 }
 if(!matches.some(m=>m.day===day&&m.drop===drop))throw Error('Preencha posição, abates e pontos reais de ao menos um time nesta queda.');
 return matches;
}
