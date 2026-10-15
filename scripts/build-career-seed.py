"""Build a server-only seed; never imported by a browser entry point."""
from pathlib import Path
import json,re,unicodedata
ROOT=Path(__file__).resolve().parents[1]
def key(s):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFD',str(s)).encode('ascii','ignore').decode().lower())
def teamkey(s):return 'loudsnickers' if key(s)=='loud' else key(s)
def role(s):
 s=key(s)
 return 'assistant_coach' if 'assistant' in s or 'auxiliar' in s else 'head_coach' if 'headcoach' in s else 'coach' if 'coach' in s or 'treinador' in s else 'analyst' if 'analis' in s else 'manager' if 'manager' in s or 'gerente' in s else 'player'
base=json.loads((ROOT/'player-data/passagens.json').read_text());editions=json.loads((ROOT/'player-data/edition-teams.json').read_text())['players'];aliases={p['id']:p for p in json.loads((ROOT/'player-data/aliases.json').read_text())['players']}
people={};teams={}
def team(name,logo=''):
 k=teamkey(name)
 if k not in teams:teams[k]={'id':k,'name':name,'logo':logo or 'escudo.webp','aliases':[name]}
 elif name not in teams[k]['aliases']:teams[k]['aliases'].append(name)
 if key(name)=='loudsnickers' and 'LOUD' not in teams[k]['aliases']:teams[k]['aliases'].append('LOUD')
 return k
for pid,p in base['players'].items():
 history=p.get('history',[]);tenures=[]
 for i,h in enumerate(history):
  tid=team(h['team'],h.get('logo',''));refs=[]
  if sum(teamkey(x['team'])==tid for x in history)==1:refs=[e for e,t in editions.get(pid,{}).items() if teamkey(t)==tid]
  tenures.append({'id':f'seed-{pid}-{i+1}','teamId':tid,'teamName':teams[tid]['name'],'role':role(h.get('cargo','')),'status':'unverified','order':i+1,'start':{'date':'','precision':'edition' if refs else 'unknown','certainty':'estimated' if refs else 'unknown','edition':refs[0] if refs else ''},'end':{'date':'','precision':'edition' if refs else 'unknown','certainty':'estimated' if refs else 'unknown','edition':refs[-1] if refs else ''},'source':h.get('source','Passagens do site'),'sourceUrl':'','notes':'Importado. As edições indicam participação registrada; não comprovam entrada ou saída.'})
 people[pid]={'id':pid,'name':p['name'],'aliases':list(dict.fromkeys([p['name'],*p.get('aliases',[]),*aliases.get(pid,{}).get('aliases',[])]))[:30],'photo':p.get('photo','silhueta.webp'),'kind':'staff' if tenures and all(t['role']!='player' for t in tenures) else 'player','availability':'unknown','currentTeamHint':p.get('currentTeam',''),'tenures':tenures}
for path in sorted((ROOT/'player-data/staff').glob('*.json')):
 for pid,p in json.loads(path.read_text()).get('players',{}).items():
  if pid in people:continue
  history=p.get('teamHistory',[])
  people[pid]={'id':pid,'name':p['name'],'aliases':list(dict.fromkeys([p['name'],*p.get('aliases',[])])),'photo':p.get('photo','silhueta.webp'),'kind':'staff','availability':'unknown','currentTeamHint':p.get('currentTeam',''),'tenures':[{'id':f'seed-{pid}-{i+1}','teamId':team(h['team'],h.get('logo','')),'teamName':h['team'],'role':role(h.get('cargo',p.get('role','Coach'))),'status':'unverified','order':i+1,'start':{'date':'','precision':'edition' if h.get('edition') else 'unknown','certainty':'estimated' if h.get('edition') else 'unknown','edition':h.get('edition','')},'end':{'date':'','precision':'unknown','certainty':'unknown','edition':''},'source':'Cadastro de comissão do site','sourceUrl':'','notes':'Importado para revisão.'} for i,h in enumerate(history)]}
out={'version':1,'people':list(people.values()),'teams':list(teams.values())}
p=ROOT/'functions/career-seed.json';p.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n');print(f'{len(people)} pessoas, {len(teams)} equipes, {sum(len(p["tenures"]) for p in people.values())} passagens; {p.stat().st_size} bytes (somente servidor)')
