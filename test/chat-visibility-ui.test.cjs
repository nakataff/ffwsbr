const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
test('account menu places an accessible chat switch below Edit profile and remembers it when reopened',()=>{
 const dom=new JSDOM('<body><header class="nav-desktop-right"><button data-account-entry>Perfil</button></header></body>',{url:'https://centralfreefire.com.br',runScripts:'outside-only'}),w=dom.window;
 try{
  Object.assign(w,{$:id=>w.document.getElementById(id),esc:String,user:{displayName:'Pessoa'},profile:{},login(){throw Error('Unexpected login');},button:()=>'<button>Sair</button>',updateAccountAccess(){}});
  w.fetch=()=>{throw Error('Preference must not use the network');};
  w.eval(fs.readFileSync('js/chat-visibility.mjs','utf8').replace(/^export /gm,''));
  const source=fs.readFileSync('js/public-account.js','utf8');
  w.eval(source.slice(source.indexOf('function injectAccountAccess(){'),source.indexOf('function updateAccountAccess(){')));
  w.injectAccountAccess();const entry=w.document.querySelector('[data-account-entry]');entry.click();
  let control=w.document.querySelector('[data-chat-visibility-toggle]');
  assert.equal(control.previousElementSibling.textContent,'Editar perfil');
  assert.equal(control.getAttribute('role'),'switch');assert.equal(control.getAttribute('aria-checked'),'true');
  control.click();assert.equal(control.getAttribute('aria-checked'),'false');assert.equal(w.localStorage.getItem('cff-chat-visible-v1'),'0');
  entry.click();assert.equal(w.document.getElementById('cff-account-menu'),null);entry.click();
  control=w.document.querySelector('[data-chat-visibility-toggle]');assert.equal(control.getAttribute('aria-checked'),'false');
  w.localStorage.setItem('cff-chat-visible-v1','1');w.dispatchEvent(new w.StorageEvent('storage',{key:'cff-chat-visible-v1',newValue:'1'}));
  assert.equal(control.getAttribute('aria-checked'),'true');
 }finally{w.close();}
});
