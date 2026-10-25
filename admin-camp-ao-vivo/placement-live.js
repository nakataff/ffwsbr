(()=>{
 'use strict';
 const container=document.getElementById('teams-inputs-container');if(!container)return;
 const position=field=>{const raw=String(field?.value??'').trim(),n=Number(raw);return raw!==''&&Number.isInteger(n)&&n>=1&&n<=Math.max(12,container.querySelectorAll('.team-row').length)?n:null;};
 function apply(field){
  const row=field.closest('.team-row');if(!row)return;
  const p=position(field),code=field.dataset.code||field.id.slice(6);
  row.querySelectorAll('input[data-v46-position]').forEach(radio=>{radio.checked=p===Number(radio.dataset.v46Position);});
  const picker=document.getElementById('pospick-'+code);if(picker)picker.value=p===null?'':String(p);
  const boo=document.getElementById('boo-'+code),last=document.getElementById('top12-'+code);
  if(boo)boo.checked=p===1;if(last)last.checked=p===12;
 }
 function sync(){
  container.querySelectorAll('.team-row input[id^="place-"]').forEach(apply);
  const used=new Map();container.querySelectorAll('.team-row input[id^="place-"]').forEach(f=>{const p=position(f);if(p!==null)used.set(p,f.closest('.team-row'));});
  container.querySelectorAll('input[data-v46-position]').forEach(radio=>{
   const row=radio.closest('.team-row');if(!row?.querySelector('input[id^="place-"]'))return;
   const p=Number(radio.dataset.v46Position),occupied=used.has(p)&&used.get(p)!==row;
   radio.disabled=occupied;radio.setAttribute('aria-disabled',String(occupied));
   radio.closest('.v46-placement-choice')?.classList.toggle('v46-position-in-use',occupied);
  });
 }
 let queued=false;function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;sync();});}
 // Update radios before legacy handlers read the previous selected position.
 document.addEventListener('input',event=>{if(!container.contains(event.target))return;if(event.target.matches('input[id^="place-"]'))apply(event.target);schedule();},true);
 document.addEventListener('change',event=>{if(container.contains(event.target)||event.target.id==='drop-num')schedule();});
 new MutationObserver(schedule).observe(container,{childList:true,subtree:true});
 window.addEventListener('cff:camp-core-ready',schedule);window.addEventListener('cff:camp-drops-cleared',schedule);sync();
})();
