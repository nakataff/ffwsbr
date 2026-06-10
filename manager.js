const POINTS = { 1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0, 16: 0 };
const MAPS = ["Bermuda", "Purgatorio", "Kalahari", "Nova Terra", "Solara"];
const GROUP_SCHEDULE = ["ABC", "BCD", "ACD", "ABD", "BCD", "ACD", "ABD", "ABC", "ACD", "ABD", "ABC", "BCD", "ABD", "ABC", "BCD", "ACD", "ABC", "BCD", "ACD", "ABD"];
const OVERALL_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRuRlZUWNZ43vX4_MHYYNKXiU2NyGvBLmkQBlzq6wMJxqQRi9B4X6hC6x1xUZV8Rk3OPVcD3jkwhwyP/pub?gid=967628988&single=true&output=csv";
const LOGOS = {
  "FLUXO W7M": "Fluxo 2.webp", "TEAM SOLID": "Team Solid 2.webp", "E1 SPORTS": "E1.webp",
  "INFLUENCE RAGE": "Influence Rage.webp", "LOUD": "loud 2.webp", "LOUD SNICKERS": "loud 2.webp",
  "ALPHA7 ESPORTS": "A7 2.webp", "ALPHA7": "A7 2.webp", "RUSH GAMING (MOBILE)": "Rush.webp",
  "RUSH GAMING": "Rush.webp", "LOS": "Los.webp", "INTZ": "Intz 1.webp", "VASCO ESPORTS": "Vasco.webp",
  "AXS": "AXS BRANCA.webp", "AXS FUSION": "AXS BRANCA.webp", "LPS": "Loops 1.webp",
  "LOOPS": "Loops 1.webp", "RISE GAMING": "Rise 1.webp", "VIRTUS.PRO": "Virtus Pro.webp",
  "VIRTUS PRO": "Virtus Pro.webp", "CIVIS": "Civis.webp", "ANGELS OUTPLAY": "Outplay.webp",
  "TEAM LIQUID": "tl.webp", "PAIN GAMING": "pain.webp", "CORINTHIANS": "sccp.webp",
  "FURIA ESPORTS": "furia.webp", "KEYD": "keyd.webp"
};

const state = {
  tournaments: [],
  currentDraw: null,
  rolling: false,
  refresh: 3,
  squad: { players: [], coach: null, bench: [] },
  gameStarted: false,
  draftDone: false,
  teamName: "SEU ELENCO",
  managerName: "Manager",
  difficulty: "easy",
  gameMode: "draft",
  setupConfirmed: false,
  selectedEdition: "",
  originalEdition: "",
  originalTeamKey: "",
  historicalConfirmed: false,
  sourceTeamName: "",
  sourceTeamEdition: "",
  autoBench: false,
  allowDuplicateTeams: false,
  adminUnlocked: false,
  overallOverrides: {},
  sheetOverrides: {},
  adminOverrides: {},
  statOverrides: {},
  overallParams: defaultOverallParams(),
  adminOpenEditions: [],
  activeEditions: [],
  teamAliases: {},
  playerAliases: {},
  playerLooseIndex: {},
  eraPlacements: {},
  scorePlacements: {},
  overallSource: "automatico",
  groupTeams: [],
  groupRound: 0,
  groupMatch: 0,
  groupTab: "overall",
  mvpFilter: "all",
  groupsStarted: false,
  finalStarted: false,
  transferMoves: 0,
  transferWindowOpen: false,
  transferOutIndex: null,
  transferOutType: null,
  transferRefresh: 1,
  marketTeam: null,
  pendingTransfer: null,
  pendingMarketIndex: null,
  mvpStats: {},
  mapStats: {},
  matchHistory: [],
  finalists: [],
  finalMatch: 0,
  finalTab: "overall",
  champion: null,
  trophies: [],
  seasonsPlayed: 0
};

const $ = (id) => document.getElementById(id);
const clean = (value) => (value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/ÃƒÆ’Ã‚Â£|ÃƒÂ£/g, "a")
  .replace(/ÃƒÆ’Ã‚Â¡|ÃƒÂ¡/g, "a")
  .replace(/ÃƒÆ’Ã‚Â©|ÃƒÂ©/g, "e")
  .replace(/ÃƒÆ’Ã‚Â³|ÃƒÂ³/g, "o")
  .replace(/ÃƒÆ’Ã‚Â§|ÃƒÂ§/g, "c")
  .trim();
const key = (value) => clean(value).toUpperCase().replace(/\s+/g, " ");
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const shuffle = (arr) => [...arr].sort(() => Math.random() - .5);
const shortEdition = (edition = "") => edition
  .replace(/FFWS 2025 SPLIT 1/i, "WB 2025 S1")
  .replace(/FFWS 2025 SPLIT 2/i, "WB 2025 S2")
  .replace(/FFWS 2026 SPLIT 1/i, "WB 2026 S1")
  .replace(/FFWS 2024/i, "WB 2024");
const normalizeEditionKey = (edition = "") => key(shortEdition(edition))
  .replace(/FREE FIRE WORLD SERIES|FFWS/g, "WB")
  .replace(/SPLIT/g, "S")
  .replace(/\bWB 2024 F[12]\b/g, "WB 2024")
  .replace(/\b([SF])\s+(\d)\b/g, "$1$2")
  .replace(/\s+/g, " ");
const playerLooseKey = (value) => key(value)
  .replace(/[^A-Z0-9]/g, "")
  .replace(/\d+$/g, "");
const playerLooseBlocked = new Set(["MT", "MTS"]);

Promise.all([
  fetch("DADOS.txt").then((r) => r.text()),
  fetch("lbffData.json").then((r) => r.json()),
  fetch("team-aliases.json").then((r) => r.json()).catch(() => ({})),
  fetch("player-aliases.json").then((r) => r.json()).catch(() => ({})),
  fetch("dados.json").then((r) => r.json()).catch(() => null),
  fetch("dados-final.json").then((r) => r.json()).catch(() => null),
  loadEraoData(),
  fetch("wb-manager-overalls.json").then((r) => r.ok ? r.json() : null).catch(() => null),
  fetch(OVERALL_CSV_URL).then((r) => r.ok ? r.text() : "").catch(() => ""),
  Promise.all([1, 2, 3, 4].map((n) => fetch(`drop-${n}.csv`).then((r) => r.text()).catch(() => ""))),
  Promise.all([1, 2, 3, 4, 5].map((n) => fetch(`mvp-${n}.csv`).then((r) => r.text()).catch(() => "")))
]).then(([dados, playerData, teamAliases, playerAliases, groupScoreData, finalScoreData, eraData, backupOveralls, overallCsv, dropCsvs, mvpCsvs]) => {
  state.dropTemplates = dropCsvs.map(parseDropCsv).filter((rows) => rows.length >= 12);
  state.mvpTemplates = mvpCsvs.map(parseMvpCsv).filter((rows) => rows.length);
  state.playerData = playerData;
  state.playerAliases = playerAliases || {};
  state.playerIndex = buildPlayerIndex(playerData);
  state.teamAliases = teamAliases || {};
  state.eraPlacements = buildEraPlacements(eraData);
  state.scorePlacements = buildScorePlacementMaps(groupScoreData, finalScoreData);
  state.ranks = buildRanks(playerData);
  state.sheetOverrides = normalizeOverallStyle(parseOverallCsv(overallCsv));
  state.adminOverrides = mergeOverallOverrides(backupOveralls?.overallOverrides || {}, loadAdminOverrides());
  state.statOverrides = loadStatOverrides();
  state.overallParams = loadOverallParams();
  state.activeEditions = loadActiveEditions();
  state.overallOverrides = mergeOverallOverrides(state.sheetOverrides, state.adminOverrides);
  state.overallSource = overallSourceLabel();
  state.tournaments = parseTournaments(dados, playerData, state.ranks).filter((t) => t.teams.length >= 4);
  bindEvents();
  populateEditionSelect();
  renderAll();
}).catch((error) => {
  $("drawCard").innerHTML = `<div class="draw-empty">Erro carregando dados: ${error.message}</div>`;
});

function parseDropCsv(text) {
  return text.trim().split(/\r?\n/).slice(1).map((line) => {
    const [team, group, points, booyah, kills, drops] = line.split(",");
    return {
      team,
      group,
      points: Number(points || 0),
      booyah: Number(booyah || 0),
      kills: Number(kills || 0),
      drops: Number(drops || 1)
    };
  }).sort((a, b) => b.points - a.points);
}

function parseMvpCsv(text) {
  return text.trim().split(/\r?\n/).slice(1).map((line) => {
    const [player, team, kills, damage, assists, drops, mvp] = line.split(",");
    return {
      player: clean(player),
      team: clean(team),
      kills: Number(kills || 0),
      damage: Number(damage || 0),
      assists: Number(assists || 0),
      drops: Number(drops || 1),
      mvp: Number(mvp || 0)
    };
  });
}

function loadEraoData() {
  const files = ["lbff-1", "lbff-3", "lbff-4", "lbff-5", "lbff-6", "lbff-7", "lbff-8", "lbff-9", "wb-2024"];
  return Promise.all(files.map((file) => fetch(`erao/${file}.json`).then((r) => r.ok ? r.json() : null).catch(() => null)));
}

function buildEraPlacements(files) {
  const placements = {};
  (files || []).filter(Boolean).forEach((data) => {
    const rows = [];
    const regular = (data.standings || []).find((standing) => /regular|class|group/i.test(standing.title || "")) || data.standings?.[0];
    const regularRows = tableRowsToObjects(regular);
    const regularByTeam = new Map(regularRows.map((row) => [key(row.team), row]));
    const finalRows = tableRowsToObjects(data.final);
    if (finalRows.length) {
      finalRows.sort((a, b) => a.pos - b.pos).forEach((row) => {
        const regularRow = regularByTeam.get(key(row.team));
        rows.push({
          name: row.team,
          position: row.pos,
          regularPosition: numberValue(regularRow?.pos),
          finalPosition: numberValue(row.pos),
          finalist: true,
          totalPoints: numberValue(regularRow?.total) + numberValue(row.total),
          groupPoints: numberValue(regularRow?.total),
          finalPoints: numberValue(row.total),
          totalKills: numberValue(row.kills)
        });
      });
      regularRows
        .filter((row) => !finalRows.some((finalRow) => teamsMatch(finalRow.team, row.team)))
        .sort((a, b) => a.pos - b.pos)
        .forEach((row) => {
          rows.push({
            name: row.team,
            position: rows.length + 1,
            regularPosition: numberValue(row.pos),
            finalPosition: 0,
            finalist: false,
            totalPoints: numberValue(row.total),
            groupPoints: numberValue(row.total),
            finalPoints: 0,
            totalKills: 0
          });
        });
    } else {
      regularRows.sort((a, b) => a.pos - b.pos).forEach((row) => {
        rows.push({
          name: row.team,
          position: row.pos,
          regularPosition: numberValue(row.pos),
          finalPosition: 0,
          finalist: row.pos <= 12,
          totalPoints: numberValue(row.total),
          groupPoints: numberValue(row.total),
          finalPoints: 0,
          totalKills: 0
        });
      });
    }
    placements[normalizeEditionKey(data.name)] = rows;
  });
  return placements;
}

function tableRowsToObjects(table) {
  if (!table?.rows?.length || !table?.cols?.length) return [];
  return table.rows.map((row) => Object.fromEntries(table.cols.map((col, index) => [col, row[index]])));
}

function numberValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function buildScorePlacementMaps(groupData, finalData) {
  const map = {};
  if (!groupData?.dbQuedas && !finalData?.dbQuedas) return map;
  const groupScores = scoreStage(groupData);
  const finalScores = scoreStage(finalData);
  const teams = new Map();
  [...groupScores, ...finalScores].forEach((row) => {
    const id = key(row.name);
    teams.set(id, {
      name: row.name,
      groupPoints: (teams.get(id)?.groupPoints || 0) + (row.stage === "group" ? row.points : 0),
      finalPoints: (teams.get(id)?.finalPoints || 0) + (row.stage === "final" ? row.points : 0),
      groupKills: (teams.get(id)?.groupKills || 0) + (row.stage === "group" ? row.kills : 0),
      finalKills: (teams.get(id)?.finalKills || 0) + (row.stage === "final" ? row.kills : 0),
      finalDrops: (teams.get(id)?.finalDrops || 0) + (row.stage === "final" ? row.drops : 0)
    });
  });
  const rows = [...teams.values()].map((row) => ({
    ...row,
    totalPoints: row.groupPoints + row.finalPoints,
    totalKills: row.groupKills + row.finalKills,
    finalist: row.finalDrops > 0
  })).sort((a, b) => {
    if (a.finalist !== b.finalist) return a.finalist ? -1 : 1;
    return b.totalPoints - a.totalPoints || b.totalKills - a.totalKills;
  }).map((row, index) => ({ ...row, position: index + 1 }));
  map[normalizeEditionKey("FFWS 2026 SPLIT 1")] = rows;
  map[normalizeEditionKey("WB 2026 S1")] = rows;
  return map;
}

function scoreStage(data) {
  const scores = {};
  const stage = data?.__meta?.stage === "final" ? "final" : "group";
  Object.values(data?.dbQuedas || {}).forEach((day) => {
    Object.values(day || {}).forEach((match) => {
      (match.resultados || []).forEach((result) => {
        const name = clean(result.equipe);
        if (!name) return;
        scores[name] ||= { name, stage, points: 0, kills: 0, drops: 0 };
        const kills = Number(result.kills || 0);
        const pos = Number(result.posicao || 12);
        scores[name].points += (POINTS[pos] || 0) + kills;
        scores[name].kills += kills;
        scores[name].drops += 1;
      });
    });
  });
  return Object.values(scores);
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index++;
      row.push(cell);
      if (row.some((value) => clean(value))) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => clean(value))) rows.push(row);
  return rows;
}

function parseOverallCsv(text) {
  const rows = parseCsvRows(text || "");
  if (rows.length < 2) return {};
  const headers = rows[0].map((header) => normalizeEditionKey(header));
  const playerColumn = rows[0].findIndex((header) => /jogador|player/i.test(clean(header)));
  const nameIndex = playerColumn >= 0 ? playerColumn : 0;
  const overrides = {};
  rows.slice(1).forEach((row) => {
    const players = aliasNames(row[nameIndex]);
    if (!players.length) return;
    row.forEach((value, index) => {
      if (index === nameIndex) return;
      const overall = Number(String(value || "").replace(",", "."));
      if (!Number.isFinite(overall)) return;
      const edition = headers[index];
      if (!edition) return;
      players.forEach((player) => {
        overrides[player] ||= {};
        overrides[player][edition] = Math.max(65, Math.min(99, Math.round(overall)));
      });
    });
  });
  return overrides;
}

function aliasNames(value) {
  return String(value || "")
    .split(",")
    .map((name) => key(name))
    .filter(Boolean);
}

function normalizeOverallStyle(overrides) {
  const editionValues = {};
  Object.values(overrides || {}).forEach((editions) => {
    Object.entries(editions).forEach(([edition, value]) => {
      editionValues[edition] ||= [];
      editionValues[edition].push(value);
    });
  });
  const references = Object.entries(editionValues)
    .filter(([edition]) => /LBFF\s+[13]\b/.test(edition))
    .flatMap(([, values]) => values);
  if (!references.length) return overrides;
  const targetAvg = references.reduce((sum, value) => sum + value, 0) / references.length;
  const normalized = {};
  Object.entries(overrides || {}).forEach(([player, editions]) => {
    normalized[player] = { ...editions };
  });
  Object.entries(editionValues).forEach(([edition, values]) => {
    if (/LBFF\s+[13]\b/.test(edition)) return;
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    if (avg <= targetAvg + 1.8) return;
    const sorted = [...new Set(values)].sort((a, b) => b - a);
    const eliteCut = sorted[Math.min(1, sorted.length - 1)] || 93;
    Object.entries(normalized).forEach(([, playerEditions]) => {
      if (!playerEditions[edition]) return;
      const value = playerEditions[edition];
      let adjusted = Math.round(65 + (value - 65) * .58 + (targetAvg - 73) * .15);
      if (value >= eliteCut && value >= 93) adjusted = Math.max(adjusted, value >= 98 ? 94 : 92);
      playerEditions[edition] = Math.max(65, Math.min(96, adjusted));
    });
  });
  return normalized;
}

function loadAdminOverrides() {
  try {
    return JSON.parse(localStorage.getItem("wbManagerOverallOverrides") || "{}");
  } catch {
    return {};
  }
}

function loadActiveEditions() {
  try {
    return JSON.parse(localStorage.getItem("wbManagerActiveEditions") || "[]");
  } catch {
    return [];
  }
}

function loadStatOverrides() {
  try {
    return JSON.parse(localStorage.getItem("wbManagerStatOverrides") || "{}");
  } catch {
    return {};
  }
}

