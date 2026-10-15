# Histórico central de jogadores e comissão

Abra `admin-carreiras.html` com a conta administrativa habitual. O painel principal tem o atalho **Jogadores e comissão**. Busque uma pessoa, abra seu histórico e use **Adicionar passagem**, **Editar** ou **Registrar transferência**. Transferências encerram a passagem escolhida e criam outra em uma única transação. A aba **Cadastro** permite criar pessoas, atualizar nicks/aliases, categoria e disponibilidade; a aba **Alterações** mostra as últimas vinte edições e permite desfazer a última, sem sobrescrever uma edição concorrente.

Os cargos são jogador, head coach, coach, assistant coach, analista, manager e outro. Entrada e saída aceitam ano, ano/mês ou data completa, além de edição e indicação de confirmado/estimado. Data vazia não é inventada. Cadastros importados ficam a revisar: a primeira/última participação em uma edição não comprova a contratação/desligamento. O vínculo só aparece como atual quando marcado ativo, empréstimo ou substituto dentro do período. Aposentado e sem equipe são situações explícitas da pessoa.

## Armazenamento e consultas pequenas

A base inicial de 378 pessoas, 71 equipes e 811 passagens é gerada por `python scripts/build-career-seed.py` a partir de passagens, aliases, edições e comissão já existentes. `functions/career-seed.json` é **somente do servidor**; nenhuma página o importa ou baixa. O Durable Object SQLite existente importa o seed uma vez, em transação, e não substitui as correções feitas no admin. Não são criados novos listeners ou coleções completas no Firebase.

O admin abre apenas o resumo e vinte nomes; a busca é atrasada enquanto se digita. Cada seleção busca só o cadastro daquela pessoa. Equipes sugeridas e histórico de alterações também têm limite de vinte. Não existe endpoint para baixar o cadastro inteiro.

`GET /careers/person?id=...` retorna uma pessoa; nomes/aliases ambíguos são recusados. `GET /careers/team?name=...&scope=current|all&offset=...` retorna até vinte passagens da equipe solicitada. As respostas públicas têm ETag e cache de até sessenta segundos. O navegador reaproveita pedidos simultâneos e mantém até cinquenta consultas pequenas em memória. Não há polling ou consulta da base completa ao abrir cards.

O admin usa `POST /api` com ação `careerAdmin`, token Firebase e verificação administrativa no servidor. Operações: search, teams, person, summary, history, savePerson, saveTenure, transfer, archiveTenure e undo. Edições usam revisão esperada e nonce para impedir sobrescrita concorrente e repetição. Arquivar remove a passagem da visualização pública sem apagar o histórico. O log privado mantém a identidade administrativa e o estado anterior; as consultas públicas não expõem esses dados.

## Integração pública

`carreira.html?id=...` abre o histórico individual, inclusive de novos membros da comissão. `carreira.html?team=...` permite consultar qualquer equipe cadastrada. Perfis de jogadores, equipes atuais, equipes históricas e perfis internos da home usam o mesmo cliente. Consultas individuais rodam em segundo plano; a área de vínculos da equipe só consulta quando entra próxima da tela.

Quando há revisão manual, o vínculo central passa a ser mostrado no perfil, acima das informações de período. Elencos competitivos antigos continuam identificados pela edição: transferências não reatribuem abates, quedas, títulos ou resultados históricos. A correção antiga de elenco por lista fixa deixa de prevalecer sobre uma pessoa revisada no cadastro central. A disponibilidade pode levar até um minuto para aparecer em outra página por causa do cache.

Validação: `node --test functions/test/careers.test.cjs`; testes de gateway em `cloudflare/camp-notifications/test/economy-api.test.mjs`; testes de interface em `test/career-interfaces.test.cjs` com o jsdom isolado usado pelo workflow. Nenhum presente, saldo ou resultado é alterado pelos testes de produção: as gravações dos testes usam SQLite em memória e respostas simuladas.
