const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('promotion data rejects active content and oversize inputs, and renders one safe link per card',async()=>{
 const {normalize,DEFAULTS,cardHtml}=await import('../js/home-promos-model.mjs');
 const clean=normalize(structuredClone(DEFAULTS));assert.equal(clean.cards.length,4);
 for(const value of ['javascript:alert(1)','data:text/html,test','https://user:pass@example.com'])assert.throws(()=>normalize({...clean,cards:[{...clean.cards[0],href:value}]}));
 assert.throws(()=>normalize({...clean,cards:Array(9).fill(clean.cards[0])}));
 assert.throws(()=>normalize({...clean,cards:[{...clean.cards[0],image:'data:image/svg+xml;base64,AAAA'}]}));
 const dom=new JSDOM(cardHtml({...clean.cards[0],title:'<img src=x onerror=alert(1)>'}));
 assert.equal(dom.window.document.querySelectorAll('a').length,1);assert.equal(dom.window.document.querySelectorAll('img').length,0);
 assert(dom.window.document.querySelector('h2').textContent.includes('<img'));dom.window.close();
});
test('publishing is persistent and revision checked, with conflicting editors rejected instead of overwriting',async()=>{
 const {createPromoStore}=await import('../js/promo-store.mjs'),{DEFAULTS}=await import('../js/home-promos-model.mjs');
 let saved=null;
 const store=createPromoStore({read:async()=>structuredClone(saved),transaction:async update=>{const next=update(saved);if(!next)return{committed:false};saved=structuredClone(next);return{committed:true,value:saved};}});
 const first=await store.load(),second=await store.load();assert.deepEqual(first,DEFAULTS);
 first.cards[0].title='Novo anúncio';first.cards.reverse();const result=await store.save(first);assert.equal(result.revision,1);
 assert.equal((await store.load()).cards.at(-1).title,'Novo anúncio');
 await assert.rejects(store.save(second),/outra aba/);assert.equal(saved.revision,1);
});
test('editor previews changes, reorders, hides and saves actual data while preserving edits on a failed save',async()=>{
 const model=await import('../js/home-promos-model.mjs');const dom=new JSDOM('<div id="editor"></div>',{url:'https://centralfreefire.com.br/admin-publi.html',runScripts:'outside-only'}),w=dom.window;
 let saved,fail=false;
 w.normalize=model.normalize;w.cardHtml=model.cardHtml;w.esc=model.esc;w.MAX_CARDS=model.MAX_CARDS;
 w.eval(fs.readFileSync('js/promo-editor.mjs','utf8').replace(/^import .*\n/,'').replace('export function mountPromoEditor','function mountPromoEditor'));
 const root=w.document.querySelector('#editor');const cleanup=w.mountPromoEditor({root,store:{load:async()=>structuredClone(model.DEFAULTS),save:async value=>{if(fail)throw Error('Falha de conexão');saved=structuredClone(value);return{...value,revision:value.revision+1};}}});
 try{await tick();const title=root.querySelector('[name=title]');title.value='Meu novo anúncio';title.dispatchEvent(new w.Event('input',{bubbles:true}));assert.match(root.querySelector('[data-preview]').textContent,/Meu novo anúncio/);
 root.querySelector('[data-move="1"]').click();assert.equal(root.querySelector('[data-card="1"]').getAttribute('aria-pressed'),'true');
 const enabled=root.querySelector('[name=enabled]');enabled.checked=false;enabled.dispatchEvent(new w.Event('input',{bubbles:true}));
 root.querySelector('[data-save]').click();await tick();assert.equal(saved.cards[1].title,'Meu novo anúncio');assert.equal(saved.cards[1].enabled,false);assert.match(root.querySelector('[role=status]').textContent,/Publicado/);
 fail=true;root.querySelector('[data-save]').click();await tick();assert.match(root.querySelector('[role=status]').textContent,/Falha de conexão/);assert.equal(root.querySelector('[name=title]').value,'Meu novo anúncio');
 }finally{cleanup();assert.equal(root.textContent,'');w.close();}
});
test('the admin policy exposes only promotions publicly and pins writes to the existing owner UID in both rule files',()=>{
 const rules=JSON.parse(fs.readFileSync('database.rules.json')).rules.homePromotions,example=JSON.parse(fs.readFileSync('firebase-database-rules-admin.example.json')).rules.homePromotions;
 assert.deepEqual(rules,example);assert.equal(rules['.read'],true);assert.match(rules['.write'],/auth.uid == root.child\('serverSecurity'\).child\('adminUid'\).val\(\)/);
 assert.equal(rules.$other['.validate'],false);assert.match(rules.cards['.validate'],/<= 8/);assert.match(rules.cards.$index.href['.validate'],/https/);
});
