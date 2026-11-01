# Bloqueios da loja e das premiações

Acesse `admin-pontos.html` → **Bloqueios**, ou `admin-bloqueios.html`.
Pesquise o @ da Central, Instagram vinculado ou link exato do perfil. Confira a
pessoa, escolha os acessos, escreva um motivo interno e confirme antes de salvar.
Apenas a identidade administrativa autenticada pode alterar os bloqueios.

- **Loja:** impede novas compras com moedas ou vales, incluindo cosméticos e pedidos de itens no jogo.
- **Premiações:** suspende novos bônus, roleta, desafios, XP e resgates do passe, conquistas, vales e presentes administrativos.
- Podem ser aplicados juntos ou separadamente. Não expiram automaticamente.
- **Preparar desbloqueio total** preenche o formulário; é necessário conferir e salvar.
- Saldo, itens, histórico, leitura do site e chat são preservados. Compras já pagas podem ser concluídas ou estornadas. A divulgação dos códigos após três minutos permanece funcionando.
- A caixa de entrada avisa apenas os acessos afetados. O motivo detalhado fica no histórico administrativo.

## Consistência e custos

`functions/account-restrictions.js` mantém flags por UID e auditoria no SQLite do
Durable Object existente. Consultas de permissão usam a chave primária; lista
administrativa usa índice de ativos, páginas de 20; histórico traz 10 registros.
Não há varredura de carteiras, ranking, polling ou novo cron. O cabeçalho de saldo
continua fazendo a mesma consulta anterior.

`communityRewardRestrictions/UID` espelha apenas as flags, revisão e data para
as regras Firebase impedirem o resgate direto de códigos de cosméticos.
O espelho é atualizado somente ao moderar. Seu proprietário pode ler as próprias
flags, mas não alterá-las; o motivo não é publicado nesse caminho.

Alterações são serializadas por conta no Worker junto com as entregas de
recompensas. Revisão e nonce impedem sobrescritas silenciosas e duplicação de
avisos. Se aparecer sincronização pendente, tente salvar novamente sem modificar
o formulário, ou recarregue a conta e reaplique as opções. A sincronização usa
primeiro as flags mais restritivas, para evitar uma liberação indevida durante falha.

Testes usam contas fictícias; nenhuma pessoa real foi bloqueada para validar a funcionalidade.
