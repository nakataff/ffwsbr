# CFF COINS, roleta e loja da Central

A carteira de pontos é independente do ranking de interações. Os pontos do ranking continuam intactos. A carteira recebe uma bonificação proporcional às interações, sem converter ou consumir a pontuação competitiva original.

## Como participar

Entre com Google em `conta.html` e complete o cadastro. O cartão **Check-in diário** no início do próprio perfil confirma a moeda e, com Instagram verificado, também a presença no ranking. A Loja mantém o mesmo check-in; as duas entradas compartilham o crédito diário. Se o ranking falhar, o crédito da carteira fica salvo e o usuário pode tentar confirmar o ranking novamente, sem crédito duplicado. O dia e a sessão do Instagram são conferidos no servidor; o navegador não escolhe a identidade premiada.

Abra `conta.html?tab=points` para ver a carteira e a roleta. O check-in vale 1 ponto por dia; a roleta tem um giro gratuito por dia. O dia muda à meia-noite de Brasília. Cadastro completo e Instagram confirmado liberam mais 3 pontos, uma vez. Check-in ou giro em cinco datas da mesma semana (segunda a domingo) liberam 3 pontos adicionais automaticamente.

| Prêmio da roleta | Chance inicial |
| --- | --- |
| 1 ponto | 80% |
| 3 pontos | 10% |
| 10 pontos | 5% |
| 25 pontos | 3% |
| 50 pontos | 1% |
| Um codiguinho | 1% |

Sem um código válido no estoque da roleta, a chance de codiguinho fica em zero e os 1% passam para 1 ponto. As chances efetivas são aplicadas no servidor. Códigos com validade vencida não participam do sorteio nem da loja.

## Convites

Cada pessoa copia seu link da aba Pontos e loja. O amigo precisa abrir o link e concluir o cadastro enquanto a conta Google criada no Firebase Auth tiver até 24 horas. Contas antigas não contam; a data editável do perfil não é usada para essa verificação. O primeiro convite registrado é preservado.

O convite paga 5 pontos ao convidador depois que o amigo confirmar um Instagram diferente e fizer check-in ou girar em três datas. Cada Instagram só valida um convite. Há um máximo de cinco convites premiados por pessoa por mês de Brasília. Convites que atingirem esse limite não acumulam recompensa para o mês seguinte.

## Administração

Abra `admin-pontos.html` com a conta administrativa habitual. Você pode cadastrar estoque, editar chances, criar ou desativar recompensas, pesquisar pessoas e ajustar saldos com motivo registrado. O painel principal e o admin de perfis têm atalhos para essa página.

Em `admin-codiguinhos.html`, desbloqueie o controle e use **Reservar para roleta/loja** em um código disponível. Escolha Roleta, Loja ou ambos e confirme. O código deixa de estar disponível para envio manual; essa reserva também é bloqueada no servidor. Códigos destinados à roleta e à loja compartilham uma única unidade quando o destino for “ambos”. O item fornecido pela roleta é identificado pelo título do código no presente recebido.

O codiguinho da loja custa inicialmente 1.000 pontos, com limite de um resgate por pessoa a cada 30 dias. Avatares, capas e molduras podem ser cadastrados usando imagens exclusivas ativas do catálogo de perfis. Preços sugeridos no formulário: 20, 40 e 80 pontos. Nenhuma imagem é adicionada automaticamente à loja; escolha quais você quer oferecer. Itens gratuitos e exclusivos de administradores não podem ser vendidos.

## Entregas e proteção

O sorteio ocorre no servidor. O navegador não define prêmio, pontos ou data. Créditos, débitos, giros e reservas usam transações SQLite no Durable Object já existente do Cloudflare. Repetir a mesma operação não gera outro giro, débito ou prêmio. O saldo não pode ficar negativo. A imagem não pode ser comprada novamente pela mesma pessoa.

