# Equipes do Mundial 2026

Lista: `/ffws-global-2026/equipes`. Cada equipe tem uma página própria, por exemplo:
`/ffws-global-2026/equipe?time=btr`. Os cards da home e do Início usam esses links.
A rota `equipe/index.html` preserva o ID ao atualizar a página; links antigos em
`/equipes?time=btr` também redirecionam para a página completa. Não há modal.

## Atualizar sem duplicar o cadastro

- **Elenco e comissão:** editar somente `ffws-global-2026/players.json`, lista `players`.
  Cada pessoa tem `name`, `team` (nome exato de `teams.json`), `order`, `type`
  (`player` ou `staff`), `country` (código da bandeira, como `br`, `id`, `vn`, `th`)
  e, opcionalmente, `role` (Coach, Analista, Manager etc.).
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

## Cobertura em 26/10/2026

120 jogadores das 24 equipes, cinco por elenco, a partir do texto e dos dois prints
fornecidos pelo administrador. Foram completadas LYON, as três equipes brasileiras,
América Latina, América do Norte, Bangladesh, Paquistão, Nepal, MENA, África e Índia;
as oito equipes do Sudeste Asiático foram preservadas e revisadas no mesmo envio.
Funções de jogo vêm do texto: Rusher, Granadeiro, Suporte, Sniper e Rifler.
119 jogadores têm país informado. Ericka (Stellar Esport) permanece com país a
confirmar, ausente no texto e no print; Lotex segue `ni` (Nicarágua), conforme o
campo explícito do texto. Nomes vazios de coaches foram ignorados; não foram
inventados comissão, titulares ou resultados.

## Custo e regras

`equipes.js` baixa somente `equipes-resumo.json` (aproximadamente 42 KB sem compressão)
na primeira abertura. Esse arquivo inclui os 24 times, elenco, seis rodadas por equipe
na Fase 1 e estatísticas resumidas. Buscar, filtrar, abrir comissão, trocar etapa e
compartilhar reutilizam a memória da página. O mesmo template serve aos 24 times. Não usa Firebase, Durable Objects, polling nem
os arquivos detalhados do torneio. Logos reaproveitam os arquivos locais existentes;
o resolvedor compartilhado do site continua podendo aplicar o cache central já usado.

Sem dados mostra “—”; desempenho real com zero mostra `0`. Estatísticas são exclusivas
do Mundial 2026, agregadas por nome **e equipe**, sem puxar o histórico de homônimos.
A Fase 2 pode mostrar totais descritivos de abates/quedas, mas não uma classificação
acumulada: seus pontos são zerados a cada dia. A página completa usa o shell e o menu do Mundial: cabeçalho, desempenho, elenco/
comissão, agenda e demais participantes do grupo. Links nativos permitem abrir em
nova aba e voltar pelo navegador. O PC usa colunas; o celular empilha as seções.

Regressões: `test/global-teams.test.cjs`, `test/global-overview.test.cjs` e
`test/global-format-2026.test.cjs`, incluídas na CI do Mundial.

## Cards e bandeiras

A lista usa cards compactos com equipe/escudo, selo Classificado, competição e
colocação da vaga conquistada, abas Elenco/Comissão e linhas individuais. O botão
pequeno recolhe o elenco; estado das abas e recolhimento resiste à busca e ao filtro
dentro da mesma visita. Nome, escudo e rodapé continuam abrindo a página da equipe.
As abas aceitam setas, Home/End e teclado; não abrem uma janela flutuante.

As bandeiras vêm da pasta `flag` fornecida pelo Matheus: `country: "id"` usa
`/flag/id.webp`. Cada pessoa tem seu próprio país. ONIC tem POOM (th) e quatro
jogadores da Indonésia (id); não inferir país somente pela equipe. País ausente ou
arquivo com falha mostra um marcador neutro, nunca um escudo de organização.
Bandeiras também aparecem no elenco da página completa. Os arquivos são locais,
carregados sob demanda, e trocar abas/filtros não baixa outro JSON nem consulta banco.

As nacionalidades dos 35 jogadores dos sete primeiros elencos vêm das bandeiras
da referência enviada pelo administrador; as dos cinco da Buriram foram conferidas em:
- https://esports.ff.gameid.garena.co.id/tim/buriram-united-esports/ffws-sea-2026-spring
- https://liquipedia.net/freefire/GETHIGH (registra GETNA como outro nickname)
Nenhum elenco/nickname foi substituído pelo de outra competição durante essa conferência.

As bandeiras individuais também são preservadas em `inicio-elencos.json` e exibidas
na aba Equipes do Início do Mundial. O arquivo continua carregado somente nessa aba.
