export const STORY_REVIEW_VERSION = '20261020-story-auto-v1';
const monday = day => `date(${day}, '-' || ((CAST(strftime('%w',${day}) AS INTEGER)+6)%7) || ' days')`;
export const STORY_REVIEW_SCHEMA = [
 `CREATE TABLE IF NOT EXISTS story_reviews (
 mention_key TEXT PRIMARY KEY,user_key TEXT NOT NULL,instagram_id TEXT NOT NULL,username TEXT NOT NULL,
 account_id TEXT NOT NULL DEFAULT '',story_id TEXT NOT NULL,message_id TEXT NOT NULL DEFAULT '',media_url TEXT NOT NULL DEFAULT '',
 event_at INTEGER NOT NULL,day_key TEXT NOT NULL,week_key TEXT NOT NULL,received_at INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 post_key TEXT NOT NULL DEFAULT '',post_url TEXT NOT NULL DEFAULT '',published_at INTEGER NOT NULL DEFAULT 0,
 verification TEXT NOT NULL DEFAULT '',reviewed_at INTEGER NOT NULL DEFAULT 0,reviewed_by TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '',points INTEGER NOT NULL DEFAULT 5 CHECK(points=5))`,
 "DELETE FROM community_response_cache WHERE cache_key LIKE 'ranking:%' AND NOT EXISTS(SELECT 1 FROM community_period_versions WHERE period_key='policy:story-review-v1')",
 "INSERT OR IGNORE INTO community_period_versions(period_key,version) VALUES('policy:story-review-v1',1)",
 'CREATE INDEX IF NOT EXISTS idx_story_reviews_queue ON story_reviews(status,event_at,mention_key)',
 'CREATE INDEX IF NOT EXISTS idx_story_reviews_user_week ON story_reviews(user_key,week_key,status)',
 "CREATE UNIQUE INDEX IF NOT EXISTS idx_story_review_post_once ON story_reviews(user_key,post_key) WHERE status='approved'",
 'DROP TRIGGER IF EXISTS cff_story_review_guard',
 `CREATE TRIGGER IF NOT EXISTS cff_story_review_guard_auto_v1 BEFORE UPDATE ON story_reviews
 WHEN NEW.status='approved' AND OLD.status='pending' BEGIN
 SELECT CASE WHEN NEW.post_key='' OR NEW.published_at<=0 OR NEW.verification NOT IN ('meta','manual','auto') OR (NEW.verification<>'auto' AND NEW.post_url='') OR (NEW.verification='auto' AND (NEW.post_key<>'auto:'||NEW.story_id OR NEW.published_at<>NEW.event_at))
 THEN RAISE(ABORT,'story_missing_post') END;
 SELECT CASE WHEN ${monday("date(NEW.published_at/1000,'unixepoch','-3 hours')")}<>NEW.week_key OR NEW.published_at>NEW.event_at+300000
 THEN RAISE(ABORT,'story_wrong_week') END;
 SELECT CASE WHEN (SELECT COUNT(*) FROM awards WHERE user_key=NEW.user_key AND day_key=NEW.day_key AND type='story')>=3
 THEN RAISE(ABORT,'story_daily_limit') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM awards WHERE award_key=NEW.mention_key)
 THEN RAISE(ABORT,'story_already_awarded') END;
 END`,
 `CREATE TRIGGER IF NOT EXISTS cff_story_review_credit AFTER UPDATE ON story_reviews
 WHEN NEW.status='approved' AND OLD.status='pending' BEGIN
 INSERT INTO awards(award_key,user_key,username,type,source_id,points,day_key,month_key,created_at)
 VALUES(NEW.mention_key,NEW.user_key,NEW.username,'story',NEW.post_key,NEW.points,NEW.day_key,substr(NEW.day_key,1,7),NEW.event_at);
 INSERT INTO users(user_key,instagram_id,username,points_all,story_mentions_all,comments_all,active_days_all,last_interaction_at)
 VALUES(NEW.user_key,NEW.instagram_id,NEW.username,NEW.points,1,0,
 CASE WHEN EXISTS(SELECT 1 FROM active_days WHERE user_key=NEW.user_key AND day_key=NEW.day_key) THEN 0 ELSE 1 END,NEW.event_at)
 ON CONFLICT(user_key) DO UPDATE SET instagram_id=excluded.instagram_id,username=excluded.username,
 points_all=users.points_all+excluded.points_all,story_mentions_all=users.story_mentions_all+1,
 active_days_all=users.active_days_all+excluded.active_days_all,last_interaction_at=MAX(users.last_interaction_at,excluded.last_interaction_at);
 INSERT INTO monthly_users(month_key,user_key,username,points,story_mentions,comments,active_days,last_interaction_at)
 VALUES(substr(NEW.day_key,1,7),NEW.user_key,NEW.username,NEW.points,1,0,
 CASE WHEN EXISTS(SELECT 1 FROM active_days WHERE user_key=NEW.user_key AND day_key=NEW.day_key) THEN 0 ELSE 1 END,NEW.event_at)
 ON CONFLICT(month_key,user_key) DO UPDATE SET username=excluded.username,points=monthly_users.points+excluded.points,
 story_mentions=monthly_users.story_mentions+1,active_days=monthly_users.active_days+excluded.active_days,
 last_interaction_at=MAX(monthly_users.last_interaction_at,excluded.last_interaction_at);
 INSERT OR IGNORE INTO active_days(user_key,day_key) VALUES(NEW.user_key,NEW.day_key);
 INSERT INTO story_daily(user_key,day_key,count) VALUES(NEW.user_key,NEW.day_key,1)
 ON CONFLICT(user_key,day_key) DO UPDATE SET count=count+1;
 END`,
 // One transaction-local context row makes ledger reversals use bounded deltas.
 'CREATE TABLE IF NOT EXISTS story_rejection_context (mention_key TEXT PRIMARY KEY,user_key TEXT NOT NULL,week_key TEXT NOT NULL)',
 `CREATE TRIGGER IF NOT EXISTS cff_story_rejection_delta_v1 AFTER DELETE ON awards
 WHEN EXISTS(SELECT 1 FROM story_rejection_context WHERE user_key=OLD.user_key AND OLD.day_key BETWEEN week_key AND date(week_key,'+6 days')) BEGIN
 UPDATE users SET points_all=MAX(0,points_all-OLD.points),story_mentions_all=MAX(0,story_mentions_all-CASE WHEN OLD.type='story' THEN 1 ELSE 0 END) WHERE user_key=OLD.user_key;
 UPDATE monthly_users SET points=MAX(0,points-OLD.points),story_mentions=MAX(0,story_mentions-CASE WHEN OLD.type='story' THEN 1 ELSE 0 END) WHERE user_key=OLD.user_key AND month_key=OLD.month_key;
 UPDATE users SET active_days_all=MAX(0,active_days_all-1) WHERE user_key=OLD.user_key AND OLD.type='story'
 AND EXISTS(SELECT 1 FROM active_days WHERE user_key=OLD.user_key AND day_key=OLD.day_key)
 AND NOT EXISTS(SELECT 1 FROM awards WHERE user_key=OLD.user_key AND day_key=OLD.day_key AND type IN ('comment','story','checkin','prediction_vote','bonus_code'));
 UPDATE monthly_users SET active_days=MAX(0,active_days-1) WHERE user_key=OLD.user_key AND month_key=OLD.month_key AND OLD.type='story'
 AND EXISTS(SELECT 1 FROM active_days WHERE user_key=OLD.user_key AND day_key=OLD.day_key)
 AND NOT EXISTS(SELECT 1 FROM awards WHERE user_key=OLD.user_key AND day_key=OLD.day_key AND type IN ('comment','story','checkin','prediction_vote','bonus_code'));
 DELETE FROM active_days WHERE user_key=OLD.user_key AND day_key=OLD.day_key AND OLD.type='story'
 AND NOT EXISTS(SELECT 1 FROM awards WHERE user_key=OLD.user_key AND day_key=OLD.day_key AND type IN ('comment','story','checkin','prediction_vote','bonus_code'));
 UPDATE story_daily SET count=MAX(0,count-1) WHERE user_key=OLD.user_key AND day_key=OLD.day_key AND OLD.type='story';
 DELETE FROM story_daily WHERE user_key=OLD.user_key AND day_key=OLD.day_key AND count=0;
 END`,
 `CREATE TRIGGER IF NOT EXISTS cff_story_review_revoke_auto_v1 AFTER UPDATE ON story_reviews
 WHEN OLD.status='approved' AND NEW.status='rejected' BEGIN
 INSERT INTO story_rejection_context(mention_key,user_key,week_key) VALUES(NEW.mention_key,NEW.user_key,NEW.week_key);
 DELETE FROM awards WHERE award_key=NEW.mention_key AND type='story';
 DELETE FROM awards WHERE user_key=NEW.user_key AND day_key BETWEEN NEW.week_key AND date(NEW.week_key,'+6 days') AND (
 type='bonus_mission'
 OR (type='bonus_mix' AND NOT EXISTS(SELECT 1 FROM awards WHERE user_key=NEW.user_key AND day_key BETWEEN NEW.week_key AND date(NEW.week_key,'+6 days') AND type='story'))
 OR (type='bonus_streak_3' AND (SELECT COUNT(*) FROM active_days WHERE user_key=NEW.user_key AND day_key BETWEEN NEW.week_key AND date(NEW.week_key,'+6 days'))<3)
 OR (type='bonus_streak_5' AND (SELECT COUNT(*) FROM active_days WHERE user_key=NEW.user_key AND day_key BETWEEN NEW.week_key AND date(NEW.week_key,'+6 days'))<5)
 OR (type='bonus_streak_7' AND (SELECT COUNT(*) FROM active_days WHERE user_key=NEW.user_key AND day_key BETWEEN NEW.week_key AND date(NEW.week_key,'+6 days'))<7));
 DELETE FROM story_rejection_context WHERE mention_key=NEW.mention_key;
 END`,
 "DELETE FROM community_response_cache WHERE cache_key LIKE 'ranking:%' AND NOT EXISTS(SELECT 1 FROM community_period_versions WHERE period_key='policy:story-auto-v1')",
 "INSERT OR IGNORE INTO community_period_versions(period_key,version) VALUES('policy:story-auto-v1',1)",
];
export function instagramPost(value) {
 try {const url=new URL(String(value||'').trim());if(url.protocol!=='https:'||!['instagram.com','www.instagram.com'].includes(url.hostname)||url.username||url.password||url.port)return null;
 const hit=url.pathname.match(/^\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)\/?$/);if(!hit)return null;
 return {key:hit[1],url:`https://www.instagram.com/p/${hit[1]}/`};}catch{return null}
}
export function storyImage(value){
 try{const url=new URL(String(value||''));const host=url.hostname.toLowerCase();return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(/(?:^|\.)(?:cdninstagram\.com|fbcdn\.net|fbsbx\.com|instagram\.com)$/.test(host))?url.href:''}catch{return ''}
}
export async function queueStory(db,row){
 return db.prepare(`INSERT OR IGNORE INTO story_reviews
 (mention_key,user_key,instagram_id,username,account_id,story_id,message_id,media_url,event_at,day_key,week_key,received_at)
 SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12 WHERE NOT EXISTS(SELECT 1 FROM awards WHERE award_key=?1)`)
 .bind(row.key,row.userKey,row.identity,row.username,row.accountId||'',row.storyId,row.messageId||'',storyImage(row.mediaUrl),row.timestamp,row.dayKey,row.weekKey,Date.now()).run();
}
export async function reviewStory(db,key,decision,post,actor,note=''){
 const row=await db.prepare('SELECT * FROM story_reviews WHERE mention_key=?1').bind(key).first();
 if(!row)return {status:404,error:'Story não encontrado.'};
 if(row.status!=='pending'&&!(row.status==='approved'&&decision==='rejected'))return row.status===decision?{status:200,alreadyReviewed:true,row}:{status:409,error:'Esse story já foi revisado.'};
 if(decision==='approved'&&(!post?.key||(post.verification!=='auto'&&!post.url)||!Number.isFinite(post.publishedAt)||post.publishedAt<=0))return{status:400,error:'Informe a publicação original e sua data.'};
 try{
 const result=await db.prepare(`UPDATE story_reviews SET status=?1,post_key=?2,post_url=?3,published_at=?4,verification=?5,
 reviewed_at=?6,reviewed_by=?7,note=?8 WHERE mention_key=?9 AND status=?10`)
 .bind(decision,post?.key||row.post_key,post?.url||row.post_url,post?.publishedAt||row.published_at,post?.verification||row.verification,Date.now(),actor,String(note).slice(0,300),key,row.status).run();
 const saved=await db.prepare('SELECT * FROM story_reviews WHERE mention_key=?1').bind(key).first();
 return saved.status===decision?{status:200,alreadyReviewed:!result.meta?.changes,changed:!!result.meta?.changes,reversed:!!result.meta?.changes&&row.status==='approved'&&decision==='rejected',row:saved}:{status:409,error:'Outra revisão já foi registrada.'};
 }catch(error){const text=String(error?.message||error);
 const messages=[['story_wrong_week','O post original precisa ser da mesma semana do story e publicado antes dele.'],['story_daily_limit','Esta pessoa já tem 3 stories pontuados nesse dia.'],['story_missing_post','Confirme a publicação original antes de aprovar.'],['story_already_awarded','Esse story já recebeu pontos.'],['story_reviews.user_key, story_reviews.post_key','Esta publicação já pontuou para essa pessoa.']];
 const found=messages.find(([code])=>text.includes(code));if(found)return {status:409,error:found[1]};throw error;
 }
}

// A signed mention proves receipt, not the original post visible inside the image.
// Auto mode deduplicates the story ID and keeps the existing 3/day atomic cap.
export async function autoApproveStory(db,key){
 const row=await db.prepare('SELECT * FROM story_reviews WHERE mention_key=?1').bind(key).first();
 if(!row)return {status:200,alreadyReviewed:true,row:null};
 if(row.status!=='pending')return {status:200,alreadyReviewed:true,row};
 const result=await reviewStory(db,key,'approved',{key:'auto:'+row.story_id,url:'',publishedAt:row.event_at,verification:'auto'},'system:auto');
 if(result.error&&result.error.includes('3 stories'))return reviewStory(db,key,'rejected',null,'system:auto','Limite diário: esta pessoa já recebeu pontos por 3 stories neste dia.');
 return result;
}