Os prêmios são entregues em **Presentes**: codiguinhos privados com imagem `edition/gift.webp`, nome do item e código para copiar; imagens com propriedade liberada para uso no perfil. A reserva permanece em caso de falha de rede. O usuário e o administrador têm **Concluir entrega**, que retoma o pedido original sem novo gasto. A confirmação registra a chegada ao inventário; o site não confirma o uso do código no jogo.

Carteiras, estoque, convites e histórico ficam no SQLite privado. O Firebase recebe as entregas e fornece verificações pequenas do cadastro e Instagram. A carteira carrega por pedido do usuário, com no máximo 30 movimentações e 10 entregas pendentes por consulta. O custo incremental depende do uso real, sem garantia de consumo zero ou de permanência dentro de uma franquia gratuita.

Testes: `node --test functions/test/economy.test.cjs`, `npm test` e `npm run check` em `cloudflare/camp-notifications`. O deploy mantém o Durable Object existente; não é necessária uma nova migração. A credencial `CFF_GOAL_SERVICE_ACCOUNT` já usada pelo Worker deve ter permissão `firebaseauth.users.get` para conferir a criação das contas convidadas.


## Fotos e escolha do codiguinho

Cada tipo de codiguinho aparece na loja com seu nome, foto, quantidade disponível, preço e o saldo da pessoa. O resgate fica vinculado ao tipo escolhido. Se esse tipo acabar antes da confirmação, o resgate falha sem cobrar pontos, mesmo que outro tipo ainda tenha estoque.

As fotos do controle de codiguinhos acompanham as novas reservas. Ao desbloquear o controle, as fotos que faltam nos códigos já reservados são atualizadas automaticamente; há também o botão **Atualizar fotos do estoque**. No painel de pontos, **Editar foto e detalhes** permite adicionar ou trocar a foto de um código que ainda não foi sorteado/resgatado. Códigos sem foto usam a imagem do presente como alternativa.

Uploads são reduzidos a até 384 pixels no navegador. Imagens iguais são guardadas uma única vez no SQLite e servidas por uma URL de conteúdo imutável com cache. Somente as fotos de produtos ficam disponíveis nesse endpoint; códigos, saldos e destinatários continuam privados. O Firebase não recebe uma coleção extra de imagens.

A roleta tem seis setores visuais, com um presente genérico no setor de codiguinhos, giro contínuo durante o pedido, pelo menos seis voltas e desaceleração até o prêmio confirmado pelo servidor. Uma janela apresenta o prêmio e o saldo atualizado. A preferência de movimento reduzido é respeitada. Sem estoque, os avisos da roleta e da loja aparecem separadamente; os 1% do código passam para 1 ponto (81% com a configuração padrão).

A atualização das chances é aplicada uma vez na implantação, preservando saldos, giros antigos, códigos e preços já cadastrados. Alterações posteriores feitas pelo administrador continuam valendo após reinícios.

## Interface e destinos do estoque

A área de pontos não exibe porcentagens; as chances continuam validadas no servidor. A roleta e a loja mostram avisos independentes quando não houver códigos válidos no respectivo estoque. Os prêmios disponíveis incluem foto, nome e quantidade.

No controle de codiguinhos, o painel de pontos aparece depois do resumo de códigos, com formulários separados para reservar e editar. Etiquetas sobre a foto indicam Loja, Roleta ou Roleta e loja e a quantidade de cada destino. Cada código reservado também mostra uma etiqueta com acesso à edição. O destino pode ser alterado somente enquanto o código estiver válido e não reservado para um resgate; a troca preserva foto, título e validade.

O admin consulta o estado de todos os códigos visíveis por hashes em lotes de até 500, sem expor códigos no retorno. As consultas são reaproveitadas por um minuto; alterações e o botão de disponibilidade atualizam imediatamente. Fotos que faltam no estoque são sincronizadas ao desbloquear o controle; o botão de fotos permite forçar a atualização das imagens já cadastradas. Códigos entregues ou com entrega pendente continuam bloqueados para envio manual.

