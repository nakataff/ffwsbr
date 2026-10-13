# Carteira, roleta e loja da Central

A carteira de pontos é independente do ranking de interações. Os saldos começam em zero; os pontos antigos do ranking não são convertidos nem consumidos por resgates.

## Como participar

Abra `conta.html?tab=points`, entre com Google e complete o cadastro. O check-in vale 1 ponto por dia; a roleta tem um giro gratuito por dia. O dia muda à meia-noite de Brasília. Cadastro completo e Instagram confirmado liberam mais 3 pontos, uma vez. Check-in ou giro em cinco datas da mesma semana (segunda a domingo) liberam 3 pontos adicionais automaticamente.

| Prêmio da roleta | Chance inicial |
| --- | --- |
| 1 ponto | 80% |
| 3 pontos | 10% |
| 10 pontos | 5% |
| 25 pontos | 3% |
| 50 pontos | 1% |
| Um codiguinho | 1% |

Sem um código válido no estoque da roleta, a chance de codiguinho fica em zero e os 1% passam para 1 ponto. A tela mostra as chances efetivas. Códigos com validade vencida não participam do sorteio nem da loja.

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

As fotos do controle de codiguinhos acompanham as novas reservas. Ao desbloquear o controle, as fotos dos códigos já reservados são atualizadas automaticamente; há também o botão **Atualizar fotos dos códigos já reservados**. No painel de pontos, **Editar foto e detalhes** permite adicionar ou trocar a foto de um código que ainda não foi sorteado/resgatado. Códigos sem foto usam a imagem do presente como alternativa.

Uploads são reduzidos a até 384 pixels no navegador. Imagens iguais são guardadas uma única vez no SQLite e servidas por uma URL de conteúdo imutável com cache. Somente as fotos de produtos ficam disponíveis nesse endpoint; códigos, saldos e destinatários continuam privados. O Firebase não recebe uma coleção extra de imagens.

A roleta tem seis setores visuais, chances explícitas, giro contínuo durante o pedido, pelo menos seis voltas e desaceleração até o prêmio confirmado pelo servidor. Uma janela apresenta o prêmio e o saldo atualizado. A preferência de movimento reduzido é respeitada. Sem estoque, os avisos da roleta e da loja aparecem separadamente; os 1% do código passam para 1 ponto (81% com a configuração padrão).

A atualização das chances é aplicada uma vez na implantação, preservando saldos, giros antigos, códigos e preços já cadastrados. Alterações posteriores feitas pelo administrador continuam valendo após reinícios.
