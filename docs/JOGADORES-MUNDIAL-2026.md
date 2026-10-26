# Jogadores do Mundial 2026

Páginas independentes, sem redirecionar para o index ou para o perfil geral:
- `/ffws-global-2026/jogadores`: lista, busca local, filtros e paginação em memória.
- `/ffws-global-2026/jogador?id=loud-trap`: perfil da edição, com etapas, agenda, companheiros, comparação e compartilhamento.

`jogadores.js` e `jogadores.css` são um único modelo reutilizado para os 120 atletas.
A lista lê `jogadores-resumo.json` (~31 KB). Cada perfil lê somente
`player-data/{id}.json` (~2 KB antes dos resultados). `player-details/{id}.json`
só é criado quando existem registros e só é buscado ao abrir Rodadas e quedas.
O índice da comparação carrega apenas ao pedir uma comparação. O editor de cards
compartilháveis é o editor existente, importado por clique. Não há polling,
consultas ao Firebase/Durable Objects ou carregamento de histórico da carreira
na página do Mundial. Fotos só vêm de arquivos locais explicitamente vinculados;
sem foto usa iniciais, sem país usa marcador neutro.

## Atualização única

1. Editar `players.json`: cadastro (`players`) e resultados (`entries`).
2. Identidades e vínculos ficam em `player-identities.json`. O ID da edição é
   estável e coincide com `players[].id`; não resolver vínculos apenas pelo nick.
   `generalId` é o ID existente em `player-data/routes.json`. Os 53 vínculos
   iniciais foram conferidos por nickname/aliases E equipe; nenhum coach foi
   incluído. Os outros participantes têm perfil do Mundial normalmente, com
   perfil geral a vincular quando existir um cadastro confirmado.
3. Rodar `node scripts/build-global-overview.cjs` e
   `node scripts/build-global-players.cjs`. Os arquivos derivados não são editados
   manualmente. `--check` nos dois scripts confere a consistência. O gerador
   remove arquivos derivados obsoletos e rejeita IDs ou jogos duplicados.
4. Atualizar as versões dos consumidores em `jogadores.js`, `global-player-profile.js`,
   `jogador.html`, páginas de entrada e shell ao publicar novos resultados.

Cada entry contém `name` (ou `player`), `team`, `stage` e `kills`; opcionais:
`matches` (1 por padrão), `damage`, `assists`, `round`, `day`, `drop`, `date`, `map`.
Etapas: `classificatoria`, `segundaFase`, `lastChance`, `final`.
Zero é resultado válido. Campos ausentes são nulos, não zero. Entradas agregadas
com `matches > 1` não viram recorde de uma queda. Registros com rodada/dia/queda
conhecidos permitem destaques e histórico detalhado; registros somente agregados
continuam aparecendo com a quantidade real de quedas. A Fase 2 mostra colocações
da equipe por dia, sem classificação acumulada. Ranking de abates é derivado dos
registros da edição, sem atribuir prêmio oficial de MVP.

## Perfil geral

`js/global-player-manifest.js` é gerado com os vínculos explícitos e é pequeno.
`js/global-player-profile.js` só busca dados do Mundial para um ID desse manifesto,
ignora staff e valida o ID de retorno. O leitor existente `player-page.min.js`
carrega esse resumo em paralelo às suas hidratações e mescla depois delas.
Um bloco próprio mostra equipe, abates, quedas, média e link da edição. Antes das
partidas, números são traços e não entram nos totais históricos. Depois de jogar,
o histórico recebe uma edição com link, e os totais aplicam apenas a diferença
para um registro existente da mesma edição, evitando duplicação. Falha no resumo
não bloqueia o perfil normal. Não modifica equipe atual nem outras temporadas.

Testes: `test/global-players.test.cjs` e `test/global-player-bridge.test.cjs`, além
das regressões existentes de equipes, Início, formato e compartilhamento.