## Meta mensal de um codiguinho

Desde **01/10/2026**, cada data de Brasília com pelo menos um comentário válido ou Story aprovado no ranking rende **40 CFF COINS**. Várias interações na mesma data contam uma vez. A meta é **25 dias × 40 = 1.000 CFF COINS por mês**, suficiente para o preço padrão de um codiguinho, sem contar sorte na roleta, check-in, bônus de Top 3 ou histórico. O resgate depende de estoque e mantém o intervalo de 30 dias. Preços personalizados do administrador são preservados.

O teto mensal é 1.000 moedas. Check-ins, palpites e outros bônus de pontos não substituem comentário ou Story nessa meta. Os dias válidos já registrados desde 01/10 também contam, para reconhecer a participação anterior à publicação da regra. Os demais bônus continuam somando. A Loja mostra dias válidos, moedas recebidas, meta e regra resumida; o painel Bônus do administrador apresenta a mesma política.

O leitor D1 seleciona apenas datas distintas de prêmios positivos de tipo `comment` ou `story`, sem datas ou registros futuros. A carteira vincula os créditos à identidade estável do Instagram e paga apenas a diferença em transação SQLite, com chave única por identidade, mês e total. O cache também vence na mudança de dia de Brasília. Meses anteriores elegíveis podem ser creditados depois; os saldos e créditos existentes são mantidos. Não é criado um novo banco ou listener do Firebase.

## Bônus de interações e Top 3

A partir de 13/10/2026 às 20h44 de Brasília (`2026-10-13T23:44:00Z`), a carteira reconhece o histórico de participação. O bônus retroativo é `min(500, floor(pontos anteriores / 5))`, concedido uma única vez para cada identidade confirmada do Instagram. A revisão da regra usa o `retro_source` já registrado: quem recebeu na regra de 1/20, até 100 moedas, ganha somente `max(0, novo total - retro_credit)` em uma transação, com chave única `interaction-retro-v2:<user_key>`. Isso mantém gastos anteriores, protege contra duplicidade e roda antes do cache, mesmo com indisponibilidade temporária do ranking. As novas interações rendem `min(10, floor(pontos novos da semana / 20))` pontos por semana. Atualizações creditam somente a diferença ainda não recebida; correções que diminuam o ranking não retiram créditos já pagos. Não há dupla contagem dos pontos anteriores ao início do sistema.

O Top 3 semanal paga 5, 3 e 2 pontos; o mensal paga 10, 7 e 5. Esses bônus são adicionais ao limite de conversão semanal. A primeira semana elegível começa em 12/10/2026; o primeiro mês é outubro de 2026. Os pódios são conferidos somente depois do período encerrar no horário de Brasília. Semanas e meses anteriores ao início recebem reconhecimento pelo bônus retroativo proporcional, sem bônus adicional de pódio.

Os créditos são conferidos automaticamente ao abrir a Loja e ao consultar uma pessoa no admin de pontos. A Loja tem **Conferir bônus** e mostra retroativo recebido, progresso semanal e soma dos bônus de Top 3. O administrador vê os créditos na consulta da carteira. Quem vincular seu Instagram posteriormente também pode receber o histórico anterior e os períodos elegíveis ainda não pagos.

A identidade estável do Instagram impede que uma pessoa repita o bônus mudando de nome ou usando outra conta. Créditos e marcos ficam no SQLite privado, com transações e chaves únicas. O leitor consulta o D1 existente por um binding, somente com SELECTs, sem listener adicional no Firebase e sem criar outro banco. A conferência normal é reaproveitada por 15 minutos; mudanças de semana/mês e períodos pendentes provocam nova conferência. Pódios encerrados são guardados uma vez para todas as carteiras, usando o snapshot do ranking quando disponível, e não são recalculados após o pagamento.

