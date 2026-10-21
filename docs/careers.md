# Histórico central de jogadores e comissão

Abra `admin-carreiras.html` com a conta administrativa habitual. O painel principal tem o atalho **Jogadores e comissão**. Busque uma pessoa, abra seu histórico e use **Adicionar passagem**, **Editar** ou **Registrar transferência**. Transferências encerram a passagem escolhida e criam outra em uma única transação. A aba **Cadastro** permite criar pessoas, atualizar nicks/aliases, categoria e disponibilidade; a aba **Alterações** mostra as últimas vinte edições e permite desfazer a última, sem sobrescrever uma edição concorrente.

Os cargos são jogador, head coach, coach, assistant coach, analista, manager e outro. Entrada e saída aceitam DD/MM/AAAA, MM/AAAA ou apenas o ano (e também o formato ISO), além de edição e indicação de confirmado/estimado. Data vazia não é inventada. Cadastros importados ficam a revisar: a primeira/última participação em uma edição não comprova a contratação/desligamento. O vínculo atual combina a inscrição mais recente e as saídas/transferências manuais. Registros atuais usam ativo, empréstimo ou substituto dentro do período. Aposentado e sem equipe são situações explícitas da pessoa.

## Armazenamento e consultas pequenas

A base histórica inicial de 378 pessoas, 71 equipes e 811 passagens é gerada por `python scripts/build-career-seed.py` a partir de passagens, aliases, edições e comissão já existentes. `functions/career-seed.json` é **somente do servidor**; nenhuma página o importa ou baixa. O Durable Object SQLite existente importa o seed uma vez, em transação, e não substitui as correções feitas no admin. Não são criados novos listeners ou coleções completas no Firebase.

O admin abre apenas o resumo e vinte nomes; a busca é atrasada enquanto se digita. Cada seleção busca só o cadastro daquela pessoa. Equipes sugeridas e histórico de alterações também têm limite de vinte. Não existe endpoint para baixar o cadastro inteiro.

`GET /careers/person?id=...` retorna uma pessoa; nomes/aliases ambíguos são recusados. `GET /careers/team?name=...&scope=current|all&offset=...` retorna até vinte passagens da equipe solicitada. As respostas públicas têm ETag e cache de até sessenta segundos. O navegador reaproveita pedidos simultâneos e mantém até cinquenta consultas pequenas em memória. Não há polling ou consulta da base completa ao abrir cards.

O admin usa `POST /api` com ação `careerAdmin`, token Firebase e verificação administrativa no servidor. Operações: search, teams, person, summary, history, savePerson, saveTenure, transfer, archiveTenure, releasePerson, departureCandidates, bulkDeparture e undo. Edições usam revisão esperada e nonce para impedir sobrescrita concorrente e repetição. Arquivar remove a passagem da visualização pública sem apagar o histórico. O log privado mantém a identidade administrativa e o estado anterior; as consultas públicas não expõem esses dados.

## Integração pública

`carreira.html?id=...` abre o histórico individual, inclusive de novos membros da comissão. `carreira.html?team=...` permite consultar qualquer equipe cadastrada. Perfis de jogadores, equipes atuais, equipes históricas e perfis internos da home usam o mesmo cliente. Consultas individuais rodam em segundo plano; a área de vínculos da equipe só consulta quando entra próxima da tela.

Quando há revisão manual ou sincronização da WB, o vínculo central passa a ser mostrado no perfil. O histórico usa a seção original, com escudos e setas, sem os cartões grandes de revisão. As datas continuam disponíveis no administrador e no título dos itens. Companheiros atuais vêm da mesma consulta central, limitada à equipe atual; F/A e aposentados não têm companheiros nem o selo de titular/reserva atual. Elencos competitivos antigos continuam identificados pela edição: transferências não reatribuem abates, quedas, títulos ou resultados históricos. A correção antiga de elenco por lista fixa deixa de prevalecer sobre uma pessoa revisada no cadastro central. A disponibilidade pode levar até um minuto para aparecer em outra página por causa do cache.

