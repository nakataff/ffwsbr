# Resultados de comissão por edição

O perfil usa as competições já vinculadas a cada passagem no cadastro de carreiras.
Passagens de jogador não contam como atuação na comissão. A seleção manual de
edições continua no admin-carreiras; nenhuma nova importação de profissionais é feita.

Os resultados são arquivos estáticos separados por equipe em `career-data/results`.
Somente ao abrir **Resultados por split**, o navegador carrega o módulo, um índice
pequeno e os arquivos das equipes com competições vinculadas àquele perfil. Downloads
simultâneos são limitados a três; arquivos são compartilhados entre perfis abertos na
mesma página e nomes com hash permitem cache do navegador. Filtros, detalhes de elenco
e evolução não fazem novas consultas. Não há polling, SQL, varredura de cadastros nem
reprocessamento de partidas durante a visita.

## Atualizar resultados

Depois de editar os JSONs de torneios, execute e inclua os arquivos gerados no commit:

```sh
python3 scripts/build-career-results.py
python3 scripts/build-career-results.py --check
```

O workflow `test-team-history.yml` verifica a consistência dos snapshots quando as
fontes mudam. O compilador é determinístico, sem rede e sem acesso à Cloudflare.
Arquivos antigos com hash são removidos da saída; a publicação deve incluir o índice
e os novos arquivos juntos.

Fontes: `novos-torneios/lbff-*.json`, `wb-2025-s*.json`, as fases separadas do WB
2024, `team-results-2026.json`, arquivos da EWC 2026 e equipes/resumo da FFWS BR 2026.
O compilador aproveita as classificações já calculadas; mantém a exceção de Champion
Rush da final 2026 S1. A final anual de 2024 não vira título de ambos os splits.

Datas de contratação não são inferidas a partir de inscrição. Sem datas, o perfil
informa isso. Datas que comprovem entrada após o começo ou saída antes do término
geram indicação de período parcial. Saída antes da final ou entrada depois dela
impedem contar aquele título/final no resumo. Quando há período parcial e a data da
final é desconhecida, o resumo também não atribui título ou final. Resultados exibidos
continuam sendo os da equipe no torneio completo. Números ausentes aparecem como
travessão, nunca como zero; fase inicial em primeiro não conta como campeonato.

Elencos são históricos, específicos de cada edição e podem conter trocas durante o
evento; não substituem vínculos atuais nem geram links baseados apenas em apelidos,
evitando misturar homônimos como Joker, Trap e Stark.

## Perfis e equipes (outubro de 2026)

O perfil abre em **Resumo**, sem baixar resultados. As abas **Competições** e
**Conquistas** carregam os mesmos arquivos por equipe, compartilhando o cache.
**Carreira** mantém passagens recolhidas e as setas de transferência. Conquistas
como jogador não entram no resumo de comissão; nenhum coach recebe abates pessoais.
O cadastro de participações agora inclui as comissões de WB 2024 (edição anual),
2025 S1/S2 e EWC 2026. Cargos desconhecidos continuam como comissão, e seleções
manuais, inclusive vazias, têm prioridade sobre a detecção automática.

A WB 2026 S2 terminou. Os dados de segunda fase e final ainda estavam no JSON
público de `ffwsLive/2026-s2`. O resumo completo e compacto foi materializado em
`ffws-br-2026-s2/career-summary.json`, reaproveitando os mesmos cálculos do site.
Para atualizar a partir de uma exportação local corrigida:

```sh
node scripts/snapshot-career-s2.cjs /caminho/ffwsLive-2026-s2.json
python3 scripts/build-career-staff-history.py
python3 scripts/build-career-competitions.py
python3 scripts/build-career-results.py
python3 scripts/build-team-views.py
```

Os comandos de compilação são locais e não consultam o banco. A importação de
comissão é feita uma vez por versão com marcador persistente; leituras seguintes
consultam apenas as participações indexadas da pessoa solicitada. O resumo de
resultados e as listas históricas são arquivos estáticos.

`build-team-views.py` reúne os títulos das fontes locais, exige primeiro lugar
exato (10th/11th/13th não são títulos), normaliza nomes de edições e dá prioridade
à classificação final, incluindo Champion Rush. Gera um índice compacto e um
arquivo com hash por equipe. As organizações atuais têm uma página canônica em
`/equipe/slug`; URLs históricas dessas mesmas organizações redirecionam antes de
buscar seu histórico. Equipes encerradas mantêm a página histórica. W7M Esports
continua separada de Fluxo W7M. A página principal e a histórica compartilham os
mesmos títulos; a lista não é acrescida de planilhas a cada visita.

## Próximos mundiais

Os ZIPs com os blocos de notas da Liquipedia serão revisados e convertidos uma
vez, antes da publicação. O ponto de extensão é `career-data/events/*.json`:
`id`, `name`, `family`, `year`, datas disponíveis e `teams`, cada equipe com
`name`, `stages`, `players` e `staff`. As fases contêm `label`, `finished`,
`isFinal`, posição e estatísticas disponíveis. `champion` exige uma final
encerrada. Identidades de comissão devem ser conferidas por pessoa/equipe/edição,
sem unir homônimos só pelo apelido. Uma edição futura ou inscrição não confirma
partidas, títulos, datas de contrato ou vínculo atual.

Os resultados dos mundiais de 2024/2025 já presentes em `resultados.json` mantêm
suas colocações. Estatísticas detalhadas ausentes continuam em branco até que as
fontes dos ZIPs sejam conferidas. Arquivos HTML/ZIP brutos nunca são processados
no navegador nem enviados ao banco durante a visita.
