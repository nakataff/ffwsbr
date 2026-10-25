"""Build small, immutable team/edition snapshots. Never reads the careers service.

Run after editing tournament JSON: python3 scripts/build-career-results.py
CI uses --check to catch stale snapshots. No database, network or Worker is used.
"""
from pathlib import Path
import argparse, collections, hashlib, json, re, unicodedata

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'career-data/results'
def read(path): return json.loads((ROOT / path).read_text())
def key(value): return re.sub('[^a-z0-9]', '', unicodedata.normalize('NFD', str(value)).encode('ascii', 'ignore').decode().lower())
def packed(value): return json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n'
def number(value): return value if isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0 else None

def staff_role(value):
    s=key(value)
    if 'assistant' in s:return 'assistant_coach'
    if 'headcoach' in s:return 'head_coach'
    if s in ['analyst','analst','analista']:return 'analyst'
    if 'manager' in s:return 'manager'
    if 'coach' in s or s in ['tecnico','tec']:return 'coach'
    return 'other'

def build():
    seed = read('functions/career-seed.json')
    names = {key(n): t['id'] for t in seed['teams'] for n in [t['id'], t['name'], *t.get('aliases', [])]}
    for t in read('functions/career-staff-history.json')['teams']:
        for n in [t['id'], t['name'], *t.get('aliases', [])]: names.setdefault(key(n), t['id'])
    # Only explicit aliases. W7M Esports remains distinct from Fluxo W7M.
    for canonical, aliases in read('team-aliases.json').items():
        ids = {names[key(n)] for n in [canonical, *aliases] if key(n) in names}
        if len(ids) == 1:
            for n in [canonical, *aliases]: names.setdefault(key(n), next(iter(ids)))
    teams = collections.defaultdict(dict)
    def tid(name): return names.get(key(name), key(name))
    def edition(team, cid, name, family, year, source, **extra):
        ident = tid(team)
        if not ident: raise ValueError('Empty team identity')
        names.setdefault(key(team), ident)
        return teams[ident].setdefault(cid, dict(id=cid, name=name, family=family, year=int(year), team=team,
            source=source, stages=[], players=[], staff=[], **extra))
    def roster(entry, item):
        entry['players'] = [dict(name=p['n'], role='player') for p in item.get('p', []) if p.get('n')]
        entry['staff'] = [dict(name=p['n'], role=staff_role(p.get('r', 'staff'))) for p in item.get('s', []) if p.get('n')]
    def table(data, table, cid, name, family, year, source, final=False, overall=False):
        cols = table.get('cols', [])
        for raw in table.get('rows', []):
            row = dict(zip(cols, raw)); team = row.get('team') or row.get('teamOriginal')
            if not team: continue
            entry = edition(team, cid, name, family, year, source,
                startDate=data.get('startDate', ''), endDate=data.get('endDate', ''))
            stage = dict(id='final' if final else 'overall' if overall else table.get('stageId','groups'),
                label='Grande final' if final else table['title'] if data.get('pilot') else 'Classificação final' if overall else 'Play-ins' if table.get('stageId')=='playins' else 'Point Rush' if 'Point Rush' in table.get('title', '') else 'Fase de grupos',
                position=number(row.get('pos')), points=number(row.get('total', row.get('points'))), finished=True,
                isFinal=final, champion=(final or overall) and row.get('pos') == 1)
            # Never convert weighted kill points into kills or missing values into zero.
            for field in ['kills']:
                if number(row.get(field)) is not None: stage[field] = row[field]
            matches = row.get('matches', [])
            if matches:
                stage['matches'] = len(matches)
                pi = table.get('matchCols', []).index('placement') if 'placement' in table.get('matchCols', []) else -1
                placements = [m[pi] if len(m) > pi else None for m in matches] if pi >= 0 else []
                if placements and all(number(p) is not None and p > 0 for p in placements):
                    stage['booyahs'] = placements.count(1)
            if table.get('dataNotes'):stage['dataNotes']=table['dataNotes']
            entry['stages'].append({k:v for k,v in stage.items() if v is not None})
            if final:
                dates = [str(m[2])[:10] for m in table.get('maps', []) if len(m) > 2 and re.match(r'^\d{4}-\d{2}-\d{2}', str(m[2]))]
                if dates: entry['finalDate'] = max(dates)
                elif data.get('endDate'): entry['finalDate'] = data['endDate']

    for path in sorted((ROOT/'novos-torneios').glob('*.json')):
        if not re.match(r'^(lbff-\d+|wb-2025-s[12])$', path.stem): continue
        data = json.loads(path.read_text()); source = str(path.relative_to(ROOT))
        lbff = path.stem.startswith('lbff')
        cid = path.stem.replace('-', '') if lbff else 'ffwsbr' + path.stem[3:].replace('-', '')
        name = data['name'] if lbff else data['name'].replace('WB ', 'FFWS BR ')
        family = 'LBFF' if lbff else 'FFWS_BR'
        for item in data.get('teams', {}).get('items', []):
            roster(edition(item.get('n') or item['o'], cid, name, family, data['year'], source,
                startDate=data.get('startDate', ''), endDate=data.get('endDate', '')), item)
        for standings in data.get('standings', []):
            table(data, standings, cid, name, family, data['year'], source, overall=cid == 'lbff1')
        if data.get('final'): table(data, data['final'], cid, name, family, data['year'], source, final=True)

    # Reviewed, normalized world-event pilot. Raw wiki code is never read at runtime.
    for path in sorted((ROOT/'novos-torneios').glob('ffws-*.json')):
        data=json.loads(path.read_text())
        if not data.get('pilot') or not data.get('careerId'):continue
        cid=data['careerId'];source=str(path.relative_to(ROOT))
        for item in data['teams']['items']:
            roster(edition(item['n'],cid,data['name'],'MUNDIAL',data['year'],source,startDate=data['startDate'],endDate=data['endDate'],detailHref='/index.html?torneio='+data['id']+'#outros-torneios'),item)
        for standings in data.get('standings',[]):table(data,standings,cid,data['name'],'MUNDIAL',data['year'],source)
        table(data,data['final'],cid,data['name'],'MUNDIAL',data['year'],source,final=True)

    # 2024 has one annual final: do not attribute that title to each split.
    data = read('novos-torneios/wb-2024.json')
    for item in data['teams']['items']:
        roster(edition(item.get('n') or item['o'], 'ffwsbr2024', 'FFWS BR 2024', 'FFWS_BR', 2024, 'novos-torneios/wb-2024.json', startDate=data.get('startDate',''),endDate=data.get('endDate','')),item)
    table(data,data['standings'][0],'ffwsbr2024','FFWS BR 2024','FFWS_BR',2024,'novos-torneios/wb-2024.json')
    table(data,data['final'],'ffwsbr2024','FFWS BR 2024','FFWS_BR',2024,'novos-torneios/wb-2024.json',final=True)
    # Split-specific weekly tables remain informational; only the annual edition has a champion.
    for split in [1,2]:
        for standings in data['standings']:
            if standings['title'].startswith('Fase '+str(split)+' -'):
                table(data,standings,f'ffwsbr2024s{split}',f'FFWS BR 2024 S{split}','FFWS_BR',2024,'novos-torneios/wb-2024.json')

    # Prepared official summaries already include Champion Rush placement overrides.
    summaries = read('team-results-2026.json')
    for team in summaries['teams']:
        for event in team['tournaments']:
            if event['id'] not in ['ffws-br-2026-s1', 'ewc-2026']: continue
            ewc = event['id'] == 'ewc-2026'
            cid = 'ewc2026' if ewc else 'ffwsbr2026s1'
            entry = edition(team['canonical'], cid, 'EWC 2026' if ewc else 'FFWS BR 2026 S1', 'EWC' if ewc else 'FFWS_BR', 2026,
                'team-results-2026.json', updatedAt=summaries['updatedAt'])
            for original in event['stages']:
                stage = {k:v for k,v in original.items() if k in ['id','label','position','points','kills','booyahs','matches','champion']}
                stage.update(finished=True, isFinal=stage['id']=='final')
                entry['stages'].append(stage)
            if ewc:
                dates = read('ewc 2026/datas.json')
                entry.update(startDate=dates['startDate'], endDate=dates['endDate'], finalDate=dates['endDate'])
            else:
                entry.update(startDate='2026-03-21', endDate='2026-05-31', finalDate='2026-05-31')
    ewc = read('ewc 2026/team-profiles.json')
    for team in ewc['teams']:
        entry = teams.get(tid(team['name']), {}).get('ewc2026')
        if entry: entry['players'] = [dict(name=p['name'], role='player') for p in team.get('players', [])]
    for team in read('ewc 2026/times.json')['teams']:
        entry = teams.get(tid(team.get('dataName') or team['name']), {}).get('ewc2026') or teams.get(tid(team['name']), {}).get('ewc2026')
        if entry:
            entry['players'] = [dict(name=p['name'], role='player') for p in team.get('players', []) if not p.get('staff')]
            entry['staff'] = [dict(name=p['name'], role=staff_role(p.get('role','staff'))) for p in team.get('players', []) if p.get('staff')]
    for split in [1, 2]:
        cid = f'ffwsbr2026s{split}'; base = f'ffws-br-2026-s{split}'
        for team in read(base+'/teams.json')['teams']:
            entry = edition(team['name'], cid, f'FFWS BR 2026 S{split}', 'FFWS_BR', 2026, base+'/career-summary.json')
            entry['players'] = [dict(name=n, role='player') for n in team['players']]
        if split == 2:
            data = read(base+'/career-summary.json'); dates = read(base+'/teams.json').get('schedule', [])
            for sid, label in [('classificatoria','Classificatória'),('segundaFase','Segunda fase'), ('final','Grande final')]:
                for row in data.get(sid, {}).get('rows', []):
                    if not number(row.get('matches')): continue
                    entry = edition(row['team'], cid, 'FFWS BR 2026 S2', 'FFWS_BR', 2026, base+'/career-summary.json', updatedAt=data.get('updatedAt',''))
                    stage = {k:v for k,v in row.items() if k in ['position','points','kills','booyahs','matches','bonus']}
                    stage.update(id=sid, label=label, finished=bool(data[sid].get('finished')), isFinal=sid=='final', champion=sid=='final' and data[sid].get('finished') is True and key(row['team'])==key(data[sid].get('champion') or data[sid].get('confirmedChampion')))
                    entry['stages'].append(stage)
            for entry in [events[cid] for events in teams.values() if cid in events]:
                ds = [d['date'] for d in dates if d.get('date')]
                if ds: entry.update(startDate=min(ds), endDate=max(ds), finalDate=max(ds))
            for person in read('functions/career-staff-s2.json')['people']:
                entry = teams[tid(person['team'])][cid]
                entry['staff'].append(dict(name=person['name'], role=person['role']))

    # Existing historical world finals provide placements, not fabricated per-match stats.
    for team, rows in read('resultados.json').items():
        for row in rows:
            match=re.fullmatch(r'Free Fire World Series - Global Finals (2024|2025)',row.get('torneio',''),re.I)
            place=re.fullmatch(r'(\d+)(?:st|nd|rd|th|º)?',str(row.get('place','')),re.I)
            if not match or not place:continue
            year=match[1];position=int(place[1]);cid='ffwsglobalfinals'+year
            entry=edition(team,cid,'FFWS Global Finals '+year,'MUNDIAL',year,'resultados.json',endDate=row.get('data',''),finalDate=row.get('data',''))
            if entry['source'].startswith('novos-torneios/ffws-'):continue
            entry['stages']=[dict(id='final',label='Classificação final',position=position,finished=True,isFinal=position<=12,champion=position==1)]
    for sid,label,path in [('groups','Classificatória','dados laff/classificacao.json'),('last-chance','Repescagem','dados laff/repescagem.json'),('final','Grande final','dados laff/final.json')]:
        data=read(path);rows=data['laffStandings'] if isinstance(data,dict) else data
        for row in rows:
            entry=edition(row['team'],'laff2026s1','LAFF 2026 S1','LAFF',2026,path)
            stage=dict(id=sid,label=label,position=row['rank'],finished=True,isFinal=sid=='final',champion=sid=='final' and row['rank']==1)
            for dest,source in [('points','pontos'),('kills','kills'),('booyahs','booyah'),('matches','quedas')]:
                if number(row.get(source)) is not None:stage[dest]=row[source]
            entry['stages'].append(stage)
    for pos,row in enumerate(read('laff-2025-s1-finals.json')['teams'],1):
        entry=edition(row['team'],'laff2025s1','LAFF 2025 S1','LAFF',2025,'laff-2025-s1-finals.json')
        entry['stages']=[dict(id='final',label='Grande final',position=pos,points=row['points'],kills=row['kills'],booyahs=row['booyah'],matches=row['matches'],finished=True,isFinal=True,champion=pos==1)]
    # Extension point for reviewed future ZIP imports: normalize once before publishing.
    # No raw HTML, nickname guessing, or archive parsing is performed by the visitor.
    for path in sorted((ROOT/'career-data/events').glob('*.json')):
        data=json.loads(path.read_text())
        assert re.fullmatch(r'[a-z0-9]+',data['id']) and data['family'] in ['MUNDIAL','FFWS_BR','LAFF','LBFF','EWC','OUTROS']
        for team in data['teams']:
            entry=edition(team['name'],data['id'],data['name'],data['family'],data['year'],str(path.relative_to(ROOT)))
            for field in ['startDate','endDate','finalDate','updatedAt']:
                if data.get(field):entry[field]=data[field]
            entry['stages']=team.get('stages',[])
            for stage in entry['stages']:
                assert isinstance(stage.get('finished'),bool) and stage.get('label')
                assert not stage.get('champion') or stage.get('isFinal') and stage['finished']
            entry['players']=team.get('players',[]);entry['staff']=team.get('staff',[])

    files = {}; manifest = dict(schema=1, aliases={}, teams={})
    for ident, events in sorted(teams.items()):
        content = packed(dict(teamId=ident, editions=sorted(events.values(), key=lambda e:(e['year'],e['id']))))
        filename = ident+'-'+hashlib.sha256(content.encode()).hexdigest()[:12]+'.json'
        files[filename] = content; manifest['teams'][ident] = filename
    for alias, ident in sorted(names.items()):
        if ident in teams: manifest['aliases'][alias] = ident
    files['manifest.json'] = packed(manifest)
    return files

if __name__ == '__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--check', action='store_true'); args=parser.parse_args()
    files=build(); existing={p.name:p.read_text() for p in OUT.glob('*.json')} if OUT.exists() else {}
    if args.check:
        if existing != files: raise SystemExit('Career snapshots are stale. Run python3 scripts/build-career-results.py')
    else:
        OUT.mkdir(parents=True, exist_ok=True)
        for name in existing.keys()-files.keys(): (OUT/name).unlink()
        for name, content in files.items(): (OUT/name).write_text(content)
    print(f'{len(files)-1} team snapshots; {sum(len(v.encode()) for v in files.values())} bytes total; no network/database access')
