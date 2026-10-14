# Teste de presentes pelo navegador

Página de teste: `/admin-presentes-teste.html`, com atalho no cabeçalho de `/admin-pontos.html`.

Esta é uma **demonstração fictícia**, para testar pelo site sem instalar Node. Não acessa pedidos reais, autenticação Garena, Firebase, CFF COINS reais ou diamantes reais. Não recebe senha, token ou URL de login. Os dados ficam em memória nesta aba e desaparecem ao recarregar. CSP bloqueia conexões de rede e submissão de formulários; somente HTML/JS/CSS/imagem locais são carregados. A página é pública por conter apenas exemplos, sem expor informações administrativas.

Como testar: conectar remetente fictício, selecionar pedido, preparar, repetir UID e confirmar custo. A simulação desconta 30 diamantes fictícios uma vez. Dar saída só é liberado após recibo fictício. Antes do envio é possível cancelar/recusar com estorno de 80 CFF COINS de teste. Resultado incerto bloqueia baixa/estorno e permite simular a consulta sem reenvio. Também há falha confirmada, resposta perdida, novo pedido fictício e reinício.

O modelo no navegador não é confiável para validar entregas reais e não deve ser conectado a contas/pedidos reais. O laboratório do servidor, com SQL, autorização administrativa e testes de recibos, permanece isolado na [PR #2](https://github.com/nakataff/ffwsbr/pull/2). Não mesclar essa PR para publicar esta página: ela altera o fluxo de baixa real e ainda não possui integração autorizada.

## Fluxo de login relatado pelo usuário

O usuário descreveu cadastro no Mania com ID/senha do portal, login do remetente pela Garena com provedor Google e colagem da URL de redirecionamento no Mania. O endereço final contém `code` e `app_id`; o frontend envia os dados ao PHP proprietário, que demora alguns segundos e então habilita presentes. Esse caminho reforça a separação entre login e backend de envio, mas não revela a troca do código, a API final de presentes, a autenticação do serviço ou uma autorização de uso pelo CFF.

Não navegamos nos URLs autenticados fornecidos, não usamos seus códigos de autorização e não os copiamos para arquivos/commits/logs. Os códigos de login fornecidos não devem ser inseridos nesta simulação. Não inferimos vínculo entre ID digitado e conta Google sem verificação do servidor. A informação pública da página do Mania, consultada sem sessão, mostra acesso reservado a jogador autorizado.

Continuam faltando acesso/documentação autorizados para autenticação própria, região BR/catálogo elegível, saldo/cotação, envio idempotente e consulta comprovada de entrega/débito. Esta publicação somente facilita revisar o fluxo fictício no navegador. Os pedidos, carteiras e baixa manual já publicados no painel seguem funcionando como antes.

## Verificações

- 9 testes do modelo: exemplos existentes, UID/checkbox/preço, baixa sem confirmação, duplicação, cancelamento/estorno, falha/insuficiência, resultado incerto, expiração/reinício, recibo divergente e ausência de rede/credenciais/armazenamento persistente.
- 3 testes DOM do JavaScript real da página: envio/baixa, resultado incerto/consulta/reinício e cancelamento/filtros/novo pedido.
- Nenhuma conexão Garena, credential exchange ou entrega real foi realizada.

Para mantenedores, a workflow `test-game-gifts-browser.yml` executa esses 12 testes sem segredos ou deploy de backend. O usuário só precisa abrir o endereço da página.
