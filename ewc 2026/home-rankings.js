(function () {
  'use strict';

  const FINAL_URL = 'ewc%202026/final.json?v=20260718-home-rankings-v1';
  const PLAYERS_URL = 'ewc%202026/abates.json?v=20260718-home-rankings-v1';
  const TEAMS_URL = 'ewc%202026/times.json?v=20260718-home-rankings-v1';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();
  }

  async function getJson(url) {
    const response = await fetch(url, { cache: 'default' });
    if (!response.ok) throw new Error(`Falha ao carregar ${url}`);
    return response.json();
  }

  function buildTeamMaps(payload) {
    const byAlias = new Map();
    const list = Array.isArray(payload?.teams) ? payload.teams : [];

    list.forEach(team => {
      const aliases = new Set([
        team.name,
        team.abbreviation,
        team.dataName,
        ...(Array.isArray(team.aliases) ? team.aliases : [])
      ].filter(Boolean));

      aliases.forEach(alias => byAlias.set(normalize(alias), team));
    });

    return byAlias;
  }

  function findTeam(teamMaps, name) {
    return teamMaps.get(normalize(name)) || null;
  }

  function aggregateFinalPlayers(payload) {
    const entries = Array.isArray(payload?.entries) ? payload.entries : [];
    const players = new Map();

    entries
      .filter(entry => entry?.stage === 'final')
      .forEach(entry => {
        const name = String(entry.name || entry.sourceName || '').trim();
        const team = String(entry.team || '').trim();
        if (!name) return;

        const key = `${normalize(name)}__${normalize(team)}`;
        if (!players.has(key)) {
          players.set(key, {
            name,
            team,
            kills: 0,
            damage: 0,
            assists: 0,
            matches: 0
          });
        }

        const player = players.get(key);
        player.kills += Number(entry.kills) || 0;
        player.damage += Number(entry.damage) || 0;
        player.assists += Number(entry.assists) || 0;
        player.matches += Number(entry.matches) || 0;
      });

    return [...players.values()]
      .sort((a, b) => b.kills - a.kills || b.damage - a.damage || b.assists - a.assists || a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, 6);
  }

  function setWidgetTitle(tbody, title) {
    const heading = tbody?.closest('.home-widget')?.querySelector('h3');
    if (heading) heading.textContent = title;
  }

  function configureButtons(teamBody, playerBody) {
    const teamButton = teamBody?.closest('.home-widget')?.querySelector('button');
    if (teamButton) {
      teamButton.textContent = 'VER FINAL →';
      teamButton.setAttribute('onclick', "navigate('ewc-final')");
    }

    const playerButton = playerBody?.closest('.home-widget')?.querySelector('button');
    if (playerButton) {
      playerButton.textContent = 'VER RANKING MVP →';
      playerButton.setAttribute('onclick', "navigate('ewc-mvp')");
    }
  }

  function attachClicks(root) {
    root.querySelectorAll('[data-ewc-team]').forEach(element => {
      element.addEventListener('click', () => {
        const team = element.getAttribute('data-ewc-team');
        if (typeof window.openEWCTeamProfile === 'function') window.openEWCTeamProfile(team);
        else if (typeof window.navigate === 'function') window.navigate('ewc-equipes');
      });
    });

    root.querySelectorAll('[data-ewc-player]').forEach(element => {
      element.addEventListener('click', () => {
        const player = element.getAttribute('data-ewc-player');
        const team = element.getAttribute('data-ewc-player-team') || '';
        if (typeof window.openEWCPlayerProfile === 'function') window.openEWCPlayerProfile(player, team);
        else if (typeof window.navigate === 'function') window.navigate('ewc-mvp');
      });
    });
  }

  async function renderEwcHomeRankings() {
    const teamBody = document.getElementById('home-tbody-teams');
    const playerBody = document.getElementById('home-tbody-players');
    if (!teamBody || !playerBody) return;

    setWidgetTitle(teamBody, '🏆 Top 6 Times da Final da EWC');
    setWidgetTitle(playerBody, '🎯 Top 6 Jogadores da Final da EWC');
    configureButtons(teamBody, playerBody);

    teamBody.innerHTML = '<tr><td colspan="3" style="color:var(--text-muted);text-align:center;padding:14px;">Carregando classificação da EWC...</td></tr>';
    playerBody.innerHTML = '<tr><td colspan="3" style="color:var(--text-muted);text-align:center;padding:14px;">Carregando jogadores da EWC...</td></tr>';

    try {
      const [finalData, playerData, teamData] = await Promise.all([
        getJson(FINAL_URL),
        getJson(PLAYERS_URL),
        getJson(TEAMS_URL)
      ]);

      const teamMaps = buildTeamMaps(teamData);
      const topTeams = [...(Array.isArray(finalData?.rows) ? finalData.rows : [])]
        .sort((a, b) => Number(a.position || 999) - Number(b.position || 999))
        .slice(0, 6);
      const topPlayers = aggregateFinalPlayers(playerData);

      teamBody.innerHTML = topTeams.length ? topTeams.map((row, index) => {
        const team = findTeam(teamMaps, row.team);
        const displayName = team?.abbreviation || row.team;
        const logo = team?.logo || 'escudo.webp';
        return `<tr>
          <td style="color:var(--accent);font-weight:bold;">${index + 1}º</td>
          <td class="clickable" data-ewc-team="${escapeHtml(row.team)}" style="text-align:left;border-bottom:none;">
            <div style="display:flex;align-items:center;gap:8px;">
              <img src="${escapeHtml(logo)}" onerror="this.onerror=null;this.src='escudo.webp'" alt="${escapeHtml(row.team)}" style="width:20px;height:20px;object-fit:contain;">
              <span style="font-weight:bold;color:#fff;">${escapeHtml(displayName)}</span>
            </div>
            <div style="font-size:.75em;color:#888;margin-left:28px;">${Number(row.booyahs) || 0} B! • ${Number(row.kills) || 0} K • ${Number(row.matches) || 0} Q</div>
          </td>
          <td style="color:var(--accent);font-weight:bold;">${Number(row.points) || 0}</td>
        </tr>`;
      }).join('') : '<tr><td colspan="3" style="color:var(--text-muted);text-align:center;padding:14px;">Resultados da Final ainda não encontrados.</td></tr>';

      playerBody.innerHTML = topPlayers.length ? topPlayers.map((player, index) => {
        const team = findTeam(teamMaps, player.team);
        const teamName = team?.abbreviation || player.team || '—';
        return `<tr>
          <td style="color:var(--accent);font-weight:bold;">${index + 1}º</td>
          <td class="clickable" data-ewc-player="${escapeHtml(player.name)}" data-ewc-player-team="${escapeHtml(player.team)}" style="text-align:left;border-bottom:none;">
            <span style="font-weight:bold;color:#fff;">${escapeHtml(player.name)}</span>
            <div style="font-size:.75em;color:#888;">${escapeHtml(teamName)} • ${Number(player.matches) || 0} Q</div>
          </td>
          <td style="color:var(--accent);font-weight:bold;">${Number(player.kills) || 0}</td>
        </tr>`;
      }).join('') : '<tr><td colspan="3" style="color:var(--text-muted);text-align:center;padding:14px;">Dados de jogadores da Final ainda não encontrados.</td></tr>';

      attachClicks(teamBody);
      attachClicks(playerBody);
    } catch (error) {
      console.error('[EWC home rankings]', error);
      teamBody.innerHTML = '<tr><td colspan="3" style="color:var(--text-muted);text-align:center;padding:14px;">Não foi possível carregar a Final da EWC agora.</td></tr>';
      playerBody.innerHTML = '<tr><td colspan="3" style="color:var(--text-muted);text-align:center;padding:14px;">Não foi possível carregar o ranking da EWC agora.</td></tr>';
    }
  }

  window.cffHomeRenderFinalStats = renderEwcHomeRankings;
  window.renderEwcHomeRankings = renderEwcHomeRankings;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderEwcHomeRankings, { once: true });
  } else {
    renderEwcHomeRankings();
  }
})();
