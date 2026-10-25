const visual={players:'Jogadores',character:'Personagens',logos:'Logos',simple:'Simples',stylized:'Estilizadas',special:'Especiais'};
export const CATEGORY_DEFAULTS=Object.freeze({avatar:{...visual},cover:{...visual},frame:{...visual},badge:{interaction:'Interações',prediction:'Palpites',simple:'Simples',special:'Especiais'}});
export const CATEGORY_KINDS=Object.freeze({avatar:'Avatares',cover:'Capas',frame:'Molduras',badge:'Insígnias'});
export function categoriesFor(kind,raw={}){
 const base=Object.hasOwn(CATEGORY_DEFAULTS,kind)?CATEGORY_DEFAULTS[kind]:null;if(!base)return {};
 const entries=new Map(Object.entries(base).map(([id,label],index)=>[id,{label,order:index*10}]));
 for(const [id,item]of Object.entries(raw?.[kind]||{})){const label=String(item?.label||'').trim(),order=Number(item?.order);if(/^[a-z][a-z0-9-]{0,31}$/.test(id)&&label&&label.length<=40&&Number.isFinite(order))entries.set(id,{label,order});}
 return Object.fromEntries([...entries].sort((a,b)=>a[1].order-b[1].order||a[0].localeCompare(b[0])).map(([id,item])=>[id,item.label]));
}
export function categoryLabel(item,raw={}){return categoriesFor(item?.kind,raw)[item?.category]||'Especiais';}
export function categoryId(label,used={}){const base=String(label||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,25)||'categoria';const stem=(/^[a-z]/.test(base)?base:'cat-'+base).slice(0,24);let id=stem;for(let n=2;Object.hasOwn(used,id);n++)id=stem+'-'+n;return id.slice(0,32);}
