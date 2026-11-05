// Runs only in deployment with the existing service account, never in a browser.
import {appendFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {goalDatabase} from '../cloudflare/camp-notifications/goal-database.js';
export const ADMIN_EMAIL='admin@centralfreefire.com.br';
export async function bootstrapAdminIdentity(db){
 const account=await db.accountByEmail(ADMIN_EMAIL);
 if(!account||account.email!==ADMIN_EMAIL||account.disabled||!/^[A-Za-z0-9_-]{1,128}$/.test(account.uid||''))throw Error('Existing administrator identity could not be verified; deployment stopped.');
 const pinned=await db.get('serverSecurity/adminUid');
 if(pinned&&pinned!==account.uid)throw Error('Administrator UID changed; deployment stopped for manual recovery.');
 if(!pinned){
  await db.update({'serverSecurity/adminUid':account.uid});
  if(await db.get('serverSecurity/adminUid')!==account.uid)throw Error('Administrator identity could not be pinned.');
 }
 return account.uid;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(!process.env.GITHUB_OUTPUT)throw Error('Deployment output is unavailable.');
  const uid=await bootstrapAdminIdentity(goalDatabase(process.env.FIREBASE_SERVICE_ACCOUNT));
  await appendFile(process.env.GITHUB_OUTPUT,'admin_uid='+uid+'\n');
  console.log('Existing administrator UID verified and pinned; current sign-in method preserved.');
 }catch{console.error('Administrator identity verification failed. No rules or Worker deployment should proceed.');process.exitCode=1;}
}
