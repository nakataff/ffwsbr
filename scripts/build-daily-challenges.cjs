'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const rank=(items,key)=>items.map(value=>({value,hash:crypto.createHash('sha256').update(key+value).digest('hex')})).sort((a,b)=>a.hash.localeCompare(b.hash)).map(x=>x.value);
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function generate(){
 const roster=read('ffws-br-2026-s2/players.json'),photos=read('player-data/photo-map.json').photos,history=read('player-data/passagens.json').players;
 const people=roster.players.filter(p=>p.starter===true),unique=people.filter(p=>people.filter(x=>norm(x.name)===norm(p.name)).length===1),names=unique.map(p=>p.name),questions=[];
 const others=(name,n)=>rank(names.filter(x=>norm(x)!==norm(name)),name).slice(0,n);
 for(const p of unique){const imagePath=photos[norm(p.name)];if(!imagePath||/silhueta|escudo/i.test(imagePath)||!fs.existsSync(path.join(root,imagePath))||fs.statSync(path.join(root,imagePath)).size>512*1024)continue;
  questions.push({id:'built-player-'+norm(p.name),kind:'player',prompt:'Quem é o jogador que aparece nesta foto?',category:'Reconheça o jogador',options:[p.name,...others(p.name,3)],answer:0,imagePath,explanation:'O jogador da imagem é '+p.name+'. Foto do cadastro da Central.',sourceUrl:'https://centralfreefire.com.br/jogador.html?jogador='+encodeURIComponent(p.name),enabled:true});
 }
 const groups=new Map();for(const p of unique){if(!groups.has(p.team))groups.set(p.team,[]);groups.get(p.team).push(p);}
 for(const [team,members]of groups){if(members.length!==4)continue;const correct=members.map(p=>p.name),distractors=rank(names.filter(n=>!correct.some(x=>norm(x)===norm(n))),team).slice(0,4);if(distractors.length!==4)continue;
  questions.push({id:'built-lineup-'+norm(team),kind:'lineup',prompt:'Selecione os 4 titulares de '+team+' no cadastro de inscrição da '+roster.tournament+'.',category:roster.tournament+' · Inscrição',options:[...correct,...distractors],answers:[0,1,2,3],pickCount:4,explanation:'Titulares marcados na inscrição: '+correct.join(', ')+'. Reservas e mudanças durante o campeonato não entram neste desafio.',sourceUrl:'https://centralfreefire.com.br/equipe.html?time='+encodeURIComponent(team),enabled:true});
 }
 const histories=Object.values(history).filter(p=>p.history?.every(h=>!h.cargo||/^jogador$/i.test(h.cargo))).map(p=>({...p,teams:[...new Set(p.history.map(h=>h.team).filter(Boolean))]}));
 const teamKey=t=>norm(t).replace('snickers','').replace('w7m','');
 const known=new Set();for(const p of histories){const name=norm(p.name);if(p.teams.length<3||known.has(name)||histories.filter(x=>norm(x.name)===name).length!==1)continue;
  const clues=p.teams.slice(-4);if(histories.filter(x=>clues.every(t=>x.teams.some(v=>teamKey(v)===teamKey(t)))).length!==1)continue;
  const wrong=rank(histories.filter(x=>norm(x.name)!==name).map(x=>x.name).filter((x,i,a)=>a.findIndex(v=>norm(v)===norm(x))===i),p.id).slice(0,3);if(wrong.length!==3)continue;
  known.add(name);questions.push({id:'built-career-'+name,kind:'career',prompt:'Qual jogador tem passagens por todas estas equipes?',category:'Pistas da carreira',clues,options:[p.name,...wrong],answer:0,explanation:p.name+' tem estas equipes no histórico de passagens da Central. As pistas não afirmam uma ordem de transferências.',sourceUrl:'https://centralfreefire.com.br/carreira.html?id='+encodeURIComponent(p.id),enabled:true});
 }
 const version=crypto.createHash('sha256').update(JSON.stringify(questions)).digest('hex').slice(0,20);return{version,questions};
}
if(require.main===module){const bank=generate(),target=process.argv[2]||path.join(root,'functions/daily-challenges-seed.js');fs.writeFileSync(target,"'use strict';\nmodule.exports="+JSON.stringify(bank)+';\n',{mode:0o600});console.log(JSON.stringify({generated:bank.questions.length,counts:Object.fromEntries(['player','career','lineup'].map(kind=>[kind,bank.questions.filter(q=>q.kind===kind).length])),version:bank.version}));}
module.exports={generate};