Validação: `node --test functions/test/careers.test.cjs`; testes de gateway em `cloudflare/camp-notifications/test/economy-api.test.mjs`; testes de interface em `test/career-interfaces.test.cjs` com o jsdom isolado usado pelo workflow. Nenhum presente, saldo ou resultado é alterado pelos testes de produção: as gravações dos testes usam SQLite em memória e respostas simuladas.

## Sem equipe e saída em massa

No cadastro individual, **Deixar sem equipe / F/A** abre um editor com os vínculos abertos. Os vínculos confirmados ficam selecionados; passagens importadas precisam de seleção explícita. Informe a data/período ou edição da saída, motivo público e fonte opcional. A operação encerra os vínculos selecionados e marca a disponibilidade F/A em uma transação. Pessoas sem passagem aberta também podem ser marcadas F/A. As datas de entrada, estatísticas e passagens antigas não são apagadas. Motivo e fonte da saída são preservados separadamente da fonte original da passagem.

No topo do painel, **Saída em massa** permite buscar uma equipe e conferir jogadores e comissão, vinte pessoas por página. Inicialmente, só vínculos ativos, empréstimos e reservas ainda abertos são elegíveis. Ative **Incluir passagens importadas a revisar** quando a equipe ainda não estiver revisada: esses nomes podem incluir ex-integrantes e vêm desmarcados. Cada passagem é selecionável e **Selecionar esta página** seleciona somente a página visível; a seleção permanece ao mudar de página. Trocar equipe ou filtro limpa a seleção. O resumo mostra todos os nomes escolhidos antes da confirmação. Não há download do catálogo completo.

Um pedido aceita até cem pessoas, com revisão esperada de cada cadastro e nonce estável para repetição segura após falha de conexão. O banco aplica todas as saídas em uma única transação: um conflito, data inválida, vínculo de outra equipe ou outro vínculo confirmado ainda aberto impede o pedido inteiro. Nenhum registro de exemplo é alterado automaticamente. Saídas futuras não podem marcar disponibilidade F/A agora. Cada pessoa recebe seu próprio registro de auditoria `bulkDeparture`; **Alterações → Desfazer** restaura a última edição individual com verificação de revisão. Não existe desfazer coletivo por cima de edições posteriores.

O perfil público exibe **Sem equipe / F/A** e o período informado, enquanto as páginas das equipes deixam de listar esse vínculo como atual. O cache público continua limitado a sessenta segundos.

## Inscrição da WB e continuidade

`player-data/wb-registration-sources.json` identifica as listas completas da série WB Brasil, em ordem cronológica. `scripts/build-career-registrations.py` gera `functions/career-registrations.json` somente para o servidor, resolvendo os nomes para IDs estáveis do catálogo. O workflow executa esse gerador antes dos testes e do deploy, inclusive quando listas da WB são alteradas. Para a próxima edição, inclua a fonte com `complete: true` somente após concluir o cadastro de todos os times. Uma lista parcial/draft nunca causa saídas por ausência. A lista atual é WB 2026 S2; o Mundial é outra série e não substitui a WB Brasil.

A sincronização roda uma vez por versão do cadastro, em transação, com auditoria `registrationSync`. Quem permanece no mesmo time mantém a mesma passagem; mudança de equipe abre outra. Um jogador de edições anteriores ausente da lista completa atual fica F/A, sem inventar um dia exato de saída: a última participação e a nova situação usam apenas a edição estimada. Exemplo: Cauan7 tem Virtus Pro como última equipe na WB 2026 S1 e está F/A na WB 2026 S2. A ausência de comissão numa lista apenas de jogadores não provoca saída automática de coaches/managers.

Uma saída, disponibilidade ou transferência manual tem prioridade sobre as inscrições da mesma WB, inclusive registros existentes de antes dessa sincronização. Assim, atletas que o administrador já deixou F/A não voltam à equipe por causa da lista congelada da competição. Quando uma nova WB completa é publicada, as novas inscrições passam a valer; as passagens e datas anteriores permanecem no histórico. A sincronização não altera os arquivos de estatísticas nem carrega o catálogo completo no navegador.

