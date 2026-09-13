(()=>{
  const liveVersion=Date.now();

  const SECOND_PHASE_SEED = Object.freeze([
    Object.freeze({ team: 'LOS', sourcePosition: 1, bonus: 50 }),
    Object.freeze({ team: 'LOUD SNICKERS', sourcePosition: 2, bonus: 42 }),
    Object.freeze({ team: 'FLUXO W7M', sourcePosition: 3, bonus: 35 }),
    Object.freeze({ team: 'INTZ', sourcePosition: 4, bonus: 29 }),
    Object.freeze({ team: 'TEAM SOLID', sourcePosition: 5, bonus: 24 }),
    Object.freeze({ team: 'RISE GAMING', sourcePosition: 6, bonus: 19 }),
    Object.freeze({ team: 'ALPHA7', sourcePosition: 7, bonus: 15 }),
    Object.freeze({ team: 'RUSH GAMING', sourcePosition: 8, bonus: 11 }),
    Object.freeze({ team: 'INFLUENCE RAGE', sourcePosition: 9, bonus: 8 }),
    Object.freeze({ team: 'CPT VOX', sourcePosition: 10, bonus: 5 }),
    Object.freeze({ team: 'AFROGAMES', sourcePosition: 11, bonus: 2 }),
    Object.freeze({ team: 'SX TET', sourcePosition: 12, bonus: 0 })
  ]);

  const normalizeTeam = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  let worldTeamKeys = SECOND_PHASE_SEED.slice(0, 2).map(item => normalizeTeam(item.team));
  let paintScheduled = false;

  function paintWorldPlayers() {
    paintScheduled = false;
    const world = new Set(worldTeamKeys);
    document.querySelectorAll('#ffws-br-s2-mvp-content .ffws-s2-mvp-main-row').forEach(row => {
      const teamImage = row.querySelector('td:nth-child(3) .ffws-s2-team-cell img');
      const teamName = teamImage?.getAttribute('alt') || '';
      row.classList.toggle('cff-s2-world-player-row', world.has(normalizeTeam(teamName)));
    });
  }

  function scheduleWorldPlayerPaint() {
    if (paintScheduled) return;
    paintScheduled = true;
    requestAnimationFrame(paintWorldPlayers);
  }

  function injectSecondPhasePolish() {
    if (document.getElementById('cff-s2-second-phase-polish')) return;
    const style = document.createElement('style');
    style.id = 'cff-s2-second-phase-polish';
    style.textContent = `
      #ffws-br-s2-segunda-fase .ffws-s2-row-world{box-shadow:inset 4px 0 #ffc226!important;background:linear-gradient(90deg,rgba(255,194,38,.13),rgba(255,194,38,.035))!important}
      #ffws-br-s2-segunda-fase .ffws-s2-row-world td:first-child{color:#ffd45a!important}
      #ffws-br-s2-segunda-fase .ffws-s2-row-final{box-shadow:none!important;background:rgba(255,255,255,.012)!important}
      #ffws-br-s2-mvp-content .cff-s2-world-player-row>td:nth-child(3){background:linear-gradient(90deg,rgba(255,194,38,.15),rgba(255,194,38,.045))!important;box-shadow:inset 3px 0 #ffc226}
      #ffws-br-s2-mvp-content .cff-s2-world-player-row>td:nth-child(3) .ffws-s2-team-name strong{color:#ffd45a!important}
      @media(max-width:760px){
        #ffws-br-s2-mvp-content .ffws-s2-mvp-table th:nth-child(2),#ffws-br-s2-mvp-content .ffws-s2-mvp-table td:nth-child(2){width:44%;padding-left:4px!important;padding-right:4px!important}
        #ffws-br-s2-mvp-content .ffws-s2-mvp-table th:nth-child(3),#ffws-br-s2-mvp-content .ffws-s2-mvp-table td:nth-child(3){width:24%;padding-left:10px!important;padding-right:10px!important}
        #ffws-br-s2-mvp-content .ffws-s2-mvp-table th:nth-child(4),#ffws-br-s2-mvp-content .ffws-s2-mvp-table td:nth-child(4),#ffws-br-s2-mvp-content .ffws-s2-mvp-table th:nth-child(7),#ffws-br-s2-mvp-content .ffws-s2-mvp-table td:nth-child(7){width:16%;padding-left:4px!important;padding-right:4px!important}
        #ffws-br-s2-mvp-content .ffws-s2-mvp-table td:nth-child(3) .ffws-s2-team-cell{justify-content:flex-start!important;gap:4px!important;min-width:0}
        #ffws-br-s2-mvp-content .ffws-s2-mvp-table td:nth-child(3) .ffws-s2-team-name{display:flex!important;min-width:0;overflow:hidden}
        #ffws-br-s2-mvp-content .ffws-s2-mvp-table td:nth-child(3) .ffws-s2-team-name strong{display:block;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.69rem}
        #ffws-br-s2-mvp-content .ffws-s2-mvp-table td:nth-child(3) .ffws-s2-team-cell img{width:20px!important;height:20px!important;flex:0 0 20px}
      }
    `;
    document.head.appendChild(style);
    const observer = new MutationObserver(scheduleWorldPlayerPaint);
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleWorldPlayerPaint();
  }

  injectSecondPhasePolish();

  window.FFWS_BR_2026_S2_CONFIG = Object.freeze({
    teamsUrl: 'ffws-br-2026-s2/teams.json?v=20260902-wliu-sx-v31',
    stagesUrl: `ffws-br-2026-s2/stages.json?v=${liveVersion}`,
    playersUrl: `ffws-br-2026-s2/players.json?v=${liveVersion}`,
    datesUrl: 'ffws-br-2026-s2/dates.json?v=20260913-classificatoria-final-v2',
    secondPhaseSeed: SECOND_PHASE_SEED,
    layout: {
      classificatoria: {
        participantsTitle: 'Times Participantes',
        classificationTitle: 'Classificação Final',
        format: {
          kicker: 'WB 2026 S2',
          title: 'Formato da Classificatória',
          description: '14 equipes • 14 rodadas • duas equipes ficaram de folga por rodada • os 12 melhores avançaram para a Segunda Fase • os dois últimos foram rebaixados.',
          legends: [
            { className: 'br-legend-final', range: '1º ao 12º', label: 'classificados para a Segunda Fase' },
            { className: 'br-legend-relegated', range: '13º ao 14º', label: 'rebaixados diretamente' }
          ],
          details: {
            summary: 'Ver detalhes do novo formato',
            intro: '<strong>Segunda Fase:</strong> 12 equipes, seis rodadas e bônus de pontuação baseado na Classificatória.',
            items: [
              'O 1º e o 2º colocados da Segunda Fase garantem vaga no Mundial.',
              'As 12 equipes disputam a Final em dois dias.',
              'A Final será jogada no formato <strong>Champion Rush</strong>, com linha de chegada em <strong>160 pontos</strong>.',
              'Caso o campeão já esteja entre os dois classificados, a vaga será repassada ao próximo melhor colocado da Final.'
            ]
          }
        },
        defaultMaps: [
          { value: 'Bermuda', label: 'Bermuda' },
          { value: 'Kalahari', label: 'Kalahari' },
          { value: 'Purgatory', label: 'Purgatório' },
          { value: 'Nexterra', label: 'Nova Terra' },
          { value: 'Solara', label: 'Solara' }
        ],
        zones: [
          { from: 1, to: 12, rowClass: 'br-row-final', cellClass: 'br-status-final', title: 'Classificado' },
          { from: 13, to: 14, rowClass: 'br-row-relegated', cellClass: 'br-status-relegated', title: 'Rebaixado' }
        ]
      }
    }
  });

  if (!window.__CFF_2026_S2_SECOND_PHASE_SEED_PATCH__) {
    window.__CFF_2026_S2_SECOND_PHASE_SEED_PATCH__ = true;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await nativeFetch(...args);
      const input = args[0];
      const requestUrl = typeof input === 'string' ? input : (input && input.url) || '';
      if (!requestUrl.includes('ffws-br-2026-s2/stages.json') || !response.ok) return response;

      try {
        const payload = await response.clone().json();
        if (!payload || typeof payload !== 'object') return response;

        if (payload.classificatoria && typeof payload.classificatoria === 'object') payload.classificatoria.finished = true;
        if (!payload.segundaFase || typeof payload.segundaFase !== 'object') payload.segundaFase = { finished: false, bonus: [], rounds: [], rows: [] };

        const existingRows = Array.isArray(payload.segundaFase.rows) ? payload.segundaFase.rows : [];
        const existingByTeam = new Map(existingRows.map(row => [String(row?.team || '').trim().toUpperCase(), row]));
        payload.segundaFase.bonus = SECOND_PHASE_SEED.map(item => ({ team: item.team, sourcePosition: item.sourcePosition, bonus: item.bonus }));
        payload.segundaFase.rows = SECOND_PHASE_SEED.map(item => {
          const current = existingByTeam.get(item.team.toUpperCase()) || {};
          const hasSecondPhaseMatches = Number(current.matches || 0) > 0;
          return { ...current, team: item.team, sourcePosition: item.sourcePosition, bonus: item.bonus, position: hasSecondPhaseMatches ? current.position : item.sourcePosition, points: hasSecondPhaseMatches ? Number(current.points || 0) : item.bonus, booyahs: Number(current.booyahs || 0), kills: Number(current.kills || 0), placementPoints: Number(current.placementPoints || 0), matches: Number(current.matches || 0) };
        });

        const worldRows = [...payload.segundaFase.rows].sort((a, b) => Number(a.position || 999) - Number(b.position || 999) || Number(b.points || 0) - Number(a.points || 0));
        worldTeamKeys = worldRows.slice(0, 2).map(row => normalizeTeam(row.team));
        scheduleWorldPlayerPaint();

        const headers = new Headers(response.headers);
        headers.set('content-type', 'application/json; charset=utf-8');
        return new Response(JSON.stringify(payload), { status: response.status, statusText: response.statusText, headers });
      } catch (error) {
        console.warn('[CFF] Não foi possível aplicar o fechamento da Classificatória/Segunda Fase:', error);
        return response;
      }
    };
  }

  if (document.querySelector('script[data-cff-s2-player-evolution]')) return;
  const script = document.createElement('script');
  script.src = 'js/s2-player-evolution.min.js?v=20260905-s2-player-evolution-v2';
  script.async = true;
  script.dataset.cffS2PlayerEvolution = '1';
  document.head.appendChild(script);
})();
