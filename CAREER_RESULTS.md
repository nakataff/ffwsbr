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
