'use strict';
// Targeted, versioned repair for two unrelated professionals sharing the Joker nickname.
module.exports=function({sql,rows,transaction,seed,enabled,key,now,records,snapshot,audit,aliases,active}){
 let ready=false;
 function ensure(){
  if(ready||!enabled){ready=true;return;}
  const marker='identity-split:joker-v1',rosterSource='https://liquipedia.net/freefire/Free_Fire_World_Series/Brazil/2026/Split_2';
  if(rows('SELECT value FROM career_meta WHERE id=?',marker).length){ready=true;return;}
  transaction(()=>{
   if(rows('SELECT value FROM career_meta WHERE id=?',marker).length)return;
   const playerRow=rows('SELECT * FROM career_people WHERE id=?','joker')[0];
   const coachRow=rows('SELECT * FROM career_people WHERE id=?','joker-coach')[0];
   const playerSeed=seed.people.find(p=>p.id==='joker'),coachSeed=seed.people.find(p=>p.id==='joker-coach');
   if(!playerRow||!playerSeed||!coachSeed)return;
   const beforePlayer=snapshot('joker'),beforeCoach=coachRow?snapshot('joker-coach'):null;
   const old=JSON.parse(playerRow.data),all=records('joker'),staff=all.filter(t=>t.role!=='player'),playerTenures=all.filter(t=>t.role==='player');
   const {tenures:seedCoachTenures,...baseCoach}=coachSeed;
   let coach=coachRow?JSON.parse(coachRow.data):{...baseCoach};
   if(!coachRow)sql.exec('INSERT INTO career_people VALUES(?,?,?,?,?,?,?)',coach.id,coach.name,key(coach.name),'staff',JSON.stringify(coach),1,now());
   for(const t of staff)sql.exec('UPDATE career_tenures SET person=? WHERE id=? AND person=?','joker-coach',t.id,'joker');
   const coachTenures=records('joker-coach');
   const manualDeparture=old.affiliationSource==='manual'&&['free_agent','retired'].includes(old.availability)&&staff.length&&!staff.some(active);
   let loud=coachTenures.find(t=>t.teamId==='loudsnickers'&&t.role==='head_coach');
   const closed=manualDeparture||loud&&(loud.deleted||loud.status==='ended'||loud.end?.date);
   if(!loud&&!closed){
    const template=seedCoachTenures.find(t=>t.teamId==='loudsnickers');
    if(template){loud={...template,status:'active',source:rosterSource,sourceUrl:rosterSource,start:{date:'',edition:'WB 2026 S2',precision:'edition',certainty:'estimated'},end:{date:'',edition:'',precision:'unknown',certainty:'unknown'},order:Math.max(0,...coachTenures.map(t=>t.order))+1};sql.exec('INSERT INTO career_tenures VALUES(?,?,?,?,?)',loud.id,'joker-coach',loud.teamId,loud.order,JSON.stringify(loud));coachTenures.push(loud);}
   }else if(loud?.status==='unverified'&&!closed){loud.status='active';loud.source=rosterSource;loud.sourceUrl=rosterSource;sql.exec('UPDATE career_tenures SET data=? WHERE id=?',JSON.stringify(loud),loud.id);}
   coach={...coach,id:'joker-coach',kind:'staff',defaultRole:'head_coach',aliases:[...new Set([...(coach.aliases||[]).filter(n=>key(n)!=='joker'),'JOKER (coach)','JOKER Coach','JOKER (Brazilian Coach)'])]};
   if(manualDeparture){for(const k of ['availability','affiliationSource','affiliationEdition','freeAgentSince','freeAgentReason'])if(old[k]!==undefined)coach[k]=old[k];}
   else if(coachTenures.some(active)){coach.availability='active';coach.currentTeamHint='LOUD SNICKERS';coach.affiliationSource='staffRoster';coach.affiliationEdition='WB 2026 S2';delete coach.freeAgentSince;delete coach.freeAgentReason;}
   if(key(coach.name)==='joker')coach.name='JOKER (coach)';
   sql.exec('UPDATE career_people SET name=?,norm=?,kind=?,data=? WHERE id=?',coach.name,key(coach.name),'staff',JSON.stringify(coach),'joker-coach');
   aliases('joker-coach',['joker-coach',...coach.aliases]);
   let player={...old,id:'joker',name:/coach|treinador/i.test(old.name)?'Joker':old.name,kind:'player',defaultRole:'player',country:'cl',currentTeamHint:'LYON',aliases:(old.aliases||[]).filter(n=>!/coach|treinador/i.test(n))};
   player.aliases=[...new Set([...player.aliases,'Joker','JOKER'])];delete player.playerRetired;
   // Restore LYON only when the old mixed record had no independent player passage.
   if(!playerTenures.length||old.affiliationSource==='staffRoster'||old.availability==='unknown'&&playerTenures.every(t=>t.teamId==='lyon'&&t.status==='unverified')){
    if(!rows('SELECT id FROM career_teams WHERE id=?','lyon').length){const team=seed.teams.find(t=>t.id==='lyon');sql.exec('INSERT INTO career_teams VALUES(?,?,?,?)',team.id,team.name,key(team.name),JSON.stringify(team));aliases(team.id,[team.id,team.name],'career_team_aliases','team');}
    if(!playerTenures.length){const template=playerSeed.tenures.find(t=>t.teamId==='lyon');const t={...template,id:'identity-joker-lyon-2026',status:'active',start:{date:'',edition:'EWC 2026',precision:'edition',certainty:'estimated'},end:{date:'',edition:'',precision:'unknown',certainty:'unknown'}};sql.exec('INSERT INTO career_tenures VALUES(?,?,?,?,?)',t.id,'joker',t.teamId,t.order,JSON.stringify(t));}
    else for(const t of playerTenures)if(t.teamId==='lyon'&&t.status==='unverified'&&!t.deleted&&!t.end?.date){t.status='active';sql.exec('UPDATE career_tenures SET data=? WHERE id=?',JSON.stringify(t),t.id);}
    player.availability='active';player.affiliationSource='identityRepair';player.affiliationEdition='EWC 2026';delete player.freeAgentSince;delete player.freeAgentReason;
   }
   sql.exec('UPDATE career_people SET name=?,norm=?,kind=?,data=? WHERE id=?',player.name,key(player.name),'player',JSON.stringify(player),'joker');aliases('joker',['joker',...player.aliases]);
   sql.exec('CREATE TABLE IF NOT EXISTS career_roster_participations(person TEXT,competition TEXT,team TEXT,role TEXT,tenure TEXT,source TEXT,PRIMARY KEY(person,competition,team,role));');
   sql.exec("INSERT OR IGNORE INTO career_roster_participations SELECT ?,competition,team,role,tenure,source FROM career_roster_participations WHERE person=? AND role<>'player'",'joker-coach','joker');
   sql.exec("DELETE FROM career_roster_participations WHERE person=? AND role<>'player'",'joker');
   audit('joker',{uid:'identity-repair'},'identitySplit',beforePlayer);
   audit('joker-coach',{uid:'identity-repair'},manualDeparture?'identitySplitManual':'identitySplit',beforeCoach);
   // Existing market publications keep their IDs and grouped exits; fix only links
   // belonging to the transferred staff passages, using the existing indexes.
   const moved=new Set(staff.map(t=>t.id)),market=new Map(rows('SELECT * FROM career_market WHERE person=?','joker').map(r=>[r.id,r]));
   if(moved.size)for(const r of rows('SELECT * FROM career_market WHERE id IN (SELECT entry FROM career_market_exits WHERE tenure IN ('+[...moved].map(()=>'?').join(',')+'))',...moved))market.set(r.id,r);
   let marketChanged=false;
   for(const row of market.values()){
    const entry=JSON.parse(row.data),before=JSON.stringify({...entry,revision:row.revision});let changed=false;
    if(entry.personId==='joker'&&entry.role&&entry.role!=='player'){entry.personId='joker-coach';entry.name=coach.name;changed=true;}
    for(const m of entry.members||[])if(m.personId==='joker'&&moved.has(m.tenureId)){m.personId='joker-coach';m.name=coach.name;changed=true;}
    if(!changed)continue;if(entry.members?.length)entry.name=entry.members.map(m=>m.name).join(', ');
    entry.careerRevision=rows('SELECT revision FROM career_people WHERE id=?','joker-coach')[0].revision;
    sql.exec('UPDATE career_market SET person=?,data=?,revision=revision+1 WHERE id=?',entry.personId||'',JSON.stringify(entry),row.id);
    sql.exec('INSERT INTO career_market_changes VALUES(?,?,?,?,?)',crypto.randomUUID(),row.id,now(),'identity-repair',JSON.stringify({before:JSON.parse(before),after:{...entry,revision:row.revision+1}}));marketChanged=true;
   }
   if(marketChanged)sql.exec("UPDATE career_market_meta SET value=value+1 WHERE id='version'");
   sql.exec('INSERT INTO career_meta VALUES(?,1)',marker);
  });ready=true;
 }
 return {ensure};
};
