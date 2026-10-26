"""Import public Garena CSV exports without inventing per-drop results or missing totals."""
from pathlib import Path
from decimal import Decimal,ROUND_HALF_UP
import argparse,csv,hashlib,json,unicodedata,io
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text())
def packed(d):return json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n'
def norm(s):return ''.join(c for c in unicodedata.normalize('NFD',s).upper().replace('0','O') if c.isascii() and c.isalnum())
TEAM={'ALFA34':'ALFA 34','ANTISOCIAL':'ANTISOCIAL TEAM','MG7 E-SPORTS':'MG7 ESPORTS','OUTPLAY':'ANGELS OUTPLAY','VASCO E-SPORTS':'VASCO ESPORTS'}
# Explicit, edition-scoped corrections: never use fuzzy nickname matching.
PLAYER={'Yago.exe':'Yago','EricKinng':'Ericking','BYTE33':'BYTE333'}
COLS=['pos','player','team','kills','matches','avgKills','damage','assists','mvps']
FIELDS=['Jogador','Equipe','Abates','Dano','Assists','Quedas','MVP']
METRICS=['Abates','Quedas','Dano','Assists','MVP']
def read_csv(path):
    with path.open(encoding='utf-8-sig',newline='') as f:
        reader=csv.DictReader(f);assert reader.fieldnames==FIELDS,'Colunas CSV inválidas: '+str(path)
        return list(reader)
def merge_general(parts):
    merged={};duplicates=0
    for rows in parts:
        assert 0<len(rows)<100,'Exportação dividida vazia ou ainda limitada a 100 linhas'
        for r in rows:
            key=(norm(r['Jogador'].strip()),norm(r['Equipe'].strip()))
            if key in merged:
                assert all(r[c]==merged[key][c] for c in METRICS),('Duplicação conflitante',key)
                duplicates+=1
            else:merged[key]=r
    return sorted(merged.values(),key=lambda r:(-int(r['Abates']),-int(r['Dano']),-int(r['Assists']),norm(r['Jogador']),norm(r['Equipe']))),duplicates
def validate_general(general,stages,previous):
    key=lambda r:(r['Jogador'],r['Equipe'])
    bykey={key(r):r for r in general}
    for r in previous:
        assert key(r) in bykey and bykey[key(r)]==r,('Geral anterior alterado',key(r))
    teams={r['Equipe'] for r in general}
    assert len(teams)==24 and teams=={r['Equipe'] for r in stages['grupos']},'Cobertura de equipes incompleta'
    rep={r['Equipe'] for r in stages['repescagem']};final={r['Equipe'] for r in stages['final']}
    validations=[]
    for team in sorted(teams):
        expected=18+(6 if team in rep else 0)+(16 if team in final else 0)
        observed=sum(int(r['Quedas']) for r in general if r['Equipe']==team)
        assert observed==expected*4,('Quedas por equipe não fecham com quatro atletas por partida',team,observed,expected*4)
        validations.append(dict(team=team,matches=expected,playerMatches=observed))
    for stage,rows in stages.items():
        for r in rows:
            assert key(r) in bykey,('Jogador de etapa ausente no Geral',stage,key(r))
            assert all(int(r[c])<=int(bykey[key(r)][c]) for c in METRICS),('Etapa maior que Geral',stage,key(r))
    return validations
