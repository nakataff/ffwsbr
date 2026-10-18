"""One canonical team view, compiled locally. Public profiles never fetch the whole catalogue."""
from pathlib import Path
import hashlib, json, re, unicodedata, argparse
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text())
def key(s):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFD',str(s)).encode('ascii','ignore').decode().lower())
def packed(d):return json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n'
def event_id(s):
    s=re.sub(r'\s*[-–:]\s*Final$','',str(s),flags=re.I)
    s=re.sub(r'^(?:WB|FFWS Brasil|FFWS BR)\s+','FFWS BR ',s,flags=re.I)
    aliases={'lbff2023':'lbff9','ligabrasileiradefreefire2022seriesastage1':'lbff7','ligabrasileiradefreefire2022seriesastage2':'lbff8',
      'ligabrasileiradefreefire2021seriesastage1':'lbff4','ligabrasileiradefreefire2021seriesastage2':'lbff5','ligabrasileiradefreefire2021seriesastage3':'lbff6',
      'ligabrasileiradefreefire2020seriesastage1':'lbff1','ligabrasileiradefreefire2020seriesastage3':'lbff3'}
    return aliases.get(key(s),key(s))

def build():
    original=read('team-data/historical-teams.json');manifest=read('career-data/results/manifest.json')
    raw_results=read('resultados.json');out={};index=[];routes={}
    staff=read('functions/career-staff-history.json')['people'];people={p['id']:p for p in read('functions/career-seed.json')['people']}
    current=read('ffws-br-2026-s2/teams.json')['teams']
    for t in current:
        slug=re.sub(r'[^a-z0-9]+','-',t['name'].lower()).strip('-')
        aliases=[t['name'],t.get('abbreviation','')]
        seed=next((s for s in read('functions/career-seed.json')['teams'] if key(s['name'])==key(t['name'])),{})
        for a in [*aliases,*seed.get('aliases',[]),*read('team-aliases.json').get(t['name'],[])]:
            if a:routes[key(a)]='/equipe/'+slug
    for raw in original['teams']:
        team=json.loads(json.dumps(raw));slug=team['slug'];normal_path='team-data/history/'+slug+'.json'
        normal=read(normal_path) if (ROOT/normal_path).exists() else None
        tid=manifest['aliases'].get(key(team['name']));editions=read('career-data/results/'+manifest['teams'][tid])['editions'] if tid else []
        events={e['id']:e for e in editions}
        technical=[]
        for p in staff:
            own=[r for r in p['records'] if manifest['aliases'].get(key(r['teamId']),key(r['teamId']))==tid]
            if not own:continue
            technical.append(dict(id=p['id'],name=p['name'],photo=people.get(p['id'],{}).get('photo','silhueta.webp'),cargo=own[-1]['role'],hasProfile=True,isCurrent=False,editions=list(dict.fromkeys(r['edition'] for r in own))))
        if technical:team['staff']=technical

        source_rows=[row for name,rows in raw_results.items() if key(name) in [key(team['name']),*[key(a) for a in team.get('aliases',[])]] for row in rows]
        titles={}
        for row in [*team.get('collectiveTitles',[]),*(normal or {}).get('titles',[])]:
            eid=event_id(row['event']);ev=events.get(eid)
            final=next((s for s in (ev or {}).get('stages',[]) if s.get('isFinal') or s.get('id')=='overall'),None)
            if final and final.get('finished') and not final.get('champion'):continue
            matches=[r for r in source_rows if event_id(r.get('torneio',''))==eid]
            # Exact first place. 10th, 11th, 13th and ranges beginning in 1 are not wins.
            if matches and not any(re.fullmatch(r'1(?:st|º|°)?',str(r.get('place','')).strip(),re.I) for r in matches):continue
            detail=next((r for r in matches if re.fullmatch(r'1(?:st|º|°)?',str(r.get('place','')).strip(),re.I)),{})
            titles[eid]={**titles.get(eid,{}),**row,'date':row.get('date') or detail.get('data',''),'type':row.get('type','Campeão')}
        participations={event_id(p['event']):p for p in reversed(team.get('participations',[]))}
        for e in editions:
            final=next((s for s in e['stages'] if s.get('isFinal') or s.get('id')=='overall'),None)
            stage=final or (e['stages'][-1] if e['stages'] else None)
            eid=e['id']
            if not stage or not stage.get('finished'):continue
            old=participations.get(eid,{})
            row={'event':e['name'],'year':e['year'],'position':stage.get('position'),'status':'Campeão' if stage.get('champion') else stage['label'],
                 'date':e.get('endDate') or old.get('date',''),'source':e['source']}
            participations[eid]=row
            if stage.get('champion'):
                titles[eid]={**titles.get(eid,{}),'event':e['name'],'type':'Campeão','date':row['date'] or titles.get(eid,{}).get('date',''),'source':e['source']}
        team['collectiveTitles']=sorted(titles.values(),key=lambda t:(t.get('date',''),t['event']),reverse=True)
        team['participations']=sorted(participations.values(),key=lambda p:(p.get('year',0),p.get('date',''),p['event']),reverse=True)
        team['lastParticipation']=next(iter(team['participations']),None)
        # Historical and current views share the exact same championship/result lists.
        if normal:
            normal['titles']=team['collectiveTitles']
            normal['history']['staff']=technical
            normal['history']['players']=[p for p in normal['history'].get('players',[]) if not any(x in key(p.get('cargo','')) for x in ['coach','analis','manager','tecnico'])]
            results={event_id(r['torneio']):r for r in reversed(normal.get('results',[]))}
            for eid,e in events.items():
                stage=next((s for s in e['stages'] if s.get('isFinal') or s.get('id')=='overall'),None)
                if stage and stage.get('finished') and stage.get('position'):
                    results[eid]={'torneio':e['name'],'data':e.get('endDate') or results.get(eid,{}).get('data',''),'place':str(stage['position'])+'º','source':e['source']}
            normal['results']=sorted(results.values(),key=lambda r:(r.get('data',''),r.get('torneio','')),reverse=True)
            out[normal_path]=json.dumps(normal,ensure_ascii=False,indent=2)+'\n'
        content=packed(team);file=slug+'-'+hashlib.sha256(content.encode()).hexdigest()[:12]+'.json'
        out['team-data/historical/'+file]=content
        index.append({k:v for k,v in dict(name=team['name'],slug=slug,aliases=team.get('aliases',[]),logo=team.get('logo','escudo.webp'),
          isCurrentS2=team.get('isCurrentS2',False),lastParticipation=team.get('lastParticipation'),playerCount=len(team.get('players',[])),
          currentRoute=routes.get(key(team['name'])),file=file).items() if v is not None})
    out['team-data/historical-index.json']=packed({'schema':1,'teams':index})
    out['js/team-routes.mjs']='// Generated by scripts/build-team-views.py. Explicit aliases only.\nconst routes='+packed(routes).strip()+';\nconst key=s=>String(s||\'\').normalize(\'NFD\').replace(/[\\u0300-\\u036f]/g,\'\').toLowerCase().replace(/[^a-z0-9]/g,\'\');\nexport const canonicalTeamHref=name=>routes[key(name)]||\'/equipe-historica.html?time=\'+encodeURIComponent(name);\n'
    return out

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    files=build()
    if args.check:
        stale=[p for p,v in files.items() if not (ROOT/p).exists() or (ROOT/p).read_text()!=v]
        if stale:raise SystemExit('Run python3 scripts/build-team-views.py: '+', '.join(stale[:4]))
    else:
        for p in (ROOT/'team-data/historical').glob('*.json') if (ROOT/'team-data/historical').exists() else []:
            if str(p.relative_to(ROOT)) not in files:p.unlink()
        for p,v in files.items():(ROOT/p).parent.mkdir(parents=True,exist_ok=True);(ROOT/p).write_text(v)
    print(len(files),'static team views; no database/network')
