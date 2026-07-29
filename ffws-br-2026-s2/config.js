window.FFWS_BR_2026_S2_CONFIG = Object.freeze({
  teamsUrl: 'ffws-br-2026-s2/teams.json?v=20260728-calendar-v1',
  stagesUrl: 'ffws-br-2026-s2/stages.json?v=20260728-calendar-v1',
  playersUrl: 'ffws-br-2026-s2/players.json?v=20260728-rosters-v2',
  datesUrl: 'ffws-br-2026-s2/dates.json?v=20260728-calendar-v1',
  layout: {
    classificatoria: {
      participantsTitle: 'Times Participantes',
      classificationTitle: 'Classificação Geral',
      format: {
        kicker: 'WB 2026 S2',
        title: 'Formato da Classificatória',
        description: '14 equipes • 14 rodadas • duas equipes ficam de folga por rodada • os 12 melhores avançam para a Segunda Fase • os dois últimos são rebaixados.',
        legends: [
          { className: 'br-legend-final', range: '1º ao 12º', label: 'avançam para a Segunda Fase' },
          { className: 'br-legend-relegated', range: '13º ao 14º', label: 'são rebaixados diretamente' }
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
        { from: 1, to: 12, rowClass: 'br-row-final', cellClass: 'br-status-final', title: 'Segunda Fase' },
        { from: 13, to: 14, rowClass: 'br-row-relegated', cellClass: 'br-status-relegated', title: 'Rebaixado' }
      ]
    }
  }
});
