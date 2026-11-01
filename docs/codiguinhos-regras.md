# Codiguinhos — exclusividade e divulgação pública

Regra dos novos resgates da loja a partir desta atualização:

- Venda, anúncios e comercialização são proibidos. Uso pessoal.
- Até 2 codiguinhos por conta em cada mês do calendário, no horário de Brasília.
  Pagamentos com moedas e vales compartilham o limite. Não há intervalo móvel de 30 dias.
- A conta não pode repetir o mesmo prêmio, inclusive em meses posteriores.
  Nome normalizado ignora caixa, acentos, espaços e pontuação; foto/preço não
  mudam a identidade. Mantenha os títulos coerentes no cadastro de estoque.
- Compra ou troca por vale inicia 180 segundos de exclusividade. A pessoa abre
  o presente, digita a palavra exibida pelo servidor e recebe o código para usar
  no Free Fire. Abrir, copiar, arquivar, fechar ou recarregar não reinicia nem
  interrompe esse prazo.
- Aos 3 minutos, o código é publicado em Interações → Codiguinhos divulgados e
  anunciado no chat global, mesmo que já tenha sido aberto/usado. O aviso diz
  que pode já ter sido resgatado. O site não consulta a Garena nem confirma uso.
- Não há estorno de moedas ou devolução de vale pela divulgação. O resgate
  continua contando para o limite mensal e bloqueio de prêmio repetido.
- **O código não retorna à loja.** O estoque mantém seu vínculo ao recibo e o
  admin não pode devolver à loja um código já publicado.
- Presentes antigos e envios manuais não são publicados retroativamente.
  Compras anteriores da loja contam nos limites por conta. Devoluções manuais
  autorizadas antes da divulgação seguem o fluxo existente, com conferência do
  administrador; não são usadas pelo temporizador.

Aviso grande aparece antes dos dois botões de pagamento. Uma versão da regra é
registrada no pedido. Clientes antigos precisam recarregar a loja antes de uma
nova compra, evitando cobrança sem o aviso novo. Só mostrar o desafio da palavra
não revela o código nem marca abertura. Palavra errada não modifica a reserva.

## Dados e custo

`functions/economy-code-policy.js` usa duas tabelas no SQLite existente:
`eco_code_reservations` (índices por status/prazo e conta/status) e
`eco_public_codes` (histórico público e fila de avisos do chat). Não há outro
banco, cron por usuário ou consulta nova ao ranking.

O alarme existente do Durable Object considera o menor prazo entre quedas,
notificações e códigos. Processa até 100 divulgações vencidas e até 3 avisos do
chat por execução. A publicação no SQLite e a notificação pessoal são
transacionais. Código, prazo e pagamento vêm do servidor.

O chat usa ID estável por publicação; uma falha pode repetir a gravação, sem
criar outra mensagem. Há até 5 tentativas, com 60 segundos entre elas. Uma falha
persistente no chat não apaga a divulgação no site. O histórico do chat continua
limitado a 100 mensagens. O aviso não inclui a conta do comprador.

`GET /community/codes` expõe somente os últimos 20 códigos efetivamente
publicados, sem conta, recibo privado ou hash do estoque. O campo `id` é o ID
público da publicação. O cache compartilhado dura 30 segundos. Interações faz
uma requisição ao abrir e outra apenas no botão Atualizar. Mostrar mais e copiar
são locais. Cronômetros da loja/inventário/janela são locais, sem polling.

Contagem mensal usa o índice existente por conta/data. Prêmios já resgatados são
conferidos apenas no histórico da própria conta; não há migração que varre todas
as carteiras nem carregamento de todos os participantes.

Antes da confirmação, o inventário Firebase recebe metadados sem o código; o
código fica no SQLite privado. A rota autenticada de abertura valida dono,
palavra e estado no servidor. Ao receber a palavra correta, revela o código.
Após divulgação ele também fica disponível no feed público, conforme o aviso.

## Verificação

- `functions/test/economy-code-policy.test.cjs`: prazo, privacidade, palavra,
  moedas/vales, concorrência, virada do mês em Brasília, repetição de prêmio,
  presentes antigos, devoluções administrativas e avisos idempotentes.
- `cloudflare/camp-notifications/test/economy-api.test.mjs`: autenticação real
  simulada, alarme, feed público, falha/repetição do aviso no chat e isolamento.
- `test/code-redemption-policy-ui.test.cjs`: aviso, digitação, fechamento,
  código oculto, copiar, atualização explícita e bloqueios dos dois pagamentos.
