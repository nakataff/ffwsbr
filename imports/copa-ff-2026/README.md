# Copa FF 2026 — dados agregados

Os CSVs foram enviados pelo administrador em 26/10/2026, exportados do dashboard
público da Garena. São agregados por jogador e equipe, não resultados por queda.

- **Geral completo:** `sources/geral-ab.csv` e `geral-cd.csv`, com 55 linhas cada,
  consolidados em `geral.csv`: 110 jogadores, 24 equipes, 4.187 abates registrados.
  Não há duplicações. Os 100 registros do primeiro envio permanecem idênticos.
- **Grupos parcial:** `grupos.csv` mantém as 100 linhas do envio anterior.
- Repescagem: 50 linhas conforme o CSV enviado.
- Final: 52 linhas conforme o CSV enviado (há substituições).

`geral-primeiro-export.csv` preserva a primeira exportação limitada. `geral.csv`
é gerado; as duas partes originais são as fontes do Geral. O importador confere
que todos os jogadores das etapas estão no Geral e que as quedas de cada time
fecham com quatro atletas por partida (18 grupos, 6 repescagem, 16 final).

Dez jogadores foram recuperados, incluindo três com zero abates. As divergências
entre o Geral e a soma das etapas são documentadas no relatório: há dez jogadores
com registros de grupos ausentes no CSV de 100 linhas. Não estimar esses registros
nem somar Geral com etapas. O Hall usa apenas o Geral consolidado e por isso não
exibe mais o aviso de parcial para a Copa. Nos perfis, o aviso fica só em Grupos.

`python3 scripts/build-copa-2026.py` gera o detalhe para Outros torneios e atualiza
a entrada em `novos-torneios/index.json → copaEntries`.
`python3 scripts/build-hall-extra-events.py` gera o recorte opcional do Hall.
`python3 scripts/build-copa-player-profiles.py` gera 104 arquivos por perfil e o
manifesto de participação. Todos aceitam `--check`. Atualizar os caches do shell,
Hall e perfil depois de regenerar. Tudo é estático; não há acesso ao banco.

A Copa já constava em `year2026.events` como `copa-free-fire-2026`. Esse registro
tem `detailId=copa-ff-2026`: o botão da lista abre o mesmo detalhe do arquivo.
Nome, data, premiação total e MVPs vêm desse registro original. Não duplicar o evento.

Yago.exe → Yago (LOS), EricKinng → Ericking (RUSH) e BYTE33 → BYTE333 (Team Solid)
são correções explícitas desta edição. xGuto7 e Pollux23 continuam separados de
xGUTO/Pollux7. Seis nomes ainda não têm perfil existente com identidade segura:
THEUS7, ousadin, PH10, LUBILU, StriKezk e RICKB4. Eles continuam no torneio e no
Hall com seus dados; não fazer correspondência aproximada para vincular perfis.
