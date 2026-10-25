'use strict';
const PAGE_SIZE=20,DAY=86400000;
function init(sql){sql.exec('CREATE TABLE IF NOT EXISTS eco_wallet_profiles(uid TEXT PRIMARY KEY,name TEXT,username TEXT,at INTEGER)');}
function create({sql,db,now}){
 const rows=(q,...args)=>{const r=sql.exec(q,...args);return typeof r.toArray==='function'?r.toArray():Array.from(r);};
 function remember(uid,profile){sql.exec('INSERT OR REPLACE INTO eco_wallet_profiles VALUES(?,?,?,?)',uid,String(profile?.name||'').slice(0,80),String(profile?.username||'').slice(0,24),now());}
 async function list(body={}){
  const sort=body.sort||'balance',offset=Number(body.offset||0);if(!['balance','earned'].includes(sort)||!Number.isInteger(offset)||offset<0||offset>100000)throw Object.assign(Error('Confira a ordenação e a página do ranking.'),{status:400});
  const filter='(w.earned>0 OR w.balance>0)',order=sort==='earned'?'w.earned DESC,w.balance DESC,w.uid ASC':'w.balance DESC,w.earned DESC,w.uid ASC';
  const selected=rows('SELECT w.uid,w.balance,w.earned,w.spent,p.name,p.username,p.at,i.username AS instagram FROM eco_wallet w LEFT JOIN eco_wallet_profiles p ON p.uid=w.uid LEFT JOIN eco_interaction_identities i ON i.uid=w.uid WHERE '+filter+' ORDER BY '+order+' LIMIT ? OFFSET ?',PAGE_SIZE,offset);
  let missing=selected.filter(p=>!p.at||now()-p.at>DAY);for(let i=0;i<missing.length;i+=5)await Promise.all(missing.slice(i,i+5).map(async p=>{try{const profile=await db.get('userAccounts/'+p.uid+'/profile');remember(p.uid,profile);p.name=String(profile?.name||'').slice(0,80);p.username=String(profile?.username||'').slice(0,24);}catch{}}));
  const totals=rows('SELECT COUNT(*) AS participants,COALESCE(SUM(w.balance),0) AS balance,COALESCE(SUM(w.earned),0) AS earned,COALESCE(SUM(w.spent),0) AS spent FROM eco_wallet w WHERE '+filter)[0];
  return {ok:true,currency:'CFF COINS',sort,offset,limit:PAGE_SIZE,total:totals.participants,totals,updatedAt:now(),hasMore:offset+selected.length<totals.participants,entries:selected.map((p,index)=>({position:offset+index+1,uid:p.uid,name:p.name||'Conta sem perfil',username:p.username||'',instagram:p.instagram||'',balance:p.balance,earned:p.earned,spent:p.spent}))};
 }
 return {remember,list};
}
module.exports={init,create,PAGE_SIZE};
