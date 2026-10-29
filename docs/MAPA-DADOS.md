# Mapa dos dados da Central Free Fire

Guia para o Matheus e para qualquer chat que trabalhar no repositório
`nakataff/ffwsbr`. Caminhos relativos à raiz. Revisto em 20/10/2026.

## Comece aqui

1. Identifique a competição e a etapa antes de escolher a fonte.
2. Para exibir poucos números, procure primeiro um resumo já pronto.
3. Para recalcular algo, use os dados detalhados e gere o resumo fora do navegador.
4. Reaproveite o layout da mesma competição e carregue os dados só quando usados.
5. Confira `updatedAt`, o esquema e a cobertura. Um arquivo com nome “players” ou
   “summary” não necessariamente contém todas as etapas.

## WB / FFWS BR 2026 S2

Páginas públicas: `/ffws-br-s2/inicio`, `/classificatoria`, `/segunda-fase`,
`/final`, `/mvp`, `/equipes`, `/datas`, `/stats`, `/selecoes`, `/notas` e `/comparar`
(todos esses sufixos usam o mesmo prefixo `/ffws-br-s2`).

| Arquivo ou fonte | O que contém | Quando usar / cuidado |
| --- | --- | --- |
| `ffws-br-2026-s2/players.json` | Cadastro dos jogadores e estatísticas por jogador/queda da **classificatória** | Base detalhada de aproximadamente 1,42 MB. Sozinho não contém os dados individuais da segunda fase e final |
| Firebase `ffwsLive/2026-s2` | Quedas e jogadores lançados da segunda fase e final | Fonte pública usada nas páginas completas. Exportar uma vez para consolidar resumos, não buscar a cada visitante do Início |
| `js/ffws-live-provider.js` | Combina o arquivo estático com as quedas ao vivo, normaliza nomes e substitui quedas já existentes | É a regra usada pela página completa do MVP. A geração do Início reutiliza esse código para não contar uma queda duas vezes |
| `ffws-br-2026-s2/player-name-map.json` | Nomes da origem, nomes canônicos, equipe e aliases | Usar antes de somar jogadores. Evita duplicar variações de nickname |
| `ffws-br-2026-s2/player-stats.json` | Totais individuais e rankings resumidos da classificatória | Não confundir com o Geral completo. As páginas que usam o provider recebem as demais fases em memória |
| `ffws-br-2026-s2/stages.json` | Formato, classificação e resultados por queda das equipes | Dados coletivos. O provider também pode complementar os lançamentos ao vivo |
| `ffws-br-2026-s2/career-summary.json` | Classificações finais das três etapas, campeão e classificados, sem todas as quedas | Resumo estático usado nos perfis/carreiras; aproximadamente 6,3 KB |
| `ffws-br-2026-s2/teams.json` | 14 equipes, abreviações, logos e calendário básico | Não contém estatísticas individuais completas |
| `ffws-br-2026-s2/dates.json` | Datas, rodadas, horários e folgas | Fonte do calendário; alguns rótulos de status são antigos, então use `finished` dos resultados para o encerramento |
| `ffws-br-2026-s2/home-results.json` | Recorte destinado à página principal | Verificar cobertura antes de reutilizar em outro lugar |
| `ffws-br-2026-s2/radar-summary.json` | Resumo coletivo para radar/comparações | Não é uma base individual |
| `ffws-br-2026-s2/config.js` | Formato, bônus, diferenças da edição e integração dos dados | Configuração da temporada, não um arquivo de resultados |
| `ffws-br-2026-s2/s2.js` e `s2.css` | Renderização e estilo das páginas completas da edição | Reutilizar o padrão visual de Final, MVP e Equipes |
| `js/ffws-br-season-layout.min.js` e `css/ffws-br-season-layout.css` | Layout compartilhado de competições brasileiras | Evitar copiar uma página inteira para criar outra edição |

**O “individual completo” da S2 é a combinação de `players.json` com as quedas
individuais de `ffwsLive/2026-s2`, usando os aliases e o provider.** Não existe
um arquivo chamado `wb.json` que deva ser presumido como fonte de tudo.

### Resumos exclusivos do Início

| Arquivo | Conteúdo | Tamanho aproximado sem compressão |
| --- | --- | --- |
| `ffws-br-2026-s2/inicio-resumo.json` | Datas, logos, formato, campeão e tabelas das três etapas | 5,4 KB |
| `ffws-br-2026-s2/inicio-mvp-top10.json` | Apenas Top 10 de **Geral, Classificatória, Segunda fase e Final** | 5,9 KB |
| `ffws-br-2026-s2/inicio-elencos.json` | Jogadores por equipe, função, status, foto, quedas e `statsByStage` com totais coletivos para os cards | 21,9 KB |
| `ffws-br-2026-s2/inicio.js` e `inicio.css` | Interface do Início; usa os componentes de `s2.css` | Não carregar `s2.js` e seus dados completos somente para mostrar esse resumo |
| `scripts/build-s2-overview.cjs` | Gera os três arquivos anteriores usando as fontes existentes | Execução local, sem chamadas de rede |

O Início baixa somente `inicio-resumo.json` ao abrir. MVP e elencos são buscados
no primeiro acesso à respectiva aba, com cache em memória e cache HTTP normal.
Trocar a etapa do MVP não faz outra leitura: os quatro Top 10 estão no mesmo JSON.
Fotos e logos vêm dos arquivos já existentes, com carregamento preguiçoso. O Top 10 inclui caminhos de fotos, sem baixar as imagens para montar a tabela.
Não há polling nem consulta ao banco de dados neste módulo.

O ranking segue a mesma regra do MVP completo: **abates, depois dano, depois
assistências**, agregando por nome normalizado **e equipe**. Geral soma as três
etapas. Um jogador que trocou de equipe não deve ganhar dados da outra passagem.

### Como atualizar o Início depois de uma correção

1. Obtenha uma exportação JSON pública de `ffwsLive/2026-s2`, por exemplo com
   uma única leitura de `https://central-free-fire-default-rtdb.firebaseio.com/ffwsLive/2026-s2.json`.
   Salve fora do repositório. Não exporte a raiz do banco nem dados da comunidade.
2. Atualize a fonte corrigida. Se mudar resultados coletivos, atualize primeiro
   `career-summary.json` com `scripts/snapshot-career-s2.cjs` e a mesma exportação.