def build():
    manifest=read('novos-torneios/index.json')
    archive=next(e for e in manifest['year2026']['events'] if e['id']=='copa-free-fire-2026')
    rankings={};hashes={};raw={}
    parts=[read_csv(ROOT/f'imports/copa-ff-2026/sources/geral-{part}.csv') for part in ['ab','cd']]
    general,duplicates=merge_general(parts)
    group_parts=[read_csv(ROOT/f'imports/copa-ff-2026/sources/grupos-{part}.csv') for part in ['ab','cd']]
    groups,group_duplicates=merge_general(group_parts)
    previous_groups=read_csv(ROOT/'imports/copa-ff-2026/sources/grupos-primeiro-export.csv')
    group_index={(r['Jogador'],r['Equipe']):r for r in groups}
    assert len(groups)==110 and len(group_index)==110 and len(previous_groups)==100,'Fase de grupos não contém 110 jogadores únicos'
    for row in previous_groups:
        assert group_index.get((row['Jogador'],row['Equipe']))==row,('Etapa antiga alterada',row['Jogador'],row['Equipe'])
    assert {r['Equipe'] for r in groups}=={r['Equipe'] for r in general},'Uma equipe da fase de grupos está ausente'
    buffer=io.StringIO();writer=csv.DictWriter(buffer,fieldnames=FIELDS,lineterminator='\n');writer.writeheader();writer.writerows(general);general_csv=buffer.getvalue()
    buffer=io.StringIO();writer=csv.DictWriter(buffer,fieldnames=FIELDS,lineterminator='\n');writer.writeheader();writer.writerows(groups);groups_csv=buffer.getvalue()
    part_hashes={part:hashlib.sha256((ROOT/f'imports/copa-ff-2026/sources/geral-{part}.csv').read_bytes()).hexdigest() for part in ['ab','cd']}
    group_part_hashes={part:hashlib.sha256((ROOT/f'imports/copa-ff-2026/sources/grupos-{part}.csv').read_bytes()).hexdigest() for part in ['ab','cd']}
    labels={'geral':'Geral','grupos':'Fase de grupos','repescagem':'Repescagem','final':'Final'}
    for key,label in labels.items():
        if key=='geral':
            rows=general;hashes[key]=hashlib.sha256(general_csv.encode()).hexdigest()
        elif key=='grupos':
            rows=groups;hashes[key]=hashlib.sha256(groups_csv.encode()).hexdigest()
        else:
            path=ROOT/f'imports/copa-ff-2026/sources/{key}.csv';hashes[key]=hashlib.sha256(path.read_bytes()).hexdigest();rows=read_csv(path)
        seen=set();out=[]
        for i,r in enumerate(rows):
            name=r['Jogador'].strip();team=r['Equipe'].strip();identity=(norm(name),team)
            assert name and team and identity not in seen,('duplicate',key,identity)
            seen.add(identity)
            values=[int(r[c]) for c in ['Abates','Quedas','Dano','Assists','MVP']]
            assert all(v>=0 for v in values) and values[1]>0
            k,q,d,a,m=values
            out.append([i+1,name,TEAM.get(team,team),k,q,float((Decimal(k)/Decimal(q)).quantize(Decimal("0.01"),rounding=ROUND_HALF_UP)),d,a,m])
        raw[key]=rows
        rankings[key]=dict(type='playerRanking',title='Copa FF 2026 · '+label,label=label,tabLabel='Jogadores',cols=COLS,rows=out,
            coverage='complete' if key in ('geral','grupos') else 'exported',
            note=('Geral consolidado: 110 jogadores das 24 equipes. Dados agregados, sem detalhamento por queda.' if key=='geral' else 'Fase de grupos completa: 110 jogadores de 24 equipes, com 18 quedas por equipe. Exportações dos grupos A+B e C+D consolidadas sem duplicação; sem detalhamento por queda.' if key=='grupos' else 'Dados agregados da etapa conforme o CSV enviado. Não há detalhamento por queda.'))
    team_validation=validate_general(general,{k:raw[k] for k in ['grupos','repescagem','final']},read_csv(ROOT/'imports/copa-ff-2026/sources/geral-primeiro-export.csv'))
    total={(r['Jogador'],r['Equipe']):r for r in raw['geral']}
    stage={};fields=['Abates','Dano','Assists','Quedas','MVP']
    for key in ['grupos','repescagem','final']:
        for r in raw[key]:
            acc=stage.setdefault((r['Jogador'],r['Equipe']),{c:0 for c in fields})
            for c in fields:acc[c]+=int(r[c])
    missing=[dict(name=k[0],team=k[1]) for k in stage if k not in total]
    diffs=[dict(name=k[0],team=k[1],fields={c:dict(general=int(r[c]),stageSum=stage.get(k,{}).get(c,0)) for c in fields if int(r[c])!=stage.get(k,{}).get(c,0)}) for k,r in total.items() if any(int(r[c])!=stage.get(k,{}).get(c,0) for c in fields)]
    notes=['Geral consolidado com 110 jogadores das 24 equipes, juntando os exports A+B e C+D por jogador e equipe; sem somar duplicados.',
        'Os 100 registros anteriores foram preservados. As quedas individuais fecham com quatro atletas por partida em todas as equipes.',
        'A fase de grupos foi completada com 110 jogadores de A+B e C+D; todos os 100 registros anteriores permanecem inalterados.',
        'Geral, grupos, repescagem e final conferidos: métricas de todas as etapas somam exatamente o Geral para os 110 jogadores.',
        'Geral e etapas são recortes separados; não somar etapas novamente ao Geral. Não há detalhamento individual por queda.',
        'Datas, colocações por queda, premiações e comissão técnica não foram fornecidas nestes CSVs.']
    teams={}
    for rows in raw.values():
        for r in rows:
            name=TEAM.get(r['Equipe'],r['Equipe']);teams.setdefault(name,set()).add(r['Jogador'])
    event=dict(schema=1,id='copa-ff-2026',careerId='copaff2026',name='Copa FF 2026',year=2026,tier='A',region='BRASIL',status='OFICIAL',family='COPA_FF',organizer='Garena',logo='copaff26.webp',
        format='Dados individuais disponíveis por Geral, fase de grupos, repescagem e final. Exportações agregadas; o detalhamento por queda ainda não foi enviado.',
        teams=dict(type='teams',items=[dict(id=norm(name).lower(),o=name,n=name,p=[dict(n=n,r='player',t='player') for n in sorted(names)],s=[]) for name,names in sorted(teams.items())]),
        standings=[],awards=[],playerRanking=rankings['geral'],playerRankings=rankings,playerLinks=PLAYER,source=dict(name='Garena — Dashboard Público: COPAFF 2026; CSVs enviados pelo administrador',url='https://datastudio.google.com/reporting/5e0ee6fe-e51c-4fd6-a820-e611a69d1770/page/p_fckf0lsrgd',providedAt='2026-10-26'),dataNotes=notes)
    event['champion']=next(r['team'] for r in read('ranking-data/brasil-2026-source.json')['copa']['standings'] if r['position']==1)
    # The event already exists in Torneios 2026. Its original metadata is authoritative.
    archive['detailId']=event['id']
    event.update(name=archive['name'],date=archive['date'],currency='BRL',prizeTotal=int(''.join(c for c in archive['prize'] if c.isdigit())),archiveId=archive['id'])
    for name in archive.get('mvp',[]):
        matches=[r for r in rankings['geral']['rows'] if norm(r[1])==norm(name)]
        assert len(matches)==1,('Ambiguous archive MVP',name)
        event['awards'].append(dict(award='MVP',player=name,team=matches[0][2],note='Premiação já cadastrada na lista Torneios 2026.'))
    event['dataNotes'].append('Data, premiação total e MVPs reutilizados do cadastro existente em Torneios 2026; não inferidos do ranking de abates.')
    content=packed(event);entries=[e for e in manifest.get('copaEntries',[]) if e['id']!=event['id']]
    entries.append(dict(id=event['id'],name=event['name'],year=2026,tier='A',region='BRASIL',status='OFICIAL',family='COPA_FF',logo=event['logo'],organizer='Garena',version=hashlib.sha256(content.encode()).hexdigest()[:12],teamNames=list(teams),detailsFile='copa-ff-2026.json',summary=True,champion=event['champion'],mvp=' / '.join(archive.get('mvp',[])),teamCount=len(teams),awardCount=len(event['awards']),date=archive['date']))
    manifest['copaEntries']=entries
    assert not diffs,('Estatísticas das etapas não coincidem com o Geral',diffs)
    report=dict(sourceHashes=hashes,counts={k:len(v['rows']) for k,v in rankings.items()},coverage='complete-stages',groupParts=dict(counts=[len(p) for p in group_parts],sourceHashes=group_part_hashes,identicalDuplicatesRemoved=group_duplicates,previousRowsPreserved=len(previous_groups)),generalParts=dict(counts=[len(p) for p in parts],sourceHashes=part_hashes,identicalDuplicatesRemoved=duplicates),teamValidation=team_validation,playersMissingFromGeneral=missing,generalVsStageDifferences=diffs)
    return {'imports/copa-ff-2026/sources/geral.csv':general_csv,'imports/copa-ff-2026/sources/grupos.csv':groups_csv,'novos-torneios/copa-ff-2026.json':content,'novos-torneios/index.json':packed(manifest),'imports/copa-ff-2026/report.json':packed(report)}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    for p,content in build().items():
        dest=ROOT/p
        if args.check:assert dest.exists() and dest.read_text()==content,'Desatualizado: '+p
        else:dest.write_text(content)
    print('Copa FF 2026: Geral e fase de grupos completos (110 jogadores, 24 equipes), repescagem/final conferidas.')
