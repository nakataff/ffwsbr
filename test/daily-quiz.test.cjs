const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const tick=()=>new Promise(r=>setTimeout(r,0));
const base={ok:true,day:'2026-10-19',resetAt:Date.parse('2026-10-20T03:00:00Z'),enabled:true,limit:3,reward:5,earned:0,answered:0,complete:false,roundId:'',questions:[],wallet:{balance:20}};
const questions=Array.from({length:3},(_,index)=>({index,prompt:index?'Pergunta fictícia '+index+'?':'<img src=x onerror=alert(1)> Qual opção?',category:'História',options:['Uma opção','Outra opção','Terceira opção','Última opção']}));
function fixture(request){
 const dom=new JSDOM('<body><div id="root"></div><p id="status"></p></body>',{url:'https://centralfreefire.com.br/conta.html?tab=quiz',runScripts:'outside-only'}),w=dom.window,auth={currentUser:{uid:'person',email:'admin@centralfreefire.com.br'}},root=w.document.querySelector('#root'),calls=[];
 w.economyRequest=async(a,op,b,admin)=>{calls.push({op,b,admin});return request(op,b,admin);};w.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 w.eval(fs.readFileSync(require.resolve('../js/daily-quiz.mjs'),'utf8').replace(/^import .*\n/gm,'').replace(/^export /gm,''));
 const stop=w.mountDailyQuiz(root,{auth,request:w.economyRequest});return {w,root,auth,calls,stop,close:()=>{stop();w.close();}};
}
test('quiz loads only its small status, starts on click and reveals feedback only after server confirmation',async()=>{
 let state=structuredClone(base);const f=fixture(async(op,b)=>{if(op==='quizStart')state={...state,roundId:'round-id',questions:structuredClone(questions)};if(op==='quizAnswer'){assert.deepEqual(JSON.parse(JSON.stringify(b)),{day:'2026-10-19',roundId:'round-id',index:0,choice:1});state={...state,earned:5,answered:1,questions:state.questions.map((q,i)=>i? q:{...q,selected:1,correct:true,correctAnswer:1,explanation:'Explicação recebida do servidor.',sourceUrl:'https://example.com/fonte',coins:5})};}return structuredClone(state);});
 try{await tick();assert.deepEqual(f.calls.map(x=>x.op),['quizStatus']);f.root.querySelector('[data-quiz=start]').click();await tick();assert.equal(f.root.querySelector('legend').textContent,questions[0].prompt);assert.equal(f.root.querySelector('legend img'),null);assert.equal(f.root.querySelector('.cff-quiz-feedback'),null);
  f.root.querySelector('[name=choice][value="1"]').checked=true;f.root.querySelector('form').dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await tick();
  assert.match(f.root.querySelector('.cff-quiz-feedback').textContent,/Acertou! \+5 CFF COINS/);assert(f.root.querySelector('fieldset').disabled);assert.equal(f.root.querySelector('.cff-quiz-feedback a').href,'https://example.com/fonte');
  f.root.querySelector('[data-quiz=next]').click();assert.equal(f.root.querySelector('legend').textContent,questions[1].prompt);assert.equal(f.root.querySelector('.cff-quiz-feedback'),null);assert.deepEqual(f.calls.map(x=>x.op),['quizStatus','quizStart','quizAnswer']);assert(f.calls.every(x=>!x.admin));
 }finally{f.close();}
});
test('a lost answer response keeps the same question and choice for an idempotent retry',async()=>{
 const sent=[];const f=fixture(async(op,b)=>{if(op==='quizAnswer'){sent.push(JSON.parse(JSON.stringify(b)));throw Error('Falha de conexão. Tente novamente.');}return {...base,roundId:'round-id',questions:structuredClone(questions)};});
 try{await tick();f.root.querySelector('[name=choice][value="2"]').checked=true;const submit=()=>f.root.querySelector('form').dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));submit();await tick();assert.match(f.root.querySelector('[role=status]').textContent,/Falha de conexão/);assert(f.root.querySelector('[value="2"]').checked);submit();await tick();assert.deepEqual(sent[0],sent[1]);assert.equal(f.root.querySelector('.cff-quiz-feedback'),null);}finally{f.close();}
});
test('completed quiz shows the earned total and never requests the ranking or full economy state',async()=>{
 const f=fixture(async()=>({...base,roundId:'round-id',complete:true,answered:3,earned:10,questions:questions.map((q,i)=>({...q,selected:0,correct:i!==2,correctAnswer:i===2?1:0,explanation:'Fonte histórica.',sourceUrl:'https://example.com/fonte',coins:i===2?0:5}))}));
 try{await tick();assert.match(f.root.querySelector('.cff-quiz-summary').textContent,/2 de 3/);assert.match(f.root.querySelector('.cff-quiz-summary').textContent,/10 CFF COINS/);assert.deepEqual(f.calls.map(x=>x.op),['quizStatus']);assert.equal(f.root.querySelector('.cff-quiz-summary a').getAttribute('href'),'/conta.html?tab=points');}finally{f.close();}
});
test('stopped or switched accounts discard delayed quiz responses',async()=>{
 let resolve;const f=fixture(()=>new Promise(r=>resolve=r));try{f.stop();f.root.textContent='Outra tela';f.auth.currentUser={uid:'other'};resolve({...base,roundId:'round-id',questions});await tick();assert.equal(f.root.textContent,'Outra tela');}finally{f.close();}
});
test('private admin edits and pauses questions through authenticated operations and clears content on logout',async()=>{
 const dom=new JSDOM('<body><div id="root"></div><p id="status"></p></body>',{url:'https://centralfreefire.com.br/admin-quiz.html',runScripts:'outside-only'}),w=dom.window,root=w.document.querySelector('#root'),status=w.document.querySelector('#status'),auth={currentUser:{uid:'admin',email:'admin@centralfreefire.com.br'}},calls=[];
 let q={id:'synthetic-fixture',prompt:'Qual resposta fictícia está certa neste teste?',category:'Teste fictício',options:['A','B','C','D'],answer:2,explanation:'Explicação de teste.',sourceUrl:'https://example.com/test',enabled:true};
 w.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let source=fs.readFileSync(require.resolve('../js/admin-quiz.js'),'utf8').replace(/^import .*\n/gm,'').replace(/^const app=.*\n/m,'').replace(/^export /gm,'');source=source.slice(0,source.indexOf('let stop=null;onAuthStateChanged'));
 w.eval(source);
 const request=async(a,op,b,admin)=>{assert.equal(admin,true);calls.push({op,b});if(op==='quizConfig')return {config:{count:1,reward:5,enabled:false},total:1};if(op==='quizList')return {entries:[q],offset:0,limit:20,hasMore:false};if(op==='quizImport'){q={...b.questions[0]};return {ok:true};}return {ok:true};};
 const stop=w.mountQuizAdmin(root,status,{auth,request});
 try{await tick();assert.equal(root.hidden,false);root.querySelector('[data-quiz-edit]').click();const form=root.querySelector('[data-quiz-admin=question]');assert.equal(form.elements.answer.value,'2');form.elements.prompt.value='Uma pergunta fictícia editada pelo administrador?';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(calls.find(x=>x.op==='quizImport').b.questions[0].prompt,'Uma pergunta fictícia editada pelo administrador?');root.querySelector('[data-quiz-toggle]').click();await tick();assert.equal(q.enabled,false);stop();assert.equal(root.hidden,true);assert.equal(root.textContent,'');}finally{stop();w.close();}
});