function defaultOverallParams() {
  return {
    preAvg: .826,
    postAvg: 1.048,
    neutralAvg: .96,
    kpgWeight: 14.5,
    rankWeight: 11,
    volumeWeight: 8,
    classTop12: 1.5,
    classTop4: 2.5,
    finalTop12: 2,
    finalTop4: 3,
    champion: 4
  };
}

function loadOverallParams() {
  try {
    return { ...defaultOverallParams(), ...JSON.parse(localStorage.getItem("wbManagerOverallParams") || "{}") };
  } catch {
    return defaultOverallParams();
  }
}

function editionAllowed(edition) {
  return !state.activeEditions.length || state.activeEditions.includes(normalizeEditionKey(edition));
}

function computableEditionKeys() {
  return [...new Set(state.tournaments.filter((tournament) => /LBFF|WB|FFWS/i.test(tournament.edition)).map((tournament) => normalizeEditionKey(tournament.edition)))];
}

function mergeOverallOverrides(...maps) {
  const merged = {};
  maps.forEach((map) => {
    Object.entries(map || {}).forEach(([player, editions]) => {
      merged[player] ||= {};
      Object.assign(merged[player], editions);
    });
  });
  return merged;
}

function overallSourceLabel() {
  const sheetCount = Object.keys(state.sheetOverrides || {}).length;
  const adminCount = Object.keys(state.adminOverrides || {}).length;
  if (sheetCount && adminCount) return "Google Sheets + Admin";
  if (sheetCount) return "Google Sheets";
  if (adminCount) return "Admin";
  return "automatico";
}

function buildRanks(playerData) {
  const ranks = {};
  Object.entries(playerData).forEach(([, seasons]) => {
    Object.entries(seasons).forEach(([season, stats]) => {
      const seasonKey = normalizeEditionKey(season);
      if (seasonKey === "WB 2024") return;
      ranks[seasonKey] ||= { kpg: [], kills: [] };
      ranks[seasonKey].kpg.push(rawScore(stats));
      ranks[seasonKey].kills.push(Number(stats.k || 0));
    });
    const wb2024 = combinedEditionStats(seasons, "WB 2024");
    if (wb2024) {
      ranks["WB 2024"] ||= { kpg: [], kills: [] };
      ranks["WB 2024"].kpg.push(rawScore(wb2024));
      ranks["WB 2024"].kills.push(Number(wb2024.k || 0));
    }
  });
  Object.keys(ranks).forEach((season) => {
    ranks[season].kpg.sort((a, b) => a - b);
    ranks[season].kills.sort((a, b) => a - b);
  });
  return ranks;
}

function rawScore(stats) {
  const kills = Number(stats.k || 0);
  const drops = Math.max(1, Number(stats.q || 1));
  return kills / drops;
}

function effectivePlayerStats(name, edition) {
  const player = key(name);
  const editionKey = normalizeEditionKey(edition);
  const override = state.statOverrides?.[player]?.[editionKey];
  if (override) return override;
  const record = state.playerData?.[name] || state.playerData?.[clean(name)] || state.playerIndex?.[key(name)]?.seasons || state.playerLooseIndex?.[playerLooseKey(name)]?.seasons;
  if (!record) return null;
  const combined = combinedEditionStats(record, editionKey);
  if (combined) return combined;
  const found = Object.entries(record).find(([season]) => normalizeEditionKey(season) === editionKey || normalizeEditionKey(shortEdition(season)) === editionKey);
  return found ? found[1] : null;
}

function combinedEditionStats(record, editionKey) {
  if (normalizeEditionKey(editionKey) !== "WB 2024") return null;
  const entries = Object.entries(record || {}).filter(([season]) => normalizeEditionKey(season) === "WB 2024");
  if (!entries.length) return null;
  return entries.reduce((acc, [, stats]) => ({
    k: Number(acc.k || 0) + Number(stats.k || 0),
    q: Number(acc.q || 0) + Number(stats.q || 0),
    team: stats.team || acc.team,
    equipe: stats.equipe || acc.equipe,
    source: "WB 2024 F1+F2"
  }), { k: 0, q: 0 });
}

function automaticOverallFromStats(name, edition, stats, inactive = false) {
  const team = findTeamForPerson(name, edition);
  return automaticOverallFromStatsV2(name, edition, stats, inactive, team);
}

function automaticOverallFromStatsV2(name, edition, stats, inactive = false, team = null) {
  if (!stats) return inactive ? 66 : 70;
  const kills = Number(stats.k || 0);
  const drops = Math.max(1, Number(stats.q || 1));
  const kpg = kills / drops;
  const seasonKey = normalizeEditionKey(edition);
  const killRanks = state.ranks?.[seasonKey]?.kills || state.ranks?.[key(edition)]?.kills || [];
  const killPct = killRanks.length ? killRanks.filter((value) => value <= kills).length / killRanks.length : .5;
  const eraAvg = eraKpgBaseline(edition);
  const normalizedKpg = kpg / eraAvg;
  const params = state.overallParams || defaultOverallParams();
  const kpgScore = Math.min(20, Math.max(0, (normalizedKpg - .58) * Number(params.kpgWeight || 14.5)));
  const volumeScore = Math.min(10, Math.sqrt(Math.max(0, kills) / eraVolumeTarget(edition)) * Number(params.volumeWeight || 8));
  const rankScore = Math.pow(Math.max(0, (killPct - .50) / .50), 1.45) * Number(params.rankWeight || 11);
  const teamScore = teamPlacementBonus(team);
  let overall = Math.round(65 + kpgScore + volumeScore + rankScore + teamScore);
  if (isPreReviveEdition(edition) && kpg >= .9 && kpg < 1) overall = Math.max(overall, 82);
  if (normalizedKpg >= 1.35 && killPct >= .90) overall = Math.max(overall, 88);
  if (killPct >= .97 && normalizedKpg >= 1.7) overall = Math.max(overall, 92);
  if (killPct >= .99 && normalizedKpg >= 2.05) overall = Math.max(overall, 95);
  if (killPct >= .995 && normalizedKpg >= 2.45) overall = Math.max(overall, 97);
  if (/MT7/i.test(name) && /2026/.test(edition)) overall = 99;
  if (kills >= 300 && normalizedKpg >= 2.75 && killPct >= .995) overall = 99;
  if (inactive) overall = Math.max(65, overall - 8);
  return Math.max(65, Math.min(99, overall));
}

function isPreReviveEdition(edition) {
  return /LBFF\s*(1|3|4|5|6)\b/i.test(normalizeEditionKey(edition));
}

function isPostReviveEdition(edition) {
  return /LBFF\s*(7|8|9)\b/i.test(normalizeEditionKey(edition));
}

function eraKpgBaseline(edition) {
  const params = state.overallParams || defaultOverallParams();
  return isPostReviveEdition(edition) ? Number(params.postAvg || 1.048) : isPreReviveEdition(edition) ? Number(params.preAvg || .826) : Number(params.neutralAvg || .96);
}

function eraVolumeTarget(edition) {
  return isPostReviveEdition(edition) ? 360 : isPreReviveEdition(edition) ? 280 : 320;
}

function teamPlacementBonus(team) {
  const params = state.overallParams || defaultOverallParams();
  if (!team) return 0;
  if (team.finalPlacement === 1 || team.placement === 1) return Number(params.champion || 4);
  if (team.finalPlacement && team.finalPlacement <= 4) return Number(params.finalTop4 || 3);
  if (team.finalPlacement && team.finalPlacement <= 12) return Number(params.finalTop12 || 2);
  if (team.placement && team.placement <= 4) return Number(params.classTop4 || 2.5);
  if (team.placement && team.placement <= 12) return Number(params.classTop12 || 1.5);
  return 0;
}

function findTeamForPerson(name, edition) {
  const editionKey = normalizeEditionKey(edition);
  const tournament = state.tournaments?.find((item) => normalizeEditionKey(item.edition) === editionKey);
  return tournament?.teams?.find((team) => team.players?.some((player) => key(player.name) === key(name)) || team.staff?.some((person) => key(person.name) === key(name))) || null;
}

function teamKeys(name) {
  const common = {
    A7: ["ALPHA7", "ALPHA7 ESPORTS"],
    A34: ["ALFA 34"],
    CRVG: ["VASCO ESPORTS", "VASCO E-SPORTS"],
    FLA: ["FLAMENGO ESPORTS", "FLAMENGO ESPORTS"],
    FLUXO: ["FLUXO", "FLUXO W7M"],
    INCO: ["INCO GAMING", "INCO"],
    INF: ["INFLUENCE RAGE"],
    LOUD: ["LOUD", "LOUD SNICKERS"],
    PAIN: ["PAIN GAMING"],
    PNG: ["PAIN GAMING"],
    RED: ["RED CANIDS"],
    RUSH: ["RUSH GAMING"],
    SANTOS: ["SANTOS", "SANTOS E-SPORTS", "SANTOS/REAL", "SANTOS REAL"],
    SAVEX: ["SAVEX GAMING"],
    SCCP: ["CORINTHIANS"],
    "TEAM SOLID": ["TEAM SOLID"],
    "W7M": ["W7M ESPORTS", "W7M ESPORTS"]
  };
  const direct = key(name);
  const values = new Set([direct]);
  Object.entries(state.teamAliases || {}).forEach(([canonical, aliases]) => {
    if ([canonical, ...(aliases || [])].map(key).includes(direct)) {
      values.add(key(canonical));
      (aliases || []).forEach((alias) => values.add(key(alias)));
    }
  });
  Object.entries(common).forEach(([alias, names]) => {
    if (key(alias) === direct || names.map(key).includes(direct)) {
      values.add(key(alias));
      names.forEach((item) => values.add(key(item)));
    }
  });
  return values;
}

function teamsMatch(a, b) {
  const aKeys = teamKeys(a);
  return [...teamKeys(b)].some((value) => aKeys.has(value));
}

function buildPlayerIndex(playerData) {
  const index = {};
  const looseCandidates = {};
  Object.entries(playerData).forEach(([name, seasons]) => {
    const record = { name, seasons };
    const exactKey = key(name);
    index[exactKey] = index[exactKey] ? mergePlayerRecords(name, [index[exactKey], record]) : record;
    const loose = playerLooseKey(name);
    if (loose && !playerLooseBlocked.has(loose)) {
      looseCandidates[loose] ||= [];
      looseCandidates[loose].push(index[exactKey]);
    }
  });
  Object.entries(state.playerAliases || {}).forEach(([canonical, aliases]) => {
    const candidates = [canonical, ...(aliases || [])]
      .map((alias) => index[key(alias)])
      .filter(Boolean);
    const record = mergePlayerRecords(canonical, candidates);
    if (!record) return;
    index[key(canonical)] = record;
    (aliases || []).forEach((alias) => { index[key(alias)] = record; });
    [canonical, ...(aliases || [])].forEach((alias) => {
      const loose = playerLooseKey(alias);
      if (loose && !playerLooseBlocked.has(loose)) looseCandidates[loose] = [record];
    });
  });
  state.playerLooseIndex = {};
  Object.entries(looseCandidates).forEach(([loose, records]) => {
    const unique = [...new Map(records.map((record) => [key(record.name), record])).values()];
    if (unique.length === 1) state.playerLooseIndex[loose] = unique[0];
  });
  return index;
}

function mergePlayerRecords(displayName, records) {
  if (!records.length) return null;
  const seasons = {};
  records.forEach((record) => {
    Object.entries(record.seasons || {}).forEach(([season, stats]) => {
      const seasonKey = normalizeEditionKey(season);
      const existingKey = Object.keys(seasons).find((item) => {
        if (seasonKey === "WB 2024") return item === season;
        return normalizeEditionKey(item) === seasonKey;
      });
      if (!existingKey) {
        seasons[season] = stats;
        return;
      }
      if (Number(stats.k || 0) > Number(seasons[existingKey].k || 0)) seasons[existingKey] = stats;
    });
  });
  return { name: displayName, seasons };
}

function parseTournaments(text, playerData, ranks) {
  const tournaments = [];
  let current = null;
  let team = null;
  let transferList = null;

  text.split(/\r?\n/).forEach((line) => {
    const header = line.match(/^(.{0,80}?(?:SPLIT|LBFF|FFWS|WB|COPA|LAFF)[^:]*):\s*$/i);
    const opponent = line.match(/\{\{Opponent\|([^|\n}]+)/);
    const person = line.match(/\{\{Person\|([^|}]*)/);
    const cardTeam = line.match(/^\|team=([^|\n]+)/);
    const cardPlayer = line.match(/^\|p\d+=([^|\n]+)/);
    const cardCoach = line.match(/^\|c=([^|\n]*)/);
    const teamCardStaff = line.match(/^\|t\d+c\d+=([^|\n}]*)/);
    const transferTeam = line.match(/^\|team(\d*)=([^|\n}]+)/);

    if (header) {
      current = { edition: clean(header[1]), teams: [] };
      tournaments.push(current);
      team = null;
      transferList = null;
    }
    if (!current) return;
    if (/\{\{Transfer List/i.test(line)) {
      transferList = [];
      return;
    }
    if (transferList && transferTeam) {
      const position = Number(transferTeam[1] || 1);
      transferList.push({ position, name: clean(transferTeam[2]) });
      return;
    }
    if (transferList && /^\}\}/.test(line)) {
      transferList = null;
      return;
    }
    if (opponent) {
      team = { name: clean(opponent[1]), edition: current.edition, players: [], staff: [] };
      current.teams.push(team);
    }
    if (cardTeam) {
      team = { name: clean(cardTeam[1]), edition: current.edition, players: [], staff: [] };
      current.teams.push(team);
    }
    if (team && cardPlayer && clean(cardPlayer[1])) {
      const item = {
        name: clean(cardPlayer[1]),
        role: "player",
        overall: getPlayerOverall(clean(cardPlayer[1]), current.edition, playerData, ranks, false),
        inactive: false
      };
      team.players.push(item);
    }
    if (team && cardCoach && clean(cardCoach[1])) {
      team.staff.push({
        name: clean(cardCoach[1]),
        role: "head coach",
        overall: 70,
        inactive: false
      });
    }
    if (team && teamCardStaff && clean(teamCardStaff[1])) {
      const role = teamCardStaffRole(line);
      team.staff.push({
        name: clean(teamCardStaff[1]),
        role,
        overall: 70,
        inactive: /status=former|leave=true|dnp=true/i.test(line)
      });
    }
    if (team && person && clean(person[1])) {
      const role = (line.match(/role=([^|}]+)/) || [])[1] || "";
      const isStaff = /type=staff|head coach|coach|analyst/i.test(line);
      const inactive = /status=former|leave=true|dnp=true/i.test(line);
      const item = {
        name: clean(person[1]),
        role: clean(role || (isStaff ? "staff" : "player")),
        overall: 70,
        inactive
      };
      if (!isStaff) item.overall = getPlayerOverall(item.name, current.edition, playerData, ranks, inactive);
      if (isStaff) team.staff.push(item); else team.players.push(item);
    }
  });

  tournaments.forEach((tournament) => {
    tournament.teams = tournament.teams.filter((teamItem) => teamItem.players.length >= 4);
    applyTournamentPlacements(tournament);
    tournament.teams.forEach((teamItem) => {
      const teamBonus = teamItem.finalPlacement === 1 || teamItem.placement === 1 ? 2 : teamItem.finalPlacement && teamItem.finalPlacement <= 4 ? 1 : 0;
      if (teamBonus) {
        teamItem.players.forEach((player) => {
          if (effectivePlayerStats(player.name, tournament.edition)) player.overall = Math.min(99, player.overall + teamBonus);
        });
      }
      teamItem.staff.forEach((coach) => {
        coach.overall = getCoachOverall(coach, teamItem, tournament.edition);
      });
      teamItem.power = rosterPower(teamItem.players, teamItem.staff[0]);
    });
  });
  return tournaments;
}

function teamCardStaffRole(line) {
  const pos = clean((line.match(/pos=\{\{Abbr\|[^|}]*\|([^}]*)/) || [])[1] || "");
  if (/coach/i.test(pos) || /\|\s*C\s*\|/i.test(line)) return "head coach";
  if (/analyst/i.test(pos) || /\|\s*A\s*\|/i.test(line)) return "analyst";
  if (/manager/i.test(pos) || /\|\s*M\s*\|/i.test(line)) return "manager";
  return "staff";
}

function applyTournamentPlacements(tournament) {
  const used = new Set();
  const scoreRows = placementRowsForEdition(tournament.edition);
  scoreRows.forEach((placement) => {
    const team = tournament.teams.find((candidate) => !used.has(candidate) && teamsMatch(candidate.name, placement.name));
    if (!team) return;
    team.placement = placement.position;
    team.stageLabel = placement.finalist ? "Final" : "Classificatoria";
    team.realPoints = placement.totalPoints;
    team.classificationPoints = placement.groupPoints;
    team.finalStagePoints = placement.finalPoints;
    team.regularPlacement = placement.regularPosition;
    team.finalPlacement = placement.finalPosition;
    team.placementSource = "pontos";
    used.add(team);
  });
  tournament.teams.forEach((team, index) => {
    if (!team.placement) {
      const afterUsed = used.size + 1;
      team.placement = Math.max(index + 1, afterUsed);
      team.stageLabel = team.placement <= 12 ? "Final" : "Classificatoria";
      team.placementSource = "fallback";
      used.add(team);
    }
  });
  tournament.teams = dedupeTournamentTeams(tournament.teams);
}