A leitura de períodos atrasados é limitada a 12 pódios por pedido, preservando o restante para a próxima conferência. Falhas na leitura do ranking exibem um aviso e não bloqueiam o saldo ou as demais recompensas. A consulta pública `/economy-interactions/health` verifica apenas o acesso às tabelas, sem dados pessoais ou créditos.

Validação adicional: `node --test functions/test/economy-interactions.test.cjs` e `cloudflare/camp-notifications/test/interaction-ranking.test.mjs`, incluindo limites, repetição, concorrência, identidade, corte do histórico e fechamento de períodos.

## Nome da moeda e ranking de carteiras

A moeda da carteira se chama **CFF COINS**. A mudança é apenas de nome: os saldos, preços, limites, histórico e cálculos continuam com os mesmos valores. Os pontos do ranking de interações continuam separados: cada 20 pontos desse ranking liberam 1 CFF COIN, conforme os limites acima. Resultados antigos da roleta são apresentados com o nome atual da moeda, preservando os registros originais.

O admin de CFF COINS e loja (`admin-pontos.html`) começa com um ranking privado. Ele pode ser ordenado pelo saldo disponível ou pelo total ganho. Mostra posição, pessoa, saldo, total ganho e total de saídas, com atalhos ao perfil e à consulta da carteira. O ranking inclui carteiras com movimentações e tem páginas de 20 participantes. Os totais da comunidade aparecem no mesmo painel. A consulta não sincroniza nem credita recompensas de outras pessoas.

O endpoint `economyAdmin/coinRanking` aceita apenas a conta administrativa real. Nome e usuário do perfil são mantidos junto à carteira; carteiras anteriores são identificadas por leituras pequenas do perfil, em grupos de cinco, com reaproveitamento por 24 horas. O ranking usa os valores já lançados na carteira; bônus pendentes são conferidos quando a pessoa abre a Loja ou quando o admin consulta sua carteira.

O admin de CFF COINS é organizado em abas: Ranking, Carteiras, Estoque, Loja, Roleta, Bônus e Entregas. O painel usa até 1.480 px de largura e apresenta o ranking em cartões no celular. A aba Bônus contém uma simulação informativa; ela não concede moedas nem aceita alterar a pontuação histórica. O servidor é a autoridade para os créditos.

## Itens do Free Fire com entrega manual

Na aba Loja do admin, o tipo `game` aceita imagem (upload otimizado ou URL aprovada do site), título, legenda até 500 caracteres, preço inteiro em CFF COINS e disponibilidade. Cada edição cria uma revisão do anúncio. A compra exige o preço e a revisão exibidos, nonce UUID e ID do jogo como string numérica de 6 a 20 dígitos. A interface pede digitação dupla e confirmação do ID. Não há cobrança em dinheiro.

`buyGameItem` debita a carteira e grava `eco_game_orders` na mesma transação SQLite. O pedido mantém uma cópia da imagem, título, legenda, preço e destinatário, independente de edições do catálogo. A mesma nonce só pode representar o mesmo usuário, item e ID do jogo. São permitidos até dez pedidos pendentes por pessoa. Os pedidos não usam a entrega automática de codiguinhos ou imagens de perfil.

O comprador vê seus pedidos na Loja e pode chamar `cancelGameOrder` somente enquanto `pending`; o cancelamento estorna o preço original uma vez. `finishGameOrder` é exclusivo do administrador real: `delivered` dá saída sem permitir cancelamento; `rejected` exige motivo e devolve as moedas. Cancelamento, baixa e recusa verificam novamente o estado dentro da transação. O estorno aparece no histórico, reduz as saídas e não infla o total de moedas ganhas. A entrega no jogo é feita pelo administrador antes de dar saída.

