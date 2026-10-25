(() => {
 'use strict';
 const gifted=data=>Boolean(data?.presente&&!data.presente.pending);
 const free=(data,stockReserved=false)=>!data?.entregue&&!data?.presente&&!String(data?.recebeu||'').trim()&&!stockReserved;
 const dateTime=at=>{const date=new Date(at);return Number.isFinite(date.getTime())?date.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Data não registrada';};
 window.CFF_CODE_STATE={gifted,free,dateTime};
})();
