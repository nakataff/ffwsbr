# Cards de estatísticas compartilháveis

Primeira integração: Início da WB 2026 S2 (tabela, MVP e equipes) e os quatro rankings já
existentes na home (classificação, abates, dano e assistências).

## O que o usuário encontra

- Botão **Criar card** ao lado do título do ranking no Início, ou **Card** na home.
- Janela com três seções: Modelo, Personalizar e Legenda, com prévia visível.
- Modelos: tabela, destaque, comparação e **Equipe em números** na aba Equipes.
- Top 3, Top 5, Top 10 ou **Todos os times** nas tabelas coletivas. A classificatória exporta suas 14 equipes; segunda fase e final, 12. MVP continua limitado ao Top 10 já carregado.
- Feed 1218 × 1291, quadrado 1080 × 1080, Stories 1080 × 1920 e horizontal 1200 × 630.
- Tema CFF, competição, cor da equipe selecionada ou cor personalizada.
- Destaque de uma linha, logos, fotos e QR Code opcional. Fotos dos jogadores ficam ativadas por padrão e também aparecem na comparação horizontal.
- Fonte, etapa e data real da atualização, quando fornecida pela página.
- As linhas ocupam a altura útil disponível, inclusive em Top 3 e Top 5, com fotos e números proporcionais. Comparações mantêm espaço entre o valor principal e os dados adicionais.
- Marca e endereço CFF sempre presentes. Feed e Stories reservam área inferior
  para que textos e controles das redes sociais não cubram as informações.
- Download PNG, legenda editável com cópia do link e compartilhamento nativo
  de arquivos quando o aparelho/navegador disponibiliza essa função.
- Preferências visuais em `localStorage`, chave `cff_ranking_card_style_v2`.
  Não salva números do ranking, legenda pessoal nem seleção de jogadores.

## Dados e custo

O editor **não busca rankings nem consulta bancos**. Recebe uma cópia do recorte
já carregado pela página. Carrega os módulos e CSS somente no primeiro clique.
Logos e fotos locais são carregadas apenas para o card selecionado e reutilizadas
em memória. O gerador QR local de 1.4.4 fica em `js/vendor/` e só é carregado
quando a opção é ativada. Não usa serviço remoto de QR nem de geração de imagem.

O recorte fica congelado enquanto a janela está aberta. Trocar etapa na página
e abrir outro card captura os novos dados. Campos ausentes aparecem como “—”;
não transformar informação ausente em zero para inventar uma comparação.

## Como ligar em outra página

No clique do botão, obtenha os dados do estado já carregado ou da tabela visível:

```js
const {openRankingCard} = await import('/js/ranking-share-cards.mjs?v=20261020-cards-v3');
await openRankingCard({
  id: 'wb-s2-mvp-final',
  kind: 'players', // ou teams
  metric: 'kills', // points, kills, damage ou assists
  title: 'Ranking de abates',
  event: 'WB 2026 S2',
  stage: 'Final',
  updatedAt: '2026-10-11',
  url: 'https://centralfreefire.com.br/ffws-br-s2/inicio?aba=mvp&etapa=final',
  rows: resultadosJaCarregados.map((row, index) => ({
    rank: row.position || index + 1,
    name: row.name,
    team: row.team,
    logo: row.logo, // caminho local, sem domínio
    photo: row.photo, // opcional
    kills: row.kills,
    matches: row.matches,
    damage: row.damage,
    assists: row.assists
  }))
});
```

Não acrescente um `fetch` ao ranking no clique apenas para criar o card. Se a
página só tem Top 6, forneça esses seis; o editor não busca os quatro restantes.
Em páginas de equipes use `name` com o nome completo, `kind: 'teams'`,
`metric: 'points'` e os campos `points`, `kills`, `booyahs`, `matches` disponíveis.

## Arquitetura

- `ranking-share-model.mjs`: opções validadas, formato, legenda, link e dados.
- `ranking-share-renderer.mjs`: desenho Canvas; recebe imagens já resolvidas.
- `ranking-share-cards.mjs`: janela, cache de imagens, geração de PNG e ações.
- `css/ranking-share-cards.css`: layout isolado da janela.
- `home-share-cards.js`: adaptador do HTML já renderizado na home.
- `ffws-br-2026-s2/inicio.js`: adaptador que usa `inicio-*.json` já carregados.

No Início da S2, os parâmetros `aba` e `etapa` restauram o filtro. Os arquivos de
entrada das URLs amigáveis preservam a query antes de abrir o shell. O link do
card da home volta à home, pois ela apresenta seus próprios recortes Top 6.

Fotos do Top 10 vêm dos caminhos incluídos pelo `build-s2-overview.cjs`. Não é
necessário carregar o cadastro de jogadores ou o mapa completo de fotos no clique.

## Verificação e manutenção

`test/ranking-share-cards.test.cjs` testa os formatos com Canvas real, dados,
legenda, preferências, QR decodificado, download, cancelamento e compartilhamento
simulado. `test/s2-overview.test.cjs` verifica que os filtros dos links são
restaurados e que a exportação não busca novamente os dados.

```sh
NODE_PATH=/caminho/dependencias node --test test/s2-overview.test.cjs test/ranking-share-cards.test.cjs
```

Dependências isoladas dos testes: jsdom 26.1.0, @napi-rs/canvas 0.1.100 e jsqr 1.4.0.
Elas não são dependências baixadas pelos visitantes. A workflow existente da S2
executa esses testes no GitHub Actions.

Se alterar o editor, atualize os identificadores de versão dos imports entre os
três módulos, dos adaptadores e do CSS. No Início, atualize também a versão em
`site-shell-fast.min.js` e sua referência em `index.html`. Não habilite publicação
automática: a exportação abre o compartilhamento apenas quando a pessoa clica.

## Card da equipe

Na aba Equipes, selecione o time e clique em **Criar card**. O editor recebe
`mode: 'team'`, `views` com até quatro fases já carregadas e `viewId` inicial.
Cada view contém `id`, `stage`, `rows` e a URL com `aba=equipes`, `etapa` e `time`.
Só aparecem as fases efetivamente disputadas pela equipe.

É possível escolher abates, quedas, média de abates por queda, assistências,
dano, pontos e Booyahs. As opções sem dados ficam desabilitadas e ao menos uma
estatística é mantida. A legenda usa os mesmos números e o link da fase atual.

`inicio-elencos.json` contém `statsByStage`, gerado pelo script existente.
Abates, pontos, Booyahs e quedas vêm da tabela coletiva; dano e assistências
somam os registros individuais da equipe. Quedas são da equipe e não a soma
das quedas de quatro jogadores. O Geral soma as etapas, mas omite pontos para
não contar novamente o bônus carregado à segunda fase. A média é calculada
com os totais de abates e quedas, sem tirar a média das médias.

O arquivo de elencos passa de cerca de 16,9 KB para 21,9 KB e continua sendo
baixado apenas na aba Equipes. Trocar fases e métricas no editor não faz novas
consultas; exportação e desenho continuam inteiramente no navegador.
