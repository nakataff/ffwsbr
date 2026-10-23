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
function failure(status){return status===401?'unauthorized':status===403?'forbidden':status===429?'rate_limited':'unavailable';}
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
  const r=await request('https://oauth.livepix.gg/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:env.LIVEPIX_CLIENT_ID,client_secret:env.LIVEPIX_CLIENT_SECRET,scope:SCOPES}).toString(),redirect:'error',signal:AbortSignal.timeout(6000)});
  if(!r.ok){await r.body?.cancel();throw Error(failure(r.status));}
  const data=JSON.parse(await body(r));if(typeof data.access_token!=='string'||!data.access_token||!Number.isFinite(data.expires_in)||data.expires_in<1)throw Error('invalid');
  token=data.access_token;expiresAt=now()+Math.max(0,data.expires_in*1000-60000);return token;
 }
 async function campaign(){
  try{
   const r=await request(CAMPAIGN_URL,{redirect:'error',signal:AbortSignal.timeout(6000)});if(!r.ok){await r.body?.cancel();return {status:failure(r.status)};}
   const html=await body(r),raw=html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
   const props=JSON.parse(raw).props?.pageProps,c=props?.campaign;
   if(c?.slug!=='central-free-fire'||!/^[a-f0-9]{24}$/i.test(c.id)||!props.profile?.username)throw Error('invalid');
   const number=value=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<0)throw Error('invalid');return n;};
   return {status:'ok',id:c.id,slug:c.slug,owner:String(props.profile.username).slice(0,60),goalCents:number(c.goalAmount),collectedCents:number(c.amountCollected),contributions:number(c.contributionsCount)};
  }catch{return {status:'unavailable'};}
 }
 async function api(path,accessToken){
  try{
   const r=await request('https://api.livepix.gg/v2/'+path,{headers:{Authorization:'Bearer '+accessToken},redirect:'error',signal:AbortSignal.timeout(6000)});
   if(!r.ok){await r.body?.cancel();if(r.status===401){token=null;expiresAt=0;}return {status:failure(r.status)};}
   const data=JSON.parse(await body(r)).data;
   if(path==='account'){if(!data||typeof data.username!=='string')throw Error('invalid');return {status:'ok',username:data.username.slice(0,60)};}
   if(!Array.isArray(data))throw Error('invalid');return {status:'ok',rows:data.slice(0,LIMIT).filter(row=>row&&typeof row==='object'&&!Array.isArray(row))};
  }catch{return {status:'unavailable'};}
 }
 async function run(){
  const checkedAt=now(),base={ok:true,checkedAt,cacheUntil:checkedAt+TTL,automatic:false};
  if(!env.LIVEPIX_CLIENT_ID||!env.LIVEPIX_CLIENT_SECRET)return {...base,connection:'missing_secrets'};
  let accessToken;try{accessToken=await access();}catch(error){return {...base,connection:['unauthorized','forbidden','rate_limited'].includes(error.message)?error.message:'unavailable'};}
  const [account,publicCampaign,payments,messages]=await Promise.all([api('account',accessToken),campaign(),api('payments?page=1&limit='+LIMIT,accessToken),api('messages?page=1&limit='+LIMIT,accessToken)]);
  const summarize=result=>result.status!=='ok'?{status:result.status}:{status:'ok',checked:result.rows.length,named:result.rows.filter(row=>typeof row.username==='string'&&row.username.trim()).length,possibleCampaignMatches:result.rows.filter(row=>campaignMatch(row,publicCampaign.status==='ok'?publicCampaign:null)).length,campaignFields:linkedFields.filter(key=>result.rows.some(row=>Object.hasOwn(row,key)))};
  const accountMatchesCampaign=account.status==='ok'&&publicCampaign.status==='ok'?account.username.toLowerCase()===publicCampaign.owner.toLowerCase():null;
  const {id,owner,...safeCampaign}=publicCampaign;
  return {...base,connection:account.status==='ok'?'connected':account.status,account,campaign:safeCampaign,accountMatchesCampaign,payments:summarize(payments),messages:summarize(messages)};
 }
 return {async check(){
  if(cached&&now()<cached.cacheUntil)return {...cached,cached:true};
  if(pending)return pending;
  pending=run().then(result=>(cached=result,result)).finally(()=>{pending=null;});return pending;
 }};
}};
