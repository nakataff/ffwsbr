export const INVENTORY_TABS=[['gifts','🎁 Presentes'],['avatars','Avatares'],['covers','Capas'],['frames','Molduras'],['badges','Insígnias']];
export function inventoryAssets(kind,{options={},catalog={},available=()=>false,profile={},defaults={}}={}){
 const custom=Object.entries(catalog).filter(([id,item])=>item.kind===kind&&available(item,id)).map(([id,item])=>({id,name:item.title,...item}));
 const base=kind==='avatar'?[{id:'default',name:'Padrão da Central',previewId:defaults.avatarId||'default'},...(options.players||[]),...(options.teams||[])]:kind==='frame'?(options.frames||[]):kind==='cover'&&catalog[defaults.coverId]?.enabled?[{...catalog[defaults.coverId],id:defaults.coverId,name:catalog[defaults.coverId].title}]:[];
 const selected=kind==='avatar'?profile.avatarId||'default':kind==='cover'?profile.coverId||defaults.coverId:profile.frameId;
 return [...new Map([...custom,...base].map(item=>[item.id,{...item,equipped:item.id===selected}])).values()].sort((a,b)=>Number(b.equipped)-Number(a.equipped)||Number(Boolean(b.assetId))-Number(Boolean(a.assetId))||String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));
}
