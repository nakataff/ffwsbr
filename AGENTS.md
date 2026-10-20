# Central Free Fire — atalhos para manutenção

Antes de alterar dados competitivos ou criar uma página de torneio, leia
[docs/MAPA-DADOS.md](docs/MAPA-DADOS.md). O guia distingue fontes completas,
resumos, dados ao vivo e arquivos antigos com nomes parecidos.

- Reutilize o layout e as fontes existentes da mesma competição.
- Prefira JSON estático compacto e carregamento por aba. Não acrescente leituras
  de Firebase/Durable Objects para dados de torneios encerrados.
- Não presuma que `players.json` contém todas as etapas: na WB 2026 S2 o arquivo
  estático contém a classificatória; as páginas completas acrescentam os dados
  de `ffwsLive/2026-s2` com `js/ffws-live-provider.js`.
- Para o Início da S2, use os três `inicio-*.json`; para regenerá-los, use
  `scripts/build-s2-overview.cjs`. Não edite manualmente os Top 10 derivados.
- Ao alterar uma fonte, confira seus resumos e as versões de cache dos consumidores.
  Atualize o mapa se criar, renomear ou mudar a função de arquivos importantes.