function placementRowsForEdition(edition) {
  const editionKey = normalizeEditionKey(edition);
  return manualPlacements()[editionKey] || state.eraPlacements?.[editionKey] || state.scorePlacements?.[editionKey] || [];
}

function manualPlacements() {
  const wb2025S1 = [
    ["LOS", 1, 2, 1, 187],
    ["Fluxo", 2, 1, 2, 174],
    ["Alfa 34", 3, 8, 3, 165],
    ["paiN Gaming", 4, 5, 4, 146],
    ["Alpha7", 5, 9, 5, 142],
    ["Vasco eSports", 6, 10, 6, 136],
    ["LOUD", 7, 3, 7, 133],
    ["Corinthians", 8, 7, 8, 133],
    ["Team Solid", 9, 4, 9, 133],
    ["W7M Esports", 10, 11, 10, 114],
    ["E1 Sports", 11, 6, 11, 99],
    ["Flamengo Esports", 12, 12, 12, 62],
    ["iNCO Gaming", 13, 13, 0, 0],
    ["SAVEX Gaming", 14, 14, 0, 0],
    ["Influence Rage", 15, 15, 0, 0]
  ].map(([name, position, regularPosition, finalPosition, finalPoints]) => ({
    name,
    position,
    regularPosition,
    finalPosition,
    finalist: finalPosition > 0,
    totalPoints: finalPoints,
    groupPoints: 0,
    finalPoints,
    totalKills: 0
  }));
  return {
    [normalizeEditionKey("FFWS 2025 SPLIT 1")]: wb2025S1,
    [normalizeEditionKey("WB 2025 S1")]: wb2025S1
  };
}

function dedupeTournamentTeams(teams) {
  const byOrg = new Map();
  teams.forEach((team) => {
    const org = [...teamKeys(team.name)].sort((a, b) => a.length - b.length)[0] || key(team.name);
    const current = byOrg.get(org);
    if (!current || teamRankPriority(team) < teamRankPriority(current)) byOrg.set(org, team);
  });
  return [...byOrg.values()].sort((a, b) => (a.placement || 99) - (b.placement || 99) || b.power - a.power);
}

function teamRankPriority(team) {
  const source = team.placementSource === "pontos" ? 0 : team.placementSource === "manual" ? 1 : 2;
  const final = team.finalPlacement ? -20 : 0;
  return source * 1000 + final + (team.placement || 99);
}

function getPlayerOverall(name, edition, data, ranks, inactive) {
  const override = getOverallOverride(name, edition);
  if (override) return inactive ? Math.max(65, override - 8) : override;
  const effectiveStats = effectivePlayerStats(name, edition);
  if (effectiveStats) return automaticOverallFromStats(name, edition, effectiveStats, inactive);
  return 65;
}

function getOverallOverride(name, edition) {
  const playerOverrides = state.overallOverrides?.[key(name)];
  if (!playerOverrides) return null;
  const editionKey = normalizeEditionKey(edition);
  if (playerOverrides[editionKey]) return playerOverrides[editionKey];
  const compactEdition = editionKey.replace(/\s/g, "");
  const match = Object.entries(playerOverrides).find(([sheetEdition]) => {
    const compactSheet = sheetEdition.replace(/\s/g, "");
    return compactEdition.includes(compactSheet) || compactSheet.includes(compactEdition);
  });
  return match ? match[1] : null;
}

function playerSplitStats(name, edition) {
  const stats = effectivePlayerStats(name, edition);
  if (!stats) return { kills: 0, drops: 0, kpg: 0, confirmed: false };
  const kills = Number(stats.k || 0);
  const drops = Math.max(1, Number(stats.q || 1));
  return { kills, drops, kpg: kills / drops, confirmed: true };
}

function getCoachOverall(coach, team, edition) {
  const override = getOverallOverride(coach.name, edition);
  if (override) return coach.inactive ? Math.max(65, override - 7) : override;
  const playerAvg = team.players.reduce((sum, p) => sum + p.overall, 0) / Math.max(1, team.players.length);
  let overall = Math.round(playerAvg - 6 + rand(-2, 3));
  const coachKey = key(coach.name);
  if ((team.finalPlacement && team.finalPlacement <= 12) || (team.placement && team.placement <= 12)) overall = Math.max(overall, 77);
  if (team.placement === 1 || team.finalPlacement === 1) overall = Math.max(overall, 88);
  else if (team.finalPlacement && team.finalPlacement <= 4) overall = Math.max(overall, 84);
  else if (team.placement && team.placement <= 4) overall = Math.max(overall, 82);
  if (coachKey === "SOUTO" && /LBFF 1/i.test(edition)) overall = 88;
  if (/(LUUUKING|PUTSGRILO|QUEIROZ|RIBAS|LIPAO|NINJA)/i.test(coachKey)) overall = Math.max(overall, 84);
  if (/analyst/i.test(coach.role)) overall -= 5;
  if (coach.inactive) overall -= 7;
  return Math.max(65, Math.min(92, overall));
}

function rosterPower(players, coach) {
  const top = [...players].sort((a, b) => b.overall - a.overall).slice(0, 4);
  const avg = top.reduce((sum, p) => sum + p.overall, 0) / Math.max(1, top.length);
  const coachBoost = coach ? (coach.overall - 72) * .12 : 0;
  return Math.round((avg + coachBoost) * 10) / 10;
}

function overallLabel(value) {
  return `${value}${Number(value) >= 92 ? " &#9733;" : ""}`;
}

function eliteClass(value) {
  return Number(value) >= 92 ? " elite-overall" : "";
}

function bindEvents() {
  $("startGameBtn").addEventListener("click", startGameScreen);
  $("resetGameBtn").addEventListener("click", resetGame);
  $("rollAnyBtn").addEventListener("click", rollAny);
  $("rollEditionBtn").addEventListener("click", rollSameEdition);
  $("startGroupsBtn").addEventListener("click", startGroups);
  $("simMatchBtn").addEventListener("click", () => simGroups(1));
  $("simDayBtn").addEventListener("click", () => simGroups(matchesLeftInGroupDay()));
  $("simAllBtn").addEventListener("click", () => simGroups(120));
  $("startFinalBtn").addEventListener("click", startFinal);
  $("simFinalMatchBtn").addEventListener("click", () => simFinal(1));
  $("simFinalDayBtn").addEventListener("click", () => simFinal(matchesLeftInFinalDay()));
  $("simFinalAllBtn").addEventListener("click", () => simFinal(16));
  $("rollMarketBtn").addEventListener("click", rollMarket);
  $("teamNameInput").addEventListener("input", updateManagerSetup);
  $("managerNameInput").addEventListener("input", updateManagerSetup);
  $("difficultySelect").addEventListener("change", updateManagerSetup);
  $("gameModeSelect").addEventListener("change", updateManagerSetup);
  $("duplicateTeamsInput").addEventListener("change", updateManagerSetup);
  $("editionSelect").addEventListener("change", updateManagerSetup);
  $("confirmSetupBtn").addEventListener("click", confirmSetup);
  $("originalEditionSelect").addEventListener("change", updateOriginalTeamOptions);
  $("originalTeamSelect").addEventListener("change", updateManagerSetup);
  $("useOriginalTeamBtn").addEventListener("click", useSelectedOriginalTeam);
  $("autoBenchInput").addEventListener("change", updateManagerSetup);
  $("adminBtn").addEventListener("click", openAdmin);
  $("closeAdminBtn").addEventListener("click", closeAdmin);
  $("adminPanel").addEventListener("click", (event) => {
    if (event.target.id === "adminPanel") closeAdmin();
  });
  $("adminTeams").addEventListener("change", handleAdminOverallChange);
  $("adminTeams").addEventListener("click", handleAdminBackupClick);
  $("adminTeams").addEventListener("toggle", handleAdminEditionToggleState, true);
  $("splitSummary").addEventListener("click", handleStatsActions);
  document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
  document.querySelectorAll("[data-group-tab]").forEach((tab) => tab.addEventListener("click", () => {
    state.groupTab = tab.dataset.groupTab;
    renderGroupsV2();
  }));
  document.querySelectorAll("[data-mvp-filter]").forEach((tab) => tab.addEventListener("click", () => {
    state.mvpFilter = tab.dataset.mvpFilter || "all";
    renderMvpTable("groups");
    renderMvpTable("final", "finalMvpTable");
  }));
  document.querySelectorAll("[data-final-tab]").forEach((tab) => tab.addEventListener("click", () => {
    state.finalTab = tab.dataset.finalTab || "drop";
    renderFinal();
  }));
}

function resetGame() {
  if (!window.confirm("Resetar esta partida e voltar para a selecao de nome/time?")) return;
  resetCompetitionState(true);
  state.trophies = [];
  state.seasonsPlayed = 0;
  $("startScreen").classList.add("hidden");
  state.gameStarted = true;
  switchView("squadView");
  renderAll();
}

function resetCompetitionState(clearSquad = false) {
  state.currentDraw = null;
  state.rolling = false;
  state.refresh = 3;
  if (clearSquad) {
    state.squad = { players: [], coach: null, bench: [] };
    state.draftDone = false;
    state.teamName = "";
    state.managerName = "";
    state.setupConfirmed = false;
  state.sourceTeamName = "";
  state.sourceTeamEdition = "";
  state.historicalConfirmed = false;
    $("teamNameInput").value = "";
    $("managerNameInput").value = "";
  }
  state.groupTeams = [];
  state.groupRound = 0;
  state.groupMatch = 0;
  state.groupTab = "overall";
  state.groupsStarted = false;
  state.finalStarted = false;
  state.transferMoves = 0;
  state.transferWindowOpen = false;
  state.transferOutIndex = null;
  state.transferOutType = null;
  state.transferRefresh = 2;
  state.marketTeam = null;
  state.pendingTransfer = null;
  state.pendingMarketIndex = null;
  state.mvpStats = {};
  state.mapStats = {};
  state.matchHistory = [];
  state.finalists = [];
  state.finalMatch = 0;
  state.finalTab = "overall";
  state.champion = null;
  $("matchLog").innerHTML = "";
}

function startGameScreen() {
  state.gameStarted = true;
  $("startScreen").classList.add("hidden");
  switchView("squadView");
  renderAll();
}

function populateEditionSelect() {
  const select = $("editionSelect");
  const originalSelect = $("originalEditionSelect");
  if (!select || !originalSelect) return;
  const editions = [...new Set(state.tournaments.map((tournament) => tournament.edition))]
    .filter((edition) => /LBFF|WB|FFWS/i.test(edition));
  select.innerHTML = editions.map((edition, index) => {
    if (!state.selectedEdition && index === 0) state.selectedEdition = edition;
    return `<option value="${escapeAttr(edition)}">${escapeHtml(shortEdition(edition))}</option>`;
  }).join("");
  originalSelect.innerHTML = select.innerHTML;
  select.value = state.selectedEdition || editions[0] || "";
  state.originalEdition = state.originalEdition || state.selectedEdition || editions[0] || "";
  originalSelect.value = state.originalEdition;
  updateOriginalTeamOptions();
}

function updateManagerSetup() {
  state.teamName = clean($("teamNameInput").value) || "";
  state.managerName = clean($("managerNameInput").value) || "";
  state.difficulty = $("difficultySelect").value || "easy";
  state.gameMode = $("gameModeSelect").value || "draft";
  state.allowDuplicateTeams = Boolean($("duplicateTeamsInput").checked);
  state.selectedEdition = $("editionSelect").value || state.selectedEdition;
  state.originalEdition = $("originalEditionSelect").value || state.originalEdition;
  state.originalTeamKey = $("originalTeamSelect").value || state.originalTeamKey;
  state.autoBench = Boolean($("autoBenchInput").checked);
  if (state.gameMode !== "historical") state.historicalConfirmed = false;
  renderAll();
}

function confirmSetup() {
  updateManagerSetup();
  if (!managerReady()) {
    log("Coloque o nome do time e do manager antes de confirmar.");
    renderAll();
    return;
  }
  state.setupConfirmed = true;
  renderAll();
}

function updateOriginalTeamOptions() {
  const edition = $("originalEditionSelect").value || state.originalEdition;
  state.originalEdition = edition;
  const select = $("originalTeamSelect");
  const tournament = state.tournaments.find((item) => item.edition === edition);
  const teams = tournament?.teams || [];
  select.innerHTML = teams.map((team, index) => {
    const value = `${index}|${key(team.name)}`;
    return `<option value="${escapeAttr(value)}">${escapeHtml(team.name)} (${team.power} OVR)</option>`;
  }).join("");
  state.originalTeamKey = select.value || "";
  updateManagerSetup();
}

function selectedOriginalTeam() {
  const tournament = state.tournaments.find((item) => item.edition === state.originalEdition);
  if (!tournament) return null;
  const index = Number(String(state.originalTeamKey || "0").split("|")[0]);
  return tournament.teams[index] || null;
}

function useSelectedOriginalTeam() {
  if (!managerReady()) {
    log("Coloque o nome do time e do manager antes de escolher um elenco original.");
    renderDraw();
    return;
  }
  state.setupConfirmed = true;
  state.historicalConfirmed = true;
  pickOriginalTeam(selectedOriginalTeam());
}

function managerReady() {
  return Boolean(clean($("teamNameInput")?.value || state.teamName) && clean($("managerNameInput")?.value || state.managerName));
}

function setupReady() {
  return state.setupConfirmed || state.gameMode === "historical";
}

function randomTeam(exceptTeam, sameEdition = false) {
  const baseTournaments = state.gameMode === "specific" && state.selectedEdition
    ? state.tournaments.filter((t) => t.edition === state.selectedEdition)
    : state.tournaments.filter((t) => editionAllowed(t.edition));
  const editions = sameEdition && exceptTeam
    ? state.tournaments.filter((t) => t.edition === exceptTeam.edition)
    : baseTournaments;
  let pool = editions.flatMap((t) => t.teams).filter((team) => !exceptTeam || team !== exceptTeam);
  if (!pool.length) pool = state.tournaments.flatMap((t) => t.teams).filter((team) => !exceptTeam || team !== exceptTeam);
  return pool[rand(0, pool.length - 1)];
}

function rollAny() {
  if (state.gameMode === "historical" && !state.historicalConfirmed) return;
  if (!setupReady()) return renderDraw();
  if (!managerReady()) {
    log("Coloque o nome do time e do manager antes do sorteio.");
    renderDraw();
    return;
  }
  if (state.currentDraw && state.refresh <= 0) return;
  const hadDraw = Boolean(state.currentDraw);
  const nextTeam = randomTeam(state.currentDraw, false);
  if (hadDraw) state.refresh = Math.max(0, state.refresh - 1);
  animateDraw(nextTeam);
}

function rollSameEdition() {
  if (state.gameMode === "historical" && !state.historicalConfirmed) return;
  if (!setupReady()) return renderDraw();
  if (!managerReady()) {
    log("Coloque o nome do time e do manager antes do sorteio.");
    renderDraw();
    return;
  }
  if (!state.currentDraw || state.refresh <= 0) return;
  state.refresh--;
  animateDraw(randomTeam(state.currentDraw, true));
}

function autoNextTeam() {
  if (state.draftDone || rosterFull()) return renderDraw();
  animateDraw(randomTeam(state.currentDraw, false), true);
}

function animateDraw(nextTeam, automatic = false) {
  if (!nextTeam || state.rolling) return;
  state.rolling = true;
  const card = $("drawCard");
  card.classList.add("is-rolling");
  let ticks = 0;
  const pool = (state.gameMode === "specific" && state.selectedEdition
    ? state.tournaments.filter((t) => t.edition === state.selectedEdition)
    : state.tournaments.filter((t) => editionAllowed(t.edition))).flatMap((t) => t.teams);
  const timer = setInterval(() => {
    const previewPool = pool.length ? pool : state.tournaments.flatMap((t) => t.teams);
    const preview = previewPool[rand(0, previewPool.length - 1)];
    card.innerHTML = drawPreview(preview, automatic);
    ticks++;
    if (ticks >= 8) {
      clearInterval(timer);
      state.currentDraw = nextTeam;
      state.rolling = false;
      card.classList.remove("is-rolling");
      renderAll();
    }
  }, 70);
}

function pickPlayer(player) {
  if (state.rolling) return;
  const picked = withOrigin(player, state.currentDraw?.edition);
  if (state.squad.players.length < 4 && !hasPlayer(picked)) state.squad.players.push(picked);
  else if (state.squad.players.length >= 4 && state.squad.bench.length < 2 && !hasPlayer(picked)) state.squad.bench.push(picked);
  renderSquad();
  autoNextTeam();
}

function pickCoach(coach) {
  if (state.rolling) return;
  if (state.squad.coach) return renderDraw();
  state.squad.coach = withOrigin(coach, state.currentDraw?.edition);
  renderSquad();
  autoNextTeam();
}

