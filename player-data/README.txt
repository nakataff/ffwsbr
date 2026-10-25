ESTRUTURA DOS PERFIS DE JOGADORES
Atualizada em 29/07/2026

1. FFWS BR 2026 S2 — PERFIL COMPLETO
Os 72 jogadores da temporada atual ficam agrupados em 14 arquivos, um por equipe:
player-data/s2/<equipe>.json

As estatísticas que mudam após cada rodada ficam centralizadas em:
ffws-br-2026-s2/player-stats.json

Para atualizar abates, dano, assistências, quedas, recordes, MVPs e posições da temporada atual, altere somente player-stats.json. Não é necessário reconstruir os perfis.

2. PERFIS BÁSICOS DE COMPETIÇÕES
Os jogadores internacionais ou regionais ficam agrupados por fonte:
player-data/basic/ewc-2026.json
player-data/basic/laff-2026-s1.json
player-data/basic/ffws-sea-2026.json

3. PERFIS HISTÓRICOS
Jogadores sem equipe atual ou fora da temporada ficam em:
player-data/historical.json

4. ROTEAMENTO E ALIASES
player-data/routes.json informa onde cada perfil está armazenado.
player-data/aliases.json resolve nome, nickname alternativo e equipe.

5. LIMPEZA
A pasta antiga player-profiles/ não é mais usada e deve ser excluída do repositório.