A consulta pública individual inclui no máximo vinte resumos de companheiros da equipe atual. O ETag incorpora a versão global para que a saída de um companheiro invalide o elenco do perfil, mesmo sem alterar a revisão do jogador consultado. A interface reaplica o estado central a redesenhos tardios do perfil sem fazer novas consultas nem iniciar um ciclo de mutações.

## Diretório de equipes e revisão central

O painel agora separa Jogadores, Comissão técnica, Times e Pendências. Consultas continuam limitadas a vinte registros por página no servidor. Pessoas podem ser filtradas por situação, cargo registrado, equipe atual ou todo o histórico; a origem mostra importação, inscrição da WB ou revisão manual, com base na auditoria real. A fila de pendências separa passagens a revisar, limites sem período, possíveis múltiplos vínculos atuais e nomes alternativos em conflito. Alertas não geram mudanças automáticas.

Cada equipe tem elenco atual, ex-integrantes, movimentações, cadastro e alterações. O elenco separa jogadores e comissão pelo cargo da passagem. Ex-integrantes são pessoas sem vínculo atual nessa equipe; voltas e passagens anteriores permanecem nas movimentações. A transferência abre o editor individual e a saída em massa reutiliza a seleção paginada com o time preenchido. A situação da organização (ativa, pausada, histórica ou a confirmar) não altera os vínculos pessoais.

`saveTeam` salva nome, sigla, nomes alternativos, situação e escudo com revisão esperada e nonce. O ID da equipe e o nome usado como endereço histórico permanecem estáveis: mudar a apresentação não reatribui abates, títulos ou elencos de campeonatos. Os nomes anteriores continuam resolvendo para a mesma organização. Novos nomes alternativos não podem pertencer a outra equipe. Não há fusão automática de organizações parecidas. Ao salvar uma passagem para equipe ainda inexistente, o admin precisa confirmar a criação; o gateway exige `confirmNewTeam: true`.

Para alterar logos mais rapidamente, use o atalho **Escudos das equipes** no Admin ou acesse `/admin-carreiras.html?sec=teams`. Busque a equipe, toque em **Trocar escudo**, escolha no **Banco de imagens do site** (busca por equipe, nome antigo ou arquivo) e clique em **Salvar equipe**. Também continuam disponíveis o envio de PNG/JPG/WebP e o campo de link. O ranking anual usa o JSON estático para pontuação e logos de reserva, mas consulta apenas as identidades das equipes visíveis pelo resolvedor público (`js/career-team-identities.mjs`), em lotes de até 20, para substituir o escudo quando há cadastro manual atualizado. O gerador de cards aceita imagens salvas no endpoint de escudos do próprio Worker por CORS; links externos continuam sujeitos ao suporte do editor. Nenhum recálculo do ranking nem regeneração de JSON é necessário para refletir uma nova logo no site; nomes, colocações e pontos permanecem nos arquivos estáticos.

Escudos enviados são reduzidos no navegador a até 256 pixels e salvos como imagens independentes. `GET /careers/logo/:id` usa cache imutável de um ano; diretórios e respostas de identidade contêm apenas o endereço. Links HTTPS e caminhos locais de imagem também são aceitos; SVG e esquemas executáveis são recusados. A auditoria privada de equipes não é publicada.

As páginas públicas consultam identidades apenas das equipes visíveis, em lotes de até vinte nomes, sem baixar o catálogo. Somente identidades editadas manualmente substituem as fontes anteriores; equipes ainda não revisadas mantêm seus escudos das planilhas. Cabeçalhos de equipes e os escudos exibidos nas páginas integradas usam o cadastro central. Endereços originais preservam a associação com os dados estatísticos antigos. Equipes novas sem resultados ganham uma ficha básica com seus vínculos. O cache de identidades e vínculos é de até um minuto.

