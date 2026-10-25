export const LEVELS=Object.freeze([
 {id:'novato',label:'Novato',points:0,color:'#85B7E8'},
 {id:'participante',label:'Participante',points:100,color:'#57D9A3'},
 {id:'veterano',label:'Veterano',points:500,color:'#66D3FF'},
 {id:'elite',label:'Elite',points:1500,color:'#C394FF'},
 {id:'lenda',label:'Lenda',points:5000,color:'#FFC857'},
]);
export function levelFor(value){const points=Math.max(0,Number(value)||0);const index=LEVELS.findLastIndex(l=>points>=l.points),level=LEVELS[index],next=LEVELS[index+1]||null;return{...level,index,score:points,next,progress:next?Math.max(0,Math.min(100,Math.round((points-level.points)/(next.points-level.points)*100))):100,remaining:next?next.points-points:0};}
export function unlockedStyle(id,points){const l=LEVELS.find(x=>'level-'+x.id===id);return l&&levelFor(points).index>=LEVELS.indexOf(l)?l:null;}
export function dayShift(day,n){return new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);}
export function calendarDays(today,active,length=91){const used=new Set(active),start=dayShift(today,-length+1);const weekday=(new Date(start+'T12:00:00Z').getUTCDay()+6)%7;return[...Array(weekday).fill(null),...Array.from({length},(_,i)=>{const day=dayShift(start,i);return{day,active:used.has(day),today:day===today};})];}
export function followKey(target){return target?.kind==='uid'?'uid:'+target.id:target?.kind==='ig'?'ig:'+String(target.id).toLowerCase():'';}
export function putFollow(current,target,now=Date.now()){
 if(!target||!['uid','ig'].includes(target.kind)||!String(target.id).match(target.kind==='uid'?/^[A-Za-z0-9_-]{1,128}$/:/^[a-z0-9_.]{1,64}$/))throw Error('Perfil inválido.');
 const next={...(current||{})},existing=Object.entries(next).find(([,t])=>followKey(t)===followKey(target));if(existing)return next;
 const slot=Array.from({length:99},(_,i)=>'f'+i).find(k=>!next[k]);if(!slot)throw Error('Você já segue 99 perfis. Remova um para adicionar outro.');
 next[slot]={kind:target.kind,id:target.id,createdAt:now};return next;
}
export function rankPeers(rows){return [...rows].sort((a,b)=>Number(b.points)-Number(a.points)||Number(b.activeDays)-Number(a.activeDays)||Number(b.stories)-Number(a.stories)||Number(b.comments)-Number(a.comments)||String(a.username).localeCompare(String(b.username),'en')||String(a.key||'').localeCompare(String(b.key||'')));}
export function comparePeers(a,b){const metrics=[['points','Pontos'],['activeDays','Dias ativos'],['comments','Comentários'],['stories','Stories aprovados'],['predictions','Palpites enviados'],['wins','Prêmios em palpites']];return metrics.map(([key,label])=>({key,label,a:Number(a?.[key]||0),b:Number(b?.[key]||0),leader:Number(a?.[key]||0)===Number(b?.[key]||0)?'tie':Number(a?.[key]||0)>Number(b?.[key]||0)?'a':'b'}));}
