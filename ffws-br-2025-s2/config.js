(() => {
  'use strict';

  const DATA_VERSION = '20260910-dia6-v1';
  const MAPS = ['Bermuda', 'Purgatório', 'Alpine', 'Nova Terra', 'Kalahari', 'Solara'];
  const BASE_STAGES_URL = 'ffws-br-2025-s2/stages.json?v=20260904-dia4-v2';
  const BASE_PLAYERS_URL = 'ffws-br-2025-s2/players.json?v=20260904-dia4-v2';
  const EXTRA_URL = `ffws-br-2025-s2/r5-r6.json?v=${DATA_VERSION}`;
  const MERGED_STAGES_URL = `ffws-br-2025-s2/__merged-stages-r6__.json?v=${DATA_VERSION}`;
  const MERGED_PLAYERS_URL = `ffws-br-2025-s2/__merged-players-r6__.json?v=${DATA_VERSION}`;

  window.__WB25S2_MERGE__ = {
    extraUrl: EXTRA_URL,
    baseStagesUrl: BASE_STAGES_URL,
    basePlayersUrl: BASE_PLAYERS_URL,
    mergedStagesUrl: MERGED_STAGES_URL,
    mergedPlayersUrl: MERGED_PLAYERS_URL,
    maps: MAPS,
    updatedAt: '2026-09-10'
  };

  if (!window.__WB25S2_NATIVE_FETCH__) {
    window.__WB25S2_NATIVE_FETCH__ = window.fetch.bind(window);
  }

  if (!window.__WB25S2_FETCH_PATCHED__) {
    const nativeFetch = window.__WB25S2_NATIVE_FETCH__;
    const jsonResponse = data => new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
    const getJson = async (url, init) => {
      const response = await nativeFetch(url, init);
      if (!response.ok) throw new Error(`Falha ao carregar ${url}`);
      return response.json();
    };
    const keyOf = entry => [entry.stage || 'classificatoria', entry.day, entry.drop, entry.name, entry.team].join('|');

    const decodeRounds = (extra, maps) => {
      const positionByPlacement = { 12: 1, 9: 2, 8: 3, 7: 4, 6: 5, 5: 6, 4: 7, 3: 8, 2: 9, 1: 10, 0: null };
      const byDrop = new Map();
      (extra.results || []).forEach(row => {
        const [day, drop, teamIndex, placementPoints, kills, points, booyah] = row;
        const key = `${day}|${drop}`;
        if (!byDrop.has(key)) {
          byDrop.set(key, {
            round: day,
            day,
            number: ((day - 1) * 6) + drop,
            drop,
            map: maps[drop - 1] || '',
            results: []
          });
        }
        byDrop.get(key).results.push({
          team: extra.teams[teamIndex],
          position: Object.prototype.hasOwnProperty.call(positionByPlacement, placementPoints) ? positionByPlacement[placementPoints] : null,
          placementPoints,
          kills,
          points,
          booyah
        });
      });
      return [...byDrop.values()].sort((a, b) => a.day - b.day || a.drop - b.drop);
    };

    const decodePlayers = (extra, maps) => (extra.players || []).map(row => {
      const [day, drop, name, teamIndex, kills, damage, assists, mvp] = row;
      return {
        stage: 'classificatoria',
        day,
        round: day,
        drop,
        map: maps[drop - 1] || '',
        name,
        team: extra.teams[teamIndex],
        kills,
        damage,
        assists,
        matches: 1,
        mvp,
        roleShort: '',
        country: 'br',
        rookie: false
      };
    });

    const aggregateRows = rounds => {
      const rows = new Map();
      rounds.forEach(round => (round.results || []).forEach(result => {
        const team = result.team;
        if (!team) return;
        if (!rows.has(team)) rows.set(team, { team, position: null, points: 0, booyahs: 0, kills: 0, placementPoints: 0, matches: 0 });
        const item = rows.get(team);
        item.points += Number(result.points) || 0;
        item.booyahs += Number(result.booyah ?? result.booyahs) || 0;
        item.kills += Number(result.kills) || 0;
        item.placementPoints += Number(result.placementPoints) || 0;
        item.matches += Number(result.matches) || 1;
      }));
      const list = [...rows.values()].sort((a, b) => b.points - a.points || b.booyahs - a.booyahs || b.kills - a.kills || a.team.localeCompare(b.team, 'pt-BR'));
      list.forEach((row, index) => { row.position = index + 1; });
      return list;
    };

    window.fetch = async function(input, init) {
      const cfg = window.__WB25S2_MERGE__;
      const url = typeof input === 'string' ? input : (input && input.url) || String(input || '');

      if (cfg && url.includes('__merged-stages-r6__')) {
        const [base, extra] = await Promise.all([
          getJson(cfg.baseStagesUrl, init),
          getJson(cfg.extraUrl, init)
        ]);
        const newRounds = decodeRounds(extra, cfg.maps);
        const newKeys = new Set(newRounds.map(round => `${round.day}|${round.drop}`));
        const oldRounds = Array.isArray(base?.classificatoria?.rounds) ? base.classificatoria.rounds : [];
        const rounds = oldRounds.filter(round => !newKeys.has(`${round.day}|${round.drop}`)).concat(newRounds)
          .sort((a, b) => (Number(a.day) - Number(b.day)) || (Number(a.drop) - Number(b.drop)));
        base.classificatoria = base.classificatoria || {};
        base.classificatoria.rounds = rounds;
        base.classificatoria.rows = aggregateRows(rounds);
        base.updatedAt = cfg.updatedAt;
        base.source = 'Dias 1 a 6 enviados pelo usuário';
        return jsonResponse(base);
      }

      if (cfg && url.includes('__merged-players-r6__')) {
        const [base, extra] = await Promise.all([
          getJson(cfg.basePlayersUrl, init),
          getJson(cfg.extraUrl, init)
        ]);
        const additions = decodePlayers(extra, cfg.maps);
        const additionKeys = new Set(additions.map(keyOf));
        const oldEntries = Array.isArray(base?.entries) ? base.entries : [];
        base.entries = oldEntries.filter(entry => !additionKeys.has(keyOf(entry))).concat(additions);
        base.updatedAt = cfg.updatedAt;
        base.source = 'Dias 1 a 6 enviados pelo usuário';
        return jsonResponse(base);
      }

      return nativeFetch(input, init);
    };

    window.__WB25S2_FETCH_PATCHED__ = true;
  }

  window.FFWS_BR_2025_S2_CONFIG = Object.freeze({
    teamsUrl: 'ffws-br-2025-s2/teams.json?v=20260904-dia1-v1',
    stagesUrl: MERGED_STAGES_URL,
    playersUrl: MERGED_PLAYERS_URL,
    datesUrl: 'ffws-br-2025-s2/dates.json?v=20260904-dia1-v1',
    layout: { classificatoria: { defaultMaps: [
      {value:'Bermuda',label:'Bermuda'},{value:'Purgatório',label:'Purgatório'},{value:'Alpine',label:'Alpine'},{value:'Nova Terra',label:'Nova Terra'},{value:'Kalahari',label:'Kalahari'},{value:'Solara',label:'Solara'}
    ] } }
  });
})();
