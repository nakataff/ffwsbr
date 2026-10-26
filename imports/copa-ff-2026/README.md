# Copa FF 2026 — importação provisória

Os quatro CSVs em `sources/` foram enviados pelo administrador em 26/10/2026,
exportados do dashboard público da Garena. São agregados por jogador e equipe,
nunca dados por queda. Preservar os originais ao atualizar a importação.

- Geral: 100 linhas, 4.139 abates registrados. **Não representa uma lista completa.**
- Grupos: 100 linhas; exportação também pode estar limitada.
- Repescagem: 50 linhas conforme o export enviado.
- Final: 52 linhas conforme o export enviado (há substituições).

ITAL0$$, bad9, LUBILU e mtsexy aparecem em etapas, mas não no Geral. Proxx7 e
Shotzzrx têm totais do Geral superiores à soma das etapas enviadas, pois faltam
suas linhas de grupos. Não acrescentar estimativas ao Geral, nem somar Geral
com etapas. O relatório gerado documenta todas as divergências e hashes.

`python3 scripts/build-copa-2026.py` gera o detalhe para Outros torneios e atualiza
somente a entrada desta Copa em `novos-torneios/index.json → copaEntries`.
`python3 scripts/build-hall-extra-events.py` gera o recorte opcional do Hall.
Ambos aceitam `--check`. Depois, atualizar os caches do shell/Hall.

Yago.exe → Yago (LOS), EricKinng → Ericking (RUSH) e BYTE33 → BYTE333 (Team Solid)
são correções explícitas desta edição. xGuto7 e Pollux23 permanecem separados de
xGUTO/Pollux7; não fazer correspondência aproximada de nomes.

Não há novas consultas a Firebase ou Durable Objects. O detalhe da Copa é
carregado apenas quando aberto, e o Hall baixa seu pequeno resumo opcional só
ao abrir o filtro de competições. As tabelas geral e por edição do Hall continuam
restritas à liga brasileira.
