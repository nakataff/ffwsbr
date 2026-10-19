# Caixa de entrada da comunidade

Acesse `conta.html?tab=inbox`. A administração envia, edita e retira comunicados em `admin-mensagens.html`, também disponível no painel principal e em CFF COINS e loja.

## Entrega

- Um comunicado geral cria uma mensagem compartilhada, sem listar usuários nem criar uma cópia por conta.
- Mensagens específicas aceitam até 20 @ da Central por envio. Todos são conferidos antes de gravar; se algum estiver errado, o lote não é enviado.
- Envios manuais têm nonce de idempotência, prévia, revisão, validade opcional, prioridade e botão HTTPS opcional.
- Editar preserva destinatários, ordenação e estado de leitura. Retirar oculta a mensagem, preservando o histórico administrativo.
- Vales, resgates e roleta registram avisos dentro da transação SQL existente. Um codiguinho só é anunciado após a entrega no inventário.
- Presentes manuais, insígnias e imagens usam uma reserva privada com identificador estável. Se a escrita externa falhar, repetir o mesmo pedido conclui a entrega sem duplicar aviso, presente ou concessão.
- Emblemas e conquistas usam o próprio evento de concessão. Nenhuma rotina examina inventários à procura de novos itens. Itens anteriores à implantação não são importados automaticamente.
- Nenhum código secreto aparece no conteúdo das mensagens. Abrir presente aponta para o inventário e solicita o código pelo endpoint autenticado já existente.

## Leituras e organização

- O indicador sinaliza novidades desde a última abertura; não é uma contagem exata de não lidas. Abrir a caixa limpa o indicador, mantendo a marcação de leitura de cada mensagem.
- O resumo lê apenas três registros por chave (metadados global, pessoal e de abertura). Ele acompanha a requisição de saldo do cabeçalho, check-in do perfil, loja ou estado inicial dos desafios. Não cria outra consulta periódica.
- O cabeçalho mantém o cache de saldo existente. Não há polling, cron, WebSocket ou atualização automática em segundo plano para a caixa.
- A caixa recupera até 21 candidatos pessoais e 21 compartilhados por página, mescla os 20 mais recentes e lê apenas suas marcações. Paginação por cursor, sem OFFSET nem COUNT global.
- As páginas de comunicados gerais têm cache compartilhado de 60 segundos em memória, limitado a 64 entradas; enviar, editar e retirar invalidam o cache imediatamente.
- Itens retirados, expirados e arquivados são filtrados depois do limite de candidatos. Uma página pode conter menos de 20 mensagens e ainda oferecer Carregar mais, sem varrer o histórico para preencher a tela.
- Marcar todas como lidas grava um cursor por usuário, sem atualizar milhares de mensagens. Novas mensagens após o primeiro carregamento não são marcadas por esse botão.
- Arquivar grava apenas a relação usuário/mensagem, sem modificar o item ou a recompensa. As mensagens de outras pessoas são inacessíveis pelo ID.
- O botão Atualizar aguarda 30 segundos entre carregamentos bem-sucedidos. Erros podem ser tentados novamente.

## Verificação

`node --test functions/test/user-inbox.test.cjs`

`NODE_PATH=<dependências de navegador> node --test test/user-inbox.test.cjs test/header-wallet.test.cjs test/quick-rewards.test.cjs test/profile-inventory.test.cjs`
