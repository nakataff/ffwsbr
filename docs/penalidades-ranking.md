# Penalidades de pontos — ranking da comunidade

Acesso: **Admin → Penalidades do ranking** (/admin-penalidades.html). Também há atalhos em **Revisar Stories** e em **Bônus e missões**.

## Funcionamento

- Pesquise o **@Instagram exato**. O sistema consulta o índice de nomes no Worker cff-instagram-community e mostra pontos disponíveis na semana, no mês e no geral.
- Escolha de **1 a 500 pontos**, limitado ao menor saldo dos três períodos, para não gerar valor negativo no momento da aplicação.
- Escreva o **motivo obrigatório** (8–300 caracteres) e confirme o desconto.
- A punição entra no ledger awards como admin_penalty com **pontos negativos** na data de Brasília. Os agregados users.points_all e monthly_users.points são atualizados na mesma transação; a posição semanal usa a soma do ledger.
- O registro de auditoria fica na tabela privada ranking_point_penalties com identificador único, usuário, quantidade, motivo, data e UID do administrador. Repetir a mesma solicitação com o mesmo UUID não debita novamente.
- A reversão exige outro motivo, cria lançamento compensatório admin_penalty_reversal no **mesmo dia** do desconto e atualiza os mesmos totais. O registro permanece visível como **revertido**, sem exclusão silenciosa.
- O cache compartilhado do ranking é invalidado após a operação. Os acessos à API exigem verificação real da sessão administrativa Firebase e do UID fixado no Worker.

## Limites

- Penalidades alteram **somente os pontos do ranking de interações**, não CFF Coins, loja, codiguinhos, XP do Passe, dias ativos, quantidade de Stories, comentários ou prêmios já entregues.
- O desconto é sempre da **semana atual** e, por estar no ledger, também impacta o mês atual e o total geral. Não há edição retroativa de punições; a reversão mantém a data original para restaurar o período correto.
- A busca é por nome exato, com detecção de ambiguidade. Histórico limitado a 30 registros por consulta, sem leituras contínuas.
- Em casos de falha na rede após confirmação, verifique o histórico antes de reenviar. O nonce persistido enquanto o formulário não muda protege contra duplicação.

## Verificação

O teste cloudflare/instagram-community/test/ranking-penalties.test.mjs cobre busca, validação, saldo, punição, idempotência, rollback transacional e reversão.

A implantação é realizada pelo workflow **Deploy Instagram Community (Cloudflare)** por alteração em cloudflare/instagram-community. É necessário que os secrets e a implantação do Worker estejam operacionais para aplicar punições reais.