A aba Pedidos do jogo tem filtros, contadores, paginação de vinte pedidos, ID copiável, perfil, confirmação e observação. A listagem do comprador é restrita à identidade do token; a listagem completa e a baixa exigem o e-mail administrativo verificado. Nenhum ID do jogo é exibido no ranking público. Os pedidos permanecem consultáveis mesmo se o perfil for removido.

A aba Carteiras permite selecionar diretamente uma pessoa do ranking, enviar ou remover moedas por ações separadas, aplicar atalhos de Top 3 e conferir o saldo resultante. O servidor revalida o nome do perfil selecionado e retorna o saldo após o ajuste. Repetir a nonce não duplica o envio, e o histórico identifica a conta administrativa responsável.

### Correções de cadastro e atualização do ranking

O campo identificador do formulário usa `itemId`, e o despacho de eventos consulta `getAttribute('id')`, evitando que propriedades nomeadas do HTMLFormElement bloqueiem o salvamento. O formulário mostra o andamento e as falhas ao lado do botão; os campos são preservados em caso de erro. Se o cadastro concluir e a atualização da lista falhar, a mensagem distingue esses dois resultados.

Ao carregar/atualizar o ranking, o admin executa `syncCoinRanking` antes de ordenar os saldos. A operação percorre todas as carteiras SQLite existentes, inclusive as zeradas, em lotes de cinco, sem depender de abrir um perfil. A mesma conferência individual valida o Instagram, respeita o cache de um minuto e mantém as chaves de crédito idempotentes. Erros de origem são contabilizados e não bloqueiam o saldo já disponível. Cada interação do painel limita a doze lotes; populações maiores continuam a partir do cursor anterior na próxima atualização, evitando ciclos que ultrapassem o limite de requisições.

O ranking visível atualiza os saldos locais a cada minuto; a conferência dos bônus se repete em cinco minutos, e o botão Atualizar ranking solicita nova conferência respeitando o cache. Abas fora do ranking e páginas ocultas não fazem essa atualização periódica. A interface mostra o horário da conferência, falhas temporárias ou lotes ainda pendentes. Esta atualização não importa em massa todos os cadastros do Firebase.


## Vale Codiguinho

No `admin-codiguinhos.html`, a aba **Vales Codiguinho** permite enviar uma imagem PNG/JPG/WebP, localizar uma conta pelo @ cadastrado na Central, definir uma data de validade e enviar 1 vale. A validade encerra às 23h59min59,999s de Brasília. A imagem é compartilhada por todos os vales e carregada separadamente do catálogo. O envio exige conferência do perfil e guarda um identificador único para repetir uma tentativa sem duplicar o vale. O histórico tem páginas de 20 registros e filtros de situação. Vales ainda não trocados podem ser cancelados com motivo.

Na loja da conta, cada codiguinho mostra **CFF COINS / 1 VALE CODIGUINHO** e botões separados. A troca por vale usa primeiro aquele que vence antes. Vale não gasta moedas e não entra no intervalo de 30 dias das compras com moedas; pode trocar por qualquer codiguinho disponível na loja, nunca por imagem de perfil ou item enviado no jogo. Não há garantia de estoque futuro.

`eco_vouchers` guarda a titularidade, validade, remetente, mensagem e recibo; índices por titular/validade e data evitam carregar a base inteira. O consumo do vale e a reserva do estoque são uma única transação SQLite. O código segue a entrega privada já existente em Presentes. Se a entrega falhar, o recibo continua pendente e pode ser retomado mesmo depois do vencimento, sem cobrar outro vale. Vales reservados não podem ser cancelados. O estado da conta traz a quantidade válida, o próximo vale e os últimos 20 registros; o admin consulta 20 por página. Nenhuma regra nova de escrita pública no Firebase é necessária.


## Abertura direta de codiguinhos

