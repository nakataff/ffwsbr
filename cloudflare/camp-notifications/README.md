# Avisos de torneios no Cloudflare gratuito

Servidor separado do ranking do Instagram. Usa Workers + um Durable Object **SQLite** (disponível no Workers Free), Firebase Authentication gratuito e Web Push nativo. Não usa Cloud Functions, D1, credenciais privadas do Firebase, FCM pago, cartão ou pré-pagamento. Mantenha a conta no Workers Free; exceder a franquia interrompe operações, e não ativa um plano pago automaticamente.

## Ativação na conta existente

1. No Cloudflare, crie um API Token com o modelo **Edit Cloudflare Workers**, limitado à sua conta. Copie também o **Account ID** dessa conta. Não cole o token no chat ou no código público.
2. No GitHub `nakataff/ffwsbr` → Settings → Secrets and variables → Actions, adicione os segredos `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
3. Em Actions, execute **Deploy Free Camp Notifications** → Run workflow. O workflow publica apenas `cff-camp-notifications`, cria o armazenamento SQLite e confirma `/health`. Ele não muda o Worker do Instagram nem usa o Google Cloud pago.

Alternativa local: `cd cloudflare/camp-notifications`, `npm install`, `npx wrangler login`, `npm run deploy` com a conta gratuita correta.

O site usa `https://cff-camp-notifications.nakataffb4.workers.dev/api`, baseado no subdomínio existente da sua conta Cloudflare. Se publicar em outra conta/subdomínio, atualize apenas `camp-notifications-config.json` com a URL real terminada em `/api`. Para interromper acesso pelo site, coloque `enabled:false` nesse arquivo; desative também os torneios no admin para parar avisos já enfileirados.

## Teste real, sem avisar todo mundo

1. Na própria conta do site, abra **Avisos**, ative neste aparelho e clique **Testar só na minha conta**. O teste tem intervalo mínimo de um minuto.
2. No `admin-camp-ao-vivo.html`, em **Avisos do torneio**, habilite somente um torneio de teste. Em sua conta, escolha esse torneio/time.
3. Preencha uma queda e use **Confirmar eliminação e avisar**. Salvar/editar pontuação sozinho não envia push. Repetir o envio do mesmo time, dia e queda não cria outro.
4. Etapas FFWS vinculadas viram oficiais somente quando os dados públicos T1 + P1 do `admin-dados` são válidos. Dados manuais/testes não oficializam. Outros torneios continuam como parciais.

No iPhone, adicione o site à Tela de Início e abra pelo ícone. A permissão depende do navegador/sistema. Push não tem garantia de entrega; o histórico privado da conta guarda os avisos mesmo quando o aparelho não recebe.

## Consumo e privacidade

- Nenhuma consulta ao banco D1 de interações. Preferências, dispositivos, VAPID privado e fila ficam apenas no servidor de avisos.
- API verifica a assinatura dos ID tokens do Firebase e restringe configurar/publicar à conta administradora existente `admin@centralfreefire.com.br`.
- Histórico com até 50 avisos por conta; até 5 aparelhos por pessoa. Inscrições expiradas são removidas.
- Processamento em lotes de 3 pessoas por alarme. Eventos parciais e oficiais são deduplicados; correções oficiais atualizam o mesmo card sem novo push.
- T1 + P1 é consultado somente para quedas notificadas, por até 7 dias, primeiro a cada minuto e depois a cada 5 minutos. Sem fila ou quedas pendentes, não há alarmes. A conta consulta o histórico uma vez por minuto somente enquanto a aba Avisos está aberta e visível.
- Em Workers Free, a franquia atual de Workers é 100 mil solicitações/dia; Durable Objects têm sua própria franquia de 100 mil solicitações/dia, incluindo alarmes, mais limites de execução e armazenamento. O tráfego da conta inteira deve caber nessas franquias. Veja https://developers.cloudflare.com/workers/platform/pricing/ e https://developers.cloudflare.com/durable-objects/platform/pricing/.
- Esta implantação não contrata planos pagos nem resolve limites de outros serviços já existentes.

## Verificação

`npm test` testa login assinado, permissões, isolamento por usuário, SSRF, troca de dono do aparelho, deduplicação, envio criptografado, transição T1 + P1 e correções. `npm run check` compila o bundle real para Workers sem publicar. Os testes não enviam notificações reais.

## Quedas oficiais nas tabelas (2026-10-13)