3. Na raiz do repositório, execute:

   ```sh
   node scripts/build-s2-overview.cjs /caminho/ffwsLive-2026-s2.json
   node scripts/build-s2-overview.cjs /caminho/ffwsLive-2026-s2.json --check
   ```

   O script reutiliza o provider existente em ambiente isolado, sem acessar a rede.
   Valida cobertura, duplicações por jogador/queda e soma de abates de cada equipe
   antes de gravar qualquer arquivo. Um export parcial falha em vez de substituir
   o Geral por números incompletos. Os resumos guardam as fontes e o hash do export.
4. Confira as quatro abas do MVP. Referência da consolidação atual:
   Yago 264 K na classificatória; Lyon 84 K na segunda fase; MT7 42 K na final;
   Yago 359 K no Geral. Isso é uma referência datada, não um valor fixo no código.
5. Atualize `VERSION` em `inicio.js`, as URLs de `inicio.js`/`inicio.css` em
   `js/site-shell-fast.min.js` e a versão desse shell em `index.html`.
6. Valide os testes da interface e os tamanhos. Não faça o navegador recalcular
   o torneio inteiro para substituir esses três pequenos arquivos.

## Outras competições e arquivos com nomes parecidos

### Equipes do Mundial 2026

Na Classificatória sem resultados, `global.js` mostra os Grupos A–D a partir de
`groups.json`. Esse JSON pequeno é carregado só ao abrir a Fase 1 e reutilizado
em memória. Os links abrem o perfil da equipe nesta edição; fases posteriores
não apresentam todos os 24 participantes como se já estivessem classificados.


Lista `/ffws-global-2026/equipes`: cards compactos com classificação, abas Elenco/
Comissão, recolhimento e bandeiras por pessoa (`players.json → country`, imagens
locais `flag/{código}.webp`), busca e filtro por grupo. Trocar abas não faz consultas. Cada time
abre uma página própria em `/ffws-global-2026/equipe?time=<id>`, com elenco,
comissão, estatísticas por fase, agenda e demais times do grupo. `equipes.js` carrega apenas
`equipes-resumo.json` (~42 KB estático, gerado pelo mesmo build do Início), uma vez.
Os cards da home, do Início e da lista apontam para essas páginas. Links antigos
`/equipes?time=<id>` continuam compatíveis por redirecionamento. Não
carrega o cadastro inteiro, resultados detalhados, Firebase ou Durable Objects.
Fonte única de pessoas: `ffws-global-2026/players.json`; não inferir elencos de
outros torneios nem misturar jogadores homônimos de equipes diferentes.
Guia de atualização/cobertura: [EQUIPES-MUNDIAL-2026.md](EQUIPES-MUNDIAL-2026.md).

### Jogadores do Mundial 2026

`ffws-global-2026/jogadores/index.html` e `jogador/index.html` são páginas completas
independentes. `players.json` é a fonte do torneio; IDs e vínculos de carreira
ficam em `player-identities.json`. `scripts/build-global-players.cjs` gera o índice,
120 resumos individuais, detalhes sob demanda e o manifesto de integração com
os perfis normais. Não somar resultados de homônimos. Guia:
[JOGADORES-MUNDIAL-2026.md](JOGADORES-MUNDIAL-2026.md).

### Início do Mundial 2026

Entrada pública: `/ffws-global-2026/inicio` (também no atalho Mundial do menu).
Reutiliza `ffws-global-2026/global.css` para manter a identidade das outras páginas.
O módulo `ffws-global-2026/inicio.js` é independente de `global.js`: não baixa a
base completa nem faz consultas ao Firebase/Durable Objects.
O cabeçalho oferece atalhos nativos para equipes, quatro etapas e calendário, com
rankings, estatísticas, seleções, comparação, notas e formato em “Rankings, estatísticas e mais”.
Os atalhos não antecipam o carregamento das páginas; o formato continua sendo a
primeira seção depois do cabeçalho.

| Arquivo | Conteúdo / carregamento |
| --- | --- |
| `ffws-global-2026/inicio-resumo.json` | Formato, 24 equipes com logos/grupos, calendário e tabelas por fase/dia. Cerca de 10,4 KB antes dos resultados; único JSON inicial do módulo |
| `ffws-global-2026/inicio-mvp-top10.json` | Top 10 Geral, Fase 1, Fase 2, Repescagem e Final. Buscado só na aba MVP |
| `ffws-global-2026/inicio-elencos.json` | Jogadores/comissão cadastrados nesta edição, por ID de equipe. Buscado só na aba Equipes; nunca inferir elenco do Mundial a partir de outro torneio |
| `scripts/build-global-overview.cjs` | Gera os três resumos offline a partir de `stages.json`, `dates.json`, `teams.json`, `groups.json` e `players.json` da mesma pasta |

Depois de cadastrar resultados ou elencos, execute `node scripts/build-global-overview.cjs`
e `node scripts/build-global-players.cjs`; confira ambos com `--check`. A CI verifica se os resumos
correspondem às fontes. Atualize `VERSION` em `inicio.js` e as referências de
`inicio.js`/`inicio.css` no shell, além da versão do shell em `index.html`.

**Fase 2 tem classificações independentes por dia; não gerar uma tabela acumulada.**
A Final preserva a ordem oficial de `stages.final.rows`, pois Champion Rush pode
ter um campeão com menos pontos que outra equipe. MVP soma por jogador **e equipe**,
ordenando por abates, dano e assistências. O cronômetro só faz cálculos locais;
as janelas estimadas das rodadas seguem a home e não comprovam transmissão ao vivo.
Parâmetros: `aba=tabela|mvp|equipes`, `etapa=classificatoria|segundaFase|lastChance|final|geral`,
`dia` para a tabela e `grupo=A|B|C|D` para equipes. Valores ausentes não inventam
resultados, rankings ou elencos.

| Caminho | Finalidade / cuidados |
| --- | --- |
| `ffws-br-2026-s1/` | Fontes da S1: `players.json`, `stages.json`, `teams.json`, `dates.json`, `player-stats.json`, `home-results.json`, `stats-static.json`, `radar-summary.json` e `player-meta.json`. O `players.json` usa esquema compacto com `fields`, índices e arrays; não é igual ao da S2 |
| `players.json` na raiz | Arquivo legado de jogadores. Não é o arquivo da S2 por estar na raiz |
| `dados.json` na raiz | Dados legados `dbQuedas` e `dbJogadoresQuedas`; conferir a edição antes de reutilizar |
| `ffws-br-2025-s2/` | Dados e interface próprios da WB 2025 S2 |
| `novos-torneios/index.json` | Índice de “Outros torneios”; indica os arquivos de cada edição |
| `novos-torneios/lbff-*.json`, `wb-*.json` e `ffws-*.json` | Torneios históricos de LBFF/WB e Mundiais. Consultar o índice para os nomes exatos |
| `imports/liquipedia-worlds/` e `scripts/import-liquipedia-worlds.py` | Fontes e importador dos Mundiais, com documentação própria |
| `historico/registro-detalhado/` | Arquivos compactos usados no registro detalhado. Não presumir atualização completa: a cópia da S2 registra data de agosto |
| `ffws-global-2026/` | Dados da edição Global 2026: formato, equipes, grupos, jogadores e datas; conferir cobertura de resultados antes do início do evento |
| `ewc 2026/` | EWC 2026: tabelas, abates, equipes, calendário e perfis. O diretório tem espaço no nome |
| `dados laff/` | Dados das competições LAFF; conferir a edição no próprio arquivo |

