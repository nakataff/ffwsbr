# Mundiais da Liquipedia — importação estática

Sete edições revisadas: 2019, Singapura 2021, Sentosa 2022, Bangkok 2022,
2023, Global Finals 2024 e Global Finals 2025. O segundo lote foi autorizado
em 18/10/2026; Bangkok veio em TXT separado, as outras edições no ZIP original.

## Arquitetura

- `sources/*.wiki` preserva os arquivos recebidos. Eles não são executados.
- `manifest.json` mapeia templates, formatos em português, aliases por torneio,
  identidades profissionais revisadas e anomalias específicas da fonte.
- `scripts/import-liquipedia-worlds.py` processa templates aninhados offline,
  rejeita dados truncados, equipes desconhecidas, quedas incompletas e erros
  de soma. Nenhum compilador consulta rede, Firebase, Worker ou banco.
- `novos-torneios/*.json` contém só os dados relevantes, com a mesma estrutura
  para o renderizador compartilhado. Não há uma implementação por torneio.
- O catálogo público só contém metadados e hashes. Abrir um torneio baixa
  somente seu arquivo, com cache e deduplicação de pedidos simultâneos.
- O Radar tem um resumo estático separado sem elencos, mapas ou estatísticas
  por queda. Não baixa todos os torneios e não lê o banco para calcular arquivo.
- Resultados para carreiras e equipes são compilados por equipe. Só os vínculos
  de pessoa explicitamente revisados entram no serviço de carreiras. Não se
  inferem contratos, datas de contratação, saída, retorno ou time atual.

## Formatos e verificações

O importador lê Infobox, TeamCard, Bracket, Matchlist, Match, Map, MS,
TeamPrizePool, AwardPrizePool, HeadstartPointsTable e resumos de classificação.
Transmissões, narradores, código HTML e referências editoriais ficam fora do JSON.

- 2019: conserva 20 pontos por abate e a tabela antiga. O Radar converte usando
  cada colocação e abate original, sem dividir incorretamente o total por 20.
- 2021/2022: play-ins e final independentes; participantes que não viajaram não
  recebem quedas nem participações esportivas.
- 2023/2024: 36 quedas no Knockout, 24 por equipe. Resumos independentes são
  conferidos com as quedas. Point Rush tem dois dias; os bônus calculados
  reconciliam com os pontos iniciais da final. Não somamos todos os pontos de
  Point Rush à final e não contamos vitória de fase como título mundial.
- 2025: a elegibilidade do Champion Rush é verificada antes de cada queda;
  o título exige Booyah após alcançar 80 pontos. Clash Squad tem uma aba
  independente, 13 séries, suíça MD3 e playoffs MD5; campeão, premiação e MVP
  não se misturam ao Battle Royale ou aos históricos de títulos BR.
- A ordem final é conferida com a premiação. A fonte define o desempate em
  finais; nas fases calculadas usam-se Booyahs, abates e última colocação.
- `report.json` registra hashes, ausências, nomes sem vínculo e divergências.

## Atualizar e conferir

```sh
python3 scripts/import-liquipedia-worlds.py
python3 scripts/build-tournament-catalog.py
python3 scripts/build-career-staff-history.py
python3 scripts/build-career-competitions.py
python3 scripts/build-career-results.py
python3 scripts/build-team-views.py
python3 scripts/import-liquipedia-worlds.py --check
python3 scripts/build-tournament-catalog.py --check
python3 scripts/build-career-results.py --check
python3 scripts/build-team-views.py --check
```

## Limitações explícitas

As fontes Overview não contêm estatísticas individuais completas. Não se criam
abates/dano/assistências individuais a partir de totais da equipe. Pessoas
estrangeiras ou homônimos não revisados aparecem nos elencos sem links incorretos.
Joker coach brasileiro é separado de Joker jogador chileno; Trap coach também é
uma identidade distinta do jogador Trap.

A premiação coletiva de 2019 e 2021 não fecha com o total anunciado. Em 2023,
2024 e 2025 há prêmios individuais/por equipe do dia separados da tabela de
classificação. Esses valores não são distribuídos artificialmente entre times.
RZX 2024 recebeu colocação/premiação na fonte mas não disputou por problemas
de visto; Esports Orig e Virtus.pro 2022 também não disputaram.

As duas inconsistências de posição foram resolvidas com evidências do administrador:

- Final 2025, queda 4: Heavy em 7º, 6 abates e 10 pontos, conforme imagem do placar.
- Final 2025, queda 7: Heavy fez 3 abates, não 5. Total final de 48 pontos,
  com 24 de eliminação e 24 de colocação; posição final permanece em 11º.
- Knockout 2024, dia 5, queda 1: CLG em 10º com 2 abates; AAA em 11º com 4;
  WAG em 12º com zero. CLG mantém 3 pontos na queda; seu resumo ganha um
  ponto de colocação e perde um de eliminação, mantendo o total.

`scoreCorrections` registra os valores originais e corrigidos, evidências e seus
SHA-256. A imagem e a confirmação textual estão em `evidence/`. O código exige
que o valor original coincida, aplica cada correção uma vez e valida novamente
posições, totais e resumos. Fontes originais permanecem intactas; não há exceção
pendente permitindo posições duplicadas nessas quedas.
