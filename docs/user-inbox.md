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

## Janela de mensagens recentes

O ícone de envelope do cabeçalho abre `js/inbox-popover.mjs`, com seis mensagens
recentes, texto expansível e botões de recompensas. O rodapé **Ver tudo no perfil**
continua apontando para `conta.html?tab=inbox`. Ctrl/Cmd/clique alternativo preserva
o link normal. Se o módulo não carregar, o ícone abre a caixa completa.

- Módulo e `css/inbox-popover.css` carregam somente no clique. Não há novas
  requisições ao abrir a página, além do resumo que já acompanha o saldo.
- `inboxPreview` reutiliza a consulta indexada, limitada a sete candidatos pessoais
  e sete compartilhados e até seis marcações. Não busca vinte itens para exibir seis.
- O cache compartilhado do servidor distingue os limites de prévia e caixa completa.
  Nenhuma prévia reduz a paginação de vinte mensagens da página de perfil.
- O navegador reutiliza a prévia por sessenta segundos. Metadados com mensagem
  mais recente invalidam esse cache; Atualizar tem intervalo de trinta segundos.
  Não existe polling nem timer para buscar mensagens em segundo plano.
- O indicador de novidades é limpo ao abrir. A leitura individual só é registrada
  ao expandir uma mensagem ou usar seu botão, sem marcar todas automaticamente.
- O conteúdo fica só em memória. Sair, mudar de conta ou destruir o cabeçalho
  remove a janela e o cache privado; respostas atrasadas são ignoradas.
- Diálogo nativo com foco, fechamento por Escape/backdrop e retorno ao ícone.
  Mobile usa largura de tela com margens e rolagem interna.

Testes adicionais: `test/inbox-popover.test.cjs` e cenários de prévia em
`functions/test/user-inbox.test.cjs`. Health do Worker: versão 39, `inboxPreview: true`.
