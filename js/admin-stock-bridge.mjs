// Private, incremental imports into the already-unlocked encrypted control.
export function createStockBridge({source,request,owner,now=Date.now}){
 let running=null,checkedAt=0,lastOwner='',epoch=0;
 async function sync(force=false){
  const uid=owner(),control=source();if(!uid||!control||control.inventory()===null){epoch++;lastOwner='';checkedAt=0;return;}
  if(running)return running;if(!force&&lastOwner===uid&&now()-checkedAt<60000)return;
  const ticket=++epoch;
  const work=(async()=>{let cursor=control.bridgeCursor?.()||0;for(let page=0;page<3;page++){
   const result=await request('stockBridge',{cursor});
   if(ticket!==epoch||owner()!==uid||source()!==control||control.inventory()===null)return;
   if(!Array.isArray(result.entries)||!Number.isSafeInteger(result.nextCursor)||result.nextCursor<cursor||result.hasMore&&result.nextCursor===cursor)throw Error('Não foi possível sincronizar os novos códigos.');
   await control.importStock(result.entries,result.nextCursor);cursor=result.nextCursor;
   if(!result.hasMore){checkedAt=now();lastOwner=uid;break;}
  }})();running=work;try{return await work;}finally{if(running===work)running=null;}
 }
 return {sync,invalidate(){epoch++;lastOwner='';checkedAt=0;}};
}
