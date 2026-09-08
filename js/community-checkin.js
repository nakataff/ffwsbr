(() => {
  'use strict';

  if (!/\/(?:interacoes\.html)?$/i.test(location.pathname) && !/interacoes\.html$/i.test(location.pathname)) return;

  const API = 'https://cff-instagram-community.nakataffb4.workers.dev';
  const STORAGE_KEY = 'cff_daily_checkin_session_v1';
  const POLL_MS = 4000;
  let pollTimer = null;
  let busy = false;

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function session() {
    try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (_) { return ''; }
  }

  function saveSession(value) {
    try {
      if (value) localStorage.setItem(STORAGE_KEY, value);
      else localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  async function request(path, options = {}) {
    const response = await fetch(API + path, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(options.headers || {}) },
      ...options,
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(data?.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function injectCss() {
    if (document.getElementById('cff-community-checkin-css')) return;
    const style = document.createElement('style');
    style.id = 'cff-community-checkin-css';
    style.textContent = `
      .cff-checkin{display:grid;grid-template-columns:minmax(0,1fr) minmax(330px,.72fr);gap:14px;margin:0 0 18px;border:1px solid rgba(0,200,255,.20);border-radius:18px;background:linear-gradient(135deg,rgba(0,200,255,.075),rgba(11,17,29,.96) 48%,rgba(8,14,24,.98));overflow:hidden;box-shadow:0 16px 42px rgba(0,0,0,.18)}
      .cff-checkin-copy{padding:22px 24px;min-width:0}
      .cff-checkin-kicker{color:#00c8ff;font-size:.68rem;font-weight:1000;letter-spacing:1.5px;text-transform:uppercase}
      .cff-checkin h2{margin:6px 0 8px;color:#fff;font-size:clamp(1.35rem,3vw,2rem);font-weight:1000;line-height:1;text-transform:uppercase}
      .cff-checkin h2 span{color:#00c8ff}
      .cff-checkin-copy p{margin:0;max-width:680px;color:#88a4c3;font-size:.82rem;line-height:1.55;font-weight:700}
      .cff-checkin-box{display:flex;align-items:center;justify-content:center;padding:16px;border-left:1px solid rgba(0,200,255,.12);background:rgba(0,0,0,.12)}
      .cff-checkin-panel{width:100%;padding:15px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:#080e18;text-align:center}
      .cff-checkin-status{display:inline-flex;align-items:center;gap:7px;color:#90aac6;font-size:.66rem;font-weight:950;letter-spacing:.7px;text-transform:uppercase}
      .cff-checkin-status::before{content:"";width:7px;height:7px;border-radius:50%;background:#00c8ff;box-shadow:0 0 10px rgba(0,200,255,.65)}
      .cff-checkin-code{display:block;margin:9px auto 11px;color:#fff;font-size:1.45rem;font-weight:1000;letter-spacing:2px}
      .cff-checkin-user{display:block;margin:8px 0 4px;color:#fff;font-size:1.02rem;font-weight:1000}
      .cff-checkin-help{margin:0 0 11px;color:#718daa;font-size:.7rem;line-height:1.4}
      .cff-checkin-actions{display:flex;justify-content:center;flex-wrap:wrap;gap:7px}
      .cff-checkin-btn{border:1px solid rgba(0,200,255,.28);border-radius:9px;padding:9px 12px;background:rgba(0,200,255,.10);color:#dff8ff;font-size:.7rem;font-weight:1000;text-transform:uppercase;cursor:pointer;text-decoration:none}
      .cff-checkin-btn:hover{border-color:#00c8ff;background:rgba(0,200,255,.16)}
      .cff-checkin-btn.primary{border-color:#00c8ff;background:#00c8ff;color:#03111a}
      .cff-checkin-btn[disabled]{opacity:.55;cursor:default}
      .cff-checkin-swap{margin-top:10px;border:0;background:none;color:#627d9a;font-size:.63rem;font-weight:900;text-transform:uppercase;cursor:pointer}
      .cff-checkin-success{color:#7ee2a8!important}
      .cff-checkin-error{color:#ff9ca8!important}
      @media(max-width:800px){.cff-checkin{grid-template-columns:1fr}.cff-checkin-box{border-left:0;border-top:1px solid rgba(0,200,255,.12)}.cff-checkin-copy{padding:18px}.cff-checkin-box{padding:12px}}
    `;
    document.head.appendChild(style);
  }

  function injectRule() {
    const rules = document.querySelector('.ig-rules');
    if (!rules || document.getElementById('ig-rule-checkin')) return;
    const row = document.createElement('div');
    row.className = 'ig-rule';
    row.id = 'ig-rule-checkin';
    row.innerHTML = '<div class="ig-rule-icon">✅</div><div><strong>Check-in diário</strong><small>Entre no site e faça um check-in por dia após vincular seu Instagram.</small></div><div class="ig-rule-points">+1 pt</div>';
    const note = rules.querySelector('.ig-note');
    if (note) rules.insertBefore(row, note);
    else rules.appendChild(row);
  }

  function mount() {
    const toolbar = document.querySelector('.ig-toolbar');
    if (!toolbar || document.getElementById('cff-community-checkin')) return null;
    injectCss();
    injectRule();
    const section = document.createElement('section');
    section.className = 'cff-checkin';
    section.id = 'cff-community-checkin';
    section.innerHTML = `
      <div class="cff-checkin-copy">
        <div class="cff-checkin-kicker">Pontos extras • 1 vez por dia</div>
        <h2>Check-in diário <span>+1 ponto</span></h2>
        <p>Vincule seu Instagram uma única vez por DM. Depois, basta voltar ao Central Free Fire todos os dias e tocar em fazer check-in. O ponto entra no ranking semanal, mensal e geral.</p>
      </div>
      <div class="cff-checkin-box"><div class="cff-checkin-panel" id="cff-checkin-panel"><span class="cff-checkin-status">Carregando</span></div></div>`;
    toolbar.parentNode.insertBefore(section, toolbar);
    return section;
  }

  function panel() { return document.getElementById('cff-checkin-panel'); }

  function renderLoading(text = 'Carregando') {
    const root = panel();
    if (root) root.innerHTML = `<span class="cff-checkin-status">${esc(text)}</span>`;
  }

  function renderUnavailable() {
    const root = panel();
    if (!root) return;
    root.innerHTML = '<span class="cff-checkin-status cff-checkin-error">Indisponível agora</span><p class="cff-checkin-help" style="margin-top:9px">O sistema de check-in ainda não está disponível. Tente novamente daqui a pouco.</p><div class="cff-checkin-actions"><button class="cff-checkin-btn" id="cff-checkin-retry" type="button">Tentar novamente</button></div>';
    document.getElementById('cff-checkin-retry')?.addEventListener('click', bootSession);
  }

  function renderPending(data) {
    const root = panel();
    if (!root) return;
    const code = String(data?.code || '');
    root.innerHTML = `
      <span class="cff-checkin-status">Aguardando vínculo</span>
      <strong class="cff-checkin-code">${esc(code)}</strong>
      <p class="cff-checkin-help">Mande exatamente este código por DM para <strong>@nakataff</strong>. A confirmação é automática e este navegador ficará vinculado à sua conta.</p>
      <div class="cff-checkin-actions">
        <button class="cff-checkin-btn" id="cff-checkin-copy" type="button">Copiar código</button>
        <a class="cff-checkin-btn" href="https://www.instagram.com/nakataff/" target="_blank" rel="noopener">Abrir @nakataff</a>
        <button class="cff-checkin-btn primary" id="cff-checkin-sent" type="button">Já enviei</button>
      </div>`;
    document.getElementById('cff-checkin-copy')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code);
      } catch (_) {
        const area = document.createElement('textarea'); area.value = code; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
      }
      const button = document.getElementById('cff-checkin-copy');
      if (button) { button.textContent = 'Copiado!'; setTimeout(() => { button.textContent = 'Copiar código'; }, 1200); }
    });
    document.getElementById('cff-checkin-sent')?.addEventListener('click', checkStatus);
    startPolling();
  }

  function renderVerified(data) {
    stopPolling();
    const root = panel();
    if (!root) return;
    const checked = Boolean(data?.checkedInToday);
    root.innerHTML = `
      <span class="cff-checkin-status ${checked ? 'cff-checkin-success' : ''}">${checked ? 'Check-in concluído hoje' : 'Instagram vinculado'}</span>
      <strong class="cff-checkin-user">@${esc(data?.username || 'usuario')}</strong>
      <p class="cff-checkin-help">${checked ? 'Você já garantiu o ponto de hoje. Volte amanhã para pontuar de novo.' : 'Tudo certo. Seu Instagram já está confirmado neste navegador.'}</p>
      <div class="cff-checkin-actions"><button class="cff-checkin-btn primary" id="cff-checkin-do" type="button" ${checked ? 'disabled' : ''}>${checked ? 'Feito hoje ✓' : 'Fazer check-in +1'}</button></div>
      <button class="cff-checkin-swap" id="cff-checkin-swap" type="button">Trocar conta neste navegador</button>`;
    document.getElementById('cff-checkin-do')?.addEventListener('click', doCheckin);
    document.getElementById('cff-checkin-swap')?.addEventListener('click', () => {
      if (!confirm('Desvincular este navegador e conectar outro Instagram?')) return;
      saveSession('');
      bootSession();
    });
  }

  function renderExpired() {
    stopPolling();
    const root = panel();
    if (!root) return;
    root.innerHTML = '<span class="cff-checkin-status">Código expirado</span><p class="cff-checkin-help" style="margin-top:9px">Por segurança, o código de vínculo vale por 15 minutos.</p><div class="cff-checkin-actions"><button class="cff-checkin-btn primary" id="cff-checkin-new" type="button">Gerar novo código</button></div>';
    document.getElementById('cff-checkin-new')?.addEventListener('click', () => { saveSession(''); bootSession(); });
  }

  async function startSession() {
    const data = await request('/api/checkin/start', { method: 'POST', body: '{}' });
    if (!data?.session) throw new Error('Sessão inválida');
    saveSession(data.session);
    renderPending(data);
  }

  async function checkStatus() {
    const current = session();
    if (!current) return startSession();
    try {
      const data = await request('/api/checkin/status?session=' + encodeURIComponent(current));
      if (data?.status === 'verified') return renderVerified(data);
      if (data?.status === 'expired') return renderExpired();
      if (data?.status === 'pending') return renderPending(data);
      saveSession('');
      return startSession();
    } catch (error) {
      if (error.status === 404) { saveSession(''); return startSession(); }
      throw error;
    }
  }

  async function doCheckin() {
    if (busy) return;
    busy = true;
    const button = document.getElementById('cff-checkin-do');
    if (button) { button.disabled = true; button.textContent = 'Confirmando...'; }
    try {
      const data = await request('/api/checkin', { method: 'POST', body: JSON.stringify({ session: session() }) });
      renderVerified({ username: data?.username, checkedInToday: true });
      const root = panel();
      const help = root?.querySelector('.cff-checkin-help');
      if (help && data?.awarded) help.textContent = '+1 ponto! Seu check-in de hoje foi contabilizado no ranking.';
    } catch (_) {
      if (button) { button.disabled = false; button.textContent = 'Fazer check-in +1'; }
      const root = panel();
      const help = root?.querySelector('.cff-checkin-help');
      if (help) { help.textContent = 'Não foi possível confirmar agora. Tente novamente.'; help.classList.add('cff-checkin-error'); }
    } finally {
      busy = false;
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => { if (!document.hidden) checkStatus().catch(() => {}); }, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  async function bootSession() {
    renderLoading();
    try {
      if (session()) await checkStatus();
      else await startSession();
    } catch (error) {
      console.error('[CFF Check-in]', error);
      renderUnavailable();
    }
  }

  function boot() {
    if (!mount()) return;
    bootSession();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
