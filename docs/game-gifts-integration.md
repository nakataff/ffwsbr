# Envio de presentes Free Fire — laboratório

**Rascunho, somente testes. Não mesclar nem publicar em produção.**

O `admin-pontos.html`, em Pedidos do jogo, prepara envio a partir de um pedido existente. UID, anúncio, CFF COINS pagos e comprador vêm do servidor. O laboratório usa o módulo real do painel e o núcleo real de pedidos com SQLite em memória. Remetente e diamantes são fictícios. Não há chamadas à Garena, Firebase real ou Free Fire Mania.

## Investigação

Referência consultada: `fffaa.html`, HTML do Free Fire Mania fornecido pelo usuário. O frontend chama `/paginas/presentes-publico-enviando.php` para salvar token (`save_token`) e enviar item (`send_gift`). A seleção inclui item, UID, região, quantidade e preço. O PHP responsável pela autenticação, chamada final à Garena e validação não está no arquivo. Não executamos o HTML e não copiamos tokens, cookies, scripts, catálogo ou imagens para o repositório.

O histórico recuperado da conversa registra testes anteriores relatados de Comida Pet, item `1307000001`, com entrega aos UIDs testados e desconto imediato de 30 diamantes. A resposta relatada tinha `success:true`, `commodity_id:2192`, `variant:"packed-source5"`, `history_saved:false`. Isso documenta o funcionamento observado naquele teste do Mania, sem comprovar autorização para o Central Free Fire ou seu endpoint final. Nenhum desses testes reais foi repetido aqui.

O HTML também admite entrega sem salvar o histórico (`history_saved:false`). Portanto, timeout/falha local não provam que nada foi enviado: não repetimos automaticamente uma transação financeira.

