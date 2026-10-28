# Champion Rush e modo completo

O **modo completo** edita uma final. Seu formato fica no bloco **Formato e
Champion Rush**, com Champion Rush ou Clássica, o limite vem do campo Champion
Point e a opção de quedas sem limite fica logo abaixo. O bloco **Dias e horários
da final** reúne datas e horários. A interface mostra “Final” e oculta o
planejamento de classificatórias enquanto esse modo está ativo.

O seletor de modos fica no topo. `workspace.js` reaproveita os próprios botões
e campos existentes, sem criar cópias dos inputs: **Apenas a final** mostra
formato, Champion Point e a opção sem limite, com os horários no bloco seguinte;
**Classificatória + final** mostra as fases e atalhos para equipes, rodadas e
descansos. **Configurar a final** abre a fase final planejada (ou adiciona uma
nova fase planejada), sem encerrar a classificatória nem trocar a fase ativa.
Os botões de importar a FFWS e recuperar backup ficam em ferramentas de importação.

O **modo torneio** mantém fases, classificação, elenco e dias registrados.
Suas regras continuam vindo das configurações aplicadas à fase. Trocar a
interface não exclui o plano nem os dias salvos.

## Correção de 28/10/2026

O antigo estado `tournamentModeV1.enabled` permanecia verdadeiro depois de sair
do modo torneio. Ele podia forçar novamente essa interface ao importar um
backup, escolher o gerador diário sem `matchpoint`, registrar automaticamente
o fim do dia ou acrescentar pontuações anteriores no cálculo da final.

- `config.cffInterfaceMode` preserva a interface escolhida no backup.
- A restauração respeita esse campo; backups antigos também respeitam a
  preferência explícita pelo modo completo.
- Gerador diário, registro automático e pontos anteriores do modo torneio só
  atuam quando essa interface está ativa.
- No modo completo, `final-wiki.js` considera somente a final aberta e seus
  dias configurados no editor, sem incorporar o histórico da classificatória.
- `tournament-setup.js` não reaplica regras de uma fase antiga por cima do
  formato, do número de quedas ou do limite ilimitado da final completa.
- Os dados antigos continuam no backup. Não há migração que apague resultados
  nem acesso a dados de usuários/Cloudflare.

Arquivos: `admin-camp-ao-vivo/app.js.gz`, `app-loader.js`, `tournament-setup.js`
`workspace.js`, `workspace.css` e `final-wiki.js`. O código do pacote pode ser inspecionado com gzip; confira
a sintaxe do JavaScript descompactado antes de recomprimir com `mtime=0`.

A [coroa](../assets/champion-rush/README.md) tem alpha verdadeiro e arquivo local.
Sua exibição continua respeitando o Champion Point; o Booyah só dá o título
quando a equipe já estava elegível antes da queda.

Validação: `NODE_PATH=<jsdom> node --test test/camp-*.test.cjs`. O teste novo
reproduz estado antigo de classificatória, alternância de interface, restauração,
exportação `matchpoint`, pontuações isoladas e conservação dos resultados.
O evento `cff:camp-final-controls-ready` reposiciona o seletor da final depois
da criação tardia do controle no pacote antigo, sem polling ou novos observers.

## Booyah com pontuação ainda pendente

O título é reconhecido assim que o Booyah é marcado para uma equipe que já
alcançou o limite **antes dessa queda**. Não é preciso preencher os abates ou
os pontos de nenhuma equipe na queda decisiva. Os campos vazios continuam
pendentes: não recebem zero nem pontuações presumidas. O backup conserva esse
estado e o Wiki mantém a colocação conhecida e os abates em branco.

O reconhecimento anterior exigia `getDropHasScore` e o modelo de exportação
exigia abates válidos, atrasando o campeão até o lançamento da pontuação.
Ambos agora dependem do Booyah e dos pontos acumulados nas quedas anteriores.
A troca para formato clássico também recalcula e remove a indicação de campeão.
O teste de regressão reproduz o clique real com todos os pontos da última queda
vazios, troca de Booyah, troca de formato, limite atingido na mesma queda e
restauração do backup. Nenhuma consulta adicional ao servidor foi acrescentada.
