FFWS BRASIL 2026 SPLIT 2

Arquivos:
- teams.json: equipes, abreviações, logos e futuros elencos.
- stages.json: formato, classificações e resultados por rodada/queda.
- players.json: estatísticas individuais para Ranking MVP, Notas CFF, Seleções e Comparar 1V1.
- dates.json: calendário das três etapas.
- s2.js / s2.css: páginas e layout responsivo.

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
