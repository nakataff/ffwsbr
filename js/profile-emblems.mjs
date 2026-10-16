const VERSION='20261016-emblems-v1';
export const VERIFIED_EMBLEM=Object.freeze({title:'Verificado',description:'Pessoa reconhecida pela Central Free Fire por sua relevância na comunidade.',enabled:true,assetId:''});
const validId=id=>typeof id==='string'&&/^[a-z][a-z0-9-]{0,39}$/.test(id),validUid=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function normalizeEmblems(raw={}){const result={verified:{...VERIFIED_EMBLEM}};for(const [id,item]of Object.entries(raw||{})){if(!validId(id)||!item)continue;result[id]={title:String(item.title||id).slice(0,50),description:String(item.description||'').slice(0,180),enabled:item.enabled===true,assetId:/^img-[a-f0-9-]{36}$/.test(item.assetId||'')?item.assetId:''};}return result;}
export function activeEmblem(assignment,catalog){const id=assignment?.emblemId;return validId(id)&&catalog[id]?.enabled?{id,...catalog[id]}:null;}
export function emblemHtml(item,image){if(!item)return '';const label=item.title+(item.description?' · '+item.description:'');return `<span class="cff-community-emblem${item.assetId?' has-image':' is-placeholder'}" role="img" aria-label="${esc(label)}" title="${esc(label)}">${item.assetId?image(item):'<span aria-hidden="true">✓</span>'}</span>`;}
export function emblemSlot(uid){return validUid(uid)?`<span class="cff-emblem-slot" data-emblem-uid="${esc(uid)}"></span>`:'';}
export function ensureEmblemStyles(){if(document.querySelector('link[data-cff-emblems]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='/css/profile-emblems.css?v='+VERSION;link.dataset.cffEmblems='1';document.head.append(link);}
// Only the small catalog and the currently visible profiles are observed. No user
// directory, score history or other account's private inventory is requested.
export function createEmblemDisplay({root,subscribe,image,hydrate=()=>{}}){
 let catalog=normalizeEmblems(),stopCatalog=null,queued=false,generation=0;const assignments=new Map(),subscriptions=new Map();
 function paint(){queued=false;const host=root();if(!host)return;for(const slot of host.querySelectorAll('[data-emblem-uid]')){const item=activeEmblem(assignments.get(slot.dataset.emblemUid),catalog),signature=JSON.stringify(item);if(slot.dataset.emblemSignature===signature)continue;slot.dataset.emblemSignature=signature;slot.innerHTML=emblemHtml(item,image);slot.removeAttribute('aria-hidden');}hydrate(host);}
 function schedule(){if(queued)return;queued=true;queueMicrotask(paint);}
 function mount(uids){ensureEmblemStyles();const wanted=new Set((Array.isArray(uids)?uids:[uids]).filter(validUid));
  for(const [uid,stop]of subscriptions)if(!wanted.has(uid)){stop();subscriptions.delete(uid);assignments.delete(uid);}
  if(wanted.size&&!stopCatalog){const seq=generation;stopCatalog=()=>{};stopCatalog=subscribe('communityEmblemCatalog',raw=>{if(seq!==generation)return;catalog=normalizeEmblems(raw);schedule();},()=>{});}
  for(const uid of wanted)if(!subscriptions.has(uid)){const seq=generation;subscriptions.set(uid,()=>{});const stop=subscribe('communityEmblemAssignments/'+uid,value=>{if(seq===generation&&subscriptions.has(uid)){assignments.set(uid,value);schedule();}},()=>{});subscriptions.set(uid,stop);}
  if(!wanted.size){stopCatalog?.();stopCatalog=null;catalog=normalizeEmblems();}schedule();
 }
 function stop(){generation++;stopCatalog?.();stopCatalog=null;for(const dispose of subscriptions.values())dispose();subscriptions.clear();assignments.clear();catalog=normalizeEmblems();schedule();}
 return {mount,stop};
}