### LAFF 2026 S1: carregamento e equipes no admin

`#laff-classificatoria` carrega `js/laff.min.js` e o resolvedor compartilhado de
escudos, sem inicializar a WB S1, Outros torneios, planilhas ou o Mercado da Bala.
O módulo funciona mesmo quando baixado depois de `DOMContentLoaded`.
As tabelas usam `dados laff/classificacao.json` (24 equipes), `repescagem.json`
(12) e `final.json` (12); repescagem e final só são baixadas ao abrir a aba.
Os JSONs estáticos têm versão fixa e cache HTTP; retornos e filtros reutilizam
memória. Falha na classificatória mostra recuperação, sem substituir os
resultados por zeros. Movimentações atuais não reescrevem o elenco histórico.

`scripts/build-career-team-catalog.py` gera `functions/career-team-catalog.json`
com as 24 equipes da LAFF e os escudos do mapa compartilhado. Verifique com
`--check` depois de alterar as fontes. `functions/career-team-catalog.js` inclui
somente equipes ausentes no cadastro central, na primeira operação administrativa
de equipes; assim **admin-carreiras → Nova movimentação** encontra KABUM! FDS.
Não cria pessoas, passagens nem movimentações. Nomes, aliases, fusões e escudos
editados têm prioridade; KABUM histórica e KABUM! FDS não são fundidas por suposição.
Um marcador indexado evita repetir a migração. Leituras públicas não executam
essa sincronização; a busca administrativa continua paginada.
Testes: `test/laff-loading.test.cjs` e `functions/test/career-team-catalog.test.cjs`.

`js/laff-pages.js` e `css/laff-pages.css` complementam a navegação e as telas
da edição, carregados somente na LAFF. Estatísticas alternam classificatória,
repescagem e final, com Totais/Médias e paginação local. Perfis das equipes
reutilizam as mesmas tabelas para a campanha por etapa; não exigem estatísticas
individuais por queda para mostrar um resultado coletivo conhecido. Ausência na
lista completa de uma fase é apresentada como não participação, nunca zero.
Datas usa apenas o período geral já registrado (12–28/06/2026), informa o
encerramento e não inventa horários de rodadas.

`cffGetLAFFStageRows` compartilha resultados e requisições pendentes de uma fase.
MVP e seleções compartilham `abates.json` pelo módulo de telas e reutilizam o
elenco já carregado. Falhas têm retry por clique, sem polling/cache vazio
permanente. Filtros, totais, médias e navegação não fazem leituras do banco.
O shell acompanha mudanças nativas de `#laff-*`, inclusive Voltar/Avançar.
Os 110 registros de jogadores são identificados por nome **e equipe** nesta
edição: os dois biel7 (RS TET e GOD E-SPORTS) não podem remover um ao outro do
elenco. Links e seleção de função conservam o contexto da equipe.
Fotos de elencos e seleções usam `js/player-photo-resolver.min.js` e o mesmo
`player-data/photo-map.json` dos perfis, carregado uma vez antes do elenco.
Fotos explícitas da edição têm prioridade. Para nicks repetidos em equipes
separadas, só uma foto explícita pode identificar a pessoa: não aplicar o mapa
global por nick a homônimos (ex.: biel7). Não carrega o core antigo, planilhas,
base de carreiras ou banco para resolver retratos. A foto de brota10 já
cadastrada na planilha pública foi incluída no mapa estático em 29/10/2026;
as fotos locais existentes foram preservadas.

## Perfis, carreiras e imagens

| Caminho | O que procurar |
| --- | --- |
| `player-data/routes.json` e `aliases.json` | Identidades/rotas e aliases de jogadores |
| `player-data/photo-map.json` | Fotos locais por nickname normalizado |
| `player-photos/s2/` | Fotos da S2 já disponíveis; não baixar novamente sem necessidade |
| `player-data/s2/{equipe}.json` | Perfil por equipe. Pode ter snapshots antigos, então conferir `updatedAt` |
| `player-data/seasons/{equipe}.json` | Recortes de temporadas para perfis |
| `player-data/staff/` e `assets/coaches/` | Comissão técnica, identidades e fotos dos coaches |
| `player-data/passagens.json`, `historical.json`, `titles-local.json` | Passagens, histórico e títulos; complementar com registros/correções existentes |
| `team-data/logo-map.json`, `team-aliases.json` | Logos de reserva e nomes equivalentes. A logo salva no admin-carreiras tem prioridade por `js/career-team-identities.mjs`; inclusive em Outros torneios, imagens usam `data-team-logo`, sem carregar o cadastro inteiro |
| `js/tournament-logos.js`, `data/tournament-assets.json` | Logos compartilhados das competições (não das organizações), usados em Outros torneios e nos títulos dos perfis. Catálogo estático gerado por `scripts/build-tournament-assets.py`; personalizações em admin-carreiras → Logos de campeonatos, com uma resposta pública pequena em cache |
| `js/team-identity-history.js` | Modelo compartilhado de nomes e escudos por data. `identityHistory` fica no cadastro central da organização; configure em admin-carreiras → Times → Nome e escudo no tempo. O contexto público usa `data-team-date`, sem duplicar times ou reatribuir resultados |
| `data/team-logo-catalog.json` | Índice estático leve de escudos para o admin-carreiras, com nomes, aliases e origens; gerado por `scripts/build-team-logo-catalog.cjs`. A galeria `js/career-logo-picker.mjs` carrega sob demanda e filtra localmente, sem consultas ao Cloudflare |
| `team-data/historical-index.json` e `historical/` | Índice e perfis das equipes históricas |
| `team-data/seasons/` e `history/` | Campanhas e histórico por equipe |
| `team-data/competition-periods.json` | Datas/períodos de competições para ordenar passagens |
| `career-data/` e `docs/careers.md` | Eventos, resultados e documentação do sistema de carreiras |
| `scripts/build-career-*.py` e `build-team-views.py` | Geradores dos arquivos derivados de carreiras e equipes |

