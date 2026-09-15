(() => {
  'use strict';
  if (!/\/sorteador(?:\/index\.html)?\/?$/i.test(location.pathname)) return;
  if (window.__CFF_SORTER_CHANCE_HIGHLIGHT_V2__) return;
  window.__CFF_SORTER_CHANCE_HIGHLIGHT_V2__ = true;

  const $ = (s) => document.querySelector(s);
  const STORAGE_KEY = 'cff_sorter_show_chance_percent_v1';
  let busy = false;
  let highlightTimer = 0;
  let highlightedChip = null;

  function ptPct(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + '%';
  }

  function showPercent() {
    const control = $('#cff-show-chance-percent');
    if (control) return control.checked;
    try { return localStorage.getItem(STORAGE_KEY) !== '0'; } catch (_) { return true; }
  }

  function parseChip(chip) {
    const raw = String(chip.dataset.cffRaw || chip.textContent || '').trim();
    if (!chip.dataset.cffRaw) chip.dataset.cffRaw = raw;
    const weightMatch = raw.match(/\s*•\s*([0-9]+(?:[.,][0-9]+)?)×\s*$/i);
    const weight = weightMatch ? Number(weightMatch[1].replace(',', '.')) : 1;
    const label = weightMatch ? raw.slice(0, weightMatch.index).trim() : raw;
    return {
      raw,
      label,
      weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
    };
  }

  function ensureStyles() {
    if ($('#cff-sorter-chance-css')) return;
    const style = document.createElement('style');
    style.id = 'cff-sorter-chance-css';
    style.textContent = `
      #chips .chip{cursor:pointer;transition:border-color .16s ease,box-shadow .16s ease,background .16s ease,transform .16s ease}
      #chips .chip:hover:not(.used){border-color:#22d3ee;box-shadow:0 0 0 1px rgba(34,211,238,.20),0 0 18px rgba(34,211,238,.12)}
      #chips .chip.cff-locate-flash{border-color:#fff!important;background:rgba(34,211,238,.16)!important;box-shadow:0 0 0 2px rgba(34,211,238,.38),0 0 26px rgba(34,211,238,.46)!important;transform:translateY(-1px)}
      #chips .chip.used{cursor:default}
      .cff-chip-prob{color:#7eeaff;font-weight:1000}
      #cff-wheel-highlight{position:absolute;inset:10px;width:calc(100% - 20px);height:calc(100% - 20px);z-index:3;pointer-events:none;border-radius:50%;transform-origin:50% 50%;opacity:0;transition:opacity .16s ease}
      #cff-wheel-highlight.show{opacity:1;animation:cffWheelGlow .7s ease-in-out 2 alternate}
      @keyframes cffWheelGlow{from{filter:drop-shadow(0 0 7px rgba(34,211,238,.45))}to{filter:drop-shadow(0 0 22px rgba(34,211,238,1))}}
      .cff-chance-toggle{display:flex;align-items:center;gap:8px;color:#d8deea;font-size:12px;font-weight:650;cursor:pointer}
      .cff-chance-toggle input{width:16px;height:16px;accent-color:var(--accent,#7c5cff)}
    `;
    document.head.appendChild(style);
  }

  function ensureToggle() {
    if ($('#cff-show-chance-percent')) return;
    const checks = $('.checks');
    if (!checks) return;
    let checked = true;
    try { checked = localStorage.getItem(STORAGE_KEY) !== '0'; } catch (_) {}
    const label = document.createElement('label');
    label.className = 'check cff-chance-toggle';
    label.innerHTML = `<input id="cff-show-chance-percent" type="checkbox" ${checked ? 'checked' : ''}> Mostrar porcentagem de chance`;
    checks.appendChild(label);
    label.querySelector('input')?.addEventListener('change', (event) => {
      try { localStorage.setItem(STORAGE_KEY, event.target.checked ? '1' : '0'); } catch (_) {}
      updateChips();
    });
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
    const parsed = chips.map((chip) => ({
      chip,
      ...parseChip(chip),
      eligible: !chip.classList.contains('used'),
    }));
    const total = parsed.filter((x) => x.eligible).reduce((sum, x) => sum + x.weight, 0);
    return { parsed, total };
  }

  function updateChips() {
    if (busy) return;
    busy = true;
    try {
      const visible = showPercent();
      const { parsed, total } = chipsData();
      for (const item of parsed) {
        const chance = item.eligible && total > 0 ? (item.weight / total) * 100 : 0;
        item.chip.dataset.cffWeight = String(item.weight);
        item.chip.dataset.cffChance = String(chance);
        item.chip.dataset.cffLabel = item.label;
        item.chip.title = item.eligible
          ? `Prioridade ${String(item.weight).replace('.', ',')}× • Chance atual ${ptPct(chance)} • Clique para localizar na roleta`
          : 'Sem chance nesta rodada';

        const desired = visible
          ? `${item.raw} <span class="cff-chip-prob">• ${ptPct(chance)}</span>`
          : item.raw;
        if (item.chip.innerHTML !== desired) item.chip.innerHTML = desired;
      }

      document.querySelectorAll('#people .person').forEach((row) => {
        const name = row.querySelector('.pname')?.textContent?.trim() || '';
        if (!name) return;
        const item = parsed.find((x) => x.label === name || x.label.endsWith(' ' + name) || name.endsWith(' ' + x.label));
        const sub = row.querySelector('.psub');
        if (!item || !sub) return;
        const chance = Number(item.chip.dataset.cffChance || 0);
        const state = sub.textContent.split('•')[0].trim();
        const desired = visible
          ? `${state} • ${String(item.weight).replace('.', ',')}× • ${ptPct(chance)}`
          : `${state} • ${String(item.weight).replace('.', ',')}×`;
        if (sub.textContent !== desired) sub.textContent = desired;
      });
    } finally {
      busy = false;
    }
  }

  function clearHighlight() {
    clearTimeout(highlightTimer);
    highlightTimer = 0;
    if (highlightedChip) highlightedChip.classList.remove('cff-locate-flash');
    highlightedChip = null;
    const overlay = $('#cff-wheel-highlight');
    if (overlay) {
      overlay.classList.remove('show');
      const ctx = overlay.getContext('2d');
      ctx.clearRect(0, 0, overlay.width, overlay.height);
    }
  }

  function highlightChip(chip) {
    if (!chip || chip.classList.contains('used')) return;
    if (highlightedChip === chip && highlightTimer) {
      clearHighlight();
      return;
    }

    clearHighlight();
    const active = [...document.querySelectorAll('#chips .chip:not(.used)')];
    const index = active.indexOf(chip);
    if (index < 0 || !active.length) return;

    const wheel = $('#wheel');
    const overlay = ensureOverlay();
    if (!wheel || !overlay) return;

    highlightedChip = chip;
    chip.classList.add('cff-locate-flash');

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
    ctx.fillStyle = 'rgba(34,211,238,.18)';
    ctx.shadowColor = 'rgba(34,211,238,.95)';
    ctx.shadowBlur = 36;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 13;
    ctx.strokeStyle = 'rgba(255,255,255,.96)';
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(34,211,238,1)';
    ctx.stroke();
    ctx.restore();

    overlay.style.transition = 'none';
    overlay.style.transform = wheel.style.transform || 'rotate(0deg)';
    overlay.classList.remove('show');
    void overlay.offsetWidth;
    overlay.classList.add('show');

    highlightTimer = setTimeout(clearHighlight, 1700);
  }

  function bind() {
    ensureStyles();
    ensureToggle();
    ensureOverlay();
    updateChips();

    $('#chips')?.addEventListener('click', (event) => {
      const chip = event.target.closest('.chip');
      if (chip) highlightChip(chip);
    });

    const chips = $('#chips');
    if (chips) {
      let scheduled = false;
      new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          updateChips();
        });
      }).observe(chips, { childList: true, subtree: true, characterData: true });
    }

    const people = $('#people');
    if (people) {
      let scheduled = false;
      new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          updateChips();
        });
      }).observe(people, { childList: true, subtree: true, characterData: true });
    }

    const wheel = $('#wheel');
    if (wheel) {
      new MutationObserver(() => {
        const overlay = $('#cff-wheel-highlight');
        if (overlay) overlay.style.transform = wheel.style.transform || 'rotate(0deg)';
      }).observe(wheel, { attributes: true, attributeFilter: ['style'] });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
