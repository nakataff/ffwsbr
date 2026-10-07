'use strict';
const crypto = require('crypto');
const { onRequest } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const API = 'https://cff-instagram-community.nakataffb4.workers.dev';
const key = name => name.toLowerCase().replace(/\./g, ',');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const fail = (status, message) => Object.assign(new Error(message), {status});

// Identity comes from the private, verified Instagram session, never a submitted username.
async function syncProfile(db, uid) {
  const [account, owner, old] = await Promise.all([
    db.ref('userAccounts/'+uid+'/community').get(), db.ref('communityOwnerInstagram').get(),
    db.ref('communityInstagramLinks/'+uid).get()
  ]);
  let username = '';
  if (owner.val()?.uid === uid && owner.val()?.username === 'nakataff') username = 'nakataff';
  else if (/^[a-f0-9]{48}$/i.test(account.val()?.session || '')) {
    const response = await fetch(API+'/api/checkin/status?session='+encodeURIComponent(account.val().session), {signal:AbortSignal.timeout(8000)});
    if (!response.ok) throw fail(503, 'Não foi possível confirmar o Instagram agora.');
    const result = await response.json();
    if (result.status === 'verified' && /^[a-z0-9_.]{1,64}$/i.test(result.username||'')) username = result.username.toLowerCase();
  }
  const [currentAccount,currentOwner,publicProfile,role]=await Promise.all([db.ref('userAccounts/'+uid+'/community').get(),db.ref('communityOwnerInstagram').get(),db.ref('communityProfiles/'+uid).get(),db.ref('communityAccountRoles/'+uid+'/administrator').get()]);
  if(currentAccount.val()?.session!==account.val()?.session || currentOwner.val()?.uid!==owner.val()?.uid)throw fail(409,'O vínculo mudou durante a confirmação. Atualize o perfil.');
  const previous = old.val()?.username;
  if (previous && previous !== username) {
    await db.ref('communityRankingProfiles/'+key(previous)).transaction(value => value?.uid===uid ? null : value);
  }
  await db.ref('communityInstagramLinks/'+uid).set(username ? {username} : null);
  if (!username) return {linked:false};
  const p = publicProfile.val();
  const isAdmin = role.val() === true || !role.exists() && username==='nakataff' && owner.val()?.uid===uid;
  if (isAdmin && role.val()!==true) await db.ref('communityAccountRoles/'+uid+'/administrator').set(true);
  let avatarId=p?.avatarId||'default';
  if(avatarId.startsWith('asset-')) {
    const [itemSnapshot,owned,badges]=await Promise.all([db.ref('communityProfileCatalog/'+avatarId).get(),db.ref('communityImageOwnership/'+uid+'/'+avatarId).get(),db.ref('communityBadgeOwnership/'+uid).get()]);
    const item=itemSnapshot.val(),access=item?.accessRule||(item?.unlockBadge?'badge':'all');
    const allowed=item?.enabled&&item.kind==='avatar'&&(owned.exists()||access==='admin'&&isAdmin||['all','badge'].includes(access)&&(!item.unlockBadge||badges.val()?.[item.unlockBadge]===true));
    if(!allowed)avatarId='default';
  }
  const entry = p?.public ? {uid,username,avatarId,administrator:isAdmin} : null;
  const result = await db.ref('communityRankingProfiles/'+key(username)).transaction(value => {
    if (value?.uid && value.uid!==uid) return; // Another Google account must be released by the admin first.
    return entry;
  });
  if (!result.committed) throw fail(409,'Este Instagram já tem um perfil público. Peça ao admin para liberar a troca.');
  return {linked:true,username,published:!!entry};
}

async function redeemCode(db, uid, raw) {
  const code = String(raw||'').trim().toUpperCase();
  if (!/^[A-Z0-9-]{5,32}$/.test(code)) throw fail(400,'Informe um código válido.');
  const codeHash=hash(code), snapshot=await db.ref('communityAvatarCodes/'+codeHash).get(), rule=snapshot.val();
  if (!rule?.enabled || rule.expiresAt && rule.expiresAt<Date.now()) throw fail(400,'Código inválido, desativado ou expirado.');
  const item=(await db.ref('communityProfileCatalog/'+rule.assetId).get()).val();
  if (!item?.enabled || !['avatar','cover'].includes(item.kind) || item.accessRule!=='code') throw fail(400,'Esta imagem não está disponível por código.');
  const entitlement=db.ref('communityImageOwnership/'+uid+'/'+rule.assetId);
  let already=false;
  await entitlement.transaction(value=>{if(value){already=true;return;}return {source:'code',codeHash,grantedAt:Date.now()};});
  return {assetId:rule.assetId,title:item.title,alreadyClaimed:already};
}

async function handle(req,res,deps={auth:getAuth(),db:getDatabase()}) {
  res.set('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({error:'Use POST.'});
  try {
    const bearer=String(req.get('authorization')||'').match(/^Bearer (.+)$/);
    if(!bearer) throw fail(401,'Entre com Google.');
    let identity;try{identity=await deps.auth.verifyIdToken(bearer[1],true);}catch{throw fail(401,'Entre novamente com Google.');}
    const uid=identity.uid;
    const action=req.body?.action;
    if(action!=='sync'&&action!=='redeem') throw fail(400,'Ação inválida.');
    const rate=deps.db.ref('communityProfileRate/'+uid+'/'+action), now=Date.now();
    const result=await rate.transaction(last=>last&&now-last<1500?undefined:now);
    if(!result.committed) throw fail(429,'Aguarde um instante e tente novamente.');
    const data=action==='redeem'?await redeemCode(deps.db,uid,req.body?.code):await syncProfile(deps.db,uid);
    return res.json(data);
  } catch(error) {return res.status(error.status||503).json({error:error.status?error.message:'Não foi possível concluir agora.'});}
}
exports.communityProfileAccess=onRequest({region:'southamerica-east1',cors:['https://centralfreefire.com.br','https://www.centralfreefire.com.br','https://nakataff.github.io'],maxInstances:3,minInstances:0,timeoutSeconds:30,memory:'256MiB'},(req,res)=>handle(req,res));
exports._test={handle,syncProfile,redeemCode};
