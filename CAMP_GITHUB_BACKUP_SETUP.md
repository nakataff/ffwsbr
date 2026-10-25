# Backup automático do Camp ao Vivo no GitHub

O painel `admin-camp-ao-vivo.html` agora possui três camadas de proteção:

1. Auto-save local a cada mudança.
2. Backup remoto no Firebase após salvar uma queda.
3. Backup no GitHub após salvar uma queda, gravando em:
   `admin-camp-ao-vivo/data/autosave-live.json`

## Ativar o backup no GitHub

O token NÃO deve ficar no HTML ou JavaScript público.

### 1. Criar um Fine-grained Personal Access Token no GitHub

Limite o token ao repositório `nakataff/ffwsbr` e conceda apenas:

- Repository permissions
- Contents: Read and write

### 2. Adicionar o token como secret do repositório

No GitHub:

Settings > Secrets and variables > Actions > New repository secret

Nome:

`GITHUB_CAMP_TOKEN`

Valor:

o token criado no passo anterior.

### 3. Rodar o workflow

Abra:

Actions > Deploy Camp GitHub Backup > Run workflow

O workflow envia o token para o Secret Manager do Firebase e publica apenas a função
`campGithubBackup`.

Depois disso, cada clique válido em **Salvar Queda** gera/atualiza
`admin-camp-ao-vivo/data/autosave-live.json` e cria um commit no histórico do repositório.

## Segurança

- O token não é exposto no navegador.
- O endpoint exige login Firebase do e-mail administrativo.
- O token fica apenas no Secret Manager do Firebase.
- O arquivo no GitHub é um backup do estado do camp, não contém o token.
