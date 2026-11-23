import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import {getAuth,onAuthStateChanged,setPersistence,browserLocalPersistence,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import {getDatabase,ref,get,runTransaction} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';
import {PATH} from './home-promos-model.mjs?v=20261123-admin-v1';
import {createPromoStore} from './promo-store.mjs?v=1';
import {mountPromoEditor} from './promo-editor.mjs?v=1';
const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp(window.CFF_CONFIG.firebase),auth=getAuth(app),db=getDatabase(app),ADMIN='admin@centralfreefire.com.br',$=s=>document.querySelector(s);
let cleanup,sequence=0;
$('#publi-login-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;try{await signInWithEmailAndPassword(auth,ADMIN,event.currentTarget.elements.password.value);event.target.reset();}catch{$('#publi-login-message').textContent='Não foi possível entrar. Confira sua senha administrativa.';}finally{button.disabled=false;}});
$('#publi-logout').addEventListener('click',()=>signOut(auth));
setPersistence(auth,browserLocalPersistence).then(()=>onAuthStateChanged(auth,user=>{
 sequence++;cleanup?.();cleanup=null;const allowed=user?.email===ADMIN;$('#publi-login').hidden=allowed;$('#publi-dashboard').hidden=!allowed;$('#publi-logout').hidden=!allowed;if(!allowed)return;
 const request=sequence,valid=()=>sequence===request&&auth.currentUser?.uid===user.uid;
 const store=createPromoStore({read:()=>get(ref(db,PATH)).then(snapshot=>snapshot.val()),transaction:async update=>{const result=await runTransaction(ref(db,PATH),update,{applyLocally:false});return{committed:result.committed,value:result.snapshot.val()};}});
 cleanup=mountPromoEditor({root:$('#publi-editor'),store,valid});
})).catch(()=>$('#publi-login-message').textContent='Não foi possível preparar o acesso. Atualize a página.');
