# Mundiais da Liquipedia — lote piloto 1

Este lote publica **somente três** campeonatos do ZIP enviado em 17/10/2026:
FFWS 2019, FFWS 2021 Singapura e FFWS 2022 Sentosa. 2023, 2024 e 2025 ficam
explicitamente pendentes no manifest; não são importados por aproximação.

## Como funciona

1. Os TXT originais selecionados estão em `sources/*.wiki`.
2. `manifest.json` contém IDs, formato em português, aliases de equipes revisados
   dentro de cada torneio e vínculos explícitos com pessoas já cadastradas.
3. `scripts/import-liquipedia-worlds.py` lê templates aninhados de forma estrutural,
   sem executar wiki, HTML ou JavaScript. Processa Infobox, TeamCard, Match/Map/MS,
   TeamPrizePool e AwardPrizePool. Transmissões, narradores, referências e conteúdo
   que não alimenta os dados do site ficam fora do JSON público.
4. O importador confere posições únicas por queda, quantidade de equipes, todas as
   quedas, somas de pontos e ordem final contra a premiação. Desempates explícitos
   da fonte são preservados. Alias desconhecido, template truncado ou queda sem
   estatística interrompem a compilação.
5. `report.json` registra o hash das fontes, dados disponíveis, ausências e pessoas
   que ainda não tiveram sua identidade ligada ao cadastro. Pessoas não vinculadas
   aparecem normalmente no elenco; não são associadas a um homônimo por apelido.

A pontuação histórica de 2019 (20 por abate e tabela de 300 pontos) é mantida na
classificação. O Radar recebe uma conversão pré-calculada pelas posições e abates
originais; não divide o total por 20 e não altera o resultado oficial.

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
```

O catálogo público contém apenas metadados de cards e o hash de cada JSON. Abrir um
campeonato baixa somente o arquivo dele. Pedidos simultâneos são unificados, erros
podem ser repetidos e respostas antigas não substituem a seleção atual. O Radar é
um download estático separado com os campos necessários, incluindo os resultados
encerrados de 2026; não busca todo o arquivo ao vivo nem o cadastro de jogadores.
Nenhum desses compiladores consulta Cloudflare/Firebase. A atualização do índice
servidor de comissão usa o marcador de migração existente, uma vez por versão.
Consultas seguintes continuam indexadas por pessoa.

## Ausências e divergências que permanecem visíveis

- Singapura: 18 equipes jogaram; quatro classificadas não viajaram. Elas ficam
  separadas das participantes e não recebem quedas nem participações esportivas.
- 2019: total anunciado de US$400 mil, linhas coletivas de US$380 mil e um prêmio
  individual de US$22 mil na fonte. A diferença não foi completada nem corrigida.
- Singapura 2021: total anunciado de US$2 milhões; linhas coletivas somam
  US$1,97 milhão. O prêmio conjunto de Team TG/Riot não foi dividido sem evidência.
- As páginas Overview não contêm a estatística completa de cada jogador. A seção
  parcial de 2019 “Most Kills” não tem escopo suficiente para virar ranking geral.
  Não são inferidos abates individuais a partir do resultado da equipe.
- Algumas equipes não têm comissão informada. Isso aparece como ausência, nunca
  como um coach criado a partir de narradores/analistas de transmissão.
- As identidades de brasileiros vinculadas no manifest foram conferidas com os
  apelidos e passagens da mesma organização no cadastro existente. Links ambíguos
  (como JAPA/Japa04) e profissionais estrangeiros aguardam revisão específica.
- O ZIP não contém Bangkok 2022. Esse campeonato não é criado com os dados de
  Sentosa, que é outra edição.

Os próximos três arquivos usam estruturas mais recentes e só entrarão no próximo
lote, depois que o piloto for avaliado. Novos tipos de template precisam ser
adicionados ao importador com exemplos e validações; não há parser genérico no
navegador que tente adivinhar estruturas desconhecidas.
