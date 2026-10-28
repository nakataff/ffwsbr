# Torneios e transmissões

Em **Admin → Transmissões → Torneios e fases**, cadastre o torneio uma vez, escolha o canal padrão e adicione fases. O calendário permite marcar dias em meses diferentes; cada dia pode receber mais de uma rodada. Todos os horários são de Brasília (UTC−03:00).

## Edição

- Fases pré-definidas ou nome livre, com horário e duração padrão para novos dias.
- Rodadas com nome/confronto, data, horário, duração e situação. Data e hora não dependem do fuso do computador.
- Links do YouTube por vídeo ou canal; canais são convertidos em `/live` sem consultar a API do YouTube.
- Canal e alternativas herdados do torneio ou sobrescritos por rodada. As alternativas usam `Nome | link`, uma por linha (até oito).
- Uma transmissão pode ser destacada na home. Um vídeo direto pode habilitar o player já existente.
- Logo leve por endereço e link opcional para a página do torneio.
- Duplicar fase, rodada e torneio cria IDs novos e remove estados manuais de transmissão. A cópia de um torneio não é publicada automaticamente.
- Prévia antes da publicação mostra horários, links, duração e avisos de sobreposição ou datas passadas.

## Privacidade e publicação

- `adminLiveTournaments/<id>` armazena o cadastro completo e seus rascunhos, com leitura e escrita exclusivas do administrador.
- `adminLiveTournamentIndex` contém apenas metadados para listar 25 cadastros por vez, por índice de atualização. Abrir um cadastro lê somente ele.
- A agenda pública continua no caminho existente `adminLives`, com um registro derivado por rodada (limite de 180 rodadas e 16 fases por torneio).
- Salvar rascunho não altera a versão que está na home. Publicar atualiza os registros derivados, o cadastro e o índice numa única atualização atômica.
- Remover uma rodada e publicar apaga sua projeção anterior. Retirar da home mantém o cadastro privado. Excluir remove o cadastro e suas projeções.
- As regras exigem incremento de revisão em cada gravação. Uma versão antiga aberta em outra aba não pode sobrescrever ou publicar por cima da versão mais nova.
- Encerrar agora altera só a projeção daquela rodada e sua situação privada. As demais alterações de rascunho não são publicadas por essa ação.
- Uma rodada estruturada substitui uma listagem avulsa com mesmo nome e horário na home, preservando rodadas paralelas com identificadores diferentes.
- As lives avulsas e os vídeos oficiais continuam nos editores atuais; o editor avulso não pode remover inadvertidamente as rodadas de um torneio.
- Nas lives avulsas, `embedVideoId` só é enviado quando “Permitir assistir pelo site” está ativo e há um vídeo válido. Uma string vazia conta como campo existente no Firebase e é rejeitada pelas regras; desativar o player deve remover esse campo. O formulário mantém os dados preenchidos se uma gravação falhar.

## Custos e atualização

Não há novo Worker, Durable Object, cron ou chamada à API do YouTube para a programação. O módulo aproveita o Firebase já usado nas transmissões.

A home mantém a programação pública em cache local por cinco minutos, inclusive quando vazia; o relógio roda localmente a cada 30 segundos. Revalida a agenda a cada cinco minutos somente quando a aba está visível, ou ao voltar para ela se o cache venceu. Uma falha preserva a última programação e aguarda um minuto para tentar novamente. Publicar em outra aba do mesmo navegador invalida o cache imediatamente. Rascunhos, histórico privado e cadastro completo nunca são baixados pelo visitante.

O horário previsto não confirma que um canal está transmitindo. Rodadas automáticas mostram **HORÁRIO PREVISTO** dentro da janela; **AO VIVO** exige confirmação manual para os torneios novos. O término previsto retira a rodada do destaque (inclusive a confirmada manualmente; ajuste a duração se a transmissão se estender) e a próxima passa a valer pelo relógio, sem precisar aguardar outra consulta.

Retire torneios antigos da home quando terminar sua divulgação para manter o catálogo público pequeno. O cadastro privado permanece disponível para duplicação.

## Testes

- `node --test test/live-tournaments.test.cjs`
- `NODE_PATH=<jsdom> node --test test/live-tournaments-ui.test.cjs test/admin-dashboard.test.cjs`
- Emulador Firebase: `node functions/test/live-tournaments-emulator.cjs` (somente ambiente local, exige `FIREBASE_DATABASE_EMULATOR_HOST`).
