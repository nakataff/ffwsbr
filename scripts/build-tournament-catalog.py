"""Small cards and a separate, pre-normalized Radar dataset; no full event reads on visits."""
from pathlib import Path
import argparse,hashlib,json
ROOT=Path(__file__).resolve().parents[1]
def read(path):return json.loads((ROOT/path).read_text())
def packed(d):return json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n'
def build():
    manifest=read('novos-torneios/index.json');manifest['entries']=[];radar=[]
    for file in manifest['files']:
        d=read('novos-torneios/'+file)
        stage=d.get('final') or next(iter(d.get('standings',[])),{})
        cols=stage.get('cols',[]);rows=stage.get('rows',[])
        champion=rows[0][cols.index('team')] if rows and 'team' in cols else ''
        awards=d.get('awards',[])
        if isinstance(awards,dict):awards=[dict(zip(awards.get('cols',[]),r)) for r in awards.get('rows',[])]
        mvp=next((a.get('player','') for a in awards if 'MVP' in a.get('award','').upper()),'')
        item={k:d[k] for k in ['id','name','year','edition','startDate','endDate','date','tier','region','status','logo','organizer','family'] if k in d}
        item.update(version=hashlib.sha256((ROOT/('novos-torneios/'+file)).read_bytes()).hexdigest()[:12],teamNames=[t.get('n') or t.get('o') for t in d.get('teams',{}).get('items',[])],detailsFile=file,summary=True,champion=champion,mvp=mvp,teamCount=len(d.get('teams',{}).get('items',[])),awardCount=len(awards))
        manifest['entries'].append(item)
        mini={k:d[k] for k in ['id','name','year'] if k in d};mini['standings']=[]
        for st in d.get('standings',[])[:1]:
            if st.get('type')=='pointRush':continue
            mini['standings'].append({k:st[k] for k in ['cols','rows','title','drops'] if k in st})
        if d.get('final'):
            st=d['final'];mini['final']={k:st[k] for k in ['maps','killPoint','placementPoints'] if k in st}
            rows=[];cols=st['cols'];mc=st.get('matchCols',[])
            for row in st['rows']:
                r=dict(zip(cols,row));p=r.get('finalPts',r.get('total'));norm=None
                matches=r.get('matches',[])
                if matches and 'placement' in mc and 'kills' in mc:
                    values=[dict(zip(mc,m)) for m in matches]
                    if all(isinstance(m.get('placement'),(int,float)) and m['placement']>0 and isinstance(m.get('kills'),(int,float)) for m in values):
                        modern={1:12,2:9,3:8,4:7,5:6,6:5,7:4,8:3,9:2,10:1,11:0,12:0}
                        norm=sum(modern[m['placement']]+m['kills'] for m in values)
                if norm is None:
                    if matches and 'total' in mc and all(isinstance(m[mc.index('total')],(int,float)) for m in matches):norm=sum(m[mc.index('total')] for m in matches)
                    elif isinstance(p,(int,float)):norm=p if 'finalPts' in r else p-(r.get('headstart') or 0)
                rows.append([r.get('pos'),r.get('team') or r.get('teamOriginal'),norm])
            mini['final'].update(cols=['pos','team','radarPoints'],rows=rows)
        radar.append(mini)
    s2=read('ffws-br-2026-s2/career-summary.json')
    extras=[read('novos-torneios/radar-wb-2026-s1.json'),dict(id='wb-2026-s2',tournament=s2['tournament'],classificatoria=s2['classificatoria'],final=s2['final'])]
    content=packed(dict(events=radar,extras=extras));file='radar-'+hashlib.sha256(content.encode()).hexdigest()[:12]+'.json';manifest['radarFile']=file
    return {'novos-torneios/index.json':packed(manifest),'novos-torneios/'+file:content}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args();files=build()
    for path,content in files.items():
        dest=ROOT/path
        if args.check:
            if not dest.exists() or dest.read_text()!=content:raise SystemExit('Catálogo desatualizado: '+path)
        else:dest.write_text(content)
    print('Catálogo e Radar estáticos:',sum(len(v.encode()) for v in files.values()),'bytes')
