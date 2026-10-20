// Generate static summaries once. Visitors never download the live export or full player entries.
// node scripts/build-s2-overview.cjs /path/to/ffwsLive-2026-s2.json [--check]
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..'), BASE = 'ffws-br-2026-s2/';
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toUpperCase();
const num = v => Number(v) || 0;
const vals = v => (Array.isArray(v) ? v : Object.values(v || {})).filter(Boolean);
const STAGES = ['classificatoria', 'segundaFase', 'final'];
const compare = (a, b) => b.kills - a.kills || b.damage - a.damage || b.assists - a.assists;
function aggregate(entries) {
  const rows = new Map();
  for (const e of entries) {
    const key = norm(e.name || e.player) + '__' + norm(e.team);
    if (!rows.has(key)) rows.set(key, {name: e.name || e.player, team: e.team, kills: 0, damage: 0, assists: 0, matches: 0, mvp: 0});
    const row = rows.get(key);
    for (const f of ['kills', 'damage', 'assists']) row[f] += num(e[f]);
    row.matches += num(e.matches || 1); row.mvp += num(e.mvp || e.mvps);
  }
  return [...rows.values()].sort(compare);
}
async function mergeSources(players, live, aliases) {
  // Use the exact canonical names and drop replacement rules of the complete MVP page.
  const window = {CFF_CONFIG: {firebase: {databaseURL: 'https://snapshot.firebaseio.com'}}, fetch: async url => {
    const p = String(url);
    return new Response(JSON.stringify(p.includes('firebaseio.com') ? live : p.includes('player-name-map') ? aliases : players));
  }};
  const context = {window, document: {getElementById: () => null}, location: {search: ''}, localStorage: {getItem: () => null}, URLSearchParams, Response, Headers, console};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/ffws-live-provider.js'), 'utf8'), context);
  return (await window.fetch(BASE + 'players.json')).json();
}
function buildSummaries({players, teams, summary, dates, photos, live}) {
  const updatedAt = [summary.updatedAt, players.updatedAt, ...['segundaFase', 'final'].map(s => num(live[s]?.updatedAt) ? new Date(num(live[s].updatedAt)).toISOString().slice(0, 10) : '')].filter(Boolean).sort().at(-1);
  const entries = players.entries || [];
  const source = {players: BASE + 'players.json', live: 'ffwsLive/2026-s2', aliases: BASE + 'player-name-map.json', liveSha256: crypto.createHash('sha256').update(JSON.stringify(live)).digest('hex')};
  const rows = {}, coverage = {}, drops = {};
  for (const stage of STAGES) {
    const sourceEntries = entries.filter(e => e.stage === stage);
    const seen = new Set();
    for (const e of sourceEntries) {
      const key = `${num(e.day)}:${num(e.drop)}:${norm(e.team)}:${norm(e.name || e.player)}`;
      if (seen.has(key)) throw Error('Jogador duplicado na mesma queda: ' + stage + ':' + key);
      seen.add(key);
    }
    rows[stage] = aggregate(sourceEntries);
    drops[stage] = new Set(sourceEntries.map(e => `${num(e.day)}:${num(e.drop)}`)).size;
    const expectedDrops = stage === 'classificatoria' ? (summary[stage]?.rows || []).reduce((sum, r) => sum + num(r.matches), 0) / 12 : num(summary[stage]?.matchesPlayed);
    // Do not publish an incomplete live export as a complete stage.
    if (!expectedDrops || drops[stage] !== expectedDrops || sourceEntries.length !== expectedDrops * 48) throw Error(`Etapa incompleta: ${stage} (${drops[stage]}/${expectedDrops} quedas, ${sourceEntries.length} registros)`);
    for (const team of teams.teams) {
      const actual = sourceEntries.filter(e => norm(e.team) === norm(team.name)).reduce((sum, e) => sum + num(e.kills), 0);
      const expected = (summary[stage]?.rows || []).find(r => norm(r.team) === norm(team.name));
      if (actual !== num(expected?.kills)) throw Error(`Abates individuais divergem da equipe: ${stage} / ${team.name}: ${actual} != ${num(expected?.kills)}`);
    }
    coverage[stage] = 'completo';
  }
  rows.geral = aggregate(entries.filter(e => STAGES.includes(e.stage))); coverage.geral = 'completo';
  const teamIndex = teams.teams.map(t => ({name: t.name, abbreviation: t.abbreviation, logo: t.logo || 'escudo.webp'}));
  const rankings = {tournament: summary.tournament, updatedAt, source, coverage, drops, top10: Object.fromEntries([...STAGES, 'geral'].map(stage => [stage, rows[stage].slice(0, 10)]))};
  const byStage = Object.fromEntries(STAGES.map(s => [s, new Map(rows[s].map(r => [norm(r.name) + '__' + norm(r.team), r]))]));
  const squads = {tournament: summary.tournament, updatedAt, source, teams: teamIndex.map(team => {
    const roster = (players.players || []).filter(p => norm(p.team) === norm(team.name));
    const known = new Set(roster.map(p => norm(p.name)));
    for (const row of rows.geral.filter(r => norm(r.team) === norm(team.name))) if (!known.has(norm(row.name))) roster.push({name: row.name, team: team.name});
    return {...team, players: roster.map(p => {
      const key = norm(p.name) + '__' + norm(team.name);
      const matchesByStage = Object.fromEntries(STAGES.map(s => [s, num(byStage[s].get(key)?.matches)]));
      const photo = p.photo || p.image || photos.photos?.[norm(p.name).toLowerCase()] || 'silhueta.webp';
      return {name: p.name, role: p.roleShort || p.role || '', status: p.rosterStatus || (p.starter ? 'Titular' : 'Reserva'), captain: Boolean(p.captain), rookie: Boolean(p.rookie), photo, order: num(p.order), matches: Object.values(matchesByStage).reduce((a, b) => a + b, 0), matchesByStage};
    }).sort((a, b) => (a.status === 'Saiu') - (b.status === 'Saiu') || (b.status === 'Titular') - (a.status === 'Titular') || a.order - b.order)};
  })};
  const rounds = (dates.rounds || []).map(r => r.date).filter(Boolean).sort();
  const overview = {tournament: summary.tournament, updatedAt, finished: summary.finished, dateStart: rounds[0], dateEnd: rounds.at(-1), teams: teamIndex, format: summary.format, champion: summary.final?.champion || '', worldQualifiedFromStage2: summary.final?.worldQualifiedFromStage2 || [], worldQualifiedTeams: summary.final?.worldQualifiedTeams || [], stages: Object.fromEntries(STAGES.map(stage => [stage, {finished: summary[stage]?.finished, rows: (summary[stage]?.rows || []).map(({team, position, points, kills, booyahs, matches, bonus}) => ({team, position, points, kills, booyahs, matches, ...(bonus === undefined ? {} : {bonus})}))}]))};
  return {'inicio-resumo.json': overview, 'inicio-mvp-top10.json': rankings, 'inicio-elencos.json': squads};
}
async function main() {
  const input = process.argv.slice(2).find(arg => !arg.startsWith('--'));
  if (!input) throw Error('Informe o JSON exportado de ffwsLive/2026-s2; este script não consulta a rede.');
  const live = JSON.parse(fs.readFileSync(input, 'utf8'));
  const players = await mergeSources(read(BASE + 'players.json'), live, read(BASE + 'player-name-map.json'));
  const outputs = buildSummaries({players, live, teams: read(BASE + 'teams.json'), summary: read(BASE + 'career-summary.json'), dates: read(BASE + 'dates.json'), photos: read('player-data/photo-map.json')});
  for (const [name, data] of Object.entries(outputs)) {
    const file = path.join(ROOT, BASE, name), content = JSON.stringify(data) + '\n';
    if (process.argv.includes('--check')) {
      if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) throw Error('Resumo desatualizado: ' + name);
    } else fs.writeFileSync(file, content);
    console.log(name + ': ' + Buffer.byteLength(content) + ' bytes');
  }
}
module.exports = {aggregate, mergeSources, buildSummaries};
if (require.main === module) main().catch(error => {console.error(error.message); process.exitCode = 1;});
