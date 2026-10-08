(() => {
  'use strict';
  const clone = value => structuredClone(value);
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const comparable = row => row && Object.fromEntries(Object.entries(row).filter(([k])=>k!=='updatedAt'));
  function create({getState,keys,validate,onApplied,onUpdate}) {
    const snapshot = () => clone(Object.fromEntries(keys.map(k=>[k,getState()[k]||[]])));
    let base=snapshot(),undo=[],redo=[];
    function update(){onUpdate?.({undo:undo.length,redo:redo.length,last:undo.at(-1)?.label||''});}
    function record(label='Alteração no projeto',group='') {
      const next=snapshot(),changes=[];
      for(const key of keys){const before=new Map(base[key].map(r=>[r.id,r])),after=new Map(next[key].map(r=>[r.id,r]));
        for(const id of new Set([...before.keys(),...after.keys()])){const a=before.get(id),b=after.get(id);
          if(!a||!b){changes.push({key,id,before:a?clone(a):null,after:b?clone(b):null});continue;}
          const fields={};for(const field of new Set([...Object.keys(a),...Object.keys(b)])){if(field==='updatedAt'||same(a[field],b[field]))continue;fields[field]={before:clone(a[field]),after:clone(b[field])};}
          if(Object.keys(fields).length)changes.push({key,id,fields});
        }
      }
      base=next;if(!changes.length)return null;
      const at=Date.now(),previous=undo.at(-1);
      if(group&&previous?.group===group&&at-previous.at<1400){
        for(const change of changes){const old=previous.changes.find(x=>x.key===change.key&&x.id===change.id);
          if(old?.fields&&change.fields){for(const [field,delta] of Object.entries(change.fields)){if(old.fields[field])old.fields[field].after=delta.after;else old.fields[field]=delta;}}
          else previous.changes.push(change);
        }
        previous.at=at;
      } else undo.push({label,group,at,changes});
      if(undo.length>40)undo.shift();redo=[];update();return undo.at(-1);
    }
    function apply(direction) {
      const from=direction==='undo'?undo:redo,to=direction==='undo'?redo:undo,entry=from.at(-1);if(!entry)return {applied:false};
      const next=snapshot(),applied=[],expected=direction==='undo'?'after':'before',destination=direction==='undo'?'before':'after';let conflicts=0;
      for(const change of entry.changes){const list=next[change.key],index=list.findIndex(r=>r.id===change.id),current=list[index];
        if(change.fields){if(!current){conflicts++;continue;}const kept={};
          for(const [field,delta] of Object.entries(change.fields)){if(!same(current[field],delta[expected])){conflicts++;continue;}if(delta[destination]===undefined)delete current[field];else current[field]=clone(delta[destination]);kept[field]=delta;}
          if(Object.keys(kept).length){current.updatedAt=new Date().toISOString();applied.push({...change,fields:kept});}
        }else{
          if(!same(comparable(current||null),comparable(change[expected]))){conflicts++;continue;}
          if(change[destination]===null){if(index>=0)list.splice(index,1);}else if(index>=0)list[index]=clone(change[destination]);else list.push(clone(change[destination]));
          applied.push(change);
        }
      }
      // Removing an item that acquired children elsewhere must not leave orphaned records.
      try{validate(next);}catch{return {applied:false,conflicts:true};}
      from.pop();if(applied.length){for(const key of keys)getState()[key]=next[key];to.push({...entry,group:'',changes:applied});}
      base=snapshot();update();onApplied?.({direction,label:entry.label,conflicts,applied:applied.length>0});return {applied:applied.length>0,conflicts};
    }
    update();return {record,undo:()=>apply('undo'),redo:()=>apply('redo'),sync:()=>{base=snapshot();},last:()=>undo.at(-1)};
  }
  window.CFF_TASKS_PROJECT_HISTORY = {create};
})();