## Rotas e carregamento

### Mercado da Bala: primeiro HTML separado

- `mercado.html` contém a página completa, fora do index, com o cabeçalho público
  existente, filtros acessíveis, lista e paginação. Não é um redirecionamento para
  `index.html`; o index conserva somente o resumo de seis movimentações da home.
- `css/mercado.css` contém os estilos do Mercado extraídos do bundle legado e a
  adaptação do contêiner independente; não baixa CSS de competições.
- `js/mercado-page.js` reaproveita `charts-market.min.js` e
  `mercado-status-performance-hotfix.min.js`, nesta ordem, sem carregar Chart.js,
  dados competitivos ou o catálogo de carreiras. Os índices locais de logos e
  rotas de jogadores são pequenos; perfis e equipes usam links normais. Escudos
  usam `js/team-logo-resolver.min.js`, inclusive os aliases de Team Apex Gaming.
  Escudo genérico não substitui uma logo conhecida; falha de URL salva tenta a
  imagem do mapa estático antes do placeholder. Imagens de pessoas não recebem
  `data-team-logo`, evitando confundir Santos (analista) com o clube de futebol.
- A fonte continua `/careers/market?limit=100`, com o mesmo cache local de dois
  minutos, cache público existente, snapshot offline e continuação só por clique.
  Migrar de HTML não cria tabelas nem novas consultas por item. Não há polling da lista.
- `js/mercado-votes.mjs` reutiliza os votos existentes e limita sua assinatura a
  uma por página. Não migra, zera nem copia votos. Cabeçalho/conta continuam os
  módulos públicos compartilhados já usados nas páginas independentes.
- `js/root-page-redirects.js`, carregado cedo no index, preserva `/#mercado` e
  `/index.html?time=btr#mercado` encaminhando para `/mercado.html`, sem parâmetros
  da equipe anterior. `fastNavigate('mercado')` também abre o HTML diretamente.
- `js/shared-navigation.js` e `js/mobile-dock.js` conservam a chave `mercado` dos
  atalhos já salvos, mas usam `/mercado.html` e marcam a página ativa corretamente.
  O item da busca em `search-index-lite.json` também aponta para o HTML novo.
- Regressões e CI: `test/mercado-page.test.cjs`, `test/career-market-public.test.cjs`
  e `.github/workflows/test-mercado-page.yml`. As outras páginas continuam no
  modelo anterior; migrá-las separadamente, sem duplicar suas bases de dados.


- `ffws-br-s2/inicio/index.html`: entrada para abrir ou atualizar o link direto do Início; redireciona ao shell preservando o recorte.
- `index.html`: contêineres das páginas e entrada dos estilos/scripts.
- `js/season-routes.js`: relação entre URL amigável e ID da página.
- `js/shared-navigation.js`: menu compartilhado.
- `js/site-shell-fast.min.js`: carregamento sob demanda dos módulos, inclusive Início.
- `AGENTS.md`: atalho curto para assistentes encontrarem este guia.

**Regra para manter leve:** corrigir a fonte, regenerar os resumos afetados e
reutilizar os arquivos estáticos. Dados encerrados não precisam de listeners,
polling ou recálculos por visitante. Requisições de arquivos estáticos continuam
existindo, mas não geram consultas de linhas aos Durable Objects.

## Cards compartilháveis

### Hall da Fama: equipes no ranking por edição

**Competições opcionais no ranking por ano:** o padrão continua somente LBFF /
FFWS Brasil. `js/hall-year-competitions.js` permite incluir Copa FF e EWC; baixa
`ranking-data/hall-extra-events.json` (~10 KB) uma vez ao abrir o filtro. Seleção,
busca, ano, resumo e detalhes por competição são calculados em memória. Tabelas
geral/por edição e perfis normais não recebem esses totais automaticamente.
O resumo de líderes acompanha a seleção de competições, mantendo independentes
os filtros de jogador/equipe/ordenação da tabela. Sem dados não significa zero;
Global Series 2026 fica desabilitado enquanto não houver resultados individuais
publicados nessa base. Cadastros com apenas elenco ou prêmios não entram.

`scripts/build-hall-extra-events.py` gera o resumo offline de Copa FF 2026
(110 registros do Geral, consolidado de A+B e C+D) e EWC 2026 (103 jogadores da base local).
Identidades brasileiras da EWC têm vínculos explícitos por nome/equipe;
internacionais recebem chaves próprias para não fundir homônimos. Para atualizar,
execute o gerador e `--check`; novas competições precisam ter fonte individual,
identidades revisadas e cobertura declarada antes de serem incluídas.

**Copa FF 2026 em Outros torneios:** `novos-torneios/copa-ff-2026.json`, entrada
leve em `index.json → copaEntries`, vinculada ao registro preexistente
`year2026.events → copa-free-fire-2026` por `detailId`. Nome, data, premiação e
MVPs são reutilizados desse registro (sem duplicar a linha de 2026). Quatro tabelas em `playerRankings` (Geral,
grupos, repescagem, final), seletor local de etapa. Sem estatísticas por queda.
`scripts/build-copa-2026.py` preserva os CSVs e produz relatório de divergências;
guia/cobertura em [imports/copa-ff-2026/README.md](../imports/copa-ff-2026/README.md).
O Geral consolidado usa duas partes de 55 registros. Grupos ainda tem apenas
100 linhas e permanece parcial; não somar etapas ao Geral. O importador confere
os 100 registros anteriores e o total de quatro atletas por queda em cada time.

**Copa FF nos perfis normais:** `scripts/build-copa-player-profiles.py` gera 104
arquivos individuais em `copa-ff-2026/player-data/` (menos de 1,8 KB cada) e
`js/copa-player-manifest.js` (menos de 2,2 KB). A aba **Copa FF 2026** fica depois
de WB 2026 S1. `js/copa-player-profile.js` carrega somente o arquivo do jogador
no primeiro acesso à aba; fases e retornos usam memória. Não recalcula a carreira
inteira nem acrescenta DB/polling. Somente Grupos tem aviso de cobertura parcial;
ausência de linha fica como desconhecida, nunca zero. O relatório
`imports/copa-ff-2026/player-profiles-report.json` lista seis nomes ainda sem
perfil existente seguro (THEUS7, ousadin, PH10, LUBILU, StriKezk e RICKB4). Não fundir homônimos
nem criar vínculos aproximados. Atualizar fonte, executar o gerador e `--check`,
e incrementar caches em `jogador.html` ao mudar os dados.
Regressões de importação/filtros/indisponibilidade/cache em
`test/copa-hall-events.test.cjs`.

