const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),zlib=require('zlib'),{JSDOM}=require('jsdom');
test('queued radio clear runs normally, but cannot erase a newer placement or a replaced drop row',async()=>{
 const w=new JSDOM('<div class="team-row"><input id="place-A" value="12"><input type="radio" data-v46-position="12" checked></div>',{runScripts:'outside-only'}).window;
 try{
 const core=zlib.gunzipSync(fs.readFileSync('admin-camp-ao-vivo/app.js.gz')).toString();const start=core.indexOf('    const placementEditRevisionsV47 = new WeakMap();'),end=core.indexOf("    document.addEventListener('change', event =>",start);assert(start>0&&end>start);
 w.eval(core.slice(start,end));let cleared=0;w.clearSimplePlacementPickV47=()=>cleared++;const radio=w.document.querySelector('[data-v46-position]'),field=w.document.querySelector('#place-A');
 const click=()=>{radio.checked=true;radio.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true}));radio.click()};
 click();field.value='6';field.dispatchEvent(new w.Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,30));assert.equal(cleared,0);
 click();await new Promise(r=>setTimeout(r,30));assert.equal(cleared,1);
 click();radio.closest('.team-row').remove();await new Promise(r=>setTimeout(r,30));assert.equal(cleared,1);
 }finally{w.close()}
});
