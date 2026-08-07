window.FFWS_BR_2026_S1_CONFIG = Object.freeze({
  id: '2026-s1',
  label: 'WB 2026 S1',
  layout: {
    classificatoria: {
      participantsTitle: 'Divisão de Grupos',
      classificationTitle: 'Classificação Geral',
      groups: ['A', 'B', 'C', 'D'],
      format: {
        kicker: 'WB 2026 S1',
        title: 'Formato da fase de grupos',
        description: '21 de março a 24 de maio de 2026 • 16 equipes divididas em 4 grupos • 10 semanas, com rodadas aos sábados e domingos • 120 quedas em 20 dias de jogo • cada equipe joga 90 quedas.',
        legends: [
          { className: 'br-legend-ewc', range: '1º', label: 'avança para a Grand Finals e garante vaga na Esports World Cup' },
          { className: 'br-legend-final', range: '2º ao 12º', label: 'avançam para a Grand Finals' },
          { className: 'br-legend-eliminated', range: '13º ao 14º', label: 'estão eliminados' },
          { className: 'br-legend-relegated', range: '15º ao 16º', label: 'estão rebaixados para a LAFF' }
        ],
        details: {
          summary: 'Ver detalhes do Champion Rush',
          intro: '<strong>Grand Finals:</strong> 30 e 31 de maio de 2026, com 12 equipes.',
          items: [
            'Na Grand Finals, as equipes jogam normalmente até uma delas alcançar a pontuação pré-definida chamada <strong>Champion Rush Point</strong>.',
            'Depois que uma equipe atinge o <strong>Champion Rush Point</strong>, as próximas quedas passam a ser <strong>Champion Rush Point Eligible</strong> para essa equipe.',
            'A primeira equipe a fazer um Booyah enquanto estiver <strong>Champion Rush Point Eligible</strong> será coroada campeã automaticamente.',
            'O máximo da final é de <strong>16 quedas</strong>. Se ninguém fechar o Champion Rush com Booyah, vence a equipe com mais pontos ao final das quedas.',
            'O <strong>Champion Rush Point</strong> deste torneio é <strong>160</strong>.'
          ]
        }
      },
      maps: [
        { value: 'Bermuda', label: 'Bermuda' },
        { value: 'Kalahari', label: 'Kalahari' },
        { value: 'Purgatório', label: 'Purgatório' },
        { value: 'Nova Terra', label: 'Nova Terra' },
        { value: 'Solara', label: 'Solara' }
      ],
      zones: [
        { from: 1, to: 1, rowClass: 'br-row-ewc', cellClass: 'br-status-ewc', title: 'Grand Finals + Esports World Cup' },
        { from: 2, to: 12, rowClass: 'br-row-final', cellClass: 'br-status-final', title: 'Grand Finals' },
        { from: 13, to: 14, rowClass: 'br-row-eliminated', cellClass: 'br-status-eliminated', title: 'Eliminado' },
        { from: 15, to: 16, rowClass: 'br-row-relegated', cellClass: 'br-status-relegated', title: 'Rebaixado para LAFF' }
      ]
    }
  }
});