A consulta une os snapshots publicados no Camp ao vivo às quedas oficiais
T1 + P1 do Admin Dados da etapa configurada, inclusive depois do dia 2, queda 1.
As partidas são identificadas por dia + queda, sem duplicar o acumulado. Os
dados oficiais têm cache compartilhado de 60 segundos por etapa. Em falhas
de consulta, a tela preserva os dados disponíveis e informa a falha.
Essa leitura não grava snapshots, não cria mensagens e não agenda pushes
antigos. O envio de alertas continua dependendo dos comandos do administrador.

## Área de avisos e resultados (2026-10-13)

A tela prioriza a classificação geral. Na final, resultados oficiais completos
identificam o campeão pela regra Champion Rush (160 pontos antes da queda
vencida), sem confundir campeão com líder em pontos. O usuário pode rever
qualquer queda e acessar seu histórico privado. Preferências de alertas ficam
recolhidas. Os resultados e o histórico mantêm a autenticação existente.
O convite de conta é exclusivo para visitantes deslogados, tem fechamento
por X, Agora não e Escape, e respeita uma hora de dispensa nesse navegador.

### Chat customization (2026-10-16)

`admin-chat.html` provides Appearance, People, Reports and History tabs. The real
Firebase administrator can configure dark colors/slow mode, find a person using
the existing exact nickname/Instagram/slug index, assign or remove a moderator,
and enable or override a person's name color. Moderator removal restores their
previous role. Cosmetic administrator labels still do not grant moderation access.
The authenticated administrator's chat identity always uses `administrator`, even
if the separate cosmetic role record is missing or says `member`.

The existing API adds `chatStatus`, `chatPreferences`, `chatReport`,
`chatModerationData` and `chatAdmin`. `chatSend` accepts a reply reference and resolves
the original message and up to five @Central usernames server-side. Profiles choose
at most two owned, active badges; ownership is checked on preferences and every send.
Messages and public per-person chat identities contain only public appearance data.
Settings/pins are public; preferences, styles, reports, audit and rate-limit records
are server-only. The Firebase rules update must ship with this release.

The public listener keeps only the last 100 messages. Per-person identities and
custom image metadata subscribe only while relevant to the current conversation;
builtin avatars reuse the static catalog. Closing the chat tears down conversation
listeners and keeps only the existing small latest-message notification listener.
Reports and audit are loaded in batches of 50 only when moderation opens that tab.
Slow mode is validated server-side (5–120 seconds; moderators keep five seconds).
Reports are deduplicated per reporter/message and rate limited. Deleting a message
also removes its pin and redacts recent reply previews; audit preserves moderation
reasons without publishing them in the conversation.

### Emblemas da comunidade (2026-10-16)

Em `admin-perfis.html` → Emblemas, o administrador pode cadastrar a arte,
conceder ou retirar um emblema pelo @, Instagram vinculado ou link do perfil.
O primeiro tipo é `verified` (Verificado), disponível sem arte inicial.
A imagem é opcional e pode ser enviada depois; até lá há um selo provisório.
Cada pessoa exibe um emblema, acima do avatar e da moldura no perfil, e junto
ao avatar no chat. Emblemas não concedem cargos ou permissões.

A ação autenticada `emblemAdmin` permite `catalog`, `findPerson`, `saveCatalog`
e `assign`, restritas ao administrador real. O catálogo pequeno é público
em `communityEmblemCatalog`; `communityEmblemAssignments/<uid>` permite leitura
individual, sem listar todos os usuários. `communityEmblemHistory/<uid>` é
privado, carregado pelo painel em até 20 registros. Todas as gravações são
feitas no servidor. A arte reutiliza imagens imutáveis em `communityProfileImages`.
Perfil e chat observam apenas as pessoas visíveis; fechar o chat encerra essas
assinaturas. A atualização das regras Firebase acompanha esta versão.

### Atualização imediata dos cargos no chat (2026-10-16)

O chat observa `communityAccountRoles/<uid>` apenas para os autores presentes
no histórico limitado. Conceder, trocar ou retirar um cargo pelo painel de perfis
atualiza a identificação nas mensagens antigas, mesmo se a pessoa estiver offline.
Os observadores são encerrados quando o autor sai do histórico ou o chat fecha.
O marcador público `realAdministrator` é escrito somente pelo servidor após
validar a conta administrativa; cargos visuais não podem produzir esse marcador.
A autorização de moderação continua sendo verificada pelo servidor em cada ação.
