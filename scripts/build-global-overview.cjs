/* Offline summaries: no network, database or runtime aggregation. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const BASE = path.join(__dirname, '..', 'ffws-global-2026');
const keys = ['classificatoria', 'segundaFase', 'lastChance', 'final'];
const num = v => Number(v) || 0;
const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toUpperCase();
function eventsFor(source, key) {
  const phase = source[key] || {};
  if (key !== 'final') return (phase.rounds || []).filter(Boolean);
  return (phase.days || []).flatMap((day, i) => {
    const matches = day.matches || day.rounds || [];
    return matches.length ? matches.map(match => ({...match, day: num(match.day) || num(day.day) || i + 1})) : day.results ? [{...day, day:num(day.day) || i + 1}] : [];
  });
}
const results = event => event.results || event.rows || [];
function aggregate(events) {
  const teams = new Map();
  for (const event of events) for (const r of results(event)) {
    const team = r.team || r.equipe;
    if (!team) continue;
    const key = norm(team);
    if (!teams.has(key)) teams.set(key, {team, points:0, kills:0, booyahs:0, matches:0});
    const row = teams.get(key);
    row.kills += num(r.kills ?? r.abates);
    row.points += num(r.points ?? r.pontos ?? (num(r.placementPoints ?? r.pp) + num(r.kills ?? r.abates)));
    row.booyahs += num(r.booyahs ?? r.booyah ?? (num(r.position ?? r.posicao) === 1 ? 1 : 0));
    row.matches += num(r.matches) || 1;
  }
  return [...teams.values()].sort((a,b) => b.points-a.points || b.booyahs-a.booyahs || b.kills-a.kills || a.team.localeCompare(b.team,'pt-BR')).map((r,i) => ({...r, position:i+1}));
}
function compactRows(rows) {
  return rows.filter(r => !r.placeholder && num(r.matches) > 0).map((r,i) => ({team:r.team, position:num(r.position)||i+1, points:num(r.points), kills:num(r.kills), booyahs:num(r.booyahs), matches:num(r.matches)}));
}
function build({stages, dates, teams, groups, players}) {
  const groupById = new Map(Object.entries(groups.groups).flatMap(([g,ids]) => ids.map(id => [id,g])));
  if (teams.teams.length !== 24 || groupById.size !== 24 || Object.values(groups.groups).some(ids => ids.length !== 6)) throw Error('Grupos incompletos ou duplicados');
  if (teams.teams.some(t => !groupById.has(t.id))) throw Error('Equipe sem grupo');
  const metadata = teams.teams.map(t => ({id:t.id,name:t.name,abbreviation:t.abbreviation,logo:t.logo,group:groupById.get(t.id)}));
  const format = Object.fromEntries(keys.map(key => {
    const f=stages.format[key];
    return [key,Object.fromEntries(['label','dateLabel','description','timeLabel','rules','pools','matchdays'].filter(k=>f[k]!==undefined).map(k=>[k,f[k]]))];
  }));
  const tables = {};
  for (const key of keys) {
    const phase = stages[key] || {}, events = eventsFor(stages,key);
    const schedule = dates.rounds.filter(r=>r.stage===key);
    const days = [...new Set(schedule.map(r=>num(r.day)))].filter(Boolean);
    const byDay = Object.fromEntries(days.map(day => {
      const entries = events.filter(e=>num(e.day || e.round)===day);
      const fallback = (phase.rows||[]).filter(r=>num(r.day || phase.day)===day);
      return [day,compactRows(entries.some(e=>results(e).length) ? aggregate(entries) : fallback)];
    }));
    // Phase 2 resets every day; never sum its four independent standings.
    const rows = key==='segundaFase' ? [] : compactRows(phase.rows?.length ? phase.rows : aggregate(events));
    tables[key] = {finished:!!phase.finished,rows,days:days.map(day=>({day,date:schedule.find(r=>num(r.day)===day)?.date,rows:byDay[day]}))};
  }
  const top10 = {};
  for (const key of ['geral',...keys]) {
    const ranks = new Map();
    for (const e of players.entries || []) {
      if (key!=='geral' && e.stage!==key) continue;
      if (!keys.includes(e.stage) || !(e.name||e.player) || !e.team) continue;
      const id=norm(e.name||e.player)+'__'+norm(e.team);
      if (!ranks.has(id)) ranks.set(id,{name:e.name||e.player,team:e.team,kills:0,damage:0,assists:0,matches:0});
      const r=ranks.get(id);
      for (const field of ['kills','damage','assists']) r[field]+=num(e[field]);
      r.matches+=num(e.matches)||1;
    }
    top10[key]=[...ranks.values()].sort((a,b)=>b.kills-a.kills||b.damage-a.damage||b.assists-a.assists).slice(0,10);
  }
  const roster=(players.players||[]).filter(p=>!p.left && norm(p.rosterStatus)!=='SAIU');
  const squads=metadata.map(t=>({id:t.id,players:roster.filter(p=>norm(p.team)===norm(t.name)||norm(p.team)===norm(t.abbreviation)).sort((a,b)=>Number(!!b.starter)-Number(!!a.starter)||num(a.order)-num(b.order)).map(p=>({name:p.name,role:p.roleShort||p.role||'',captain:!!p.captain,starter:!!p.starter}))}));
  const updatedAt=[stages.updatedAt,dates.updatedAt,teams.updatedAt,groups.updatedAt,players.updatedAt].filter(Boolean).sort().at(-1);
  // One small public snapshot: never fetch the complete players database on this page.
  const sameTeam=(value,t)=>[t.name,t.abbreviation,t.id,t.wikiName].some(alias=>norm(alias)===norm(value));
  const sumEntries=entries=>entries.length ? entries.reduce((r,e)=>({kills:r.kills+num(e.kills),damage:r.damage+num(e.damage),assists:r.assists+num(e.assists),matches:r.matches+(num(e.matches)||1)}),{kills:0,damage:0,assists:0,matches:0}) : null;
  const teamProfiles=teams.teams.map(t=>{
    const members=roster.filter(p=>sameTeam(p.team,t));
    const statsByStage=Object.fromEntries(keys.map(key=>{
      const events=eventsFor(stages,key).map(e=>({...e,results:results(e).filter(r=>sameTeam(r.team||r.equipe,t))})).filter(e=>e.results.length);
      const rows=aggregate(events),fallback=compactRows(stages[key]?.rows||[]).find(r=>sameTeam(r.team,t));
      // Phase 2 totals are descriptive statistics only, never a cumulative standing.
      return [key,rows.length?Object.fromEntries(['points','kills','booyahs','matches'].map(k=>[k,rows[0][k]])):fallback?Object.fromEntries(['points','kills','booyahs','matches'].map(k=>[k,fallback[k]])):null];
    }));
    return {...metadata.find(m=>m.id===t.id),region:t.region,qualification:t.qualification,statsByStage,
      players:members.map(p=>({name:p.name,type:p.type==='staff'||/coach|analista|manager|treinador/i.test(p.role||'')?'staff':'player',role:p.role||p.roleShort||'',country:p.country||p.flag||'',
        statsByStage:Object.fromEntries(['geral',...keys].map(key=>[key,sumEntries((players.entries||[]).filter(e=>sameTeam(e.team,t)&&norm(e.name||e.player)===norm(p.name)&&(key==='geral'?keys.includes(e.stage):e.stage===key)))]))})),
      fixtures:dates.rounds.filter(r=>r.stage==='classificatoria'&&r.groups?.includes(groupById.get(t.id))).map(r=>({date:r.date,time:r.time24,label:r.label,groups:r.groups}))};
  });
  return {
    'equipes-resumo.json':{updatedAt,teams:teamProfiles},
    'inicio-resumo.json':{tournament:stages.tournament,updatedAt,finished:!!stages.finished,format,teams:metadata,tables,rounds:dates.rounds.map(r=>({key:r.key,stage:r.stage,day:r.day,label:r.label,date:r.date,time24:r.time24,groups:r.groups,matches:r.matches}))},
    'inicio-mvp-top10.json':{updatedAt,top10},
    'inicio-elencos.json':{updatedAt,teams:squads}
  };
}
if (require.main === module) {
  const read=name=>JSON.parse(fs.readFileSync(path.join(BASE,name+'.json'),'utf8'));
  const output=build(Object.fromEntries(['stages','dates','teams','groups','players'].map(name=>[name,read(name)])));
  for (const [name,data] of Object.entries(output)) {
    const text=JSON.stringify(data)+'\n',file=path.join(BASE,name);
    if (process.argv.includes('--check')) {if (!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==text) throw Error('Regere '+name);}
    else fs.writeFileSync(file,text);
    console.log(name+': '+Buffer.byteLength(text)+' bytes');
  }
}
module.exports={build};