Operações administrativas adicionais: `teamDetail`, `resolveTeam`, `reviewSummary`, `saveTeam` e `teamHistory`. A consulta pública `GET /careers/team?identities=[...]` retorna somente metadados revisados das equipes solicitadas, no máximo vinte; `metadata=1` consulta uma única identidade. A variante de consulta integra o ETag. Testes adicionais: `test/career-team-identities.test.cjs` e cenários novos nos testes de carreiras e no gateway autenticado.

O banco de escudos usa `data/team-logo-catalog.json` (cerca de 20 KB), gerado offline por `node scripts/build-team-logo-catalog.cjs` a partir dos cadastros, históricos, mapa de logos e banco do tier constructor. Não consulta a API do GitHub, Cloudflare ou planilhas para pesquisar. Carrega uma única vez ao abrir uma equipe/galeria e mostra até 24 imagens inicialmente, com `loading=lazy`. Cadastros sem escudo aproveitam a correspondência exata de nome/alias do índice; escudos personalizados são preservados. A escolha apenas prepara o formulário: `Salvar equipe` publica a alteração no cadastro central. Ao atualizar o índice, incrementar a versão da URL em `js/career-logo-picker.mjs` para renovar o cache. Testes: `test/career-logo-picker.test.cjs` e `test/career-interfaces.test.cjs`.


### Escudo único nas páginas públicas

`admin-carreiras.html` é a edição central. `js/career-team-identities.mjs`
consulta somente as identidades de imagens visíveis (máximo 20 por lote,
cache positivo/negativo de um minuto) e aplica a logo manual antes de planilhas
ou arquivos antigos. `data-team-logo` identifica a organização; usar os aliases
já existentes em `team-aliases.json` ao gerar a marcação (Keyd → Vivo Keyd).
A tabela mantém o nome e os resultados da edição; trocar escudo não os altera.

`js/other-tournaments.min.js` usa essa mesma marcação em tabelas, elencos,
premiação, cards, radar e janela do elenco. `otGetTeamLogo` consulta primeiro o
cadastro central e depois o banco estático compartilhado; não consulta outra
base individual nem baixa o cadastro inteiro. Imagens reutilizadas mudam sua
identidade ao trocar a equipe da janela. Redesenhar abas reaproveita o cache.
Links de imagem inválidos caem no escudo padrão, sem ciclo de retentativas.
Ao modificar o resolvedor compartilhado, atualizar as versões dos consumidores
públicos e do shell. Testes de Sentosa em `test/liquipedia-worlds.test.cjs` e de
cache/visibilidade/janela em `test/career-team-identities.test.cjs`.

## Identidade histórica da organização (nome e escudo por data)

No diretório Times, abra a organização e use **Registrar mudança** ou a aba
**Nome e escudo no tempo**. A primeira ficha é o nome/escudo anterior à primeira
mudança e fica sem data de fundação. Cada ficha seguinte define **A partir de**,
nome, sigla, escudo, tipo (renomeação, patrocínio, fusão, absorção ou outro),
organização envolvida como referência, observação pública e fonte opcional.
O calendário de prévia permite conferir a apresentação antes de salvar.
O escudo aceita o banco existente, link/caminho ou envio reduzido a até 256 px.

`saveTeam` aceita `identityHistory`, com até 24 períodos. Validação e seleção
estão no modelo puro compartilhado `js/team-identity-history.js`, usado pelo
servidor e pelas interfaces. Datas completas são únicas, válidas e ordenadas;
a mudança vale inclusive no dia informado. Nomes de todos os períodos viram
aliases da **mesma organização**, com os controles existentes de conflito,
revisão, nonce, transação e auditoria. Uma fusão registrada no Fluxo não absorve
os resultados nem os aliases da W7M Esports anterior. Relacionar uma organização
como referência não transfere jogadores, títulos, estatísticas ou pontos.

