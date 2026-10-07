const hosts=new Set(['centralfreefire.com.br','www.centralfreefire.com.br','youtube.com','www.youtube.com','m.youtube.com','youtu.be','twitch.tv','www.twitch.tv','m.twitch.tv','facebook.com','www.facebook.com','m.facebook.com','fb.watch','fb.gg','kick.com','www.kick.com']);
export function streamUrl(value){try{if(!value)return '';const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&hosts.has(u.hostname)&&u.href.length<=2048?u.href:'';}catch{return '';}}
export function notificationContent(e){
 if(e.status==='test')return {title:'Teste Central FF',body:'Este teste foi enviado apenas para sua conta.',badge:'TESTE'};
 const name=String(e.tournamentName||'Central Free Fire').replace(/\s*[—-]\s*Dia\s*\d+\s*$/i,'').slice(0,80),title=name+' / DIA '+e.day+' / QUEDA '+e.drop;
 if(e.kind==='start')return {title,body:'QUEDA '+e.drop+' COMEÇOU! O mapa da vez é '+e.map+'!',badge:'QUEDA AO VIVO'};
 const points=e.points+' pontos nesta queda'+(Number.isInteger(e.dayPoints)?' e '+e.dayPoints+' no dia':'')+'.';
 const body=e.kind==='booyah'?'BOOYAH PARA A EQUIPE '+e.team+'! '+e.kills+' abates na queda '+e.drop+'! '+points:e.team+(e.status==='official'?' terminou no top ':' acaba de cair no top ')+e.position+' com '+e.kills+' abates! '+points;
 return {title,body,badge:e.status==='official'?'PONTUAÇÃO OFICIAL':'PONTUAÇÃO PARCIAL'};
}
