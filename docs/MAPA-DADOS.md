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
| `ffws-br-2026-s2/inicio-elencos.json` | Jogadores por equipe, função, status, foto e quedas disputadas em cada etapa | 16,9 KB |
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
| `team-data/logo-map.json`, `team-aliases.json` | Logos e nomes equivalentes das equipes |
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

O Início da S2 e os quatro rankings da home usam o mesmo editor.
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
