"""Compile historical LBFF staff locally; the Worker imports this bounded manifest once."""
from pathlib import Path
import collections,hashlib,json,re,unicodedata
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text())
def key(s):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFD',str(s)).encode('ascii','ignore').decode().lower())
seed=read('functions/career-seed.json'); s2=read('functions/career-staff-s2.json')
people={p['id']:p for p in seed['people']}; person_aliases=collections.defaultdict(set)
for p in people.values():
 for name in [p['id'],p['name'],*p.get('aliases',[])]:person_aliases[key(name)].add(p['id'])
for p in s2['people']:
 matches=person_aliases[key(p['name'])]
 ident=p.get('id') or (next(iter(matches)) if len(matches)==1 else 'staff-s2-'+key(p['name']))
 person_aliases[key(p['name'])].add(ident)
# Reviewed identity decisions. Player/coach role changes retain their original ID;
# coach homonyms must never acquire the bare alias used by an unrelated player.
identities={
 'matheussouto':{'key':'souto','name':'Souto','aliases':['Souto','Matheus Souto'],'evidence':'https://liquipedia.net/freefire/Team_Liquid'},
 'souto':{'key':'souto','name':'Souto','aliases':['Souto','Matheus Souto']},
 'capgui63':{'key':'capgui','id':'staff-s2-capgui','name':'Capgui','aliases':['Capgui','CapGui63'],'evidence':'https://liquipedia.net/freefire/Tropa_(Mobile)'},
 'capgui':{'key':'capgui','id':'staff-s2-capgui','name':'Capgui','aliases':['Capgui','CapGui63']},
 'stark':{'key':'stark-coach','id':'staff-history-stark-coach','name':'Stark (coach)','aliases':['StarkCoach','Stark (coach)','Stark (treinador)','Ítalo Barros'],'excludeIds':['stark'],'evidence':'https://liquipedia.net/freefire/Corinthians'},
 'trap':{'key':'trap-coach','id':'staff-history-trap-coach','name':'Trap (coach)','aliases':['Trap (coach)','Trap (Brazilian Coach)','Trap (treinador)'],'excludeIds':['trap']},
 'wanheda':{'id':'wanheda','evidence':'https://liquipedia.net/freefire/Wanheda'},
 'avenger':{'id':'avenger','evidence':'https://liquipedia.net/freefire/Avenger'},
 'vazily':{'id':'vazily','evidence':'https://liquipedia.net/freefire/INTZ'},
 'luuuking':{'id':'luuuking'},'putsgrilo':{'id':'putsgrilo'},
 'renan':{'id':'renan-staff'},'pereira':{'id':'pereira'},
}
seed_teams={t['id']:t for t in seed['teams']};team_names={key(n):t['id'] for t in seed['teams'] for n in [t['id'],t['name'],*t.get('aliases',[])]}
for canonical,names in read('team-aliases.json').items():
 keys={team_names[key(n)] for n in [canonical,*names] if key(n) in team_names}
 if len(keys)==1:
  ident=next(iter(keys))
  for n in [canonical,*names]:team_names.setdefault(key(n),ident)
def role(s):
 s=key(s)
 if 'assistant' in s:return 'assistant_coach'
 if s in ['analyst','analst','analista']:return 'analyst'
 if 'manager' in s:return 'manager'
 if 'coach' in s:return 'coach'
 raise ValueError('Unknown staff role: '+s)
teams={};compiled={};catalog=[];raw_count=0
for path in sorted((ROOT/'novos-torneios').glob('lbff-*.json'),key=lambda p:int(p.stem.split('-')[-1])):
 d=json.loads(path.read_text());edition=d['name'];edition_id='lbff'+str(int(path.stem.split('-')[-1]));catalog.append({'id':edition_id,'name':edition,'family':'LBFF'})
 for item in d['teams']['items']:
  raw_team=item.get('n') or item['o'];tid=team_names.get(key(raw_team),key(raw_team))
  team=teams.setdefault(tid,{'id':tid,'name':seed_teams.get(tid,{}).get('name',raw_team.upper()),'logo':seed_teams.get(tid,{}).get('logo','escudo.webp'),'aliases':[]})
  if raw_team not in team['aliases']:team['aliases'].append(raw_team)
  for raw in item.get('s',[]):
   name=raw['n'].strip()
   if not name or name.upper() in ['TBD','TBA','UNKNOWN','-']:continue
   raw_count+=1;override=identities.get(key(name),{});ident_key=override.get('key',key(name));names=override.get('aliases',[name]);matches=person_aliases[key(name)]
   ident=override.get('id') or (next(iter(matches)) if len(matches)==1 else 'staff-history-'+ident_key)
   p=compiled.setdefault(ident_key,{'id':ident,'name':override.get('name',name),'aliases':[],'excludeIds':override.get('excludeIds',[]),'records':[]})
   for alias in [*names,*([raw['l']] if raw.get('l') else [])]:
    if alias not in p['aliases']:p['aliases'].append(alias)
   if override.get('evidence'):p['identitySource']=override['evidence']
   record={'competitionId':edition_id,'edition':edition,'teamId':tid,'role':role(raw.get('r','coach')),'source':'novos-torneios/'+path.name,'wikiLink':raw.get('l','')}
   if record not in p['records']:p['records'].append(record)
out={'description':'Participações registradas nas comissões das LBFFs. Não comprova datas de contratação, saída ou vínculo atual.','catalog':catalog,'teams':list(teams.values()),'people':list(compiled.values()),'rawRecords':raw_count}
out['version']=hashlib.sha256(json.dumps(out,sort_keys=True,ensure_ascii=False).encode()).hexdigest()[:16]
p=ROOT/'functions/career-staff-history.json';p.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'{raw_count} staff records, {len(compiled)} identities, {len(teams)} teams, {p.stat().st_size} bytes (server only)')