**Ranking por ano:** a função `editionYear` de `hall-fame-lite.min.js` agrupa
LBFFs 1–3 em 2020, 4–6 em 2021, 7–8 em 2022 e 9 em 2023; WBs usam o ano do
nome. A LBFF 2 não tem dados cadastrados e não é inventada. O botão pequeno
**Resumo** abre os líderes anuais por abates, independentemente dos filtros da
tabela completa. Reutiliza os mesmos agregados e o detalhe por split ao clicar
no líder; computa o resumo uma vez em memória, sem novas requisições. A ordem
de desempate acompanha o ranking anual: abates, quedas, nome. Regressão em
`test/hall-year-summary.test.cjs` cobre datas, totais, expansão e ausência de rede.

`js/hall-fame-lite.min.js` usa o time de cada edição: primeiro o campo
`team`/`equipe` de `lbffData.json` (ou `player-stats.json` para a S2 atual),
depois o elenco estático de `player-data/edition-teams.json`. Ausência de registro
mostra **Sem equipe registrada**, nunca a equipe atual ou “Inativo”. O ranking
geral continua mostrando a equipe atual, e o link do jogador continua abrindo
seu perfil habitual.

O seletor **Mostrar equipe** alterna entre **Equipe da edição** (padrão) e
**Equipe atual**. A ordenação por equipe acompanha o modo, mantendo os mesmos
abates/quedas/médias e a seleção de edições. Alternar não faz novas requisições.

Ao selecionar várias edições, a soma mantém os mesmos abates/quedas e mostra as
equipes do recorte, agrupando escudos iguais; o título de cada escudo lista suas
edições. Escudos vêm de `team-data/logo-map.json`, com aliases locais e dados
de identidade já presentes no cache compartilhado. As datas iniciais das WBs
2025/2026 vêm dos calendários/fontes locais; edições antigas têm precisão de ano.
Não busca cadastro de carreiras, nem acrescenta leituras ao Cloudflare. Mudanças
na seleção e os eventos de atualização de logos apenas redesenham em memória.
Regressão: `test/hall-edition-teams.test.cjs`; versões de cache no shell e no HTML.

### Ranking histórico — preparação futura

Ponto de continuação: [docs/RANKING-HISTORICO.md](RANKING-HISTORICO.md).
O catálogo `ranking-data/historico-catalogo.json` reúne as fontes locais por edição
e as famílias ainda aguardando material (Copa América, FFCS Americas e World Cup).
É um inventário de preparação, sem consumo pelo frontend ou cálculo público.
Pesos novos e alcance do histórico ainda serão definidos com o Matheus.
Preservar identidades por época e incluir eliminados antes da final; a soma futura
será offline com resumos estáticos e detalhes carregados apenas ao abrir.

### Ranking anual de equipes

Entrada: `/ranking-anual.html`, no menu **Histórico → Ranking anual**.
Cobre Brasil 2026 (27 equipes, parcial) e 2025 (20 equipes, encerrado). O seletor
de temporada busca apenas o JSON do ano escolhido (5–6 KB). Anos já abertos
ficam em memória; trocar visualização, buscar, ver campanha ou compartilhar não
faz novas consultas. Mantém o cabeçalho, menu e identidade das páginas públicas.

| Arquivo | Função |
| --- | --- |
| `ranking-data/brasil-2025-source.json` | Pesos e aliases exclusivos de 2025, logos locais, classificação da Copa (16 equipes) e quatro brasileiros na EWC com fontes revisadas |
| `ranking-data/brasil-2025.json` | Ranking encerrado de 2025; duas WBs e Global vêm dos três arquivos `novos-torneios/*2025*.json`, sem Clash Squad |
| `ranking-data/brasil-2026-source.json` | Metodologia v2, pesos, aliases e classificação completa da Copa FF, com referência da fonte externa |
| `scripts/build-annual-ranking.cjs` | Gera o ranking offline usando a fonte da Copa, `ffws-br-2026-s1/stages.json`, `ffws-br-2026-s2/career-summary.json` e `ewc 2026/final.json`; para 2025 usa os três torneios históricos e as classificações revisadas da Copa/EWC; confere fases e cadastro de equipes do Global 2026 |
| `ranking-data/brasil-2026.json` | Resultado derivado: total, posição, pontos e colocação por evento, logos locais, competições pendentes e hashes das fontes |
| `js/annual-ranking.mjs`, `css/annual-ranking.css` | Busca local, total/competições, janela de campanha e adaptação para cards no mobile |

Regenerar com `node scripts/build-annual-ranking.cjs` e verificar com o mesmo
comando acrescido de `--check`. Ambos os anos são gerados/conferidos por padrão;
use `--year=2025` ou `--year=2026` para limitar. Atualize a data na fonte após revisar mudanças e
as versões do módulo/CSS/JSON quando publicar uma nova classificação. A CI
confere a correspondência com as fontes e os totais revisados. Não consultar
Firebase, Durable Objects, planilhas ou bases completas por visitante.

**Metodologia anual v2 (20/10/2026):** pódio com 200 / 150 / 120 pontos base,
em vez de 100 / 80 / 65. Demais posições e pesos permanecem iguais. Aplicado a
2025 e 2026: os três melhores da Copa (200 / 150 / 120) superam 7º–8º da WB
(35 × 3 = 105). Campeões de WB/EWC/Global passam a 600 / 1.000 / 1.400.
Recalcular os totais e cards; não alterar resultados ou colocações dos torneios.
A metodologia do histórico continua pendente de definição própria.

Cada evento conta somente a colocação final; eliminados antes da final recebem
sua posição da classificatória. Não somar pontos das fases como se fossem
torneios diferentes. Champion Rush preserva o campeão oficial. Patrocinadores
e aliases da mesma equipe são unificados; transferências de jogadores não
transferem pontos. Ordem de desempate: colocação no Global, na EWC, títulos de
WB. Empates restantes recebem a mesma posição, sem desempate alfabético.

O Mundial 2026 permanece pendente e não pontua antes do encerramento. Para incluí-lo:

1. Atualizar `ffws-global-2026/teams.json` (região `BR` identifica os brasileiros).
2. Preencher em `stages.json` os resultados completos: classificatória (24),
   `lastChance` (12) e final (12), com `team`, `position` e cada `finished: true`.
   Marcar também o `finished` da raiz após a final.
3. Regenerar o ranking de 2026 e publicar com a data/cache atualizados.

