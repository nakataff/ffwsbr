import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import { getDatabase, ref, get, set, onValue, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';

const ADMIN_EMAIL = 'admin@centralfreefire.com.br';
const DB_PATH = 'adminCodiguinhos';
const FORMAT_VERSION = 1;
const KDF_ITERATIONS = 250000;
const AAD = new TextEncoder().encode('central-free-fire/admin-codiguinhos/v1');
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
let cryptoKey = null;
let saltBytes = null;
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

async function deriveKey(passphrase, salt){
  if(!window.crypto?.subtle) throw new Error('Seu navegador não oferece Web Crypto nesta conexão. Use HTTPS.');
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2', salt, iterations:KDF_ITERATIONS, hash:'SHA-256'},
    material,
    {name:'AES-GCM', length:256},
    false,
    ['encrypt','decrypt']
  );
}

function validatePayload(payload){
  if(!payload || Number(payload.v) !== FORMAT_VERSION || payload.alg !== 'AES-GCM' || !payload.salt || !payload.iv || !payload.ciphertext){
    throw new Error('Formato criptografado não reconhecido.');
  }
}

async function decryptPayload(payload, keyOverride=null){
  validatePayload(payload);
  const key = keyOverride || cryptoKey;
  if(!key) throw new Error('Base ainda está bloqueada.');
  const plain = await crypto.subtle.decrypt(
    {name:'AES-GCM', iv:base64ToBytes(payload.iv), additionalData:AAD},
    key,
    base64ToBytes(payload.ciphertext)
  );
  return JSON.parse(decoder.decode(plain));
}

async function encryptState(state, key=cryptoKey, salt=saltBytes){
  if(!key || !salt) throw new Error('Chave de criptografia não carregada.');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = encoder.encode(JSON.stringify(state));
  const cipher = await crypto.subtle.encrypt({name:'AES-GCM', iv, additionalData:AAD}, key, plain);
  return {
    v:FORMAT_VERSION,
    alg:'AES-GCM',
    kdf:'PBKDF2-SHA-256',
    iterations:KDF_ITERATIONS,
    salt:bytesToBase64(salt),
    iv:bytesToBase64(iv),
    ciphertext:bytesToBase64(new Uint8Array(cipher)),
    updatedAt:serverTimestamp(),
    updatedBy:adminUser?.email || ADMIN_EMAIL,
    clientId
  };
}

async function inspect(){
  await readyPromise;
  if(!isAdmin(adminUser)) return {authenticated:false, hasData:false};
  const snap = await get(dataRef);
  return {authenticated:true, hasData:snap.exists(), metadata:snap.exists() ? {updatedAt:snap.val()?.updatedAt || null} : null};
}

function startRemoteSync(){
  if(remoteUnsubscribe) remoteUnsubscribe();
  remoteUnsubscribe = onValue(dataRef, async snap => {
    if(!snap.exists() || !cryptoKey) return;
    const payload = snap.val();
    if(payload.ciphertext === lastCiphertext || payload.clientId === clientId) return;
    try{
      const incomingSalt = base64ToBytes(payload.salt);
      if(bytesToBase64(incomingSalt) !== bytesToBase64(saltBytes)){
        emit('error', {message:'A chave da base mudou em outra sessão. Recarregue a página.'});
        return;
      }
      const state = await decryptPayload(payload);
      lastCiphertext = payload.ciphertext;
      window.dispatchEvent(new CustomEvent('codiguinhos-remote-state', {detail:{state, updatedAt:payload.updatedAt || null}}));
    }catch(error){
      console.warn('Não foi possível aplicar atualização remota dos codiguinhos', error);
    }
  });
}

async function unlock(passphrase){
  await readyPromise;
  if(!isAdmin(adminUser)) throw new Error('Sessão administrativa não autorizada.');
  const snap = await get(dataRef);
  if(!snap.exists()) throw new Error('A base ainda não foi criada.');
  const payload = snap.val();
  validatePayload(payload);
  const salt = base64ToBytes(payload.salt);
  const key = await deriveKey(passphrase, salt);
  let state;
  try{ state = await decryptPayload(payload, key); }
  catch(error){ throw new Error('Não foi possível descriptografar. Confira a chave.'); }
  cryptoKey = key;
  saltBytes = salt;
  lastCiphertext = payload.ciphertext;
  startRemoteSync();
  emit('unlocked');
  return state;
}

async function create(passphrase, state){
  await readyPromise;
  if(!isAdmin(adminUser)) throw new Error('Sessão administrativa não autorizada.');
  const existing = await get(dataRef);
  if(existing.exists()) throw new Error('Já existe uma base de codiguinhos no Firebase. Desbloqueie-a em vez de criar outra.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  const payload = await encryptState(state, key, salt);
  await set(dataRef, payload);
  cryptoKey = key;
  saltBytes = salt;
  lastCiphertext = payload.ciphertext;
  startRemoteSync();
  emit('saved');
  return state;
}

async function saveNow(state){
  if(!cryptoKey || !isAdmin(adminUser)) throw new Error('Base bloqueada.');
  emit('saving');
  const payload = await encryptState(state);
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

async function changePassphrase(newPassphrase, state){
  await flush();
  if(!cryptoKey || !isAdmin(adminUser)) throw new Error('Base bloqueada.');
  const oldKey = cryptoKey;
  const oldSalt = saltBytes;
  try{
    const newSalt = crypto.getRandomValues(new Uint8Array(16));
    const newKey = await deriveKey(newPassphrase, newSalt);
    const payload = await encryptState(state, newKey, newSalt);
    emit('saving');
    await set(dataRef, payload);
    cryptoKey = newKey;
    saltBytes = newSalt;
    lastCiphertext = payload.ciphertext;
    emit('saved');
  }catch(error){
    cryptoKey = oldKey;
    saltBytes = oldSalt;
    emit('error', {message:error?.message || 'Falha ao trocar chave'});
    throw error;
  }
}

function lock(){
  clearTimeout(saveTimer);
  saveTimer = null;
  pendingState = null;
  cryptoKey = null;
  saltBytes = null;
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

window.CodiguinhosCloud = {inspect, unlock, create, scheduleSave, flush, changePassphrase, lock, isUnlocked:()=>Boolean(cryptoKey)};