function withOrigin(person, edition) {
  return { ...person, originEdition: person.originEdition || person.edition || edition || "" };
}

function hasPlayer(player) {
  return state.squad.players.some((p) => p.name === player.name) || state.squad.bench.some((p) => p.name === player.name);
}

function squadReady() {
  return state.squad.players.length === 4 && Boolean(state.squad.coach);
}

function rosterFull() {
  return squadReady() && state.squad.bench.length >= 2;
}

function squadComplete() {
  return state.draftDone;
}

function finishDraft() {
  if (!squadReady()) {
    log("Escolha 4 titulares e um coach antes de finalizar.");
    return;
  }
  state.draftDone = true;
  switchView("groupsView");
  renderAll();
}

function pickOriginalTeam(team) {
  if (!team || !managerReady()) return;
  state.squad.players = team.players.slice(0, 4).map((player) => withOrigin(player, team.edition));
  state.squad.bench = team.players.slice(4, 6).map((player) => withOrigin(player, team.edition));
  const coach = team.staff.find((person) => /coach/i.test(person.role)) || team.staff[0] || null;
  state.squad.coach = coach ? withOrigin(coach, team.edition) : null;
  state.sourceTeamName = team.name;
  state.sourceTeamEdition = team.edition;
  state.draftDone = squadReady();
  state.currentDraw = null;
  switchView("groupsView");
  renderAll();
  log(`${team.name} foi escolhido como elenco original.`);
}

function renderDraw() {
  const team = state.currentDraw;
  renderSetupMode();
  $("sidePanelTitle").textContent = squadComplete() ? "Seu elenco" : "Sorteio";
  $("refreshCount").textContent = squadComplete() ? `${userPower()} OVR` : `${state.refresh} refresh`;
  const waitingHistorical = state.gameMode === "historical" && !state.historicalConfirmed;
  const waitingSetup = !state.setupConfirmed && state.gameMode !== "historical";
  $("drawCard").style.display = waitingSetup ? "none" : "flex";
  $("drawButtons").style.display = (waitingSetup || squadComplete() || rosterFull() || waitingHistorical) ? "none" : "flex";
  $("managerSetup").style.display = (state.groupsStarted || state.setupConfirmed) ? "none" : "grid";
  $("draftHelp").textContent = squadComplete()
    ? "Elenco fechado. Troque reservas com titulares pelos botoes T1, T2, T3 e T4 na arena."
    : waitingSetup
      ? "Escolha o formato, coloque nome do time e manager, depois confirme para liberar o sorteio."
      : "Depois de cada escolha, outra equipe aparece automaticamente. Use refresh so quando quiser trocar o time sorteado.";
  $("editionSelect").disabled = state.gameMode !== "specific";
  $("rollAnyBtn").disabled = waitingSetup || waitingHistorical || state.rolling || !managerReady() || (team && state.refresh <= 0);
  $("rollEditionBtn").disabled = waitingSetup || waitingHistorical || state.rolling || !managerReady() || state.refresh <= 0 || !team;
  if (waitingSetup) return;
  if (state.rolling) return;
  if (waitingHistorical) {
    $("drawCard").innerHTML = `<div class="draw-empty">Escolha edicao e time historico acima, depois confirme para carregar o elenco.</div>`;
    return;
  }
  if (!team) {
    $("drawCard").innerHTML = `<div class="draw-empty">${managerReady() ? "Clique em sortear para revelar uma equipe." : "Digite o nome do time e do manager para liberar o sorteio."}</div>`;
    return;
  }
  if (squadComplete()) {
    $("drawCard").innerHTML = sideRosterHtml();
    bindRosterDrag();
    bindTransferControls();
    return;
  }
  const coachOptions = team.staff
    .map((person, index) => ({ person, index }))
    .filter(({ person }) => /coach/i.test(person.role))
    .slice(0, 2);
  const reserveMode = state.squad.players.length >= 4;
  const canPickPlayers = state.squad.players.length < 4 || state.squad.bench.length < 2;
  $("drawCard").innerHTML = `
    <div class="draw-team">
      <img src="${logoFor(team.name)}" alt="">
      <div>
        <h2>${team.name}</h2>
        <small>${shortEdition(team.edition || "-")}</small>
        <span class="draft-needs">${draftNeedsLabel()}</span>
      </div>
    </div>
    <div class="pick-list">
      ${canPickPlayers ? team.players.map((p, index) => pickHtml(p, reserveMode ? "Reserva" : "Jogador", index)).join("") : ""}
      ${state.squad.coach ? "" : coachOptions.map(({ person, index }) => pickHtml(person, "Coach", index)).join("")}
    </div>
    ${state.squad.players.length >= 4 ? `<button id="finishDraftBtn" class="primary">${state.squad.coach ? "Finalizar elenco" : "Finalizar com coach"}</button>` : ""}`;
  document.querySelectorAll("[data-pick-player]").forEach((btn) => btn.addEventListener("click", () => {
    pickPlayer(team.players[Number(btn.dataset.pickPlayer)]);
  }));
  document.querySelectorAll("[data-pick-coach]").forEach((btn) => btn.addEventListener("click", () => {
    pickCoach(team.staff[Number(btn.dataset.pickCoach)]);
  }));
  const finishBtn = $("finishDraftBtn");
  if (finishBtn) finishBtn.addEventListener("click", finishDraft);
}

function draftNeedsLabel() {
  const playersLeft = Math.max(0, 4 - state.squad.players.length);
  const benchLeft = Math.max(0, 2 - state.squad.bench.length);
  const parts = [];
  if (playersLeft) parts.push(`RESTA ${playersLeft} JOGADOR${playersLeft > 1 ? "ES" : ""}`);
  if (!state.squad.coach) parts.push("RESTA O COACH");
  if (benchLeft) parts.push(`RESTA ${benchLeft} RESERVA${benchLeft > 1 ? "S" : ""} (OPCIONAL)`);
  return parts.join(" · ") || "ELENCO PRONTO";
}

function renderSetupMode() {
  const historical = state.gameMode === "historical";
  $("originalPicker").style.display = historical ? "grid" : "none";
  $("confirmSetupBtn").style.display = historical ? "none" : "block";
  $("specificEditionWrap").style.display = state.gameMode === "specific" ? "grid" : "none";
}

function sideRosterHtml() {
  const starters = state.squad.players.map((player, index) => rosterLine(`T${index + 1}`, player)).join("");
  const bench = state.squad.bench.map((player, index) => rosterLine(`R${index + 1}`, player)).join("");
  const coach = state.squad.coach ? rosterLine("CO", state.squad.coach) : "";
  return `
    <div class="side-roster">
      <div class="side-roster-block">
        <h3>Titulares</h3>
        ${starters}
      </div>
      <div class="side-roster-block">
        <h3>Comissao</h3>
        ${coach}
      </div>
      <div class="side-roster-block">
        <h3>Reservas</h3>
        ${bench || `<div class="draw-empty">Sem reservas</div>`}
      </div>
    </div>`;
}

function rosterLine(label, person) {
  const type = label.startsWith("T") ? "starter" : label.startsWith("R") ? "bench" : "coach";
  const index = Number(label.slice(1)) - 1;
  const drag = type === "bench" ? "draggable=\"true\"" : "";
  return `<div class="roster-line${eliteClass(person.overall)}" ${drag} data-roster-type="${type}" data-roster-index="${Number.isFinite(index) ? index : 0}">
    <span>${label}</span>
    <strong>${escapeHtml(person.name)}</strong>
    <small>${rosterPersonMeta(person, type)}</small>
  </div>`;
}

function rosterPersonMeta(person, type = "player") {
  const edition = shortEdition(person.originEdition || person.edition || "-");
  const stats = type === "coach" ? null : effectivePlayerStats(person.name, person.originEdition || person.edition || "");
  const data = stats ? `${Number(stats.k || 0)} abates/${Number(stats.q || 0)} quedas` : "sem K/Q";
  return `${type === "coach" ? "coach" : person.role || "player"} | OVR ${overallLabel(person.overall)} | ${edition}${type === "coach" ? "" : ` | ${data}`}`;
}

function bindRosterDrag() {
  document.querySelectorAll("[data-roster-type='bench']").forEach((item) => {
    item.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("application/wb-bench", item.dataset.rosterIndex);
    });
  });
  document.querySelectorAll("[data-roster-type='starter']").forEach((item) => {
    item.addEventListener("dragover", (event) => event.preventDefault());
    item.addEventListener("drop", (event) => {
      event.preventDefault();
      const benchRaw = event.dataTransfer.getData("application/wb-bench");
      const benchIndex = benchRaw === "" ? NaN : Number(benchRaw);
      const starterIndex = Number(item.dataset.rosterIndex);
      if (Number.isFinite(benchIndex) && Number.isFinite(starterIndex)) swapBench(benchIndex, starterIndex);
    });
  });
}

function transferMarketHtml() {
  if (!state.transferWindowOpen) return "";
  if (state.transferMoves >= 2) {
    return `<div class="side-roster-block"><h3>Transferencias</h3><div class="draw-empty">Janela encerrada: 2/2 trocas usadas.</div></div>`;
  }
  if (!state.marketTeam) state.marketTeam = randomTeam(null, false);
  const candidates = marketCandidates();
  const pending = state.pendingTransfer ? transferConfirmHtml() : "";
  return `
    <div class="side-roster-block transfer-market">
      <h3>Transferencias ${state.transferMoves}/2</h3>
      <div class="transfer-out">
        ${state.squad.players.map((player, index) => `<button data-transfer-out-type="starter" data-transfer-out="${index}" class="${state.transferOutType === "starter" && state.transferOutIndex === index ? "selected" : ""}">Sai T${index + 1}: ${player.name}</button>`).join("")}
        ${state.squad.coach ? `<button data-transfer-out-type="coach" data-transfer-out="0" class="${state.transferOutType === "coach" ? "selected" : ""}">Sai CO: ${state.squad.coach.name}</button>` : ""}
        ${state.squad.bench.map((player, index) => `<button data-transfer-out-type="bench" data-transfer-out="${index}" class="${state.transferOutType === "bench" && state.transferOutIndex === index ? "selected" : ""}">Sai R${index + 1}: ${player.name}</button>`).join("")}
      </div>
      <div class="transfer-bench-drop" data-transfer-bench-drop>
        Comprar para banco: ${state.squad.bench.length}/2 reservas
      </div>
      ${pending}
      <div class="draw-team">
        <img src="${logoFor(state.marketTeam.name)}" alt="">
        <div><h2>${state.marketTeam.name}</h2><small>${shortEdition(state.marketTeam.edition)}</small></div>
      </div>
      <div class="pick-list">
        ${candidates.map(({ person, kind }, index) => `<div class="pick${kind === "coach" ? " pick-coach" : ""}${eliteClass(person.overall)} ${state.pendingMarketIndex === index ? "selected-market" : ""}" draggable="${kind === "player"}" data-market-player="${index}"><div><button class="market-name" data-transfer-player="${index}">${escapeHtml(person.name)}</button><span>${transferPersonMeta(person, kind)}${state.pendingMarketIndex === index ? " - selecionado" : ""}</span></div><div class="transfer-actions"><button data-transfer-player="${index}" class="${eliteClass(person.overall).trim()}">${overallLabel(person.overall)}</button>${kind === "player" && state.squad.bench.length < 2 ? `<button data-buy-bench="${index}">Comprar banco</button>` : ""}</div></div>`).join("")}
      </div>
      <button id="refreshMarketBtn">Atualizar mercado (${state.transferRefresh})</button>
    </div>`;
}

function marketCandidates() {
  const players = (state.marketTeam?.players || []).slice(0, 5).map((person) => ({ person: withOrigin(person, state.marketTeam.edition), kind: "player" }));
  const coaches = (state.marketTeam?.staff || [])
    .filter((person) => /coach|trein/i.test(person.role || ""))
    .slice(0, 1)
    .map((person) => ({ person: withOrigin(person, state.marketTeam.edition), kind: "coach" }));
  return [...players, ...coaches];
}

function transferPersonMeta(person, kind = "player") {
  const edition = shortEdition(person.originEdition || person.edition || state.marketTeam?.edition || "-");
  if (kind === "coach") return `COACH - OVR ${overallLabel(person.overall)} - ${edition}`;
  const stats = effectivePlayerStats(person.name, person.originEdition || person.edition || state.marketTeam?.edition || "");
  const data = stats ? `${Number(stats.k || 0)} abates / ${Number(stats.q || 0)} quedas` : "0 abates / 0 quedas";
  return `${person.role || "player"} - OVR ${overallLabel(person.overall)} - ${edition} - ${data}`;
}

function transferConfirmHtml() {
  const pending = state.pendingTransfer;
  const candidateItem = marketCandidates()[pending.candidateIndex];
  const candidate = candidateItem?.person;
  if (!candidate) return "";
  const outgoing = pending.type === "buy" ? null : outgoingSquadMember(pending.type, pending.outIndex);
  const action = pending.type === "buy"
    ? `Comprar ${candidate.name} para o banco?`
    : `Vender ${outgoing?.name || "-"} e contratar ${candidate.name}?`;
  return `<div class="transfer-confirm">
    <strong>${escapeHtml(action)}</strong>
    <small>${pending.type === "buy" ? "Ocupa uma vaga de reserva." : `${pending.type === "bench" ? "Reserva" : "Titular"} sai do elenco.`}</small>
    <div><button data-confirm-transfer class="primary">Confirmar</button><button data-cancel-transfer>Cancelar</button></div>
  </div>`;
}

function outgoingSquadMember(type, index) {
  if (type === "bench") return state.squad.bench[index];
  if (type === "coach") return state.squad.coach;
  return state.squad.players[index];
}

function renderTransferBoard() {
  const board = $("transferBoard");
  if (!board) return;
  if (state.finalStarted) {
    board.innerHTML = `<div class="champion-banner">Janela encerrada. Na final nao pode fazer transferencias.</div>`;
    return;
  }
  if (!state.groupsStarted && !state.transferWindowOpen) {
    board.innerHTML = `<div class="champion-banner">Inicie os grupos para liberar a janela depois da rodada 11.</div>`;
    return;
  }
  if (!state.transferWindowOpen) {
    board.innerHTML = `<div class="champion-banner">Janela fechada. Ela abre apos a rodada 11. Rodada atual: ${state.groupRound}/20.</div>`;
    return;
  }
  board.innerHTML = transferMarketHtml();
  bindTransferControls();
}

function rollMarket() {
  if (!state.transferWindowOpen || state.transferRefresh <= 0 || state.transferMoves >= 2) return;
  state.marketTeam = randomTeam(state.marketTeam, false);
  state.pendingTransfer = null;
  state.pendingMarketIndex = null;
  state.transferRefresh--;
  renderAll();
}

function bindTransferControls() {
  document.querySelectorAll("[data-market-player]").forEach((item) => {
    item.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("application/wb-market", item.dataset.marketPlayer);
    });
  });
  document.querySelectorAll(".slot.player").forEach((slot) => {
    slot.ondragover = (event) => event.preventDefault();
    slot.ondrop = (event) => {
      const candidateRaw = event.dataTransfer.getData("application/wb-market");
      const candidateIndex = candidateRaw === "" ? NaN : Number(candidateRaw);
      if (Number.isFinite(candidateIndex)) {
        event.preventDefault();
        state.transferOutIndex = Number(slot.dataset.slotIndex);
        state.transferOutType = "starter";
        transferPlayer(candidateIndex);
        return;
      }
      const benchRaw = event.dataTransfer.getData("application/wb-bench");
      const benchIndex = benchRaw === "" ? NaN : Number(benchRaw);
      const starterIndex = Number(slot.dataset.slotIndex);
      if (Number.isFinite(benchIndex) && Number.isFinite(starterIndex)) swapBench(benchIndex, starterIndex);
    };
  });
  document.querySelectorAll(".slot.bench").forEach((slot) => {
    slot.ondragover = (event) => event.preventDefault();
    slot.ondrop = (event) => {
      const candidateRaw = event.dataTransfer.getData("application/wb-market");
      const candidateIndex = candidateRaw === "" ? NaN : Number(candidateRaw);
      if (Number.isFinite(candidateIndex)) buyBench(candidateIndex);
    };
  });
  document.querySelectorAll("[data-transfer-bench-drop]").forEach((zone) => {
    zone.ondragover = (event) => event.preventDefault();
    zone.ondrop = (event) => {
      event.preventDefault();
      const candidateRaw = event.dataTransfer.getData("application/wb-market");
      const candidateIndex = candidateRaw === "" ? NaN : Number(candidateRaw);
      if (Number.isFinite(candidateIndex)) buyBench(candidateIndex);
    };
  });
  document.querySelectorAll("[data-transfer-out]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.transferOutIndex = Number(btn.dataset.transferOut);
      state.transferOutType = btn.dataset.transferOutType || "starter";
      state.pendingTransfer = null;
      if (Number.isFinite(state.pendingMarketIndex)) {
        prepareTransfer(state.pendingMarketIndex, state.transferOutType, state.transferOutIndex);
      }
      renderAll();
    });
  });
  document.querySelectorAll("[data-transfer-player]").forEach((btn) => {
    btn.addEventListener("click", () => transferPlayer(Number(btn.dataset.transferPlayer)));
  });
  document.querySelectorAll("[data-buy-bench]").forEach((btn) => {
    btn.addEventListener("click", () => buyBench(Number(btn.dataset.buyBench)));
  });
  document.querySelectorAll("[data-confirm-transfer]").forEach((btn) => {
    btn.addEventListener("click", applyPendingTransfer);
  });
  document.querySelectorAll("[data-cancel-transfer]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.pendingTransfer = null;
      renderAll();
    });
  });
  const refreshMarketBtn = $("refreshMarketBtn");
  if (refreshMarketBtn) refreshMarketBtn.addEventListener("click", () => {
    rollMarket();
  });
}

