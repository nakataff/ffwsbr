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

  // A Classificatória foi encerrada em 13/09. Enquanto o gerador ainda mantém
  // "finished: false" no JSON bruto, normaliza o payload para o estado oficial
  // e injeta os 12 classificados com os bônus iniciais da Segunda Fase.
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

        if (payload.classificatoria && typeof payload.classificatoria === 'object') {
          payload.classificatoria.finished = true;
        }

        if (!payload.segundaFase || typeof payload.segundaFase !== 'object') {
          payload.segundaFase = { finished: false, bonus: [], rounds: [], rows: [] };
        }

        const existingRows = Array.isArray(payload.segundaFase.rows) ? payload.segundaFase.rows : [];
        const existingByTeam = new Map(existingRows.map(row => [String(row?.team || '').trim().toUpperCase(), row]));

        payload.segundaFase.bonus = SECOND_PHASE_SEED.map(item => ({
          team: item.team,
          sourcePosition: item.sourcePosition,
          bonus: item.bonus
        }));

        payload.segundaFase.rows = SECOND_PHASE_SEED.map(item => {
          const current = existingByTeam.get(item.team.toUpperCase()) || {};
          const hasSecondPhaseMatches = Number(current.matches || 0) > 0;
          return {
            ...current,
            team: item.team,
            sourcePosition: item.sourcePosition,
            bonus: item.bonus,
            position: hasSecondPhaseMatches ? current.position : item.sourcePosition,
            points: hasSecondPhaseMatches ? Number(current.points || 0) : item.bonus,
            booyahs: Number(current.booyahs || 0),
            kills: Number(current.kills || 0),
            placementPoints: Number(current.placementPoints || 0),
            matches: Number(current.matches || 0)
          };
        });

        const headers = new Headers(response.headers);
        headers.set('content-type', 'application/json; charset=utf-8');
        return new Response(JSON.stringify(payload), {
          status: response.status,
          statusText: response.statusText,
          headers
        });
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
