"""Small offline snapshot for optional yearly Hall competitions. No database access."""
from pathlib import Path
import argparse,json,unicodedata
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text())
def norm(s):return ''.join(c for c in unicodedata.normalize('NFD',s).upper().replace('0','O') if c.isascii() and c.isalnum())
def build():
    copa=read('novos-torneios/copa-ff-2026.json');ranking=copa['playerRanking'];at={k:i for i,k in enumerate(ranking['cols'])}
    historic=read('lbffData.json');known={norm(n):n for n in historic}
    for p in read('ffws-br-2026-s2/hall-player-stats.json')['players'].values():known[norm(p['name'])]=p['name']
    rows=[];keys=set()
    for r in ranking['rows']:
        name=r[at['player']];canonical=copa.get('playerLinks',{}).get(name,name);key=norm(canonical)
        # Existing Brazilian identities may be joined by their exact canonical key.
        # New participants stay scoped to this event rather than fuzzy-matching an older nickname.
        if key not in known:key='copa2026:'+key
        assert key not in keys,('Ambiguous identity',name);keys.add(key)
        rows.append([key,known.get(norm(canonical),canonical),r[at['team']],r[at['kills']],r[at['matches']]])
    events=[dict(id='copa-ff-2026',family='copa',name='Copa FF 2026',year=2026,coverage=ranking['coverage'],note=ranking['note'],url='index.html?torneio=copa-ff-2026#outros-torneios',rows=rows)]
    # Confirmed Brazilian players/teams in the EWC roster; international homonyms stay separate.
    links={('Trap','LOUD'):'TRAP',('Rigby245','MIBR LOS'):'Rigby245',('MT7','Fluxo w7m'):'MT7',('Yago','MIBR LOS'):'Yago',('Butzin','Fluxo w7m'):'BuTziN',('bzp10','LOUD'):'BZP',('Giuh','Fluxo w7m'):'Giuh',('Nickz7','LOUD'):'NICKZ',('GUAXA7','LOUD'):'GUAXA',('Raone7','MIBR LOS'):'Raone7',('Bops','Fluxo w7m'):'Bops',('General','MIBR LOS'):'General',('mtsexy','MIBR LOS'):'mtsexy'}
    ewc=read('ewc 2026/abates.json');rows=[];seen=set()
    for p in ewc['players']:
        assert p.get('id') and isinstance(p.get('kills'),int) and isinstance(p.get('matches'),int)
        canonical=links.get((p['name'],p['team']));key=norm(canonical) if canonical else 'ewc:'+p['id']
        assert key not in seen;seen.add(key)
        if canonical:assert key in known,('Unmapped league identity',canonical)
        rows.append([key,known.get(key,p['name']),p['team'],p['kills'],p['matches']])
    events.append(dict(id='ewc-2026',family='ewc',name='EWC 2026',year=2026,coverage='available',note='Dados individuais de grupos, repescagem e final consolidados na base local.',url='index.html#ewc-mvp',rows=rows))
    events.append(dict(id='ffws-global-2026',family='global',name='Global Series 2026',year=2026,coverage='unavailable',note='Sem resultados individuais publicados nesta base.',rows=[]))
    data=dict(schema=1,updatedAt='2026-10-26',cols=['key','name','team','kills','matches'],note='Somente competições com estatísticas individuais cadastradas. Elencos e prêmios de MVP, sozinhos, não entram na soma.',events=events)
    return json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n'
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args();content=build();dest=ROOT/'ranking-data/hall-extra-events.json'
    if args.check:assert dest.exists() and dest.read_text()==content,'Resumo do Hall desatualizado'
    else:dest.write_text(content)
    print('Hall: extras estáticos',len(content.encode()),'bytes')
