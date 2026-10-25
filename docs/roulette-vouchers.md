# Vale Codiguinho na roleta

A roleta mantém as probabilidades configuradas. O antigo campo interno `code`
agora sorteia um resultado `voucher`, de 1 Vale Codiguinho. A ausência de estoque
não altera a probabilidade: o vale pode ser usado quando houver reposição.

O vale, a notificação e o resultado diário são gravados na mesma transação SQLite.
O identificador único de usuário/dia impede envios duplicados em tentativas
simultâneas ou após perda da resposta. Ganhar um vale não reserva um código e não
escreve presentes no Firebase. Não há polling nem consulta ao cadastro completo.

O usuário consulta o vale em Loja → Meus vales e escolhe um codiguinho na Loja.
O resgate usa o fluxo privado já existente, sem moedas nem intervalo mensal;
a escolha só reserva um código disponível, dentro da validade do próprio código.

Em admin-pontos → Roleta é possível definir a validade dos próximos prêmios:
1 a 365 dias, padrão de 30 dias, até 23h59 de Brasília no vencimento. Alterações
não modificam os vales já emitidos. A imagem é a mesma configurada em Vales.
O histórico de vales identifica a origem "Ganho na roleta diária".

Uma migração única move códigos livres do antigo destino `roulette` para `shop`.
Recibos e presentes antigos, inclusive entregas pendentes, continuam funcionando.
Destinos antigos enviados por clientes desatualizados continuam disponíveis na
loja, sem necessidade de nova migração ou varredura a cada acesso.