function buyBench(candidateIndex) {
  if (!state.transferWindowOpen || state.transferMoves >= 2) return;
  const candidateItem = marketCandidates()[candidateIndex];
  const candidate = candidateItem?.person;
  if (candidateItem?.kind !== "player" || !candidate || hasPlayer(candidate)) return;
  if (state.squad.bench.length >= 2) {
    if (state.transferOutType === "bench" && Number.isFinite(state.transferOutIndex)) {
      state.pendingTransfer = { type: "bench", outIndex: state.transferOutIndex, candidateIndex };
      renderAll();
      return;
    }
    log("Banco cheio. Selecione um Sai R para vender uma reserva, ou arraste para um titular.");
    return;
  }
  state.pendingTransfer = { type: "buy", outIndex: null, candidateIndex };
  renderAll();
}

function transferPlayer(candidateIndex) {
  if (!state.transferWindowOpen || state.transferMoves >= 2) return;
  state.pendingMarketIndex = candidateIndex;
  if (state.transferOutIndex === null) {
    log("Mercado selecionado. Agora escolha quem sai do seu time.");
    renderAll();
    return;
  }
  prepareTransfer(candidateIndex, state.transferOutType || "starter", state.transferOutIndex);
  renderAll();
}

function prepareTransfer(candidateIndex, outType, outIndex) {
  const candidateItem = marketCandidates()[candidateIndex];
  const candidate = candidateItem?.person;
  if (!candidate) return;
  if (candidateItem.kind === "coach" && outType !== "coach") {
    log("Coach do mercado so pode entrar no lugar do seu coach.");
    return;
  }
  if (candidateItem.kind === "player" && outType === "coach") {
    log("Jogador do mercado nao pode substituir coach.");
    return;
  }
  if (candidateItem.kind === "player" && hasPlayer(candidate)) return;
  if (candidateItem.kind === "coach" && state.squad.coach?.name === candidate.name) return;
  state.pendingTransfer = { type: outType, outIndex, candidateIndex };
}

function applyPendingTransfer() {
  const pending = state.pendingTransfer;
  const candidateItem = marketCandidates()[pending?.candidateIndex];
  if (!pending || !candidateItem?.person || state.transferMoves >= 2) return;
  const candidate = candidateItem.person;
  if (candidateItem.kind === "player" && hasPlayer(candidate)) {
    state.pendingTransfer = null;
    renderAll();
    return;
  }
  let outgoing = null;
  if (pending.type === "buy") {
    if (state.squad.bench.length >= 2) return;
    state.squad.bench.push(candidate);
  } else if (pending.type === "bench") {
    outgoing = state.squad.bench[pending.outIndex];
    state.squad.bench[pending.outIndex] = candidate;
  } else if (pending.type === "coach") {
    outgoing = state.squad.coach;
    state.squad.coach = candidate;
  } else {
    outgoing = state.squad.players[pending.outIndex];
    state.squad.players[pending.outIndex] = candidate;
  }
  state.transferMoves++;
  state.transferOutIndex = null;
  state.transferOutType = null;
  state.pendingTransfer = null;
  state.pendingMarketIndex = null;
  syncUserTeamRoster();
  log(pending.type === "buy"
    ? `Transferencia ${state.transferMoves}/2: ${candidate.name} foi contratado para a reserva.`
    : `Transferencia ${state.transferMoves}/2: ${candidate.name} entrou no lugar de ${outgoing?.name || "-"}.`);
  renderAll();
}

function drawPreview(team, automatic) {
  return `
    <div class="draw-empty">
      <div class="draw-team">
        <img src="${logoFor(team.name)}" alt="">
        <div><h2>${team.name}</h2><small>${automatic ? "proxima equipe" : team.edition}</small></div>
      </div>
    </div>`;
}

function pickHtml(person, type, idx) {
  const isPlayerPick = type === "Jogador" || type === "Reserva";
  const attr = isPlayerPick ? `data-pick-player="${idx}"` : `data-pick-coach="${idx}"`;
  const selected = isPlayerPick ? hasPlayer(person) : state.squad.coach?.name === person.name;
  return `<div class="pick ${isPlayerPick ? "" : "pick-coach"}${eliteClass(person.overall)}" ${selected ? "" : attr}><div><b>${person.name}</b><span>${type} ${person.role ? `- ${person.role}` : ""}</span></div><button class="${eliteClass(person.overall).trim()}" ${selected ? "disabled" : ""}>${overallLabel(person.overall)}</button></div>`;
}

function renderAll() {
  renderDraw();
  renderSquad();
  renderTransferBoard();
  renderGroupsV2();
  renderFinal();
  renderSplitSummary();
  renderAdminPanel();
  renderStageLocks();
}

function renderSquad() {
  const slots = document.querySelectorAll(".slot");
  slots.forEach((slot, index) => {
    const labels = ["Titular 1", "Titular 2", "Titular 3", "Titular 4", "Coach", "Reserva", "Reserva"];
    slot.innerHTML = `<span>${labels[index]}</span>`;
    slot.classList.remove("elite-overall");
    delete slot.dataset.slotType;
    delete slot.dataset.slotIndex;
    slot.removeAttribute?.("draggable");
  });
  state.squad.players.forEach((p, i) => {
    slots[i].dataset.slotType = "starter";
    slots[i].dataset.slotIndex = i;
    slots[i].classList.toggle("elite-overall", p.overall >= 92);
    slots[i].innerHTML = `<span>${p.name}<small>${p.role || "player"} | OVR ${overallLabel(p.overall)}</small></span>`;
  });
  if (state.squad.coach) {
    slots[4].classList.toggle("elite-overall", state.squad.coach.overall >= 92);
    slots[4].innerHTML = `<span>${state.squad.coach.name}<small>coach | OVR ${overallLabel(state.squad.coach.overall)}</small></span>`;
  }
  state.squad.bench.forEach((p, i) => {
    slots[5 + i].dataset.slotType = "bench";
    slots[5 + i].dataset.slotIndex = i;
    slots[5 + i].setAttribute("draggable", state.draftDone ? "true" : "false");
    slots[5 + i].classList.toggle("elite-overall", p.overall >= 92);
    slots[5 + i].innerHTML = `<span>${p.name}<small>${p.role || "player"} | OVR ${overallLabel(p.overall)}</small>${swapButtons(i)}</span>`;
  });
  document.querySelectorAll("[data-swap]").forEach((btn) => btn.addEventListener("click", () => swapBench(Number(btn.dataset.swap), Number(btn.dataset.starter))));
  bindArenaDrag();
  const size = state.squad.players.length + state.squad.bench.length + (state.squad.coach ? 1 : 0);
  $("teamSize").textContent = `${size}/7`;
  $("teamOverall").textContent = size ? userPower() : "--";
  $("benchCount").textContent = `${state.squad.bench.length}/2`;
  $("autoBenchInput").checked = state.autoBench;
}

function bindArenaDrag() {
  document.querySelectorAll(".slot.bench[draggable='true']").forEach((slot) => {
    slot.ondragstart = (event) => {
      event.dataTransfer.setData("application/wb-bench", slot.dataset.slotIndex);
    };
  });
  document.querySelectorAll(".slot.player").forEach((slot) => {
    slot.ondragover = (event) => event.preventDefault();
    slot.ondrop = (event) => {
      event.preventDefault();
      const benchIndex = Number(event.dataTransfer.getData("application/wb-bench"));
      const starterIndex = Number(slot.dataset.slotIndex);
      if (Number.isFinite(benchIndex) && Number.isFinite(starterIndex)) swapBench(benchIndex, starterIndex);
    };
  });
}

function swapButtons(benchIndex) {
  if (!state.draftDone) return "";
  return `<div>${state.squad.players.map((_, starterIndex) => `<button data-swap="${benchIndex}" data-starter="${starterIndex}">T${starterIndex + 1}</button>`).join("")}</div>`;
}

function swapBench(benchIndex, starterIndex) {
  const bench = state.squad.bench[benchIndex];
  state.squad.bench[benchIndex] = state.squad.players[starterIndex];
  state.squad.players[starterIndex] = bench;
  if (state.groupsStarted) syncUserTeamRoster();
  renderAll();
  log(`Troca feita: reserva ${bench.name} entrou na titularidade.`);
}

function userPower() {
  return rosterPower(state.squad.players, state.squad.coach);
}

function makeUserTeam() {
  const userId = `user-${Date.now()}`;
  return {
    id: userId,
    name: state.teamName || "SEU ELENCO",
    manager: state.managerName || "Manager",
    edition: "DRAFT",
    group: "A",
    players: state.squad.players.map((player, index) => rosterPerson(player, userId, "DRAFT", index)),
    staff: state.squad.coach ? [state.squad.coach] : [],
    power: userPower(),
    points: 0,
    booyahs: 0,
    kills: 0,
    drops: 0,
    cp: false,
    user: true
  };
}

function startGroups() {
  if (state.groupsStarted) return;
  if (!squadReady()) {
    log("Escolha 4 titulares e um coach antes de iniciar os grupos. Reservas sao opcionais.");
    return;
  }
  state.draftDone = true;
  const pool = selectOpponentPool();
  state.groupTeams = [makeUserTeam(), ...pool.slice(0, 15).map(cloneTeam)];
  state.groupTeams.forEach((team, index) => { team.group = String.fromCharCode(65 + (index % 4)); });
  state.groupRound = 0;
  state.groupMatch = 0;
  state.groupsStarted = true;
  state.transferMoves = 0;
  state.transferWindowOpen = false;
  state.transferOutIndex = null;
  state.transferOutType = null;
  state.transferRefresh = 2;
  state.marketTeam = null;
  state.pendingTransfer = null;
  state.pendingMarketIndex = null;
  state.mvpStats = {};
  state.mapStats = {};
  state.matchHistory = [];
  switchView("groupsView");
  log("Fase de grupos iniciada. Todos os grupos somam na mesma classificacao geral.");
  renderAll();
}

function selectOpponentPool() {
  let tournamentPool = state.gameMode === "specific" && state.selectedEdition
    ? state.tournaments.filter((tournament) => tournament.edition === state.selectedEdition)
    : state.tournaments.filter((tournament) => editionAllowed(tournament.edition));
  let all = tournamentPool
    .flatMap((t) => t.teams)
    .filter((t) => key(t.name) !== key(state.teamName))
    .filter((t) => !(state.sourceTeamName && teamsMatch(t.name, state.sourceTeamName) && normalizeEditionKey(t.edition) === normalizeEditionKey(state.sourceTeamEdition)));
  if (all.length < 15) {
    const selected = new Set(all);
    const extra = state.tournaments.flatMap((t) => t.teams).filter((team) => !selected.has(team) && key(team.name) !== key(state.teamName));
    all = [...all, ...extra];
  }
  if (state.difficulty === "hard") {
    return maybeUniqueTeamPool([...all].sort((a, b) => b.power - a.power));
  }
  if (state.difficulty === "champions") {
    const byEdition = {};
    [...all].sort((a, b) => b.power - a.power).forEach((team) => {
      byEdition[team.edition] ||= [];
      byEdition[team.edition].push(team);
    });
    const champions = Object.values(byEdition).map((teams) => teams[0]);
    const rest = all.filter((team) => !champions.includes(team)).sort((a, b) => b.power - a.power);
    return maybeUniqueTeamPool([...champions, ...rest]);
  }
  return maybeUniqueTeamPool(shuffle(all));
}

function maybeUniqueTeamPool(teams) {
  return state.allowDuplicateTeams ? teams : uniqueTeamPool(teams);
}

function uniqueTeamPool(teams) {
  const seen = new Set();
  [state.teamName, state.sourceTeamName].filter(Boolean).forEach((name) => {
    teamKeys(name).forEach((value) => seen.add(value));
  });
  return teams.filter((team) => {
    const keys = teamKeys(team.name);
    if ([...keys].some((value) => seen.has(value))) return false;
    keys.forEach((value) => seen.add(value));
    return true;
  });
}

function cloneTeam(team) {
  const id = `${key(team.edition)}-${key(team.name)}-${Math.random().toString(36).slice(2)}`;
  return {
    ...team,
    id,
    players: (team.players || []).map((player, index) => rosterPerson(player, id, team.edition, index)),
    staff: (team.staff || []).map((person) => ({ ...person })),
    points: 0,
    booyahs: 0,
    kills: 0,
    drops: 0,
    cp: false,
    user: false,
    power: team.power || rosterPower(team.players, team.staff[0])
  };
}

function rosterPerson(person, teamId, edition, slot) {
  return {
    ...person,
    statId: `${teamId}|${normalizeEditionKey(edition)}|${key(person.name)}`,
    originEdition: edition
  };
}

function syncUserTeamRoster() {
  const users = [state.groupTeams.find((team) => team.user), state.finalists.find((team) => team.user)].filter(Boolean);
  users.forEach((user) => {
    user.players = state.squad.players.map((player, index) => rosterPerson(player, user.id, player.originEdition || user.edition || "DRAFT", index));
    user.staff = state.squad.coach ? [state.squad.coach] : [];
    user.power = userPower();
  });
}

function simGroups(count) {
  if (!state.groupsStarted) startGroups();
  if (!state.groupsStarted) return;
  for (let i = 0; i < count && state.groupMatch < 120; i++) {
    const lobby = currentDayLobby();
    playMatch(lobby, "groups");
    state.groupMatch++;
    state.groupRound = Math.ceil(state.groupMatch / 6);
    if (state.groupMatch % 6 === 0) endGroupDay();
    if (state.groupRound >= 11) state.transferWindowOpen = true;
  }
  if (state.groupMatch >= 120 && !state.finalStarted) {
    log("Aviso: classificatoria encerrada. A Grande Final foi gerada automaticamente com os 12 melhores.");
    startFinal();
    return;
  }
  renderAll();
}

function matchesLeftInGroupDay() {
  if (!state.groupsStarted) return 6;
  return Math.max(1, 6 - (state.groupMatch % 6 || 0));
}

function matchesLeftInFinalDay() {
  if (!state.finalStarted) return 8;
  const inDay = state.finalMatch % 8;
  return Math.max(1, 8 - inDay);
}

function currentDayLobby() {
  const dayIndex = Math.min(19, Math.floor(state.groupMatch / 6));
  const activeGroups = GROUP_SCHEDULE[dayIndex] || "ABC";
  return state.groupTeams.filter((team) => activeGroups.includes(team.group)).slice(0, 12);
}

function startFinal() {
  if (state.finalStarted) return;
  if (!groupsFinished()) {
    log("Finalize os grupos primeiro. A final libera apenas quando a classificacao chegar em 120/120 quedas.");
    switchView("groupsView");
    renderAll();
    return;
  }
  state.finalists = standings(state.groupTeams).slice(0, 12).map((t) => ({ ...t, points: 0, booyahs: 0, kills: 0, drops: 0, cp: false }));
  state.finalMatch = 0;
  state.finalStarted = true;
  state.transferWindowOpen = false;
  state.pendingTransfer = null;
  state.finalTab = "overall";
  state.champion = null;
  switchView("finalView");
  log("Grande Final aberta com os 12 melhores da classificacao. Transferencias fechadas. Champion Rush Point em 160.");
  renderAll();
}

function simFinal(count) {
  if (!state.finalists.length) startFinal();
  if (!state.finalists.length) return;
  const hadChampion = Boolean(state.champion);
  for (let i = 0; i < count && state.finalMatch < 16 && !state.champion; i++) {
    const beforeEligible = new Set(state.finalists.filter((t) => t.cp).map((t) => t.name));
    const result = playMatch(state.finalists, "final");
    state.finalMatch++;
    const winner = result[0];
    state.finalists.forEach((t) => { if (t.points >= 160) t.cp = true; });
    if (beforeEligible.has(winner.name)) {
      state.champion = winner;
      log(`${winner.name} fechou o Champion Rush com Booyah na queda ${state.finalMatch}.`);
    }
  }
  if (!state.champion && state.finalMatch >= 16) {
    state.champion = standings(state.finalists)[0];
    log(`${state.champion.name} venceu por pontos depois das 16 quedas.`);
  }
  if (!hadChampion && state.champion) {
    recordSeasonTrophy();
    switchView("splitView");
  }
  renderAll();
}

