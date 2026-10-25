import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';

const ADMIN='admin@centralfreefire.com.br';
const overlay=document.getElementById('cff-camp-auth');
const config=window.CFF_CONFIG?.firebase;

function fail(message){
  if(overlay){
    const status=overlay.querySelector('[data-cff-auth-status]');
    if(status) status.textContent=message;
  }
}

if(!config){
  fail('Configuração do painel indisponível.');
}else{
  const app=getApps().length?getApp():initializeApp(config);
  const auth=getAuth(app);
  onAuthStateChanged(auth,user=>{
    if(!user||String(user.email||'').toLowerCase()!==ADMIN){
      location.replace('admin.html');
      return;
    }
    document.body.classList.remove('cff-auth-pending');
    if(overlay) overlay.hidden=true;
    document.querySelector('.cff-camp-topbar')?.removeAttribute('hidden');
  },()=>fail('Não foi possível validar a sessão.'));
}
