(() => {
  'use strict';

  if (!/interacoes\.html$/i.test(location.pathname)) return;
  if (window.__CFF_COMMUNITY_PREDICTION__) return;
  window.__CFF_COMMUNITY_PREDICTION__ = true;

  const API = 'https://cff-instagram-community.nakataffb4.workers.dev';
  const SESSION_KEY = 'cff_daily_checkin_session_v1';
  let current = null;
  let busy = false;

  const $ = (s) => document.querySelector(s);
  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  function session() {
    try { return localStorage.getItem(SESSION_KEY) || ''; } catch (_) { return ''; }
  }

  async function request(path, options = {}) {
    const response = await fetch(API + path, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(options.headers || {}) },
      ...options,
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
    return data;
  }

  function injectCss() {
    if ($('#cff-prediction-css')) return;
    const style = document.createElement('style');
    style.id = 'cff-prediction-css';
    style.textContent = `
      .cff-prediction{margin:0 0 18px;border:1px solid rgba(0,200,255,.22);border-radius:18px;background:linear-gradient(135deg,rgba(0,200,255,.085),rgba(11,17,29,.97) 42%,rgba(8,14,24,.99));overflow:hidden;box-shadow:0 18px 48px rgba(0,0,0,.2)}
      .cff-prediction-inner{display:grid;grid-template-columns:minmax(0,.78fr) minmax(360px,1.22fr);gap:18px;padding:20px}
      .cff-prediction-kicker{color:#00c8ff;font-size:.66rem;font-weight:1000;letter-spacing:1.4px;text-transform:uppercase}
      .cff-prediction-copy h2{margin:6px 0 8px;color:#fff;font-size:clamp(1.25rem,2.7vw,1.9rem);line-height:1.05;font-weight:1000;text-transform:uppercase}
      .cff-prediction-copy p{margin:0;color:#809ab8;font-size:.75rem;line-height:1.5;font-weight:700}
      .cff-prediction-prize{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}
      .cff-prediction-chip{padding:6px 8px;border:1px solid rgba(0,200,255,.2);border-radius:999px;background:rgba(0,200,255,.06);color:#b9efff;font-size:.64rem;font-weight:950;text-transform:uppercase}
      .cff-prediction-box{padding:14px;border:1px solid rgba(255,255,255,.075);border-radius:14px;background:#080e18}
      .cff-prediction-question{display:block;margin-bottom:11px;color:#fff;font-size:.9rem;font-weight:1000;line-height:1.3}
      .cff-prediction-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
      .cff-prediction-option{min-height:43px;border:1px solid rgba(255,255,255,.11);border-radius:10px;background:rgba(255,255,255,.035);color:#dce8f5;padding:9px 10px;font:900 .72rem/1.2 inherit;cursor:pointer;transition:.14s ease;text-align:left}
      .cff-prediction-option:hover:not(:disabled){border-color:#00c8ff;background:rgba(0,200,255,.08);color:#fff}
      .cff-prediction-option.is-selected{border-color:#00c8ff;background:rgba(0,200,255,.13);color:#fff;box-shadow:inset 0 0 0 1px rgba(0,200,255,.08)}
      .cff-prediction-option.is-correct{border-color:#53d99d;background:rgba(83,217,157,.1);color:#c9ffe6}
      .cff-prediction-option.is-wrong{border-color:rgba(255,108,127,.45);background:rgba(255,108,127,.07)}
      .cff-prediction-option:disabled{cursor:default;opacity:.78}
      .cff-prediction-status{margin:10px 0 0;color:#7791af;font-size:.68rem;line-height:1.45;font-weight:750}
      .cff-prediction-status strong{color:#fff}.cff-prediction-status.ok{color:#75dfaa}.cff-prediction-status.warn{color:#ffd477}
      .cff-prediction-countdown{display:inline-block;margin-top:7px;color:#5f7d9e;font-size:.63rem;font-weight:900;text-transform:uppercase}
      @media(max-width:800px){.cff-prediction-inner{grid-template-columns:1fr;padding:15px;gap:12px}.cff-prediction-options{grid-template-columns:1fr 1fr}}
      @media(max-width:430px){.cff-prediction-options{grid-template-columns:1fr}.cff-prediction-option{min-height:46px}}
    `;
    document.head.appendChild(style);
  }

  function injectRule(data) {
    const rules = $('.ig-rules');
    if (!rules || $('#ig-rule-prediction')) return;
    const row = document.createElement('div');
    row.className = 'ig-rule';
    row.id = 'ig-rule-prediction';
    row.innerHTML = `<div class="ig-rule-icon">🎯</div><div><strong>Palpite</strong><small>Participe dos palpites da Central FF e ganhe bônus se acertar.</small></div><div class="ig-rule-points">+${Number(data?.participationPoints || 1)} / +${Number(data?.correctPoints || 3)} pts</div>`;
    const note = rules.querySelector('.ig-note');
    if (note) rules.insertBefore(row, note); else rules.appendChild(row);
  }

  function mount() {
    if ($('#cff-community-prediction')) return $('#cff-community-prediction');
    const toolbar = $('.ig-toolbar');
    if (!toolbar) return null;
    injectCss();
    const section = document.createElement('section');
    section.className = 'cff-prediction';
    section.id = 'cff-community-prediction';
    section.innerHTML = '<div class="cff-prediction-inner"><div class="cff-prediction-copy"><div class="cff-prediction-kicker">🎯 Palpite da comunidade</div><h2>Quem leva essa?</h2><p>Carregando o palpite atual...</p></div><div class="cff-prediction-box"><span class="cff-prediction-question">Carregando...</span></div></div>';
    toolbar.parentNode.insertBefore(section, toolbar);
    return section;
  }

  function formatDeadline(value) {
    const n = Number(value);
    if (!n) return '';
    try {
      return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(n));
    } catch (_) { return ''; }
  }

  function render(data) {
    const root = mount();
    if (!root) return;
    current = data;
    const p = data?.prediction;
    if (!p) { root.hidden = true; return; }
    root.hidden = false;
    injectRule(p);

    const options = Array.isArray(p.options) ? p.options : [];
    const vote = String(data?.vote || '');
    const correct = String(p.correctOption || '');
    const linked = Boolean(data?.linked);
    const closed = p.status !== 'open';
    const settled = p.status === 'settled' && correct;
    const won = settled && vote && vote === correct;

    let status = '';
    let statusClass = '';
    if (!linked) {
      status = 'Vincule seu Instagram no check-in acima para participar. O vínculo é feito uma vez por navegador.';
      statusClass = 'warn';
    } else if (settled) {
      if (!vote) status = `Resultado definido. A resposta correta foi <strong>${esc(options.find(o => o.id === correct)?.label || correct)}</strong>.`;
      else if (won) status = `ACERTOU! 🔥 Seu palpite foi <strong>${esc(options.find(o => o.id === vote)?.label || vote)}</strong>. O bônus de +${Number(p.correctPoints || 3)} pts entra no ranking automaticamente.`;
      else status = `Não foi dessa vez. Seu palpite: <strong>${esc(options.find(o => o.id === vote)?.label || vote)}</strong>. Resposta correta: <strong>${esc(options.find(o => o.id === correct)?.label || correct)}</strong>.`;
      statusClass = won ? 'ok' : '';
    } else if (vote) {
      status = `Palpite confirmado: <strong>${esc(options.find(o => o.id === vote)?.label || vote)}</strong>. +${Number(p.participationPoints || 1)} pt garantido por participar${closed ? '. Agora é esperar o resultado.' : '.'}`;
      statusClass = 'ok';
    } else if (closed) {
      status = 'Palpite encerrado. Aguardando o resultado oficial.';
      statusClass = 'warn';
    } else {
      status = 'Escolha uma opção. Depois de confirmar, não dá para trocar o palpite.';
    }

    root.innerHTML = `
      <div class="cff-prediction-inner">
        <div class="cff-prediction-copy">
          <div class="cff-prediction-kicker">🎯 Palpite da comunidade</div>
          <h2>Valendo ponto no ranking</h2>
          <p>Uma escolha rápida antes da rodada. Participar já soma ponto e quem acertar leva bônus.</p>
          <div class="cff-prediction-prize"><span class="cff-prediction-chip">Participar +${Number(p.participationPoints || 1)}</span><span class="cff-prediction-chip">Acertar +${Number(p.correctPoints || 3)}</span></div>
        </div>
        <div class="cff-prediction-box">
          <strong class="cff-prediction-question">${esc(p.question)}</strong>
          <div class="cff-prediction-options">${options.map(o => {
            const selected = vote === o.id;
            const isCorrect = settled && o.id === correct;
            const wrong = settled && selected && !isCorrect;
            const cls = ['cff-prediction-option', selected ? 'is-selected' : '', isCorrect ? 'is-correct' : '', wrong ? 'is-wrong' : ''].filter(Boolean).join(' ');
            return `<button type="button" class="${cls}" data-prediction-option="${esc(o.id)}" ${(closed || vote || !linked || busy) ? 'disabled' : ''}>${esc(o.label)}</button>`;
          }).join('')}</div>
          <p class="cff-prediction-status ${statusClass}">${status}</p>
          ${p.closesAt ? `<span class="cff-prediction-countdown">Palpite até ${esc(formatDeadline(p.closesAt))}</span>` : ''}
        </div>
      </div>`;

    root.querySelectorAll('[data-prediction-option]').forEach(btn => btn.addEventListener('click', () => votePrediction(btn.dataset.predictionOption)));
  }

  async function load() {
    if (!mount()) return;
    try {
      const qs = new URLSearchParams();
      if (session()) qs.set('session', session());
      qs.set('_', Date.now());
      const data = await request('/api/prediction?' + qs.toString());
      render(data);
    } catch (error) {
      console.error('[CFF Prediction]', error);
      const root = mount();
      if (root) root.hidden = true;
    }
  }

  async function votePrediction(option) {
    if (busy || !current?.prediction?.id || !session()) return;
    busy = true;
    render(current);
    try {
      const data = await request('/api/prediction/vote', {
        method: 'POST',
        body: JSON.stringify({ session: session(), predictionId: current.prediction.id, option }),
      });
      current = data;
      render(data);
      window.setTimeout(() => location.reload(), 900);
    } catch (error) {
      console.error('[CFF Prediction vote]', error);
      const root = mount();
      const status = root?.querySelector('.cff-prediction-status');
      if (status) { status.textContent = error.message || 'Não foi possível registrar o palpite.'; status.classList.add('warn'); }
    } finally {
      busy = false;
    }
  }

  function boot() {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if ($('.ig-toolbar')) { clearInterval(timer); load(); }
      else if (tries > 100) clearInterval(timer);
    }, 100);
  }

  window.addEventListener('storage', e => { if (e.key === SESSION_KEY) load(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  setInterval(() => { if (!document.hidden && !busy) load(); }, 15000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();