// Ephemeral, private story thumbnails. Never archive originals, videos, or expired media.
import {storyImage} from './story-reviews.js';
export const STORY_PREVIEW_SCHEMA=[
 'CREATE TABLE IF NOT EXISTS story_thumbnails (mention_key TEXT PRIMARY KEY, image_b64 TEXT NOT NULL, mime TEXT NOT NULL, expires_at INTEGER NOT NULL)',
 'CREATE INDEX IF NOT EXISTS idx_story_thumbnails_expiry ON story_thumbnails(expires_at)'
];
const MAX_BYTES=36*1024;
export const expiresForWeek=week=>{
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(week||''))return 0;
 // Week Monday 00h -> next Tuesday 00h, America/Sao_Paulo (UTC-3, no DST).
 const start=Date.parse(week+'T03:00:00Z');
 return Number.isFinite(start)?start+8*86400000:0;
};
async function boundedBytes(response,limit=MAX_BYTES){
 const length=Number(response.headers.get('content-length')||0);
 if(length>limit)return null;
 if(!response.body)return null;
 const reader=response.body.getReader(),chunks=[];let bytes=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>limit){await reader.cancel();return null;}chunks.push(value);} }
 finally{reader.releaseLock();}
 const result=new Uint8Array(bytes);let offset=0;for(const part of chunks){result.set(part,offset);offset+=part.length;}return result;
}
export const isWebp=bytes=>bytes?.length>16&&String.fromCharCode(...bytes.subarray(0,4))==='RIFF'&&String.fromCharCode(...bytes.subarray(8,12))==='WEBP';
// Capture only short-lived, small thumbnails. The source is never stored.
const MAX_SOURCE_BYTES=3*1024*1024;
function checkPreview(response,report){
 if(!response?.ok){report.reason='image_http_'+String(response?.status||0);return false;}
 if(!response.headers.get('content-type')?.toLowerCase().startsWith('image/webp')){
  report.reason='no_webp_conversion';return false;
 }
 return true;
}
async function transformedPreview(env,url,fetchImage,report){
 if(!env.IMAGES){
  // Older fixtures and deployments without the binding keep the existing path.
  const response=await fetchImage(url,{signal:AbortSignal.timeout(8500),
   cf:{image:{width:240,height:427,fit:'scale-down',quality:30,format:'webp',anim:false}},
   headers:{Accept:'image/webp'}});
  if(!checkPreview(response,report))return null;
  const result=await boundedBytes(response);
  if(!result){report.reason='thumbnail_too_large';return null;}
  if(!isWebp(result)){report.reason='invalid_webp';return null;}
  return result;
 }
 // The Meta CDN usually returns JPEG; fetch(cf.image) can leave it unchanged.
 // Transform actual image bytes through the Cloudflare Images binding instead.
 let sourceUrl=url,response;
 for(let redirect=0;redirect<=2;redirect++){
  response=await fetchImage(sourceUrl,{signal:AbortSignal.timeout(8500),redirect:'manual',headers:{Accept:'image/*'}});
  if(response.status>=300&&response.status<400){
   const next=response.headers.get('location');
   if(!next){report.reason='source_redirect';return null;}
   let resolved;try{resolved=new URL(next,sourceUrl).href;}catch{report.reason='source_redirect';return null;}
   if(!storyImage(resolved)){report.reason='unsafe_redirect';return null;}
   if(redirect===2){report.reason='source_redirect_limit';return null;}
   sourceUrl=resolved;continue;
  }
  break;
 }
 if(!response?.ok){report.reason='source_http_'+String(response?.status||0);return null;}
 const type=(response.headers.get('content-type')||'').toLowerCase();
 if(!/^image\/(?:jpeg|png|webp|avif)(?:\s*;|$)/.test(type)){
  report.reason='unsupported_source';return null;
 }
 const raw=await boundedBytes(response,MAX_SOURCE_BYTES);
 if(!raw){report.reason='source_too_large';return null;}
 // A tiny WebP may already satisfy the target. Avoid an Images transformation.
 if(type.startsWith('image/webp')&&isWebp(raw)&&raw.length<=MAX_BYTES)return raw;
 const sizes=[[240,427,30],[192,341,25]];
 for(const [width,height,quality] of sizes){
  const result=await env.IMAGES.input(raw).transform({width,height,fit:'scale-down'})
   .output({format:'image/webp',quality,anim:false});
  const converted=result.response();
  if(!checkPreview(converted,report))return null;
  const small=await boundedBytes(converted);
  if(small&&isWebp(small))return small;
 }
 report.reason='thumbnail_too_large';
 return null;
}
export async function storeStoryPreview(env,row,{fetchImage=fetch,now=Date.now(),report={}}={}){
 const url=storyImage(row?.media_url),expiry=expiresForWeek(row?.week_key);
 if(!url){report.reason='missing_media_url';return false;}
 if(!expiry||expiry<=now){report.reason='expired';return false;}
 if(!Number.isFinite(Number(row.event_at))||now-row.event_at>24*3600000||row.event_at>now+300000){
  report.reason='source_too_old';return false;
 }
 if(!['approved','pending'].includes(row.status)){report.reason='invalid_status';return false;}
 if(!/^story:/.test(row.mention_key||'')){report.reason='invalid_story';return false;}
 try{
  const bytes=await transformedPreview(env,url,fetchImage,report);
  if(!bytes)return false;
  const b64=btoa(String.fromCharCode(...bytes));
  const result=await env.DB.prepare('INSERT OR IGNORE INTO story_thumbnails(mention_key,image_b64,mime,expires_at) VALUES(?1,?2,?3,?4)')
   .bind(row.mention_key,b64,'image/webp',expiry).run();
  report.reason='saved';report.inserted=Boolean(result.meta?.changes);
  return true;
 }catch(error){
  report.reason='storage_or_conversion_failed';
  console.warn('[story-preview] failure',String(error?.message||error).slice(0,180));
  return false;
 }
}
export async function purgeExpiredStoryPreviews(db,now=Date.now()){
 // Only media is deleted. Ranking, moderation and audit records remain unchanged.
 return db.prepare('DELETE FROM story_thumbnails WHERE expires_at<=?1').bind(now).run();
}
const encoder=new TextEncoder();
let cachedKey=null,cachedSecret='';
async function signingKey(secret){
 if(!secret)return null;
 if(!cachedKey||cachedSecret!==secret){cachedKey=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);cachedSecret=secret;}
 return cachedKey;
}
const hex=bytes=>[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
async function signature(key,expiry,secret){
 const cryptoKey=await signingKey(secret);if(!cryptoKey)return '';
 return hex(await crypto.subtle.sign('HMAC',cryptoKey,encoder.encode(key+'|'+expiry)));
}
export async function previewLink(key,expiry,secret,now=Date.now()){
 const deadline=Math.min(expiry,now+3600000);
 if(!key||deadline<=now)return '';
 const signatureText=await signature(key,deadline,secret);
 return signatureText?'/api/admin/story-preview?key='+encodeURIComponent(key)+'&expires='+deadline+'&sig='+signatureText:'';
}
export async function getSignedStoryPreview(request,env,url,{now=Date.now()}={}){
 const key=url.searchParams.get('key')||'',expiry=Number(url.searchParams.get('expires')||0),provided=url.searchParams.get('sig')||'';
 if(!/^story:[A-Za-z0-9:_-]{4,250}$/.test(key)||!Number.isSafeInteger(expiry)||expiry<=now||expiry>now+3600000||!/^[0-9a-f]{64}$/.test(provided))return new Response(null,{status:403});
 const expected=await signature(key,expiry,env.META_APP_SECRET);
 if(!expected||expected.length!==provided.length||[...expected].reduce((diff,c,i)=>diff|(c.charCodeAt(0)^provided.charCodeAt(i)),0)!==0)return new Response(null,{status:403});
 const record=await env.DB.prepare('SELECT image_b64,mime,expires_at FROM story_thumbnails WHERE mention_key=?1 AND expires_at>?2').bind(key,now).first();
 if(!record||record.expires_at<expiry)return new Response(null,{status:404});
 const bytes=Uint8Array.from(atob(record.image_b64),c=>c.charCodeAt(0));
 if(!isWebp(bytes))return new Response(null,{status:404});
 return new Response(bytes,{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'cross-origin','Access-Control-Allow-Origin':'https://centralfreefire.com.br','Vary':'Origin'}});
}
