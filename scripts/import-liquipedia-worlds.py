"""Deterministic, offline pilot importer. No wiki/HTML evaluation or network access.

The reviewed manifest selects a bounded batch. Nested templates and links are parsed
structurally; unsupported/missing data is reported, never replaced with invented zeroes.
"""
from pathlib import Path
from dataclasses import dataclass
import argparse, calendar, hashlib, html, json, re, unicodedata
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'imports/liquipedia-worlds'
def read(p):return json.loads(p.read_text())
def key(v):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFD',str(v)).encode('ascii','ignore').decode().lower())
def packed(d):return json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n'

@dataclass
class Template:
    name:str
    args:dict
    start:int=0
    end:int=0

def templates(text):
    """Yield nested templates, preserving offsets, and reject truncated source."""
    stack=[];out=[];i=0
    while i<len(text):
        if text.startswith('{{',i):stack.append(i);i+=2
        elif text.startswith('}}',i):
            if not stack:raise ValueError('Fechamento de template sem abertura')
            start=stack.pop();raw=text[start+2:i];parts=split_top(raw,'|');args={};pos=1
            for part in parts[1:]:
                assignment=split_top(part,'=',once=True)
                if len(assignment)>1:args[assignment[0].strip()]=assignment[1].strip()
                else:args[str(pos)]=part.strip();pos+=1
            out.append(Template(parts[0].strip(),args,start,i+2));i+=2
        else:i+=1
    if stack:raise ValueError('Código truncado: template não fechado')
    return sorted(out,key=lambda t:t.start)

def split_top(text,delimiter,once=False):
    chunks=[];begin=0;braces=0;links=0;i=0
    while i<len(text):
        if text.startswith('{{',i):braces+=1;i+=2;continue
        if text.startswith('}}',i):braces-=1;i+=2;continue
        if text.startswith('[[',i):links+=1;i+=2;continue
        if text.startswith(']]',i):links-=1;i+=2;continue
        if text[i]==delimiter and braces==0 and links==0:
            chunks.append(text[begin:i]);begin=i+1
            if once:chunks.append(text[begin:]);return chunks
        i+=1
    return chunks+[text[begin:]]

def first(text,name):return next((t for t in templates(text) if t.name.lower()==name.lower()),None)
def clean(text):
    text=re.sub(r'<!--.*?-->','',str(text),flags=re.S)
    text=re.sub(r'<ref\b[^>]*>.*?</ref>|<ref\b[^>]*/>','',text,flags=re.S|re.I)
    # Markup wrappers are converted to plain text, never emitted as HTML.
    for _ in range(12):
        ts=templates(text) if '{{' in text else []
        if not ts:break
        t=ts[-1];a=t.args;n=t.name.lower()
        value=a.get('2',a.get('1','')) if n in ['abbr','abbrlink','bgcolortext'] else ' ' if n.startswith(('flag','leagueicon','abbr/')) else a.get('1','') if n in ['team','player','teamopponent','opponent','nowrap'] else '| ' if n=='!' else ''
        text=text[:t.start]+value+text[t.end:]
    text=re.sub(r'\[\[([^\]|]+)\|([^\]]+)\]\]',r'\2',text)
    text=re.sub(r'\[\[([^\]]+)\]\]',r'\1',text)
    text=re.sub(r'\[https?://[^\s\]]+\s+([^\]]+)\]',r'\1',text)
    text=re.sub(r'<[^>]+>',' ',text).replace("'''",'').replace("''",'')
    return re.sub(r'\s+',' ',html.unescape(text)).strip()

def integer(value):
    value=clean(value)
    return int(value) if re.fullmatch(r'\d+',value) else None

def date(value):
    value=clean(value)
    iso=re.match(r'(\d{4}-\d{2}-\d{2})',value)
    if iso:return iso[1]
    m=re.match(r'([A-Za-z]+) (\d{1,2}), (\d{4})',value)
    if m:return f'{m[3]}-{list(calendar.month_name).index(m[1]):02}-{int(m[2]):02}'
    return ''

