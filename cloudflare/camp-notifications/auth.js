const PROJECT = 'central-free-fire';
const KEY_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let cachedKeys = null, expires = 0, loading = null;
function decode(value) { return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0)); }
async function keys(fetcher) {
 if(cachedKeys && expires > Date.now()) return cachedKeys;
 if(!loading) loading=fetcher(KEY_URL).then(async response=>{
  if(!response.ok) throw Error('Não foi possível verificar o login.');
  const data=await response.json(); if(!Array.isArray(data.keys)) throw Error('Chaves de login indisponíveis.');
  cachedKeys=data.keys; expires=Date.now()+Math.min(3600,Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1])||300)*1000;
  return cachedKeys;
 }).finally(()=>loading=null);
 return loading;
}
export async function verifyToken(token, fetcher=fetch) {
 try {
  if(typeof token!=='string'||token.length>12000) throw Error();
  const parts=token.split('.'); if(parts.length!==3) throw Error();
  const header=JSON.parse(new TextDecoder().decode(decode(parts[0]))),claims=JSON.parse(new TextDecoder().decode(decode(parts[1]))),now=Math.floor(Date.now()/1000);
  if(header.alg!=='RS256'||!header.kid||claims.aud!==PROJECT||claims.iss!==`https://securetoken.google.com/${PROJECT}`||!claims.sub||claims.sub.length>128||!Number.isFinite(claims.exp)||claims.exp<=now||!Number.isFinite(claims.iat)||claims.iat>now+60||claims.auth_time>now+60) throw Error();
  const jwk=(await keys(fetcher)).find(k=>k.kid===header.kid); if(!jwk) throw Error();
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]))) throw Error();
  // Match the site's existing Firebase administrator account; Firebase ID tokens remain mandatory.
  return {uid:claims.sub,admin:claims.email==='admin@centralfreefire.com.br'};
 } catch { throw Object.assign(Error('Sessão expirada. Entre novamente com Google.'),{status:401}); }
}
