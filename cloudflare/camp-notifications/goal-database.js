const BASE='https://central-free-fire-default-rtdb.firebaseio.com';
let cachedToken=null,tokenPending=null;
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
async function accessToken(secret){
 if(cachedToken&&cachedToken.until>Date.now())return cachedToken.value;
 if(tokenPending)return tokenPending;
 tokenPending=(async()=>{
  let account;try{account=JSON.parse(secret||'');}catch{throw Error('Serviço de recompensas ainda em configuração.');}
  if(account.project_id!=='central-free-fire'||!account.client_email||!account.private_key)throw Error('Credencial do serviço de recompensas inválida.');
  const encoder=new TextEncoder(),stamp=Math.floor(Date.now()/1000),header=b64(encoder.encode(JSON.stringify({alg:'RS256',typ:'JWT'}))),payload=b64(encoder.encode(JSON.stringify({iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',aud:'https://oauth2.googleapis.com/token',iat:stamp,exp:stamp+3600})));
  const pem=account.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,''),bytes=Uint8Array.from(atob(pem),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('pkcs8',bytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const message=header+'.'+payload,signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(message));
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:message+'.'+b64(new Uint8Array(signature))}),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('Não foi possível autenticar o serviço de recompensas.');
  const token=await response.json();if(!token.access_token)throw Error('Serviço de recompensas indisponível.');
  cachedToken={value:token.access_token,until:Date.now()+Math.max(60,Number(token.expires_in||3600)-120)*1000};return cachedToken.value;
 })();try{return await tokenPending;}finally{tokenPending=null;}
}
export function goalDatabase(secret){
 const request=async(path,options={})=>{const token=await accessToken(secret);const response=await fetch(BASE+'/'+path.split('/').map(encodeURIComponent).join('/')+'.json',{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('Não foi possível atualizar as recompensas agora.');return response.json();};
 return {get:path=>request(path),update:changes=>request('',{method:'PATCH',body:JSON.stringify(changes)}),async claimDirectory(path,uid,entry){
  const token=await accessToken(secret),url=BASE+'/'+path.split('/').map(encodeURIComponent).join('/')+'.json';
  for(let attempt=0;attempt<3;attempt++){
   const current=await fetch(url,{headers:{Authorization:'Bearer '+token,'X-Firebase-ETag':'true'},signal:AbortSignal.timeout(8000)});
   if(!current.ok)throw Error('Não foi possível conferir o perfil no ranking.');
   const value=await current.json();if(value?.uid&&value.uid!==uid)return false;
   if(JSON.stringify(value)===JSON.stringify(entry))return true;
   const etag=current.headers.get('ETag');if(!etag)throw Error('Não foi possível sincronizar o perfil com segurança.');
   const saved=await fetch(url,{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','If-Match':etag},body:JSON.stringify(entry),signal:AbortSignal.timeout(8000)});
   if(saved.status===412)continue;
   if(!saved.ok)throw Error('Não foi possível sincronizar o perfil no ranking.');return true;
  }
  throw Error('O perfil está sendo atualizado. Tente novamente.');
 }};
}