A documentação oficial brasileira [Como enviar Presentes no jogo?](https://ffsuporte.garena.com/support/solutions/articles/154000130772-como-enviar-presentes-no-jogo-) descreve Loja → Presentes → ID → confirmação e correio do jogo. [Regalos dentro de Free Fire](https://ffsoporte.garena.com/hc/es-419/articles/13851752923929-Regalos-dentro-de-Free-Fire) limita a itens elegíveis e informa que o envio ao ID correto é irreversível.

A pesquisa em fontes oficiais não localizou uma API pública de presentes com autorização verificável para este site. Isso não prova que uma integração privada autorizada inexista. As APIs de Craftland encontradas são para mapas, sem documentar este fluxo. O OAuth observado anteriormente e um client ID usado por outro serviço não concedem autorização ao CFF. Não reutilizamos client IDs/callbacks, tokens ou endpoints de terceiros e não implementamos protocolos privados do jogo.

## Revisar localmente

Requer Node 24 ou posterior. Na branch desta PR:

```sh
cd lab/game-gifts
npm install --no-audit --no-fund
npm start
```

Abra `http://127.0.0.1:4173/admin-pontos.html#eco-panel-orders`.

1. O servidor cria dois pedidos pendentes fictícios e uma carteira de comprador fictícia.
2. Clique em **Conectar remetente fictício**. Não existe formulário de senha/token.
3. Escolha um pedido e **Preparar envio de teste**. Confira UID, SKU e diamantes fictícios, separados do preço pago em CFF COINS.
4. Repita o UID exato e confirme a simulação. O UID permanece string, inclusive acima do limite de precisão numérica do JavaScript.
5. **Entrega confirmada · Dar saída** aparece somente após confirmação consultada no simulador do servidor.
6. O seletor testa não entrega, perda de resposta ou resultado incerto. Resultado incerto exige **Verificar entrega**; liberar a consulta não envia de novo.
7. Na seção do comprador, confira saldo/pedidos e teste cancelamento. Reiniciar apaga todos os dados em memória.

O servidor aceita apenas host de loopback e POST da mesma origem. CSP permite somente recursos locais. Rotas de configuração Firebase e código backend não são servidas. Entradas contendo senha/token/credenciais são recusadas. O administrador é uma identidade fixa **somente neste servidor local**; não é autenticação para publicar na internet. Não expor este laboratório publicamente.

## Estados e proteção

| Estado do envio | Dar saída | Cancelar/estornar | Próxima ação |
| --- | --- | --- | --- |
| Sem tentativa / preparado | Bloqueado | Permitido enquanto pendente | Confirmar simulação ou cancelar |
| Enviando | Bloqueado | Bloqueado durante envio | Consultar resultado |
| Resultado incerto | Bloqueado | Bloqueado até esclarecer | Consultar o mesmo request ID |
| Não enviado, confirmado pelo simulador | Bloqueado | Permitido, preço original | Cancelar, recusar ou preparar nova tentativa |
| Entrega confirmada no servidor | Permitido | Bloqueado | Dar saída |
| Pedido concluído | Idempotente | Bloqueado | Consultar histórico |

O envio adquire o bloqueio de cancelamento em transação SQL. Cliques concorrentes usam a mesma tentativa sem segunda chamada de envio. A consulta vincula recibo, request ID, pedido, UID, SKU, remetente e diamantes. `success:true` enviado pelo navegador não basta. Se persistir o recibo falhar, o bloqueio permanece e uma consulta recupera a confirmação. Não há estorno automático por timeout. Não entrega confirmada permite o estorno existente sem aumentar o total ganho em CFF COINS.

O catálogo do simulador vincula revisão do anúncio ao SKU fictício. Alterar anúncio não troca item de pedido comprado. Pedidos antigos sem revisão ficam bloqueados até existir migração/vínculo explicitamente revisado; não inferimos SKU pelo título. O laboratório demonstra pedidos já criados no banco de teste e não importa pedidos/contas reais.

O núcleo padrão usa `production` e recusa os novos envios. Mesmo recibo de simulação persistido não libera baixa em produção. A mudança proposta também recusa a antiga baixa manual sem recibo: **não mesclar esta PR antes de resolver a integração real ou decidir outro fluxo de confirmação verificável**. A versão publicada do site permanece intacta.

## Dependências da integração real

Faltam autorização/documentação da Garena ou de provedor oficialmente autorizado para uso pelo CFF; região BR e catálogo elegível; autenticação própria aprovada e revogável do remetente; consulta de saldo/cotação; idempotência e consulta inequívoca de entrega e débito, com identificador verificável. Sem essas garantias, não ativar envio financeiro nem interpretar mensagem genérica como prova.

O adaptador atual aceita exclusivamente `environment:'test'` e `mode:'simulation'`. Nenhum botão desbloqueia envio real. Uma integração futura deverá guardar credenciais só no servidor, validar autorização explícita, verificar recibos por canal autenticado, manter tentativas duráveis e reconciliar após reinício sem dupla cobrança. Não usar endpoints arbitrários, tokens colados no navegador, backend do Mania como proxy ou client ID de outro serviço.

## Testes

- 17 novos testes do núcleo: bloqueio real, autorização administrativa, confirmação exata, duplicação, UID longo, expiração, vínculo/revisão, cancelamento concorrente, saldo insuficiente, não entrega, timeout, resultado incerto, recibos divergentes, falha de persistência, isolamento de recibo simulado e descarte de campos secretos.
- 2 testes do módulo real do painel em DOM: remetente fictício → confirmação → baixa; resposta incerta → consulta → confirmação.
- 1 teste HTTP: recursos locais, CSP, origem externa/credenciais bloqueadas, isolamento de rotas e dois pedidos existentes. O JavaScript servido também foi compilado para verificar sintaxe.
- 71 testes existentes de economia/pedidos/interações/formulário/roleta/perfil, com testes de baixa adaptados à exigência de recibo.
- 17 testes do gateway Cloudflare e serviços relacionados com identidades e endpoints simulados; baixa sem recibo recusada pela API.

**108 testes locais passando.** Sem teste visual em navegador completo, conexão Garena, débito real ou entrega a jogador. A workflow desta PR executa só testes, sem segredos ou deploy.

```sh
cd lab/game-gifts
npm test
```

As demais regressões e testes do gateway estão em `.github/workflows/test-game-gifts-lab.yml`.
