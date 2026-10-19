(() => {
  'use strict';
  const card = document.querySelector('#home .home-support');
  if (!card || window.__cffSupportReady) return;
  window.__cffSupportReady = true;
  const KEY = 'cff-support-hidden-until-v1';
  const SESSION = 'cff-support-seen-v1';
  const DAY = 24 * 60 * 60 * 1000;
  const read = (storage, key) => { try { return window[storage].getItem(key); } catch { return null; } };
  const write = (storage, key, value) => { try { window[storage].setItem(key, String(value)); return true; } catch { return false; } };
  const suppressed = () => Number(read('localStorage', KEY)) > Date.now() || Date.now() - Number(read('sessionStorage', SESSION) || 0) < DAY;
  if (suppressed()) return;

  let dialog;
  const snooze = () => write('localStorage', KEY, Date.now() + DAY);
  // Following the permanent card also silences the invitation.
  card.querySelector('a')?.addEventListener('click', () => { snooze(); dialog?.close(); });

  function show() {
    if (suppressed() || document.hidden || !document.getElementById('home')?.classList.contains('active')) return;
    // Never queue another invitation behind a welcome or other open overlay.
    if (document.querySelector('dialog[open],.modal-overlay.active,#sidebar-panel.active,.cff-quiz-invite')) return;
    if (typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;
    if (!write('sessionStorage', SESSION, Date.now())) return;
    const previousFocus = document.activeElement;
    dialog = document.createElement('dialog');
    dialog.id = 'cff-support-dialog';
    dialog.setAttribute('aria-labelledby', 'cff-support-dialog-title');
    dialog.setAttribute('aria-describedby', 'cff-support-dialog-description');
    dialog.innerHTML = `
      <button type="button" class="cff-support-close" data-support-dismiss aria-label="Fechar aviso por 1 dia" autofocus><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg></button>
      <span class="home-support-icon" aria-hidden="true">${card.querySelector('.home-support-icon').innerHTML}</span>
      <span class="cff-support-kicker">Vaquinha da comunidade</span>
      <h2 id="cff-support-dialog-title">Apoie a Central Free Fire</h2>
      <p id="cff-support-dialog-description">Se a Central Free Fire faz parte do seu dia, você pode ajudar a manter o site e a produção de conteúdo. Qualquer contribuição é bem-vinda.</p>
      ${card.querySelector('a').outerHTML}
      <button type="button" class="cff-support-later" data-support-dismiss>Agora não</button>
      <small class="cff-support-note">Ao fechar, este aviso fica oculto por 1 dia neste navegador.</small>`;
    const dismiss = () => { snooze(); dialog.close(); };
    dialog.querySelectorAll('[data-support-dismiss]').forEach(button => button.addEventListener('click', dismiss));
    dialog.querySelector('a').addEventListener('click', dismiss);
    dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dismiss();
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
    }, {once:true});
    document.body.append(dialog);
    dialog.showModal();
  }
  // One local timer, with no polling, API, or campaign tracking requests.
  setTimeout(show, 8000);
  window.addEventListener('storage', event => {
    if (event.key === KEY && Number(event.newValue) > Date.now()) dialog?.close();
  });
  const closeAway = () => {
    if (!document.getElementById('home')?.classList.contains('active')) dialog?.close();
  };
  window.addEventListener('hashchange', closeAway);
  window.addEventListener('cff:pretty-route', closeAway);
})();
