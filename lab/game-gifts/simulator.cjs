'use strict';
// This adapter has NO network/auth code and knows only synthetic lab accounts.
// 30 diamonds is a fixture inspired by the earlier Pet Food test, not a live price.
function createSimulator({now=Date.now,balance=100,mappings={}}={}){
 let connected=false,scenario='delivered',lookupAvailable=true,sends=0;const receipts=new Map();
 const error=message=>Object.assign(Error(message),{status:409});
 return {mode:'simulation',sender:()=>({connected,id:'LAB-SENDER',name:'Remetente fictício',diamonds:balance}),connect:async()=>{connected=true;},
  async quote(order){if(!connected)throw error('Conecte o remetente de teste.');const p=mappings[order.itemId];if(!p||!order.revision||p.revision!==order.revision)throw error('Item sem vínculo revisado no catálogo de teste.');return {orderId:order.id,gameId:order.gameId,revision:order.revision,sku:p.sku,diamonds:p.diamonds,senderId:'LAB-SENDER',expiresAt:now()+60000};},
  async send(command){if(receipts.has(command.requestId))return;const p=Object.values(mappings).find(p=>p.sku===command.sku&&p.revision===command.revision);if(!connected||command.senderId!=='LAB-SENDER'||!p||p.diamonds!==command.diamonds)throw error('Remetente ou catálogo mudou.');sends++;
   const notSent=scenario==='not_sent'||balance<command.diamonds;if(!notSent)balance-=command.diamonds;
   receipts.set(command.requestId,{...command,status:notSent?'not_sent':'delivered',receiptId:'LAB-'+command.requestId,deliveredAt:now()});
   if(scenario==='unknown')lookupAvailable=false;
   if(scenario==='timeout_delivered'||scenario==='unknown')throw error('Timeout simulado.');
  },async lookup(command){if(!lookupAvailable)return null;return receipts.get(command.requestId)||null;},
  setScenario(value){if(!['delivered','not_sent','timeout_delivered','unknown'].includes(value))throw error('Cenário inválido.');scenario=value;},resolve(){lookupAvailable=true;},get sends(){return sends;},mappings};
}
module.exports={createSimulator};
