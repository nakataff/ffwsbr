const hosts=new Set(['centralfreefire.com.br','www.centralfreefire.com.br','youtube.com','www.youtube.com','m.youtube.com','youtu.be','twitch.tv','www.twitch.tv','m.twitch.tv','facebook.com','www.facebook.com','m.facebook.com','fb.watch','fb.gg','kick.com','www.kick.com']);
export function streamUrl(value){try{if(!value)return '';const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&hosts.has(u.hostname)&&u.href.length<=2048?u.href:'';}catch{return '';}}
export function notificationContent(e){
 if(e.status==='test')return {title:'Teste Central FF',body:'Este teste foi enviado apenas para sua conta.',badge:'TESTE'};
 const name=String(e.tournamentName||'Central Free Fire').replace(/\s*[—-]\s*Dia\s*\d+\s*$/i,'').slice(0,80),title=name+' / DIA '+e.day+' / QUEDA '+e.drop;
 if(e.kind==='start')return {title,body:'Queda '+e.drop+' começou! Mapa: '+e.map+'.',badge:'QUEDA AO VIVO'};
 const points=e.points+' pts'+(Number.isInteger(e.dayPoints)?' · '+e.dayPoints+' no dia':'')+'.';
 const body=e.kind==='booyah'?'BOOYAH: '+e.team+'! '+e.kills+' abates · '+points:e.team+' · Top '+e.position+' · '+e.kills+' abates · '+points;
 return {title,body,badge:e.status==='official'?'PONTUAÇÃO OFICIAL':'PONTUAÇÃO PARCIAL'};
}

const teamLogos={afro:'afg.webp',afg:'afg.webp',afrogames:'afg.webp',a7:'A7 2.webp',alpha7:'A7 2.webp',civ:'Civis.webp',cvs:'Civis.webp',civis:'Civis.webp',cptvox:'cpt vox.webp',ctz:'cpt vox.webp',fx:'Fluxo 2.webp',fluxo:'Fluxo 2.webp',fluxow7m:'Fluxo 2.webp',inf:'Influence Rage.webp',influencerage:'Influence Rage.webp',intz:'Intz 1.webp',lps:'Loops 1.webp',loops:'Loops 1.webp',los:'Los.webp',loud:'loud 2.webp',loudsnickers:'loud 2.webp',rise:'Rise 1.webp',risegaming:'Rise 1.webp',rshm:'Rush.webp',rushgaming:'Rush.webp',sxt:'sx tet.webp',sxtet:'sx tet.webp',sxgg:'sx tet.webp',ts:'Team Solid 2.webp',teamsolid:'Team Solid 2.webp'};
export function teamLogo(name,id='',value=''){const key=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');const known=teamLogos[key(name)]||teamLogos[key(id)];if(known&&(!value||/escudo|\.png(?:\?|$)/i.test(value)))return 'https://centralfreefire.com.br/'+encodeURIComponent(known);return value|| (known?'https://centralfreefire.com.br/'+encodeURIComponent(known):'');}