O gerador já converte a repescagem: 5º–12º viram 13º–20º gerais; eliminados da
Fase 1 ficam em 21º–24º. Os 12 finalistas mantêm a posição oficial. Valida as
24 equipes e os cruzamentos de fases, impedindo publicar um Mundial encerrado
que ignore brasileiros eliminados. Peso Global ×7; restantes Copa ×1,
WB S1/S2 ×3 e EWC ×5. Isso roda offline, sem varreduras por visitante.

**Atenção aos aliases de 2025:** `FLUXO W7M` no arquivo antigo da WB S1 é o
Fluxo daquele ano. Unificar somente com `FLUXO`; `W7M ESPORTS` disputou os dois
splits separadamente. `SAVEx Rush Gaming` da Copa corresponde à SAVEX GAMING,
sem transferir seus pontos à RUSH GAMING da S2. Na EWC 2025 os brasileiros são
LOS (4º), paiN (8º), Fluxo (10º), Alfa 34 (17º). Não usar `resultados.json` nessa
conta: há um 8º lugar atribuído à Team Solid, que não disputou essa edição.

Links preservam `ano=2025|2026`, `visao=total|competicoes` e `busca`. Compartilhamento
reaproveita os dados visíveis e suas posições originais. O editor comum aceita
`mode: 'annual'`, `annualColumns` e `rows[].annualValues`, com duas views. Os cards
anuais exportam tabela Top 3/5/10 para manter legibilidade ou Equipe em destaque
com qualquer equipe do recorte; o link abre o ranking completo.
Nenhum abate, Booyah ou número de quedas é inventado para esses cards.

O Início da S2 (tabela, MVP e equipes) e os quatro rankings da home usam o mesmo editor. A tabela pode exportar todos os times e a aba Equipes oferece um card com métricas selecionáveis por fase, usando os totais compactos de `inicio-elencos.json`.
Guia de integração: [docs/cards-compartilhaveis.md](cards-compartilhaveis.md).

| Arquivo | Função |
| --- | --- |
| `js/ranking-share-model.mjs` | Validação, opções, legenda, formatos e links de recortes |
| `js/ranking-share-renderer.mjs` | Desenha os PNGs localmente no canvas |
| `js/ranking-share-cards.mjs` | Janela, prévia, preferências, download, cópia e compartilhamento |
| `css/ranking-share-cards.css` | Estilo isolado da janela; carregado ao clicar |
| `js/home-share-cards.js` | Adaptador dos rankings já renderizados na home |
| `ffws-br-2026-s2/inicio.js` | Adaptador do resumo S2; fornece a tabela/etapa já carregada |
| `js/vendor/qrcode-generator.js` | QR Code local, carregado somente com a opção ativada |

No Início, `?aba=mvp&etapa=segundaFase` restaura exatamente o recorte compartilhado.
Parâmetros aceitos: `aba=tabela|mvp|equipes`; `etapa=classificatoria|segundaFase|final`
e `geral` para MVP. O editor não consulta os dados do ranking nem o banco.

## Fotos do quiz

### Conquistas por conhecimento (quiz)

Criar a imagem em **admin-perfis → Catálogo → Insígnia** e a regra em
**Objetivos → Objetivo e recompensa**. O grupo **Conhecimento de Free Fire**
oferece acertos completos acumulados (`quiz_correct`), dias com 3/3
(`quiz_perfect_days`) e acertos por formato (`quiz_quiz_correct`,
`quiz_player_correct`, `quiz_career_correct`, `quiz_lineup_correct`). Nomes,
imagens, metas e disponibilidade são definidos pelo administrador; nenhum
item ou objetivo é criado automaticamente por esta implantação.

- `functions/quiz-progress.js`: uma linha SQLite pequena por UID em
  `eco_quiz_progress`. Contadores são atualizados na mesma transação da resposta
  e das moedas; o checkpoint no registro diário impede duplicações em retries.
  Só resposta totalmente correta conta. Parcial de escalação conserva as moedas,
  mas não soma conquista. Pulo/erro/tempo esgotado não contam. Dias perfeitos não
  precisam ser consecutivos. O progresso sobrevive à limpeza dos quizzes diários.
- Respostas anteriores à implantação não são reconstruídas nem creditadas
  retroativamente. O banco de perguntas continua privado e não é varrido para
  atualizar conquistas. Cada resposta pública do quiz lê somente o resumo do UID.
- `functions/profile-goals.js` e `Notifications.claimGoals`: o servidor busca os
  contadores pelo UID autenticado. Não aceita números enviados pelo navegador ou
  por respostas do ranking de Instagram. Quiz funciona sem Instagram vinculado.
  Configuração/catálogo têm cache de 60 segundos no serviço; consulta posse apenas
  quando existe meta alcançada. Nenhuma leitura do cadastro inteiro de usuários.
- Ao concluir os três desafios, o Worker tenta liberar as metas de quiz usando o
  inventário existente e envia aviso idempotente à caixa de entrada. Falha na
  entrega mantém moedas e progresso; abrir o perfil ou **Atualizar conquistas**
  permite nova tentativa e aplica objetivos criados depois. Recompensa permanece
  na coleção mesmo após desativar/excluir a regra. Insígnias usam os mesmos grants
  consumidos pelo perfil público e pelo seletor de insígnias do chat.
- `js/quiz-goals.mjs`: opções do editor e barras de progresso em
  **conta → Inventário → Insígnias**. `daily-quiz.mjs` mostra totais acumulados no
  resultado, anuncia novas conquistas e abre diretamente a coleção correta.
  Sem polling, ranking adicional ou histórico completo.
- `database.rules.json` autoriza somente as seis novas métricas nas regras
  administrativas existentes; posse/grants continuam graváveis pelo serviço.
- Testes: `functions/test/economy-quiz.test.cjs`, `functions/test/profile-goals.test.cjs`,
  `test/quiz-goals-ui.test.cjs`, além das regressões do inventário e quiz.

[Guia de fotos do quiz](quiz-fotos.md): `build-daily-challenges.cjs` gera o banco
privado e chama `build-daily-challenge-photos.cjs` para incluir retratos pequenos
no Worker. O arquivo versionado `daily-challenges-seed.js` é somente placeholder.
As questões de foto prontas não consultam o site ou o banco para carregar a imagem.

### Editor de pontuação anual (2025/2026)

Entrada no painel: **Ferramentas da Central → Pontuação do ranking anual**,
em `/admin-ranking-anual.html`. É um editor local e responsivo, sem autenticação
de gravação remota: carrega somente a configuração e o JSON compacto de cada ano,
recalcula a prévia em memória e não faz chamadas para Firebase ou Cloudflare.
Nenhuma modificação é publicada ao digitar.

