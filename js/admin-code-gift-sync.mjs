// Reconcile only this encrypted inventory with the private, admin-only delivery ledger.
export function createGiftSync({source,request,owner,onState=()=>{},now=Date.now}){
 let running=null,signature='',checkedAt=0,lastOwner='',epoch=0,queued=false,runningOwner='',runningKey='';
 async function sync(force=false){
  const account=owner(),entries=source.inventory();
  if(!account||entries===null){epoch++;signature='';lastOwner='';onState({ready:false,locked:true});return;}
  const codes=[...new Set(entries.map(row=>String(row.code).toUpperCase()))].sort(),key=codes.join('|');
  if(running){if(force||account!==runningOwner||key!==runningKey)queued=true;return running;}
  if(!force&&account===lastOwner&&key===signature&&now()-checkedAt<60000)return;
  runningOwner=account;runningKey=key;const ticket=++epoch;onState({ready:false,checking:true});
  const job=(async()=>{
   const records=[];
   for(let i=0;i<codes.length;i+=20){
    const batch=codes.slice(i,i+20),hashes=await Promise.all(batch.map(async code=>{const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code));return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}));
    const response=await request('codeGiftStatus',{hashes});
    if(!response.ok||!Array.isArray(response.gifts))throw Error('Não foi possível conferir os presentes anteriores.');
    const byHash=new Map(hashes.map((hash,index)=>[hash,batch[index]]));
    for(const record of response.gifts)if(byHash.has(record.hash))records.push({...record,code:byHash.get(record.hash)});
   }
   if(ticket!==epoch||owner()!==account||source.inventory()===null)return;
   await source.reconcile(records);
   if(ticket!==epoch||owner()!==account)return;
   signature=key;lastOwner=account;checkedAt=now();onState({ready:true,count:records.length,checkedAt});
  })().catch(error=>{if(ticket===epoch)onState({ready:false,error:error.message||'Falha ao conferir os presentes.'});}).finally(()=>{if(running===job){running=null;if(queued){queued=false;sync(true);}}});
  running=job;return job;
 }
 return {sync};
}
