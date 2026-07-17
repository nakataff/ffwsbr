window.EWC_2026_CONFIG = {
  // Durante o torneio, deixe como "spreadsheet".
  // Depois do fim, troque para "json" e atualize os arquivos JSON finais.
  source: 'spreadsheet',

  // Publique cada aba da planilha e cole aqui o link com output=tsv.
  // Classificação: posição, equipe, grupo, quedas, booyahs, kills, pontos e status.
  standingsTsvUrl: '',

  // Ranking: jogador, equipe, bandeira/país, posição, kills, quedas,
  // dano, assistências e MVP. Só jogador, equipe e kills são obrigatórios.
  killsTsvUrl: '',

  // Planilha geral de logos: equipe, abreviação, país e logo.
  teamLogosTsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR6Paknya4E3qRT2mLd0fQMIiBKhuGOPebF0pLK9c0Gk5nRnVWNdY4FxMJV42467JLmwNNumXSc4fCC/pub?gid=376467302&single=true&output=tsv',

  // Arquivos usados como base antes da planilha ser configurada,
  // como segurança caso a planilha fique temporariamente indisponível
  // e como fonte definitiva depois do torneio.
  standingsJsonUrl: 'ewc%202026/classificacao.json',
  killsJsonUrl: 'ewc%202026/abates.json',

  // As planilhas podem ser consultadas novamente após este intervalo.
  cacheMinutes: 2,
  logoCacheMinutes: 30
};
