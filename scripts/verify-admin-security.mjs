import {pathToFileURL} from 'node:url';
import {goalDatabase} from '../cloudflare/camp-notifications/goal-database.js';
export function assertPinnedRules(document){
 const rules=document?.rules;
 if(rules?.['.read']!==false||rules?.['.write']!==false||rules.serverSecurity?.['.read']!==false||rules.serverSecurity?.['.write']!==false)throw Error('Private security policy is not locked.');
 let count=0;
 function visit(node){for(const value of Object.values(node||{})){if(value&&typeof value==='object')visit(value);else if(typeof value==='string'&&value.includes('auth.token.email')&&value.includes('admin@centralfreefire.com.br')){if(!value.includes("root.child('serverSecurity').child('adminUid').val()"))throw Error('Email-only administrator rule found.');count++;}}}
 visit(rules);if(count<1)throw Error('Administrator rules not found.');return count;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const db=goalDatabase(process.env.FIREBASE_SERVICE_ACCOUNT),rules=await db.get('.settings/rules');const count=assertPinnedRules(rules);console.log('Deployed database security verified: '+count+' administrator conditions require the pinned UID.');}
 catch{console.error('Could not verify deployed administrator rules.');process.exitCode=1;}
}