def compile_event(cfg):
    raw=(BASE/'sources'/cfg['file']).read_text();text=re.sub(r'<!--.*?-->','',raw,flags=re.S)
    all_t=templates(text);inf=next(t for t in all_t if t.name.lower()=='infobox league');a=inf.args
    report={'id':cfg['id'],'sourceFile':cfg['file'],'sha256':hashlib.sha256(raw.encode()).hexdigest(),'warnings':[]}
    items=[];aliases={};unresolved=set();headers=[(m.start(),len(m[1]),m[2].strip()) for m in re.finditer(r'(?m)^(={2,6})\s*([^=\n]+?)\s*\1\s*$',text)]
    for t in all_t:
        if t.name.lower()!='teamcard':continue
        p=t.args;name=clean(p.get('team',''));assert name,'TeamCard sem nome'
        stage=next((label for pos,level,label in reversed(headers) if pos<t.start and level==3),'')
        roster=dict(id=key(name),o=name,n=name,q=clean(p.get('qualifier','')),flag=clean(p.get('flag','')),p=[],s=[])
        roster['entryStage']='withdrawn' if stage=='Former Participants' or p.get('nostorage')=='true' else 'playins' if stage=='Play-ins Teams' else 'final'
        for field in sorted(p,key=lambda k:int(re.search(r'\d+',k)[0]) if re.fullmatch(r'p\d+',k) else 999):
            if not re.fullmatch(r'p\d+',field) or not clean(p[field]):continue
            roster['p'].append(dict(n=clean(p[field]),f=clean(p.get(field+'flag') or p.get('flag','')),r='player',t='player',l=clean(p.get(field+'link',''))))
        if clean(p.get('c','')):roster['s'].append(dict(n=clean(p['c']),f=clean(p.get('cflag') or p.get('flag','')),r='coach',t='staff',l=clean(p.get('clink',''))))
        for field in p:
            if not re.fullmatch(r't2c\d+',field) or not clean(p[field]):continue
            role=key(clean(p.get(field+'pos','')))
            role='analyst' if role in ['a','analyst','analista'] else 'assistant_coach' if 'assistant' in role else 'manager' if 'manager' in role else 'coach' if 'coach' in role else 'other'
            roster['s'].append(dict(n=clean(p[field]),f=clean(p.get(field+'flag') or p.get('flag','')),r=role,t='staff',l=clean(p.get(field+'link',''))))
        if not roster['s'] and roster['entryStage']!='withdrawn':report['warnings'].append('Comissão não informada: '+name)
        for member in roster['p']+roster['s']:
            context=name+'|'+member['r']+'|'+member['n'];person_id=cfg.get('personLinks',{}).get(context)
            if person_id:member['personId']=person_id
        items.append(roster);aliases[key(name)]=name
    for alias,name in cfg.get('teamAliases',{}).items():
        assert any(t['n']==name for t in items),('Alias sem equipe',alias,name)
        aliases[key(alias)]=name
    def resolve(value):
        value=clean(value);name=aliases.get(key(value))
        if not name:unresolved.add(value)
        return name or value
    pools=next(t for t in all_t if t.name=='TeamPrizePool');prizes=[];prize_order={};rank=0;withdrawn=[]
    # Only direct Slot arguments: adjacentContent/AwardPrizePool is not collective money.
    for k,value in pools.args.items():
        if not k.isdigit():continue
        slot=first(value,'Slot')
        if not slot:continue
        opponents=[first(v,'Opponent') for k,v in slot.args.items() if k.isdigit()]
        opponents=[o for o in opponents if o]
        names=[resolve(o.args.get('1','')) for o in opponents]
        dnp=slot.args.get('dnp')=='true';amount=slot.args.get('usdprize','').replace(',','')
        amount=int(amount) if amount.isdigit() else None
        if dnp:withdrawn.extend(names)
        else:
            for name in names:rank+=1;prize_order[name]=rank
        prizes.append([None if dnp else rank,' / '.join(names),' / '.join(names),amount,'Não disputou' if dnp else ''])
    finals=[];standings=[];stage_rows=[]
    bracket=next(t for t in all_t if t.name=='Bracket')
    for field,value in bracket.args.items():
        if not re.fullmatch(r'R\d+M\d+',field):continue
        match=first(value,'Match')
        if not match:continue
        p=match.args;label=clean(bracket.args.get(field+'header','Grande final'));is_final='final' in label.lower() or len([k for k in bracket.args if re.fullmatch(r'R\d+M\d+',k)])==1
        sid='final' if is_final else 'playins';label='Grande final' if is_final else 'Play-ins'
        kp=integer(p.get('p_kill',''));assert kp is not None,'Pontuação por abate ausente'
        placement={str(n):integer(p.get('p'+str(n),'0')) for n in range(1,13)}
        maps=[]
        for field,value in p.items():
            if re.fullmatch(r'map\d+',field):
                m=first(value,'Map');assert m,'Mapa sem template'
                maps.append([int(field[3:]),{'Purgatory':'Purgatório','Nexterra':'Nova Terra'}.get(clean(m.args.get('map','')),clean(m.args.get('map',''))),date(m.args.get('date','')),clean(m.args.get('vod',''))])
        maps.sort();rows=[]
        for field,value in p.items():
            if not re.fullmatch(r'opponent\d+',field):continue
            opponent=first(value,'TeamOpponent') or first(value,'Opponent');assert opponent
            q=opponent.args;original=clean(q.get('1',''));team=resolve(original);drops=[]
            for number,_,_,_ in maps:
                score=first(q.get('m'+str(number),''),'MS')
                if not score:raise ValueError(f'{team}: queda {number} sem MS')
                pos=integer(score.args.get('1',''));kills=integer(score.args.get('2',''))
                if pos is None or kills is None:raise ValueError(f'{team}: estatística ausente na queda {number}')
                assert 1<=pos<=12 and kills>=0,'Posição/abates inválidos'
                pp=placement[str(pos)];drops.append([number,pos,kills,pp,kills*kp,pp+kills*kp])
            kills=sum(m[2] for m in drops);pp=sum(m[3] for m in drops);points=pp+kills*kp
            rows.append([integer(q.get('placement','')),original,team,0,kills,pp,kills*kp,points,points,drops])
        for number,_,_,_ in maps:
            positions=[r[-1][number-1][1] for r in rows]
            assert len(positions)==len(set(positions)),'Posições repetidas numa queda'
            assert sorted(positions)==list(range(1,len(rows)+1)),'Posições incompletas numa queda'
        # Source explicit placements win ties. Official final order is independently in the prize pool.
        rows.sort(key=lambda r:(-r[8],r[0] if r[0] else prize_order.get(r[2],999) if is_final else 999,-r[4],-sum(d[1]==1 for d in r[-1]),r[-1][-1][1]))
        for pos,row in enumerate(rows,1):
            if row[0] is not None:assert row[0]==pos,('Desempate incompatível',row[2],row[0],pos)
            row[0]=pos
            if is_final:assert prize_order[row[2]]==pos,('Pontuação diverge da premiação',row[2],pos,prize_order.get(row[2]))
        table=dict(type='final' if is_final else 'standings',source='liquipedia-text',format='bracket2',title=label,stageId=sid,finished=p.get('finished')=='true',killPoint=kp,placementPoints=placement,
            mapCols=['match','map','date','vod'],maps=maps,cols=['pos','teamOriginal','team','headstart','kills','placementPts','killPts','finalPts','total','matches'],
            matchCols=['match','placement','kills','placementPts','killPts','total'],rows=rows,drops=len(maps),preservePositions=True)
        if is_final:finals.append(table)
        else:
            table['rounds']=['Q'+str(m[0]) for m in maps];table['cols'].append('results')
            for row in rows:row.append([d[5] for d in row[9]])
            standings.append(table)
        stage_rows.extend((sid,row[2]) for row in rows)
    assert len(finals)==1,'O piloto aceita uma final; várias finais exigem mapeamento explícito'
    played={name for _,name in stage_rows};rosters={t['n'] for t in items if t['entryStage']!='withdrawn'}
    assert played==rosters,('Elencos e resultados divergentes',played-rosters,rosters-played)
    assert set(withdrawn)=={t['n'] for t in items if t['entryStage']=='withdrawn'},'Desistências divergentes'
    awards=[]
    for pool in (t for t in all_t if t.name=='AwardPrizePool'):
        for k,value in pool.args.items():
            if not k.isdigit():continue
            slot=first(value,'Slot');o=next((first(v,'Opponent') for k,v in slot.args.items() if k.isdigit()),None) if slot else None
            if not o:continue
            awards.append(dict(award=clean(slot.args.get('award','')).replace('King of the Match #','Melhor da queda #'),player=clean(o.args.get('1','')),team=resolve(o.args.get('team','')),note=('Prêmio individual: US$ '+slot.args['usdprize'] if slot.args.get('usdprize') else '')))
    if unresolved:raise ValueError('Aliases de equipes não revisados: '+', '.join(sorted(unresolved)))
    declared=integer(a.get('prizepoolusd','').replace(',',''));distributed=sum(row[3] or 0 for row in prizes)
    prize_note=[]
    if declared!=distributed:
        prize_note.append(f'A fonte declara US$ {declared:,} no total; as linhas de premiação coletiva somam US$ {distributed:,}. Valores preservados sem preencher a diferença.')
        report['warnings']+=prize_note
    report['warnings'].append('Estatísticas individuais completas não estão nesta página Overview; ranking pessoal não importado.')
    if cfg['year']==2019:report['warnings'].append('A seção Most Kills é parcial e não informa o escopo completo; não foi tratada como ranking geral de jogadores.')
    start=date(a.get('sdate') or a.get('date',''));end=date(a.get('edate') or a.get('date',''))
    report['unlinkedPeople']=[dict(team=t['n'],name=m['n'],role=m['r']) for t in items if t['entryStage']!='withdrawn' for m in t['p']+t['s'] if not m.get('personId')]
    report.update(teams=len(played),withdrawn=withdrawn,players=sum(len(t['p']) for t in items),staff=sum(len(t['s']) for t in items),stages=[dict(name=t['title'],teams=len(t['rows']),drops=t['drops']) for t in [*standings,*finals]])
    report['warnings']+=cfg.get('warnings',[])
    result=dict(schema=1,id=cfg['id'],careerId=cfg['careerId'],name=cfg['name'],year=cfg['year'],startDate=start,endDate=end,tier='S',region='MUNDIAL',status='OFICIAL',family='MUNDIAL',organizer=clean(a.get('organizer','Garena')),
        logo='ffws-global-2026/Free_Fire_World_Series_2021_icon_allmode.png',format=cfg['format'],location=cfg['location'],teams=dict(type='teams',source='liquipedia-text',items=[t for t in items if t['entryStage']!='withdrawn']),withdrawnTeams=[t for t in items if t['entryStage']=='withdrawn'],
        slotRules=([f'group:1-{cfg["advance"]};up;Grande final',f'group:{cfg["advance"]+1}-{len(standings[0]["rows"])};down;Eliminado'] if standings else [])+['final:1;seedup;Campeão'],standings=standings,final=finals[0],awards=awards,aliases={k:v for k,v in cfg.get('teamAliases',{}).items()},prizePool=dict(type='teamPrizePool',currency='USD',title='Premiação por equipe',cols=['pos','teamOriginal','team','prize','status'],rows=prizes),
        prizeTotal=integer(a.get('prizepoolusd','').replace(',','')),source=dict(url=cfg['sourceUrl'],file='imports/liquipedia-worlds/sources/'+cfg['file'],sha256=report['sha256']),dataNotes=cfg.get('dataNotes',[])+prize_note+['Estatísticas individuais completas não constam no arquivo enviado.'],pilot=True)
    return result,report

def build():
    events=read(BASE/'manifest.json')['events'];out={};reports=[]
    for cfg in events:
        event,report=compile_event(cfg);out['novos-torneios/'+event['id']+'.json']=packed(event);reports.append(report)
    out['imports/liquipedia-worlds/report.json']=json.dumps(dict(batch=1,imported=len(events),reports=reports),ensure_ascii=False,indent=2)+'\n'
    return out
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');a=p.parse_args();files=build()
    for path,content in files.items():
        dest=ROOT/path
        if a.check:
            if not dest.exists() or dest.read_text()!=content:raise SystemExit('Dados desatualizados: '+path)
        else:dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(content)
    print(f'{len(files)-1} mundiais; {sum(len(v.encode()) for v in files.values())} bytes; zero rede/banco')
