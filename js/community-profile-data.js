import { ref, get } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';
export const PROFILE_VERSION='20261007-access-v1';
export const escapeProfile=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const DEFAULT_AVATAR='/central%20free%20fire.webp';
let optionsPromise;const imageCache=new Map();
export function profileOptions(){return optionsPromise||=fetch('/profile-options.json?v='+PROFILE_VERSION).then(r=>{if(!r.ok)throw Error('Catálogo indisponível');return r.json()}).catch(e=>{optionsPromise=null;throw e});}
export function findOption(options,id){return [...(options?.teams||[]),...(options?.players||[])].find(x=>x.id===id);}
export function imageUrl(path){return new URL(path||DEFAULT_AVATAR,location.origin+'/').href;}
export function approvedImage(options,catalog,id,cls='',alt=''){
 const opt=findOption(options,id),item=catalog?.[id],remote=(item?.enabled||item?.kind==='badge')&&item.assetId;
 const src=opt?imageUrl(opt.image):remote?'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=':DEFAULT_AVATAR;
 const pending=remote?' cff-profile-asset-pending':'';
 return `<img class="${escapeProfile(cls)}${pending}" src="${escapeProfile(src)}" alt="${escapeProfile(alt||opt?.name||item?.title||'Avatar Central')}" loading="lazy" decoding="async"${remote?` data-profile-asset="${escapeProfile(item.assetId)}"`:''}>`;
}
export function hydrateProfileImages(root,db){
 const nodes=[...root.querySelectorAll('img[data-profile-asset]')];if(!nodes.length)return;
 const load=async node=>{const id=node.dataset.profileAsset;node.removeAttribute('data-profile-asset');try{let promise=imageCache.get(id);if(!promise){promise=get(ref(db,'communityProfileImages/'+id)).then(s=>{const value=s.val();if(typeof value!=='string'||!value.startsWith('data:image/webp;base64,')||value.length>140000)throw Error('Imagem indisponível');return value;}).catch(e=>{imageCache.delete(id);throw e;});imageCache.set(id,promise);}const data=await promise;const preload=new Image();preload.src=data;try{await preload.decode();}catch{}if(node.isConnected){node.src=data;node.classList.remove('cff-profile-asset-pending');node.classList.add('cff-profile-asset-ready');}}catch{node.classList.remove('cff-profile-asset-pending');node.alt='Imagem indisponível';}};
 if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){observer.unobserve(e.target);load(e.target);}}),{rootMargin:'180px'});nodes.forEach(n=>observer.observe(n));setTimeout(()=>observer.disconnect(),120000);}else nodes.forEach(load);
}
export function activeGrants(grants){return Object.entries(grants||{}).filter(([,g])=>g.status==='active').map(([id,g])=>({id,...g}));}
export function hasBadge(grants,badgeId){return activeGrants(grants).some(g=>g.badgeId===badgeId);}
export const ACCESS_LABELS={all:'Disponível para todos',weekly:'Campeão semanal',monthly:'Melhor do mês',top3:'Top 3 da comunidade',event:'Evento especial',supporter:'Apoiador da Central',code:'Via código',manual:'Liberação manual',admin:'Somente administradores',badge:'Por insígnia'};
export function catalogAvailable(item,grants,ownership={},roles={},id=''){if(!item?.enabled)return false;const access=item.accessRule||(item.unlockBadge?'badge':'all');if(ownership[id])return true;if(access==='admin')return roles.administrator===true;return ['all','badge'].includes(access)&&(!item.unlockBadge||hasBadge(grants,item.unlockBadge));}
export function automaticAvatar(name,options,catalog={}){let hash=2166136261;for(const c of String(name||'').toLowerCase()){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}const pool=[...(options?.players||[]),...Object.entries(catalog).filter(([,x])=>x.kind==='avatar'&&x.enabled&&(x.accessRule||'all')==='all'&&!x.unlockBadge).map(([id])=>({id}))];return pool.length?pool[(hash>>>0)%pool.length].id:'default';}
export const instagramKey=name=>String(name||'').toLowerCase().replace(/\./g,',');

