# Fotos dos desafios diários

O erro “Não foi possível carregar a foto. Tente novamente; o tempo ainda não
começou” era emitido quando `functions/economy-quiz.js` não conseguia obter a
imagem por HTTPS do próprio site. Uma foto existir no repositório não garante
que essa requisição entre serviços termine sem falha, redirecionamento ou timeout.

## Fotos prontas para jogar

O `predeploy` do Worker continua gerando o banco privado de questões. Agora ele
chama também `scripts/build-daily-challenge-photos.cjs`, que prepara as fotos
em WebP com dimensão máxima de 320 pixels, preservando transparência e proporção.

- As imagens são incluídas em `photos` no mesmo módulo privado do banco.
- O arquivo versionado `functions/daily-challenges-seed.js` continua vazio.
- Os 56 retratos atuais ocupam aproximadamente 670 KB de imagens; o objeto com
  base64 tem aproximadamente 896 KB, antes da compressão do bundle do Worker.
- O encoder nativo é uma dependência de desenvolvimento; não vai ao navegador
  nem ao bundle de execução do Worker.
- `loadImage` procura primeiro a foto embutida, sem rede, banco ou storage.
- Caminhos locais com `/` inicial são normalizados, inclusive nos desafios
  sorteados antes da correção.
- Questões manuais com outras fotos ainda usam o fallback HTTP limitado e seu
  cache em memória. Se falhar, o cronômetro não começa e a tentativa é preservada.
- O jogador recebe somente a imagem base64. Nome do arquivo, gabarito e próximas
  questões permanecem privados até o momento permitido pela rodada.

O relógio de 20 segundos continua sendo controlado pelo servidor e só começa
após obter a imagem. Não substitua uma foto quebrada por silhueta nem dê moedas
sem conferir a resposta: isso prejudicaria a dinâmica e a recompensa.

## Manutenção

Para trocar uma foto, atualize a imagem e o mapa `player-data/photo-map.json`,
quando necessário. O fluxo de deploy do Worker regenera os retratos. Se corrigir
apenas o arquivo de imagem sem alterar o mapa, execute novamente a workflow
**Deploy Free Camp Notifications** para reempacotar a foto.

Teste de build sem substituir o placeholder versionado:

```sh
node scripts/build-daily-challenges.cjs /tmp/quiz-privado.js
node --test functions/test/economy-quiz.test.cjs test/daily-challenges-generator.test.cjs
```

Nunca comite o arquivo gerado com perguntas/gabaritos. A rota `/health` do Worker
informa `quizLocalPhotos: true` quando o pacote de fotos foi incluído no deploy.

## Pular um desafio com falha

Na conta, “Problema neste desafio?” oferece **Pular sem moedas**. O bloco abre
quando uma operação falha ou o navegador não consegue decodificar a foto.

- `quizSkip` recebe dia, ID da rodada e índice. Só conclui o desafio atual e
  preserva o sorteio, os próximos desafios e as moedas anteriores.
- Pode concluir um desafio que ainda não iniciou, inclusive quando a primeira
  foto falhou. Nesse caso, a interface consulta `quizStatus` uma única vez para
  recuperar a rodada já salva. Não há polling, novo sorteio ou varredura de usuários.
- O salto é definitivo: zero moedas nesse desafio e sem bônus de três acertos.
  O resumo o identifica como pulado, sem divulgar alternativas ou gabarito.
- Repetir a requisição não pula o próximo desafio. Se uma resposta já foi
  registrada, o salto mantém a resposta e sua recompensa, inclusive em corridas.
- Uma foto que termine de carregar após o salto não reabre a questão.
- O próximo desafio continua fechado até a pessoa clicar para iniciá-lo.

Testes: `functions/test/economy-quiz.test.cjs` e `test/daily-quiz.test.cjs`.
O health do Worker publica `quizSkip: true` a partir da versão 38.
