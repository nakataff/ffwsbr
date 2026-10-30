# Ajuda do ranking de interações

`js/interaction-guide.js` contém o mesmo tutorial e FAQ para Sobre (`index.html#sobre`)
e `interacoes.html#como-participar`. `css/interaction-guide.css` isola os estilos.
Na home, `js/home-community-ranking.js` tem o link **Como participar?**, que abre
um diálogo curto de três passos e aponta para o tutorial completo. O link funciona
como navegação normal quando o diálogo não está disponível. Teclado, Escape,
botão fechar e retorno do foco usam o diálogo nativo.

Não há fetch, login automático, acesso ao banco, consulta de saldo, polling ou
telemetria no tutorial. O ranking da home mantém a política de atualização que
já tinha. Os textos são estáticos e não mostram o estado privado da conta.

Revisar o texto quando mudarem as regras em:

- `cloudflare/instagram-community/worker.js → RULES`: pontos do ranking,
  limite de Stories, idade dos posts, bônus de vínculo.
- `functions/economy-interactions.js`: meta mensal de moedas por dias com
  comentário/Story. Check-in e desafios não contam para essa meta específica.
- `js/account-instagram-connect.mjs`: passos e rótulos para confirmar o Instagram.
- `js/public-account.js`, `js/economy-ui.js`: destinos dos atalhos.

Não garantir presente por posição ou por atingir saldo: respeitar regras da ação,
estoque, preços e prazos. Pontos do ranking e saldo em moedas são diferentes.
Teste: `test/interaction-guide.test.cjs`.
