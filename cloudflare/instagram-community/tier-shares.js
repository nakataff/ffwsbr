/* Compartilhamento curto do Tier Constructor.
 * O payload continua no formato #tier= legado, mas o endereço público usa apenas #s=<id>.
 * Links são públicos para quem conhece o código; nunca armazenar tokens ou sessões.
 */
export const TIER_SHARE_VERSION='20261104-short-v1';
export const TIER_SHARE_LIFETIME_MS=365*24*60*60*1000;
export const TIER_SHARE_MAX_ENCODED=1_500_000;
export const TIER_SHARE_SCHEMA=[
  'CREATE TABLE IF NOT EXISTS tier_share_links (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS idx_tier_share_links_expiry ON tier_share_links(expires_at)',
  'CREATE TABLE IF NOT EXISTS tier_share_rate (ip_hash TEXT NOT NULL, day_key TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (ip_hash,day_key))'
];
const ALLOWED=new Set(['https://centralfreefire.com.br','https://www.centralfreefire.com.br']);
const idPattern=/^[a-zA-Z0-9_-]{12}$/;
const encodedPattern=/^[gr]\.[A-Za-z0-9_-]+$/;
const encoder=new TextEncoder();
const reply=(request,responseData,status=200)=>new Response(JSON.stringify(responseData),{
  status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    'Access-Control-Allow-Origin':ALLOWED.has(request.headers.get('Origin'))?request.headers.get('Origin'):'https://centralfreefire.com.br',
    'Vary':'Origin'}
});
const error=(request,message,status)=>reply(request,{ok:false,error:message},status);
function decodeBase64Url(value){
  const base64=value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4);
  const decoded=atob(base64);
  return Uint8Array.from(decoded,ch=>ch.charCodeAt(0));
}
async function validateTierPayload(payload){
  if(typeof payload!=='string'||payload.length<12||payload.length>TIER_SHARE_MAX_ENCODED||!encodedPattern.test(payload))return false;
  const mode=payload.slice(0,1);
  let decoded;
  try{
    const bytes=decodeBase64Url(payload.slice(2));
    if(mode==='g'){
      if(bytes[0]!==0x1f||bytes[1]!==0x8b)return false;
      const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
      const chunks=[];let total=0;
      try{
        while(true){
          const {done,value}=await reader.read();
          if(done)break;
          total+=value.byteLength;
          if(total>2_000_000){await reader.cancel();return false;}
          chunks.push(value);
        }
      }finally{reader.releaseLock();}
      const buffer=new Uint8Array(total);let offset=0;
      for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}
      decoded=new TextDecoder('utf-8',{fatal:true}).decode(buffer);
    }else{
      if(bytes.length>2_000_000)return false;
      decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    }
    const project=JSON.parse(decoded);
    return project?.version===1 && project?.state && typeof project.state==='object'
      && Array.isArray(project.state.rows) && project.state.images && typeof project.state.images==='object'
      && !Array.isArray(project.state.images);
  }catch{return false;}
}
async function quotaKey(request,day){
  const ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const digest=await crypto.subtle.digest('SHA-256',encoder.encode(day+':'+ip));
  return Array.from(new Uint8Array(digest)).slice(0,16).map(v=>v.toString(16).padStart(2,'0')).join('');
}
export async function createTierShare(request,env){
  const origin=request.headers.get('Origin');
  if(!ALLOWED.has(origin))return error(request,'Origem não autorizada para criar links.',403);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))return error(request,'Envie JSON.',415);
  if(Number(request.headers.get('Content-Length')||0)>TIER_SHARE_MAX_ENCODED+1000)return error(request,'Projeto grande demais para compartilhar. Baixe o JSON.',413);
  let body;try{body=await request.text();}catch{return error(request,'Falha ao receber o projeto.',400);}
  if(body.length>TIER_SHARE_MAX_ENCODED+1000)return error(request,'Projeto grande demais para compartilhar. Baixe o JSON.',413);
  let payload;try{payload=JSON.parse(body)?.payload;}catch{return error(request,'Dados de compartilhamento inválidos.',400);}
  if(!await validateTierPayload(payload))return error(request,'Projeto incompatível ou grande demais. Baixe o JSON.',413);
  if(!env.DB)return error(request,'Compartilhamento indisponível.',503);
  const now=Date.now(),day=new Date(now).toISOString().slice(0,10),hash=await quotaKey(request,day);
  try{
    const quota=await env.DB.prepare(
      'INSERT INTO tier_share_rate (ip_hash,day_key,count) VALUES (?1,?2,1) ON CONFLICT(ip_hash,day_key) DO UPDATE SET count=count+1 WHERE count<60'
    ).bind(hash,day).run();
    if(quota.meta?.changes!==1)return error(request,'Limite de compartilhamentos por dia atingido. Tente amanhã.',429);
    for(let tries=0;tries<4;tries++){
      const bytes=crypto.getRandomValues(new Uint8Array(9));
      const id=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      const inserted=await env.DB.prepare(
        'INSERT OR IGNORE INTO tier_share_links (id,payload,created_at,expires_at) VALUES (?1,?2,?3,?4)'
      ).bind(id,payload,now,now+TIER_SHARE_LIFETIME_MS).run();
      if(inserted.meta?.changes===1)return reply(request,{ok:true,id,expiresAt:now+TIER_SHARE_LIFETIME_MS},201);
    }
    return error(request,'Não foi possível reservar o link. Tente novamente.',503);
  }catch(err){console.error('Tier share create',err);return error(request,'Serviço de links indisponível. Tente novamente.',503);}
}
export async function getTierShare(request,env,id){
  if(!idPattern.test(id||''))return error(request,'Código de compartilhamento inválido.',400);
  if(!env.DB)return error(request,'Compartilhamento indisponível.',503);
  try{
    const row=await env.DB.prepare(
      'SELECT payload,expires_at FROM tier_share_links WHERE id=?1 AND expires_at>?2'
    ).bind(id,Date.now()).first();
    if(!row)return error(request,'Link não encontrado ou expirado.',404);
    return reply(request,{ok:true,payload:row.payload,expiresAt:row.expires_at},200);
  }catch(err){console.error('Tier share fetch',err);return error(request,'Não foi possível carregar a tier.',503);}
}
export async function purgeExpiredTierShares(db,now=Date.now()){
  await db.prepare('DELETE FROM tier_share_links WHERE expires_at<=?1').bind(now).run();
  await db.prepare('DELETE FROM tier_share_rate WHERE day_key<?1').bind(new Date(now-2*24*60*60*1000).toISOString().slice(0,10)).run();
}
