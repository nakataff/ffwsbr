'use strict';

// Runs only on authenticated team operations. Never refreshes a persisted team
// or infers an affiliation from a past tournament roster.
module.exports = function({sql,rows,transaction,key,catalog}) {
 let ready=false;
 function ensure() {
  if(ready||!catalog)return;
  const marker='team-catalog:'+catalog.version;
  if(rows('SELECT value FROM career_meta WHERE id=?',marker).length){ready=true;return;}
  transaction(()=>{
   if(rows('SELECT value FROM career_meta WHERE id=?',marker).length)return;
   let added=0;
   for(const item of catalog.teams) {
    // Existing identity and alias assignments always take precedence, including
    // manually merged teams, renamed clubs and custom crests.
    if(rows('SELECT id FROM career_teams WHERE id=?',item.id).length)continue;
    if(rows('SELECT team FROM career_team_aliases WHERE alias=? LIMIT 1',key(item.name)).length)continue;
    const team={...item,revision:1};
    sql.exec('INSERT INTO career_teams VALUES(?,?,?,?)',team.id,team.name,key(team.name),JSON.stringify(team));
    for(const alias of new Set([team.id,team.name,...team.aliases||[]].map(key).filter(Boolean)))
     sql.exec('INSERT OR IGNORE INTO career_team_aliases VALUES(?,?)',alias,team.id);
    added++;
   }
   if(added)sql.exec("UPDATE career_meta SET value=value+1 WHERE id='version'");
   sql.exec('INSERT INTO career_meta VALUES(?,?)',marker,1);
  });
  ready=true;
 }
 return {ensure};
};
