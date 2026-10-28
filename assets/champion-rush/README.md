# Coroa de Champion Rush

`crown-booyah-v1.webp` é a arte de elegibilidade do Champion Rush no
`admin-camp-ao-vivo.html`. Fundo transparente, amarelo/laranja e contorno preto,
com estética baseada na referência Booyah enviada pelo responsável em 28/10/2026.
Não representa o título já conquistado: a lógica existente só a mostra nos
times que atingiram o Champion Point.

A arte foi criada com a ferramenta integrada `image_gen` e exportada em WebP
**sem perdas**. Os pixels RGBA e o canal alpha foram comparados com o PNG
gerado e permanecem idênticos. A imagem é servida pelo próprio site e
compartilhada entre todos os marcadores; não há serviço externo nem nova
consulta ao Firebase/Worker.

## Integração

- O HTML do marcador e seus tamanhos ficam no bloco `.v91-cp-badge` do pacote
  `admin-camp-ao-vivo/app.js.gz`: 40×30 na tabela e 32×24 na grade compacta.
- A exportação da tabela utiliza o mesmo elemento `<img>` e o mesmo arquivo
  local, sem fundo colorido ou borda azul no marcador.
- Ao editar o pacote, descompacte com gzip, confira a sintaxe JavaScript e
  recompacte com `mtime=0`. Atualize sua versão no `app-loader.js` e a versão
  do loader no HTML. `manifest.json` descreve os módulos originais importados,
  não os hashes dos pacotes atuais.
- Regressões de elegibilidade, modos e restauração:
  `test/camp-champion-rush.test.cjs`.

## Prompt final usado

Use case: logo-brand. Asset type: small tournament UI status emblem for Champion Rush active, to replace a blue crown in a Free Fire admin panel and exported standings. Input image: STYLE REFERENCE ONLY, the supplied Booyah wordmark. Create ONE clean standalone CROWN emblem, no lettering at all. Match the reference's graphic language closely: bold flat esports sticker silhouette, dynamic angular cuts and slight forward lean, thick solid black outer contour/backplate hugging the crown, vivid golden yellow across the top transitioning into rich orange at the bottom, subtle flat warm highlight near the edge. Crown silhouette: three main sharp peaks, taller center peak, two smaller outer tips, broad strong base; instantly recognizable as a crown even at 28–40 pixels. No jewels, no tiny details, no circle, no shield, no unrelated objects. Center the crown and use most of the canvas, with a small even transparent safety margin around the thick black contour. Actual fully transparent alpha background OUTSIDE the black silhouette, no white backdrop, no checkerboard pattern printed into the image, no drop shadow outside the silhouette. The black is part of the emblem and must remain opaque. Flat crisp graphic aesthetic, NOT 3D, no chrome, no blue, no neon glow, no watermark. Do not reproduce the word Booyah or any text.
