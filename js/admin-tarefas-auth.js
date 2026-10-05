import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';

const ADMIN = 'admin@centralfreefire.com.br';
const overlay = document.getElementById('cff-tasks-auth');
const config = window.CFF_CONFIG?.firebase;
function fail(message) {
  const status = overlay?.querySelector('[data-cff-auth-status]');
  if (status) status.textContent = message;
}
if (!config) {
  fail('Não foi possível carregar a sessão. Volte ao painel e tente novamente.');
} else {
  try {
    const app = getApps().length ? getApp() : initializeApp(config);
    const auth = getAuth(app);
    onAuthStateChanged(auth, user => {
      if (!user || String(user.email || '').toLowerCase() !== ADMIN) {
        window.CFF_TASKS_AUTHORIZED = false;
        document.body.classList.add('cff-auth-pending');
        location.replace('admin.html');
        return;
      }
      window.CFF_TASKS_AUTHORIZED = true;
      window.dispatchEvent(new Event('cff-tasks-authenticated'));
      document.body.classList.remove('cff-auth-pending');
      if (overlay) overlay.hidden = true;
    }, () => fail('Não foi possível validar a sessão. Volte ao painel para entrar novamente.'));
  } catch {
    fail('Não foi possível validar a sessão. Volte ao painel para entrar novamente.');
  }
}
