import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import { getDatabase, ref, get, onValue, serverTimestamp, runTransaction } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';

const ADMIN = 'admin@centralfreefire.com.br';
const CLOUD_PATH = 'adminLiquipediaEditor/tasksBoard';
const LEGACY_CLOUD_PATH = 'adminTasks/board';
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
    const legacyCloudRef = ref(database, LEGACY_CLOUD_PATH);

    window.CFF_TASKS_CLOUD = {
      clientId,
      async load() {
        const snap = await get(cloudRef);
        if (snap.exists()) return snap.val();
        try {
          const legacy = await get(legacyCloudRef);
          if (legacy.exists()) {
            const payload = legacy.val();
            const migrated = await runTransaction(cloudRef, current => current || {
              schemaVersion: 2,
              stateJson: JSON.stringify(window.CFF_TASKS_SYNC.decode(payload)),
              updatedAt: serverTimestamp(),
              updatedBy: auth.currentUser.email,
              clientId
            }, { applyLocally: false });
            if (migrated.committed) return migrated.snapshot.val();
          }
        } catch (_) {}
        return null;
      },
      async save(state, base) {
        if (!auth.currentUser || auth.currentUser.email.toLowerCase() !== ADMIN) throw Error('Sessão do administrador necessária');
        const result = await runTransaction(cloudRef, current => {
          const remote = current ? window.CFF_TASKS_SYNC.decode(current) : (base || state);
          const merged = window.CFF_TASKS_SYNC.merge(base, state, remote);
          return {
            schemaVersion: 2,
            stateJson: JSON.stringify(merged),
            updatedAt: serverTimestamp(),
            updatedBy: auth.currentUser.email,
            clientId
          };
        }, { applyLocally: false });
        if (!result.committed) throw Error('Envio não confirmado pela nuvem');
        return result.snapshot.val();
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

