// Reuse the existing signed Firebase verifier; credentials never enter the URL of this API.
import {verifyToken} from '../camp-notifications/auth.js';
const BASE='https://central-free-fire-default-rtdb.firebaseio.com';
export function createPredictionIdentity({getCheckinSession,userKey,verify=verifyToken,fetcher=(...args)=>fetch(...args)}){
 return async function resolve(request,env,session){
  const header=request.headers.get('Authorization');
  if(!header)return session?getCheckinSession(env,session):null;
  const token=header.match(/^Bearer\s+(.+)$/i)?.[1];
  const user=await verify(token);
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(user.uid||'')||user.provider!=='google.com'&&!user.admin)throw Object.assign(Error('Entre com Google para participar.'),{status:401});
  async function read(path){const r=await fetcher(BASE+'/'+path+'.json?auth='+encodeURIComponent(token),{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok){if(r.status===401||r.status===403)return null;throw Object.assign(Error('Não foi possível conferir seu vínculo agora. Tente novamente.'),{status:503});}return r.json();}
  // Resolve this UID's saved session on other devices, without scanning the account directory.
  const saved=await read('userAccounts/'+encodeURIComponent(user.uid)+'/community/session');
  if(typeof saved==='string'&&/^[a-f0-9]{48}$/i.test(saved)){const linked=await getCheckinSession(env,saved);if(linked?.verified_at&&linked.user_key)return linked;}
  const owner=await read('communityOwnerInstagram');
  if(owner?.uid!==user.uid||owner.username!=='nakataff')return null;
  // Keep the same historical interaction identity for the page owner's special link.
  const matches=await env.DB.prepare('SELECT user_key FROM users WHERE username = ?1 COLLATE NOCASE LIMIT 2').bind('nakataff').all();
  if(matches.results?.length>1)throw Object.assign(Error('O vínculo da conta precisa de revisão pela administração.'),{status:409});
  return {verified_at:owner.linkedAt||1,user_key:matches.results?.[0]?.user_key||await userKey('','nakataff'),username:'nakataff',instagram_id:''};
 };
}