- Os arquivos editáveis são `ranking-data/brasil-2025-source.json` e
  `ranking-data/brasil-2026-source.json`: `basePoints[0..23]` para as colocações
  1º–24º e `weights` para Copa, WB S1, WB S2, EWC e Global.
  Também é possível editar cada torneio e colocação diretamente: nesse caso o
  editor salva `pointsByEvent` com uma tabela inteira de 24 valores para a
  competição editada. Esses valores têm prioridade sobre base × multiplicador.
  Alterar o peso de uma competição remove as personalizações somente dela.
- A opção 'aplicar aos dois anos' vale para as **próximas alterações**; permite
  distinguir as metodologias de 2025 e 2026 quando necessário.
- Cada download preserva todas as fontes, nomes e resultados, altera apenas os
  parâmetros de pontuação, incrementa `methodVersion` e atualiza `updatedAt`.
- Substituir **somente o arquivo source baixado** na pasta `ranking-data` da
  branch principal do GitHub. O workflow
  `.github/workflows/rebuild-annual-ranking.yml` chama o gerador offline,
  confere pontuações/totais e publica os resumos
  `ranking-data/brasil-2025.json` / `brasil-2026.json`, e solicita uma
  compilação do GitHub Pages para publicar a atualização gerada pelo robô.
- O workflow `test-s2-overview.yml` recalcula os resumos localmente
  antes de testar. Confirmar a conclusão dos workflows no GitHub Actions;
  se falharem, o site mantém o resumo antigo.
- O ranking público continua lendo só um JSON do ano selecionado, sem
  recalcular classificação durante visitas; a resposta usa revalidação de cache.

Importante: o editor **não altera colocações oficiais nem inclui torneios**;
essas mudanças exigem atualizar as fontes do evento e regenerar o ranking com
`scripts/build-annual-ranking.cjs`. O futuro ranking histórico possui
metodologia independente.

### Stories da comunidade: aprovação automática e rejeição

- `admin-stories.html`, `js/admin-stories.js`, `css/admin-stories.css`: painel
  autenticado, inicialmente em Aprovados; carrega 50 registros por página,
  permite selecionar até 20, ampliar a prévia e rejeitar com motivo. Busca e
  filtro de semana operam localmente. Sem polling ou consulta ao catálogo Meta.
- `cloudflare/instagram-community/worker.js`: recebe somente webhooks com
  assinatura Meta válida, identifica a menção e credita automaticamente.
  Admin pode aprovar pendentes antigos em grupo sem informar a publicação.
- `cloudflare/instagram-community/story-reviews.js`: regras SQL e operações
  idempotentes. Cada ID de story vale 5 pontos, até 3 por pessoa/dia (Brasília).
  Recebimento confirma menção, não valida o conteúdo compartilhado; a revisão
  posterior do conteúdo cabe ao administrador. A antiga restrição automática
  de uma publicação original por pessoa/semana não se aplica ao modo automático.
- Rejeição de aprovado muda o status e retira seu lançamento/contadores na
  mesma transação SQLite. Remove bônus semanais dependentes, reavalia a missão
  com a configuração vigente e invalida os resumos afetados. Mantém histórico
  da revisão, motivo, data e responsável. Repetir uma entrega ou rejeição não
  duplica crédito nem desconto. Rejeitado não volta a pontuar em retries.
- `schema.sql` espelha o schema do módulo; a migração idempotente está em
  `migrations/2026-10-20-story-auto.sql`. O marcador de inicialização inclui
  `STORY_REVIEW_VERSION`: ao mudar o schema, atualizar essa versão e a checagem
  de saúde no workflow de deploy. Uma nova instância faz só uma consulta ao
  marcador; a aplicação do schema ocorre uma vez por versão.
- Testes: `npm test` na pasta do Worker e
  `test/admin-stories-ui.test.cjs` (JSDOM). Não aprovar registros reais para testar.


## Mensagens, atalhos e avisos dos pedidos no jogo

- `admin-mensagens.html` / `js/admin-inbox.mjs`: atalhos locais para Loja,
  Presentes, Vales, Meus pedidos, Insígnias, Quiz, Check-in/moedas e Perfil.
  Preenchem link e rótulo do botão, preservando destinatários e texto; invalidam
  uma revisão antiga. Prévia/atalhos não enviam mensagens. O fluxo de confirmar
  envio permanece igual. A seção **Avisos automáticos** explica os disparos.
- `functions/economy-game-orders.js`: pedido recebido, envio confirmado pelo
  administrador, recusa com motivo e estorno, cancelamento com estorno. O aviso
  usa `game-order:{id}:{status}`, UID do comprador e link direto para
  `/conta.html?tab=points&shopSection=orders`. Não é integração com a Garena:
  comprar no jogo precisa ser seguido de **marcar o pedido como enviado** no
  painel. Não reconstrói/envia avisos de pedidos antigos em lote.
- A função `notify` vem da mesma instância de `user-inbox` de `economy.js` e roda
  dentro da transação da compra/baixa/estorno. Falha ao salvar o aviso desfaz
  estado e moedas; retry pode concluir sem duplicar. Nenhuma busca por usuários
  ou consulta ao Firebase é acrescentada ao atualizar o pedido.
- Continuam os avisos de vales (incluindo roleta), entregas de codiguinhos/itens
  de perfil, insígnias, emblemas e objetivos. Comunicados gerais usam uma linha
  compartilhada, sem distribuir uma cópia por usuário.
- `js/header-wallet.mjs` / `css/header-wallet.css`: a bolinha de novidades é
  **vermelha**. Metadados da caixa têm validade independente do saldo: com saldo
  fresco/adiado, pede só `inboxSummary`, que lê cabeçalhos por chave primária;
  com saldo vencido, reaproveita `wallet` com `includeInbox`. Verifica ao entrar,
  voltar ao foco ou tornar a página visível, com cache de 60 segundos e backoff.
  Sem polling, listas de mensagens, históricos ou leitura de carteiras em lote.
  Abrir a caixa confirma a visualização das novidades e limpa a bolinha; os
  estados individuais de leitura das mensagens permanecem separados.
- Testes: `functions/test/economy-game-orders.test.cjs`,
  `functions/test/user-inbox.test.cjs`, `test/header-wallet.test.cjs`,
  `test/user-inbox.test.cjs` e `test/inbox-popover.test.cjs`.

## Apoiadores da vaquinha

