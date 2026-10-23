const {test}=require('node:test'),assert=require('node:assert/strict'),{create}=require('../livepix-diagnostic');
const campaignId='a'.repeat(24),env={LIVEPIX_CLIENT_ID:'private-client-id',LIVEPIX_CLIENT_SECRET:'private-client-secret'};
function fixture({responses={},secret=env}={}){
 let stamp=100000;const calls=[];
 const fetch=async(url,options)=>{
  calls.push({url,options});if(responses[url])return responses[url](options);
  if(url==='https://oauth.livepix.gg/oauth2/token')return Response.json({access_token:'private-access-token',expires_in:3600});
  if(url==='https://vaquinha.livepix.gg/central-free-fire')return new Response('<script id="__NEXT_DATA__" type="application/json">'+JSON.stringify({props:{pageProps:{campaign:{id:campaignId,slug:'central-free-fire',goalAmount:'12500',amountCollected:'6300',contributionsCount:4},profile:{username:'nakataff'}}}})+'</script>');
  if(url==='https://api.livepix.gg/v2/account')return Response.json({data:{username:'nakataff',email:'private@example.test',id:'private-user-id'}});
  if(url.includes('/v2/payments?'))return Response.json({data:[{id:'private-payment',proof:'private-proof',reference:campaignId,amount:3000,username:'Not a public supporter'}]});
  if(url.includes('/v2/messages?'))return Response.json({data:[{username:'private-supporter',message:'private-message',campaignId,amount:3000},{username:'Other donation',reference:'other-campaign'}]});
  throw Error('Unexpected URL '+url);
 };
 return {calls,check:create({env:secret,fetch,now:()=>stamp}).check,advance:ms=>stamp+=ms};
}
test('click-only diagnostic reuses a single OAuth token, limits read-only samples and never returns private records',async()=>{
 const f=fixture();assert.equal(f.calls.length,0);const r=await f.check();assert.equal(r.connection,'connected');assert.equal(r.automatic,false);assert.equal(r.accountMatchesCampaign,true);assert.equal(r.campaign.collectedCents,6300);assert.equal(r.messages.named,2);assert.equal(r.messages.possibleCampaignMatches,1);assert.equal(r.payments.possibleCampaignMatches,1);assert.deepEqual(r.messages.campaignFields,['campaignId']);assert.equal(f.calls.length,5);
 const auth=f.calls[0],params=new URLSearchParams(auth.options.body);assert.equal(params.get('client_secret'),env.LIVEPIX_CLIENT_SECRET);assert.equal(params.get('grant_type'),'client_credentials');assert.deepEqual(params.get('scope').split(' '),['account:read','messages:read','payments:read']);
 for(const c of f.calls){assert(c.options.signal);assert.equal(c.options.redirect,'error');if(c.url.includes('/v2/')){assert.equal(c.options.method,undefined);assert.equal(c.options.headers.Authorization,'Bearer private-access-token');if(!c.url.endsWith('/account')){assert.equal(new URL(c.url).searchParams.get('limit'),'20');assert.equal(new URL(c.url).searchParams.get('page'),'1');}}}
 const safe=JSON.stringify(r);for(const value of ['private-client','private-access','private-user','private-payment','private-proof','private-supporter','private-message','private@example','Other donation','Not a public supporter'])assert(!safe.includes(value),value);
 await f.check();assert.equal(f.calls.length,5);f.advance(600001);await f.check();assert.equal(f.calls.length,9);assert.equal(f.calls.filter(c=>c.url.includes('/oauth2/token')).length,1);
});
test('parallel clicks are deduplicated and missing credentials make no remote requests',async()=>{
 const f=fixture();const a=await Promise.all([f.check(),f.check(),f.check()]);assert.equal(f.calls.length,5);assert.deepEqual(a[0],a[1]);const absent=fixture({secret:{}});assert.equal((await absent.check()).connection,'missing_secrets');assert.equal(absent.calls.length,0);
});
test('authentication failures and thrown secret-bearing errors are sanitized and cached without retry loops',async()=>{
 for(const status of [401,403,429,500]){
  const f=fixture({responses:{'https://oauth.livepix.gg/oauth2/token':()=>new Response('private-client-secret',{status})}});const r=await f.check();assert.equal(r.connection,status===401?'unauthorized':status===403?'forbidden':status===429?'rate_limited':'unavailable');assert.equal(f.calls.length,1);assert(!JSON.stringify(r).includes('private-client'));await f.check();assert.equal(f.calls.length,1);
 }
 const f=fixture({responses:{'https://oauth.livepix.gg/oauth2/token':()=>{throw Error('private-client-secret');}}});assert.equal((await f.check()).connection,'unavailable');
});
test('the connection check distinguishes account mismatches and per-endpoint permissions without publishing any names',async()=>{
 const f=fixture({responses:{'https://api.livepix.gg/v2/account':()=>Response.json({data:{username:'other-account'}}),'https://api.livepix.gg/v2/messages?page=1&limit=20':()=>new Response('private',{status:403})}});const r=await f.check();assert.equal(r.connection,'connected');assert.equal(r.accountMatchesCampaign,false);assert.deepEqual(r.messages,{status:'forbidden'});assert.equal(r.payments.status,'ok');assert.equal(r.automatic,false);
});
test('malformed or oversized responses and unavailable campaigns are bounded and never fabricate campaign links',async()=>{
 const f=fixture({responses:{'https://vaquinha.livepix.gg/central-free-fire':()=>new Response('x'.repeat(180001)),'https://api.livepix.gg/v2/payments?page=1&limit=20':()=>Response.json({data:{invalid:true}})}});const r=await f.check();assert.equal(r.campaign.status,'unavailable');assert.equal(r.messages.possibleCampaignMatches,0);assert.equal(r.payments.status,'unavailable');assert.equal(r.accountMatchesCampaign,null);
 const invalid=fixture({responses:{'https://oauth.livepix.gg/oauth2/token':()=>Response.json({access_token:'private'})}});assert.equal((await invalid.check()).connection,'unavailable');assert.equal(invalid.calls.length,1);
});
test('samples ignore arbitrary nested metadata and only compare explicit campaign identifiers',async()=>{
 const f=fixture({responses:{'https://api.livepix.gg/v2/messages?page=1&limit=20':()=>Response.json({data:Array.from({length:50},(_,i)=>i===0?{username:'Private name',metadata:{campaignId}}:i===1?{metadata:{randomText:campaignId}}:null)})}});const r=await f.check();assert.equal(r.messages.checked,2);assert.equal(r.messages.possibleCampaignMatches,1);assert.deepEqual(r.messages.campaignFields,['metadata']);
});
