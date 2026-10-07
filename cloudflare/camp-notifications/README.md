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
