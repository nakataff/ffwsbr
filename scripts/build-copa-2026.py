"""Import public Garena CSV exports without inventing per-drop results or missing totals."""
from pathlib import Path
import argparse,csv,hashlib,json,unicodedata
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text())
def packed(d):return json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n'
def norm(s):return ''.join(c for c in unicodedata.normalize('NFD',s).upper().replace('0','O') if c.isascii() and c.isalnum())
TEAM={'ALFA34':'ALFA 34','ANTISOCIAL':'ANTISOCIAL TEAM','MG7 E-SPORTS':'MG7 ESPORTS','OUTPLAY':'ANGELS OUTPLAY','VASCO E-SPORTS':'VASCO ESPORTS'}
# Explicit, edition-scoped corrections: never use fuzzy nickname matching.
PLAYER={'Yago.exe':'Yago','EricKinng':'Ericking','BYTE33':'BYTE333'}
COLS=['pos','player','team','kills','matches','avgKills','damage','assists','mvps']
def build():
    manifest=read('novos-torneios/index.json')
    archive=next(e for e in manifest['year2026']['events'] if e['id']=='copa-free-fire-2026')
    rankings={};hashes={};raw={}
    labels={'geral':'Geral','grupos':'Fase de grupos','repescagem':'Repescagem','final':'Final'}
    for key,label in labels.items():
        path=ROOT/f'imports/copa-ff-2026/sources/{key}.csv'
        hashes[key]=hashlib.sha256(path.read_bytes()).hexdigest()
        with path.open(encoding='utf-8-sig',newline='') as f:
            reader=csv.DictReader(f);assert reader.fieldnames==['Jogador','Equipe','Abates','Dano','Assists','Quedas','MVP']
            rows=list(reader)
        seen=set();out=[]
        for i,r in enumerate(rows):
            name=r['Jogador'].strip();team=r['Equipe'].strip();identity=(norm(name),team)
            assert name and team and identity not in seen,('duplicate',key,identity)
            seen.add(identity)
            values=[int(r[c]) for c in ['Abates','Quedas','Dano','Assists','MVP']]
            assert all(v>=0 for v in values) and values[1]>0
            k,q,d,a,m=values
            out.append([i+1,name,TEAM.get(team,team),k,q,round(k/q,2),d,a,m])
        raw[key]=rows
        rankings[key]=dict(type='playerRanking',title='Copa FF 2026 · '+label,label=label,tabLabel='Jogadores',cols=COLS,rows=out,
            coverage='partial' if key in ['geral','grupos'] else 'exported',
            note=('Exportação parcial: 100 linhas recebidas; pode faltar quem ficou fora do limite de exportação.' if key in ['geral','grupos'] else 'Dados agregados da etapa conforme o CSV enviado. Não há detalhamento por queda.'))
    total={(r['Jogador'],r['Equipe']):r for r in raw['geral']}
    stage={};fields=['Abates','Dano','Assists','Quedas','MVP']
    for key in ['grupos','repescagem','final']:
        for r in raw[key]:
            acc=stage.setdefault((r['Jogador'],r['Equipe']),{c:0 for c in fields})
            for c in fields:acc[c]+=int(r[c])
    missing=[dict(name=k[0],team=k[1]) for k in stage if k not in total]
    diffs=[dict(name=k[0],team=k[1],fields={c:dict(general=int(r[c]),stageSum=stage.get(k,{}).get(c,0)) for c in fields if int(r[c])!=stage.get(k,{}).get(c,0)}) for k,r in total.items() if any(int(r[c])!=stage.get(k,{}).get(c,0) for c in fields)]
    notes=['Dados individuais agregados, sem resultados por queda. Geral e grupos têm 100 linhas e cobertura parcial.',
        'Há jogadores das etapas ausentes no Geral. O Geral recebido é preservado; não é somado novamente às etapas.',
        'A soma das etapas difere do Geral para Proxx7 e Shotzzrx porque não constam no arquivo de grupos. Não foram inventados registros para completar a fase.',
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
    report=dict(sourceHashes=hashes,counts={k:len(v['rows']) for k,v in rankings.items()},coverage='partial',playersMissingFromGeneral=missing,generalVsStageDifferences=diffs)
    return {'novos-torneios/copa-ff-2026.json':content,'novos-torneios/index.json':packed(manifest),'imports/copa-ff-2026/report.json':packed(report)}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    for p,content in build().items():
        dest=ROOT/p
        if args.check:assert dest.exists() and dest.read_text()==content,'Desatualizado: '+p
        else:dest.write_text(content)
    print('Copa FF 2026: CSVs preservados, quatro recortes agregados; cobertura parcial.')
