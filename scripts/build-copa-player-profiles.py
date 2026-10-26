"""Per-player Copa snapshots, with exact existing identities and no nickname guessing."""
from pathlib import Path
import argparse,json,unicodedata
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text())
def packed(v):return json.dumps(v,ensure_ascii=False,separators=(',',':'))+'\n'
def norm(s):return ''.join(c for c in unicodedata.normalize('NFD',s).upper().replace('0','O') if c.isascii() and c.isalnum())
def build():
    event=read('novos-torneios/copa-ff-2026.json');routes=read('player-data/routes.json')['routes']
    people=[p for p in read('player-data/aliases.json')['players'] if p['id'] in routes and not routes[p['id']].startswith('f:')]
    allrows={}
    for stage,ranking in event['playerRankings'].items():
        cols=ranking['cols']
        for row in ranking['rows']:
            r=dict(zip(cols,row));key=(r['player'],r['team'])
            allrows.setdefault(key,{})[stage]=dict(kills=r['kills'],matches=r['matches'],average=r['avgKills'],damage=r['damage'],assists=r['assists'],mvp=r['mvps'])
    snapshots={};unmapped=[]
    for (name,team),stages in allrows.items():
        canonical=event.get('playerLinks',{}).get(name,name)
        matches=[p for p in people if norm(p['name'])==norm(canonical)]
        if not matches:matches=[p for p in people if any(norm(a)==norm(canonical) for a in p.get('aliases',[])) and norm(p.get('team',''))==norm(team)]
        if len(matches)!=1:
            unmapped.append(dict(name=name,team=team,reason='Sem perfil existente com identidade exata e não ambígua'));continue
        pid=matches[0]['id'];assert pid not in snapshots,('Duplicated identity',pid)
        snapshots[pid]=dict(schema=1,eventId='copa-ff-2026',generalId=pid,sourceName=name,team=team,coverage='partial',stats=stages,
            notes='Dados agregados dos CSVs enviados. Geral e grupos foram limitados a 100 linhas. Ausência de linha não significa zero.')
    outputs={f'copa-ff-2026/player-data/{pid}.json':packed(data) for pid,data in sorted(snapshots.items())}
    outputs['js/copa-player-manifest.js']='/* Generated explicit Copa profile identities. */\nwindow.CFF_COPA_2026_PLAYERS='+json.dumps({pid:True for pid in sorted(snapshots)},separators=(',',':'))+';\n'
    outputs['imports/copa-ff-2026/player-profiles-report.json']=packed(dict(linkedProfiles=len(snapshots),unmapped=unmapped))
    return outputs
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args();outputs=build()
    for p,content in outputs.items():
        dest=ROOT/p
        if args.check:assert dest.exists() and dest.read_text()==content,'Desatualizado: '+p
        else:dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(content)
    print('Copa: perfis individuais estáticos',len(outputs)-2,'· sem acesso ao banco')
