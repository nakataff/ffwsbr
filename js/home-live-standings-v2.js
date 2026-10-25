(() => {
  'use strict';

  const base = String(window.CFF_CONFIG?.firebase?.databaseURL || '').replace(/\/$/, '');
  if (!base) return;

  let lives = [];
  let loading = false;
  let currentDetailsLive = null;
  let currentParsed = null;
  let currentTeamCode = '';
  let currentMapFilter = 0;

  const number = (value, fallback = 0) => {
    const parsed = Number(String(value ?? '').trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const clean = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
  const normalize = (value) => clean(value).toLowerCase();

  function parseBRT(value) {
    const text = clean(value);
    if (!text) return null;
    let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match) {
      const [, year, month, day, hour, minute, second = '00'] = match;
      const date = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${minute}:${second}-03:00`);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isLiveNow(live, now) {
    const start = parseBRT(live?.inicio || live?.data_hora);
    const minutes = Math.max(0, Number(live?.duracaoMinutos || 0));
    if (!start || !minutes) return false;
    const end = new Date(start.getTime() + minutes * 60000);
    return now >= start && now <= end;
  }

  function isTournamentFinished(live) {
    const completed = Math.max(0, Number(live?.standings?.completedMaps || 0));
    const total = Math.max(0, Number(live?.standings?.totalMaps || 0));
    return total > 0 && completed >= total;
  }

  function shouldShow(live, now) {
    if (!live?.standings?.enabled) return false;
    if (isLiveNow(live, now)) return true;
    if (!live?.standingsKeepVisible) return false;
    return !isTournamentFinished(live);
  }

  function parseLiquipedia(standings) {
    const raw = String(standings?.rawCode || '');
    const savedSource = Array.isArray(standings?.teams) ? standings.teams : Object.values(standings?.teams || {});
    const savedNames = new Map(savedSource.map(team => [normalize(team?.code), clean(team?.name || team?.code)]).filter(([key]) => key));

    if (!raw.trim()) {
      const matchPoint = number(standings?.matchPoint, 0);
      const teams = savedSource.map((team, index) => {
        const mapRows = (Array.isArray(team?.mapRows) ? team.mapRows : Object.values(team?.mapRows || {}))
          .map(row => ({
            map: number(row?.map),
            mapName: clean(row?.mapName),
            placement: number(row?.placement),
            kills: number(row?.kills),
            placementPoints: number(row?.placementPoints),
            killPoints: number(row?.killPoints),
            points: number(row?.points),
            cumulative: number(row?.cumulative)
          }))
          .filter(row => row.map > 0)
          .sort((a, b) => a.map - b.map);
        let cumulative = 0;
        mapRows.forEach(row => {
          cumulative += row.points;
          if (!row.cumulative) row.cumulative = cumulative;
        });
        return {
          code: clean(team?.code),
          name: clean(team?.name || team?.code),
          sourceOrder: index,
          mapRows
        };
      }).filter(team => team.code || team.name);
      const completedMaps = Math.max(number(standings?.completedMaps), ...teams.flatMap(team => team.mapRows.map(row => row.map)), 0);
      return { matchPoint, pKill: number(standings?.pKill, 1), placement: standings?.placementPoints || {}, totalMaps: number(standings?.totalMaps), completedMaps, teams, maps: new Map() };
    }

    const pKill = number(raw.match(/\|\s*p_kill\s*=\s*(-?\d+(?:[.,]\d+)?)/i)?.[1], 1);
    const matchPoint = number(raw.match(/\|\s*matchpoint\s*=\s*(\d+(?:[.,]\d+)?)/i)?.[1], number(standings?.matchPoint, 0));
    const placement = {};
    for (let pos = 1; pos <= 12; pos += 1) {
      placement[pos] = number(raw.match(new RegExp(`\\|\\s*p${pos}\\s*=\\s*(-?\\d+(?:[.,]\\d+)?)`, 'i'))?.[1], 0);
    }

    const maps = new Map();
    const mapRx = /\|\s*map(\d+)\s*=\s*\{\{\s*Map\s*\|([^\r\n]*)/gi;
    let mapMatch;
    while ((mapMatch = mapRx.exec(raw))) {
      const map = Number(mapMatch[1]);
      const body = mapMatch[2] || '';
      const name = clean(body.match(/\|\s*map\s*=\s*([^|}\r\n]*)/i)?.[1]);
      const date = clean(body.match(/\|\s*date\s*=\s*([^|}\r\n]*)/i)?.[1]);
      maps.set(map, { map, name, date });
    }

    const explicitMapIds = [...raw.matchAll(/\|\s*map(\d+)\s*=/gi)].map(match => Number(match[1])).filter(Number.isFinite);
    const totalMaps = explicitMapIds.length ? Math.max(...explicitMapIds) : number(standings?.totalMaps, 0);

    const starts = [];
    const opponentRx = /\|\s*opponent(\d+)\s*=\s*\{\{\s*TeamOpponent\s*\|\s*([^|}\r\n]+)/gi;
    let opponentMatch;
    while ((opponentMatch = opponentRx.exec(raw))) {
      starts.push({ opponent: Number(opponentMatch[1]), code: clean(opponentMatch[2]), index: opponentMatch.index });
    }

    let completedMaps = 0;
    const teams = starts.slice(0, 12).map((item, index) => {
      const end = starts[index + 1]?.index ?? raw.length;
      const segment = raw.slice(item.index, end);
      const scoreRx = /\|\s*m(\d+)\s*=\s*\{\{\s*MS\s*\|\s*([^|}]*)\|\s*([^}]*)}}/gi;
      const mapRows = [];
      let score;
      while ((score = scoreRx.exec(segment))) {
        const map = Number(score[1]);
        const pos = Number(clean(score[2]));
        const kills = number(score[3], NaN);
        if (!Number.isInteger(pos) || pos < 1 || pos > 12 || !Number.isFinite(kills)) continue;
        const placementPoints = number(placement[pos], 0);
        const killPoints = kills * pKill;
        mapRows.push({
          map,
          mapName: maps.get(map)?.name || '',
          placement: pos,
          kills,
          placementPoints,
          killPoints,
          points: placementPoints + killPoints,
          cumulative: 0
        });
        completedMaps = Math.max(completedMaps, map);
      }
      mapRows.sort((a, b) => a.map - b.map);
      let cumulative = 0;
      mapRows.forEach(row => {
        cumulative += row.points;
        row.cumulative = cumulative;
      });
      return {
        code: item.code,
        name: savedNames.get(normalize(item.code)) || item.code.toUpperCase(),
        sourceOrder: item.opponent,
        mapRows
      };
    }).filter(team => team.code);

    return { matchPoint, pKill, placement, totalMaps, completedMaps, teams, maps };
  }

  function statsForTeam(team, throughMap = 0, matchPoint = 0) {
    const rows = team.mapRows.filter(row => !throughMap || row.map <= throughMap);
    const points = rows.reduce((sum, row) => sum + row.points, 0);
    const kills = rows.reduce((sum, row) => sum + row.kills, 0);
    const placementPoints = rows.reduce((sum, row) => sum + row.placementPoints, 0);
    const killPoints = rows.reduce((sum, row) => sum + row.killPoints, 0);
    const booyahs = rows.filter(row => row.placement === 1).length;
    const top3 = rows.filter(row => row.placement <= 3).length;
    return {
      ...team,
      rows,
      points,
      kills,
      placementPoints,
      killPoints,
      booyahs,
      top3,
      mapsPlayed: rows.length,
      cp: matchPoint > 0 && points >= matchPoint
    };
  }

  function classification(parsed, throughMap = 0) {
    return parsed.teams
      .map(team => statsForTeam(team, throughMap, parsed.matchPoint))
      .sort((a, b) => (b.points - a.points) || (b.kills - a.kills) || (a.sourceOrder - b.sourceOrder))
      .map((team, index) => ({ ...team, rank: index + 1 }));
  }

  function injectStyles() {
    if (document.getElementById('cff-live-standings-css-v3')) return;
    const style = document.createElement('style');
    style.id = 'cff-live-standings-css-v3';
    style.textContent = `
      #cff-live-standings{margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08)}
      .cff-live-standings-head{display:flex;justify-content:space-between;align-items:flex-end;gap:8px;margin-bottom:8px}.cff-live-standings-title{min-width:0}.cff-live-standings-kicker{display:block;color:#00c8ff;font-size:.58rem;font-weight:1000;letter-spacing:.8px;text-transform:uppercase}.cff-live-standings-title strong{display:block;margin-top:2px;color:#fff;font-size:.76rem;font-weight:1000;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cff-live-standings-progress{flex:0 0 auto;color:#7f9ab7;font-size:.58rem;font-weight:900;text-transform:uppercase;white-space:nowrap}
      .cff-live-standings-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:7px}.cff-live-standings-col{display:grid;gap:4px;min-width:0}.cff-live-standings-row{display:grid;grid-template-columns:18px minmax(0,1fr) auto;align-items:center;gap:4px;min-width:0;padding:6px;border:1px solid rgba(255,255,255,.065);border-radius:7px;background:rgba(255,255,255,.025);cursor:pointer}.cff-live-standings-row.is-leader{border-color:rgba(0,200,255,.24);background:rgba(0,200,255,.055)}.cff-live-standings-row.is-cp{border-color:rgba(70,167,255,.54);background:rgba(0,132,255,.18);box-shadow:inset 0 0 0 1px rgba(86,178,255,.08)}.cff-live-standings-rank{color:#728ba5;font-size:.58rem;font-weight:1000;text-align:center}.cff-live-standings-row.is-cp .cff-live-standings-rank{color:#7ecaff}.cff-live-standings-team{min-width:0;color:#eaf5ff;font-size:.62rem;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cff-live-standings-points{color:#fff;font-size:.64rem;font-weight:1000;text-align:right}.cff-live-standings-points small{font-size:.45rem;color:#66809b;margin-left:1px}.cff-live-standings-row.is-cp .cff-live-standings-points{color:#8fd4ff}
      .cff-live-standings-bottom{margin-top:8px}.cff-live-standings-details-btn{display:block;width:100%;border:1px solid rgba(0,200,255,.22);border-radius:8px;background:rgba(0,200,255,.07);color:#9fe8ff;padding:7px 9px;font-size:.56rem;font-weight:1000;text-transform:uppercase;cursor:pointer;letter-spacing:.25px}.cff-live-standings-details-btn:hover{background:rgba(0,200,255,.12)}
      .cff-details-modal[hidden]{display:none!important}.cff-details-modal{position:fixed;inset:0;z-index:999999;display:grid;place-items:center;padding:18px;background:rgba(2,7,14,.86);backdrop-filter:blur(7px)}.cff-details-dialog{width:min(1120px,100%);max-height:92vh;overflow:auto;border:1px solid rgba(0,200,255,.22);border-radius:17px;background:#09111d;color:#eef8ff;box-shadow:0 30px 90px rgba(0,0,0,.58)}.cff-details-head{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;gap:12px;padding:17px 19px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(9,17,29,.985)}.cff-details-head p{margin:0;color:#7b98b5;font-size:.68rem;font-weight:900;text-transform:uppercase}.cff-details-head h3{margin:3px 0 0;color:#16d2ff;font-size:1.18rem}.cff-details-close{width:36px;height:36px;border:1px solid rgba(255,255,255,.12);border-radius:9px;background:#111c2b;color:#fff;cursor:pointer}.cff-details-body{padding:17px 19px 22px}
      .cff-details-toolbar{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:13px}.cff-details-filter{display:grid;gap:5px;min-width:min(290px,100%)}.cff-details-filter label{color:#809bb7;font-size:.65rem;font-weight:900;text-transform:uppercase}.cff-details-filter select{width:100%;border:1px solid rgba(255,255,255,.12);border-radius:9px;background:#07101a;color:#fff;padding:10px 11px;font:inherit;font-weight:850}.cff-details-cp-legend{display:flex;align-items:center;gap:7px;color:#7893ad;font-size:.68rem}.cff-details-cp-dot{width:10px;height:10px;border-radius:3px;background:rgba(0,132,255,.55);border:1px solid rgba(108,193,255,.72)}
      .cff-overall-wrap{overflow:auto;border:1px solid rgba(255,255,255,.08);border-radius:11px}.cff-overall-table{width:100%;border-collapse:collapse;min-width:690px}.cff-overall-table th,.cff-overall-table td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.06);text-align:right;font-size:.72rem;white-space:nowrap}.cff-overall-table th{position:sticky;top:0;background:#101a28;color:#7793af;font-size:.61rem;text-transform:uppercase;z-index:1}.cff-overall-table th:nth-child(2),.cff-overall-table td:nth-child(2){text-align:left}.cff-overall-table tbody tr{cursor:pointer}.cff-overall-table tbody tr:hover td{background:rgba(255,255,255,.025)}.cff-overall-table tbody tr.is-cp td{background:rgba(0,132,255,.10)}.cff-overall-team{font-weight:950;color:#eef8ff}.cff-cp-badge{display:inline-block;margin-left:6px;padding:2px 5px;border-radius:5px;background:rgba(0,132,255,.18);border:1px solid rgba(83,177,255,.35);color:#8fd4ff;font-size:.52rem;font-weight:1000}
      .cff-team-section-title{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:17px 0 8px}.cff-team-section-title strong{font-size:.78rem;text-transform:uppercase}.cff-team-section-title span{color:#728ca7;font-size:.64rem}.cff-team-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.cff-team-card{min-width:0;padding:9px 10px;border:1px solid rgba(255,255,255,.075);border-radius:10px;background:#0b1521;color:#fff;cursor:pointer;text-align:left}.cff-team-card:hover,.cff-team-card.is-active{border-color:rgba(0,200,255,.34);background:rgba(0,200,255,.055)}.cff-team-card.is-cp{border-color:rgba(65,166,255,.42);background:rgba(0,132,255,.10)}.cff-team-card-top{display:flex;align-items:center;justify-content:space-between;gap:6px}.cff-team-card-rank{color:#7894af;font-size:.61rem;font-weight:1000}.cff-team-card-name{display:block;min-width:0;margin-top:3px;font-size:.76rem;font-weight:1000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cff-team-card-meta{display:flex;gap:8px;margin-top:5px;color:#7f9ab5;font-size:.6rem;font-weight:850}
      .cff-team-detail{margin-top:13px;padding:13px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:#07101a}.cff-team-detail-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px}.cff-team-detail-head h4{margin:0;font-size:1rem}.cff-team-detail-head p{margin:3px 0 0;color:#7691ac;font-size:.67rem}.cff-team-detail-stats{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;margin-bottom:12px}.cff-stat{padding:9px;border:1px solid rgba(255,255,255,.07);border-radius:9px;background:#0d1825}.cff-stat small{display:block;color:#708ba6;font-size:.55rem;font-weight:900;text-transform:uppercase}.cff-stat strong{display:block;margin-top:3px;font-size:.85rem}.cff-stat.is-cp{border-color:rgba(65,166,255,.35);background:rgba(0,132,255,.10)}
      .cff-insights{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-bottom:12px}.cff-insight{padding:9px;border-radius:9px;background:#0b1521;border:1px solid rgba(255,255,255,.065)}.cff-insight small{display:block;color:#708ba6;font-size:.54rem;font-weight:900;text-transform:uppercase}.cff-insight strong{display:block;margin-top:3px;font-size:.75rem;line-height:1.25}.cff-insight span{display:block;margin-top:2px;color:#7792ad;font-size:.58rem}
      .cff-map-table-wrap{overflow:auto;border:1px solid rgba(255,255,255,.075);border-radius:10px}.cff-map-table{width:100%;border-collapse:collapse;min-width:720px}.cff-map-table th,.cff-map-table td{padding:8px 9px;border-bottom:1px solid rgba(255,255,255,.055);text-align:right;font-size:.69rem;white-space:nowrap}.cff-map-table th{background:#101a28;color:#7894af;font-size:.59rem;text-transform:uppercase}.cff-map-table th:first-child,.cff-map-table td:first-child{text-align:left}.cff-map-table tr.is-cp td{background:rgba(0,132,255,.09)}
      .cff-details-empty{padding:24px;text-align:center;color:#7893ad;font-size:.75rem}.cff-details-foot{margin:10px 1px 0;color:#728ca7;font-size:.64rem;line-height:1.4}
      @media(max-width:820px){.cff-team-cards{grid-template-columns:repeat(3,minmax(0,1fr))}.cff-team-detail-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.cff-insights{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:520px){.cff-live-standings-grid{gap:5px}.cff-live-standings-row{padding:5px 4px;grid-template-columns:16px minmax(0,1fr) auto}.cff-live-standings-team{font-size:.58rem}.cff-live-standings-points{font-size:.6rem}.cff-details-modal{padding:0}.cff-details-dialog{height:100vh;max-height:100vh;border-radius:0}.cff-details-body{padding:14px}.cff-team-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.cff-team-detail-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.cff-insights{grid-template-columns:1fr}.cff-details-toolbar{align-items:stretch}.cff-details-filter{min-width:100%}}
    `;
    document.head.appendChild(style);
  }

  function makeCompactRow(team, live) {
    const row = document.createElement('div');
    row.className = `cff-live-standings-row${team.rank === 1 ? ' is-leader' : ''}${team.cp ? ' is-cp' : ''}`;
    row.title = team.cp ? 'Champion Point ativo • clique para ver os detalhes' : 'Clique para ver os detalhes';
    const rank = document.createElement('span'); rank.className = 'cff-live-standings-rank'; rank.textContent = `${team.rank}º`;
    const name = document.createElement('span'); name.className = 'cff-live-standings-team'; name.textContent = team.name; name.title = team.name;
    const points = document.createElement('span'); points.className = 'cff-live-standings-points'; points.append(document.createTextNode(String(team.points)));
    const suffix = document.createElement('small'); suffix.textContent = team.cp ? 'CP' : 'PTS'; points.appendChild(suffix);
    row.append(rank, name, points);
    row.addEventListener('click', () => openDetails(live, team.code));
    return row;
  }

  function ensureDetailsModal() {
    let modal = document.getElementById('cff-standings-details-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'cff-standings-details-modal';
    modal.className = 'cff-details-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <section class="cff-details-dialog" role="dialog" aria-modal="true" aria-labelledby="cff-details-title">
        <header class="cff-details-head"><div><p>DETALHES DA CLASSIFICAÇÃO</p><h3 id="cff-details-title">Classificação</h3></div><button class="cff-details-close" id="cff-details-close" type="button" aria-label="Fechar">×</button></header>
        <div class="cff-details-body">
          <div class="cff-details-toolbar">
            <div class="cff-details-filter"><label for="cff-details-map-filter">Classificação até a queda</label><select id="cff-details-map-filter"></select></div>
            <div class="cff-details-cp-legend" id="cff-details-cp-legend"><span class="cff-details-cp-dot"></span><span>Azul = Champion Point ativo</span></div>
          </div>
          <div class="cff-overall-wrap"><table class="cff-overall-table"><thead><tr><th>#</th><th>Time</th><th>Pontos</th><th>Q</th><th>Abates</th><th>Booyah</th><th>P. coloc.</th></tr></thead><tbody id="cff-overall-body"></tbody></table></div>
          <div class="cff-team-section-title"><strong>Detalhes por equipe</strong><span>Clique em um time</span></div>
          <div class="cff-team-cards" id="cff-team-cards"></div>
          <div class="cff-team-detail" id="cff-team-detail"></div>
          <p class="cff-details-foot" id="cff-details-foot"></p>
        </div>
      </section>`;
    document.body.appendChild(modal);
    document.getElementById('cff-details-close').onclick = closeDetails;
    document.getElementById('cff-details-map-filter').onchange = event => {
      currentMapFilter = number(event.target.value, 0);
      renderDetails();
    };
    modal.addEventListener('click', event => { if (event.target === modal) closeDetails(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden) closeDetails(); });
    return modal;
  }

  function closeDetails() {
    const modal = ensureDetailsModal();
    modal.hidden = true;
    currentDetailsLive = null;
    currentParsed = null;
    currentTeamCode = '';
    currentMapFilter = 0;
    document.body.style.removeProperty('overflow');
  }

  function openDetails(live, preferredCode = '') {
    currentDetailsLive = live;
    currentParsed = parseLiquipedia(live?.standings || {});
    currentMapFilter = 0;
    const full = classification(currentParsed, 0);
    currentTeamCode = preferredCode && full.some(team => team.code === preferredCode) ? preferredCode : (full[0]?.code || '');
    const modal = ensureDetailsModal();
    document.getElementById('cff-details-title').textContent = String(live?.standings?.title || live?.torneio || 'Classificação');
    buildMapFilter();
    renderDetails();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function buildMapFilter() {
    const select = document.getElementById('cff-details-map-filter');
    select.replaceChildren();
    const all = document.createElement('option');
    all.value = '0';
    all.textContent = 'Geral • todas as quedas concluídas';
    select.appendChild(all);
    const mapIds = [...new Set(currentParsed.teams.flatMap(team => team.mapRows.map(row => row.map)))].filter(value => value > 0).sort((a, b) => a - b);
    mapIds.forEach(map => {
      const option = document.createElement('option');
      option.value = String(map);
      const mapName = currentParsed.maps.get(map)?.name;
      option.textContent = `Até a queda ${map}${mapName ? ` • ${mapName}` : ''}`;
      select.appendChild(option);
    });
    select.value = String(currentMapFilter);
  }

  function renderDetails() {
    if (!currentDetailsLive || !currentParsed) return;
    const rows = classification(currentParsed, currentMapFilter);
    renderOverall(rows);
    renderTeamCards(rows);
    if (!rows.some(team => team.code === currentTeamCode)) currentTeamCode = rows[0]?.code || '';
    renderTeamDetail(rows);
    const matchPoint = currentParsed.matchPoint;
    const label = currentMapFilter ? `até a queda ${currentMapFilter}` : 'nas quedas concluídas';
    document.getElementById('cff-details-cp-legend').style.display = matchPoint > 0 ? 'flex' : 'none';
    document.getElementById('cff-details-foot').textContent = `${rows.length} equipes • ${label}${matchPoint > 0 ? ` • Champion Point: ${matchPoint} pontos` : ''}`;
  }

  function renderOverall(rows) {
    const tbody = document.getElementById('cff-overall-body');
    tbody.replaceChildren();
    rows.forEach(team => {
      const tr = document.createElement('tr');
      if (team.cp) tr.className = 'is-cp';
      const teamName = document.createElement('td');
      teamName.className = 'cff-overall-team';
      teamName.textContent = team.name;
      if (team.cp) {
        const badge = document.createElement('span');
        badge.className = 'cff-cp-badge';
        badge.textContent = 'CP';
        teamName.appendChild(badge);
      }
      const rank = document.createElement('td'); rank.textContent = `${team.rank}º`;
      const pts = document.createElement('td'); pts.textContent = String(team.points);
      const q = document.createElement('td'); q.textContent = String(team.mapsPlayed);
      const kills = document.createElement('td'); kills.textContent = String(team.kills);
      const booyah = document.createElement('td'); booyah.textContent = String(team.booyahs);
      const placement = document.createElement('td'); placement.textContent = String(team.placementPoints);
      tr.append(rank, teamName, pts, q, kills, booyah, placement);
      tr.addEventListener('click', () => { currentTeamCode = team.code; renderTeamCards(rows); renderTeamDetail(rows); });
      tbody.appendChild(tr);
    });
  }

  function renderTeamCards(rows) {
    const host = document.getElementById('cff-team-cards');
    host.replaceChildren();
    rows.forEach(team => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `cff-team-card${team.code === currentTeamCode ? ' is-active' : ''}${team.cp ? ' is-cp' : ''}`;
      button.innerHTML = `<div class="cff-team-card-top"><span class="cff-team-card-rank">${team.rank}º</span>${team.cp ? '<span class="cff-cp-badge">CP</span>' : ''}</div><span class="cff-team-card-name"></span><div class="cff-team-card-meta"><span>${team.points} pts</span><span>${team.kills} ab.</span><span>${team.booyahs} B</span></div>`;
      button.querySelector('.cff-team-card-name').textContent = team.name;
      button.addEventListener('click', () => { currentTeamCode = team.code; renderTeamCards(rows); renderTeamDetail(rows); });
      host.appendChild(button);
    });
  }

  function mapLabel(row) {
    const name = clean(row?.mapName || currentParsed?.maps?.get(number(row?.map))?.name);
    return `Queda ${number(row?.map)}${name ? ` • ${name}` : ''}`;
  }

  function renderTeamDetail(rows) {
    const host = document.getElementById('cff-team-detail');
    const team = rows.find(item => item.code === currentTeamCode) || rows[0];
    if (!team) { host.innerHTML = '<div class="cff-details-empty">Nenhuma equipe disponível.</div>'; return; }
    currentTeamCode = team.code;
    const played = team.rows;
    const best = [...played].sort((a, b) => (b.points - a.points) || (b.kills - a.kills) || (a.placement - b.placement))[0];
    const worst = [...played].sort((a, b) => (a.points - b.points) || (a.kills - b.kills) || (b.placement - a.placement))[0];
    const mostKills = [...played].sort((a, b) => (b.kills - a.kills) || (b.points - a.points))[0];
    const leastKills = [...played].sort((a, b) => (a.kills - b.kills) || (a.points - b.points))[0];
    const avgPoints = played.length ? (team.points / played.length).toFixed(1).replace('.', ',') : '0';
    const avgKills = played.length ? (team.kills / played.length).toFixed(1).replace('.', ',') : '0';
    const bestPlacement = played.length ? Math.min(...played.map(row => row.placement)) : 0;
    const matchPoint = currentParsed.matchPoint;

    host.innerHTML = `
      <div class="cff-team-detail-head"><div><h4></h4><p>${team.rank}º lugar • ${team.mapsPlayed} quedas analisadas</p></div>${team.cp ? '<span class="cff-cp-badge">CHAMPION POINT ATIVO</span>' : ''}</div>
      <div class="cff-team-detail-stats">
        <div class="cff-stat"><small>Pontos</small><strong>${team.points}</strong></div>
        <div class="cff-stat"><small>Abates</small><strong>${team.kills}</strong></div>
        <div class="cff-stat"><small>Booyahs</small><strong>${team.booyahs}</strong></div>
        <div class="cff-stat"><small>P. colocação</small><strong>${team.placementPoints}</strong></div>
        <div class="cff-stat"><small>Top 3</small><strong>${team.top3}</strong></div>
        <div class="cff-stat${team.cp ? ' is-cp' : ''}"><small>Champion Point</small><strong>${matchPoint ? (team.cp ? 'ATIVO' : `${team.points}/${matchPoint}`) : '—'}</strong></div>
      </div>
      <div class="cff-insights">
        <div class="cff-insight"><small>Melhor mapa</small><strong>${best ? mapLabel(best) : '—'}</strong><span>${best ? `${best.points} pts • ${best.kills} abates • ${best.placement}º` : 'Sem dados'}</span></div>
        <div class="cff-insight"><small>Pior mapa</small><strong>${worst ? mapLabel(worst) : '—'}</strong><span>${worst ? `${worst.points} pts • ${worst.kills} abates • ${worst.placement}º` : 'Sem dados'}</span></div>
        <div class="cff-insight"><small>Mais abates</small><strong>${mostKills ? `${mostKills.kills} abates` : '—'}</strong><span>${mostKills ? mapLabel(mostKills) : 'Sem dados'}</span></div>
        <div class="cff-insight"><small>Menos abates</small><strong>${leastKills ? `${leastKills.kills} abates` : '—'}</strong><span>${leastKills ? mapLabel(leastKills) : 'Sem dados'}</span></div>
        <div class="cff-insight"><small>Média de pontos</small><strong>${avgPoints}</strong><span>por queda</span></div>
        <div class="cff-insight"><small>Média de abates</small><strong>${avgKills}</strong><span>por queda</span></div>
        <div class="cff-insight"><small>Melhor colocação</small><strong>${bestPlacement ? `${bestPlacement}º` : '—'}</strong><span>${team.booyahs ? `${team.booyahs} Booyah${team.booyahs === 1 ? '' : 's'}` : 'Sem Booyah'}</span></div>
        <div class="cff-insight"><small>Pontos de abate</small><strong>${team.killPoints}</strong><span>${currentParsed.pKill} pt por abate</span></div>
      </div>
      <div class="cff-map-table-wrap"><table class="cff-map-table"><thead><tr><th>Queda / mapa</th><th>Pos.</th><th>Abates</th><th>P. coloc.</th><th>P. abates</th><th>Total</th><th>Acum.</th></tr></thead><tbody id="cff-team-map-body"></tbody></table></div>`;
    host.querySelector('h4').textContent = team.name;

    const tbody = host.querySelector('#cff-team-map-body');
    if (!played.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="7" style="text-align:center;color:#7893ad">Sem quedas processadas para este filtro.</td>';
      tbody.appendChild(tr);
      return;
    }
    let cumulative = 0;
    played.forEach(row => {
      cumulative += row.points;
      const tr = document.createElement('tr');
      if (matchPoint > 0 && cumulative >= matchPoint) tr.className = 'is-cp';
      const label = document.createElement('td'); label.textContent = mapLabel(row);
      const pos = document.createElement('td'); pos.textContent = `${row.placement}º`;
      const kills = document.createElement('td'); kills.textContent = String(row.kills);
      const pp = document.createElement('td'); pp.textContent = String(row.placementPoints);
      const kp = document.createElement('td'); kp.textContent = String(row.killPoints);
      const total = document.createElement('td'); total.textContent = String(row.points);
      const accum = document.createElement('td'); accum.textContent = String(cumulative);
      tr.append(label, pos, kills, pp, kp, total, accum);
      tbody.appendChild(tr);
    });
  }

  function render() {
    const body = document.querySelector('.home-rail-live .home-widget-body');
    if (!body) return;
    const now = new Date();
    const eligible = lives.filter(live => shouldShow(live, now)).sort((a, b) => {
      const aLive = isLiveNow(a, now) ? 1 : 0;
      const bLive = isLiveNow(b, now) ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;
      return Number(b?.standings?.updatedAt || 0) - Number(a?.standings?.updatedAt || 0);
    });
    const live = eligible[0];
    let host = document.getElementById('cff-live-standings');
    if (!live) { host?.remove(); return; }

    const parsed = parseLiquipedia(live.standings || {});
    const teams = classification(parsed, 0);
    if (!teams.length) { host?.remove(); return; }
    if (!host) { host = document.createElement('section'); host.id = 'cff-live-standings'; body.appendChild(host); }
    host.replaceChildren();

    const currentlyLive = isLiveNow(live, now);
    const head = document.createElement('div'); head.className = 'cff-live-standings-head';
    const title = document.createElement('div'); title.className = 'cff-live-standings-title';
    const kicker = document.createElement('span'); kicker.className = 'cff-live-standings-kicker'; kicker.textContent = currentlyLive ? 'TABELA AO VIVO' : 'CLASSIFICAÇÃO DA FINAL';
    const strong = document.createElement('strong'); strong.textContent = String(live.standings?.title || live.torneio || 'Classificação'); strong.title = strong.textContent;
    title.append(kicker, strong);
    const progress = document.createElement('span'); progress.className = 'cff-live-standings-progress';
    const completed = Math.max(parsed.completedMaps, Number(live.standings?.completedMaps || 0));
    const total = Math.max(parsed.totalMaps, Number(live.standings?.totalMaps || 0));
    progress.textContent = total ? `${completed}/${total} QUEDAS` : (completed ? `${completed} QUEDAS` : (currentlyLive ? 'AO VIVO' : 'EM ANDAMENTO'));
    head.append(title, progress);

    const grid = document.createElement('div'); grid.className = 'cff-live-standings-grid';
    const left = document.createElement('div'); left.className = 'cff-live-standings-col';
    const right = document.createElement('div'); right.className = 'cff-live-standings-col';
    teams.slice(0, 6).forEach(team => left.appendChild(makeCompactRow(team, live)));
    teams.slice(6, 12).forEach(team => right.appendChild(makeCompactRow(team, live)));
    grid.append(left, right);

    const bottom = document.createElement('div'); bottom.className = 'cff-live-standings-bottom';
    const details = document.createElement('button'); details.type = 'button'; details.className = 'cff-live-standings-details-btn'; details.textContent = 'Ver detalhes da classificação'; details.onclick = () => openDetails(live);
    bottom.appendChild(details);
    host.append(head, grid, bottom);
  }

  async function load() {
    if (loading) return;
    loading = true;
    try {
      const response = await fetch(`${base}/adminLives.json?standings=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      lives = Object.values(data || {});
      render();
    } catch (error) {
      console.warn('[Tabela ao vivo] Não foi possível carregar:', error);
      render();
    } finally {
      loading = false;
    }
  }

  function boot() {
    injectStyles();
    ensureDetailsModal();
    load();
    setInterval(render, 30000);
    setInterval(load, 60000);
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot, { once: true }) : boot();
})();
