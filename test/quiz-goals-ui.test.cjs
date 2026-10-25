const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
test('goal metric choices preserve old objectives, match server/rules and are added only once',async()=>{
 const {QUIZ_METRICS,appendQuizGoalOptions}=await import('../js/quiz-goals.mjs'),server=require('../functions/quiz-progress'),rules=JSON.parse(fs.readFileSync('database.rules.json','utf8')).rules.communityBadgeGoals.$goal.metric['.validate'];
 assert.deepEqual(Object.keys(QUIZ_METRICS),server.METRICS);const dom=new JSDOM('<select><option value="total_points">Pontos</option></select>');try{const select=dom.window.document.querySelector('select');appendQuizGoalOptions(select);appendQuizGoalOptions(select);assert.equal(select.options.length,7);assert.equal(select.options[0].value,'total_points');for(const key of server.METRICS){assert(rules.includes(key));select.value=key;assert.equal(select.value,key);}}finally{dom.window.close();}
});
test('knowledge progress uses configured objectives, caps the meter and escapes titles',async()=>{
 const {quizGoalsHtml}=await import('../js/quiz-goals.mjs'),data={goals:{one:{enabled:true,metric:'quiz_correct',target:25,assetId:'badge'},disabled:{enabled:false,metric:'quiz_correct',target:1,assetId:'badge'},two:{enabled:true,metric:'quiz_perfect_days',target:5,assetId:'frame'}},catalog:{badge:{enabled:true,title:'Conhecedor <img src=x onerror=alert(1)>'},frame:{enabled:true,title:'Memória afiada'}},metrics:{quiz_correct:30,quiz_perfect_days:2},loaded:true};
 const dom=new JSDOM(quizGoalsHtml(data));try{const doc=dom.window.document;assert.equal(doc.querySelectorAll('progress').length,2);assert.equal(doc.querySelector('img'),null);assert.equal(doc.querySelectorAll('progress')[0].value,2);assert.equal(doc.querySelectorAll('progress')[1].value,25);assert.match(doc.body.textContent,/30 desafios completos/);assert.match(doc.body.textContent,/Meta atingida/);assert(doc.querySelector('[data-account-action=refresh-quiz-goals]'));assert.equal(quizGoalsHtml({goals:{}}),'');}finally{dom.window.close();}
});

test('the actual account claim refreshes quiz goals without Instagram and discards another account response',async()=>{
 const dom=new JSDOM('',{url:'https://centralfreefire.com.br/conta.html',runScripts:'outside-only'}),w=dom.window,source=fs.readFileSync('js/public-account.js','utf8');let release,rendered=0;
 Object.assign(w,{user:{uid:'alice',getIdToken:async()=>'fixture-token'},communityStatus:null,goalClaimBusy:false,lastGoalClaim:0,lastQuizGoalClaim:0,tab:'inventory',badgeGoals:{},catalog:{},quizAchievementMetrics:{},quizGoalsLoaded:false,render:()=>rendered++,toast:()=>{}});
 w.fetch=async(url,options)=>{assert.equal(JSON.parse(options.body).action,'claimProfileGoals');assert.equal(JSON.parse(options.body).quizOnly,true);return {ok:true,json:()=>new Promise(resolve=>release=resolve)};};
 try{w.eval(source.slice(source.indexOf('async function claimGoalRewards('),source.indexOf('async function loadProfileStats(')));
  let pending=w.claimGoalRewards(true,true);for(let i=0;i<5&&!release;i++)await new Promise(r=>setTimeout(r,0));release({metrics:{quiz_correct:25},unlocked:[]});await pending;assert.equal(w.quizAchievementMetrics.quiz_correct,25);assert.equal(w.quizGoalsLoaded,true);assert.equal(rendered,1);
  release=null;pending=w.claimGoalRewards(true,true);for(let i=0;i<5&&!release;i++)await new Promise(r=>setTimeout(r,0));w.user={uid:'bob'};w.quizAchievementMetrics={};release({metrics:{quiz_correct:999},unlocked:[]});await pending;assert.equal(Object.keys(w.quizAchievementMetrics).length,0);
 }finally{w.close();}
});