- `admin-apoiadores.html`, `js/admin-supporters.js`, `js/supporters-admin.mjs` e
  `css/admin-supporters.css`: painel autenticado, atalho em admin → Comunidade
  e recompensas → Apoiadores da vaquinha. Cadastrar nome público/@, data e
  visibilidade após conferir o apoio na LivePix. Cadastro manual; sem conexão
  à API da campanha, valores, comprovantes, e-mails ou vínculos automáticos.
- `functions/community-supporters.js`: documento de até 300 registros em uma
  única linha `community_supporters/list`. Revisão otimista, transação e nonce
  do serviço administrativo existente. Ocultar preserva o registro privado.
- `GET /careers/supporters`: retorna no máximo seis entradas visíveis, ordenadas
  por data de apoio e depois por cadastro. Só publica ID, nome público e data.
  A memória do serviço, o navegador e a borda reutilizam cache de 60 segundos;
  edição pode levar até dois minutos para aparecer. Não lê pessoas ou carteiras.
- `js/home-supporters.js` e o bloco `data-home-supporters` em `index.html`:
  nomes dentro do card da vaquinha, carregados uma vez ao ficar visível na home.
  Sem polling, lista completa ou dependência da LivePix durante a visita.
  Nenhum exemplo de teste é gravado no mural público. Na ausência de cadastros,
  fica uma mensagem de agradecimento e o link para contribuir continua ativo.
- Testes: `functions/test/community-supporters.test.cjs` (autorização, cache,
  publicação limitada, ocultação e retries idempotentes) e
  `test/community-supporters-ui.test.cjs` (home, painel e limpeza ao sair).

### Diagnóstico da conexão LivePix

- `functions/livepix-diagnostic.js`: teste privado `careerAdmin/supporterLivepixTest`,
  autorizado pelo gateway de `cloudflare/camp-notifications/worker.js` antes de
  qualquer chamada externa. Usa os Secrets `LIVEPIX_CLIENT_ID` e
  `LIVEPIX_CLIENT_SECRET` do Worker de produção. Credenciais e tokens ficam
  no servidor; o token é reutilizado até perto do vencimento.
- Botão **Testar conexão** em `admin-apoiadores.html`: não roda ao abrir a página.
  Consulta conta, primeira página de até 20 pagamentos e 20 mensagens pela API
  oficial, e a página pública fixa da campanha `central-free-fire`. Sem leitura
  de carteiras, nova tabela, gravação de doações, webhook ou agendamento.
- Resultados (inclusive falhas) ficam em memória por 10 minutos na instância,
  com deduplicação de testes simultâneos. Não recebe URL ou credenciais pelo
  navegador e não segue redirects nas requisições externas. Respostas limitadas
  a 180 KB; prazos de 6 segundos por chamada.
- Só retorna diagnóstico resumido: conta conectada, contagens, permissões,
  progresso público da campanha, presença de campos de associação e quantidade
  de referências possivelmente correspondentes. Nunca retorna tokens, segredos,
  comprovantes, nomes dos doadores, textos de mensagens ou registros brutos.
- O vínculo dos apoios de vaquinha à API e as preferências de anonimato ainda
  precisam ser validados com registros reais. **Publicação automática desativada**.
  O mural público e o cadastro manual continuam funcionando como antes.
- Fontes: `https://docs.livepix.gg/api`,
  `https://api.livepix.gg/open-api.json` e
  `https://vaquinha.livepix.gg/central-free-fire` (consulta pública em 23/10/2026).
- Testes: `functions/test/livepix-diagnostic.test.cjs`,
  `cloudflare/camp-notifications/test/economy-api.test.mjs` e
  `test/community-supporters-ui.test.cjs`.

- Diagnóstico v2: erros de OAuth exibem somente códigos permitidos e HTTP,
  distinguindo credenciais/permissões, indisponibilidade, timeout e formato
  inesperado. Corpos externos e descrições livres nunca chegam ao painel.
  Requisições autenticadas pedem JSON; vencimento numérico ou string numérica
  do token é aceito, com a mesma reutilização de token e cache de 10 minutos.

### Localizador de artes prontas (admin-tarefas)

- Interface: `js/admin-tarefas-locator.js` e `css/admin-tarefas-locator.css`. O atalho FFCP fica somente na lateral; o Localizador é uma aba independente.
- Dados privados: `functions/task-locator.js`, integrado no serviço autenticado `functions/admin-tasks-service.js`, usando o Durable Object existente. Não publica os links no GitHub e não inclui as artes no JSON inteiro do quadro/Firebase.
- Operações: `locatorList`, `locatorGet`, `locatorSave`, `locatorFavorite`, `locatorDelete`; acesso exclusivo do administrador. Tabelas criadas somente no primeiro acesso ao Localizador.
- Lista paginada: 24 resumos, cursor e índices por tipo/favorito/data. Busca FTS5 por nome, projeto, formato, palavras-chave e rótulos de links/legendas. Não indexa o corpo longo das legendas. Busca ao enviar o formulário; sem varredura periódica nem carregamento de imagens.
- Cada arte: nome, tipo, projeto/cliente, formato, favorito, até 20 palavras-chave, 12 links (primeiro é principal), 8 versões de legenda e observações. Detalhe completo buscado por ID só ao abrir/editar/copiar legenda. Cache em memória de 60 segundos, páginas e detalhes limitados; não persiste dados privados no armazenamento local.
- Limite de 1.000 artes; revisão por registro evita sobrescrever mudanças em outro aparelho. Reenvio idêntico não duplica registros. Excluir o cadastro não exclui o arquivo original no Canva/Drive/etc.
- O backup do quadro ativo e sua importação não incluem nem alteram o catálogo independente do Localizador.


## Camp ao vivo — painel administrativo

- `admin-camp-ao-vivo.html` mantém os controles originais; `app-loader.js` carrega o núcleo comprimido e os complementos em ordem.
- `admin-camp-ao-vivo/tournament-setup.js` gerencia fases, classificados e snapshots locais de cada fase.
- `admin-camp-ao-vivo/workspace.js` e `workspace.css` organizam a navegação por etapas, o diálogo de times/dias e as opções de lançamento. Não consultam APIs nem alteram a pontuação.
- O lançamento continua no `app.js.gz`; a revisão de edição por equipe impede que uma limpeza agendada de bolinha apague uma posição mais recente ou outra queda. Ao alterar o núcleo, descomprima, valide JavaScript e recomprima com gzip determinístico (`mtime=0`).
- Verificação: `NODE_PATH=<pasta-com-jsdom>/node_modules node --test test/camp-*.test.cjs`. A suíte cobre bolinhas, cores, focos, salvamento/restauração e transições de fase.
