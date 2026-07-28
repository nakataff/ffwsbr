FFWS BRASIL 2026 SPLIT 2

Arquivos:
- teams.json: equipes, abreviações, logos e futuros elencos.
- stages.json: formato, classificações e resultados por rodada/queda.
- players.json: estatísticas individuais para Ranking MVP, Notas CFF, Seleções e Comparar 1V1.
- dates.json: calendário das três etapas.
- config.js: diferenças da temporada e variáveis do layout compartilhado.
- s2.js / s2.css: lógica e estilos exclusivos das páginas da S2.

LAYOUT COMPARTILHADO
A Classificatória da S1 e da S2 usa o mesmo renderizador:
- js/ffws-br-season-layout.min.js
- css/ffws-br-season-layout.css

Não copie novamente o HTML da FFWS BR 2026 S1. Para alterar título, formato,
legendas, mapas ou zonas de classificação da S2, edite apenas config.js.
O renderizador compartilhado cuida de participantes, painel de formato,
filtros, tabela, nomes completos no desktop e abreviações no mobile.

Logos pendentes:
- AFROGAMES
- CPT VOX
- SX TET

Formato esperado de uma rodada em stages.json:
{
  "number": 1,
  "map": "Bermuda",
  "results": [
    {"team":"ALPHA7","position":1,"placementPoints":12,"kills":10,"points":22,"booyah":1}
  ]
}

Na Final, use days[].matches[] para manter os filtros por dia, mapa e queda.
