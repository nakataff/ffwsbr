(()=>{
 'use strict';
 const control=document.getElementById('drop-opt-elimination-focus'),container=document.getElementById('teams-inputs-container');
 if(!control||!container)return;
 const key='cff-camp-elimination-focus-v2';let queued=false;
 try{control.checked=localStorage.getItem(key)!=='0';}catch{}
 const style=document.createElement('style');style.textContent=`
 body.cff-elimination-focus #teams-inputs-container .team-row.cff-team-eliminated{background:#181b20!important;border-color:#555b63!important;box-shadow:none!important}
 body.cff-elimination-focus #teams-inputs-container .team-row.cff-team-eliminated .team-flex{filter:grayscale(1)!important;position:relative;padding-right:30px!important}
 body.cff-elimination-focus #teams-inputs-container .team-row.cff-team-eliminated .team-flex::after{content:'✕';position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:22px;font-weight:900;color:#fff;text-shadow:0 1px 4px #000;pointer-events:none}
 body.cff-elimination-focus #teams-inputs-container .team-row.cff-team-eliminated input:not([type=checkbox]):not([type=radio]),body.cff-elimination-focus #teams-inputs-container .team-row.cff-team-eliminated select{background:#20252c!important;border-color:#525964!important;color:#d5d9df!important;box-shadow:none!important;outline:none!important}
 body.cff-elimination-focus #teams-inputs-container .team-row .cff-entry-needed,body.cff-elimination-focus #teams-inputs-container .team-row input:focus,body.cff-elimination-focus #teams-inputs-container .team-row select:focus{background:#3a2918!important;border:2px solid #ffa52b!important;color:#fff0d8!important;outline:1px solid #ffa52b!important;outline-offset:1px!important}
 .cff-elim-marker{display:none;font-size:10px;line-height:1.4;color:#c6cbd2;grid-column:1/-1;flex-basis:100%;padding:3px 5px;pointer-events:none}
 body.cff-elimination-focus .cff-elim-marker{display:block}
 #cff-elim-summary{font-size:11px;color:#bdc5d0;padding:4px 0}#cff-elim-summary[hidden]{display:none}
 `;document.head.append(style);
 const summary=document.createElement('span');summary.id='cff-elim-summary';summary.setAttribute('role','status');summary.setAttribute('aria-live','polite');document.querySelector('.drop-top-tools')?.append(summary);
 function position(row){
  if(typeof window.v86GetLaunchPlacement==='function'){const p=window.v86GetLaunchPlacement(row);return Number.isInteger(p)&&p>0?p:null;}
  const chosen=row.querySelector('[data-v46-position]:checked');
  if(chosen)return Number(chosen.dataset.v46Position)||null;
  const direct=row.querySelector('[id^="place-"]');
  if(direct)return Number(direct.value)||null;
  const picker=row.querySelector('[id^="pospick-"]');
  return Number(picker?.value)||(row.querySelector('input[name=booyah]:checked,[id^="boo-"]:checked')?1:row.querySelector('[id^="top12-"]:checked')?12:null);
 }
 function visible(field){return field.type!=='hidden'&&!field.disabled&&!field.readOnly&&!field.closest('[hidden]')&&field.getClientRects().length>0;}
 function filled(field){return ['radio','checkbox'].includes(field.type)?field.checked:String(field.value??'').trim()!=='';}
 function sync(){
  queued=false;const enabled=control.checked;document.body.classList.toggle('cff-elimination-focus',enabled);summary.hidden=!enabled;
  let placed=0,pending=0,total=0;
  container.querySelectorAll('.team-row').forEach(row=>{
   total++;const p=position(row),fields=[...row.querySelectorAll('[data-required="1"]')].filter(visible),missing=fields.filter(f=>!filled(f));
   const complete=p!==null&&fields.length>0&&missing.length===0;if(p!==null)placed++;if(p!==null&&!complete)pending++;
   row.classList.toggle('cff-elim-complete',enabled&&complete);
   row.classList.toggle('cff-team-eliminated',enabled&&p!==null&&p>1);
   row.querySelectorAll('.cff-entry-needed').forEach(f=>{if(!enabled||p===null||!missing.includes(f))f.classList.remove('cff-entry-needed');});
   if(enabled&&p!==null)missing.forEach(f=>f.classList.add('cff-entry-needed'));
   let marker=row.querySelector('.cff-elim-marker');
   if(!enabled){marker?.remove();return;}
   if(!marker){marker=document.createElement('span');marker.className='cff-elim-marker';row.append(marker);}
   const text=p===null?'Sem colocação registrada':(p===1?'BOOYAH · 1º':'✕ Eliminada · '+p+'º')+(complete?' · ✓ preenchido':' · '+missing.length+' campo(s) pendente(s)');
   if(marker.textContent!==text)marker.textContent=text;
  });
  const text=placed+'/'+total+' com colocação · '+pending+' equipe(s) com preenchimento pendente';if(summary.textContent!==text)summary.textContent=text;
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(sync);}}
 control.addEventListener('change',()=>{try{localStorage.setItem(key,control.checked?'1':'0');}catch{}sync();});
 document.addEventListener('input',schedule);document.addEventListener('change',schedule);container.addEventListener('focusin',schedule);
 new MutationObserver(schedule).observe(container,{childList:true,subtree:true});
 window.addEventListener('cff:camp-core-ready',schedule);window.addEventListener('cff:camp-drops-cleared',schedule);
 sync();
})();