Mudanças futuras são projetadas pelo relógio, sem agendador, gravação diária
ou atualização de cada torneio. O ID e `pageName` permanecem estáveis. Sem
histórico configurado, o comportamento anterior é preservado. Corrigir o nome
ou escudo pelo Cadastro atualiza somente o período vigente; para uma mudança
nova com preservação do anterior, usar Registrar mudança. Datas de anúncios
não são presumidas nem inseridas automaticamente a partir dos exemplos.

O resolvedor público recebe os períodos junto das mesmas identidades visíveis
(até 20 organizações por lote; cache de 60 segundos), sem consultas adicionais
por data. `data-team-date` no elemento/ancestral informa a data do contexto;
`data-team-name` permite atualizar rótulos sem alterar resultados ou ações.
Torneios usam a data inicial informada pela fonte, rankings anuais usam 31/12,
e cabeçalhos da organização usam a identidade atual. Nomes e escudos históricos
continuam apontando ao `pageName` estável da organização atual. As páginas BR
S1/S2, EWC, Global, Inícios, Outros torneios, rankings e recortes de temporada
recebem esse contexto. Passagens encerradas usam a saída ou última participação
conhecida; vínculos atuais usam a identidade vigente. Resultados de coaches
escolhem o nome por split e agrupam evolução pelo ID, sem contar renomeações
como organizações distintas.

Testes: `functions/test/team-identity-history.test.cjs`, cenários de calendário
em `test/career-interfaces.test.cjs` e de duas datas na mesma página em
`test/career-team-identities.test.cjs`. Os exemplos de datas nos testes são
sintéticos; não são configurações reais de LOUD ou Fluxo.


## Logos de campeonatos e apresentação do elenco

No topo de **admin-carreiras**, abra **Logos de campeonatos**. A busca e o filtro
“Só sem logo” usam `data/tournament-assets.json` (cerca de 11 KB) em memória.
Selecione a competição, use uma imagem já disponível, cole HTTPS/caminho do site
ou envie PNG/JPG/WebP. O upload é reduzido localmente a WebP de até 256 px.
Salvar vazio restaura a seleção automática. Nomes equivalentes se aplicam à mesma
edição; não agrupar anos diferentes como aliases. Não há imagem inventada para
uma competição sem material: o gerenciador sinaliza a pendência.

`functions/career-tournament-assets.js` mantém somente as personalizações em um
documento de até 300 itens na tabela `career_tournament_assets`, separado de
pessoas, passagens e resultados. Salvar usa a mesma autenticação, nonce e transação
do painel, com revisão para evitar sobrescrever outra edição. Uploads reutilizam
`career_team_logos` e URLs imutáveis. A API pública omite o responsável pela edição.

`GET /careers/tournaments` tem cache no navegador e na borda por 60 segundos,
além do documento em memória no Durable Object. Uma leitura indexada de uma linha
atualiza o cache; não percorre pessoas ou torneios. A página busca o catálogo e as
personalizações uma única vez quando aparecem imagens `data-tournament-name`,
sem polling, chamadas por card ou consultas por filtro. Atualizações públicas
podem levar até dois minutos por causa do cache. Os arquivos competitivos não são
reescritos: a apresentação resolve a logo compartilhada.

Regerar o catálogo offline após adicionar competições:
`python scripts/build-tournament-assets.py`; conferir com `--check`.
Os títulos e resultados da equipe priorizam o tier, com data decrescente dentro
da categoria. Resultados também oferecem ordem cronológica e expansão local.
O tier registrado tem prioridade; quando ausente, as famílias Mundial/EWC e
LBFF/WB usam suas categorias gerais S e A. Nenhuma pontuação é alterada.

Jogadores e comissão são agrupados localmente a partir da mesma página de até
20 passagens. Fotos são carregadas sob demanda. Alternar Na equipe/Todas as
passagens mantém a paginação e o cache existente; clicar no filtro já ativo não
repete a leitura. A interface distingue cadastro central do elenco de um torneio.
