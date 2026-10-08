(() => {
  'use strict';
  if (window.__cffNotesInfo) return;
  window.__cffNotesInfo = true;
  const pages = ['notas-cff', 'ffws-br-s2-notas', 'ffws-br-2025-s2-notas'];
  const style = document.createElement('style');
  style.textContent = `
    .cff-note-info-heading{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .cff-note-info-button{display:inline-grid;place-items:center;width:30px;height:30px;padding:0;border:1px solid #6ebad3;border-radius:50%;background:transparent;color:#8cdef7;font:700 19px/1 system-ui;cursor:pointer;flex:none}
    .cff-note-info-button:hover{background:#203a49}.cff-note-info-button:focus-visible{outline:3px solid #ffd263;outline-offset:3px}
    .cff-note-info-dialog{box-sizing:border-box;width:min(680px,calc(100% - 28px));max-height:calc(100dvh - 32px);margin:auto;padding:0;border:1px solid #3b536b;border-radius:20px;background:#101b2a;color:#edf4fa;box-shadow:0 20px 80px #0008;font:15px/1.6 system-ui;overflow:auto}
    .cff-note-info-dialog::backdrop{background:#050a13bb}
    .cff-note-info-dialog header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:22px 24px 14px;position:sticky;top:0;background:#101b2a;z-index:1}
    .cff-note-info-dialog h2{margin:0;font-size:24px;line-height:1.25;color:#fff}
    .cff-note-info-close{width:38px;height:38px;border:1px solid #3b536b;border-radius:12px;background:#1b2c40;color:#fff;font-size:26px;cursor:pointer;flex:none}
    .cff-note-info-body{padding:0 24px 24px}.cff-note-info-body>p{margin:0 0 16px;color:#c4d2df}
    .cff-note-info-card{background:#19283b;border:1px solid #30475e;border-radius:14px;padding:17px;margin:12px 0}
    .cff-note-info-card h3{font-size:18px;color:#8cdef7;margin:0 0 8px}.cff-note-info-card p{margin:8px 0}.cff-note-info-card ul{padding-left:20px;margin:8px 0}
    .cff-note-info-body details{margin-top:16px;color:#c4d2df}.cff-note-info-body summary{color:#8cdef7;cursor:pointer;font-weight:600}.cff-note-info-body details p{margin:10px 0}
    .cff-note-info-example{padding:12px;border-left:3px solid #ffd263;background:#253247;border-radius:0 8px 8px 0}
    @media(max-width:480px){.cff-note-info-dialog header{padding:18px 18px 12px}.cff-note-info-body{padding:0 18px 18px}.cff-note-info-dialog h2{font-size:21px}.cff-note-info-card{padding:14px}}
  `;
  document.head.append(style);
  const dialog = document.createElement('dialog');
  dialog.className = 'cff-note-info-dialog';
  dialog.setAttribute('aria-labelledby', 'cff-note-info-title');
  dialog.innerHTML = `
    <header><h2 id="cff-note-info-title">Como funcionam as Notas CFF?</h2><button class="cff-note-info-close" type="button" aria-label="Fechar explicação">×</button></header>
    <div class="cff-note-info-body">
      <p>Uma avaliação de até <strong>10 pontos</strong>. Nota por queda e Nota do Dia são calculadas de formas diferentes.</p>
      <section class="cff-note-info-card"><h3>Por queda</h3>
        <p>Avalia o jogador em uma única partida.</p>
        <ul><li><strong>Abates e dano</strong> têm mais influência.</li><li><strong>Assistências</strong> e <strong>MVP</strong> acrescentam bônus.</li><li>A <strong>colocação do time</strong> pode dar um pequeno bônus quando a nota está abaixo de 7,5.</li></ul>
        <p>Com pelo menos 1 abate ou 200 de dano, a base é <strong>6</strong>. Atuações abaixo disso usam uma base menor.</p>
        <p><strong>Média por queda:</strong> soma das notas ÷ quedas jogadas.</p>
      </section>
      <section class="cff-note-info-card"><h3>Por dia</h3>
        <p>Soma <strong>abates, dano e MVPs do dia</strong> e compara com os desempenhos diários da etapa. Ajusta o volume para o equivalente a 6 quedas.</p>
        <p>Abates têm o maior peso. A fórmula usa uma curva: melhorar uma atuação já muito alta rende proporcionalmente menos nota. Por isso, <strong>regularidade pode valer mais que um total maior de abates</strong>.</p>
        <p><strong>Assistências e colocação não entram na Nota do Dia.</strong> Ela não é a média das notas das quedas.</p>
        <p class="cff-note-info-average"></p>
      </section>
      <p class="cff-note-info-example"><strong>Exemplo da média diária:</strong> notas 8,0 e 6,0 em dois dias dão média 7,0. Cada dia válido tem o mesmo peso.</p>
      <details><summary>Ver os principais números</summary>
        <p><strong>Queda:</strong> base 6 + 0,9 × raiz dos abates + bônus de dano. Assistências: +0,08 cada (até +0,35). MVP: +0,25. Se a nota estiver abaixo de 7,5: Booyah +0,20; top 2–3 +0,10; top 4–6 +0,06.</p>
        <p><strong>Dia:</strong> o impacto considera abates em relação à média (×0,70), dano em relação à média (×0,25), abates em relação ao máximo de referência (×0,20) e MVPs. A nota inicial é 6,35 + 1,75 × log₂(impacto), com ajustes para atuações muito baixas ou altas.</p>
        <p><strong>Pisos diários:</strong> 18 abates ou 18.000 de dano garantem ao menos 8,0; 24 abates ou 23.000 de dano, ao menos 9,0; 30 abates dão 10. MVPs acrescentam bônus limitado.</p>
        <p>As notas são limitadas a 10 e arredondadas para uma casa decimal. Filtros e participação mínima podem mudar quais dias e quedas entram na média.</p>
      </details>
    </div>`;
  document.body.append(dialog);
  let trigger = null;
  function open(button, page) {
    trigger = button;
    dialog.querySelector('.cff-note-info-average').textContent = page === 'notas-cff'
      ? 'Na WB 2026 S1, selecionar um dia sem filtrar quedas mostra a Nota do Dia. Com todos os dias ou quedas selecionadas, o ranking usa a média por queda.'
      : 'Média por dia: soma das Notas do Dia ÷ dias válidos. Cada dia tem o mesmo peso.';
    dialog.querySelector('.cff-note-info-example').hidden = page === 'notas-cff';
    if (!dialog.open) dialog.showModal();
  }
  dialog.querySelector('.cff-note-info-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => { if (trigger?.isConnected) trigger.focus({preventScroll:true}); });
  for (const id of pages) {
    const root = document.getElementById(id);
    if (!root) continue;
    function attach() {
      const heading = root.querySelector(id === 'notas-cff' ? '.cff-page-hero h2' : '.ffws-s2-hero h1');
      if (!heading || heading.querySelector('.cff-note-info-button')) return;
      heading.classList.add('cff-note-info-heading');
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'cff-note-info-button'; button.textContent = 'ⓘ';
      button.setAttribute('aria-label', 'Como a Nota CFF é calculada');
      button.setAttribute('aria-haspopup', 'dialog'); button.title = 'Como funciona a nota';
      button.addEventListener('click', () => open(button, id)); heading.append(button);
    }
    attach();
    new MutationObserver(attach).observe(root, {childList:true,subtree:true});
  }
})();
