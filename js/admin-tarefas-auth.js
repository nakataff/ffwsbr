import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import { getDatabase, ref, get, set, onValue, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';

const ADMIN = 'admin@centralfreefire.com.br';
const CLOUD_PATH = 'adminTasks/board';
const overlay = document.getElementById('cff-tasks-auth');
const config = window.CFF_CONFIG?.firebase;
const clientId = globalThis.crypto?.randomUUID?.() || ('tasks-' + Date.now() + '-' + Math.random().toString(36).slice(2));

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
    const database = getDatabase(app);
    const cloudRef = ref(database, CLOUD_PATH);

    window.CFF_TASKS_CLOUD = {
      clientId,
      async load() {
        const snap = await get(cloudRef);
        return snap.exists() ? snap.val() : null;
      },
      async save(state) {
        const cleanState = JSON.parse(JSON.stringify(state));
        await set(cloudRef, {
          schemaVersion: 1,
          state: cleanState,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.email || ADMIN,
          clientId
        });
      },
      subscribe(handler, onError) {
        return onValue(
          cloudRef,
          snap => {
            if (!snap.exists()) return;
            const payload = snap.val();
            if (payload?.clientId === clientId) return;
            handler(payload);
          },
          error => onError?.(error)
        );
      }
    };

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
  } catch (error) {
    console.error('[Tasks auth/cloud]', error);
    fail('Não foi possível validar a sessão. Volte ao painel para entrar novamente.');
  }
}
