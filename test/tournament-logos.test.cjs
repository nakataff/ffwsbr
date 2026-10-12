const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const logos=require('../js/tournament-logos.js');
test('global World Series editions share the supplied asset without changing regional tournament logos',()=>{
 for(const event of ['Free Fire World Series - Global Finals 2024','FFWS Global Finals 2026','Free Fire World Series 2021 Singapore','Free Fire World Series 2022 Sentosa','FFWS 2019','Free Fire World Series 2023'])assert.equal(logos.resolve(event,'old.webp'),logos.GLOBAL_LOGO,event);
 for(const event of ['FFWS Brasil 2026 S2','Free Fire World Series - Brazil 2025 Split 2','FFWS SEA 2026 Fall','FFWS LATAM 2026','EWC 2026','LBFF 2021','Aquecimento do Amoras Pré Mundial'])assert.equal(logos.resolve(event,'old.webp'),'old.webp',event);
 const data=fs.readFileSync(logos.GLOBAL_LOGO.slice(1));assert.equal(data.toString('hex',0,8),'89504e470d0a1a0a');
});
test('the existing league-logo resolver gives World Series global titles the official logo before old maps',()=>{
 const c={window:{cffResolveTournamentLogo:logos.resolve},leagueLogos:{'FREE FIRE WORLD SERIES - GLOBAL FINALS 2024':'wrong.webp','LBFF 2021':'lbff.webp'}};vm.createContext(c);
 const script=fs.readFileSync('js/home-news-lives.min.js','utf8'),start=script.indexOf('function resolveLeagueLogo('),end=script.indexOf('let globalLivesData=',start);vm.runInContext(script.slice(start,end),c);
 assert.equal(c.resolveLeagueLogo('Free Fire World Series - Global Finals 2024'),logos.GLOBAL_LOGO);assert.equal(c.resolveLeagueLogo('LBFF 2021'),'lbff.webp');
});