Resgates com moedas ou vales e retomadas de entregas devolvem o `giftId` privado do destinatário. A loja abre a mesma janela de código do inventário, com copiar e atalho para o resgate oficial; o código continua salvo em Presentes. A roleta tem um botão para abrir diretamente o prêmio entregue. O recibo não devolve o código em texto: a abertura continua passando pelo endpoint autenticado `openCodeGift`, com conferência da conta e sem novo débito. A loja mantém um botão para reabrir o último codiguinho da sessão.

No conta.html, o vínculo do Instagram aparece no início do perfil e da loja. O bloco gera o código, orienta o envio no direct e, após a confirmação do servidor, salva pela rotina autenticada existente. Não consulta o servidor em loop; geração e conferência dependem de clique. Um código pendente é preservado durante redesenhos e na sessão do navegador, separado por UID. Trocas de conta invalidam respostas antigas.


## Devolução administrativa de codiguinhos

A aba Devoluções do admin-codiguinhos lista entregas e devoluções em páginas de 20 registros. A janela do presente aberto também oferece Devolver ao estoque para a conta administradora. A confirmação exige declarar que o código continua válido e não foi usado no jogo, informar motivo e escolher loja, roleta ou ambos. O site não consulta nem confirma o uso na Garena. Códigos expirados e presentes manuais fora do estoque não podem usar esta devolução.

A devolução registra uma intenção em eco_code_returns, marca o recibo como returning, substitui o presente por um registro sem código e devolve a atribuição ao estoque. Somente após essas etapas, uma transação libera o estoque, estorna exatamente o débito original (sem aumentar o total ganho), restaura o vale com a validade original e marca o recibo como returned. A devolução permite repetir tentativas sem duplicar o estorno. Recibos devolvidos deixam de contar para o limite de compra de 30 dias e não podem ser entregues novamente. Um prêmio devolvido da roleta não concede um novo giro.

O presente antigo é preservado como devolvido, sem o código; abrir pelo endereço ou recibo antigo é recusado. As atribuições trazem dados de reconciliação para retirar o carimbo antigo do controle criptografado, preservando uma entrega nova do mesmo código. O backend continua exigindo a conta administradora real; a opção não fica disponível ao comprador comum.

## Quiz diário com banco privado

`conta.html?tab=quiz` oferece três perguntas por pessoa por data de Brasília. A recompensa inicial é **5 CFF COINS por acerto**, até 15 por dia; os pontos do ranking não mudam. A administração altera a recompensa entre 1 e 50 moedas e pode pausar o quiz em `admin-quiz.html`, acessível pelo painel de CFF COINS. O valor fica fixo quando a pessoa começa o desafio daquele dia. As quatro alternativas são embaralhadas no servidor, e cada pergunta admite uma única resposta, enviada em ordem. A resposta correta, explicação e fonte só são devolvidas depois daquela tentativa.

O repositório contém apenas o funcionamento do quiz e perguntas fictícias nos testes. **Não colocar perguntas reais ou gabaritos em commits, issues, logs, arquivos de frontend ou artefatos públicos de Actions.** O banco real é um JSON privado importado pelo painel autenticado. Importações de até 2.000 perguntas são enviadas em lotes de 50; identificadores estáveis permitem repetir ou corrigir uma carga sem duplicar as perguntas. A listagem administrativa mostra 20 por página. Cada pergunta exige categoria, quatro alternativas distintas, índice `answer` de 0 a 3, explicação e fonte HTTPS. Apenas a conta administrativa autenticada pode importar, listar, editar, ativar ou pausar.

O quiz começa pausado e vazio até a primeira importação privada e ativação explícita. O servidor mantém as perguntas no SQLite já existente (`eco_quiz_questions`), um índice compacto de posições (`eco_quiz_pool`), um cursor por conta (`eco_quiz_cursor`) e o desafio em andamento (`eco_quiz_rounds`). O início seleciona somente três posições indexadas. Um percurso com passo coprimo evita repetição antes de percorrer o banco; contas têm início e passo próprios. Alterar o conjunto ativo reinicia esse percurso, mas não muda desafios já iniciados. Editar apenas o texto ou gabarito preserva o percurso e vale para novas seleções. As cópias de desafios anteriores da própria conta são removidas ao iniciar um novo dia; os créditos seguem no histórico normal da carteira.