function recordSeasonTrophy() {
  if (!state.champion || state.trophies.some((item) => item.season === state.seasonsPlayed + 1)) return;
  state.seasonsPlayed++;
  const userFinal = state.finalists.find((team) => team.user);
  const finalRows = standings(state.finalists);
  const groupRows = standings(state.groupTeams);
  state.trophies.push({
    season: state.seasonsPlayed,
    champion: state.champion.name,
    userChampion: Boolean(userFinal && state.champion.id === userFinal.id),
    userGroupPos: groupRows.findIndex((team) => team.user) + 1,
    userFinalPos: userFinal ? finalRows.findIndex((team) => team.id === userFinal.id) + 1 : 0
  });
}

function playMatch(teams, phase = "groups") {
  const template = state.dropTemplates?.length ? state.dropTemplates[rand(0, state.dropTemplates.length - 1)] : null;
  const matchNumber = phase === "final" ? state.finalMatch : state.groupMatch;
  const map = MAPS[Math.floor((phase === "final" ? state.finalMatch / 8 : state.groupMatch / 6)) % MAPS.length];
  const ranked = teams.map((team) => ({
    team,
    score: team.power + rand(-26, 26) + Math.random() * 28
  })).sort((a, b) => b.score - a.score).map((x) => x.team);

  const results = [];
  ranked.forEach((team, idx) => {
    const pos = idx + 1;
    const baseKills = template?.[idx]?.kills ?? Math.max(0, Math.round(9 - idx * .7));
    const powerDelta = Math.round((team.power - 82) / 22);
    const stageFactor = teams.length === 12 ? .78 : .74;
    const killCap = teams.length === 12 ? 14 : 15;
    const kills = Math.min(killCap, Math.max(0, Math.round(baseKills * stageFactor) + powerDelta + rand(-1, 2)));
    team.points += (POINTS[pos] || 0) + kills;
    team.booyahs += pos === 1 ? 1 : 0;
    team.kills = (team.kills || 0) + kills;
    team.drops = (team.drops || 0) + 1;
    recordTeamMapStats(team, map, phase, kills, pos === 1, (POINTS[pos] || 0) + kills);
    recordPlayerStats(team, kills, pos === 1, map, phase);
    results.push({ team: team.name, teamId: team.id, pos, kills, points: (POINTS[pos] || 0) + kills, booyah: pos === 1 });
  });

  state.matchHistory.push({ phase, match: matchNumber + 1, map, results });
  const userInLobby = teams.some((team) => team.user);
  log(`${userInLobby ? "" : "Simulando outros confrontos. "}<b>${map}</b>: Booyah de <b>${ranked[0].name}</b>, top 3 ${ranked.slice(0, 3).map((t) => t.name).join(", ")}.`);
  return ranked;
}

function recordTeamMapStats(team, map, phase, kills, booyah, points) {
  const id = `${phase}|${team.id || team.name}|${map}`;
  state.mapStats[id] ||= { phase, map, team: team.name, teamId: team.id || team.name, points: 0, kills: 0, booyahs: 0, drops: 0 };
  state.mapStats[id].points += points;
  state.mapStats[id].kills += kills;
  state.mapStats[id].booyahs += booyah ? 1 : 0;
  state.mapStats[id].drops += 1;
}

function recordPlayerStats(team, teamKills, booyah, map, phase) {
  const roster = team.players?.length ? team.players.slice(0, 4) : [];
  if (!roster.length) return;
  const template = state.mvpTemplates?.length ? state.mvpTemplates[rand(0, state.mvpTemplates.length - 1)] : [];
  const shares = distributePlayerKills(roster, teamKills);
  const matchRows = [];
  roster.forEach((player, index) => {
    const share = shares[index] || 0;
    const sample = template[index] || {};
    const id = player.statId || `${team.id || team.name}|${normalizeEditionKey(team.edition)}|${index}|${key(player.name)}`;
    state.mvpStats[id] ||= {
      id,
      player: player.name,
      team: team.name,
      teamId: team.id || team.name,
      origin: `${team.name} - ${shortEdition(team.edition || player.originEdition || "-")}`,
      kills: 0,
      damage: 0,
      assists: 0,
      drops: 0,
      mvps: 0,
      phases: {},
      maps: {}
    };
    state.mvpStats[id].kills += share;
    const damage = Math.max(0, Math.round((sample.damage || 900) * Math.max(.4, share / Math.max(1, sample.kills || 2))));
    const assists = Math.max(0, Math.round((sample.assists || 1) * Math.random()));
    state.mvpStats[id].damage += damage;
    state.mvpStats[id].assists += assists;
    state.mvpStats[id].drops += 1;
    state.mvpStats[id].phases[phase] ||= { kills: 0, damage: 0, assists: 0, drops: 0, mvps: 0 };
    state.mvpStats[id].phases[phase].kills += share;
    state.mvpStats[id].phases[phase].damage += damage;
    state.mvpStats[id].phases[phase].assists += assists;
    state.mvpStats[id].phases[phase].drops += 1;
    state.mvpStats[id].maps[`${phase}|${map}`] ||= { phase, map, kills: 0, drops: 0 };
    state.mvpStats[id].maps[`${phase}|${map}`].kills += share;
    state.mvpStats[id].maps[`${phase}|${map}`].drops += 1;
    matchRows.push({ id, share, damage });
  });
  const mvpRow = matchRows.sort((a, b) => b.share - a.share || b.damage - a.damage || Math.random() - .5)[0];
  const mvp = mvpRow ? state.mvpStats[mvpRow.id] : null;
  if (booyah && mvp) {
    mvp.mvps += 1;
    mvp.phases[phase] ||= { kills: 0, damage: 0, assists: 0, drops: 0, mvps: 0 };
    mvp.phases[phase].mvps += 1;
  }
}

function endGroupDay() {
  if (!state.autoBench || !state.squad.bench.length) return;
  const user = state.groupTeams.find((team) => team.user);
  if (!user) return;
  const dayStart = Math.max(0, state.groupMatch - 6);
  const playedToday = state.matchHistory.filter((match) => match.phase === "groups" && match.match > dayStart && match.results.some((row) => row.teamId === user.id));
  if (!playedToday.length) return;
  const playerRows = Object.values(state.mvpStats).filter((row) => row.teamId === user.id);
  const weakest = state.squad.players
    .map((player, index) => {
      const row = playerRows.find((item) => key(item.player) === key(player.name));
      return { index, kills: row?.kills || 0, drops: row?.drops || 0 };
    })
    .sort((a, b) => (a.kills / Math.max(1, a.drops)) - (b.kills / Math.max(1, b.drops)))[0];
  if (!weakest || !state.squad.bench[0]) return;
  const original = state.squad.players[weakest.index];
  const bench = state.squad.bench[0];
  state.squad.players[weakest.index] = bench;
  state.squad.bench[0] = original;
  syncUserTeamRoster();
  log(`Banco automatico: ${bench.name} entra no lugar de ${original.name} para o proximo dia.`);
}

function distributePlayerKills(roster, teamKills) {
  if (!teamKills || !roster.length) return roster.map(() => 0);
  const cap = teamKills <= 3 ? 2 : teamKills <= 8 ? 4 : 6;
  const activeCount = Math.max(1, Math.min(roster.length, teamKills <= 2 ? 2 : teamKills <= 5 ? 3 : rand(3, 4)));
  const activeIndexes = shuffle(roster.map((_, index) => index)).slice(0, activeCount);
  const weights = roster.map((player, index) => {
    if (!activeIndexes.includes(index)) return 0;
    const rating = Math.max(65, Math.min(99, Number(player.overall || 70)));
    const eliteBonus = rating >= 98 ? 1.14 : rating >= 94 ? 1.09 : rating >= 90 ? 1.04 : 1;
    return (1 + ((rating - 65) / 34) * .82) * eliteBonus * (0.66 + Math.random() * 0.72);
  });
  const total = weights.reduce((sum, value) => sum + value, 0) || 1;
  const raw = weights.map((weight) => (teamKills * weight) / total);
  const shares = raw.map((value) => Math.min(cap, Math.floor(value)));
  let remaining = teamKills - shares.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, value: value - Math.floor(value), weight: weights[index] }))
    .sort((a, b) => b.value - a.value || b.weight - a.weight);
  let guard = 0;
  while (remaining > 0 && guard < 80) {
    const candidate = order[guard % order.length];
    if (shares[candidate.index] < cap) {
      shares[candidate.index]++;
      remaining--;
    }
    guard++;
    if (guard >= order.length && shares.every((value) => value >= cap)) break;
  }
  for (let i = 0; remaining > 0; i = (i + 1) % shares.length) {
    shares[i]++;
    remaining--;
  }
  return shares;
}

function standings(teams) {
  return [...teams].sort((a, b) => b.points - a.points || b.booyahs - a.booyahs || b.power - a.power);
}

function groupsFinished() {
  return state.groupsStarted && state.groupMatch >= 120;
}

function renderStageLocks() {
  const finalUnlocked = groupsFinished();
  $("startGroupsBtn").disabled = state.groupsStarted || !squadReady();
  $("simMatchBtn").disabled = !state.groupsStarted || groupsFinished();
  $("simDayBtn").disabled = !state.groupsStarted || groupsFinished();
  $("simAllBtn").disabled = !state.groupsStarted || groupsFinished();
  $("startFinalBtn").disabled = !finalUnlocked;
  if (state.finalStarted) $("startFinalBtn").disabled = true;
  $("simFinalMatchBtn").disabled = !state.finalStarted || Boolean(state.champion) || state.finalMatch >= 16;
  $("simFinalDayBtn").disabled = !state.finalStarted || Boolean(state.champion) || state.finalMatch >= 16;
  $("simFinalAllBtn").disabled = !state.finalStarted || Boolean(state.champion) || state.finalMatch >= 16;
  $("rollMarketBtn").disabled = state.finalStarted || !state.transferWindowOpen || state.transferRefresh <= 0 || state.transferMoves >= 2;
}

function renderGroups() {
  $("roundBadge").textContent = `${state.groupMatch}/120`;
  const dayIndex = Math.min(19, Math.floor(state.groupMatch / 6));
  const week = Math.floor(dayIndex / 2) + 1;
  const competitionDay = dayIndex + 1;
  const matchInDay = (state.groupMatch % 6) + 1;
  const activeGroups = GROUP_SCHEDULE[dayIndex] || "ABC";
  document.querySelectorAll("[data-group-tab]").forEach((tab) => tab.classList.toggle("active", tab.dataset.groupTab === state.groupTab));
  const groups = [0, 1, 2, 3].map((idx) => {
    const label = String.fromCharCode(65 + idx);
    const names = state.groupTeams.filter((team) => team.group === label).map((team) => team.name).join(", ");
    return `<div class="group-label"><b>Grupo ${label}</b><br>${names || "-"}</div>`;
  }).join("");
  const dayLobby = currentDayLobby();
  const userPlaying = dayLobby.some((team) => team.user);
  const todayRows = dayTableRows(dayLobby, dayIndex);
  $("groupsGrid").innerHTML = `
    <div class="champion-banner">SEMANA ${week} - DIA ${competitionDay} - queda ${Math.min(matchInDay, 6)}/6 - grupos ${activeGroups.split("").join(" x ")} ${userPlaying ? "" : "- simulando outros confrontos"}</div>
    <div class="group-labels">${groups}</div>
    <div class="table-wrap">${state.groupTab === "day" ? table(todayRows, true) : table(state.groupTeams, true)}</div>`;
  renderMvpTable("groups");
}

function dayTableRows(dayLobby, dayIndex) {
  const dayStart = dayIndex * 6;
  const matches = state.matchHistory.filter((match) => match.phase === "groups" && match.match > dayStart && match.match <= dayStart + 6);
  return dayLobby.map((team) => {
    const row = { ...team, points: 0, booyahs: 0, kills: 0, drops: 0 };
    matches.forEach((match) => {
      const result = match.results.find((item) => item.teamId === team.id);
      if (!result) return;
      row.points += result.points;
      row.booyahs += result.booyah ? 1 : 0;
      row.kills += result.kills;
      row.drops += 1;
    });
    return row;
  });
}

function renderGroupsV2() {
  $("roundBadge").textContent = `${state.groupMatch}/120`;
  const dayIndex = Math.min(19, Math.floor(state.groupMatch / 6));
  const week = Math.floor(dayIndex / 2) + 1;
  const competitionDay = dayIndex + 1;
  const matchInDay = (state.groupMatch % 6) + 1;
  const activeGroups = GROUP_SCHEDULE[dayIndex] || "ABC";
  const userTeam = state.groupTeams.find((team) => team.user);
  document.querySelectorAll("[data-group-tab]").forEach((tab) => tab.classList.toggle("active", tab.dataset.groupTab === state.groupTab));
  const groups = [0, 1, 2, 3].map((idx) => {
    const label = String.fromCharCode(65 + idx);
    const names = state.groupTeams
      .filter((team) => team.group === label)
      .map((team) => team.user ? `<mark>${escapeHtml(team.name)}</mark>` : escapeHtml(team.name))
      .join(", ");
    return `<div class="group-label ${userTeam?.group === label ? "is-user-group" : ""}"><b>Grupo ${label}${userTeam?.group === label ? " - seu grupo" : ""}</b><br>${names || "-"}</div>`;
  }).join("");
  const dayLobby = currentDayLobby();
  const userPlaying = dayLobby.some((team) => team.user);
  const todayRows = dayTableRows(dayLobby, dayIndex);
  $("groupsGrid").innerHTML = `
    <div class="champion-banner ${userPlaying ? "" : "no-user-day"}">
      <span>SEMANA ${week} - DIA ${competitionDay} - queda ${Math.min(matchInDay, 6)}/6 - grupos ${activeGroups.split("").join(" x ")} ${userPlaying ? "" : "- SEU TIME FOLGA, SIMULANDO OUTROS CONFRONTOS"}</span>
      ${userPlaying ? "" : `<button type="button" id="simOtherDayBtn">SIMULAR DIA</button>`}
    </div>
    <div class="group-labels">${groups}</div>
    <div class="table-wrap">${state.groupTab === "day" ? table(todayRows, true) : table(state.groupTeams, true)}</div>`;
  const simOtherDayBtn = $("simOtherDayBtn");
  if (simOtherDayBtn) simOtherDayBtn.addEventListener("click", () => simGroups(matchesLeftInGroupDay()));
  renderMvpTable("groups");
}

function renderFinal() {
  document.querySelectorAll("[data-final-tab]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.finalTab === state.finalTab);
  });
  $("finalTable").innerHTML = standings(state.finalists).map((team, idx) => `
    <tr class="${team.user ? "is-user" : ""} ${state.champion?.id === team.id ? "is-champion" : ""}">
      <td>${idx + 1}</td>
      <td class="team-cell"><strong>${team.name}</strong><small>OVR ${team.power} - ${shortEdition(team.edition || "-")}</small></td>
      <td>${shortEdition(team.edition || "-")}</td>
      <td>${team.points || 0}</td>
      <td>${team.booyahs || 0}</td>
      <td>${team.kills || 0}</td>
      <td>${team.drops || 0}</td>
      <td class="cp">${team.cp ? "Elegivel" : "-"}</td>
    </tr>
  `).join("");
  if (!groupsFinished()) {
    $("championBanner").textContent = `Finalize os grupos primeiro: ${state.groupMatch}/120 quedas. A final recebe os 12 melhores.`;
    $("finalDropRank").innerHTML = "";
    if ($("finalMvpTable")) $("finalMvpTable").innerHTML = "";
    $("finalOverallWrap").style.display = "none";
    return;
  }
  $("championBanner").innerHTML = state.champion ? championBannerHtml(state.champion) : `Final: queda ${state.finalMatch}/16`;
  renderFinalDropRank();
  renderMvpTable("final", "finalMvpTable");
  $("finalDropRank").style.display = state.finalTab === "drop" ? "block" : "none";
  $("finalOverallWrap").style.display = state.finalTab === "overall" ? "block" : "none";
}

