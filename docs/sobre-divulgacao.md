# Sobre e divulgação do Nakata

O conteúdo público está em `index.html#sobre` e o card de divulgação fica na
home, logo depois do bloco Global Finals. O estilo dos dois é compartilhado
em `css/creator-about.css`. São HTML e CSS estáticos, sem embed do Instagram,
consulta de seguidores, Worker ou leitura do Firebase.

## Informações e contato

- O usuário confirmou em 28/10/2026 o destaque para criação de conteúdo,
  Central Free Fire e NAKA Gaming. Não incluir a NFA na apresentação.
- Perfil oficial: `https://www.instagram.com/nakataff/`.
- Perfil da Central: `https://www.instagram.com/centralfreefire_/`.
- O WhatsApp comercial dos dois botões vem do link **DIVULGAÇÃO AQUI** publicado
  pelo próprio Nakata em `https://linktr.ee/nakataff` (conferido em 28/10/2026).
  Atualize os dois `href` em `index.html` caso o contato mude. Os botões somente
  abrem o WhatsApp com uma mensagem preenchida; não enviam a mensagem.
- Não publicar seguidores, alcance, preços, formatos ou resultados garantidos
  sem informação fornecida pelo responsável.

## Carregamento

`data-about-source="site"` marca o Sobre estático. `loadSobre()` em
`js/home-news-lives.min.js` respeita essa marca para não buscar a antiga aba da
planilha nem sobrescrever o texto e os contatos. A navegação em
`js/site-shell-fast.min.js` também dispensa o catálogo competitivo para abrir
essa página. Preserve os IDs usados pelos links existentes.

Atualize as versões dos arquivos no `index.html` quando modificar estilos ou
scripts. Confira home, `index.html#sobre`, links comerciais e navegação de
volta à home no desktop e em larguras estreitas.
