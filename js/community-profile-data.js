import { ref, get } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';
export const PROFILE_VERSION='20261006-profile-v2';
export const escapeProfile=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const DEFAULT_AVATAR='/central%20free%20fire.webp';
let optionsPromise;const imageCache=new Map();
export function profileOptions(){return optionsPromise||=fetch('/profile-options.json?v='+PROFILE_VERSION).then(r=>{if(!r.ok)throw Error('Catálogo indisponível');return r.json()}).catch(e=>{optionsPromise=null;throw e});}
export function findOption(options,id){return [...(options?.teams||[]),...(options?.players||[])].find(x=>x.id===id);}
export function imageUrl(path){return new URL(path||DEFAULT_AVATAR,location.origin+'/').href;}
export function approvedImage(options,catalog,id,cls='',alt=''){
 const opt=findOption(options,id),item=catalog?.[id];const src=opt?imageUrl(opt.image):DEFAULT_AVATAR;
 return `<img class="${escapeProfile(cls)}" src="${escapeProfile(src)}" alt="${escapeProfile(alt||opt?.name||item?.title||'Avatar Central')}" loading="lazy" decoding="async"${(item?.enabled||item?.kind==='badge')&&item.assetId?` data-profile-asset="${escapeProfile(item.assetId)}"`:''}>`;
}
export function hydrateProfileImages(root,db){
 const nodes=[...root.querySelectorAll('img[data-profile-asset]')];if(!nodes.length)return;
 const load=async node=>{const id=node.dataset.profileAsset;node.removeAttribute('data-profile-asset');try{let promise=imageCache.get(id);if(!promise){promise=get(ref(db,'communityProfileImages/'+id)).then(s=>{const value=s.val();if(typeof value!=='string'||!value.startsWith('data:image/webp;base64,')||value.length>140000)throw Error('Imagem indisponível');return value;}).catch(e=>{imageCache.delete(id);throw e;});imageCache.set(id,promise);}const data=await promise;if(node.isConnected)node.src=data;}catch{node.alt='Imagem indisponível';}};
 if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){observer.unobserve(e.target);load(e.target);}}),{rootMargin:'120px'});nodes.forEach(n=>observer.observe(n));setTimeout(()=>observer.disconnect(),120000);}else nodes.forEach(load);
}
export function activeGrants(grants){return Object.entries(grants||{}).filter(([,g])=>g.status==='active').map(([id,g])=>({id,...g}));}
export function hasBadge(grants,badgeId){return activeGrants(grants).some(g=>g.badgeId===badgeId);}
export function catalogAvailable(item,grants){return item?.enabled&&(!item.unlockBadge||hasBadge(grants,item.unlockBadge));}