function renderFinalDropRank() {
  const target = $("finalDropRank");
  if (!target) return;
  const match = [...state.matchHistory].reverse().find((item) => item.phase === "final");
  if (!match) {
    target.innerHTML = `<div class="champion-banner">Rank da queda da final aparece depois da primeira queda simulada.</div>`;
    return;
  }
  const rows = [...match.results].sort((a, b) => a.pos - b.pos);
  target.innerHTML = `
    <div class="final-drop-rank">
      <h3>Rank da queda ${match.match} - ${escapeHtml(match.map)}</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Time</th><th>Pts</th><th>Abates</th><th>Booyah</th></tr></thead>
          <tbody>${rows.map((row) => `
            <tr class="${state.finalists.find((team) => team.id === row.teamId)?.user ? "is-user" : ""}">
              <td>${row.pos}</td>
              <td class="team-cell"><strong>${escapeHtml(row.team)}</strong><small>${finalTeamMeta(row.teamId)}</small></td>
              <td>${row.points}</td>
              <td>${row.kills}</td>
              <td>${row.booyah ? "Sim" : "-"}</td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>
    </div>`;
}

function finalTeamMeta(teamId) {
  const team = state.finalists.find((item) => item.id === teamId);
  return team ? `OVR ${team.power} - ${shortEdition(team.edition || "-")}` : "";
}

function championBannerHtml(team) {
  return `<div class="champion-callout"><span>CAMPEAO</span><strong>${escapeHtml(team.name)}</strong><small>OVR ${team.power} - ${shortEdition(team.edition || "-")} | ${team.points || 0} pts | ${team.booyahs || 0} B | ${team.kills || 0} abates</small></div>`;
}

function renderSplitSummary() {
  const target = $("splitSummary");
  if (!target) return;
  if (!state.groupsStarted) {
    target.innerHTML = `<div class="champion-banner">Inicie a classificatoria para gerar o relatorio do split.</div>`;
    return;
  }
  const userGroup = state.groupTeams.find((team) => team.user);
  const groupRows = standings(state.groupTeams);
  const userGroupPos = userGroup ? groupRows.findIndex((team) => team.id === userGroup.id) + 1 : 0;
  const userFinal = state.finalists.find((team) => team.user);
  const finalRows = standings(state.finalists);
  const userFinalPos = userFinal ? finalRows.findIndex((team) => team.id === userFinal.id) + 1 : 0;
  const champion = state.champion || (state.finalMatch >= 16 ? finalRows[0] : null);
  const mvpRows = Object.values(state.mvpStats).sort((a, b) => b.kills - a.kills || b.mvps - a.mvps || b.damage - a.damage);
  const mvp = mvpRows[0];
  const teamKills = mvpRows
    .filter((row) => row.teamId === (userGroup?.id || userFinal?.id) || row.team === state.teamName)
    .sort((a, b) => b.kills - a.kills || b.damage - a.damage);
  const allStars = mvpRows.slice(0, 4);
  const bestQualifyingTeam = groupRows[0];
  const bestQualifyingCoach = qualifyingCoach(bestQualifyingTeam);
  const finished = Boolean(champion);
  const topKills = statTopRows("kills");
  const topAssists = statTopRows("assists");
  const topDamage = statTopRows("damage");

  target.innerHTML = `
    <div class="champion-banner">${finished ? "Split encerrado." : `Relatorio parcial: final ${state.finalMatch}/16.`}</div>
    <div class="split-hero">
      <div class="split-card ${champion?.user ? "is-user-stat" : ""}"><span>Campeao</span><strong>${escapeHtml(champion?.name || "-")}</strong></div>
      <div class="split-card ${mvp?.teamId === (userGroup?.id || userFinal?.id) ? "is-user-stat" : ""}"><span>MVP</span><strong>${escapeHtml(mvp?.player || "-")}</strong></div>
      <div class="split-card is-user-stat"><span>Sua posicao final</span><strong>${userFinal ? `${userFinalPos}o` : userGroupPos > 12 ? "Nao classificou" : "-"}</strong></div>
    </div>
    ${finished ? `
      <div class="season-actions">
        <button data-season-reset class="primary">Nova temporada: liberar elenco</button>
        <button data-season-keep>Continuar: manter elenco e fazer trocas</button>
      </div>` : `
      <div class="champion-banner">A temporada so encerra depois da final. Termine a final para liberar nova temporada.</div>`}
    <div class="trophy-gallery">
      <h3>Galeria de trofeus</h3>
      <div>${trophyGalleryItems()}</div>
    </div>
    <div class="split-grid">
      <div class="split-box">
        <h3>Sua campanha</h3>
        ${statsTable(["Fase", "Pos", "Pts", "B", "Kills", "Quedas"], [
          ["Classificatoria", userGroup ? `${userGroupPos}o` : "-", userGroup?.points || 0, userGroup?.booyahs || 0, userGroup?.kills || 0, userGroup?.drops || 0],
          ["Final", userFinal ? `${userFinalPos}o` : "Fora", userFinal?.points || 0, userFinal?.booyahs || 0, userFinal?.kills || 0, userFinal?.drops || 0],
          ["Overall", "-", userGroup ? userGroup.power : userPower(), "-", "-", "-"]
        ])}
      </div>
      <div class="split-box">
        <h3>Ranking MVP do seu time</h3>
        ${playerRankingTable(teamKills, "kills", "Abates")}
      </div>
      <div class="split-box">
        <h3>Selecao do torneio</h3>
        ${playerRankingTable(allStars, "kills", "Abates")}
        ${statsTable(["Premio", "Nome", "Time"], [["Coach classificatoria", bestQualifyingCoach?.name || "-", bestQualifyingTeam?.name || "-"]])}
      </div>
      <div class="split-box">
        <h3>Top 5 kills</h3>
        ${playerRankingTable(topKills, "kills", "Abates")}
      </div>
      <div class="split-box">
        <h3>Top 5 assistencias</h3>
        ${playerRankingTable(topAssists, "assists", "Assists")}
      </div>
      <div class="split-box">
        <h3>Top 5 dano</h3>
        ${playerRankingTable(topDamage, "damage", "Dano")}
      </div>
      <div class="split-box">
        <h3>Destaques gerais</h3>
        ${statsTable(["Dado", "Nome", "Info"], [
          ["MVP do split", mvp?.player || "-", mvp ? `${mvp.kills} abates | ${mvp.origin || mvp.team}` : "-"],
          ["Campeao", champion?.name || "-", champion ? `${champion.points} pts na final` : "-"],
          ["Melhor ataque final", finalRows[0] ? [...finalRows].sort((a, b) => b.kills - a.kills)[0].name : "-", finalRows[0] ? `${[...finalRows].sort((a, b) => b.kills - a.kills)[0].kills} abates` : "-"]
        ])}
      </div>
    </div>`;
}

function qualifyingCoach(team) {
  if (!team) return null;
  if (team.user) return state.squad.coach || team.staff?.[0] || null;
  return team.staff?.find((person) => /coach|trein/i.test(person.role || "")) || team.staff?.[0] || null;
}

function statTopRows(stat) {
  return Object.values(state.mvpStats)
    .sort((a, b) => (b[stat] || 0) - (a[stat] || 0) || b.kills - a.kills)
    .slice(0, 5);
}

function topStatList(rows, stat, label) {
  return rows.length
    ? rows.map((row, index) => awardRow(`${index + 1}. ${row.player}`, `${row[stat] || 0} ${label} | ${row.origin || row.team}`)).join("")
    : awardRow("-", "Sem quedas simuladas");
}

function statsTable(headers, rows) {
  return `<div class="mini-table-wrap"><table class="mini-table"><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function playerRankingTable(rows, stat = "kills", label = "Valor") {
  const data = rows.slice(0, 5);
  if (!data.length) return `<div class="draw-empty">Sem dados simulados.</div>`;
  return statsTable(["#", "Jogador", label, "Time"], data.map((row, index) => [
    `${index + 1}.`,
    row.player || "-",
    stat === "kills" ? `${row[stat] || 0} abates` : row[stat] || 0,
    row.teamId === (state.groupTeams.find((team) => team.user)?.id || state.finalists.find((team) => team.user)?.id) ? "MEU TIME" : (row.origin || row.team || "-")
  ]));
}

function historicalTrophyItems() {
  const winners = {};
  state.tournaments.forEach((tournament) => {
    const champion = [...(tournament.teams || [])].sort((a, b) => {
      const aPos = a.finalPlacement || a.placement || 99;
      const bPos = b.finalPlacement || b.placement || 99;
      return aPos - bPos || b.power - a.power;
    })[0];
    if (!champion) return;
    const name = champion.name;
    winners[name] ||= { champion: name, titles: 0 };
    winners[name].titles++;
  });
  return Object.values(winners).sort((a, b) => b.titles - a.titles || a.champion.localeCompare(b.champion));
}

function trophyGalleryItems() {
  const historical = historicalTrophyItems()
    .map((item) => `<span>${escapeHtml(item.champion)}: ${item.titles} titulo${item.titles > 1 ? "s" : ""}</span>`)
    .join("");
  const fantasy = state.trophies.length
    ? state.trophies.map((item) => `<span class="${item.userChampion ? "won" : ""}">Fantasy S${item.season}: ${escapeHtml(item.champion)}${item.userChampion ? " - seu titulo" : ""}</span>`).join("")
    : "";
  return `${historical}${fantasy}` || "<span>Sem temporadas finalizadas ainda.</span>";
}

function phaseLabel(phase) {
  return phase === "final" ? "Final" : "Classificatoria";
}

function mapSummaryRows() {
  const user = state.groupTeams.find((team) => team.user) || state.finalists.find((team) => team.user);
  if (!user) return [];
  return Object.values(state.mapStats)
    .filter((row) => row.teamId === user.id)
    .map((row) => ({ ...row, avgPoints: row.points / Math.max(1, row.drops) }))
    .sort((a, b) => a.phase.localeCompare(b.phase) || b.avgPoints - a.avgPoints);
}

function playerMapSummaryRows(teamId) {
  if (!teamId) return [];
  return Object.values(state.mvpStats)
    .filter((row) => row.teamId === teamId)
    .flatMap((row) => Object.values(row.maps || {}).map((mapRow) => ({ player: row.player, ...mapRow })))
    .sort((a, b) => b.kills - a.kills || b.drops - a.drops);
}

function handleStatsActions(event) {
  if (event.target.closest("[data-season-reset]")) {
    resetCompetitionState(true);
    switchView("squadView");
    renderAll();
    log("Nova temporada criada. Elenco liberado para um novo draft.");
    return;
  }
  if (event.target.closest("[data-season-keep]")) {
    resetCompetitionState(false);
    state.draftDone = squadReady();
    state.transferWindowOpen = true;
    state.transferMoves = 0;
    state.transferOutIndex = null;
    state.transferOutType = null;
    state.transferRefresh = 2;
    state.marketTeam = randomTeam(null, false);
    state.pendingTransfer = null;
    switchView("transferView");
    renderAll();
    log("Nova temporada criada mantendo seu elenco. Mercado aberto com 2 refresh.");
  }
}

function awardRow(label, value) {
  return `<div class="award-row"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></div>`;
}

function table(teams) {
  return `<table><thead><tr><th>#</th><th>Time</th><th>Edicao</th><th>Grupo</th><th>Pts</th><th>B</th><th>Abates</th><th>Quedas</th></tr></thead><tbody>${standings(teams).map((team, idx) => `
    <tr class="${isUserTeamRow(team) ? "is-user" : ""}">
      <td>${idx + 1}</td>
      <td class="team-cell"><strong>${team.name}</strong><small>${team.manager ? `Manager ${team.manager} | ` : ""}OVR ${team.power}</small></td>
      <td>${shortEdition(team.edition || "-")}</td>
      <td>${team.group || "-"}</td>
      <td>${team.points || 0}</td>
      <td>${team.booyahs || 0}</td>
      <td>${team.kills || 0}</td>
      <td>${team.drops || 0}</td>
    </tr>
  `).join("")}</tbody></table>`;
}

function isUserTeamRow(team) {
  const userTeam = state.groupTeams.find((item) => item.user) || state.finalists.find((item) => item.user);
  return Boolean(team?.user || (userTeam?.id && team?.id === userTeam.id));
}

function renderMvpTable(phase = "groups", targetId = "mvpTable") {
  const target = $(targetId);
  if (!target) return;
  const userTeam = state.groupTeams.find((team) => team.user) || state.finalists.find((team) => team.user);
  document.querySelectorAll("[data-mvp-filter]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mvpFilter === state.mvpFilter);
  });
  const rows = Object.values(state.mvpStats)
    .map((row) => mvpPhaseRow(row, phase))
    .filter((row) => row.drops > 0)
    .filter((row) => state.mvpFilter !== "mine" || (userTeam?.id && row.teamId === userTeam.id))
    .sort((a, b) => b.kills - a.kills || b.mvps - a.mvps || b.damage - a.damage)
    .slice(0, 12);
  target.innerHTML = rows.length ? `<table><thead><tr><th>#</th><th>Jogador</th><th>Origem</th><th>Abates</th><th>Dano</th><th>Assists</th><th>Quedas</th><th>MVP</th></tr></thead><tbody>${rows.map((row, idx) => `
    <tr class="${userTeam?.id && row.teamId === userTeam.id ? "is-user" : ""}">
      <td>${idx + 1}</td>
      <td>${row.player}</td>
      <td>${row.origin || row.team}</td>
      <td>${row.kills}</td>
      <td>${row.damage}</td>
      <td>${row.assists}</td>
      <td>${row.drops}</td>
      <td>${row.mvps}</td>
    </tr>
  `).join("")}</tbody></table>` : `<div class="champion-banner">Nenhum jogador encontrado neste filtro ainda.</div>`;
}

function mvpPhaseRow(row, phase) {
  const stats = row.phases?.[phase] || {};
  return {
    ...row,
    kills: stats.kills || 0,
    damage: stats.damage || 0,
    assists: stats.assists || 0,
    drops: stats.drops || 0,
    mvps: stats.mvps || 0
  };
}

function openAdmin() {
  if (!state.adminUnlocked) {
    const password = window.prompt("Senha admin");
    if (password !== "147") return;
    state.adminUnlocked = true;
  }
  $("adminPanel").classList.add("open");
  $("adminPanel").setAttribute("aria-hidden", "false");
  renderAdminPanel();
}

function closeAdmin() {
  $("adminPanel").classList.remove("open");
  $("adminPanel").setAttribute("aria-hidden", "true");
}

function renderAdminPanel() {
  const target = $("adminTeams");
  if (!target || !state.adminUnlocked) return;
  $("overallSource").textContent = `Overalls: ${state.overallSource}`;
  const tournaments = state.tournaments.filter((tournament) => /LBFF|WB|FFWS/i.test(tournament.edition));
  const editions = tournaments
    .filter((tournament) => /LBFF|WB|FFWS/i.test(tournament.edition))
    .map((tournament) => {
      const sortedTeams = [...tournament.teams].sort((a, b) => (a.placement || 99) - (b.placement || 99) || b.power - a.power);
      const coverage = dataCoverage(tournament);
      const editionKey = normalizeEditionKey(tournament.edition);
      const openAttr = state.adminOpenEditions.includes(editionKey) ? "open" : "";
      return `
      <details class="admin-edition" data-admin-edition="${escapeAttr(editionKey)}" ${openAttr}>
        <summary>${escapeHtml(shortEdition(tournament.edition))} <small>${tournament.teams.length} times - dados de ${coverage.withData}/${coverage.total} jogadores computados</small></summary>
        <details class="data-check">
          <summary>Ver jogadores sem dados confirmados (${coverage.missing.length})</summary>
          <p>${coverage.missing.length ? coverage.missing.map((row) => missingPlayerLink(row, tournament.edition)).join(", ") : "Todos os jogadores ativos desta edicao tem K/Q."}</p>
        </details>
        <div class="admin-team-list">
          ${sortedTeams.map((team) => `
            <div class="admin-team" style="--team-color:${teamColor(team.name)}">
              <div class="admin-team-head">
                <div>
                  <strong>${escapeHtml(team.name)}</strong>
                  <small>${adminPlacementLabel(team)} | ${teamScoreLabel(team)} | Time OVR ${team.power}</small>
                </div>
                <button type="button" data-auto-team data-edition="${escapeAttr(tournament.edition)}" data-team="${escapeAttr(team.name)}">AUTO</button>
              </div>
              ${adminPeopleHtml(team.players.slice(0, 7), tournament.edition, "player", team.name)}
              ${adminPeopleHtml(adminCoachPeople(team).slice(0, 2), tournament.edition, "coach", team.name)}
            </div>
          `).join("")}
        </div>
      </details>
    `;
    }).join("");
  target.innerHTML = `
    <section class="admin-edition-filter">
      <h3>Edicoes computadas</h3>
      <p>Se nada estiver marcado, o jogo usa todas. Marcando aqui, sorteio, mercado e adversarios usam apenas essas edicoes.</p>
      ${overallParamsHtml()}
      <div class="admin-backup-actions">
        <button data-export-overalls>Exportar backup</button>
        <button data-import-overalls>Importar backup</button>
        <button data-export-overalls-csv>Exportar CSV</button>
        <button data-auto-lbff4>Auto LBFF 4+</button>
      </div>
      <div class="edition-toggle-grid">
        ${tournaments.map((tournament) => {
          const edition = normalizeEditionKey(tournament.edition);
          const checked = !state.activeEditions.length || state.activeEditions.includes(edition);
          return `<label><input class="admin-edition-toggle" type="checkbox" data-edition="${escapeAttr(edition)}" ${checked ? "checked" : ""}>${escapeHtml(shortEdition(tournament.edition))}</label>`;
        }).join("")}
      </div>
    </section>
    ${editions || `<div class="admin-edition">Nenhum torneio carregado.</div>`}`;
}

