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

### Início do Mundial 2026

Entrada pública: `/ffws-global-2026/inicio` (também no atalho Mundial do menu).
Reutiliza `ffws-global-2026/global.css` para manter a identidade das outras páginas.
O módulo `ffws-global-2026/inicio.js` é independente de `global.js`: não baixa a
base completa nem faz consultas ao Firebase/Durable Objects.

| Arquivo | Conteúdo / carregamento |
| --- | --- |
| `ffws-global-2026/inicio-resumo.json` | Formato, 24 equipes com logos/grupos, calendário e tabelas por fase/dia. Cerca de 10,4 KB antes dos resultados; único JSON inicial do módulo |
| `ffws-global-2026/inicio-mvp-top10.json` | Top 10 Geral, Fase 1, Fase 2, Repescagem e Final. Buscado só na aba MVP |
| `ffws-global-2026/inicio-elencos.json` | Jogadores/comissão cadastrados nesta edição, por ID de equipe. Buscado só na aba Equipes; nunca inferir elenco do Mundial a partir de outro torneio |
| `scripts/build-global-overview.cjs` | Gera os três resumos offline a partir de `stages.json`, `dates.json`, `teams.json`, `groups.json` e `players.json` da mesma pasta |

Depois de cadastrar resultados ou elencos, execute `node scripts/build-global-overview.cjs`
e `node scripts/build-global-overview.cjs --check`. A CI verifica se os resumos
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
