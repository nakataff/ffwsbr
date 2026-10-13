import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {memberSummary,watchMemberSummary} from '../js/admin-member-summary.mjs';
const now=Date.parse('2026-10-13T03:40:00Z');
test('aggregate directory and Instagram reads require the administrative account',()=>{
 const rules=JSON.parse(readFileSync(new URL('../database.rules.json',import.meta.url),'utf8')).rules;
 for(const path of ['communityMembers','communityInstagramLinks']){
  const read=Function('auth','return Boolean('+rules[path]['.read']+')');
  assert.equal(read(null),false);
  assert.equal(read({uid:'fan',token:{email:'fan@example.com'},administrator:true}),false);
  assert.equal(read({uid:'owner',token:{email:'admin@centralfreefire.com.br'}}),true);
 }
});
test('summary counts the whole directory and uses Brazil calendar boundaries for today and seven days',()=>{
 const directory=Object.fromEntries(Array.from({length:80},(_,i)=>['old'+i,{joinedAt:Date.parse('2026-09-01T12:00:00Z')} ]));
 Object.assign(directory,{today:{joinedAt:Date.parse('2026-10-13T03:00:00Z')},yesterday:{joinedAt:Date.parse('2026-10-13T02:59:59Z')},first:{joinedAt:Date.parse('2026-10-07T03:00:00Z')},before:{joinedAt:Date.parse('2026-10-07T02:59:59Z')},future:{joinedAt:now+1000},missing:{},removed:null});
 assert.deepEqual(memberSummary(directory,{},now),{total:86,today:1,week:3,instagram:0});
 assert.equal(memberSummary({x:{joinedAt:Date.parse('2027-01-01T03:00:00Z')}},{},Date.parse('2027-01-02T03:00:00Z')).week,1);
});
test('only current Instagram links for existing accounts count; stale directory names and deleted accounts do not',()=>{
 const directory={a:{instagram:'oldname'},b:{instagram:''},c:{instagram:'legacy'},d:{}};
 const links={b:{username:'new.name'},c:{username:'invalid name'},ghost:{username:'deleted'}};
 assert.equal(memberSummary(directory,links,now).instagram,1);
 assert.deepEqual(memberSummary(null,null,now),{total:0,today:0,week:0,instagram:0});
});
test('live changes, unlinking, deletion, midnight rollover, retry state and cleanup are reflected',()=>{
 let clock=now,tick,cancelled=false;const callbacks={},stopped=[],frames=[];
 const stop=watchMemberSummary({clock:()=>clock,subscribe:(path,next,error)=>{callbacks[path]={next,error};return()=>stopped.push(path);},render:value=>frames.push(value),schedule:fn=>{tick=fn;return 17;},cancel:id=>{assert.equal(id,17);cancelled=true;}});
 assert.equal(frames.at(-1).membersState,'loading');
 callbacks.communityMembers.next({a:{joinedAt:now},b:{joinedAt:now-86400000}});
 assert.equal(frames.at(-1).linksState,'loading');
 callbacks.communityInstagramLinks.next({a:{username:'alice'}});
 assert.deepEqual(frames.at(-1).counts,{total:2,today:1,week:2,instagram:1});
 callbacks.communityInstagramLinks.next({});assert.equal(frames.at(-1).counts.instagram,0);
 callbacks.communityMembers.next({a:{joinedAt:now}});assert.equal(frames.at(-1).counts.total,1);
 clock=Date.parse('2026-10-14T03:00:00Z');tick();assert.equal(frames.at(-1).counts.today,0);
 callbacks.communityInstagramLinks.error();assert.equal(frames.at(-1).linksState,'error');
 callbacks.communityInstagramLinks.next({a:{username:'alice'}});assert.equal(frames.at(-1).linksState,'ready');
 const length=frames.length;stop();callbacks.communityMembers.next({});tick();assert.equal(frames.length,length);assert.equal(stopped.length,2);assert(cancelled);
});
