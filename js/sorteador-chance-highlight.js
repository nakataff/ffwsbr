(() => {
  'use strict';
  if (!/\/sorteador(?:\/index\.html)?\/?$/i.test(location.pathname)) return;
  if (window.__CFF_SORTER_CHANCE_HIGHLIGHT_V1__) return;
  window.__CFF_SORTER_CHANCE_HIGHLIGHT_V1__ = true;

  const $ = (s) => document.querySelector(s);
  let selectedName = '';
  let busy = false;

  function ptPct(value) {
    return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  }

  function parseChip(chip) {
    const raw = String(chip.dataset.cffRaw || chip.textContent || '').trim();
    if (!chip.dataset.cffRaw) chip.dataset.cffRaw = raw;
    const weightMatch = raw.match(/\s*•\s*([0-9]+(?:[.,][0-9]+)?)×\s*$/i);
    const weight = weightMatch ? Number(weightMatch[1].replace(',', '.')) : 1;
    const label = weightMatch ? raw.slice(0, weightMatch.index).trim() : raw;
    return { raw, label, weight: Number.isFinite(weight) && weight > 0 ? weight : 1 };
  }

  function ensureStyles() {
    if ($('#cff-sorter-chance-css')) return;
    const style = document.createElement('style');
    style.id = 'cff-sorter-chance-css';
    style.textContent = `
      #chips .chip{cursor:pointer;transition:.16s ease,border-color .16s ease,box-shadow .16s ease}
      #chips .chip:hover:not(.used){border-color:#22d3ee;box-shadow:0 0 0 1px rgba(34,211,238,.2),0 0 18px rgba(34,211,238,.12)}
      #chips .chip.cff-located{border-color:#fff!important;background:rgba(34,211,238,.14)!important;box-shadow:0 0 0 2px rgba(34,211,238,.34),0 0 24px rgba(34,211,238,.38)!important}
      #chips .chip.used{cursor:default}
      .cff-chip-prob{color:#7eeaff;font-weight:1000}
      #cff-wheel-highlight{position:absolute;inset:10px;width:calc(100% - 20px);height:calc(100% - 20px);z-index:3;pointer-events:none;border-radius:50%;transform-origin:50% 50%;opacity:0;transition:opacity .18s ease}
      #cff-wheel-highlight.show{opacity:1;animation:cffWheelGlow 1.15s ease-in-out infinite alternate}
      @keyframes cffWheelGlow{from{filter:drop-shadow(0 0 7px rgba(34,211,238,.45))}to{filter:drop-shadow(0 0 20px rgba(34,211,238,.95))}}
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    const shell = $('.wheel-shell');
    const wheel = $('#wheel');
    if (!shell || !wheel) return null;
    let overlay = $('#cff-wheel-highlight');
    if (!overlay) {
      overlay = document.createElement('canvas');
      overlay.id = 'cff-wheel-highlight';
      overlay.width = 1000;
      overlay.height = 1000;
      shell.appendChild(overlay);
    }
    overlay.style.transform = wheel.style.transform || 'rotate(0deg)';
    return overlay;
  }

  function chipsData() {
    const chips = [...document.querySelectorAll('#chips .chip')];
    const parsed = chips.map(chip => ({ chip, ...parseChip(chip), eligible: !chip.classList.contains('used') }));
    const total = parsed.filter(x => x.eligible).reduce((sum, x) => sum + x.weight, 0);
    return { parsed, total };
  }

  function updateChips() {
    if (busy) return;
    busy = true;
    try {
      const { parsed, total } = chipsData();
      for (const item of parsed) {
        const chance = item.eligible && total > 0 ? (item.weight / total) * 100 : 0;
        item.chip.dataset.cffWeight = String(item.weight);
        item.chip.dataset.cffChance = String(chance);
        item.chip.dataset.cffLabel = item.label;
        item.chip.title = item.eligible
          ? `Prioridade ${String(item.weight).replace('.', ',')}× • Chance atual ${ptPct(chance)} • Clique para localizar na roleta`
          : 'Sem chance nesta rodada';
        const isSelected = selectedName && item.label === selectedName && item.eligible;
        item.chip.classList.toggle('cff-located', Boolean(isSelected));
        item.chip.innerHTML = `${item.label} <span class="cff-chip-prob">• ${ptPct(chance)}</span>`;
      }

      document.querySelectorAll('#people .person').forEach(row => {
        const name = row.querySelector('.pname')?.textContent?.trim() || '';
        if (!name) return;
        const item = parsed.find(x => x.label === name || x.label.endsWith(' ' + name) || name.endsWith(' ' + x.label));
        const sub = row.querySelector('.psub');
        if (!item || !sub) return;
        const chance = Number(item.chip.dataset.cffChance || 0);
        const state = sub.textContent.split('•')[0].trim();
        sub.textContent = `${state} • ${String(item.weight).replace('.', ',')}× • ${ptPct(chance)}`;
      });
    } finally {
      busy = false;
    }
  }

  function clearHighlight() {
    selectedName = '';
    document.querySelectorAll('#chips .chip.cff-located').forEach(x => x.classList.remove('cff-located'));
    const overlay = $('#cff-wheel-highlight');
    if (overlay) overlay.classList.remove('show');
  }

  function highlightChip(chip) {
    if (!chip || chip.classList.contains('used')) return;
    const active = [...document.querySelectorAll('#chips .chip:not(.used)')];
    const index = active.indexOf(chip);
    if (index < 0 || !active.length) return;

    const wheel = $('#wheel');
    const overlay = ensureOverlay();
    if (!wheel || !overlay) return;

    const item = parseChip(chip);
    selectedName = item.label;
    document.querySelectorAll('#chips .chip').forEach(x => x.classList.toggle('cff-located', x === chip));

    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, 1000, 1000);
    const n = active.length;
    const slice = Math.PI * 2 / n;
    const start = index * slice;
    const end = (index + 1) * slice;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(500, 500);
    ctx.arc(500, 500, 480, start, end);
    ctx.closePath();
    ctx.fillStyle = 'rgba(34,211,238,.20)';
    ctx.shadowColor = 'rgba(34,211,238,.95)';
    ctx.shadowBlur = 38;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(255,255,255,.95)';
    ctx.stroke();
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(34,211,238,1)';
    ctx.stroke();
    ctx.restore();

    overlay.style.transition = 'none';
    overlay.style.transform = wheel.style.transform || 'rotate(0deg)';
    overlay.classList.remove('show');
    void overlay.offsetWidth;
    overlay.classList.add('show');
  }

  function bind() {
    ensureStyles();
    ensureOverlay();
    updateChips();

    $('#chips')?.addEventListener('click', (event) => {
      const chip = event.target.closest('.chip');
      if (chip) highlightChip(chip);
    });

    const chips = $('#chips');
    if (chips) {
      new MutationObserver(() => {
        requestAnimationFrame(() => {
          updateChips();
          if (selectedName) {
            const match = [...document.querySelectorAll('#chips .chip:not(.used)')].find(x => parseChip(x).label === selectedName);
            if (match) highlightChip(match); else clearHighlight();
          }
        });
      }).observe(chips, { childList:true, subtree:true });
    }

    const wheel = $('#wheel');
    if (wheel) {
      new MutationObserver(() => {
        const overlay = $('#cff-wheel-highlight');
        if (overlay) overlay.style.transform = wheel.style.transform || 'rotate(0deg)';
      }).observe(wheel, { attributes:true, attributeFilter:['style'] });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once:true });
  else bind();
})();
