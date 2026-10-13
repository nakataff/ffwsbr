'use strict';
const MEDIA='https://cff-camp-notifications.nakataffb4.workers.dev/economy-media/';
const rows=(sql,q,...args)=>{const r=sql.exec(q,...args);return typeof r.toArray==='function'?r.toArray():Array.from(r);};
const invalid=()=>Object.assign(Error('Use uma foto PNG, JPG ou WebP de até 100 KB, ou uma imagem hospedada no site.'),{status:400});
async function imageUrl(sql,value){
 const image=String(value||'').trim();if(!image)return '';
 if(image.startsWith('data:')){
  const match=image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);if(!match||image.length>140000)throw invalid();
  let bytes;try{bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));}catch{throw invalid();}
  const signature=match[1]==='png'?bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';if(!signature)throw invalid();
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(image)),id=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  sql.exec('INSERT OR IGNORE INTO eco_media VALUES(?,?)',id,image);return MEDIA+id;
 }
 let url;try{url=new URL(image,'https://centralfreefire.com.br');}catch{throw invalid();}
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.href.length>2048)throw invalid();
 if(url.href.startsWith(MEDIA)&&/^[a-f0-9]{64}$/.test(url.href.slice(MEDIA.length))&&rows(sql,'SELECT id FROM eco_media WHERE id=?',url.href.slice(MEDIA.length)).length)return url.href;
 if(!['centralfreefire.com.br','www.centralfreefire.com.br'].includes(url.hostname)||!url.pathname.match(/\.(png|jpe?g|webp)$/i))throw invalid();
 return url.href;
}
function read(sql,id){if(!/^[a-f0-9]{64}$/.test(id||''))return null;const image=rows(sql,'SELECT image FROM eco_media WHERE id=?',id)[0]?.image;if(!image)return null;const match=image.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);return match?{type:match[1],base64:match[2]}:null;}
module.exports={imageUrl,read};
