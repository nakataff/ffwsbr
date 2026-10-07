'use strict';
const streamHosts=new Set(['centralfreefire.com.br','www.centralfreefire.com.br','youtube.com','www.youtube.com','m.youtube.com','youtu.be','twitch.tv','www.twitch.tv','m.twitch.tv','facebook.com','www.facebook.com','m.facebook.com','fb.watch','fb.gg','kick.com','www.kick.com']);
function destination(value){try{const u=new URL(String(value||'/conta.html?tab=notifications'),self.location.origin);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&streamHosts.has(u.hostname))return u.href;}catch{}return new URL('/conta.html?tab=notifications',self.location.origin).href;}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={};try{data=event.data.json();}catch{}
 const url=destination(data.url),watch=url!==new URL('/conta.html?tab=notifications',self.location.origin).href;
 event.waitUntil(self.registration.showNotification(String(data.title||'Central Free Fire').slice(0,120),{
  body:String(data.body||'Novo aviso na sua conta.').slice(0,300),tag:String(data.tag||'cff-alert').slice(0,100),
  icon:(()=>{try{if(!data.icon)return '/central%20free%20fire.webp';const u=new URL(data.icon,self.location.origin);return u.protocol==='https:'&&u.origin===self.location.origin?u.href:'/central%20free%20fire.webp';}catch{return '/central%20free%20fire.webp';}})(),
  data:{url},actions:watch?[{action:'watch',title:'Assistir ao vivo'}]:[],renotify:false
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.waitUntil((async()=>{
  const url=destination(event.notification.data?.url);
  if(new URL(url).origin!==self.location.origin)return self.clients.openWindow(url);
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows)if(new URL(client.url).origin===self.location.origin){await client.navigate(url);return client.focus();}
  return self.clients.openWindow(url);
 })());
});
