const SOURCE = 'cff-looker-bridge';

const BRIDGE_VERSION = chrome.runtime.getManifest().version;

function post(message) {
  window.postMessage({ source: SOURCE, version: BRIDGE_VERSION, ...message }, location.origin);
}

window.addEventListener('message', event => {
  if (event.source !== window || event.origin !== location.origin) return;
  const data = event.data || {};
  if (data.source !== 'cff-admin-looker') return;

  if (data.type === 'PING') {
    post({ type: 'READY' });
    return;
  }

  if (data.type !== 'FETCH') return;

  chrome.runtime.sendMessage({
    type: 'CFF_LOOKER_FETCH',
    round: data.round,
    drop: data.drop
  }, response => {
    const error = chrome.runtime.lastError?.message;
    post({
      type: 'FETCH_RESULT',
      requestId: data.requestId,
      ok: Boolean(response?.ok) && !error,
      data: response?.data || null,
      error: error || response?.error || ''
    });
  });
});

post({ type: 'READY' });
