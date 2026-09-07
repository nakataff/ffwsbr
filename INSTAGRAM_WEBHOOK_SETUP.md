# Ranking da comunidade — Webhook do Instagram

O backend está em `functions/index.js` e grava automaticamente no Realtime Database em `instagramCommunity`.

## O que ele contabiliza

- Comentário: **+2 pontos**, no máximo uma vez por usuário em cada publicação/Reel.
- Menção da Central em Story: **+10 pontos**, uma vez por Story, com limite padrão de **3 Stories por dia por usuário**.
- Reenvios do mesmo webhook pela Meta são deduplicados e não pontuam novamente.
- O ranking mensal e o ranking geral são atualizados automaticamente.

## Segurança

Nunca coloque App Secret ou Access Token no GitHub, HTML ou JavaScript público. Eles são armazenados no Secret Manager do Firebase.

Segredos usados pela Function:

- `META_WEBHOOK_VERIFY_TOKEN`: uma frase secreta criada por você para a validação do webhook.
- `META_APP_SECRET`: App Secret do aplicativo criado na Meta.
- `INSTAGRAM_ACCESS_TOKEN`: token da conta profissional do Instagram.

## 1. Preparar Firebase

Cloud Functions exige um projeto Firebase com faturamento habilitado para deploy do runtime Node.

No terminal, na pasta do repositório:

```bash
npm install -g firebase-tools
firebase login
firebase use central-free-fire
```

Depois de criar o app na Meta e possuir os valores secretos:

```bash
firebase functions:secrets:set META_WEBHOOK_VERIFY_TOKEN
firebase functions:secrets:set META_APP_SECRET
firebase functions:secrets:set INSTAGRAM_ACCESS_TOKEN
```

Por fim:

```bash
firebase deploy --only database
firebase deploy --only functions
```

A URL esperada da Function é:

```text
https://southamerica-east1-central-free-fire.cloudfunctions.net/instagramWebhook
```

Abra essa URL no navegador. Deve aparecer um JSON com `ok: true`.

## 2. Criar o app na Meta

Crie um app em Meta for Developers e use a integração **Instagram API with Instagram Login** para uma conta profissional (Business ou Creator).

Permissões necessárias para este projeto:

- `instagram_business_basic`
- `instagram_business_manage_comments`
- `instagram_business_manage_messages`

Como o app será usado apenas pela própria conta da Central, Standard Access normalmente é suficiente enquanto a conta estiver adicionada ao app e for gerenciada por você.

## 3. Configurar o Webhook na Meta

Callback URL:

```text
https://southamerica-east1-central-free-fire.cloudfunctions.net/instagramWebhook
```

Verify Token: use exatamente o mesmo valor salvo em `META_WEBHOOK_VERIFY_TOKEN`.

Assine os eventos disponíveis relacionados a:

- `comments`
- `messages`
- `messaging_referrals` (quando essa opção aparecer; usada para Story mentions em alguns fluxos da API)

O código aceita tanto o formato de Story Mention enviado como referral quanto o formato `story_mention` em attachment.

## 4. Testar

1. Em outra conta, comente em um post/Reel da Central.
2. Aguarde alguns segundos e abra `https://centralfreefire.com.br/interacoes.html`.
3. O usuário deve ganhar 2 pontos.
4. Depois, publique um Story em outra conta mencionando o @ da Central.
5. O usuário deve ganhar mais 10 pontos.

## Banco de dados

Dados públicos usados pelo site:

```text
instagramCommunity/public/months/YYYY-MM
instagramCommunity/public/allTime
```

Dados internos anti-fraude/deduplicação:

```text
instagramCommunity/private/dedupe
instagramCommunity/private/storyDaily
instagramCommunity/private/activeDays
instagramCommunity/private/aliases
instagramCommunity/private/events
```

O Firebase Admin SDK usado pela Function grava no banco sem abrir permissões públicas de escrita.
