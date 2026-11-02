'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const script=fs.readFileSync(path.join(root,'js/admin-code-acquisitions.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'js/admin-codiguinhos-ui.js'),'utf8');
const html=fs.readFileSync(path.join(root,'admin-codiguinhos.html'),'utf8');
const wait=()=>new Promise(resolve=>setTimeout(resolve,30));
const item={receiptId:'12345678-1234-1234-1234-123456789abc',uid:'test-person',name:'Pessoa Teste',username:'pessoa',title:'Calça Angelical',code:'PRIVATECODE456',payment:'redeem',acquiredAt:Date.parse('2026-11-02T18:00:00-03:00'),openedAt:Date.parse('2026-11-02T18:01:00-03:00'),publicAt:0,status:'done'};
function setup(){
 const dom=new JSDOM('<main><div id="audit"></div></main>',{url:'https://centralfreefire.com.br/admin-codiguinhos.html',runScripts:'outside-only'});
 const w=dom.window,requests=[];
 const body=script.replace(/^import .*;\s*/m,'').replace('export function mountAdminCodeAcquisitions','function mountAdminCodeAcquisitions').replace('export async function bootAdminCodeAcquisitions','async function bootAdminCodeAcquisitions')+ '\nwindow.__audit={mountAdminCodeAcquisitions,csvField};';
 w.economyRequest=async(auth,operation,opts,admin)=>{
  requests.push({operation,opts,admin});return {ok:true,entries:[item],offset:opts.offset||0,limit:30,total:1,coins:1,vouchers:0,hasMore:false};
 };
 w.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 w.loadEconomyStyle=()=>{};
 w.eval(body);
 const auth={currentUser:{uid:'admin',email:'admin@centralfreefire.com.br'}};
 return {dom,w,host:w.document.getElementById('audit'),auth,requests};
}

test('admin consulta resgates reais e exibe somente o código no resumo recolhível',async()=>{
 const {dom,w,host,auth,requests}=setup();
 try{
  const stop=w.__audit.mountAdminCodeAcquisitions(host,{auth});await wait();
  assert.equal(requests[0].operation,'codeAcquisitions');
  assert.equal(requests[0].admin,true);
  assert.match(host.textContent,/1 aquisições/);
  assert.match(host.textContent,/Pessoa Teste|@pessoa/);
  assert.match(host.textContent,/Calça Angelical/);
  assert.match(host.textContent,/PRIVATECODE456/);
  assert.ok(host.querySelector('.eco-code-audit-row-code details:not([open])'));
  const search=host.querySelector('input[name="query"]');
  search.value='pessoa';
  host.querySelector('select[name="source"]').value='coins';
  host.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await wait();
  assert.equal(requests.at(-1).opts.source,'coins');
  assert.equal(requests.at(-1).opts.query,'pessoa');
  stop();
 } finally{dom.window.close();}
});
test('relatório exige email de admin e trata conteúdo como texto sem executar HTML',async()=>{
 const {dom,w,host,auth,requests}=setup();
 try{
  auth.currentUser.email='person@example.test';
  const stop=w.__audit.mountAdminCodeAcquisitions(host,{auth});
  await wait();assert.equal(requests.length,0);
  stop();
  assert.equal(w.__audit.csvField('=HYPERLINK("x")').startsWith('"\''),true,'CSV neutraliza fórmulas');
  assert.equal(w.__audit.csvField('+1+2').startsWith('"\''),true);
  assert.equal(w.__audit.csvField('name;"x"'),'"name;""x"""');
 } finally{dom.window.close();}
});
test('página administrativa insere relatório automático sem remover o manual',()=>{
 assert.match(ui,/eco-code-acquisitions-root/);
 assert.match(ui,/Relatório manual do estoque/);
 assert.match(html,/admin-code-acquisitions\.js\?v=20261102-code-report-v1/);
 assert.match(html,/admin-codiguinhos-ui\.css\?v=20261102-code-report-v1/);
 assert.ok(!fs.readFileSync(path.join(root,'interacoes.html'),'utf8').includes('codeAcquisitions'),'API privada não aparece na página pública');
});
