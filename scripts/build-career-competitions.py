"""Small server index of explicit person/team competition records; no date inference."""
from pathlib import Path
import hashlib,json,re,unicodedata
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text())
def key(s):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFD',str(s)).encode('ascii','ignore').decode().lower())
seed=read('functions/career-seed.json'); ids={p['id'] for p in seed['people']};aliases={}
for p in seed['people']:
 for n in [p['id'],p['name'],*p.get('aliases',[])]:aliases.setdefault(key(n),set()).add(p['id'])
def pid(name):
 if name in ids:return name
 values=aliases.get(key(name),set());return next(iter(values)) if len(values)==1 else None
catalog={};records={}
def event(name):
 name=name.strip(); name=re.sub(r'^(?:WB|FFWS BR(?:ASIL)?)\s+(20\d\d)\s+[FS]([12])$',r'FFWS BR \1 S\2',name,flags=re.I)
 k=key(name)
 family='LBFF' if k.startswith('lbff') else 'LAFF' if k.startswith('laff') else 'FFWS_BR' if k.startswith('ffwsbr') else 'MUNDIAL' if any(x in k for x in ['global','mundial','worldseries']) else 'EWC' if k.startswith('ewc') else 'OUTROS'
 if k:catalog[k]={'id':k,'name':name,'family':family}
 return k
def add(person,edition,team,role='player'):
 ident=pid(person)
 if not edition or not team:return
 eid=event(edition)
 if not ident:return
 record={'id':eid,'team':team,'role':role}
 if record not in records.setdefault(ident,[]):records[ident].append(record)
for person,editions in read('player-data/edition-teams.json')['players'].items():
 for edition,team in editions.items():add(person,edition,team)
for base in ['basic','s2','staff']:
 for path in sorted((ROOT/'player-data'/base).glob('*.json')):
  for person,p in json.loads(path.read_text()).get('players',{}).items():
   for c in p.get('editions',[])+p.get('competitions',[]):
    if c.get('team') and float(c.get('matches') or 0)>0:add(person,c.get('edition') or c.get('name',''),c['team'])
   if base=='staff':
    for h in p.get('teamHistory',[]):
     raw=key(h.get('cargo',p.get('role','')))
     role='analyst' if 'analis' in raw else 'assistant_coach' if 'assistant' in raw else 'head_coach' if 'headcoach' in raw else 'manager' if 'manager' in raw else 'coach' if 'coach' in raw else 'player'
     add(person,h.get('edition',''),h.get('team',''),role)
for path in sorted(ROOT.glob('ffws-br-*/players.json')):
 d=json.loads(path.read_text());players=d.get('players',[])
 if isinstance(players,list):
  for p in players:
   if isinstance(p,dict):add(p.get('name',''),d.get('tournament',''),p.get('team',''))
for p in read('player-profile-summary-2026.json').get('players',[]):
 for field,edition in [('ffws','WB 2026 S1'),('ewc','EWC 2026')]:
  row=p.get(field) or {}
  if float(row.get('matches') or 0)>0:add(p.get('name',''),edition,row.get('team',''))
# Actual future event in the site catalogue; its participants are not inferred.
event('FFWS Global Finals 2026')
for name in ['LAFF 2025 S1','LAFF 2026 S1']:event(name)
out={'catalog':list(catalog.values()),'people':records}
out['version']=hashlib.sha256(json.dumps(out,sort_keys=True).encode()).hexdigest()[:16]
p=ROOT/'functions/career-competitions-seed.json';p.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'{len(catalog)} editions, {sum(map(len,records.values()))} records, {p.stat().st_size} bytes (server only)')
