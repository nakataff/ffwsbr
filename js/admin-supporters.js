import {mountSupportersAdmin} from './supporters-admin.mjs?v=20261023-livepix-test-v2';
import {careerAdmin,esc} from './career-client.mjs?v=20261018-career-chronology-v2';
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import {getAuth,onAuthStateChanged,setPersistence,browserLocalPersistence,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp(window.CFF_CONFIG.firebase),auth=getAuth(app),ADMIN='admin@centralfreefire.com.br',$=s=>document.querySelector(s);
let cleanup,sequence=0;
$('#supporters-login-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;try{await signInWithEmailAndPassword(auth,ADMIN,$('#supporters-password').value);$('#supporters-password').value='';}catch{$('#supporters-login-message').textContent='Não foi possível entrar. Confira a senha.';}finally{button.disabled=false;}});
$('#supporters-logout').addEventListener('click',()=>signOut(auth));
setPersistence(auth,browserLocalPersistence).then(()=>onAuthStateChanged(auth,user=>{sequence++;cleanup?.();cleanup=null;const allowed=user?.email===ADMIN;$('#supporters-login').hidden=allowed;$('#supporters-dashboard').hidden=!allowed;$('#supporters-logout').hidden=!allowed;if(!allowed)return;const request=sequence;cleanup=mountSupportersAdmin({root:$('#supporters-editor'),call:(operation,body)=>careerAdmin(auth,operation,body),valid:()=>sequence===request&&auth.currentUser?.email===ADMIN,esc});})).catch(()=>$('#supporters-login-message').textContent='Não foi possível preparar o acesso. Atualize a página.');
