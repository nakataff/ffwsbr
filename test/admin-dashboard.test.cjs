const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
function fixture(saved){
 const html=fs.readFileSync(require.resolve('../admin.html'),'utf8'),dom=new JSDOM(html,{url:'https://centralfreefire.com.br/admin.html',runScripts:'outside-only'}),w=dom.window;
 w.HTMLElement.prototype.scrollIntoView=function(){this.dataset.scrolled='true';};w.CFF_CONFIG={firebase:{}};w.getApps=()=>[{}];w.getApp=()=>({});w.getAuth=()=>({currentUser:null});w.getDatabase=()=>({});w.onAuthStateChanged=(_,callback)=>callback(null);w.ref=(_,path)=>path;w.get=async()=>({val:()=>null});
 if(saved)w.localStorage.setItem('cff_admin_section_v2',saved);
 function evaluate(path){w.eval(fs.readFileSync(require.resolve('../'+path),'utf8').replace(/^import .*\n/gm,'').replace(/^export /gm,''));}
 evaluate('js/admin-dashboard-layout.mjs');evaluate('js/admin-sections-titles.js');w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 const $=selector=>w.document.querySelector(selector);return {w,$,evaluate,close:()=>w.close()};
}
test('the actual dashboard keeps authentication hidden, starts on overview and retains all tools in three searchable groups',()=>{
 const f=fixture();try{assert(f.$('#admin-dashboard').hidden);assert.equal(f.$('#admin-logout').hidden,true);assert.equal(f.$('#admin-abuse-tools').hidden,true);assert.equal(f.w.document.querySelectorAll('.admin-workspace').length,1);assert.equal(f.w.document.querySelectorAll('.admin-area-tab').length,6);assert.equal(f.$('[data-admin-view="overview"]').hidden,false);assert.equal(f.$('[data-admin-view="tools"]').hidden,true);assert.equal(f.w.document.querySelectorAll('.admin-central-tools-panel .admin-central-tool').length,20);assert.equal(f.w.document.querySelectorAll('.admin-tool-group').length,3);assert(f.$('.admin-central-tools-panel a[href="admin-ranking-anual.html"]'));assert(f.$('.admin-central-tools-panel a[href="admin-carreiras.html?sec=teams"]'));assert.equal(f.w.document.querySelectorAll('[data-admin-quick-links] .admin-central-tool').length,6);
 const ids=[...f.w.document.querySelectorAll('[id]')].map(n=>n.id);assert.equal(ids.length,new Set(ids).size);assert.equal(f.$('#stat-page-views').closest('[data-admin-view]').dataset.adminView,'overview');assert.equal(f.$('#ga-client-id').closest('[data-admin-view]').dataset.adminView,'analytics');assert.equal(f.$('#cff-title-form').closest('[data-admin-view]').dataset.adminView,'titles');
 const original=fs.readFileSync(require.resolve('../admin.html'),'utf8'),source=new JSDOM(original);const links=[...source.window.document.querySelectorAll('.admin-central-tool')].map(n=>n.getAttribute('href')).sort();assert.deepEqual([...f.w.document.querySelectorAll('.admin-central-tools-panel .admin-central-tool')].map(n=>n.getAttribute('href')).sort(),links);source.window.close();
 }finally{f.close();}
});
test('navigation preserves news drafts, opens the editor before existing edit handlers and supports keyboard tabs',()=>{
 const f=fixture();try{f.$('#admin-dashboard').hidden=false;f.$('#admin-login').hidden=true;f.$('[data-admin-tab="news"]').click();assert.equal(f.$('#admin-news-list-panel').hidden,false);assert.equal(f.$('#admin-news-editor-panel').hidden,true);f.$('[data-admin-news-mode="editor"]').click();f.$('#news-title').value='Rascunho em andamento';f.$('[data-admin-tab="tools"]').click();f.$('[data-admin-tab="news"]').click();assert.equal(f.$('#news-title').value,'Rascunho em andamento');assert.equal(f.$('#admin-news-editor-panel').hidden,false);
 f.$('[data-admin-news-mode="list"]').click();const edit=f.w.document.createElement('button');edit.dataset.editNews='test';f.$('#admin-news-list').append(edit);let visibleInHandler=false;edit.addEventListener('click',()=>visibleInHandler=!f.$('#admin-news-editor-panel').hidden);edit.click();assert.equal(visibleInHandler,true);
 f.$('[data-admin-tab="news"]').dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'End',bubbles:true}));assert.equal(f.$('[data-admin-tab="tools"]').getAttribute('aria-selected'),'true');assert.equal(f.w.document.activeElement,f.$('[data-admin-tab="tools"]'));
 f.$('[data-admin-tab="tools"]').dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));assert.equal(f.$('[data-admin-tab="overview"]').getAttribute('aria-selected'),'true');
 }finally{f.close();}
});
test('new and existing live and title actions open their collapsed forms before editing, without replacing form nodes',()=>{
 const f=fixture();try{const form=f.$('#admin-live-form'),details=f.$('#admin-live-editor-disclosure');assert.equal(details.open,false);assert.equal(f.$('#admin-title-editor-disclosure').open,false);let newClicks=0;f.$('#admin-new-live').addEventListener('click',()=>{assert(details.open);newClicks++;});f.$('[data-admin-new="live"]').click();assert.equal(newClicks,1);assert.equal(f.$('#admin-live-form'),form);assert.equal(f.$('[data-admin-view="lives"]').hidden,false);
 details.open=false;const edit=f.w.document.createElement('button');edit.dataset.editLive='test';f.$('#admin-live-list').append(edit);let openInHandler=false;edit.addEventListener('click',()=>openInHandler=details.open);edit.click();assert(openInHandler);
 details.open=false;form.querySelector('input[required]').dispatchEvent(new f.w.Event('invalid',{bubbles:false}));assert(details.open);f.$('#cff-title-new').click();assert(f.$('#admin-title-editor-disclosure').open);assert.equal(f.$('[data-admin-view="titles"]').hidden,false);
 }finally{f.close();}
});
test('tool search handles accents, category intersections, empty results and reset without losing shortcuts',()=>{
 const f=fixture();try{f.$('[data-admin-tab="tools"]').click();const input=f.$('#admin-tool-search'),shown=()=>[...f.w.document.querySelectorAll('.admin-central-tools-panel .admin-central-tool')].filter(n=>!n.hidden),search=text=>{input.value=text;input.dispatchEvent(new f.w.Event('input',{bubbles:true}));};
 search('insignias');assert.deepEqual(shown().map(a=>a.getAttribute('href')).sort(),['admin-perfis.html','admin-perfis.html?tab=send']);assert(f.$('[data-admin-quick-links] a[href="admin-perfis.html?tab=send"]'));search('moedas');assert.equal(shown().length,1);assert.equal(shown()[0].getAttribute('href'),'admin-pontos.html');f.$('[data-admin-tool-filter="championships"]').click();assert.equal(shown().length,0);assert.equal(f.$('.admin-tools-empty').hidden,false);f.$('[data-admin-reset-tools]').click();assert.equal(shown().length,20);assert.equal(input.value,'');assert.equal(f.$('[data-admin-tool-filter="all"]').getAttribute('aria-pressed'),'true');
 search('mensagens');assert.deepEqual(shown().map(a=>a.getAttribute('href')),['admin-mensagens.html']); search('PRESENTES');assert(shown().length>=2);f.$('[data-admin-clear-search]').click();assert.equal(shown().length,20);search('nao existe');input.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(shown().length,20);
 }finally{f.close();}
});
test('saved sections are restored safely and the layout does not duplicate on reinitialization',()=>{
 const f=fixture('tools');try{assert.equal(f.$('[data-admin-view="tools"]').hidden,false);assert.equal(f.w.mountAdminDashboard(f.$('#admin-dashboard')),null);assert.equal(f.w.document.querySelectorAll('.admin-workspace').length,1);assert.equal(f.w.document.querySelectorAll('#cff-title-form').length,1);}finally{f.close();}
 const invalid=fixture('not-a-section');try{assert.equal(invalid.$('[data-admin-view="overview"]').hidden,false);}finally{invalid.close();}
});
