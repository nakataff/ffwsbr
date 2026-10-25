export async function setGiftArchived({auth,uid,giftId,kind='code',archived=true}){
 const user=auth.currentUser;if(user?.uid!==uid)throw Error('Entre na conta que recebeu o presente.');
 const token=await user.getIdToken();if(auth.currentUser?.uid!==uid)throw Error('Sua conta mudou. Entre novamente.');
 const response=await fetch('https://cff-camp-notifications.nakataffb4.workers.dev/api',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'archiveGift',kind,giftId,archived}),signal:AbortSignal.timeout(30000)}),data=await response.json();
 if(!response.ok||data.error)throw Error(data.error||'Não foi possível organizar o presente.');
 return data;
}
