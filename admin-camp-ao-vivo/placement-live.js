(()=>{
 'use strict';
 const container=document.getElementById('teams-inputs-container');if(!container)return;
 // Clicks belong to the legacy launcher. Only mirror an explicitly typed position.
 // Never rewrite scores/positions, intercept clicks, reorder rows or observe renders.
 document.addEventListener('input',event=>{
  const field=event.target;
  if(!container.contains(field)||!field.matches('input[id^="place-"]'))return;
  const raw=field.value.trim(),n=Number(raw),valid=raw!==''&&Number.isInteger(n)&&n>=1&&n<=Math.max(12,container.querySelectorAll('.team-row').length),p=valid?n:null;
  const row=field.closest('.team-row'),code=field.dataset.code||field.id.slice(6);
  row?.querySelectorAll('input[data-v46-position]').forEach(radio=>{radio.checked=p===Number(radio.dataset.v46Position);});
  const top=document.getElementById('top12-'+code),boo=document.getElementById('boo-'+code);
  if(top)top.checked=p===12;if(boo)boo.checked=p===1;
 },true);
})();