function overallParamsHtml() {
  const p = state.overallParams || defaultOverallParams();
  const field = (id, label, step = "0.1") => `
    <label>${label}<input class="overall-param-input" type="number" step="${step}" data-param="${id}" value="${p[id]}"></label>`;
  return `
    <div class="overall-params">
      <strong>Parametros do AUTO</strong>
      <div class="overall-param-block">
        <b>Pre-revive - LBFF 1, 3, 4, 5 e 6</b>
        ${field("preAvg", "Media K/Q pre-revive", "0.001")}
      </div>
      <div class="overall-param-block">
        <b>Pos-revive - LBFF 7, 8 e 9</b>
        ${field("postAvg", "Media K/Q pos-revive", "0.001")}
      </div>
      <div class="overall-param-grid">
        ${field("kpgWeight", "Peso da media de kills")}
        ${field("rankWeight", "Peso ranking kills")}
        ${field("volumeWeight", "Peso volume kills")}
        ${field("classTop12", "Bonus class top 12")}
        ${field("classTop4", "Bonus class top 4")}
        ${field("finalTop12", "Bonus final top 12")}
        ${field("finalTop4", "Bonus final top 4")}
        ${field("champion", "Bonus campeao")}
      </div>
      <button type="button" data-reset-overall-params>Resetar parametros</button>
      <span>O botao AUTO usa estes coeficientes junto com K/Q, volume, ranking de kills e posicao do time.</span>
    </div>`;
}

function adminCoachPeople(team) {
  const staff = team.staff || [];
  const coaches = staff.filter((person) => /coach|trein|head/i.test(person.role || ""));
  return coaches.length ? coaches : staff.filter((person) => key(person.name));
}

function dataCoverage(tournament) {
  const players = [];
  tournament.teams.forEach((team) => {
    team.players.forEach((player) => {
      players.push({ name: player.name, team: team.name });
    });
  });
  const unique = [...new Map(players.map((row) => [`${key(row.name)}|${key(row.team)}`, row])).values()];
  const missing = unique
    .filter((row) => !effectivePlayerStats(row.name, tournament.edition))
    .map((row) => ({ name: row.name, team: row.team }));
  return { total: unique.length, withData: unique.length - missing.length, missing };
}

function missingPlayerLink(row, edition) {
  const label = `${row.name} (${row.team})`;
  const target = adminPersonId(row.name, edition, row.team);
  return `<a href="#${escapeAttr(target)}" data-admin-jump="${escapeAttr(target)}">${escapeHtml(label)}</a>`;
}

function teamColor(name) {
  let hash = 0;
  String(name || "").split("").forEach((char) => {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  });
  return `hsl(${Math.abs(hash) % 360} 82% 56%)`;
}

function adminPlacementLabel(team) {
  if (team.placementSource === "pontos" && team.finalPlacement) {
    return `Class ${team.regularPlacement || "-"}o | Final ${team.finalPlacement}o`;
  }
  if (team.placementSource === "pontos") {
    return `Class ${team.regularPlacement || team.placement || "-"}o | Nao foi final`;
  }
  return `${team.placement || "-"}o campeonato | ${team.stageLabel || (team.placement <= 12 ? "Final" : "Classificatoria")}`;
}

function teamScoreLabel(team) {
  if (team.placementSource === "pontos") {
    return `Pts ${team.realPoints} (class ${team.classificationPoints} + final ${team.finalStagePoints})`;
  }
  if (team.placementSource === "manual") return "ordem manual";
  return "ordem participantes";
}

function handleAdminBackupClick(event) {
  const jump = event.target.closest("[data-admin-jump]");
  if (jump) {
    event.preventDefault();
    focusAdminPerson(jump.dataset.adminJump);
    return;
  }
  const autoButton = event.target.closest("[data-name][data-edition].admin-auto-overall");
  if (autoButton) {
    generateAdminOverall(autoButton.dataset.name, autoButton.dataset.edition);
    return;
  }
  const autoTeamButton = event.target.closest("[data-auto-team]");
  if (autoTeamButton) {
    generateAdminTeamOverall(autoTeamButton.dataset.team, autoTeamButton.dataset.edition);
    return;
  }
  if (event.target.closest("[data-auto-lbff4]")) {
    generateLbff4PlusOveralls();
    return;
  }
  if (event.target.closest("[data-reset-overall-params]")) {
    state.overallParams = defaultOverallParams();
    localStorage.setItem("wbManagerOverallParams", JSON.stringify(state.overallParams));
    renderAll();
    log("Parametros do AUTO resetados.");
    return;
  }
  if (event.target.closest("[data-export-overalls]")) {
    exportAdminBackup();
    return;
  }
  if (event.target.closest("[data-export-overalls-csv]")) {
    exportAdminBackupCsv();
    return;
  }
  if (event.target.closest("[data-import-overalls]")) {
    importAdminBackup();
  }
}

function handleAdminEditionToggleState(event) {
  const details = event.target.closest?.(".admin-edition[data-admin-edition]");
  if (!details || event.target !== details) return;
  const edition = details.dataset.adminEdition;
  if (!edition) return;
  const open = new Set(state.adminOpenEditions || []);
  if (details.open) open.add(edition);
  else open.delete(edition);
  state.adminOpenEditions = [...open];
}

function exportAdminBackup() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    overallOverrides: state.adminOverrides,
    statOverrides: state.statOverrides,
    activeEditions: state.activeEditions
  };
  downloadTextFile(`wb-manager-overalls-${dateStamp()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function exportAdminBackupCsv() {
  const rows = [["JOGADOR", "EDICAO", "OVERALL", "ABATES", "QUEDAS"]];
  Object.entries(state.adminOverrides || {}).forEach(([player, editions]) => {
    Object.entries(editions).forEach(([edition, overall]) => {
      const stats = state.statOverrides?.[player]?.[edition] || {};
      rows.push([player, edition, overall, stats.k ?? "", stats.q ?? ""]);
    });
  });
  Object.entries(state.statOverrides || {}).forEach(([player, editions]) => {
    Object.entries(editions).forEach(([edition, stats]) => {
      if (state.adminOverrides?.[player]?.[edition]) return;
      rows.push([player, edition, "", stats.k ?? "", stats.q ?? ""]);
    });
  });
  const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
  downloadTextFile(`wb-manager-overalls-${dateStamp()}.csv`, csv, "text/csv");
}

function importAdminBackup() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || "{}"));
        state.adminOverrides = data.overallOverrides || data || {};
        state.statOverrides = data.statOverrides || {};
        state.activeEditions = Array.isArray(data.activeEditions) ? data.activeEditions : state.activeEditions;
        localStorage.setItem("wbManagerOverallOverrides", JSON.stringify(state.adminOverrides));
        localStorage.setItem("wbManagerStatOverrides", JSON.stringify(state.statOverrides));
        localStorage.setItem("wbManagerActiveEditions", JSON.stringify(state.activeEditions));
        state.overallOverrides = mergeOverallOverrides(state.sheetOverrides, state.adminOverrides);
        state.overallSource = overallSourceLabel();
        rebuildTournamentOveralls();
        renderAll();
        log("Backup de overalls importado no ADMIN.");
      } catch (error) {
        log(`Erro ao importar backup: ${error.message}`);
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

function rebuildTournamentOveralls() {
  state.tournaments.forEach((tournament) => {
    tournament.teams.forEach((team) => {
      team.players.forEach((player) => {
        player.overall = getPlayerOverall(player.name, tournament.edition, state.playerData, state.ranks, player.inactive);
      });
      const teamBonus = team.finalPlacement === 1 || team.placement === 1 ? 2 : team.finalPlacement && team.finalPlacement <= 4 ? 1 : 0;
      if (teamBonus) team.players.forEach((player) => {
        if (effectivePlayerStats(player.name, tournament.edition)) player.overall = Math.min(99, player.overall + teamBonus);
      });
      team.staff.forEach((coach) => {
        coach.overall = getCoachOverall(coach, team, tournament.edition);
      });
      team.power = rosterPower(team.players, team.staff[0]);
    });
  });
}

function downloadTextFile(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function adminPeopleHtml(people, edition, type = "player", teamName = "") {
  return people.map((person) => {
    const stats = type === "coach" ? null : playerSplitStats(person.name, edition);
    const killInfo = stats?.confirmed ? `K/Q ${stats.kpg.toFixed(2)} (${stats.kills}/${stats.drops})` : "sem dados (0/0)";
    const personId = adminPersonId(person.name, edition, teamName);
    const statControls = type === "coach" ? "" : `
      <div class="admin-stat-controls">
        <span>K</span><input class="admin-stat" type="number" min="0" max="500" value="${stats?.kills ?? ""}"
          data-stat="k" data-name="${escapeAttr(person.name)}" data-edition="${escapeAttr(edition)}">
        <span>Q</span><input class="admin-stat" type="number" min="1" max="240" value="${stats?.drops ?? ""}"
          data-stat="q" data-name="${escapeAttr(person.name)}" data-edition="${escapeAttr(edition)}">
        <button type="button" class="admin-auto-overall"
          data-name="${escapeAttr(person.name)}" data-edition="${escapeAttr(edition)}">Auto</button>
      </div>`;
    return `
    <label id="${escapeAttr(personId)}" class="admin-person${eliteClass(person.overall)}">
      <span>${escapeHtml(type === "coach" ? `Coach ${person.name}` : person.name)}${killInfo ? `<small>${escapeHtml(killInfo)}</small>` : ""}</span>
      <input class="admin-overall" type="number" min="65" max="99" value="${person.overall}"
        data-name="${escapeAttr(person.name)}" data-edition="${escapeAttr(edition)}">
      ${statControls}
    </label>`;
  }).join("");
}

function adminPersonId(name, edition, teamName = "") {
  return `admin-${key(edition)}-${key(teamName)}-${key(name)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function focusAdminPerson(id) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("admin-person-focus");
  const input = target.querySelector("input");
  if (input) setTimeout(() => input.focus(), 220);
  setTimeout(() => target.classList.remove("admin-person-focus"), 2400);
}

function handleAdminOverallChange(event) {
  const paramInput = event.target.closest(".overall-param-input");
  if (paramInput) {
    handleOverallParamChange(paramInput);
    return;
  }
  const editionToggle = event.target.closest(".admin-edition-toggle");
  if (editionToggle) {
    handleEditionToggle(editionToggle);
    return;
  }
  const statInput = event.target.closest(".admin-stat");
  if (statInput) {
    handleAdminStatChange(statInput);
    return;
  }
  const input = event.target.closest(".admin-overall");
  if (!input) return;
  const value = Math.max(65, Math.min(99, Math.round(Number(input.value || 0))));
  if (!Number.isFinite(value)) return;
  input.value = value;
  saveAdminOverall(input.dataset.name, input.dataset.edition, value);
}

function handleOverallParamChange(input) {
  const keyName = input.dataset.param;
  const fallback = defaultOverallParams()[keyName] ?? 0;
  const value = Number(input.value);
  state.overallParams[keyName] = Number.isFinite(value) ? value : fallback;
  input.value = state.overallParams[keyName];
  localStorage.setItem("wbManagerOverallParams", JSON.stringify(state.overallParams));
}

function handleAdminStatChange(input) {
  const stat = input.dataset.stat;
  const min = stat === "q" ? 1 : 0;
  const max = stat === "q" ? 240 : 500;
  const value = Math.max(min, Math.min(max, Math.round(Number(input.value || min))));
  if (!Number.isFinite(value)) return;
  input.value = value;
  saveAdminStat(input.dataset.name, input.dataset.edition, stat, value);
}

function handleEditionToggle(input) {
  const edition = input.dataset.edition;
  const selected = new Set(state.activeEditions.length ? state.activeEditions : computableEditionKeys());
  if (input.checked) selected.add(edition);
  else selected.delete(edition);
  const all = computableEditionKeys();
  state.activeEditions = selected.size === all.length ? [] : [...selected];
  localStorage.setItem("wbManagerActiveEditions", JSON.stringify(state.activeEditions));
  state.currentDraw = state.currentDraw && editionAllowed(state.currentDraw.edition) ? state.currentDraw : null;
  state.marketTeam = state.marketTeam && editionAllowed(state.marketTeam.edition) ? state.marketTeam : null;
  renderAll();
}

function saveAdminOverall(name, edition, value) {
  const player = key(name);
  const editionKey = normalizeEditionKey(edition);
  state.adminOverrides[player] ||= {};
  state.adminOverrides[player][editionKey] = value;
  persistAdminOverrides();
  applyOverallEdit(name, edition, value);
  renderAll();
}

function saveAdminStat(name, edition, stat, value) {
  const player = key(name);
  const editionKey = normalizeEditionKey(edition);
  const current = effectivePlayerStats(name, edition) || {};
  state.statOverrides[player] ||= {};
  state.statOverrides[player][editionKey] = {
    k: stat === "k" ? value : Number(current.k || 0),
    q: stat === "q" ? value : Math.max(1, Number(current.q || 1))
  };
  localStorage.setItem("wbManagerStatOverrides", JSON.stringify(state.statOverrides));
  rebuildTournamentOveralls();
  renderAll();
}

function generateAdminOverall(name, edition) {
  const stats = effectivePlayerStats(name, edition);
  if (!stats) {
    log(`Sem K/Q para gerar overall automatico de ${name}.`);
    return;
  }
  const value = automaticOverallFromStatsV2(name, edition, stats, false, findTeamForPerson(name, edition));
  saveAdminOverall(name, edition, value);
  log(`Overall automatico de ${name}: ${value} (${Number(stats.k || 0)}/${Math.max(1, Number(stats.q || 1))}).`);
}

function generateAdminTeamOverall(teamName, edition) {
  const editionKey = normalizeEditionKey(edition);
  const tournament = state.tournaments.find((item) => normalizeEditionKey(item.edition) === editionKey);
  const team = tournament?.teams.find((item) => teamsMatch(item.name, teamName));
  if (!team) return;
  let count = 0;
  team.players.forEach((player) => {
    const stats = effectivePlayerStats(player.name, edition);
    if (!stats) return;
    const value = automaticOverallFromStatsV2(player.name, edition, stats, player.inactive, team);
    const playerKey = key(player.name);
    state.adminOverrides[playerKey] ||= {};
    state.adminOverrides[playerKey][editionKey] = value;
    player.overall = value;
    count++;
  });
  team.staff.forEach((coach) => {
    const value = getCoachOverall(coach, team, edition);
    const coachKey = key(coach.name);
    state.adminOverrides[coachKey] ||= {};
    state.adminOverrides[coachKey][editionKey] = value;
    coach.overall = value;
  });
  team.power = rosterPower(team.players, team.staff[0]);
  persistAdminOverrides();
  renderAll();
  log(`AUTO aplicado em ${team.name}: ${count} jogadores recalculados.`);
}

function persistAdminOverrides() {
  localStorage.setItem("wbManagerOverallOverrides", JSON.stringify(state.adminOverrides));
  state.overallOverrides = mergeOverallOverrides(state.sheetOverrides, state.adminOverrides);
  state.overallSource = overallSourceLabel();
}

function generateLbff4PlusOveralls() {
  let count = 0;
  state.tournaments.forEach((tournament) => {
    const match = tournament.edition.match(/LBFF\s+(\d+)/i);
    if (!match || Number(match[1]) < 4) return;
    tournament.teams.forEach((team) => {
      team.players.forEach((player) => {
        const stats = effectivePlayerStats(player.name, tournament.edition);
        if (!stats) return;
        const playerKey = key(player.name);
        const editionKey = normalizeEditionKey(tournament.edition);
        state.adminOverrides[playerKey] ||= {};
        state.adminOverrides[playerKey][editionKey] = automaticOverallFromStatsV2(player.name, tournament.edition, stats, player.inactive, team);
        count++;
      });
    });
  });
  persistAdminOverrides();
  rebuildTournamentOveralls();
  renderAll();
  log(`ADMIN recalculou ${count} overalls automaticos da LBFF 4 em diante.`);
}

function applyOverallEdit(name, edition, value) {
  const personKey = key(name);
  const editionKey = normalizeEditionKey(edition);
  const updateTeam = (team) => {
    if (!team || normalizeEditionKey(team.edition) !== editionKey) return;
    [...(team.players || []), ...(team.staff || [])].forEach((person) => {
      if (key(person.name) === personKey) person.overall = value;
    });
    team.power = rosterPower(team.players || [], team.staff?.[0]);
  };
  state.tournaments.forEach((tournament) => tournament.teams.forEach(updateTeam));
  state.groupTeams.forEach(updateTeam);
  state.finalists.forEach(updateTeam);
  [...state.squad.players, ...state.squad.bench, state.squad.coach].filter(Boolean).forEach((person) => {
    if (key(person.name) === personKey) person.overall = value;
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function logoFor(name) {
  return LOGOS[key(name)] || "escudo.webp";
}

function log(message) {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.innerHTML = message;
  $("matchLog").prepend(entry);
}

function switchView(viewId) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewId));
  $("gamePhase").textContent = "APOIE O PROJETO! PIX: NAKATEAMGG@GMAIL.COM";
}

