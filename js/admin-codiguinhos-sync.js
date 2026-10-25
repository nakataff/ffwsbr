import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import { getDatabase, ref, get, set, onValue, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';

const ADMIN_EMAIL = 'admin@centralfreefire.com.br';
const DB_PATH = 'adminCodiguinhos';
const FORMAT_VERSION = 1; // Mantido em 1 para continuar compatível com as rules atuais.
const SCHEME = 'envelope-v2';
const KDF_ITERATIONS = 250000;
const LEGACY_AAD = new TextEncoder().encode('central-free-fire/admin-codiguinhos/v1');
const DATA_AAD = new TextEncoder().encode('central-free-fire/admin-codiguinhos/data/v2');
const PASS_WRAP_AAD = new TextEncoder().encode('central-free-fire/admin-codiguinhos/pass-wrap/v2');
const RECOVERY_WRAP_AAD = new TextEncoder().encode('central-free-fire/admin-codiguinhos/recovery-wrap/v2');
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const clientId = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const config = window.CFF_CONFIG && window.CFF_CONFIG.firebase;
if (!config) throw new Error('Configuração do Firebase não encontrada em window.CFF_CONFIG.firebase');
const app = getApps().length ? getApp() : initializeApp(config);
const auth = getAuth(app);
const database = getDatabase(app);
const dataRef = ref(database, DB_PATH);

let adminUser = null;
let dataKey = null;
let envelopeMeta = null;
let lastCiphertext = '';
let pendingState = null;
let saveTimer = null;
let saveChain = Promise.resolve();
let remoteUnsubscribe = null;
let authInitialized = false;
let readyResolve;
const readyPromise = new Promise(resolve => { readyResolve = resolve; });

function emit(status, extra={}){
  window.dispatchEvent(new CustomEvent('codiguinhos-sync-status', {detail:{status, ...extra}}));
}

function isAdmin(user){
  return Boolean(user && String(user.email || '').toLowerCase() === ADMIN_EMAIL);
}

function bytesToBase64(bytes){
  let binary = '';
  const chunk = 0x8000;
  for(let i=0;i<bytes.length;i+=chunk){ binary += String.fromCharCode(...bytes.subarray(i, i+chunk)); }
  return btoa(binary);
}

function base64ToBytes(value){
  const binary = atob(String(value || ''));
  const bytes = new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveWrappingKey(secret, salt){
  if(!window.crypto?.subtle) throw new Error('Seu navegador não oferece Web Crypto nesta conexão. Use HTTPS.');
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2', salt, iterations:KDF_ITERATIONS, hash:'SHA-256'},
    material,
    {name:'AES-GCM', length:256},
    false,
    ['encrypt','decrypt']
  );
}

async function importDataKey(rawBytes){
  return crypto.subtle.importKey('raw', rawBytes, {name:'AES-GCM'}, true, ['encrypt','decrypt']);
}

async function generateDataKey(){
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return {key: await importDataKey(raw), raw};
}

async function exportDataKey(key=dataKey){
  if(!key) throw new Error('Chave de dados não carregada.');
  return new Uint8Array(await crypto.subtle.exportKey('raw', key));
}

async function wrapRawDataKey(rawDataKey, wrappingKey, aad){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({name:'AES-GCM', iv, additionalData:aad}, wrappingKey, rawDataKey);
  return {iv, ciphertext:new Uint8Array(cipher)};
}

async function unwrapRawDataKey(cipherBytes, iv, wrappingKey, aad){
  try{
    const plain = await crypto.subtle.decrypt({name:'AES-GCM', iv, additionalData:aad}, wrappingKey, cipherBytes);
    const raw = new Uint8Array(plain);
    if(raw.length !== 32) throw new Error('Tamanho de chave inválido.');
    return raw;
  }catch(error){
    throw new Error('Credencial de recuperação ou chave incorreta.');
  }
}

function randomRecoveryCode(){
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let body = '';
  for(const b of bytes) body += alphabet[b % alphabet.length];
  return `CFFR-${body.match(/.{1,4}/g).join('-')}`;
}

function normalizeRecoveryCode(value){
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function validateBasePayload(payload){
  if(!payload || Number(payload.v) !== FORMAT_VERSION || payload.alg !== 'AES-GCM' || !payload.salt || !payload.iv || !payload.ciphertext){
    throw new Error('Formato criptografado não reconhecido.');
  }
}

function isEnvelopePayload(payload){
  return Boolean(payload && payload.scheme === SCHEME && payload.wrappedKey && payload.wrapIv && payload.recoverySalt && payload.recoveryWrappedKey && payload.recoveryWrapIv);
}

function metaFromPayload(payload){
  return {
    salt:String(payload.salt),
    wrappedKey:String(payload.wrappedKey),
    wrapIv:String(payload.wrapIv),
    recoverySalt:String(payload.recoverySalt),
    recoveryWrappedKey:String(payload.recoveryWrappedKey),
    recoveryWrapIv:String(payload.recoveryWrapIv)
  };
}

async function decryptDataCipher(payload, key=dataKey){
  validateBasePayload(payload);
  if(!key) throw new Error('Base ainda está bloqueada.');
  const aad = isEnvelopePayload(payload) ? DATA_AAD : LEGACY_AAD;
  const plain = await crypto.subtle.decrypt(
    {name:'AES-GCM', iv:base64ToBytes(payload.iv), additionalData:aad},
    key,
    base64ToBytes(payload.ciphertext)
  );
  return JSON.parse(decoder.decode(plain));
}

async function encryptStateWithDataKey(state, key=dataKey){
  if(!key || !envelopeMeta) throw new Error('Base criptográfica não carregada.');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = encoder.encode(JSON.stringify(state));
  const cipher = await crypto.subtle.encrypt({name:'AES-GCM', iv, additionalData:DATA_AAD}, key, plain);
  return {
    v:FORMAT_VERSION,
    alg:'AES-GCM',
    kdf:'PBKDF2-SHA-256',
    iterations:KDF_ITERATIONS,
    scheme:SCHEME,
    ...envelopeMeta,
    iv:bytesToBase64(iv),
    ciphertext:bytesToBase64(new Uint8Array(cipher)),
    updatedAt:serverTimestamp(),
    updatedBy:adminUser?.email || ADMIN_EMAIL,
    clientId
  };
}

async function buildEnvelopePayload(passphrase, recoveryCode, state){
  const generated = await generateDataKey();
  const passSalt = crypto.getRandomValues(new Uint8Array(16));
  const passWrapKey = await deriveWrappingKey(passphrase, passSalt);
  const passWrapped = await wrapRawDataKey(generated.raw, passWrapKey, PASS_WRAP_AAD);

  const recoverySalt = crypto.getRandomValues(new Uint8Array(16));
  const recoveryWrapKey = await deriveWrappingKey(normalizeRecoveryCode(recoveryCode), recoverySalt);
  const recoveryWrapped = await wrapRawDataKey(generated.raw, recoveryWrapKey, RECOVERY_WRAP_AAD);

  dataKey = generated.key;
  envelopeMeta = {
    salt:bytesToBase64(passSalt),
    wrappedKey:bytesToBase64(passWrapped.ciphertext),
    wrapIv:bytesToBase64(passWrapped.iv),
    recoverySalt:bytesToBase64(recoverySalt),
    recoveryWrappedKey:bytesToBase64(recoveryWrapped.ciphertext),
    recoveryWrapIv:bytesToBase64(recoveryWrapped.iv)
  };
  return encryptStateWithDataKey(state, dataKey);
}

async function unlockEnvelopeWithPassphrase(payload, passphrase){
  validateBasePayload(payload);
  if(!isEnvelopePayload(payload)) throw new Error('Base ainda usa o formato antigo.');
  const salt = base64ToBytes(payload.salt);
  const wrappingKey = await deriveWrappingKey(passphrase, salt);
  const rawDataKey = await unwrapRawDataKey(base64ToBytes(payload.wrappedKey), base64ToBytes(payload.wrapIv), wrappingKey, PASS_WRAP_AAD);
  const key = await importDataKey(rawDataKey);
  const state = await decryptDataCipher(payload, key);
  return {state, key};
}

async function unlockEnvelopeWithRecovery(payload, recoveryCode){
  validateBasePayload(payload);
  if(!isEnvelopePayload(payload)) throw new Error('Esta base ainda não possui recuperação. Desbloqueie uma vez com a chave atual para ativá-la.');
  const normalized = normalizeRecoveryCode(recoveryCode);
  if(normalized.length < 20) throw new Error('Código de recuperação inválido.');
  const salt = base64ToBytes(payload.recoverySalt);
  const wrappingKey = await deriveWrappingKey(normalized, salt);
  const rawDataKey = await unwrapRawDataKey(base64ToBytes(payload.recoveryWrappedKey), base64ToBytes(payload.recoveryWrapIv), wrappingKey, RECOVERY_WRAP_AAD);
  const key = await importDataKey(rawDataKey);
  const state = await decryptDataCipher(payload, key);
  return {state, key};
}

async function decryptLegacyPayload(payload, passphrase){
  validateBasePayload(payload);
  const salt = base64ToBytes(payload.salt);
  const key = await deriveWrappingKey(passphrase, salt);
  let state;
  try{
    state = await decryptDataCipher(payload, key);
  }catch(error){
    throw new Error('Não foi possível descriptografar. Confira a chave.');
  }
  return state;
}

async function upgradeLegacyPayload(payload, passphrase, state){
  const recoveryCode = randomRecoveryCode();
  const upgraded = await buildEnvelopePayload(passphrase, recoveryCode, state);
  emit('saving');
  await set(dataRef, upgraded);
  lastCiphertext = upgraded.ciphertext;
  emit('saved');
  return recoveryCode;
}

async function inspect(){
  await readyPromise;
  if(!isAdmin(adminUser)) return {authenticated:false, hasData:false};
  const snap = await get(dataRef);
  const payload = snap.exists() ? snap.val() : null;
  return {
    authenticated:true,
    hasData:snap.exists(),
    hasRecovery:snap.exists() ? isEnvelopePayload(payload) : false,
    metadata:snap.exists() ? {updatedAt:payload?.updatedAt || null, scheme:payload?.scheme || 'legacy-v1'} : null
  };
}

function startRemoteSync(){
  if(remoteUnsubscribe) remoteUnsubscribe();
  remoteUnsubscribe = onValue(dataRef, async snap => {
    if(!snap.exists() || !dataKey) return;
    const payload = snap.val();
    if(payload.ciphertext === lastCiphertext || payload.clientId === clientId) return;
    try{
      if(!isEnvelopePayload(payload)) return;
      const state = await decryptDataCipher(payload, dataKey);
      envelopeMeta = metaFromPayload(payload);
      lastCiphertext = payload.ciphertext;
      window.dispatchEvent(new CustomEvent('codiguinhos-remote-state', {detail:{state, updatedAt:payload.updatedAt || null}}));
    }catch(error){
      console.warn('Não foi possível aplicar atualização remota dos codiguinhos', error);
      emit('error', {message:'A base foi reconfigurada em outra sessão. Recarregue a página.'});
    }
  });
}

async function unlock(passphrase){
  await readyPromise;
  if(!isAdmin(adminUser)) throw new Error('Sessão administrativa não autorizada.');
  const snap = await get(dataRef);
  if(!snap.exists()) throw new Error('A base ainda não foi criada.');
  const payload = snap.val();
  validateBasePayload(payload);

  if(isEnvelopePayload(payload)){
    let result;
    try{ result = await unlockEnvelopeWithPassphrase(payload, passphrase); }
    catch(error){ throw new Error('Não foi possível descriptografar. Confira a chave.'); }
    dataKey = result.key;
    envelopeMeta = metaFromPayload(payload);
    lastCiphertext = payload.ciphertext;
    startRemoteSync();
    emit('unlocked');
    return {state:result.state, recoveryCode:null, upgraded:false};
  }

  const state = await decryptLegacyPayload(payload, passphrase);
  const recoveryCode = await upgradeLegacyPayload(payload, passphrase, state);
  startRemoteSync();
  emit('unlocked');
  return {state, recoveryCode, upgraded:true};
}

async function create(passphrase, state){
  await readyPromise;
  if(!isAdmin(adminUser)) throw new Error('Sessão administrativa não autorizada.');
  const existing = await get(dataRef);
  if(existing.exists()) throw new Error('Já existe uma base de codiguinhos no Firebase. Desbloqueie-a em vez de criar outra.');
  const recoveryCode = randomRecoveryCode();
  const payload = await buildEnvelopePayload(passphrase, recoveryCode, state);
  await set(dataRef, payload);
  lastCiphertext = payload.ciphertext;
  startRemoteSync();
  emit('saved');
  return {state, recoveryCode, created:true};
}

async function saveNow(state){
  if(!dataKey || !envelopeMeta || !isAdmin(adminUser)) throw new Error('Base bloqueada.');
  emit('saving');
  const payload = await encryptStateWithDataKey(state);
  await set(dataRef, payload);
  lastCiphertext = payload.ciphertext;
  emit('saved');
}

function scheduleSave(state, delay=320){
  pendingState = JSON.parse(JSON.stringify(state));
  emit('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const stateToSave = pendingState;
    pendingState = null;
    saveTimer = null;
    saveChain = saveChain.then(() => saveNow(stateToSave)).catch(error => {
      console.error('Falha ao salvar codiguinhos', error);
      emit('error', {message:error?.message || 'Falha ao salvar'});
    });
  }, delay);
}

async function flush(){
  clearTimeout(saveTimer);
  saveTimer = null;
  if(pendingState){
    const stateToSave = pendingState;
    pendingState = null;
    saveChain = saveChain.then(() => saveNow(stateToSave));
  }
  return saveChain;
}

async function rewrapPassphrase(newPassphrase){
  if(!dataKey || !envelopeMeta) throw new Error('Base bloqueada.');
  const raw = await exportDataKey();
  const newSalt = crypto.getRandomValues(new Uint8Array(16));
  const wrappingKey = await deriveWrappingKey(newPassphrase, newSalt);
  const wrapped = await wrapRawDataKey(raw, wrappingKey, PASS_WRAP_AAD);
  envelopeMeta = {
    ...envelopeMeta,
    salt:bytesToBase64(newSalt),
    wrappedKey:bytesToBase64(wrapped.ciphertext),
    wrapIv:bytesToBase64(wrapped.iv)
  };
}

async function changePassphrase(newPassphrase, state){
  await flush();
  if(!dataKey || !isAdmin(adminUser)) throw new Error('Base bloqueada.');
  const oldMeta = {...envelopeMeta};
  try{
    await rewrapPassphrase(newPassphrase);
    const payload = await encryptStateWithDataKey(state);
    emit('saving');
    await set(dataRef, payload);
    lastCiphertext = payload.ciphertext;
    emit('saved');
  }catch(error){
    envelopeMeta = oldMeta;
    emit('error', {message:error?.message || 'Falha ao trocar chave'});
    throw error;
  }
}

async function recoverAndChangePassphrase(recoveryCode, newPassphrase){
  await readyPromise;
  if(!isAdmin(adminUser)) throw new Error('Sessão administrativa não autorizada.');
  if(String(newPassphrase || '').length < 8) throw new Error('A nova chave precisa ter pelo menos 8 caracteres.');
  const snap = await get(dataRef);
  if(!snap.exists()) throw new Error('A base ainda não foi criada.');
  const payload = snap.val();
  const result = await unlockEnvelopeWithRecovery(payload, recoveryCode);
  dataKey = result.key;
  envelopeMeta = metaFromPayload(payload);
  lastCiphertext = payload.ciphertext;
  await rewrapPassphrase(newPassphrase);
  const updated = await encryptStateWithDataKey(result.state);
  emit('saving');
  await set(dataRef, updated);
  lastCiphertext = updated.ciphertext;
  startRemoteSync();
  emit('unlocked');
  emit('saved');
  return result.state;
}

async function rotateRecoveryCode(state){
  await flush();
  if(!dataKey || !envelopeMeta || !isAdmin(adminUser)) throw new Error('Base bloqueada.');
  const raw = await exportDataKey();
  const recoveryCode = randomRecoveryCode();
  const recoverySalt = crypto.getRandomValues(new Uint8Array(16));
  const recoveryWrapKey = await deriveWrappingKey(normalizeRecoveryCode(recoveryCode), recoverySalt);
  const wrapped = await wrapRawDataKey(raw, recoveryWrapKey, RECOVERY_WRAP_AAD);
  const oldMeta = {...envelopeMeta};
  try{
    envelopeMeta = {
      ...envelopeMeta,
      recoverySalt:bytesToBase64(recoverySalt),
      recoveryWrappedKey:bytesToBase64(wrapped.ciphertext),
      recoveryWrapIv:bytesToBase64(wrapped.iv)
    };
    const payload = await encryptStateWithDataKey(state);
    emit('saving');
    await set(dataRef, payload);
    lastCiphertext = payload.ciphertext;
    emit('saved');
    return recoveryCode;
  }catch(error){
    envelopeMeta = oldMeta;
    emit('error', {message:error?.message || 'Falha ao gerar recuperação'});
    throw error;
  }
}

function lock(){
  clearTimeout(saveTimer);
  saveTimer = null;
  pendingState = null;
  dataKey = null;
  envelopeMeta = null;
  lastCiphertext = '';
  if(remoteUnsubscribe){ remoteUnsubscribe(); remoteUnsubscribe = null; }
  emit('locked');
}

onAuthStateChanged(auth, user => {
  const hadAdmin = Boolean(adminUser);
  adminUser = isAdmin(user) ? user : null;
  if(!authInitialized){
    authInitialized = true;
    readyResolve({authenticated:Boolean(adminUser), user:adminUser});
  }
  if(hadAdmin && !adminUser){
    lock();
    window.dispatchEvent(new CustomEvent('codiguinhos-auth-lost'));
  }
  window.dispatchEvent(new CustomEvent('codiguinhos-cloud-ready'));
});

document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden' && pendingState) flush().catch(()=>{}); });
window.addEventListener('pagehide', () => { if(pendingState) flush().catch(()=>{}); });

window.CodiguinhosCloud = {
  inspect,
  unlock,
  create,
  scheduleSave,
  flush,
  changePassphrase,
  recoverAndChangePassphrase,
  rotateRecoveryCode,
  lock,
  isUnlocked:()=>Boolean(dataKey)
};
