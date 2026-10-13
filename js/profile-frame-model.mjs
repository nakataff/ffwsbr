export const BUILTIN_FRAMES=Object.freeze([{id:'frame-bronze-1',kind:'frame',name:'Bronze 1',image:'/assets/profile-frames/bronze-1.png',frameScale:1.35}]);
export function frameScaleFor(item){const scale=Number(item?.frameScale);return Number.isFinite(scale)&&scale>=1&&scale<=1.8?scale:1.35;}
export function frameOption(options,catalog,id){return (options?.frames||[]).find(x=>x.id===id)|| (catalog?.[id]?.kind==='frame'?catalog[id]:null);}
export function frameChoices(options,catalog){return [...(options?.frames||[]),...Object.entries(catalog||{}).filter(([,x])=>x.enabled&&x.kind==='frame').map(([id,x])=>({id,name:x.title,...x}))];}
export function selectedFrame(profile,options,catalog,available){const id=String(profile?.frameId||'');if(!id)return null;const builtin=(options?.frames||[]).find(x=>x.id===id);if(builtin)return builtin;const item=catalog?.[id];return item?.kind==='frame'&&available(item,id)?{id,...item}:null;}
