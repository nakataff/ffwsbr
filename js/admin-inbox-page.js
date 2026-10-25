import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import {mountInboxAdmin} from './admin-inbox.mjs?v=20261023-inbox-alerts-v1';
const app=getApps().find(a=>a.name==='[DEFAULT]')||initializeApp(window.CFF_CONFIG.firebase),auth=getAuth(app),root=document.getElementById('inbox-admin-root'),status=document.getElementById('inbox-admin-status');let stop;
onAuthStateChanged(auth,user=>{stop?.();stop=null;root.hidden=true;if(user?.email!=='admin@centralfreefire.com.br'){status.textContent='Entre com a conta administrativa pelo painel principal.';return;}stop=mountInboxAdmin(root,status,{auth});});
