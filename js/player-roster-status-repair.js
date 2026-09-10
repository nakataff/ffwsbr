(()=>{'use strict';
if(window.__cffPlayerRosterStatusRepair)return;window.__cffPlayerRosterStatusRepair=true;
const V='20260910-player-roster-status-v1';
const initial=new URLSearchParams(location.search);const INITIAL_ID=String(initial.get('id')||initial.get('jogador')||initial.get('player')||'');
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
const S1_NOT_S2=new Set(['keven7','mts007','itzking1','theus','bruno7w','yoko7','razure','ital0','italo','juca10xl','bahiaz7','zetsu9','stark','bielgod','willprodigy','yann7awp','cauan7','rick9z','seupai','drade11','lost21','fixa10','seutio','shotzzrx','master77','wm','caua9','rojao','lucasawp','whiskyx']);
const MTS_CHAIN=[
 {team:'INTZ',edition:'WB 2025 S2',logo:'Intz 1.webp'},
 {team:'AXS FUSION',edition:'WB 2026 S1',logo:'AXS BRANCA.webp'},
 {team:'VASCO ESPORTS',edition:'Pós-WB 2026 S1',logo:'Vasco.webp'}
];
function css(){if(document.getElementById('cff-roster-status-css'))return;const s=document.createElement('style');s.id='cff-roster-status-css';s.textContent=`
.cff-rosterless-badge{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:6px 10px;border:1px solid rgba(134,160,192,.28);border-radius:999px;background:rgba(134,160,192,.07);color:#a9bfd7;font-size:.68rem;font-weight:900;letter-spacing:.04em;text-transform:uppercase}
.team-history-card.cff-former-team{opacity:.9}.team-history-card.cff-former-team .team-history-open{color:#86a0c0}
@media(max-width:620px){.cff-rosterless-badge{white-space:normal;border-radius:10px}.team-history-card{min-width:0}.team-history-card>div{min-width:0}.team-history-card strong,.team-history-card small{overflow-wrap:anywhere}}
`;document.head.appendChild(s)}
function playerName(){return document.querySelector('#player-root .profile-name')?.textContent?.trim()||''}
function isLaffOnly(){const buttons=[...document.querySelectorAll('#player-root [data-basic-season]')];return buttons.length>0&&buttons.some(b=>norm(b.textContent).includes('laff2026s1'))&&!document.querySelector('#player-root [data-player-season="s2"]')}
function isS1Departed(){return S1_NOT_S2.has(norm(playerName()))||S1_NOT_S2.has(norm(INITIAL_ID))}
function currentHeroTeam(){return document.querySelector('#player-root .profile-team')?.textContent?.trim()||''}
function teamLogo(team){return window.cffResolveTeamLogo?.(team)||'escudo.webp'}
function makeHistoryCard(team,edition,logo){const a=document.createElement('a');a.className='team-history-card cff-former-team';a.href=`equipe-historica.html?time=${encodeURIComponent(team)}`;a.innerHTML=`<img class="team-history-logo" src="${logo||teamLogo(team)}" data-team-logo="${team}" loading="lazy" decoding="async" alt="${team}"><div><strong>${team}</strong><small>${edition||'Passagem registrada'}</small></div><span class="team-history-open" aria-hidden="true">Ex-equipe</span>`;return a}
function ensureFormerTeam(team,edition){if(!team)return;const list=document.getElementById('profile-team-history');if(!list)return;const exists=[...list.querySelectorAll('.team-history-card strong')].some(x=>norm(x.textContent)===norm(team));if(exists)return;list.appendChild(makeHistoryCard(team,edition,teamLogo(team)))}
function rebuildMtsHistory(){if(norm(playerName())!=='mts007'&&norm(INITIAL_ID)!=='mts007')return;const list=document.getElementById('profile-team-history');if(!list)return;const targets=new Set(MTS_CHAIN.map(x=>norm(x.team)));[...list.querySelectorAll('.team-history-card')].forEach(card=>{const t=card.querySelector('strong')?.textContent||'';if(targets.has(norm(t)))card.remove()});MTS_CHAIN.forEach(x=>list.appendChild(makeHistoryCard(x.team,x.edition,x.logo)))}
function clearCurrentTeam(reason){const team=currentHeroTeam();const link=document.querySelector('#player-root .profile-team');if(link)link.remove();document.querySelector('#player-root .profile-team-logo')?.remove();const kicker=document.querySelector('#player-root .profile-kicker');if(kicker)kicker.textContent='SEM EQUIPE ATUAL';const badges=document.querySelector('#player-root .profile-badges');if(badges&&!badges.querySelector('.cff-rosterless-badge')){const b=document.createElement('span');b.className='cff-rosterless-badge';b.textContent='Sem equipe no momento';badges.appendChild(b)}if(reason==='laff')ensureFormerTeam(team,'LAFF 2026 S1')}
function patch(){css();const name=playerName();if(!name)return false;const laff=isLaffOnly(),departed=isS1Departed();if(laff||departed)clearCurrentTeam(laff?'laff':'s1');rebuildMtsHistory();return true}
let timer;const mo=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(patch,40)});mo.observe(document.documentElement,{childList:true,subtree:true});
let n=0;const iv=setInterval(()=>{n++;if(patch()||n>80){if(n>12)clearInterval(iv)}},120);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch,{once:true});else patch();
window.CFF_PLAYER_ROSTER_STATUS_VERSION=V;
})();
