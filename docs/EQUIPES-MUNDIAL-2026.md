# Equipes do Mundial 2026

Página: `/ffws-global-2026/equipes`. Um link direto abre a janela da equipe:
`/ffws-global-2026/equipes?time=btr`. Os cards da home também usam esses links.

## Atualizar sem duplicar o cadastro

- **Elenco e comissão:** editar somente `ffws-global-2026/players.json`, lista `players`.
  Cada pessoa tem `name`, `team` (nome exato de `teams.json`), `order`, `type`
  (`player` ou `staff`) e, opcionalmente, `role` (Coach, Analista, Manager etc.).
  Não precisa preencher jogadores ou coaches desconhecidos: a página mostra a confirmar.
  `left: true` ou `rosterStatus: "Saiu"` remove a pessoa do elenco da edição.
- **Equipes, escudos e vaga conquistada:** `teams.json`. Grupos: `groups.json`.
  A interface preserva os atributos do resolvedor compartilhado de logos e a data
  do Mundial; alterações de identidade no admin-carreiras continuam compatíveis.
- **Resultados:** coletivos em `stages.json`; individuais em `players.json → entries`.
  Cada registro individual informa `name` (ou `player`), `team`, `stage`, `kills`,
  `damage`, `assists`, e `matches` quando agregar mais de uma queda. Etapas:
  `classificatoria`, `segundaFase`, `lastChance`, `final`.
- Depois de alterar, execute `node scripts/build-global-overview.cjs`, seguido de
  `node scripts/build-global-overview.cjs --check`. Não editar os quatro resumos
  gerados à mão. Atualize as versões em `equipes.js`, `inicio.js`, `config.js`,
  no shell e no `index.html` ao publicar.

A mesma fonte atualiza a página Equipes, o Início e as páginas completas da edição.
A interface não escreve no GitHub: por enquanto, atualizar o elenco é uma edição
nessa fonte única seguida da geração offline, sem criar mais um cadastro em banco.

## Cobertura em 23/10/2026

40 jogadores de oito equipes, fornecidos pelo administrador: BTR, GOW, P Esports,
All Gamers Global, Team Flash, RRQ, ONIC e Buriram. O trecho LYON estava comentado
na origem e o da LOUD tinha nomes vazios; ambos permanecem pendentes. Nenhum coach,
função de jogo, escalação titular ou estatística foi inferido.

## Custo e regras

`equipes.js` baixa somente `equipes-resumo.json` (aproximadamente 28 KB sem compressão)
na primeira abertura. Esse arquivo inclui os 24 times, elenco, seis rodadas por equipe
na Fase 1 e estatísticas resumidas. Buscar, filtrar, abrir comissão, trocar etapa e
compartilhar reutilizam a memória. Não usa Firebase, Durable Objects, polling nem
os arquivos detalhados do torneio. Logos reaproveitam os arquivos locais existentes;
o resolvedor compartilhado do site continua podendo aplicar o cache central já usado.

Sem dados mostra “—”; desempenho real com zero mostra `0`. Estatísticas são exclusivas
do Mundial 2026, agregadas por nome **e equipe**, sem puxar o histórico de homônimos.
A Fase 2 pode mostrar totais descritivos de abates/quedas, mas não uma classificação
acumulada: seus pontos são zerados a cada dia. A janela usa `dialog` nativo, fecha
com Escape/toque fora e devolve o foco ao card. Só abre ao clicar ou usar link direto.

Regressões: `test/global-teams.test.cjs`, `test/global-overview.test.cjs` e
`test/global-format-2026.test.cjs`, incluídas na CI do Mundial.
