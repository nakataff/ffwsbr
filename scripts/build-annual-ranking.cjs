'use strict';
// Offline only: update source placements, regenerate once, serve the small JSON.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.join(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const FILES=['ranking-data/brasil-2026-source.json','ffws-br-2026-s1/stages.json','ffws-br-2026-s2/career-summary.json','ewc 2026/final.json','ffws-global-2026/stages.json','ffws-br-2026-s1/teams.json','ffws-br-2026-s2/teams.json'];
function build([config,s1,s2,ewc,global,t1,t2]) {
  const canonical=v=>{const name=String(v||'').trim().toUpperCase();return config.aliases[name]||name;};
  const base=p=>{if(!Number.isInteger(p)||p<1||p>config.basePoints.length)throw Error('Colocação inválida: '+p);return config.basePoints[p-1];};
  const combined=source=>{
    if(!source.final?.finished||!source.classificatoria?.finished)throw Error('WB sem classificação final encerrada');
    const finalists=new Map(source.final.rows.map(r=>[canonical(r.team),r.position]));
    if(finalists.size!==12)throw Error('WB deve ter 12 finalistas');
    return source.classificatoria.rows.map(r=>({team:canonical(r.team),position:finalists.get(canonical(r.team))||r.position}));
  };
  const teams=new Map();
  const metadata=new Map([...t1.teams,...t2.teams].map(t=>[canonical(t.name),t]));
  const events=[
    {id:'copa',label:'Copa FF',name:'Copa FF 2026',weight:config.weights.copa,status:'finished',source:config.copa.source,standings:config.copa.standings},
    {id:'s1',label:'WB S1',name:'FFWS BR 2026 S1',weight:config.weights.s1,status:'finished',source:'/ffws-br-s2/inicio',standings:combined(s1)},
    {id:'s2',label:'WB S2',name:'FFWS BR 2026 S2',weight:config.weights.s2,status:'finished',source:'/ffws-br-s2/inicio',standings:combined(s2)},
    {id:'ewc',label:'EWC',name:'EWC 2026',weight:config.weights.ewc,status:'finished',source:'/index.html#ewc-final',standings:ewc.rows.filter(r=>metadata.has(canonical(r.team)))},
    {id:'global',label:'Global Finals',name:'FFWS Global Finals 2026',weight:config.weights.global,status:global.finished?'finished':'upcoming',source:'/ffws-global-2026/inicio',standings:global.finished?(global.final?.rows||[]).filter(r=>metadata.has(canonical(r.team))):[]}
  ];
  // S1 has the legacy route; don't link S1 to the S2 overview.
  events.find(e=>e.id==='s1').source='/index.html#final';
  if(!config.copa.finished||!ewc.finished||config.copa.standings.length!==24)throw Error('Competição incompleta');
  for(const e of events) {
    if(e.status!=='finished')continue;
    const seen=new Set();
    for(const result of e.standings) {
      const name=canonical(result.team),position=Number(result.position);
      if(!name||seen.has(name))throw Error('Equipe duplicada em '+e.id+': '+name);
      seen.add(name);
      if(!teams.has(name)) {
        const meta=metadata.get(name),candidate=meta?.logo||'escudo.webp';
        teams.set(name,{team:name,logo:fs.existsSync(path.join(ROOT,candidate))?candidate:'escudo.webp',results:[]});
      }
      teams.get(name).results.push({event:e.id,position,points:base(position)*e.weight});
    }
  }
  const tie=r=>[r.total,r.results.find(x=>x.event==='global')?.position??999,r.results.find(x=>x.event==='ewc')?.position??999,r.results.filter(x=>['s1','s2'].includes(x.event)&&x.position===1).length];
  const rows=[...teams.values()].map(r=>({...r,total:r.results.reduce((n,x)=>n+x.points,0)})).sort((a,b)=>{
    const x=tie(a),y=tie(b);return y[0]-x[0]||x[1]-y[1]||x[2]-y[2]||y[3]-x[3]||a.team.localeCompare(b.team,'pt-BR');
  });
  let last='',rank=0;
  rows.forEach((r,i)=>{const key=JSON.stringify(tie(r));if(last!==key)rank=i+1;last=key;r.rank=rank;});
  return {year:config.year,region:config.region,updatedAt:config.updatedAt,partial:events.some(e=>e.status==='upcoming'),methodVersion:config.methodVersion,basePoints:config.basePoints,events:events.map(({standings,...e})=>e),rows};
}
if(require.main===module) {
  const data=build(FILES.map(read));
  data.sources=FILES.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,file))).digest('hex')}));
  const file=path.join(ROOT,'ranking-data/brasil-2026.json'),output=JSON.stringify(data)+'\n';
  if(process.argv.includes('--check')){if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==output)throw Error('Regere ranking-data/brasil-2026.json');}
  else fs.writeFileSync(file,output);
  console.log(`${data.rows.length} equipes · ${Buffer.byteLength(output)} bytes · ${data.rows[0].team}: ${data.rows[0].total}`);
}
module.exports={build,FILES};
