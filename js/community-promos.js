(() => {
  'use strict';

  if (window.__CFF_COMMUNITY_PROMOS_V1__) return;
  window.__CFF_COMMUNITY_PROMOS_V1__ = true;

  const API = 'https://cff-instagram-community.nakataffb4.workers.dev';
  const GIVEAWAY_URL = 'https://central-free-fire-default-rtdb.firebaseio.com/communityGiveaways/current.json';
  const path = location.pathname.toLowerCase();
  const isHome = path === '/' || path.endsWith('/index.html');
  const isInteractions = path.endsWith('/interacoes.html');
  if (!isHome && !isInteractions) return;

  const esc = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const fmt = (ms) => {
    try { return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(Number(ms)||0)); }
    catch (_) { return ''; }
  };
  const countdown = (ms) => {
    const left = Math.max(0, Number(ms || 0) - Date.now());
    const total = Math.floor(left / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h >= 24) return `${Math.floor(h/24)}d ${h%24}h`;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  function css() {
    if (document.getElementById('cff-community-promos-css')) return;
    const style = document.createElement('style');
    style.id = 'cff-community-promos-css';
    style.textContent = `
      .cff-community-promo{position:relative;overflow:hidden;border:1px solid rgba(0,200,255,.22);border-radius:18px;background:linear-gradient(135deg,rgba(0,200,255,.10),rgba(9,17,31,.96) 46%,rgba(7,12,22,.98));color:#f7fbff;box-shadow:0 16px 44px rgba(0,0,0,.18);margin:0 0 16px}
      .cff-community-promo::after{content:"";position:absolute;width:220px;height:220px;border-radius:50%;right:-105px;top:-125px;background:rgba(0,200,255,.12);pointer-events:none}
      .cff-community-promo-inner{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;padding:18px 20px}
      .cff-community-promo-kicker{color:#00c8ff;font-size:.65rem;font-weight:1000;letter-spacing:1.35px;text-transform:uppercase}
      .cff-community-promo h3{margin:5px 0 6px;color:#fff;font-size:clamp(1.02rem,2.4vw,1.38rem);font-weight:1000;line-height:1.1;text-transform:uppercase}
      .cff-community-promo p{margin:0;color:#8fa9c7;font-size:.76rem;line-height:1.5;font-weight:750}
      .cff-community-promo-meta{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.cff-community-promo-chip{display:inline-flex;align-items:center;min-height:27px;padding:0 9px;border:1px solid rgba(0,200,255,.18);border-radius:999px;background:rgba(0,200,255,.055);color:#b7edff;font-size:.62rem;font-weight:950;text-transform:uppercase}
      .cff-community-promo-btn{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 16px;border:1px solid #00c8ff;border-radius:11px;background:#00c8ff;color:#03111a;text-decoration:none;font-size:.72rem;font-weight:1000;text-transform:uppercase;white-space:nowrap}.cff-community-promo-btn:hover{filter:brightness(1.08)}
      .cff-community-promo.giveaway{border-color:rgba(255,195,49,.28);background:linear-gradient(135deg,rgba(255,195,49,.11),rgba(9,17,31,.96) 48%,rgba(7,12,22,.98))}.cff-community-promo.giveaway .cff-community-promo-kicker{color:#ffd06a}.cff-community-promo.giveaway .cff-community-promo-btn{border-color:#ffc331;background:#ffc331;color:#1a1000}.cff-community-promo.giveaway .cff-community-promo-chip{border-color:rgba(255,195,49,.2);background:rgba(255,195,49,.06);color:#ffe3a0}
      .cff-home-predictions{margin:0 0 18px;border:1px solid rgba(0,200,255,.20);border-radius:18px;background:linear-gradient(145deg,rgba(15,23,38,.97),rgba(7,12,22,.98));overflow:hidden;color:#fff}.cff-home-predictions-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px 17px;border-bottom:1px solid rgba(0,200,255,.12)}.cff-home-predictions-head strong{font-size:.84rem;font-weight:1000;text-transform:uppercase}.cff-home-predictions-head span{color:#6f8eae;font-size:.65rem;font-weight:850}.cff-home-predictions-body{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px}.cff-home-prediction-item{padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:11px;background:rgba(255,255,255,.025)}.cff-home-prediction-item small{display:block;color:#00c8ff;font-size:.58rem;font-weight:1000;text-transform:uppercase}.cff-home-prediction-item b{display:block;margin-top:5px;color:#eef8ff;font-size:.79rem;line-height:1.35}.cff-home-predictions-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:0 10px 10px}.cff-home-predictions-foot span{color:#718dab;font-size:.63rem;font-weight:800}.cff-home-predictions-foot a{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 13px;border-radius:9px;background:#00c8ff;color:#03111a;text-decoration:none;font-size:.66rem;font-weight:1000;text-transform:uppercase}
      .cff-home-broadcast-predict{display:inline-flex!important;align-items:center!important;justify-content:center!important;text-decoration:none!important;margin-top:7px!important;border-color:#00c8ff!important;background:rgba(0,200,255,.10)!important;color:#c9f5ff!important}.cff-home-broadcast-predict:hover{background:#00c8ff!important;color:#03111a!important}
      @media(max-width:680px){.cff-community-promo-inner{grid-template-columns:1fr;padding:16px}.cff-community-promo-btn{width:100%}.cff-home-predictions-body{grid-template-columns:1fr}.cff-home-predictions-head,.cff-home-predictions-foot{align-items:flex-start;flex-direction:column}.cff-home-predictions-foot a{width:100%}}
    `;
    document.head.appendChild(style);
  }

  async function getJson(url) {
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  function promoMarkup(giveaway) {
    return `<div class="cff-community-promo-inner"><div><div class="cff-community-promo-kicker">🎁 Sorteio aberto agora</div><h3>${esc(giveaway.title || 'Sorteio da comunidade')}</h3><p>${esc(giveaway.description || 'Deixe seu @ e participe antes do encerramento.')}</p><div class="cff-community-promo-meta"><span class="cff-community-promo-chip">Encerra ${esc(fmt(giveaway.endsAt))}</span><span class="cff-community-promo-chip" data-giveaway-countdown="${Number(giveaway.endsAt)||0}">${esc(countdown(giveaway.endsAt))}</span></div></div><a class="cff-community-promo-btn" href="sorteio-comunidade.html">Participar agora</a></div>`;
  }

  function mountGiveaway(giveaway) {
    if (!giveaway?.active || !giveaway?.id || Number(giveaway.endsAt) <= Date.now()) return;
    css();
    let root = document.getElementById('cff-active-giveaway-promo');
    if (!root) {
      root = document.createElement('section'); root.id = 'cff-active-giveaway-promo'; root.className = 'cff-community-promo giveaway';
      if (isHome) {
        const center = document.querySelector('#home .home-center-column');
        if (!center) return;
        center.insertBefore(root, center.firstChild);
      } else {
        const toolbar = document.querySelector('.ig-toolbar');
        if (!toolbar?.parentNode) return;
        toolbar.parentNode.insertBefore(root, toolbar);
      }
    }
    root.innerHTML = promoMarkup(giveaway);
  }

  function predictionTitle(p) {
    if (p.metric === 'best') return '🔥 Melhor equipe do dia';
    if (p.metric === 'worst') return '📉 Pior equipe do dia';
    if (p.metric === 'mvp') return '⭐ MVP do dia';
    return '🎯 Palpite';
  }

  function mountHomePredictions(payload) {
    if (!isHome) return;
    const predictions = (payload?.predictions || []).filter(p => p?.category === 'ffws');
    if (!predictions.length) return;
    css();
    const open = predictions.some(p => p.status === 'open');
    const closesAt = Math.max(...predictions.map(p => Number(p.closesAt || 0)));
    let root = document.getElementById('cff-home-predictions');
    if (!root) {
      root = document.createElement('section'); root.id = 'cff-home-predictions'; root.className = 'cff-home-predictions';
      const broadcast = document.getElementById('home-s2-broadcast');
      if (broadcast) broadcast.insertAdjacentElement('afterend', root);
      else document.querySelector('#home .home-center-column')?.prepend(root);
    }
    root.innerHTML = `<div class="cff-home-predictions-head"><strong>🎯 Palpites da WB / FFWS BR</strong><span>${open ? `abertos até ${esc(fmt(closesAt))}` : 'palpites do dia encerrados'}</span></div><div class="cff-home-predictions-body">${predictions.map(p => `<div class="cff-home-prediction-item"><small>${esc(predictionTitle(p))}</small><b>${esc(p.question || '')}</b></div>`).join('')}</div><div class="cff-home-predictions-foot"><span>Palpite na melhor equipe, pior equipe e MVP do dia. Você pode editar até 13h.</span><a href="interacoes.html#palpites">${open ? 'Dar palpite' : 'Ver palpites'}</a></div>`;

    const watch = document.getElementById('home-s2-watch');
    if (watch?.parentNode && !document.getElementById('cff-home-broadcast-predict')) {
      const btn = document.createElement('a');
      btn.id = 'cff-home-broadcast-predict';
      btn.className = 'home-s2-watch cff-home-broadcast-predict';
      btn.href = 'interacoes.html#palpites';
      btn.textContent = open ? '🎯 DAR PALPITE →' : '🎯 VER PALPITES →';
      watch.insertAdjacentElement('afterend', btn);
    }
  }

  function scrollHash() {
    if (!isInteractions || location.hash !== '#palpites') return;
    window.cffOpenCommunityTab?.('predictions',{updateHash:false});
  }

  async function boot() {
    css();
    const jobs = [getJson(GIVEAWAY_URL).then(mountGiveaway).catch(() => {})];
    if (isHome) jobs.push(getJson(`${API}/api/predictions`).then(mountHomePredictions).catch(() => {}));
    await Promise.allSettled(jobs);
    scrollHash();
    setInterval(() => {
      document.querySelectorAll('[data-giveaway-countdown]').forEach(el => {
        const ends = Number(el.getAttribute('data-giveaway-countdown') || 0);
        el.textContent = countdown(ends);
        if (ends && ends <= Date.now()) document.getElementById('cff-active-giveaway-promo')?.remove();
      });
    }, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();
