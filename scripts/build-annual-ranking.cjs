'use strict';
// Offline only: validate closed events, regenerate once, serve one small JSON per year.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.join(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const YEAR_FILES={
  2026:['ranking-data/brasil-2026-source.json','ffws-br-2026-s1/stages.json','ffws-br-2026-s2/career-summary.json','ewc 2026/final.json','ffws-global-2026/stages.json','ffws-br-2026-s1/teams.json','ffws-br-2026-s2/teams.json','ffws-global-2026/teams.json'],
  2025:['ranking-data/brasil-2025-source.json','novos-torneios/wb-2025-s1.json','novos-torneios/wb-2025-s2.json','novos-torneios/ffws-2025.json']
};
const FILES=YEAR_FILES[2026];
function completeStandings(finalRows,previousRows,count,canonical,label){
  const validate=(rows,size)=>{
    if(rows.length!==size||new Set(rows.map(r=>canonical(r.team))).size!==size||new Set(rows.map(r=>r.position)).size!==size||rows.some(r=>!Number.isInteger(r.position)||r.position<1||r.position>size))throw Error(label+': classificação incompleta ou equipe duplicada');
  };
  validate(finalRows,12);validate(previousRows,count);
  const finalists=new Map(finalRows.map(r=>[canonical(r.team),r.position]));
  if(previousRows.some(r=>finalists.has(canonical(r.team))!== (r.position<=12)))throw Error(label+': finalistas não correspondem aos classificados');
  return previousRows.map(r=>({team:canonical(r.team),position:finalists.get(canonical(r.team))??r.position}));
}
function archiveStandings(source,canonical){
  if(source.status!=='OFICIAL'||!source.endDate||source.endDate>'2025-12-31'||!source.final?.rows?.length)throw Error('Torneio histórico não encerrado: '+source.id);
  const compact=s=>s.rows.map(r=>({team:r[s.cols.indexOf('team')],position:r[s.cols.indexOf('pos')]}));
  return completeStandings(compact(source.final),compact(source.standings[0]),source.teams.items.length,canonical,source.id);
}
function global2026Standings(source,participants,canonical){
  if(!source.finished)return [];
  if(!source.final?.finished||!source.lastChance?.finished||!source.classificatoria?.finished)throw Error('Global: fases ainda não encerradas');
  const registered=new Set(participants.teams.map(t=>canonical(t.name)));
  const names=new Map(participants.teams.flatMap(t=>[t.name,t.id,t.abbreviation,t.wikiName].filter(Boolean).map(n=>[canonical(n),canonical(t.name)])));
  const rows=s=>(s.rows||[]).map(r=>({...r,team:names.get(canonical(r.team))||canonical(r.team)}));
  const first=rows(source.classificatoria),last=rows(source.lastChance),final=rows(source.final);
  const check=(list,count,label)=>{
    if(list.length!==count||new Set(list.map(r=>r.team)).size!==count||new Set(list.map(r=>r.position)).size!==count||list.some(r=>!registered.has(r.team)||!Number.isInteger(r.position)||r.position<1||r.position>count))throw Error('Global: '+label+' incompleta ou inválida');
  };
  if(registered.size!==24)throw Error('Global: esperado cadastro das 24 equipes');
  check(first,24,'Fase 1');check(last,12,'repescagem');check(final,12,'final');
  const finalistNames=new Set(final.map(r=>r.team)),lastNames=new Set(last.map(r=>r.team));
  if(last.some(r=>finalistNames.has(r.team)!==(r.position<=4))||first.some(r=>r.position>=21&&(lastNames.has(r.team)||finalistNames.has(r.team)))||first.some(r=>[19,20].includes(r.position)&&!lastNames.has(r.team)))throw Error('Global: progressão de fases inconsistente');
  // Final: 1–12; repescagem 5–12 becomes overall 13–20; Phase 1: 21–24.
  const overall=[...final,...last.filter(r=>r.position>4).map(r=>({...r,position:r.position+8})),...first.filter(r=>r.position>20)];
  check(overall,24,'classificação geral');
  const brazil=new Set(participants.teams.filter(t=>/^BR\b/i.test(t.region||'')).map(t=>canonical(t.name)));
  if(!brazil.size)throw Error('Global: representantes brasileiros não cadastrados');
  return overall.filter(r=>brazil.has(r.team));
}
function build(inputs){
  const [config,s1,s2]=inputs,canonical=v=>{const name=String(v||'').trim().toUpperCase();return config.aliases[name]||name;};
  const base=p=>{if(!Number.isInteger(p)||p<1||p>config.basePoints.length)throw Error('Colocação inválida: '+p);return config.basePoints[p-1];};
  const overrides=config.pointsByEvent||{},ids=['copa','s1','s2','ewc','global'];
  for(const [id,values] of Object.entries(overrides)){
    if(!ids.includes(id)||!Array.isArray(values)||values.length!==config.basePoints.length||values.some(v=>!Number.isInteger(v)||v<0||v>100000))throw Error('Pontuação personalizada inválida: '+id);
  }
  const score=(id,position)=>{const standard=base(position)*config.weights[id];return overrides[id]?overrides[id][position-1]:standard;};
  const year=config.year,metadata=new Map(),event=(id,label,name,source,standings,status='finished')=>({id,label,name,weight:config.weights[id],status,source,standings});
  if(!config.copa.finished||config.copa.standings.length!==config.copa.teamCount)throw Error('Copa incompleta');
  let events=[event('copa','Copa FF',`Copa FF ${year}`,config.copa.source,config.copa.standings)];
  if(year===2026){
    const [,,,ewc,global,t1,t2,globalTeams]=inputs;
    [...t1.teams,...t2.teams].forEach(t=>metadata.set(canonical(t.name),t));
    const wb=source=>{
      if(!source.final?.finished||!source.classificatoria?.finished)throw Error('WB sem classificação final encerrada');
      return completeStandings(source.final.rows,source.classificatoria.rows,source.classificatoria.rows.length,canonical,'WB');
    };
    if(!ewc.finished)throw Error('EWC incompleta');
    events.push(event('s1','WB S1',`FFWS BR ${year} S1`,'/index.html#final',wb(s1)),event('s2','WB S2',`FFWS BR ${year} S2`,'/ffws-br-s2/inicio',wb(s2)),event('ewc','EWC',`EWC ${year}`,'/index.html#ewc-final',ewc.rows.filter(r=>metadata.has(canonical(r.team)))),event('global','Global Finals',`FFWS Global Finals ${year}`,'/ffws-global-2026/inicio',global2026Standings(global,globalTeams,canonical),global.finished?'finished':'upcoming'));
  }else if(year===2025){
    const global=inputs[3],brazil=new Set(global.teams.items.filter(t=>t.flag==='br').map(t=>canonical(t.n)));
    Object.entries(config.logos).forEach(([name,logo])=>metadata.set(canonical(name),{logo}));
    if(!config.ewc.finished||config.ewc.participants.length!==config.ewc.standings.length||config.ewc.participants.some(n=>!config.ewc.standings.some(r=>canonical(r.team)===canonical(n))))throw Error('EWC: representante brasileiro sem resultado');
    events.push(event('s1','WB S1',`FFWS BR ${year} S1`,'/index.html?torneio=wb-2025-s1#outros-torneios',archiveStandings(s1,canonical)),event('s2','WB S2',`FFWS BR ${year} S2`,'/index.html?torneio=wb-2025-s2#outros-torneios',archiveStandings(s2,canonical)),event('ewc','EWC',`EWC ${year}`,config.ewc.source,config.ewc.standings),event('global','Global Finals',`FFWS Global Finals ${year}`,'/index.html?torneio=ffws-2025#outros-torneios',archiveStandings(global,canonical).filter(r=>brazil.has(canonical(r.team)))));
  }else throw Error('Ano não configurado: '+year);
  const teams=new Map();
  for(const e of events){
    if(e.status!=='finished')continue;
    const seen=new Set();
    for(const r of e.standings){
      const name=canonical(r.team),position=Number(r.position);
      if(!name||seen.has(name))throw Error('Equipe duplicada em '+e.id+': '+name);
      seen.add(name);
      if(!teams.has(name)){
        const candidate=config.logos?.[name]||metadata.get(name)?.logo||'escudo.webp';
        teams.set(name,{team:name,logo:fs.existsSync(path.join(ROOT,candidate))?candidate:'escudo.webp',results:[]});
      }
      teams.get(name).results.push({event:e.id,position,points:score(e.id,position)});
    }
  }
  const tie=r=>[r.total,r.results.find(x=>x.event==='global')?.position??999,r.results.find(x=>x.event==='ewc')?.position??999,r.results.filter(x=>['s1','s2'].includes(x.event)&&x.position===1).length];
  const rows=[...teams.values()].map(r=>({...r,total:r.results.reduce((n,x)=>n+x.points,0)})).sort((a,b)=>{const x=tie(a),y=tie(b);return y[0]-x[0]||x[1]-y[1]||x[2]-y[2]||y[3]-x[3]||a.team.localeCompare(b.team,'pt-BR');});
  let last='',rank=0;rows.forEach((r,i)=>{const key=JSON.stringify(tie(r));if(last!==key)rank=i+1;last=key;r.rank=rank;});
  return {year,region:config.region,updatedAt:config.updatedAt,partial:events.some(e=>e.status==='upcoming'),methodVersion:config.methodVersion,basePoints:config.basePoints,...(Object.keys(overrides).length?{pointsByEvent:overrides}:{}),events:events.map(({standings,...e})=>e),rows};
}
if(require.main===module){
  const arg=process.argv.find(a=>a.startsWith('--year=')),years=arg?[Number(arg.split('=')[1])]:Object.keys(YEAR_FILES).map(Number);
  for(const year of years){
    const files=YEAR_FILES[year];if(!files)throw Error('Ano não configurado: '+year);
    const data=build(files.map(read));
    data.sources=files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,file))).digest('hex')}));
    const file=path.join(ROOT,`ranking-data/brasil-${year}.json`),output=JSON.stringify(data)+'\n';
    if(process.argv.includes('--check')){if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==output)throw Error(`Regere ranking-data/brasil-${year}.json`);}else fs.writeFileSync(file,output);
    console.log(`${year}: ${data.rows.length} equipes · ${Buffer.byteLength(output)} bytes · ${data.rows[0].team}: ${data.rows[0].total}`);
  }
}
module.exports={build,FILES,YEAR_FILES,global2026Standings};
