# Passe mensal da Central

Admin: `/admin-passe.html`, também em Admin → Comunidade e recompensas e no
painel de CFF COINS. Perfil: `/conta.html?tab=pass`, com atalho no início do
próprio perfil e em Mais → Passe mensal.

## Novembro de 2026

A temporada inicial é publicada/agendada por padrão, de **01 a 30/11/2026**,
no horário de Brasília. São 20 níveis de 100 XP. Resgates até **07/12/2026**, às
23h59. Os dias não precisam ser consecutivos. Não é um passe pago.

- Check-in da carteira: 20 XP por dia (Google + cadastro completo).
- Três desafios efetivamente respondidos: 40 XP por dia, mesmo errando.
  Pulos e respostas vencidas/sem seleção não contam para esse bônus.
- Dia com comentário válido ou Story contabilizado: 40 XP. Usa o Instagram
  confirmado e a mesma identidade/consulta já usada pelos bônus da carteira.

Máximo de 100 XP por dia. Vinte dias completos bastam para 2.000 XP. O progresso
para nos 2.000 XP da configuração inicial. XP, pontos do ranking e moedas são
independentes; ganhar XP não debita nem converte os outros saldos.

O padrão inicial dá **150 CFF COINS**: níveis 1–18 com 5 cada, nível 19 com 10 e
nível 20 com 50. Os itens estéticos não são inventados: o administrador escolhe
avatares, capas, molduras e insígnias ativos no catálogo existente. Os emblemas
administrativos (ex.: verificado) não são prêmios do passe.

## Configuração

O admin escolhe mês, nome, descrição, imagem da capa por URL/caminho, período,
prazo extra de até 14 dias, XP por nível, quantidade de níveis (1–50) e cada
prêmio. Há rascunho, publicação/agendamento, pausa, prévia sem salvar e histórico
paginado de entregas. Os níveis ficam recolhidos. Salvar usa revisão otimista;
outra janela não sobrescreve mudanças silenciosamente.

Depois de haver progresso, início, fim, XP por nível e quantidade de níveis são
protegidos. O prazo de resgate pode aumentar, não diminuir. Não é possível
remover da publicação um passe com participantes: use Pausar. Recompensas já
resgatadas não podem mudar. Rascunhos futuros não afetam a temporada atual.

Vale Codiguinho é opcional. Exige limite global por nível, validade e uma
quantidade de moedas alternativa depois de esgotar os vales. A regra é mostrada
antes do resgate. Reserve estoque suficiente para honrar esses vales na loja.
A cota é consumida dentro da mesma transação do resgate; repetir não consome
outra unidade. Os vales usam o sistema/inventário já existente e fonte `pass`.

## Entregas e falhas

`functions/season-pass.js` guarda temporadas, progresso, dias, cotas e resgates
no SQLite do Durable Object já existente. Um resgate por usuário/temporada/nível.
Moedas, vales e notificações têm identificadores estáveis. Imagens e insígnias
vão aos mesmos caminhos do inventário atual. Entregas externas interrompidas
ficam pendentes e podem ser concluídas pelo próprio jogador, inclusive depois
do prazo, sem criar outro resgate. O prazo só bloqueia novas reservas.

## Leituras e custo

Não cria banco, cron, polling nem listener. Os ganchos de check-in, quiz e
interações registram apenas ações confirmadas no servidor. Dias futuros e
clientes escolhendo XP/destinatário não são aceitos. Interações recebidas com
atraso podem reconhecer dias anteriores do passe até o fim do prazo de resgate.

O card do perfil reutiliza `profileCheckinStatus` com `includePass:true`: resumo
compacto por chaves do próprio usuário, sem buscar ranking, saldo completo,
catálogo, outros participantes ou todo o histórico. A trilha completa só é
pedida ao abrir a aba; a conferência das interações usa o cache já existente da
carteira. Trocar filtros é local. Atualizar é explícito. A página mantém um cache
curto em memória; respostas de outra conta são descartadas. O cabeçalho de
moedas conserva seu acesso de uma única chave, sem sincronizar passes.

Índices cobrem usuário/temporada/dia, histórico e consultas administrativas por
temporada/nível. Entregas administrativas vêm em páginas de 20 registros.

Fontes: `functions/season-pass.js`, ganchos em `economy.js`, `economy-quiz.js`,
`economy-interactions.js`, `economy-vouchers.js`; interface em
`js/season-pass.mjs`, `js/admin-season-pass.mjs` e respectivos CSS.
Testes: `functions/test/season-pass.test.cjs` e `test/season-pass-ui.test.cjs`.
