# Segurança do Central Free Fire

## Como reportar vulnerabilidades

Não publique uma descrição de exploração, credenciais ou dados de usuários em issues abertas.
Utilize um **Private Vulnerability Report** na aba **Security** do GitHub, se disponível.
Caso a opção não esteja habilitada, contate privadamente a administração do Central Free Fire.

Inclua apenas o necessário: qual função foi afetada, como reproduzir o problema com dados de teste e o impacto. Nunca compartilhe senhas, tokens ou dados reais de usuários.

## Credenciais e proteção dos dados

- Nunca adicione tokens, chaves privadas, arquivos `.env`, service accounts ou senhas a commits.
- As chaves públicas do Firebase utilizadas no navegador **não** substituem regras de banco de dados.
- Segredos de Firebase, Cloudflare e integrações privadas devem ficar em **GitHub Actions Secrets**, **Cloudflare Secrets** ou no gerenciador de segredos apropriado.
- Use autenticação em duas etapas na conta GitHub e proteção da branch principal contra exclusão/force push.
- Se uma credencial for publicada acidentalmente, **revogue/rotacione primeiro**: apagar o arquivo não remove o histórico do Git.
- Alterações em `database.rules.json` devem passar pelos testes de segurança e privacidade antes da implantação.

## Limitações e fluxo de manutenção

As regras de banco podem proteger dados e exigir login, mas não são um mecanismo completo de rate limiting.
As votações públicas legadas `mercadoUserVotes` e `dayUserVotes` permanecem legíveis, com **escritas bloqueadas**.
Uma eventual volta de votos anônimos deve usar um endpoint com controle de abuso no servidor.
Dados existentes não são apagados por essa proteção.
