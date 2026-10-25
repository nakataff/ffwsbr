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
      async taskRequest(body) {
        const user=auth.currentUser;if(user?.email!==ADMIN)throw Error('Entre com a conta administrativa.');
        const response=await fetch('https://cff-camp-notifications.nakataffb4.workers.dev/tasks/api',{method:'POST',headers:{Authorization:'Bearer '+await user.getIdToken(),'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
        const result=await response.json();if(auth.currentUser?.uid!==user.uid)throw Error('A conta conectada mudou.');if(!response.ok)throw Error(result.error||'Não foi possível concluir.');return result;
      },
      async uploadFile(id,name,blob) {
        const user=auth.currentUser;if(user?.email!==ADMIN)throw Error('Entre com a conta administrativa.');
        const response=await fetch('https://cff-camp-notifications.nakataffb4.workers.dev/tasks/files/'+encodeURIComponent(id),{method:'POST',headers:{Authorization:'Bearer '+await user.getIdToken(),'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(name),'X-File-Type':blob.type||'application/octet-stream'},body:blob,signal:AbortSignal.timeout(120000)});
        const result=await response.json();if(auth.currentUser?.uid!==user.uid)throw Error('A conta conectada mudou.');if(!response.ok)throw Error(result.error||'Não foi possível sincronizar o anexo.');return result;
      },
      async downloadFile(id) {
        const user=auth.currentUser;if(user?.email!==ADMIN)throw Error('Entre com a conta administrativa.');
        const response=await fetch('https://cff-camp-notifications.nakataffb4.workers.dev/tasks/files/'+encodeURIComponent(id),{headers:{Authorization:'Bearer '+await user.getIdToken()},signal:AbortSignal.timeout(90000)});
        if(!response.ok){const result=await response.json();throw Error(result.error||'Não foi possível baixar o anexo.');}if(auth.currentUser?.uid!==user.uid)throw Error('A conta conectada mudou.');return response.blob();
      },
      async enableNotifications(){
        if(!('Notification'in window))throw Error('Este navegador não oferece notificações.');
        if(await Notification.requestPermission()!=='granted')throw Error('Permita as notificações nas configurações do navegador.');
        const m=await import('./camp-notifications.js?v=20261013-notifications-hub-v1'),settings=await m.request('settings',{},app);await m.enableDevice(settings.publicKey,app);
      },
      async load() {
        const snap = await get(cloudRef);
        if (snap.exists()) return snap.val();
        try {
          const legacy = await get(legacyCloudRef);
          if (legacy.exists()) {
            const payload = legacy.val();
            const migrated = await runTransaction(cloudRef, current => current || {
              schemaVersion: 5,
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
          merged.version = 5;
          return {
            schemaVersion: 5,
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

