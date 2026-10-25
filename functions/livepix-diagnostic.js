'use strict';
// Private, click-only diagnostic. No persistence, supporter publication or background polling.
const CAMPAIGN_URL='https://vaquinha.livepix.gg/central-free-fire';
const TTL=10*60*1000,SCOPES='account:read messages:read payments:read',LIMIT=20;
async function body(response){
 const reader=response.body?.getReader();if(!reader)throw Error('invalid');
 const chunks=[];let size=0;
 for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>180000){await reader.cancel();throw Error('invalid');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return new TextDecoder().decode(bytes);
}
function failure(status){return status>=300&&status<400?'redirected':status===401?'unauthorized':status===403?'forbidden':status===429?'rate_limited':'unavailable';}
const SAFE_CODES=new Set(['invalid_client','invalid_scope','invalid_request','unauthorized_client','unsupported_grant_type','invalid_grant','temporarily_unavailable','unauthorized','forbidden','rate_limited','unavailable','invalid_response','request_rejected','redirected']);
const issue=(code,httpStatus,reason)=>Object.assign(Error(code),{safeCode:code,httpStatus,reason});
const safeError=error=>({status:SAFE_CODES.has(error?.safeCode)?error.safeCode:['TimeoutError','AbortError'].includes(error?.name)?'timeout':'network_error',...(Number.isInteger(error?.httpStatus)&&error.httpStatus>=100&&error.httpStatus<=599?{httpStatus:error.httpStatus}:{}),...(['invalid_json','missing_access_token','invalid_expiry','invalid_account','invalid_list'].includes(error?.reason)?{reason:error.reason}:{})});
const linkedFields=['campaignId','crowdfundingId','campaign','crowdfunding','metadata'];
function campaignMatch(row,campaign){
 if(!campaign)return false;
 const matches=value=>typeof value==='string'&&[campaign.id,campaign.slug].includes(value);
 return ['campaignId','crowdfundingId','reference'].some(key=>matches(row[key]))||['campaign','crowdfunding','metadata'].some(key=>{const value=row[key];return matches(value)||(value&&typeof value==='object'&&['id','slug','campaignId','crowdfundingId'].some(k=>matches(value[k])));});
}
module.exports={create({env,fetch:request=globalThis.fetch,now=Date.now}){
 let token,expiresAt=0,pending,cached;
 async function access(){
  if(token&&now()<expiresAt)return token;
  const r=await request('https://oauth.livepix.gg/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:new URLSearchParams({grant_type:'client_credentials',client_id:String(env.LIVEPIX_CLIENT_ID).trim(),client_secret:String(env.LIVEPIX_CLIENT_SECRET).trim(),scope:SCOPES}).toString(),redirect:'manual',signal:AbortSignal.timeout(6000)});
  if(!r.ok){
   let code;try{const data=JSON.parse(await body(r));if([400,401,403,422].includes(r.status))code=[data.error,data.code].find(value=>SAFE_CODES.has(value));}catch{}
   throw issue(code||([400,422].includes(r.status)?'request_rejected':failure(r.status)),r.status);
  }
  let data;try{data=JSON.parse(await body(r));}catch{throw issue('invalid_response',r.status,'invalid_json');}
  if(typeof data?.access_token!=='string'||!data.access_token)throw issue('invalid_response',r.status,'missing_access_token');
  const lifetime=Number(data.expires_in);if(!Number.isFinite(lifetime)||lifetime<1)throw issue('invalid_response',r.status,'invalid_expiry');
  token=data.access_token;expiresAt=now()+Math.max(0,lifetime*1000-60000);return token;
 }
 async function campaign(){
  try{
   const r=await request(CAMPAIGN_URL,{redirect:'manual',signal:AbortSignal.timeout(6000)});if(!r.ok){await r.body?.cancel();return {status:failure(r.status)};}
   const html=await body(r),raw=html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
   const props=JSON.parse(raw).props?.pageProps,c=props?.campaign;
   if(c?.slug!=='central-free-fire'||!/^[a-f0-9]{24}$/i.test(c.id)||!props.profile?.username)throw Error('invalid');
   const number=value=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<0)throw Error('invalid');return n;};
   return {status:'ok',id:c.id,slug:c.slug,owner:String(props.profile.username).slice(0,60),goalCents:number(c.goalAmount),collectedCents:number(c.amountCollected),contributions:number(c.contributionsCount)};
  }catch{return {status:'unavailable'};}
 }
 async function api(path,accessToken){
  try{
   const r=await request('https://api.livepix.gg/v2/'+path,{headers:{Authorization:'Bearer '+accessToken,Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(6000)});
   if(!r.ok){await r.body?.cancel();if(r.status===401){token=null;expiresAt=0;}return {status:failure(r.status),httpStatus:r.status};}
   let data;try{data=JSON.parse(await body(r)).data;}catch{throw issue('invalid_response',r.status,'invalid_json');}
   if(path==='account'){if(!data||typeof data.username!=='string')throw issue('invalid_response',r.status,'invalid_account');return {status:'ok',username:data.username.slice(0,60)};}
   if(!Array.isArray(data))throw issue('invalid_response',r.status,'invalid_list');return {status:'ok',rows:data.slice(0,LIMIT).filter(row=>row&&typeof row==='object'&&!Array.isArray(row))};
  }catch(error){return safeError(error);}
 }
 async function run(){
  const checkedAt=now(),base={ok:true,diagnosticVersion:2,checkedAt,cacheUntil:checkedAt+TTL,automatic:false};
  if(!String(env.LIVEPIX_CLIENT_ID||'').trim()||!String(env.LIVEPIX_CLIENT_SECRET||'').trim())return {...base,connection:'missing_secrets'};
  let accessToken;try{accessToken=await access();}catch(error){const {status,...detail}=safeError(error);return {...base,connection:status,stage:'oauth',...detail};}
  const [account,publicCampaign,payments,messages]=await Promise.all([api('account',accessToken),campaign(),api('payments?page=1&limit='+LIMIT,accessToken),api('messages?page=1&limit='+LIMIT,accessToken)]);
  const summarize=result=>result.status!=='ok'?result:{status:'ok',checked:result.rows.length,named:result.rows.filter(row=>typeof row.username==='string'&&row.username.trim()).length,possibleCampaignMatches:result.rows.filter(row=>campaignMatch(row,publicCampaign.status==='ok'?publicCampaign:null)).length,campaignFields:linkedFields.filter(key=>result.rows.some(row=>Object.hasOwn(row,key)))};
  const accountMatchesCampaign=account.status==='ok'&&publicCampaign.status==='ok'?account.username.toLowerCase()===publicCampaign.owner.toLowerCase():null;
  const {id,owner,...safeCampaign}=publicCampaign;
  return {...base,connection:account.status==='ok'?'connected':account.status,...(account.status==='ok'?{}:{stage:'account',...(account.httpStatus?{httpStatus:account.httpStatus}:{}),...(account.reason?{reason:account.reason}:{})}),account,campaign:safeCampaign,accountMatchesCampaign,payments:summarize(payments),messages:summarize(messages)};
 }
 return {async check(){
  if(cached&&now()<cached.cacheUntil)return {...cached,cached:true};
  if(pending)return pending;
  pending=run().then(result=>(cached=result,result)).finally(()=>{pending=null;});return pending;
 }};
}};
