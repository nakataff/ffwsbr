# Serviço legado de backup do Camp ao Vivo no GitHub

O editor atual usa **Salvar na nuvem** e **Abrir da nuvem**, com um rascunho privado no Firebase em `adminCampDraft/current`. O serviço abaixo não é necessário para transferir uma tabela entre aparelhos. O botão **Baixar backup** continua disponível para cópias em JSON.

As instruções a seguir documentam apenas a implantação do endpoint legado `campGithubBackup`. O editor atual não o chama automaticamente.

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

Quando chamado por um cliente legado autorizado, o endpoint gera/atualiza
`admin-camp-ao-vivo/data/autosave-live.json` e cria um commit no histórico do repositório.

## Segurança

- O token não é exposto no navegador.
- O endpoint exige login Firebase do e-mail administrativo.
- O token fica apenas no Secret Manager do Firebase.
- O arquivo no GitHub é um backup do estado do camp, não contém o token.