`quizStatus` lê somente configuração, desafio atual e saldo, sem Firebase, sincronização de bônus ou catálogo de perguntas. Começar exige cadastro completo; responder exige o desafio daquela conta, data e identificador emitidos pelo servidor. Crédito e resposta são gravados na mesma transação, com chave única por conta, dia e pergunta. Reenvios após falhas de conexão retornam o resultado original; outra alternativa é recusada. O navegador não escolhe data, identidade, perguntas nem valor do prêmio. Não há polling ou varredura das carteiras. O cabeçalho recebe o saldo pela mesma publicação de carteira já utilizada no site.

Validação: `node --test functions/test/economy-quiz.test.cjs functions/test/economy.test.cjs` e, com jsdom disponível, `node --test test/daily-quiz.test.cjs test/profile-inventory.test.cjs`. Perguntas do banco privado devem ser verificadas separadamente e importadas pelo administrador; a implantação não inclui conteúdo real.

## Painéis integrados, Top 1 semanal e conferência de inventário

O cadastro em **Codiguinhos** no admin de CFF COINS já reserva o código no destino escolhido (Loja por padrão). O mesmo pedido registra seu hash em `eco_stock_bridge`, uma fila incremental privada. O controle completo busca até 50 códigos por página, no máximo três páginas por conferência, e incorpora os novos códigos, nome, foto, validade e reserva à base criptografada quando ela estiver desbloqueada. Códigos existentes ou arquivados não são duplicados ou restaurados automaticamente. O cursor só avança junto da gravação criptografada; falhas podem ser repetidas. Um aviso local entre abas contém apenas um horário e provoca nova conferência ao salvar. Não se compartilham códigos ou chaves por localStorage, e o servidor não recebe a senha do controle.

**Top 1 da semana** mostra quatro semanas encerradas por página. Reutiliza `eco_interaction_periods`; na primeira abertura de um período ainda ausente, o leitor existente usa seu snapshot ou calcula somente aquela semana e congela o resultado. O vencedor é ligado à conta da Central pela identidade já reconhecida da carteira ou pelo diretório confirmado do Instagram, sem importar todos os usuários. Contas não identificadas aparecem sem botão de envio. A janela exige conferir destinatário e validade. `eco_weekly_voucher_awards` vincula uma semana a um único vale dentro da mesma transação da emissão; reenvios, concorrência e recargas não geram outro prêmio. O painel mostra **VALE ENVIADO** e data para os envios feitos por essa opção. Vales enviados manualmente antes dela não recebem uma associação de semana inventada.

**Inventários** pesquisa o @ e abre apenas os dados daquela pessoa. As páginas de codiguinhos, outros presentes, imagens e insígnias usam consultas Firebase por chave, com até 22 registros lidos e 20 exibidos; não carregam o cadastro inteiro. Emblemas usam o vínculo atual, e vales mostram disponibilidade e os últimos 20 registros. A consulta informa entrega, abertura, arquivamento, devolução e entregas ainda pendentes. Ela não devolve o texto dos códigos, não marca presentes como abertos e não altera propriedade ou saldo. Há atalhos na carteira e no vencedor semanal. Itens gratuitos do catálogo não são duplicados como concessões individuais; os equipados também são identificados.

O convite do quiz é um cartão flutuante na home e na conta, depois de seis segundos, com link direto para jogar. Não bloqueia a navegação nem toma o foco. Fechar ou seguir o link oculta por 24 horas no navegador; concluir o quiz oculta no dia de Brasília. Ele não consulta API, carteira ou ranking, não faz polling e não aparece sobre outra janela aberta. A campanha de apoio não abre por cima do convite do quiz na mesma visita.
